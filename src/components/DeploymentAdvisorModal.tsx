import { useState } from "react";
import type {
  DeploymentQuestionnaireAnswers,
  RecommendationResult,
  DeploymentHandoffPackage,
} from "../lib/capsule-types";
import type { ForgePlan } from "../lib/types";
import { globalDeploymentAdvisor } from "../lib/deployment-advisor";

interface Props {
  plan: ForgePlan;
  onClose: () => void;
}

export default function DeploymentAdvisorModal({ plan, onClose }: Props) {
  const [step, setStep] = useState<"questions" | "recommendations" | "handoff">("questions");

  // Pre-fill answers from ForgePlan where known to avoid redundant questions
  const [answers, setAnswers] = useState<DeploymentQuestionnaireAnswers>({
    projectType: plan.archetype === "saas" ? "saas_product" : "web_application",
    requiresPersistentData: true,
    requiresUserAccounts: plan.summary.toLowerCase().includes("auth") || plan.summary.toLowerCase().includes("user"),
    acceptsPayments: false,
    requiresFileStorage: false,
    requiresBackgroundJobs: false,
    requiresRealtime: false,
    expectedTraffic: "low",
    technicalDifficultyPreference: "beginner",
    monthlyBudgetComfortUsd: "zero_to_10",
    controlPreference: "maximum_simplicity",
    requiresCustomDomain: true,
    requiresBusinessEmail: false,
    regulatoryOrResidencyRequirements: false,
    requiresAutoScaling: true,
  });

  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [handoffPackage, setHandoffPackage] = useState<DeploymentHandoffPackage | null>(null);

  const handleComputeRecommendations = () => {
    const recs = globalDeploymentAdvisor.advise(answers);
    setRecommendations(recs);
    setStep("recommendations");
  };

  const handleSelectHandoff = (providerId: string) => {
    setSelectedProviderId(providerId);
    const pkg = globalDeploymentAdvisor.prepareHandoff(providerId, plan);
    setHandoffPackage(pkg);
    setStep("handoff");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-seam bg-depth shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-seam px-6 py-4">
          <div>
            <div className="font-mono-hud text-[10px] tracking-[0.2em] text-forge-cyan">
              DEPLOYMENT ADVISOR // PERMANENT HOSTING RECOMMENDATIONS
            </div>
            <h3 className="font-display text-base font-semibold text-pearl">
              Find an Independent Home for {plan.appName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-forge-dim hover:text-pearl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Clear boundary notice */}
        <div className="border-b border-seam/80 bg-abyss/40 px-6 py-2 text-[11px] text-forge-dim">
          <span className="font-bold text-pearl">Hosting Boundary:</span> Orator is an autonomous software forge, not a permanent hosting company. You own your application and maintain direct billing and control with the deployment provider of your choice.
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: QUESTIONNAIRE */}
          {step === "questions" && (
            <div className="space-y-6">
              <p className="text-xs text-forge-dim">
                We've pre-filled known attributes from your inquest. Answer a few operational questions to identify the best permanent hosting fit for your budget and technical preferences:
              </p>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Project Type */}
                <div>
                  <label className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                    PROJECT ARCHITECTURE
                  </label>
                  <select
                    value={answers.projectType}
                    onChange={(e) =>
                      setAnswers({ ...answers, projectType: e.target.value as any })
                    }
                    className="mt-1.5 w-full rounded border border-seam bg-abyss p-2 text-xs text-pearl"
                  >
                    <option value="web_application">Full-Stack Web Application</option>
                    <option value="saas_product">SaaS Product with Database</option>
                    <option value="static_website">Static Website / Documentation</option>
                    <option value="api_backend_service">API or Backend Service</option>
                    <option value="internal_business_tool">Internal Business Tool</option>
                  </select>
                </div>

                {/* Technical Preference */}
                <div>
                  <label className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                    MAINTENANCE PREFERENCE
                  </label>
                  <select
                    value={answers.technicalDifficultyPreference}
                    onChange={(e) =>
                      setAnswers({ ...answers, technicalDifficultyPreference: e.target.value as any })
                    }
                    className="mt-1.5 w-full rounded border border-seam bg-abyss p-2 text-xs text-pearl"
                  >
                    <option value="beginner">Beginner (Zero server ops, auto git deploy)</option>
                    <option value="intermediate">Intermediate (Docker containers / microVMs)</option>
                    <option value="advanced">Advanced (Linux VPS / full root control)</option>
                  </select>
                </div>

                {/* Monthly Budget */}
                <div>
                  <label className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                    COMFORTABLE MONTHLY BUDGET
                  </label>
                  <select
                    value={answers.monthlyBudgetComfortUsd}
                    onChange={(e) =>
                      setAnswers({ ...answers, monthlyBudgetComfortUsd: e.target.value as any })
                    }
                    className="mt-1.5 w-full rounded border border-seam bg-abyss p-2 text-xs text-pearl"
                  >
                    <option value="zero_to_10">$0 – $10 / month (Free tiers & low-cost)</option>
                    <option value="10_to_30">$10 – $30 / month (Standard growth tier)</option>
                    <option value="30_to_100">$30 – $100 / month (Dedicated production DB)</option>
                  </select>
                </div>

                {/* Control Preference */}
                <div>
                  <label className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                    INFRASTRUCTURE CONTROL
                  </label>
                  <select
                    value={answers.controlPreference}
                    onChange={(e) =>
                      setAnswers({ ...answers, controlPreference: e.target.value as any })
                    }
                    className="mt-1.5 w-full rounded border border-seam bg-abyss p-2 text-xs text-pearl"
                  >
                    <option value="maximum_simplicity">Maximum Simplicity (Managed PaaS)</option>
                    <option value="balanced">Balanced (Docker Container)</option>
                    <option value="full_infrastructure_control">Full Server Control (VPS)</option>
                  </select>
                </div>
              </div>

              {/* Requirement Checkboxes */}
              <div className="space-y-2.5 rounded-lg border border-seam bg-abyss/50 p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-gold">
                  OPERATIONAL REQUIREMENTS
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={answers.requiresPersistentData}
                      onChange={(e) => setAnswers({ ...answers, requiresPersistentData: e.target.checked })}
                      className="accent-[#35e0ff]"
                    />
                    <span>Requires Managed SQL Database</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={answers.requiresCustomDomain}
                      onChange={(e) => setAnswers({ ...answers, requiresCustomDomain: e.target.checked })}
                      className="accent-[#35e0ff]"
                    />
                    <span>Custom Domain Connection</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={answers.requiresAutoScaling}
                      onChange={(e) => setAnswers({ ...answers, requiresAutoScaling: e.target.checked })}
                      className="accent-[#35e0ff]"
                    />
                    <span>Automatic Horizontal Scaling</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={answers.requiresBackgroundJobs}
                      onChange={(e) => setAnswers({ ...answers, requiresBackgroundJobs: e.target.checked })}
                      className="accent-[#35e0ff]"
                    />
                    <span>Background Workers / Scheduled Cron</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleComputeRecommendations}
                  className="btn-forge btn-primary px-6 py-3 text-xs"
                >
                  CALCULATE TECHNICAL RECOMMENDATIONS →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: EVIDENCE-BASED RECOMMENDATIONS */}
          {step === "recommendations" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono-hud text-[10px] text-forge-cyan">
                    RECOMMENDATION RESULTS (UP TO 3 MATCHES)
                  </div>
                  <p className="text-xs text-forge-dim">
                    Ranked strictly by technical suitability for your workload. Affiliate relationships never influence technical scores.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("questions")}
                  className="font-mono-hud text-[10px] text-forge-dim hover:text-pearl underline"
                >
                  ← EDIT QUESTIONS
                </button>
              </div>

              <div className="grid gap-4">
                {recommendations.map((rec) => (
                  <div
                    key={rec.provider.id}
                    className="rounded-xl border border-seam bg-abyss/70 p-4 transition-colors hover:border-forge-cyan/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-seam pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-forge-gold/15 px-2 py-0.5 font-mono-hud text-[9px] font-bold text-forge-gold">
                            {rec.role.replace(/_/g, " ")}
                          </span>
                          <h4 className="font-display text-base font-semibold text-pearl">
                            {rec.provider.name}
                          </h4>
                          <span className="font-mono-hud text-[10px] text-forge-cyan">
                            Score: {rec.matchScore}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-forge-dim">{rec.whyMatch}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectHandoff(rec.provider.id)}
                          className="btn-forge btn-gold px-4 py-2 text-[10.5px]"
                        >
                          PREPARE HANDOFF →
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4 text-[11px]">
                      <div>
                        <span className="font-mono-hud text-[9px] text-forge-cyan">SATISFIED REQUIREMENTS:</span>
                        <ul className="mt-1 list-inside list-disc text-forge-dim space-y-0.5">
                          {rec.satisfiedRequirements.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-mono-hud text-[9px] text-forge-gold">YOUR RESPONSIBILITY:</span>
                        <ul className="mt-1 list-inside list-disc text-forge-dim space-y-0.5">
                          {rec.remainingCustomerResponsibilities.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Affiliate disclosure if applicable */}
                    {rec.isAffiliate && rec.affiliateDisclosure && (
                      <div className="mt-3 rounded border border-seam/60 bg-depth/40 p-2 font-mono-hud text-[9px] leading-relaxed text-forge-dim">
                        AFFILIATE DISCLOSURE: {rec.affiliateDisclosure}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: PROVIDER-SPECIFIC HANDOFF */}
          {step === "handoff" && handoffPackage && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-seam pb-3">
                <div>
                  <div className="font-mono-hud text-[10px] text-forge-cyan">
                    DEPLOYMENT HANDOFF PACKAGE // {handoffPackage.providerName.toUpperCase()}
                  </div>
                  <h4 className="font-display text-base font-semibold text-pearl">
                    Zero Secret Exposure · Production Manifest Ready
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("recommendations")}
                  className="font-mono-hud text-[10px] text-forge-dim hover:text-pearl underline"
                >
                  ← BACK TO RECOMMENDATIONS
                </button>
              </div>

              {/* Deployment Checklist */}
              <div className="rounded-lg border border-seam bg-abyss p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-gold mb-2">
                  HOSTING SETUP CHECKLIST
                </div>
                <ul className="space-y-1.5 text-xs text-forge-dim">
                  {handoffPackage.providerChecklist.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-forge-cyan">✔</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Manifest variables (Names only, zero secrets) */}
              <div className="rounded-lg border border-seam bg-abyss p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-cyan mb-1.5">
                  ENVIRONMENT VARIABLE MANIFEST (NAMES ONLY — NO STORED SECRETS)
                </div>
                <div className="space-y-1.5">
                  {handoffPackage.environmentVariablesManifest.map((v) => (
                    <div key={v.name} className="flex items-center justify-between text-xs border-b border-seam/40 py-1">
                      <span className="font-mono text-pearl">{v.name}</span>
                      <span className="text-forge-dim text-[11px]">{v.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-forge-dim">
                  Ready to deploy? Download your project ZIP and upload directly to {handoffPackage.providerName}.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-forge btn-primary px-5 py-2.5 text-xs"
                >
                  RETURN TO DELIVERABLES
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
