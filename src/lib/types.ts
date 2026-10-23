/** ---------- Shared domain types for the ORATOR.AI forge ---------- */

export type ModelProvider =
  | "gemini"
  | "aws-bedrock"
  | "anthropic"
  | "microsoft-azure"
  | "xai-grok"
  | "openai"
  | "openrouter"
  | "cheaper-inference"
  | "huggingface"
  | "omniroute"
  | "local"
  | "deterministic";

export interface ModelExpert {
  id: string;
  label: string;
  provider: ModelProvider;
  model: string;
  role:
    | "architect"
    | "schema"
    | "backend"
    | "frontend"
    | "review"
    | "security"
    | "performance";
  tier: "free" | "paid";
}

export interface InquestAnswer {
  questionId: string;
  value: string;
}

export type SessionStatus =
  | "landing"
  | "inquest"
  | "forging"
  | "delivered"
  | "payment_required"
  | "booked";

export type IngestKind = "document" | "image" | "code" | "repo";

export interface IngestItem {
  id: string;
  kind: IngestKind;
  /** File name or repo label. */
  name: string;
  /** Size/type note or read-only flag. */
  meta: string;
  addedAt: number;
}

export interface SessionState {
  clientId: string;
  status: SessionStatus;
  sessionsUsed: number;
  freeSessions: number;
  chartered: boolean;
  answers: Record<string, string>;
  /** Attachments + connected repos, carried into the delivery dossier. */
  ingest: IngestItem[];
  startedAt: number;
}

export interface AuditFinding {
  id: number;
  title: string;
  detail: string;
  status: "pass" | "pass-advisory" | "fail";
  weight: 1 | 2 | 3;
}

export interface AuditResult {
  score: number;
  passed: number;
  total: number;
  findings: AuditFinding[];
}

export interface MindMapNode {
  id: string;
  label: string;
  kind: "core" | "system" | "module" | "contract" | "ops";
  detail: string;
}

export interface MindMapEdge {
  from: string;
  to: string;
  label: string;
}

export interface MindMap {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export interface GeneratedFile {
  path: string;
  language: string;
  contents: string;
}

export interface ForgePlan {
  appName: string;
  archetype: string;
  summary: string;
  stack: string[];
  experts: ModelExpert[];
  mindMap: MindMap;
  audit: AuditResult;
  files: GeneratedFile[];
  phases: { id: string; label: string; detail: string; expert: string }[];
}

export interface BookingRecord {
  slotISO: string;
  clientId: string;
  createdAt: number;
}

export interface ScarcityTelemetry {
  capacityPct: number;
  activeBuilds: number;
  maxBuilds: number;
  slotsRemaining: number;
}
