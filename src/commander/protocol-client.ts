import type { ProtocolRequest } from './protocol.js';

export type ProtocolReply = Record<string, unknown>;
export type ProtocolTransport = (request: ProtocolRequest) => Promise<ProtocolReply>;

function reply(value: unknown): ProtocolReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed Commander response.');
  return value as ProtocolReply;
}

/** Server-side adapter transport. Keep the worker key in the harness's secret store. */
export function httpProtocolTransport(baseUrl: string, missionId: string, workerKey: string, fetchImpl: typeof fetch = fetch): ProtocolTransport {
  const url = new URL(`/v1/protocol/missions/${encodeURIComponent(missionId)}`, baseUrl);
  return async (request) => {
    const response = await fetchImpl(url, {
      method: 'POST', headers: { authorization: `Bearer ${workerKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`Commander refused request (${response.status}).`);
    return reply(await response.json());
  };
}

/** Pass an authenticated MCP client's callTool method, bound to that client. */
export function mcpProtocolTransport(callTool: (input: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>, missionId: string): ProtocolTransport {
  return async (request) => {
    const result = reply(await callTool({ name: 'commander_supervise', arguments: { mission_id: missionId, request } }));
    if (result.isError) throw new Error('Commander refused MCP request. Inspect the tool result before retrying.');
    return reply(result.structuredContent);
  };
}
