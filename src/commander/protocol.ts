import { z } from 'zod';
import type { Airlock } from './airlock.js';
import type { Auth } from './auth.js';
import type { Store } from './store.js';
import type { Mission, Principal } from './types.js';
import { ActionRequestSchema, EvidenceSchema } from './types.js';
import { CommanderError } from './errors.js';
import { redactSecrets } from './inquisitor.js';
import { iso, newId, sanitizeLine, type Clock } from './util.js';

export const ProtocolConfigSchema = z.object({
  max_agents: z.number().int().min(1).max(12).default(4),
  heartbeat_seconds: z.number().int().min(30).max(300).default(60),
});
const Session = { session_id: z.string().min(1).max(64) };
export const ProtocolRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('register'), name: z.string().min(1).max(80), harness: z.string().min(1).max(100),
    capabilities: z.array(z.enum(['clearance', 'observations', 'cancellation', 'independent_verification'])).max(4) }),
  z.object({ action: z.literal('heartbeat'), ...Session }),
  z.object({ action: z.literal('claim'), ...Session }),
  z.object({ action: z.literal('proof'), ...Session, lease_id: z.string().min(1).max(64), evidence: EvidenceSchema }),
  z.object({ action: z.literal('clearance'), ...Session, lease_id: z.string().min(1).max(64), request: ActionRequestSchema }),
  z.object({ action: z.literal('observe'), ...Session, lease_id: z.string().min(1).max(64), message: z.string().min(1).max(2000) }),
  z.object({ action: z.literal('status'), ...Session }),
  z.object({ action: z.literal('leave'), ...Session }),
]);
export type ProtocolRequest = z.infer<typeof ProtocolRequestSchema>;
export interface AgentSession {
  id: string; keyId: string; name: string; harness: string; capabilities: string[];
  status: 'active' | 'queued' | 'left' | 'expired'; lastSeen: number;
}
export interface Supervision {
  version: '1'; max_agents: number; heartbeat_seconds: number; sessions: AgentSession[];
}

/** Transport-neutral adapter contract. Progress reports are observations, never completion proof. */
export class CommanderProtocol {
  constructor(private readonly store: Store, private readonly airlock: Airlock, private readonly auth: Auth, private readonly clock: Clock) {}

  configure(p: Principal, missionId: string, raw: unknown) {
    this.auth.requireRole(p, 'operator');
    const m = this.mission(p, missionId);
    const parsed = ProtocolConfigSchema.safeParse(raw);
    if (!parsed.success) throw new CommanderError('INVALID', parsed.error.issues[0].message);
    if (m.status === 'completed' || m.status === 'killed') throw new CommanderError('CONFLICT', 'Mission is closed.');
    this.refresh(m);
    const active = m.supervision?.sessions.filter((s) => s.status === 'active').length ?? 0;
    if (parsed.data.max_agents < active) throw new CommanderError('CONFLICT', 'Release agent slots before lowering the limit.');
    if (!m.supervision && m.steps.some((s) => s.lease && !s.lease.revoked && s.lease.expiresAt > this.clock())) {
      throw new CommanderError('CONFLICT', 'Enable the protocol before issuing a legacy lease.');
    }
    m.supervision = { version: '1', ...parsed.data, sessions: m.supervision?.sessions ?? [] };
    this.event(m, 'protocol.configured', parsed.data);
    this.refresh(m);
    return this.view(m);
  }

