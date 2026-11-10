import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { describe, expect, it } from 'vitest';
import { makeHarness, addTenant } from './test-helpers.js';
import { CommanderError } from './errors.js';

const graph = { title: 'Protocol graph', steps: [
  { id: 'bad', depends_on: [], title: 'Bad', directive: 'Try the tool', max_attempts: 1, proof: [{ type: 'exit_code' }] },
  { id: 'child', depends_on: ['bad'], title: 'Child', directive: 'Needs tool output', proof: [{ type: 'exit_code' }] },
  { id: 'good', depends_on: [], title: 'Good', directive: 'Independent work', proof: [{ type: 'exit_code' }] },
] };
function setup(max_agents = 4) {
  const h = makeHarness();
  const m = h.app.airlock.openMission(h.operator, graph);
  h.app.protocol.configure(h.operator, m.id, { max_agents });
  return { ...h, m };
}
const register = (name: string) => ({ action: 'register', name, harness: 'custom-test', capabilities: ['clearance', 'observations'] });
// Dynamic response fields here intentionally exercise the transport-shaped contract.
type Reply = Record<string, any>;
async function send(h: ReturnType<typeof setup>, request: object, principal = h.worker): Promise<Reply> {
  return h.app.protocol.dispatch(principal, h.m.id, request);
}

