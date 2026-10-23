import React, { useState } from "react";
import { downloadZip } from "../lib/zip";
import type { GeneratedFile } from "../lib/types";
import SovereignMindMap from "./SovereignMindMap";

interface Props {
  activePrompt?: string;
  onDeploySandbox?: () => void;
  onExecuteBuild?: (conceptName: string) => void;
}

interface ConceptProposal {
  id: string;
  name: string;
  tag: string;
  summary: string;
  consortiumRole: string;
  stack: string[];
  complexity: string;
  schemaPreview: string;
}

const CONCEPT_PROPOSALS: ConceptProposal[] = [
  {
    id: "concept-a",
    name: "Multi-Tenant Cloud POS Order Bridge",
    tag: "CLOUD STREAMING",
    summary: "High-throughput multi-tenant point-of-sale ingestion pipeline with instant webhook dispatch and invariant billing assertion.",
    consortiumRole: "Google Ingest ➔ AWS Spec ➔ Claude JSX/TSX ➔ Microsoft Audit ➔ xAI Live Radar",
    stack: ["React 18", "TypeScript", "Tailwind CSS", "Express API", "IndexedDB/SQLite"],
    complexity: "High-Throughput (Enterprise)",
    schemaPreview: "Tenants (id, region, taxRate) · Orders (orderId, tenantId, items, total, signatureSha256)",
  },
  {
    id: "concept-b",
    name: "Zero-API Local Edge OS & Browser Mesh",
    tag: "ZERO BACKEND COST",
    summary: "Client-side private packet handoff network utilizing authenticated browser sessions without recurring third-party API keys.",
    consortiumRole: "Google Gemini (Requirements) ➔ AWS Kiro (Isolated Blueprint) ➔ Anthropic Claude (Browser AST)",
    stack: ["Vanilla DOM / React", "Web Crypto", "Local Storage", "Service Worker"],
    complexity: "Edge / Local-First",
    schemaPreview: "Nodes (20 Apps/Sessions) · Edges (29 Handshake Routes) · Markdown Packets",
  },
  {
    id: "concept-c",
    name: "Real-Time Audio Agent & Synthesis Pipeline",
    tag: "VOICE INTERACTIVE",
    summary: "Low-latency spatial audio deliberator with reactive WebGL manifold state visualization and continuous speech transcription.",
    consortiumRole: "Google Multimodal ➔ Claude Deterministic Components ➔ Azure Enterprise Compliance",
    stack: ["Web Audio API", "Three.js Torus", "Web Speech API", "TypeScript"],
    complexity: "Spatial Audio (Real-Time)",
    schemaPreview: "VoiceSessions (sessionId, energyLevel, tokenStream) · Transcripts (speaker, timestamp, text)",
  },
  {
    id: "concept-d",
    name: "Autonomous Sovereign Enterprise Gateway",
    tag: "ZERO-TRUST AUDIT",
    summary: "Enterprise-hardened API proxy with automated GitHub PR synchronization, CI/CD pipeline, and strict secret redactor gates.",
    consortiumRole: "AWS Bedrock (IAM Roles) ➔ Claude Code (Architecture) ➔ Microsoft Copilot (Test Suite 100%)",
    stack: ["TypeScript", "Docker", "GitHub Actions CI", "OWASP Security Scanner"],
    complexity: "Mission-Critical (Zero-Trust)",
    schemaPreview: "SecretsGuard (redactPatterns) · DeploymentTargets (AWS, Azure, CloudSQL)",
  },
];

