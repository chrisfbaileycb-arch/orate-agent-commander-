/**
 * ============================================================================
 * ORATOR.AI PROVIDER-NEUTRAL INFERENCE CONTRACTS
 * Version: 2.1.0
 * ============================================================================
 */

import type { ModelProvider } from "./types";

/**
 * Orator Task Taxonomy
 * Granular classifications mapped directly to the forge lifecycle.
 */
export type OratorTaskType =
  | "intent_clarification"
  | "requirements_extraction"
  | "workflow_discovery"
  | "product_reasoning"
  | "interface_planning"
  | "data_modeling"
  | "api_design"
  | "code_generation"
  | "test_generation"
  | "security_review"
  | "accessibility_review"
  | "failure_diagnosis"
  | "artifact_reconciliation"
  | "final_verification";

/**
 * High-level Orator Task Category for routing policies
 */
export type OratorTaskCategory =
  | "exploration"
  | "complete_build"
  | "verification"
  | "repair"
  | "fallback";

/**
 * Cost Classifications
 * Explicitly separates cost from capability.
 */
export type ModelCostClassification =
  | "free_allocation"
  | "economic_no_cost"
  | "operator_funded"
  | "paid_api"
  | "local_inference"
  | "customer_funded"
  | "unknown_cost";

/**
 * Privacy Classifications
 * Enforced before dispatching project source materials.
 */
export type ModelPrivacyClassification =
  | "zero_data_retention"
  | "ephemeral_inference_only"
  | "standard_commercial"
  | "local_isolated";

/**
 * Normalized Model Record
 * Provider discovery normalizes upstream representations into this safe structure.
 */
export interface NormalizedModel {
  internalReference: string; // e.g. "cheaper-inference/gemini-1.5-flash"
  provider: ModelProvider;
  providerModelId: string; // Upstream wire identifier, e.g. "google/gemini-1.5-flash"
  displayName: string;
  supportedModalities: ("text" | "image" | "audio" | "code")[];
  contextCapacityTokens: number;
  structuredOutputCapability: "native" | "json_schema" | "prompt_coerced" | "none";
  toolUseCapability: boolean;
  codingSuitability: number; // 0-100 score
  reasoningSuitability: number; // 0-100 score
  visionCapability: boolean;
  expectedLatencyMs: number;
  costClassification: ModelCostClassification;
  privacyClassification: ModelPrivacyClassification;
  currentAvailability: "available" | "degraded" | "unavailable";
  lastSuccessfulHealthCheck: number;
  benchmarkVersion: string;
  eligibleOratorWorkflows: OratorTaskType[];
  operatorApprovalStatus: "approved" | "provisional" | "blocked";
  estimatedCostPer1kInputTokensUsd: number;
  estimatedCostPer1kOutputTokensUsd: number;
}

/**
 * Uniform Chat Message format
 */
export interface InferenceMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

/**
 * Normalized Inference Request
 */
export interface InferenceRequest {
  taskType: OratorTaskType;
  taskCategory: OratorTaskCategory;
  messages: InferenceMessage[];
  responseFormat?: "text" | "json";
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  stopSequences?: string[];
  privacyRequirement?: ModelPrivacyClassification;
  maxCostUsd?: number;
  requiresToolUse?: boolean;
  minimumContextTokens?: number;
  signal?: AbortSignal;
}

/**
 * Normalized Inference Response
 */
export interface InferenceResponse {
  id: string;
  provider: ModelProvider;
  requestedModelId: string;
  returnedModelId: string;
  content: string;
  structuredData?: unknown;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number;
  reportedCostUsd?: number;
  costClassification: ModelCostClassification;
  finishReason: "stop" | "length" | "tool_call" | "content_filter" | "unknown";
  timestamp: number;
}

/**
 * Normalized Error Classifications
 * Distinguishes transient failures from fatal configuration/auth issues.
 */
export type InferenceErrorCode =
  | "AUTH_FAILURE"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "MODEL_UNAVAILABLE"
  | "CONTEXT_EXCEEDED"
  | "INVALID_STRUCTURED_OUTPUT"
  | "TOOL_CALL_FAILURE"
  | "ARTIFACT_VALIDATION_FAILURE"
  | "SAFETY_REFUSAL"
  | "BUDGET_EXHAUSTED"
  | "CONFIG_ERROR"
  | "NETWORK_TIMEOUT"
  | "UPSTREAM_SERVER_ERROR"
  | "UNKNOWN_ERROR";

export interface NormalizedInferenceError {
  code: InferenceErrorCode;
  message: string;
  isTransient: boolean; // True if eligible for retry / fallback
  provider: ModelProvider;
  modelId?: string;
  statusCode?: number;
  rawDetails?: string;
}

/**
 * First-Class Provider Interface
 * All model providers (Cheaper Inference, OpenRouter, direct, Hugging Face, OmniRoute, Local)
 * implement this common contract.
 */
export interface IModelProvider {
  readonly id: ModelProvider;
  readonly name: string;
  readonly isEnabled: boolean;
  readonly isHosted: boolean;

  /** Check provider operational health */
  checkHealth(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;

  /** Discover models available through this provider */
  discoverModels(): Promise<NormalizedModel[]>;

  /** Execute inference request */
  generateResponse(request: InferenceRequest, model: NormalizedModel): Promise<InferenceResponse>;

  /** Cancel an in-flight operation if supported */
  cancel?(requestId: string): void;
}

/**
 * Immutable Routing Audit Record
 */
export interface RoutingAuditRecord {
  id: string;
  timestamp: number;
  taskType: OratorTaskType;
  taskCategory: OratorTaskCategory;
  providerUsed: ModelProvider;
  requestedModelRef: string;
  returnedModelRef: string;
  customerFacingStatus: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  costClassification: ModelCostClassification;
  validationOutcome: "accepted" | "rejected" | "escalated";
  escalationReason?: string;
  attemptsCount: number;
}

/**
 * Budget & Cost Tracking Record
 */
export interface WorkflowBudgetUsage {
  workflowId: string;
  workflowCategory: "exploration" | "complete_build" | "verification";
  budgetCeilingUsd: number;
  spentUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  acceptedResultsCount: number;
}