describe('supervision protocol v1', () => {
  it('defaults to four, refuses limits above twelve, and requires operator authority', () => {
    const h = setup();
    expect(h.app.protocol.configure(h.operator, h.m.id, {}).max_agents).toBe(4);
    expect(() => h.app.protocol.configure(h.operator, h.m.id, { max_agents: 13 })).toThrow(CommanderError);
    expect(() => h.app.protocol.configure(h.worker, h.m.id, {})).toThrow(CommanderError);
  });

  it('admits twelve maximum, queues additional agents, and promotes FIFO on leave', async () => {
    const h = setup(12);
    const sessions = await Promise.all(Array.from({ length: 15 }, (_, i) => send(h, register(`agent-${i}`))));
    expect(sessions.filter((s) => s.status === 'active')).toHaveLength(12);
    expect(sessions[14].queued_agents).toBe(3);
    expect((await send(h, { action: 'claim', session_id: sessions[12].session_id })).state).toBe('QUEUED');
    expect(() => h.app.protocol.configure(h.operator, h.m.id, { max_agents: 2 })).toThrow(CommanderError);
    await send(h, { action: 'leave', session_id: sessions[0].session_id });
    expect((await send(h, { action: 'status', session_id: sessions[12].session_id })).status).toBe('active');
    expect((await send(h, { action: 'status', session_id: sessions[13].session_id })).status).toBe('queued');
  });

  it('binds claims to sessions and prevents legacy-route bypass and false completion', async () => {
    const h = setup();
    const a = await send(h, register('a'));
    const b = await send(h, register('b'));
    const d = await send(h, { action: 'claim', session_id: a.session_id });
    expect(d.state).toBe('DIRECTIVE');
    expect((await send(h, { action: 'claim', session_id: b.session_id })).state).toBe('WAIT');
    expect((await send(h, { action: 'claim', session_id: a.session_id })).lease_id).toBe(d.lease_id);
    await expect(send(h, { action: 'proof', session_id: b.session_id, lease_id: d.lease_id, evidence: { exit_code: 0 } })).rejects.toMatchObject({ code: 'LEASE_INVALID' });
    expect(() => h.app.airlock.getDirective(h.worker, h.m.id)).toThrow(CommanderError);
    await expect(h.app.airlock.submitProof(h.worker, h.m.id, { lease_id: d.lease_id, evidence: { exit_code: 0 } })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await send(h, { action: 'observe', session_id: a.session_id, lease_id: d.lease_id, message: 'Task complete!' })).toMatchObject({ verified: false });
    expect(h.app.airlock.getMission(h.operator, h.m.id).steps[0].status).toBe('released');
    const result = await send(h, { action: 'proof', session_id: a.session_id, lease_id: d.lease_id, evidence: { exit_code: 1 } });
    expect(result.verdict).toBe('QUARANTINED');
    const next = await send(h, { action: 'claim', session_id: b.session_id });
    expect(next.directive).toBe('Independent work');
    expect(h.app.airlock.getMission(h.operator, h.m.id).steps[1].blocked_by).toEqual(['bad']);
  });

  it('expires missing agents, revokes their claims, and rejects old proof after reassignment', async () => {
    const h = setup(1);
    const a = await send(h, register('a'));
    const d = await send(h, { action: 'claim', session_id: a.session_id });
    h.clock.advance(30000);
    const b = await send(h, register('b'));
    h.clock.advance(31000);
    expect((await send(h, { action: 'heartbeat', session_id: b.session_id })).status).toBe('active');
    const next = await send(h, { action: 'claim', session_id: b.session_id });
    expect(next.lease_id).not.toBe(d.lease_id);
    await expect(send(h, { action: 'proof', session_id: a.session_id, lease_id: d.lease_id, evidence: { exit_code: 0 } })).rejects.toMatchObject({ code: 'LEASE_INVALID' });
  });

  it('keeps session identity tenant- and key-bound, and registration idempotent', async () => {
    const h = setup();
    const a = await send(h, register('a'));
    expect((await send(h, register('a'))).session_id).toBe(a.session_id);
    const other = h.app.auth.issueKey(h.tenantId, 'worker');
    const worker = h.app.auth.authenticate(`Bearer ${other.key}`);
    await expect(send(h, { action: 'status', session_id: a.session_id }, worker)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(send(h, register('outsider'), addTenant(h).worker)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('communicates mission cancellation on status and stops admitting agents', async () => {
    const h = setup();
    const a = await send(h, register('a'));
    h.app.airlock.intervene(h.operator, h.m.id, { action: 'kill', reason: 'Stop run' });
    expect(await send(h, { action: 'status', session_id: a.session_id })).toMatchObject({ should_stop: true, mission_status: 'killed', active_agents: 0 });
    expect(await send(h, register('new'))).toMatchObject({ state: 'CLOSED' });
  });
  it('renews a healthy lease with heartbeats and routes actions through clearance', async () => {
    const h = setup();
    const a = await send(h, register('a'));
    const d = await send(h, { action: 'claim', session_id: a.session_id });
    for (let i = 0; i < 4; i++) {
      h.clock.advance(30000);
      await send(h, { action: 'heartbeat', session_id: a.session_id });
    }
    const cleared = await send(h, { action: 'clearance', session_id: a.session_id, lease_id: d.lease_id,
      request: { kind: 'shell', payload: 'npm test' } });
    expect(cleared.verdict).toBe('CLEARED');
    const proved = await send(h, { action: 'proof', session_id: a.session_id, lease_id: d.lease_id, evidence: { exit_code: 0 } });
    expect(proved.verdict).toBe('PASSED');
  });

  it('retains slots, queue order and claim identity after restart', async () => {
    const h = makeHarness();
    const dir = mkdtempSync(join(tmpdir(), 'commander-protocol-'));
    const config = { ...h.app.config, dataDir: dir };
    const app = createApp({ config, clock: h.clock.now, notifier: h.notifier });
    try {
      const { tenant, operatorKey } = app.auth.createTenant('persisted', 10000);
      const { key } = app.auth.issueKey(tenant.id, 'worker');
      const worker = app.auth.authenticate(`Bearer ${key}`);
      const operator = app.auth.authenticate(`Bearer ${operatorKey}`);
      const m = app.airlock.openMission(operator, graph);
      app.protocol.configure(operator, m.id, { max_agents: 1 });
      const a = await app.protocol.dispatch(worker, m.id, register('a')) as Reply;
      const b = await app.protocol.dispatch(worker, m.id, register('b')) as Reply;
      const d = await app.protocol.dispatch(worker, m.id, { action: 'claim', session_id: a.session_id }) as Reply;
      app.store.flush();
      const restarted = createApp({ config, clock: h.clock.now, notifier: h.notifier });
      expect(await restarted.protocol.dispatch(worker, m.id, { action: 'claim', session_id: a.session_id })).toMatchObject({ lease_id: d.lease_id });
      expect(await restarted.protocol.dispatch(worker, m.id, { action: 'status', session_id: b.session_id })).toMatchObject({ status: 'queued', active_agents: 1 });
      restarted.store.flush();
    } finally { app.store.flush(); rmSync(dir, { recursive: true, force: true }); }
  });

});
