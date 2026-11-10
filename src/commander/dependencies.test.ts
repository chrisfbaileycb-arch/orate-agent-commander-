import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { describe, it, expect } from 'vitest';
import { MissionDefSchema } from './types.js';
import { makeHarness, pull, codeOfAsync } from './test-helpers.js';

const step = (id: string, depends_on: string[]) => ({ id, depends_on, title: id, directive: `Execute ${id}`, proof: [{ type: 'exit_code' as const }] });
const mission = (steps: unknown[]) => ({ title: 'Dependency mission', steps });

describe('dependency scheduling', () => {
  it.each([
    [step('a', ['missing'])],
    [step('a', ['a'])],
    [step('a', ['b']), step('b', ['a'])],
    [step('a', []), step('a', [])],
    [step('a', []), step('b', ['a', 'a'])],
    [step('a', []), { title: 'legacy', directive: 'work', proof: [{ type: 'exit_code' }] }],
  ])('rejects invalid graphs before execution: %j', (...steps) => {
    expect(MissionDefSchema.safeParse(mission(steps)).success).toBe(false);
  });

  it('executes a forward reference and diamond in dependency order, with idempotent leases', async () => {
    const h = makeHarness();
    const m = h.app.airlock.openMission(h.operator, mission([
      step('join', ['left', 'right']), step('left', ['root']), step('right', ['root']), step('root', []),
    ]));
    for (const id of ['root', 'left', 'right', 'join']) {
      const d = pull(h, m.id);
      expect(d.directive).toBe(`Execute ${id}`);
      expect(pull(h, m.id).lease_id).toBe(d.lease_id);
      const result = await h.app.airlock.submitProof(h.worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 0 } });
      expect(result.verdict).toBe('PASSED');
    }
    expect(h.app.airlock.getMission(h.operator, m.id).status).toBe('completed');
  });

  it('does not satisfy a graph dependency by skipping its failed prerequisite', async () => {
    const h = makeHarness();
    const m = h.app.airlock.openMission(h.operator, mission([
      { ...step('root', []), max_attempts: 1 }, step('child', ['root']), step('independent', []),
    ]));
    const d = pull(h, m.id);
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 1 } });
    h.app.airlock.intervene(h.operator, m.id, { action: 'skip', reason: 'Root unavailable', step_id: m.steps[0].id });
    const next = pull(h, m.id);
    expect(next.directive).toBe('Execute independent');
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: next.lease_id, evidence: { exit_code: 0 } });
    const view = h.app.airlock.getMission(h.operator, m.id);
    expect(view.status).toBe('quarantined');
    expect(view.steps[1].status).toBe('locked');
  });
});


