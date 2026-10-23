/**
 * CORTEX Topology Matrix - Multi-Agent Simulation Engine
 * Drives realistic multi-agent deliberation, token streaming, confidence loops,
 * tool executions, and consensus transitions across 4 distinct scenarios.
 */

import type {
  CortexAgent,
  CortexPhase,
  CortexReasoningStep,
  CortexScenario,
  CortexScenarioId,
  CortexToolCall,
} from "./types";
import { cortexBus } from "./bus";

export const SCENARIOS: Record<CortexScenarioId, CortexScenario> = {
  codebase_synthesis: {
    id: "codebase_synthesis",
    name: "Autonomous Codebase Synthesis",
    description: "Hierarchical agent team decomposing system architecture into verified AST components.",
    primaryProvider: "Google Gemini Project (Primary Engine)",
    stepsCount: 8,
    agents: [
      {
        id: "orch-01",
        name: "CORTEX Orchestrator",
        role: "Global Coordinator & Flow Arbiter",
        color: "#35e0ff",
        accent: "#00f0ff",
        model: "gemini-3.8-flash",
        status: "deliberating",
        confidence: 0.96,
        tokensProcessed: 1420,
      },
      {
        id: "arch-02",
        name: "System Architect",
        role: "Dependency Graph & API Contracts",
        color: "#a855f7",
        accent: "#c084fc",
        model: "gemini-3.8-flash",
        status: "streaming",
        confidence: 0.94,
        tokensProcessed: 2840,
      },
      {
        id: "synth-03",
        name: "Logic Synthesizer",
        role: "Production Code Generation",
        color: "#10b981",
        accent: "#34d399",
        model: "gemini-3.8-flash",
        status: "streaming",
        confidence: 0.92,
        tokensProcessed: 4910,
        activeTool: "ast_tree_builder",
      },
      {
        id: "crit-04",
        name: "Adversarial Critic",
        role: "Edge Case & Invariant Checker",
        color: "#f59e0b",
        accent: "#fbbf24",
        model: "gemini-3.8-flash",
        status: "deliberating",
        confidence: 0.88,
        tokensProcessed: 1890,
      },
      {
        id: "verif-05",
        name: "Verification Gate",
        role: "22-Point Static Audit & Sandbox Exec",
        color: "#06b6d4",
        accent: "#22d3ee",
        model: "orator/deterministic-audit-v1",
        status: "idle",
        confidence: 0.98,
        tokensProcessed: 980,
      },
    ],
  },

  multi_provider_fallback: {
    id: "multi_provider_fallback",
    name: "Multi-Provider Dynamic Fallback",
    description: "Provider-neutral routing evaluating latency, rate limits, and zero-data-retention constraints.",
    primaryProvider: "Google Gemini Project -> Dynamic Fallbacks",
    stepsCount: 7,
    agents: [
      {
        id: "router-01",
        name: "Policy Dispatcher",
        role: "SLA, Cost, & Data-Residency Enforcer",
        color: "#38bdf8",
        accent: "#7dd3fc",
        model: "gemini-3.8-flash",
        status: "deliberating",
        confidence: 0.98,
        tokensProcessed: 890,
      },
      {
        id: "prov-01",
        name: "Gemini Engine Gateway",
        role: "Default Connected Intelligence Provider",
        color: "#10b981",
        accent: "#4ade80",
        model: "gemini-3.8-flash",
        status: "streaming",
        confidence: 0.96,
        tokensProcessed: 3200,
      },
      {
        id: "prov-02",
        name: "Cheaper Inference (Future)",
        role: "Secondary Multi-Provider Route",
        color: "#ec4899",
        accent: "#f472b6",
        model: "api.cheaperinference.com/v1",
        status: "idle",
        confidence: 0.89,
        tokensProcessed: 1540,
      },
      {
        id: "prov-03",
        name: "Local Edge Runtime (Future)",
        role: "Offline & Zero-Exposure Fallback",
        color: "#f59e0b",
        accent: "#fcd34d",
        model: "llama-3.3-70b-instruct-gguf",
        status: "idle",
        confidence: 0.84,
        tokensProcessed: 420,
      },
    ],
  },

  inquest_resolution: {
    id: "inquest_resolution",
    name: "Deep Inquest & Ambiguity Resolution",
    description: "Iterative ambiguity disambiguation transforming sparse user intent into high-fidelity specification.",
    primaryProvider: "Google Gemini Project (gemini-3.8-flash)",
    stepsCount: 7,
    agents: [
      {
        id: "inq-01",
        name: "Inquest Interrogator",
        role: "15-Question Socratic Probe",
        color: "#a855f7",
        accent: "#d8b4fe",
        model: "gemini-3.8-flash",
        status: "streaming",
        confidence: 0.94,
        tokensProcessed: 2100,
      },
      {
        id: "clar-02",
        name: "Domain Clarifier",
        role: "Ontology & Persona Alignment",
        color: "#06b6d4",
        accent: "#67e8f9",
        model: "gemini-3.8-flash",
        status: "deliberating",
        confidence: 0.89,
        tokensProcessed: 1650,
      },
      {
        id: "sec-03",
        name: "Privacy & Secret Redactor",
        role: "Pattern Stripper & Vault Scrubber",
        color: "#f43f5e",
        accent: "#fb7185",
        model: "orator/security-filter",
        status: "verifying",
        confidence: 0.99,
        tokensProcessed: 940,
      },
    ],
  },

  verification_audit: {
    id: "verification_audit",
    name: "Continuous Verification & Audit Gate",
    description: "22-point static analysis, AST vulnerability sweeps, and cryptographic build sealing.",
    primaryProvider: "Local Deterministic & Cheaper Inference",
    stepsCount: 8,
    agents: [
      {
        id: "ast-01",
        name: "AST Structural Inspector",
        role: "Syntax Tree Consistency & Type Safety",
        color: "#3b82f6",
        accent: "#60a5fa",
        model: "orator/ast-analyzer",
        status: "deliberating",
        confidence: 0.95,
        tokensProcessed: 3100,
      },
      {
        id: "sec-02",
        name: "OWASP Threat Modeler",
        role: "XSS, SQLi, SSRF, & Token Leakage",
        color: "#ef4444",
        accent: "#f87171",
        model: "claude-3-5-sonnet",
        status: "verifying",
        confidence: 0.91,
        tokensProcessed: 2750,
      },
      {
        id: "bench-03",
        name: "Throughput & Memory Profiler",
        role: "Runtime Allocation & Complexity Bounds",
        color: "#10b981",
        accent: "#34d399",
        model: "orator/perf-bench",
        status: "streaming",
        confidence: 0.89,
        tokensProcessed: 1980,
      },
      {
        id: "seal-04",
        name: "Cryptographic Attestation",
        role: "SHA-256 Checksum & Delivery Signature",
        color: "#eab308",
        accent: "#fde047",
        model: "orator/vault-sealer",
        status: "idle",
        confidence: 1.0,
        tokensProcessed: 620,
      },
    ],
  },
};

