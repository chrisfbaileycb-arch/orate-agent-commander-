import { describe, it, expect } from 'vitest';
import { MissionDefSchema } from './types.js';
import { makeHarness, pull } from './test-helpers.js';

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
    h.app.airlock.intervene(h.operator, m.id, { action: 'skip', reason: 'Root unavailable' });
    const next = pull(h, m.id);
    expect(next.directive).toBe('Execute independent');
    await h.app.airlock.submitProof(h.worker, m.id, { lease_id: next.lease_id, evidence: { exit_code: 0 } });
    const view = h.app.airlock.getMission(h.operator, m.id);
    expect(view.status).toBe('quarantined');
    expect(view.steps[1].status).toBe('locked');
  });
});