describe('branch-local quarantine and repair', () => {
  const open = () => {
    const h = makeHarness();
    const m = h.app.airlock.openMission(h.operator, mission([
      { ...step('root', []), max_attempts: 3 }, step('child', ['root']),
      step('independent', []), step('join', ['child', 'independent']),
    ]));
    return { h, m };
  };
  const failRoot = async (h: ReturnType<typeof makeHarness>, id: string) => {
    const d = pull(h, id);
    for (let n = 1; n <= 3; n++) {
      const r = await h.app.airlock.submitProof(h.worker, id, {
        lease_id: d.lease_id, evidence: { exit_code: n },
      });
      expect(r.verdict).toBe(n === 3 ? 'QUARANTINED' : 'REJECTED');
    }
    return d;
  };
  it('caps failed submissions, continues independent work, then repairs only the failed branch', async () => {
    const { h, m } = open();
    const failed = await failRoot(h, m.id);
    expect(h.app.airlock.getMission(h.operator, m.id).status).toBe('active');
    const independent = pull(h, m.id);
    expect(independent.directive).toBe('Execute independent');
    expect(await codeOfAsync(() => h.app.airlock.submitProof(h.worker, m.id, {
      lease_id: failed.lease_id, evidence: { exit_code: 0 },
    }))).toBe('LEASE_INVALID');
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: independent.lease_id, evidence: { exit_code: 0 } });
    expect(h.app.airlock.getDirective(h.worker, m.id)).toMatchObject({ state: 'HOLD', reason: 'quarantined' });
    const view = h.app.airlock.getMission(h.operator, m.id);
    expect(view.steps[1].blocked_by).toEqual(['root']);
    expect(view.steps[2].status).toBe('passed');
    const approval = h.app.approvals.list(h.tenantId, 'pending')[0]!;
    h.app.airlock.decideApproval(h.tenantId, approval.id, 'redirect', 'Use the repaired tool.', 'operator');
    for (const id of ['root', 'child', 'join']) {
      const d = pull(h, m.id);
      expect(d.directive).toContain(`Execute ${id}`);
      if (id === 'root') {
        expect(d.directive).toContain('Use the repaired tool.');
        expect(d.max_attempts).toBe(6);
      }
      await h.app.airlock.submitProof(h.worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 0 } });
    }
    const finished = h.app.airlock.getMission(h.operator, m.id);
    expect(finished.status).toBe('completed');
    expect(finished.steps[2].attempts).toHaveLength(1);
    expect(finished.ledger).toHaveLength(4);
  });

  it('queues a repair without replacing an independent lease or clearing its staged action', async () => {
    const { h, m } = open();
    await failRoot(h, m.id);
    const independent = pull(h, m.id);
    const quarantine = h.app.approvals.list(h.tenantId, 'pending')[0]!;
    await h.app.airlock.requestClearance(h.worker, m.id, {
      lease_id: independent.lease_id, action: { kind: 'sql', payload: 'ALTER TABLE users ADD COLUMN age int' },
    });
    h.app.airlock.decideApproval(h.tenantId, quarantine.id, 'redirect', 'Repair root.', 'operator');
    const paused = h.app.airlock.getMission(h.operator, m.id);
    expect(paused.status).toBe('paused');
    expect(paused.steps[0].status).toBe('locked');
    const clearance = h.app.approvals.list(h.tenantId, 'pending').find((a) => a.kind === 'clearance')!;
    expect(paused.paused_for).toBe(clearance.id);
    h.app.airlock.decideApproval(h.tenantId, clearance.id, 'authorize', undefined, 'operator');
    expect(pull(h, m.id).lease_id).toBe(independent.lease_id);
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: independent.lease_id, evidence: { exit_code: 0 } });
    expect(pull(h, m.id).directive).toContain('Repair root.');
  });

  it('handles multiple quarantined roots and targets approvals independently of the current step', async () => {
    const h = makeHarness();
    const m = h.app.airlock.openMission(h.operator, mission([
      { ...step('a', []), max_attempts: 1 }, { ...step('b', []), max_attempts: 1 }, step('join', ['a', 'b']),
    ]));
    for (let n = 0; n < 2; n++) {
      const d = pull(h, m.id);
      await h.app.airlock.submitProof(h.worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 1 } });
    }
    const approvals = h.app.approvals.list(h.tenantId, 'pending');
    const b = approvals.find((a) => a.stepId === m.steps[1].id)!;
    h.app.airlock.decideApproval(h.tenantId, b.id, 'authorize', undefined, 'operator');
    const d = pull(h, m.id);
    expect(d.directive).toBe('Execute b');
    expect(h.app.airlock.getMission(h.operator, m.id).steps[0].status).toBe('quarantined');
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 0 } });
    expect(h.app.airlock.getMission(h.operator, m.id).status).toBe('quarantined');
  });
  it('skips a non-current quarantine without disturbing the current lease', async () => {
    const { h, m } = open();
    await failRoot(h, m.id);
    const independent = pull(h, m.id);
    h.app.airlock.intervene(h.operator, m.id, {
      action: 'skip', step_id: m.steps[0].id, reason: 'Keep this branch unresolved.',
    });
    expect(pull(h, m.id).lease_id).toBe(independent.lease_id);
    expect(h.app.approvals.list(h.tenantId, 'pending')).toHaveLength(0);
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: independent.lease_id, evidence: { exit_code: 0 } });
    expect(h.app.airlock.getMission(h.operator, m.id).status).toBe('quarantined');
  });

  it('preserves branch state and approvals across a persisted restart', async () => {
    const h = makeHarness();
    const dir = mkdtempSync(join(tmpdir(), 'commander-branches-'));
    const config = { ...h.app.config, dataDir: dir };
    const app = createApp({ config, clock: h.clock.now, notifier: h.notifier });
    try {
      const { tenant, operatorKey } = app.auth.createTenant('restart', 10000);
      const { key } = app.auth.issueKey(tenant.id, 'worker');
      const operator = app.auth.authenticate(`Bearer ${operatorKey}`);
      const worker = app.auth.authenticate(`Bearer ${key}`);
      const m = app.airlock.openMission(operator, mission([
        { ...step('bad', []), max_attempts: 1 }, step('child', ['bad']), step('good', []),
      ]));
      const d = app.airlock.getDirective(worker, m.id);
      if (d.state !== 'DIRECTIVE') throw new Error('Expected directive');
      await app.airlock.submitProof(worker, m.id, { lease_id: d.lease_id, evidence: { exit_code: 1 } });
      app.store.flush();
      const restarted = createApp({ config, clock: h.clock.now, notifier: h.notifier });
      const next = restarted.airlock.getDirective(worker, m.id);
      expect(next).toMatchObject({ state: 'DIRECTIVE', directive: 'Execute good' });
      const pending = restarted.approvals.list(tenant.id, 'pending');
      expect(pending).toHaveLength(1);
      restarted.airlock.decideApproval(tenant.id, pending[0].id, 'authorize', undefined, 'operator');
      expect(restarted.airlock.getMission(operator, m.id).steps[0].status).toBe('locked');
      restarted.store.flush();
    } finally {
      app.store.flush();
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