export class CortexSimulator {
  private currentScenarioId: CortexScenarioId = "codebase_synthesis";
  private isRunning: boolean = true;
  private speedFactor: number = 1.0;
  private currentStepIndex: number = 0;
  private currentPhase: CortexPhase = "parse";
  private loopCount: number = 0;
  private timer: number | null = null;
  private tokenTimer: number | null = null;
  private totalTokens: number = 3840;
  private totalCostUsd: number = 0.00768;

  constructor() {
    this.start();
  }

  public getScenario(): CortexScenario {
    return SCENARIOS[this.currentScenarioId];
  }

  public setScenario(id: CortexScenarioId) {
    this.currentScenarioId = id;
    this.reset();
  }

  public setSpeed(factor: number) {
    this.speedFactor = factor;
  }

  public getSpeed(): number {
    return this.speedFactor;
  }

  public isPlaying(): boolean {
    return this.isRunning;
  }

  public play() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.scheduleNextStep(1200);
      this.startTokenBurst();
    }
  }

  public pause() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tokenTimer) {
      clearInterval(this.tokenTimer);
      this.tokenTimer = null;
    }
  }

  public reset() {
    this.pause();
    this.currentStepIndex = 0;
    this.currentPhase = "parse";
    this.loopCount = 0;
    this.totalTokens = 1200;
    this.totalCostUsd = 0.0024;
    cortexBus.emitReset();
    cortexBus.emitPhaseChange("parse");
    this.play();
  }

  public start() {
    this.play();
  }

  public destroy() {
    this.pause();
  }

  /* ---------- User Interactive Triggers ---------- */

  public triggerLoopBack() {
    this.loopCount++;
    this.currentPhase = "retry";
    cortexBus.emitPhaseChange("retry");

    const scenario = this.getScenario();
    const agent = scenario.agents[Math.floor(Math.random() * scenario.agents.length)];

    const step: CortexReasoningStep = {
      id: `step-loop-${Date.now()}`,
      phase: "retry",
      agentId: agent.id,
      agentName: agent.name,
      title: "Confidence Discrepancy Gate",
      detail: `Evaluated score 0.61 < threshold 0.85. Branching rollback to plan invariant.`,
      confidence: 0.61,
      threshold: 0.85,
      timestamp: Date.now(),
      loopBack: true,
      loopTargetPhase: "plan",
      tokenCount: 412,
      worldCoord: [
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 3,
      ],
    };

    cortexBus.emitReasoningStep(step);
    cortexBus.emitMetricsUpdate({
      loopCount: this.loopCount,
      attentionSpike: 0.92,
      consensusScore: 0.54,
    });
  }

  public triggerToolCall(name?: string) {
    const scenario = this.getScenario();
    const agent = scenario.agents[1] || scenario.agents[0];
    const tools = ["ast_grep_pattern", "typecheck_verify", "sandbox_isolate_run", "security_header_sweep"];
    const chosenTool = name || tools[Math.floor(Math.random() * tools.length)];

    const call: CortexToolCall = {
      id: `tool-${Date.now()}`,
      agentId: agent.id,
      toolName: chosenTool,
      argsSummary: `{ target: "src/lib/router.ts", depth: 3, strict: true }`,
      status: "completed",
      latencyMs: Math.floor(45 + Math.random() * 85),
      timestamp: Date.now(),
      outputSummary: `Clean AST pass. 0 lint defects, 14 symbols matched.`,
    };

    cortexBus.emitToolCall(call);
    cortexBus.emitMetricsUpdate({
      attentionSpike: 0.78,
      latencyMs: call.latencyMs,
    });
  }

  public triggerConsensus() {
    this.currentPhase = "eval";
    cortexBus.emitPhaseChange("eval");

    const scenario = this.getScenario();
    cortexBus.emitConsensus({
      consensusScore: 0.97,
      agentsAgreed: scenario.agents.length,
      totalAgents: scenario.agents.length,
      finalPhase: "eval",
      verdict: "All 5 multi-agent invariants validated. System invariant sealed.",
    });

    cortexBus.emitMetricsUpdate({
      consensusScore: 0.98,
      evalPassed: true,
      attentionSpike: 0.15,
      tokenEntropy: 0.22,
    });
  }

  public injectPrompt(promptText: string) {
    this.currentPhase = "parse";
    cortexBus.emitPhaseChange("parse");

    // Immediate optimistic local emission
    const initialStep: CortexReasoningStep = {
      id: `step-inject-${Date.now()}`,
      phase: "parse",
      agentId: "orch-01",
      agentName: "CORTEX Orchestrator (Gemini 3.8 Flash)",
      title: "Gemini Ingest: Decomposing Constraints",
      detail: `Received live prompt: "${promptText.slice(0, 48)}..." Forwarding to Gemini Project engine.`,
      confidence: 0.96,
      threshold: 0.85,
      timestamp: Date.now(),
      tokenCount: promptText.length * 2,
      worldCoord: [0, 1.2, 0],
    };
    cortexBus.emitReasoningStep(initialStep);

    // Call server-side Gemini endpoint
    if (typeof fetch !== "undefined") {
      fetch("/api/gemini/cortex-deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskPrompt: promptText,
          phase: "parse",
          agentName: "Gemini Orchestrator",
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.title) {
            const geminiStep: CortexReasoningStep = {
              id: `step-gemini-${Date.now()}`,
              phase: "plan",
              agentId: "orch-01",
              agentName: "Google Gemini Project (gemini-3.8-flash)",
              title: data.title,
              detail: data.detail,
              confidence: data.confidence || 0.95,
              threshold: 0.85,
              timestamp: Date.now(),
              tokenCount: data.tokenCount || 320,
              worldCoord: [1.8, 0.4, -0.6],
            };
            cortexBus.emitReasoningStep(geminiStep);
            cortexBus.emitMetricsUpdate({
              provider: "Google Gemini Project (gemini-3.8-flash)",
              modelName: "gemini-3.8-flash",
              consensusScore: 0.96,
            });
          }
        })
        .catch(() => {
          // Graceful fallback already emitted
        });
    }
  }

  /* ---------- Autonomous Simulation Engine ---------- */

  private scheduleNextStep(delayMs: number = 2400) {
    if (this.timer) clearTimeout(this.timer);
    if (!this.isRunning) return;

    const actualDelay = Math.max(400, delayMs / this.speedFactor);
    this.timer = window.setTimeout(() => {
      this.executeSimulationStep();
    }, actualDelay);
  }

  private startTokenBurst() {
    if (this.tokenTimer) clearInterval(this.tokenTimer);
    const interval = Math.max(120, 320 / this.speedFactor);

    this.tokenTimer = window.setInterval(() => {
      if (!this.isRunning) return;
      const tokensGenerated = Math.floor(12 + Math.random() * 24);
      this.totalTokens += tokensGenerated;
      this.totalCostUsd += tokensGenerated * 0.000002;

      const scenario = this.getScenario();
      const activeAgent = scenario.agents[Math.floor(Math.random() * scenario.agents.length)];

      cortexBus.emitToken({
        agentId: activeAgent.id,
        tokenText: ["async", "function", "verifyAST", "resolve", "manifold", "pipeline"][
          Math.floor(Math.random() * 6)
        ],
        tokenCount: tokensGenerated,
        entropy: 0.35 + Math.random() * 0.45,
        confidence: 0.82 + Math.random() * 0.16,
        timestamp: Date.now(),
      });

      // Periodic metrics jitter
      cortexBus.emitMetricsUpdate({
        tokPerSec: Math.floor((38 + Math.random() * 28) * this.speedFactor),
        totalTokens: this.totalTokens,
        contextLoadPct: Math.min(94, Math.floor(22 + (this.totalTokens / 12000) * 65)),
        latencyMs: Math.floor(28 + Math.random() * 45),
        attentionSpike: Math.random() * 0.4,
        tokenEntropy: 0.28 + Math.random() * 0.35,
        estimatedCostUsd: Number(this.totalCostUsd.toFixed(5)),
      });
    }, interval);
  }

  private executeSimulationStep() {
    if (!this.isRunning) return;

    const scenario = this.getScenario();
    const phases: CortexPhase[] = ["parse", "plan", "draft", "eval"];
    const stepInCycle = this.currentStepIndex % scenario.stepsCount;

    // Advance phase periodically
    if (stepInCycle === 0) this.currentPhase = "parse";
    else if (stepInCycle === 1 || stepInCycle === 2) this.currentPhase = "plan";
    else if (stepInCycle === 3 || stepInCycle === 4) this.currentPhase = "draft";
    else if (stepInCycle >= 5) this.currentPhase = "eval";

    cortexBus.emitPhaseChange(this.currentPhase);

    // Pick agent based on phase
    const agentIndex = stepInCycle % scenario.agents.length;
    const agent = scenario.agents[agentIndex];

    const stepTitles = [
      "Decompose Prompt Constraints & AST Blueprint",
      "Resolve Provider Route SLA & Cost Envelope",
      "Construct Dependency Graph & Interface Signatures",
      "Synthesize Type-Safe State Machine & Handlers",
      "Inject Security Invariants & Secret Redaction",
      "Evaluate Unit Correctness & Invariant Boundaries",
      "Run 22-Point Static Audit Verification Gate",
      "Consensus Convergence & Release Cryptographic Seal",
    ];

    const title = stepTitles[stepInCycle] || "Agentic Reasoning Iteration";
    const confidence = 0.82 + Math.random() * 0.16;

    // Calculate toroidal 3D coordinate for annotation callout
    const u = (stepInCycle / scenario.stepsCount) * Math.PI * 2;
    const v = (agentIndex / scenario.agents.length) * Math.PI * 2;
    const R = 2.4; // Major radius
    const r = 0.8; // Minor radius
    const x = (R + r * Math.cos(v)) * Math.cos(u);
    const y = (R + r * Math.cos(v)) * Math.sin(u);
    const z = r * Math.sin(v);

    const step: CortexReasoningStep = {
      id: `step-${Date.now()}-${this.currentStepIndex}`,
      phase: this.currentPhase,
      agentId: agent.id,
      agentName: agent.name,
      title,
      detail: `Validated layer ${stepInCycle + 1}/${scenario.stepsCount}. Conf: ${(confidence * 100).toFixed(0)}%. Tok: +${Math.floor(180 + Math.random() * 240)}.`,
      confidence,
      threshold: 0.85,
      timestamp: Date.now(),
      tokenCount: Math.floor(180 + Math.random() * 240),
      worldCoord: [x, z, -y], // Torus coordinates
    };

    cortexBus.emitReasoningStep(step);

    // Occasionally trigger a tool call during drafting or eval
    if (stepInCycle === 3 || stepInCycle === 5) {
      setTimeout(() => {
        this.triggerToolCall();
      }, 400);
    }

    // Step complete, check if we reached end of scenario cycle
    if (stepInCycle === scenario.stepsCount - 1) {
      setTimeout(() => {
        this.triggerConsensus();
      }, 800);
    }

    this.currentStepIndex++;
    this.scheduleNextStep(2800);
  }
}

export const cortexSimulator = new CortexSimulator();