  async dispatch(p: Principal, missionId: string, raw: unknown): Promise<object> {
    this.auth.requireRole(p, 'worker');
    const parsed = ProtocolRequestSchema.safeParse(raw);
    if (!parsed.success) throw new CommanderError('INVALID', parsed.error.issues[0].message);
    const input = parsed.data;
    const m = this.mission(p, missionId);
    if (!m.supervision) throw new CommanderError('CONFLICT', 'Operator must enable protocol version 1 first.');
    this.refresh(m);
    const config = m.supervision;
    if (input.action === 'register') {
      if (m.status === 'completed' || m.status === 'killed') return { state: 'CLOSED', status: m.status };
      let session = config.sessions.find((s) => s.keyId === p.keyId && s.name === input.name && (s.status === 'active' || s.status === 'queued'));
      if (!session) {
        if (config.sessions.length >= 256) throw new CommanderError('THROTTLED', 'Session registry full; create a new mission.');
        session = { id: newId('agt'), keyId: p.keyId, name: input.name, harness: input.harness,
          capabilities: [...new Set(input.capabilities)], status: 'queued', lastSeen: this.clock() };
        config.sessions.push(session);
        this.event(m, 'protocol.registered', { sessionId: session.id, harness: sanitizeLine(session.harness, 100) });
      }
      session.lastSeen = this.clock();
      this.refresh(m);
      return this.sessionView(m, session);
    }
    const session = config.sessions.find((s) => s.id === input.session_id && s.keyId === p.keyId);
    if (!session) throw new CommanderError('NOT_FOUND', 'Agent session not found.');
    if (input.action === 'status') return { ...this.sessionView(m, session), mission_status: m.status };
    if (session.status === 'expired' || session.status === 'left') throw new CommanderError('LEASE_INVALID', 'Session expired or released. Register again.');
    session.lastSeen = this.clock();
    this.store.touch();
    if (input.action === 'leave') {
      this.release(m, session, 'left');
      this.refresh(m);
      return this.sessionView(m, session);
    }
    if (input.action === 'heartbeat') {
      const lease = m.steps[m.current]?.lease;
      if (lease?.ownerAgentId === session.id && !lease.revoked && lease.expiresAt > this.clock()) {
        lease.expiresAt = session.lastSeen + config.heartbeat_seconds * 1000;
      }
      return this.sessionView(m, session);
    }
    if (session.status !== 'active') return { ...this.sessionView(m, session), state: 'QUEUED', retry_after_seconds: 5 };
    const principal = { ...p, agentId: session.id };
    if (input.action === 'claim') {
      const step = m.steps[m.current];
      if (step?.lease && !step.lease.revoked && step.lease.expiresAt > this.clock() && step.lease.ownerAgentId !== session.id) {
        return { state: 'WAIT', reason: 'current_step_owned', retry_after_seconds: 5 };
      }
      const directive = this.airlock.getDirective(principal, m.id);
      if (directive.state === 'DIRECTIVE') {
        const lease = m.steps[m.current].lease!;
        lease.ownerAgentId = session.id;
        lease.expiresAt = Math.min(lease.expiresAt, session.lastSeen + config.heartbeat_seconds * 1000);
        this.store.touch();
        return { ...directive, lease_expires_at: iso(lease.expiresAt), protocol_version: '1' };
      }
      return directive;
    }
    this.ownedLease(m, session, input.lease_id);
    if (input.action === 'proof') return this.airlock.submitProof(principal, m.id, { lease_id: input.lease_id, evidence: input.evidence });
    if (input.action === 'clearance') return this.airlock.requestClearance(principal, m.id, { lease_id: input.lease_id, action: input.request });
    this.event(m, 'protocol.observation', { sessionId: session.id, stepId: m.steps[m.current].id,
      message: redactSecrets(sanitizeLine(input.message, 2000)) });
    return { state: 'RECORDED', verified: false };
  }

  view(m: Mission) {
    const c = m.supervision;
    return { protocol_version: '1', mission_id: m.id, max_agents: c?.max_agents ?? 4,
      execution_concurrency: 1, active_agents: c?.sessions.filter((s) => s.status === 'active').length ?? 0,
      queued_agents: c?.sessions.filter((s) => s.status === 'queued').length ?? 0,
      heartbeat_seconds: c?.heartbeat_seconds ?? 60 };
  }
  private sessionView(m: Mission, s: AgentSession) {
    return { ...this.view(m), session_id: s.id, status: s.status, mission_status: m.status,
      should_stop: m.status === 'killed' || m.status === 'completed' || s.status === 'expired' || s.status === 'left',
      expires_at: iso(s.lastSeen + m.supervision!.heartbeat_seconds * 1000),
      capabilities: s.capabilities, capabilities_verified: false };
  }
  private mission(p: Principal, id: string) {
    const m = this.store.state.missions[id];
    if (!m || m.tenantId !== p.tenantId) throw new CommanderError('NOT_FOUND', 'Mission not found.');
    return m;
  }
  private ownedLease(m: Mission, s: AgentSession, id: string) {
    const lease = m.steps[m.current]?.lease;
    if (!lease || lease.id !== id || lease.revoked || lease.expiresAt <= this.clock() || lease.ownerAgentId !== s.id) {
      throw new CommanderError('LEASE_INVALID', 'Claim a fresh directive before reporting or acting.');
    }
  }
  private release(m: Mission, s: AgentSession, status: 'left' | 'expired') {
    s.status = status;
    for (const step of m.steps) {
      if (step.lease?.ownerAgentId === s.id) step.lease.revoked = true;
    }
    this.event(m, 'protocol.released', { sessionId: s.id, status });
  }
  private refresh(m: Mission) {
    const c = m.supervision;
    if (!c) return;
    for (const s of c.sessions) {
      if ((s.status === 'active' || s.status === 'queued') && s.lastSeen + c.heartbeat_seconds * 1000 <= this.clock()) this.release(m, s, 'expired');
    }
    if (m.status === 'completed' || m.status === 'killed') {
      for (const s of c.sessions) if (s.status === 'active' || s.status === 'queued') this.release(m, s, 'left');
      return;
    }
    let slots = c.max_agents - c.sessions.filter((s) => s.status === 'active').length;
    for (const s of c.sessions) {
      if (slots <= 0) break;
      if (s.status === 'queued') {
        s.status = 'active'; slots--;
        this.event(m, 'protocol.admitted', { sessionId: s.id });
      }
    }
  }
  private event(m: Mission, type: string, data: Record<string, unknown>) {
    this.store.audit(m.tenantId, type, { missionId: m.id, ...data });
    this.store.touch();
  }
}
