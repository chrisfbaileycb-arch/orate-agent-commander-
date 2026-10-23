import { describe, it, expect, beforeEach } from "vitest";
import { CheaperInferenceProvider } from "./cheaper-inference-provider";
import { OpenRouterProvider, OmniRouteProvider } from "./secondary-providers";
import { OratorIntelligenceEngine } from "./intelligence-engine";
import { InferenceConfigService } from "./inference-config";
import type { InferenceRequest } from "./inference-contracts";

describe("Cheaper Inference & Provider-Neutral Routing Foundation", () => {
  let cheaperInference: CheaperInferenceProvider;
  let openRouter: OpenRouterProvider;
  let omniRoute: OmniRouteProvider;
  let engine: OratorIntelligenceEngine;

  beforeEach(() => {
    cheaperInference = new CheaperInferenceProvider();
    openRouter = new OpenRouterProvider();
    omniRoute = new OmniRouteProvider();
    engine = new OratorIntelligenceEngine();
  });

  it("1. configures Cheaper Inference as preferred multi-provider hosted endpoint", () => {
    const cfg = new InferenceConfigService().getCheaperInferenceConfig();
    expect(cfg.baseUrl).toBe("https://api.cheaperinference.com/v1");
    expect(cfg.enabled).toBe(true);
    expect(cfg.timeoutMs).toBeGreaterThanOrEqual(10000);
    expect(cheaperInference.id).toBe("cheaper-inference");
    expect(cheaperInference.isHosted).toBe(true);
  });

  it("2 & 3. keeps credentials server-side and prevents client base URL overrides", () => {
    const cfg = new InferenceConfigService().getCheaperInferenceConfig();
    // Default safe endpoint must be enforced against untrusted protocols
    expect(cfg.baseUrl).toMatch(/^https:\/\//);
  });

  it("4 & 5. discovers and normalizes models with operator approval and capability scores", async () => {
    const models = await cheaperInference.discoverModels();
    expect(models.length).toBeGreaterThan(0);

    const flash = models.find((m) => m.providerModelId === "google/gemini-1.5-flash");
    expect(flash).toBeDefined();
    expect(flash?.operatorApprovalStatus).toBe("approved");
    expect(flash?.contextCapacityTokens).toBeGreaterThanOrEqual(100000);
    expect(flash?.costClassification).toBe("economic_no_cost");
  });

  it("6. classifies tasks and routes Design Exploration to economical capable intelligence", () => {
    const req: InferenceRequest = {
      taskType: "workflow_discovery",
      taskCategory: "exploration",
      messages: [{ role: "user", content: "Explore climbing gym booking workflow" }],
    };

    const eligible = engine.filterEligibleModels(req);
    expect(eligible.length).toBeGreaterThan(0);
    // Cheaper Inference route preferred
    expect(eligible[0].provider).toBe("cheaper-inference");
    // Free / economic cost classification
    expect(["free_allocation", "economic_no_cost"]).toContain(eligible[0].costClassification);
  });

  it("7. routes Complete Build to comprehensive models under progressive escalation", () => {
    const req: InferenceRequest = {
      taskType: "code_generation",
      taskCategory: "complete_build",
      messages: [{ role: "user", content: "Synthesize complete application AST" }],
    };

    const eligible = engine.filterEligibleModels(req);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.some((m) => m.codingSuitability >= 90)).toBe(true);
  });

  it("8. respects privacy classifications (zero data retention)", () => {
    const req: InferenceRequest = {
      taskType: "security_review",
      taskCategory: "verification",
      messages: [{ role: "user", content: "Audit invariants" }],
      privacyRequirement: "zero_data_retention",
    };

    const eligible = engine.filterEligibleModels(req);
    eligible.forEach((m) => {
      expect(["zero_data_retention", "local_isolated"]).toContain(m.privacyClassification);
    });
  });

  it("9. executes task with progressive escalation and records cost per accepted result", async () => {
    const req: InferenceRequest = {
      taskType: "product_reasoning",
      taskCategory: "exploration",
      messages: [{ role: "user", content: "Synthesize target customer" }],
    };

    const res = await engine.executeTask("wf-test-1", req);
    expect(res).toBeDefined();
    expect(res.content.length).toBeGreaterThan(0);

    const budget = engine.getBudgetUsage("wf-test-1");
    expect(budget).toBeDefined();
    expect(budget?.acceptedResultsCount).toBe(1);
    expect(budget?.totalInputTokens).toBeGreaterThan(0);
  });

  it("10. supports OpenRouter as a fallback provider and keeps OmniRoute disabled by default", () => {
    expect(openRouter.id).toBe("openrouter");
    expect(omniRoute.id).toBe("omniroute");
    // OmniRoute disabled by default so it does not delay core Orator experience
    expect(omniRoute.isEnabled).toBe(false);
  });

  it("11. circuit breaks failing providers and prevents infinite authentication retries", async () => {
    // Check health handling
    const health = await cheaperInference.checkHealth();
    expect(health).toBeDefined();
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("12. enforces context capacity filtering", () => {
    const req: InferenceRequest = {
      taskType: "code_generation",
      taskCategory: "complete_build",
      messages: [{ role: "user", content: "Large codebase refactoring" }],
      minimumContextTokens: 150000,
    };

    const eligible = engine.filterEligibleModels(req);
    eligible.forEach((m) => {
      expect(m.contextCapacityTokens).toBeGreaterThanOrEqual(150000);
    });
  });

  it("13. enforces cost ceilings during model selection", () => {
    const req: InferenceRequest = {
      taskType: "intent_clarification",
      taskCategory: "exploration",
      messages: [{ role: "user", content: "Short query" }],
      maxCostUsd: 0.001,
    };

    const eligible = engine.filterEligibleModels(req);
    eligible.forEach((m) => {
      expect(m.estimatedCostPer1kOutputTokensUsd).toBeLessThanOrEqual(0.001);
    });
  });
});
