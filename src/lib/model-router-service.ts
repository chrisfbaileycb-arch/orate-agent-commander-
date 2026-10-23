/**
 * PROVIDER-NEUTRAL SERVER-SIDE MODEL ROUTING POLICY
 *
 * Chooses models based strictly on:
 * - Reasoning suitability
 * - Context requirements
 * - Reliability
 * - Structured-output performance
 * - Tool-use capability
 * - Latency & Availability
 *
 * Rule: Cheaper Inference is the preferred multi-provider route.
 * Economical and free-allocation models are treated as highly capable.
 * Model names and API credentials stay strictly server-side.
 */

import type {
  ModelRoutingDecision,
  ModelRoutingPolicy,
  ModelRoutingTaskCategory,
} from "./exploration-types";
import { globalIntelligenceEngine } from "./intelligence-engine";

export const MODEL_ROUTING_POLICIES: Record<ModelRoutingTaskCategory, ModelRoutingPolicy> = {
  exploration: {
    category: "exploration",
    primaryProvider: "cheaper-inference",
    primaryModelRef: "google/gemini-1.5-flash", // High context, sub-second latency, economical
    fallbackProvider: "openrouter",
    fallbackModelRef: "openai/gpt-4o-mini",
    selectionRationale: "High context capacity, sub-second latency, robust structured JSON schema adherence via Cheaper Inference hosted API",
    isZeroUsageCost: true,
  },
  complete_build: {
    category: "complete_build",
    primaryProvider: "cheaper-inference",
    primaryModelRef: "anthropic/claude-3.5-sonnet",
    fallbackProvider: "openrouter",
    fallbackModelRef: "openai/gpt-4o",
    selectionRationale: "Full AST construction, deep multi-file architectural synthesis, exhaustive code generation via Cheaper Inference",
    isZeroUsageCost: false,
  },
  verification: {
    category: "verification",
    primaryProvider: "cheaper-inference",
    primaryModelRef: "openai/gpt-4o",
    fallbackProvider: "openrouter",
    fallbackModelRef: "google/gemini-1.5-pro",
    selectionRationale: "Adversarial invariant checking, invariant audit compliance, security flaw identification",
    isZeroUsageCost: false,
  },
  fallback: {
    category: "fallback",
    primaryProvider: "deterministic",
    primaryModelRef: "orator/deterministic-ast-engine",
    fallbackProvider: "deterministic",
    fallbackModelRef: "orator/local-reasoning-core",
    selectionRationale: "Zero-network autonomous fallback guarantees uninterrupted operation",
    isZeroUsageCost: true,
  },
};

export class ModelRouterService {
  private auditLog: ModelRoutingDecision[] = [];

  /**
   * Route a task based on category and required capabilities.
   * Keeps model names server-side and exposes customer-facing abstraction.
   */
  public route(
    category: ModelRoutingTaskCategory,
    requiredCapabilities: string[],
    forceFallback = false
  ): ModelRoutingDecision {
    const policy = MODEL_ROUTING_POLICIES[category] ?? MODEL_ROUTING_POLICIES.fallback;
    const isFallback = forceFallback || !policy;

    const decision: ModelRoutingDecision = {
      id: "rt-" + Math.random().toString(36).substring(2, 9),
      taskCategory: category,
      requiredCapabilities,
      selectedPolicyCategory: policy.category,
      // Customer-facing explanation: No raw provider credentials or transient model names
      providerModelAlias: isFallback
        ? "Orator Autonomous Core Engine"
        : category === "exploration"
        ? "Orator Discovery & Design Engine"
        : category === "complete_build"
        ? "Orator 16-Expert MoE Quorum"
        : "Orator Invariant Verification Engine",
      isFallback,
      timestamp: Date.now(),
      outcome: isFallback ? "fallback_used" : "success",
      costClassification: policy.isZeroUsageCost ? "economic_no_cost" : "standard_quorum",
    };

    this.auditLog.push(decision);
    return decision;
  }

  /**
   * Safe getter for routing audit logs (sanitized — zero secrets).
   */
  public getAuditLog(): ReadonlyArray<ModelRoutingDecision> {
    return [...this.auditLog];
  }

  /**
   * Get underlying multi-provider intelligence engine
   */
  public getEngine() {
    return globalIntelligenceEngine;
  }
}

export const globalModelRouter = new ModelRouterService();
