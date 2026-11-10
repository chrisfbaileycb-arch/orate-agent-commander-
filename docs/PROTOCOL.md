# Commander supervision protocol v1

A transport-neutral contract for custom workers and harness adapters. Both servers expose
the same service over HTTP and MCP. This is an integration interface, not a claim that
Claude Code, Cursor, or every third-party harness has been tested with it.

## Limits and execution model

- Default: **4 admitted agent sessions per mission**. Operator-configurable from **1 to 12**;
  12 is a hard validation ceiling. This counts supervised sessions, not workflow steps.
- Additional registrations queue FIFO. They must keep heartbeating and cannot claim work,
  submit proof, request clearance, or report observations until admitted.
- **One executing step per mission** in v1. Multiple sessions can be connected, waiting,
  and polling; this does not introduce parallel step execution or spawn model processes.
- Existing dependency scheduling and branch-local quarantine still apply. After a failed
  branch is quarantined, a worker can claim independent ready work. Dependents remain blocked.
- Session timeout defaults to 60 seconds (configurable 30–300). Heartbeat every 20 seconds
  with the default. A live heartbeat extends that session's unexpired current work lease.
  Expiry or leave revokes its claim and makes the slot available. Claim again if a lease
  expires; expired sessions must register again. The registry allows 256 records per mission.
- State and ownership persist with `COMMANDER_DATA_DIR`. This remains a single-server
  process with atomic in-process claims, not a distributed multi-instance lock service.

## Operator setup

Create a mission through the existing `/v1/operator/missions` API, then enable supervision
**before issuing any worker directive**:

```http
POST /v1/operator/missions/MISSION_ID/protocol
Authorization: Bearer OPERATOR_KEY
Content-Type: application/json

{"max_agents":4,"heartbeat_seconds":60}
```

Only operators configure admission. Lowering the limit below currently admitted sessions
is refused; release slots first. Legacy missions without this setup retain their existing
behavior. Protocol-enabled missions reject worker calls through the legacy directive,
proof, clearance, and native-guard entry points: use the authenticated protocol session.
The existing native guard needs a session-aware adapter for these missions.

## Shared worker contract

HTTP: `POST /v1/protocol/missions/MISSION_ID`, authenticated with a worker bearer key.
MCP: tool `commander_supervise` at `/v1/mcp`, with arguments
`{"mission_id":"MISSION_ID","request":{...}}` and the same bearer authentication.
The HTTP body and MCP `request` are identical:

| action | Additional fields | Meaning |
| --- | --- | --- |
| `register` | `name`, `harness`, `capabilities` | Idempotently register a name under the authenticated worker key |
| `heartbeat` | `session_id` | Keep session/queue presence alive; renew an unexpired owned work lease |
| `claim` | `session_id` | Receive the current ready directive or `WAIT`, `QUEUED`, `HOLD`, `COMPLETE`, `TERMINATED` |
| `observe` | `session_id`, `lease_id`, `message` | Record redacted progress for owned work; never verifies completion |
| `clearance` | `session_id`, `lease_id`, `request` | Run the existing action-policy and approval gate |
| `proof` | `session_id`, `lease_id`, `evidence` | Run the existing mechanical verifiers and configured witness checks |
| `status` | `session_id` | Poll session status, admission counts, mission status, and `should_stop` |
| `leave` | `session_id` | Release session and revoke its claim |

Register example:

```json
{
  "action":"register",
  "name":"worker-1",
  "harness":"my-harness/1.0",
  "capabilities":["clearance","observations","cancellation"]
}
```

Capability names are `clearance`, `observations`, `cancellation`, and
`independent_verification`. These are **adapter declarations**, returned with
`capabilities_verified:false`; registration does not prove interception or verification.
Actual independent verification requires operator-configured witness checks.

Save the returned `session_id`. Each admitted session can claim work; another session
receives `WAIT` while a live claim exists. Repeating an owned claim is idempotent while
the lease is live. Lease IDs are bound to sessions, and sessions to tenant and worker key.
Use a distinct worker key per independently trusted agent; sharing a key shares authority.
Operator mission views include the roster (without authentication key IDs), and the
existing operator audit endpoint contains protocol lifecycle and progress events.

## Adapter transports

`src/commander/protocol-client.ts` provides both transports:

```ts
import { httpProtocolTransport, mcpProtocolTransport } from './protocol-client.js';

// Inside your trusted harness process; keep workerKey in its secret store.
const send = httpProtocolTransport(commanderUrl, missionId, workerKey);
// Or use an authenticated MCP SDK client:
const sendViaMcp = mcpProtocolTransport(client.callTool.bind(client), missionId);

const registered = await send({
  action: 'register', name: 'worker-1', harness: 'my-harness/1.0',
  capabilities: ['clearance', 'observations', 'cancellation'],
});
const sessionId = registered.session_id as string;
const directive = await sendViaMcp({ action: 'claim', session_id: sessionId });
```

The adapter must translate the directive into its harness's actions, request clearance
before relevant tool calls, and submit the actual results using `proof`. Use the same
mission, session, and lease for the whole step. For a staged clearance, poll the existing
`commander_clearance_status` tool and follow the operator's decision. When proof returns
`QUARANTINED`, pull a new directive: another branch may be ready. Honor queue/hold/wait
responses without invoking a model in a tight retry loop. Poll no faster than the returned
retry interval; keep the session heartbeat separate from model execution.

After a transport timeout, inspect status and reclaim the current directive before
retrying an action. Neither network retries nor external side effects are automatically
idempotent. The client helpers deliberately do not blindly retry proof or actions.

## Enforcement boundary

Commander bounds admission and verifies progression. Adapters must stop their own worker
when `should_stop` is true, a lease expires, or clearance is denied; Commander cannot
terminate arbitrary remote processes. A harness that bypasses tool interception remains
outside action-level supervision, even if it registered capabilities. Restrict execution
credentials and use the harness's own sandbox/interception mechanisms. Claim expiry
revokes authority and rejects stale proof; it cannot undo an external side effect already
in flight. No real external harness compatibility is certified by the custom-client tests.
