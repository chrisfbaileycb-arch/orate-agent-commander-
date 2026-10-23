import type { ModelExpert, InquestAnswer, ForgePlan } from "./types";
import { INQUEST_QUESTIONS } from "./inquest";

/** ---------- US Big Tech Sovereign Consortium Pipeline ----------
 * Rather than cycling models at random, each US powerhouse is assigned a distinct phase:
 * 1. INGEST & ARCHITECT: Google Gemini (Gemini 3.8 / 3.7 Flash)
 * 2. CLOUD SPEC & BACKEND: AWS (Bedrock / Kiro Engine)
 * 3. CORE IMPLEMENTATION: Anthropic (Claude Sonnet 5 / Claude Code)
 * 4. AUDIT & ENTERPRISE: Microsoft (Copilot / Azure AI Foundry / OpenAI)
 * 5. REAL-TIME CONTEXT: xAI (Grok)
 */

export const SOVEREIGN_CONSORTIUM_ROSTER: ModelExpert[] = [
  {
    id: "sov-google-gemini",
    label: "Google Gemini (Gemini 3.8 Flash)",
    provider: "gemini",
    model: "gemini-3.8-flash",
    role: "architect",
    tier: "paid",
  },
  {
    id: "sov-aws-bedrock",
    label: "AWS Bedrock / Kiro Engine",
    provider: "aws-bedrock",
    model: "bedrock-kiro-v2",
    role: "schema",
    tier: "paid",
  },
  {
    id: "sov-anthropic-claude",
    label: "Anthropic Claude (Sonnet 5)",
    provider: "anthropic",
    model: "claude-sonnet-5",
    role: "frontend",
    tier: "paid",
  },
  {
    id: "sov-microsoft-azure",
    label: "Microsoft Copilot & Azure AI",
    provider: "microsoft-azure",
    model: "azure-ai-copilot-enterprise",
    role: "security",
    tier: "paid",
  },
  {
    id: "sov-xai-grok",
    label: "xAI Grok (Ecosystem Radar)",
    provider: "xai-grok",
    model: "grok-2-live",
    role: "review",
    tier: "paid",
  },
];

export const EXPERT_ROSTER: ModelExpert[] = SOVEREIGN_CONSORTIUM_ROSTER;

export const CONSORTIUM_PHASES = [
  {
    phase: 1,
    id: "discovery",
    company: "Google",
    engine: "Gemini 3.8 / 3.7 Flash",
    duty: "Discovery & Multimodal Ingest",
    detail: "15-question interactive voice inquest, user requirements breakdown, massive token context absorption.",
    color: "#35e0ff",
  },
  {
    phase: 2,
    id: "architecture",
    company: "AWS",
    engine: "Bedrock / Kiro Engine",
    duty: "Architecture & Cloud Specifications",
    detail: "Spec-driven infrastructure blueprints, IAM roles, cloud isolation boundaries, and relational schemas.",
    color: "#f59e0b",
  },
  {
    phase: 3,
    id: "implementation",
    company: "Anthropic",
    engine: "Claude Sonnet 5 / Claude Code",
    duty: "Core Frontend & Component Engineering",
    detail: "Deterministic JSX/TSX layout, complex state machines, AST refactoring, and zero-hallucination styling.",
    color: "#a855f7",
  },
  {
    phase: 4,
    id: "audit",
    company: "Microsoft",
    engine: "Copilot & Azure AI Foundry",
    duty: "Zero-Trust Security & Enterprise Audit",
    detail: "Zero-trust vulnerability scan, automated unit test generation, CI/CD pipeline, and GitHub orchestration.",
    color: "#10b981",
  },
  {
    phase: 5,
    id: "verification",
    company: "xAI",
    engine: "Grok Edge Intelligence",
    duty: "Real-Time Context & API Contracts",
    detail: "Live edge validation, current API contract checks, dependency versioning, and live ecosystem radar.",
    color: "#ec4899",
  },
];

/** Select the sovereign quorum for a forge run. */
export function selectQuorum(clientId: string, tier: "free" | "paid"): ModelExpert[] {
  return SOVEREIGN_CONSORTIUM_ROSTER;
}

export interface RouterEvent {
  at: number;
  expert: string;
  action: string;
}

export function routerIntroLine(tier: "free" | "paid"): string {
  return "US Big Tech Sovereign Consortium engaged: Google Gemini (Ingest) → AWS Bedrock (Spec) → Anthropic Claude (Engineering) → Microsoft Azure (Audit) → xAI Grok (Radar).";
}

/** Extract the archetype keyword used by the generator to theme the plan. */
export function archetypeFromAnswers(answers: Record<string, string>): string {
  const blob = Object.values(answers).join(" ").toLowerCase();
  const table: [RegExp, string][] = [
    [/(book|reserv|schedul|appointment)/, "booking"],
    [/(crm|lead|pipeline|contact)/, "crm"],
    [/(shop|store|ecommerce|commerce|cart|checkout)/, "commerce"],
    [/(habit|track|journal|streak)/, "tracker"],
    [/(chat|messag|social|forum)/, "social"],
    [/(dashboard|analytic|metric|report)/, "analytics"],
    [/(task|kanban|project|sprint)/, "tasks"],
    [/(learn|course|school|tutor|quiz)/, "learning"],
    [/(health|fitness|gym|workout)/, "fitness"],
    [/(file|document|note|wiki)/, "docs"],
  ];
  for (const [rx, archetype] of table) {
    if (rx.test(blob)) return archetype;
  }
  return "custom-tool";
}

export function appNameFromAnswers(answers: Record<string, string>): string {
  const raw = (answers["q1"] ?? "").trim();
  if (!raw) return "untitled-forge";
  const words = raw
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length ? words.join("-") : "untitled-forge";
}

export function inquestDigest(answers: Record<string, string>): string {
  return INQUEST_QUESTIONS.map((q) => {
    const v = answers[q.id];
    if (!v) return null;
    return `${q.id.toUpperCase()} ${q.prompt} → ${v}`;
  })
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

export function planTelemetry(plan: ForgePlan): string {
  return `archetype=${plan.archetype} experts=${plan.experts.length} files=${plan.files.length} audit=${plan.audit.score}%`;
}