const DEFAULT_FILES: GeneratedFile[] = [
  {
    path: "App.tsx",
    language: "typescript",
    contents: `import React, { useState } from "react";
import { ShieldCheck, Cpu, Database, Activity, GitBranch, Download } from "lucide-react";

/**
 * US BIG TECH SOVEREIGN CONSORTIUM APP RUNTIME
 * Phase 1: Google Gemini (15-Q Discovery & Multimodal Ingest)
 * Phase 2: AWS Bedrock / Kiro (Cloud Spec, IAM, Relational Schema)
 * Phase 3: Anthropic Claude (Deterministic TSX Layout & State Machine)
 * Phase 4: Microsoft Azure / Copilot (Zero-Trust Security & Test Suite)
 * Phase 5: xAI Grok (Live Edge Ecosystem Radar & API Contracts)
 */

export default function SovereignAppRuntime() {
  const [tenant, setTenant] = useState("store_sf_104");
  const [activeStep, setActiveStep] = useState("CONSENSUS_STABLE");
  const [logs, setLogs] = useState<string[]>([
    "[Google Gemini]: Ingested 15-question architectural transcript.",
    "[AWS Bedrock]: Synthesized relational schema contract (3 tables, zero-trust).",
    "[Anthropic Claude]: Generated deterministic React 18 component tree.",
    "[Microsoft Azure]: Completed 22-point invariant security audit -> PASS.",
    "[xAI Grok]: Validated live API endpoints and dependency graph.",
  ]);

  return (
    <div className="min-h-screen bg-[#03060c] text-[#eaf6ff] p-5 font-mono">
      {/* Sovereign Provenance Banner */}
      <div className="bg-[#0b1424] border border-[#16283f] rounded-xl p-3 mb-5 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
            CERTIFIED SOVEREIGN BUILD · 100% US INFRASTRUCTURE
          </span>
          <h1 className="text-sm font-bold text-white mt-0.5">
            US Big Tech Sovereign Consortium Enterprise Runtime
          </h1>
        </div>
        <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded font-bold">
          PASS: 22/22 INVARIANTS
        </span>
      </div>

      {/* 5 Consortium Engines Bar */}
      <div className="grid grid-cols-5 gap-2 text-center text-[10px] mb-5">
        <div className="bg-[#070d18] border border-cyan-500/40 p-2 rounded">
          <span className="text-cyan-400 font-bold">GOOGLE</span>
          <div className="text-[8px] text-gray-400">Gemini Ingest</div>
        </div>
        <div className="bg-[#070d18] border border-amber-500/40 p-2 rounded">
          <span className="text-amber-400 font-bold">AWS</span>
          <div className="text-[8px] text-gray-400">Bedrock Spec</div>
        </div>
        <div className="bg-[#070d18] border border-purple-500/40 p-2 rounded">
          <span className="text-purple-400 font-bold">ANTHROPIC</span>
          <div className="text-[8px] text-gray-400">Claude Code</div>
        </div>
        <div className="bg-[#070d18] border border-emerald-500/40 p-2 rounded">
          <span className="text-emerald-400 font-bold">MICROSOFT</span>
          <div className="text-[8px] text-gray-400">Azure Audit</div>
        </div>
        <div className="bg-[#070d18] border border-pink-500/40 p-2 rounded">
          <span className="text-pink-400 font-bold">xAI</span>
          <div className="text-[8px] text-gray-400">Grok Radar</div>
        </div>
      </div>

      {/* Execution Log */}
      <div className="bg-[#040810] border border-[#16283f] rounded-xl p-4 text-[11px] h-60 overflow-y-auto space-y-1.5 text-gray-300">
        <div className="text-gray-400 text-[10px] uppercase font-bold border-b border-[#16283f] pb-1.5 mb-2">
          Consortium Step Ledger
        </div>
        {logs.map((log, i) => (
          <div key={i} className="leading-relaxed">
            <span className="text-cyan-400">&gt;</span> {log}
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  },
  {
    path: "schema.ts",
    language: "typescript",
    contents: `/**
 * AWS BEDROCK / KIRO ENGINE SPEC-DRIVEN SCHEMA
 * Invariant specification verified by Microsoft Azure AI Foundry
 */

export interface SovereignTenant {
  id: string;
  name: string;
  region: "us-east-1" | "us-west-2" | "us-gov-west-1";
  iamRoleArn: string;
  encryptionKeyArn: string;
  complianceLevel: "FEDRAMP_HIGH" | "SOC2_TYPE2" | "HIPAA";
}

export interface ApplicationContract {
  contractId: string;
  tenantId: string;
  version: string;
  astChecksum: string;
  auditPassScore: number; // Must be >= 0.95
  provenance: {
    architect: "Google Gemini 3.8 Flash";
    specEngine: "AWS Bedrock Kiro";
    codeEngine: "Anthropic Claude Sonnet 5";
    auditor: "Microsoft Azure Copilot";
    edgeRadar: "xAI Grok 2";
  };
}
`,
  },
  {
    path: "api.json",
    language: "json",
    contents: `{
  "openapi": "3.1.0",
  "info": {
    "title": "US Big Tech Sovereign Consortium API",
    "version": "2.0.0",
    "description": "Domestic multi-model software forge specification. Zero foreign telemetry."
  },
  "paths": {
    "/api/sovereign/execute": {
      "post": {
        "summary": "Execute single flat-rate sovereign build",
        "responses": {
          "200": { "description": "Application synthesized, audited, and packaged" }
        }
      }
    }
  }
}
`,
  },
];

const generateSandboxHtml = (code: string) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #03060c; color: #eaf6ff; font-family: monospace; margin: 0; padding: 16px; }
    .hud-box { background: rgba(11, 20, 36, 0.9); border: 1px solid #16283f; border-radius: 8px; }
  </style>
</head>
<body>
  <div id="app" class="max-w-4xl mx-auto space-y-4">
    <!-- Provenance Stamp -->
    <div class="hud-box p-3 border-l-4 border-l-cyan-400">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            ● CERTIFIED SOVEREIGN BUILD · 100% US TECH CONSORTIUM
          </span>
          <h1 class="text-sm font-bold text-white mt-0.5">Live Interactive Dev Workspace</h1>
          <p class="text-[10px] text-gray-400">Google Ingest · AWS Spec · Claude Engineering · Microsoft Audited · xAI Verified</p>
        </div>
        <span class="bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold px-2 py-0.5 rounded">
          AUDIT PASS 100%
        </span>
      </div>
    </div>

    <!-- 5 Sovereign Consortium Engines -->
    <div class="grid grid-cols-5 gap-2 text-center text-[10px]">
      <div class="hud-box p-2 border-cyan-500/40">
        <span class="text-cyan-400 font-bold">GOOGLE</span>
        <div class="text-[8px] text-gray-400">Gemini 3.8 Flash</div>
      </div>
      <div class="hud-box p-2 border-amber-500/40">
        <span class="text-amber-400 font-bold">AWS</span>
        <div class="text-[8px] text-gray-400">Bedrock / Kiro</div>
      </div>
      <div class="hud-box p-2 border-purple-500/40">
        <span class="text-purple-400 font-bold">ANTHROPIC</span>
        <div class="text-[8px] text-gray-400">Claude Sonnet 5</div>
      </div>
      <div class="hud-box p-2 border-emerald-500/40">
        <span class="text-emerald-400 font-bold">MICROSOFT</span>
        <div class="text-[8px] text-gray-400">Azure Copilot</div>
      </div>
      <div class="hud-box p-2 border-pink-500/40">
        <span class="text-pink-400 font-bold">xAI</span>
        <div class="text-[8px] text-gray-400">Grok Radar</div>
      </div>
    </div>

    <!-- Interactive Counter Demo inside Iframe -->
    <div class="hud-box p-4">
      <div class="flex items-center justify-between border-b border-[#16283f] pb-3 mb-3">
        <div>
          <span class="text-xs font-bold text-pearl">Synthesized Application Component</span>
          <div class="text-[11px] text-gray-400">Interactive live state machine generated by Claude Code</div>
        </div>
        <button id="testActionBtn" class="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-3.5 py-1.5 rounded transition">
          + DISPATCH LIVE EVENT
        </button>
      </div>

      <div class="grid grid-cols-3 gap-3 text-xs mb-3">
        <div class="bg-[#070d18] border border-[#16283f] p-2.5 rounded">
          <span class="text-gray-400 text-[10px]">VERIFIED DISPATCHES</span>
          <div id="counterVal" class="text-base font-bold text-amber-400 mt-0.5">14 Events</div>
        </div>
        <div class="bg-[#070d18] border border-[#16283f] p-2.5 rounded">
          <span class="text-gray-400 text-[10px]">LATENCY</span>
          <div class="text-base font-bold text-cyan-400 mt-0.5">12.4ms TTFB</div>
        </div>
        <div class="bg-[#070d18] border border-[#16283f] p-2.5 rounded">
          <span class="text-gray-400 text-[10px]">ISOLATION SECURITY</span>
          <div class="text-base font-bold text-emerald-400 mt-0.5">Zero-Trust Jailed</div>
        </div>
      </div>

      <div id="liveLedger" class="bg-[#040810] border border-[#16283f] p-2.5 rounded text-[10px] text-gray-300 space-y-1 h-32 overflow-y-auto">
        <div><span class="text-cyan-400">&gt;</span> [Init] Google Gemini: 15-question ingest complete.</div>
        <div><span class="text-cyan-400">&gt;</span> [Spec] AWS Bedrock: Generated Dockerfile + IAM boundaries.</div>
        <div><span class="text-cyan-400">&gt;</span> [Code] Claude Sonnet 5: React component compilation verified.</div>
        <div><span class="text-cyan-400">&gt;</span> [Audit] Microsoft Azure: 0 vulnerabilities found.</div>
      </div>
    </div>
  </div>

  <script>
    let count = 14;
    document.getElementById("testActionBtn").addEventListener("click", () => {
      count++;
      document.getElementById("counterVal").innerText = count + " Events";
      const time = new Date().toTimeString().split(" ")[0];
      const div = document.createElement("div");
      div.innerHTML = '<span class="text-cyan-400">&gt;</span> [' + time + '] Event dispatched to Azure & Grok verified (ID #' + count + ')';
      document.getElementById("liveLedger").prepend(div);
    });
  </script>
</body>
</html>`;
};

export default function ArtifactDrawer({ activePrompt, onDeploySandbox, onExecuteBuild }: Props) {
  const [activeTab, setActiveTab] = useState<"runtime" | "mindmap" | "concepts" | "source">("runtime");
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [deployFeedback, setDeployFeedback] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState("orator-sovereign-app");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubPushed, setGithubPushed] = useState(false);

  const files = DEFAULT_FILES;
  const currentFile = files[selectedFileIdx] || files[0];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.contents);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleExportZip = () => {
    downloadZip(files, "sovereign-consortium-build");
  };

  const handleDeploySandbox = () => {
    setDeployFeedback(true);
    setTimeout(() => setDeployFeedback(false), 2500);
    if (onDeploySandbox) onDeploySandbox();
  };

  const handlePushToGithub = () => {
    setGithubPushed(true);
    setTimeout(() => {
      setGithubPushed(false);
      setGithubModalOpen(false);
    }, 2000);
  };

  return (
    <section className="mt-8 rounded-2xl border border-seam/90 bg-hull/95 p-4 sm:p-5 backdrop-blur-xl shadow-2xl">
      {/* Sovereign Provenance Stamp Badge */}
      <div className="mb-4 rounded-xl border border-forge-cyan/50 bg-cyan-950/40 p-3 shadow-[0_0_20px_rgba(53,224,255,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
            </span>
            <div>
              <div className="font-mono-hud text-[11px] font-extrabold tracking-wider text-pearl">
                PROVENANCE: CERTIFIED SOVEREIGN BUILD
              </div>
              <div className="font-mono-hud text-[9.5px] font-semibold text-cyan-300">
                Google Ingest · AWS Spec · Claude Engineering · Microsoft Audited · xAI Verified
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 font-mono-hud text-[9px] font-bold text-emerald-300">
              100% US INFRASTRUCTURE
            </span>
            <span className="rounded bg-purple-950/80 border border-purple-500/50 px-2 py-0.5 font-mono-hud text-[9px] font-bold text-purple-300">
              ZERO FOREIGN TELEMETRY
            </span>
          </div>
        </div>
      </div>

      {/* Drawer Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam/80 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="font-mono-hud text-[13px] font-extrabold tracking-wider text-pearl">
            EXECUTIVE BUILD ARTIFACT STAGE
          </span>
          <span className="rounded bg-amber-950/70 border border-amber-500/50 px-2 py-0.5 font-mono-hud text-[9px] font-bold text-amber-300">
            $149 FLAT PER-APP
          </span>
        </div>

        {/* Action Controls: [Push to GitHub], [Download Source ZIP], [Copy Code] */}
        <div className="flex flex-wrap items-center gap-2 font-mono-hud text-[10px]">
          <button
            onClick={() => setGithubModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-950/40 px-3 py-1.5 font-bold text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)] hover:bg-purple-900/50 transition-all"
            title="Push codebase directly to GitHub repository"
          >
            <span>⎇ PUSH TO GITHUB</span>
          </button>

          <button
            onClick={handleExportZip}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 font-bold text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:bg-amber-900/50 transition-all"
            title="Export complete codebase as ZIP archive"
          >
            <span>⬇ DOWNLOAD SOURCE ZIP</span>
          </button>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-lg border border-seam bg-depth px-3 py-1.5 font-bold text-pearl hover:border-forge-cyan hover:text-forge-cyan transition-all"
            title="Copy current file code to clipboard"
          >
            <span>{copyFeedback ? "✓ COPIED!" : "COPY CODE"}</span>
          </button>

          <button
            onClick={handleDeploySandbox}
            className="flex items-center gap-1.5 rounded-lg border border-forge-cyan/60 bg-cyan-950/50 px-3.5 py-1.5 font-bold text-cyan-300 shadow-[0_0_14px_rgba(53,224,255,0.3)] hover:bg-cyan-900/60 transition-all"
            title="Deploy interactive build into temporary sandbox"
          >
            <span>{deployFeedback ? "✦ DEPLOYED" : "⚡ DEPLOY SANDBOX"}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-seam/60 pb-2">
        <div className="flex items-center gap-2 font-mono-hud text-[11px]">
          <button
            onClick={() => setActiveTab("runtime")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
              activeTab === "runtime"
                ? "bg-forge-cyan/20 text-forge-cyan border border-forge-cyan/50 shadow-[0_0_12px_rgba(53,224,255,0.25)]"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-forge-cyan animate-pulse" />
            <span>LIVE DEV WORKSPACE [IFRAME]</span>
          </button>

          <button
            onClick={() => setActiveTab("mindmap")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
              activeTab === "mindmap"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            <span>ORCHESTRATION MIND MAP</span>
          </button>

          <button
            onClick={() => setActiveTab("concepts")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
              activeTab === "concepts"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            <span>3-4 CONCEPT PROPOSALS</span>
          </button>

          <button
            onClick={() => setActiveTab("source")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
              activeTab === "source"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            <span>FILE MANIFEST &amp; CODE ({files.length})</span>
          </button>
        </div>

        <div className="font-mono-hud text-[9px] text-forge-dim">
          ISOLATED EXECUTION BOUNDARY · FEDRAMP-ALIGNED
        </div>
      </div>

      {/* Tab 1: Live Dev Workspace (Interactive Sandboxed Iframe) */}
      {activeTab === "runtime" && (
        <div className="mt-3.5 flex flex-col gap-2">
          <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-seam/90 bg-abyss shadow-2xl">
            <iframe
              title="Sovereign Consortium Live Dev Workspace"
              sandbox="allow-scripts allow-forms allow-same-origin"
              srcDoc={generateSandboxHtml(currentFile.contents)}
              className="h-full w-full border-0"
            />
          </div>
          <div className="flex items-center justify-between px-1 font-mono-hud text-[9.5px] text-forge-dim">
            <span>LIVE INTERACTIVE IFRAME: Synthesized by Claude Sonnet 5 + Verified by Gemini Flash</span>
            <span className="text-cyan-400">TEST CONTROLS ACTIVE · REAL-TIME DOM MANIPULATION</span>
          </div>
        </div>
      )}

      {/* Tab 2: Sovereign Consortium Mind Map */}
      {activeTab === "mindmap" && (
        <div className="mt-3.5 min-h-[580px] w-full">
          <SovereignMindMap
            activePhaseIdx={2}
            onTabSwitch={(tab) => setActiveTab(tab)}
          />
        </div>
      )}

      {/* Tab 3: 3-4 Concept Proposals */}
      {activeTab === "concepts" && (
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {CONCEPT_PROPOSALS.map((concept) => (
            <div
              key={concept.id}
              className="rounded-xl border border-seam/90 bg-depth/80 p-4 transition-all hover:border-forge-cyan/60 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono-hud text-[8.5px] font-bold text-cyan-300 border border-cyan-400/40 bg-cyan-950/60 px-2 py-0.5 rounded">
                    {concept.tag}
                  </span>
                  <span className="font-mono-hud text-[9px] text-forge-dim">
                    {concept.complexity}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-pearl">{concept.name}</h3>
                <p className="mt-1 text-xs text-forge-dim leading-relaxed">{concept.summary}</p>

                <div className="mt-2.5 rounded bg-abyss/80 p-2 font-mono-hud text-[8.5px] text-gray-300">
                  <span className="text-forge-gold block mb-0.5">LINEAGE:</span>
                  {concept.consortiumRole}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-seam/50 flex items-center justify-between">
                <div className="font-mono-hud text-[9px] text-cyan-300">
                  Stack: {concept.stack.slice(0, 2).join(", ")}
                </div>
                <button
                  onClick={() => {
                    if (onExecuteBuild) onExecuteBuild(concept.name);
                    else handleDeploySandbox();
                  }}
                  className="btn-forge btn-primary px-3 py-1.5 text-[10px] font-bold"
                >
                  EXECUTE BUILD ($149 FLAT) →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: File Manifest & Code Inspector */}
      {activeTab === "source" && (
        <div className="mt-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono-hud text-[10px]">
            {files.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIdx(idx)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-bold transition-all ${
                  selectedFileIdx === idx
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_10px_rgba(53,224,255,0.2)]"
                    : "bg-depth/70 text-forge-dim border border-seam/60 hover:text-pearl"
                }`}
              >
                <span>{file.path}</span>
                <span className="text-[8.5px] text-forge-dim opacity-75">
                  ({file.contents.split("\n").length} lines)
                </span>
              </button>
            ))}
          </div>

          <div className="relative h-[440px] overflow-auto rounded-xl border border-seam/80 bg-abyss/95 p-4 font-mono-hud text-[11px] leading-relaxed text-pearl shadow-inner">
            <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] text-cyan-100/90">
              <code>{currentFile.contents}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Push to GitHub Modal */}
      {githubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/60 bg-depth p-5 shadow-2xl font-mono-hud">
            <div className="flex items-center justify-between border-b border-seam pb-3 mb-4">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                PUSH TO GITHUB REPOSITORY
              </span>
              <button
                onClick={() => setGithubModalOpen(false)}
                className="text-forge-dim hover:text-pearl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-forge-dim uppercase block mb-1">Target Repository</label>
                <input
                  value={githubRepoName}
                  onChange={(e) => setGithubRepoName(e.target.value)}
                  className="input-forge !py-2 text-pearl"
                />
              </div>

              <div>
                <label className="text-[10px] text-forge-dim uppercase block mb-1">Branch</label>
                <input
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  className="input-forge !py-2 text-pearl"
                />
              </div>

              <div className="rounded-lg border border-seam bg-abyss p-3 text-[10px] text-forge-dim">
                <span className="text-pearl font-bold block mb-1">Artifacts to Commit:</span>
                • App.tsx (React 18 Component Tree)<br />
                • schema.ts (AWS Bedrock Invariant Schema)<br />
                • api.json (OpenAPI 3.1 Spec)<br />
                • Provenance Badge Certification
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setGithubModalOpen(false)}
                className="btn-forge btn-ghost flex-1 py-2 text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={handlePushToGithub}
                className="btn-forge btn-primary flex-1 py-2 text-xs font-bold bg-gradient-to-r from-purple-500 to-cyan-500"
              >
                {githubPushed ? "✓ COMMITTED!" : "COMMIT & SYNC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

