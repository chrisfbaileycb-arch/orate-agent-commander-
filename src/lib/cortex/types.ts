/**
 * CORTEX Topology Matrix - Type Definitions
 * The Orator Agentic AI Orchestration & Telemetry Visualizer
 */

export type CortexPhase = "parse" | "plan" | "draft" | "eval" | "retry";

export interface CortexAgent {
  id: string;
  name: string;
  role: string;
  color: string;
  accent: string;
  model: string;
  status: "idle" | "deliberating" | "streaming" | "verifying" | "consensus";
  confidence: number;
  tokensProcessed: number;
  activeTool?: string;
}

export interface CortexReasoningStep {
  id: string;
  phase: CortexPhase;
  agentId: string;
  agentName: string;
  title: string;
  detail: string;
  confidence: number;
  threshold: number;
  timestamp: number;
  loopBack?: boolean;
  loopTargetPhase?: CortexPhase;
  tokenCount: number;
  worldCoord?: [number, number, number];
}

export interface CortexToolCall {
  id: string;
  agentId: string;
  toolName: string;
  argsSummary: string;
  status: "invoking" | "executing" | "completed" | "failed";
  latencyMs: number;
  timestamp: number;
  outputSummary?: string;
}

export interface CortexTokenPulse {
  agentId: string;
  tokenText: string;
  tokenCount: number;
  entropy: number;
  confidence: number;
  timestamp: number;
}

export interface CortexMetrics {
  tokPerSec: number;
  totalTokens: number;
  contextLoadPct: number; // 0 - 100
  latencyMs: number;
  attentionSpike: number; // 0 - 1
  tokenEntropy: number; // 0 - 1
  consensusScore: number; // 0 - 1
  loopCount: number;
  evalPassed: boolean;
  activeAgentCount: number;
  totalAgents: number;
  estimatedCostUsd: number;
  provider: string;
  modelName: string;
  temperature: number;
  perplexity: number;
}

export interface CortexStreamEvent {
  type:
    | "onToken"
    | "onReasoningStep"
    | "onToolCall"
    | "onConsensus"
    | "onPhaseChange"
    | "onMetricsUpdate"
    | "onReset";
  payload: any;
  timestamp: number;
}

export type CortexScenarioId =
  | "codebase_synthesis"
  | "multi_provider_fallback"
  | "inquest_resolution"
  | "verification_audit";

export interface CortexScenario {
  id: CortexScenarioId;
  name: string;
  description: string;
  primaryProvider: string;
  agents: CortexAgent[];
  stepsCount: number;
}

export interface CognitiveDimension {
  metric: string;
  value: number; // 0 - 100
  target: number;
}
