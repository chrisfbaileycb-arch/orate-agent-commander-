/**
 * ============================================================================
 * ORATOR.AI DESIGN EXPLORATION & COMPLETE BUILD DATA CONTRACTS
 * Version: 2.0.0
 * ============================================================================
 */

import type { GeneratedFile, IngestItem, ModelExpert, AuditResult, MindMap } from "./types";
import type {
  PreviewCapsule,
  DeploymentQuestionnaireAnswers,
  DeploymentProvider,
  RecommendationResult,
  DeploymentHandoffPackage,
} from "./capsule-types";

// Re-export capsule contracts for convenience
export type {
  PreviewCapsule,
  DeploymentQuestionnaireAnswers,
  DeploymentProvider,
  RecommendationResult,
  DeploymentHandoffPackage,
};

/**
 * Total included Design Explorations for every eligible user.
 * Stored in central server-side policy registry. Never scattered.
 */
export const INCLUDED_DESIGN_EXPLORATIONS = 3;

/**
 * State lifecycle for a Design Exploration reservation and consumption.
 */
export type ExplorationLifecycleState =
  | "AVAILABLE"
  | "RESERVED"
  | "REASONING"
  | "SANDBOXING"
  | "DELIVERED"
  | "CONSUMED"
  | "FAILED"
  | "RELEASED";

/**
 * Proposed UI screen in a concept brief.
 */
export interface ProposedScreen {
  id: string;
  name: string;
  purpose: string;
  keyControls: string[];
  layoutType: "dashboard" | "form" | "grid" | "list" | "split" | "timeline";
}

/**
 * Structured Concept Brief delivered by Orator Design Studio.
 */
export interface ConceptBrief {
  id: string;
  appName: string;
  headline: string;
  targetCustomer: string;
  problemSolved: string;
  primaryWorkflow: string;
  firstVersionScope: string[];
  deferredScope: string[];
  recommendedArchitecture: string;
  visualDirection: string;
  proposedScreens: ProposedScreen[];
  dataRelationshipsSummary: string;
  contradictionsResolved: string[];
  completeBuildDeliverablesSummary: string[];
  createdAt: number;
}

/**
 * Private, temporary Concept Sandbox generated from a Design Exploration.
 * Strictly private, non-publishable, for evaluating workflow and layout.
 */
export interface ConceptSandbox {
  id: string;
  explorationId: string;
  appName: string;
  status: "READY" | "GENERATING" | "FAILED" | "EXPIRED" | "DELETED";
  createdAt: number;
  expiresAt: number; // Configurable short-lived retention
  isPrivate: true;
  publishAllowed: false; // Non-negotiable constraint
  disclosedMockedBehaviors: string[];
  sampleDataDescription: string;
  sandboxHtmlSrcDoc: string;
}

/**
 * Record of a Design Exploration session.
 */
export interface DesignExploration {
  id: string;
  clientId: string;
  conceptBrief: ConceptBrief;
  sandbox: ConceptSandbox;
  answers: Record<string, string>;
  ingest: IngestItem[];
  lifecycleState: ExplorationLifecycleState;
  modelRoutingDecision: ModelRoutingDecision;
  revisionsCount: number;
  lastRevisedAt?: number;
  transferredToCompleteBuildId?: string;
  createdAt: number;
}

/**
 * Model Routing Task and Policy Contracts
 */
export type ModelRoutingTaskCategory =
  | "exploration"
  | "complete_build"
  | "verification"
  | "fallback";

export interface ModelRoutingPolicy {
  category: ModelRoutingTaskCategory;
  primaryProvider: string;
  primaryModelRef: string; // Kept server-side
  fallbackProvider: string;
  fallbackModelRef: string; // Kept server-side
  selectionRationale: string; // Evaluated by capability, reasoning depth, and context
  isZeroUsageCost: boolean;
}

export interface ModelRoutingDecision {
  id: string;
  taskCategory: ModelRoutingTaskCategory;
  requiredCapabilities: string[];
  selectedPolicyCategory: ModelRoutingTaskCategory;
  providerModelAlias: string; // Customer-facing abstraction, e.g. "Orator Reasoning Engine"
  isFallback: boolean;
  timestamp: number;
  outcome: "success" | "fallback_used" | "failed";
  costClassification: "economic_no_cost" | "standard_quorum";
  failureReason?: string;
}

/**
 * Build Brief passed seamlessly into a Complete Orator Build.
 * Preserves all reasoning from Design Exploration so the user never repeats known info.
 */
export interface BuildBrief {
  sourceExplorationId: string;
  appName: string;
  archetype: string;
  summary: string;
  targetCustomer: string;
  primaryOutcome: string;
  coreInvariants: string[];
  preservedAnswers: Record<string, string>;
  ingest: IngestItem[];
  unresolvedDecisions: string[];
}

/**
 * Complete Orator Build record
 */
export interface CompleteBuild {
  id: string;
  clientId: string;
  brief: BuildBrief;
  plan: {
    appName: string;
    archetype: string;
    summary: string;
    stack: string[];
    experts: ModelExpert[];
    mindMap: MindMap;
    audit: AuditResult;
    files: GeneratedFile[];
  };
  sharePreview?: PreviewCapsule;
  status: "BUILDING" | "VERIFYING" | "SEALED" | "DELIVERED" | "FAILED";
  deliveredAt?: number;
  entitlementId?: string;
}

/**
 * Build Entitlement and Reservation Contracts
 */
export interface BuildEntitlement {
  id: string;
  clientId: string;
  tierId: "single" | "builder" | "studio";
  buildSessionsPurchased: number;
  buildSessionsUsed: number;
  purchasedAt: number;
  confirmedAt?: number;
}

export interface EntitlementReservation {
  reservationId: string;
  clientId: string;
  buildId: string;
  reservedAt: number;
  expiresAt: number;
  status: "RESERVED" | "CONSUMED" | "RELEASED";
}

/**
 * Immutable Entitlement Audit Event
 */
export interface EntitlementEvent {
  id: string;
  clientId: string;
  eventType:
    | "EXPLORATION_RESERVED"
    | "EXPLORATION_CONSUMED"
    | "EXPLORATION_RELEASED"
    | "COMPLETE_BUILD_RESERVED"
    | "COMPLETE_BUILD_CONSUMED"
    | "COMPLETE_BUILD_RELEASED"
    | "ENTITLEMENT_GRANTED";
  relatedId: string; // explorationId or buildId
  details: string;
  timestamp: number;
}
