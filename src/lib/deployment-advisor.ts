/**
 * DEPLOYMENT ADVISOR & PROVIDER RECOMMENDATION ENGINE
 *
 * Implements:
 * - Evidence-based technical suitability scoring (independent of affiliate status)
 * - Separation between technical score and commercial metadata
 * - Max 3 recommendations: Best Overall Fit, Simplest Acceptable, Lowest-Cost Acceptable
 * - Honest affiliate disclosures and stale-data verification checks
 * - Provider-specific handoff packaging (ZIP, commands, env manifests without secrets)
 */

import type {
  DeploymentProvider,
  DeploymentQuestionnaireAnswers,
  RecommendationResult,
  DeploymentHandoffPackage,
} from "./capsule-types";
import type { ForgePlan } from "./types";

export const DEPLOYMENT_PROVIDERS_REGISTRY: DeploymentProvider[] = [
  {
    id: "railway",
    name: "Railway",
    websiteUrl: "https://railway.app",
    supportedTypes: [
      "web_application",
      "saas_product",
      "api_backend_service",
      "internal_business_tool",
      "online_store",
    ],
    supportsStatic: true,
    supportsServerRuntime: true,
    supportedRuntimes: ["nodejs", "python", "go", "docker", "postgres"],
    managedDatabases: ["postgres", "redis", "mysql"],
    authenticationSupport: false,
    objectStorageSupport: false,
    backgroundJobsSupport: true,
    realtimeSupport: true,
    geographicRegions: ["us-west", "us-east", "europe-west"],
    technicalDifficulty: "beginner",
    estimatedMonthlyEntryCostUsd: 5,
    costCategory: "budget",
    scalingCharacteristics: "Vertical + horizontal pod scaling per service",
    exportabilityRating: "high",
    lockInNotes: "Standard Docker / Nixpacks execution; zero vendor lock-in.",
    customDomainSupported: true,
    hasAffiliateProgram: true,
    affiliateDisclosureText:
      "This is an affiliate link. Orator may receive compensation if you deploy through it, at no additional cost to you. Recommendations are based on the requirements you provided.",
    affiliateDestinationIdentifier: "railway-partner-ref",
    informationVerifiedAt: "2026-06-01",
    informationReviewBy: "2026-12-01",
  },
  {
    id: "fly_io",
    name: "Fly.io",
    websiteUrl: "https://fly.io",
    supportedTypes: [
      "web_application",
      "saas_product",
      "api_backend_service",
      "internal_business_tool",
    ],
    supportsStatic: true,
    supportsServerRuntime: true,
    supportedRuntimes: ["docker", "nodejs", "go", "python", "rust"],
    managedDatabases: ["postgres", "sqlite", "redis"],
    authenticationSupport: false,
    objectStorageSupport: true,
    backgroundJobsSupport: true,
    realtimeSupport: true,
    geographicRegions: ["global", "edge-anycast-35-regions"],
    technicalDifficulty: "intermediate",
    estimatedMonthlyEntryCostUsd: 5,
    costCategory: "budget",
    scalingCharacteristics: "Global microVMs close to users with scale-to-zero",
    exportabilityRating: "high",
    lockInNotes: "Dockerfile based; fully portable to any OCI container host.",
    customDomainSupported: true,
    hasAffiliateProgram: false, // NON-AFFILIATE: Must remain equally eligible
    informationVerifiedAt: "2026-06-01",
    informationReviewBy: "2026-12-01",
  },
  {
    id: "render",
    name: "Render",
    websiteUrl: "https://render.com",
    supportedTypes: [
      "static_website",
      "web_application",
      "saas_product",
      "api_backend_service",
    ],
    supportsStatic: true,
    supportsServerRuntime: true,
    supportedRuntimes: ["nodejs", "python", "go", "ruby", "docker"],
    managedDatabases: ["postgres", "redis"],
    authenticationSupport: false,
    objectStorageSupport: false,
    backgroundJobsSupport: true,
    realtimeSupport: true,
    geographicRegions: ["us-east", "us-west", "europe", "singapore"],
    technicalDifficulty: "beginner",
    estimatedMonthlyEntryCostUsd: 7,
    costCategory: "budget",
    scalingCharacteristics: "Autoscaling web services and background workers",
    exportabilityRating: "high",
    lockInNotes: "Standard container and static builds.",
    customDomainSupported: true,
    hasAffiliateProgram: true,
    affiliateDisclosureText:
      "This is an affiliate link. Orator may receive compensation if you deploy through it, at no additional cost to you. Recommendations are based on the requirements you provided.",
    affiliateDestinationIdentifier: "render-ref-code",
    informationVerifiedAt: "2026-05-15",
    informationReviewBy: "2026-11-15",
  },
  {
    id: "cloudflare_pages",
    name: "Cloudflare Pages & Workers",
    websiteUrl: "https://pages.cloudflare.com",
    supportedTypes: [
      "static_website",
      "web_application",
      "mobile_support_site",
      "api_backend_service",
    ],
    supportsStatic: true,
    supportsServerRuntime: true,
    supportedRuntimes: ["javascript", "wasm"],
    managedDatabases: ["sqlite"], // D1
    authenticationSupport: false,
    objectStorageSupport: true,   // R2
    backgroundJobsSupport: true,  // Queues / Cron
    realtimeSupport: true,        // Durable Objects
    geographicRegions: ["global-edge-300-cities"],
    technicalDifficulty: "intermediate",
    estimatedMonthlyEntryCostUsd: 0,
    costCategory: "free_tier_available",
    scalingCharacteristics: "Instant edge scaling without cold starts",
    exportabilityRating: "moderate",
    lockInNotes: "Uses standard web APIs with optional Cloudflare bindings.",
    customDomainSupported: true,
    hasAffiliateProgram: false,
    informationVerifiedAt: "2026-05-20",
    informationReviewBy: "2026-11-20",
  },
  {
    id: "hetzner_cloud",
    name: "Hetzner Cloud VPS",
    websiteUrl: "https://www.hetzner.com/cloud",
    supportedTypes: [
      "saas_product",
      "online_store",
      "internal_business_tool",
      "api_backend_service",
      "other",
    ],
    supportsStatic: true,
    supportsServerRuntime: true,
    supportedRuntimes: ["linux", "docker", "any"],
    managedDatabases: ["none"],
    authenticationSupport: false,
    objectStorageSupport: true,
    backgroundJobsSupport: true,
    realtimeSupport: true,
    geographicRegions: ["eu-central", "eu-north", "us-east", "us-west", "singapore"],
    technicalDifficulty: "advanced",
    estimatedMonthlyEntryCostUsd: 4,
    costCategory: "free_tier_available",
    scalingCharacteristics: "Dedicated CPU/RAM compute slices at unmetered bandwidth",
    exportabilityRating: "high",
    lockInNotes: "Pure Linux VPS — complete sovereignty and zero vendor lock-in.",
    customDomainSupported: true,
    hasAffiliateProgram: true,
    affiliateDisclosureText:
      "This is an affiliate link. Orator may receive compensation if you deploy through it, at no additional cost to you. Recommendations are based on the requirements you provided.",
    affiliateDestinationIdentifier: "hetzner-ref-code",
    informationVerifiedAt: "2026-06-10",
    informationReviewBy: "2026-12-10",
  },
];

export class DeploymentAdvisorService {
  /**
   * Evaluates requirements against the provider registry using purely technical scoring.
   * Affiliate status CANNOT modify technical suitability score.
   */
  public advise(answers: DeploymentQuestionnaireAnswers): RecommendationResult[] {
    const scored = DEPLOYMENT_PROVIDERS_REGISTRY.map((provider) => {
      let score = 50; // base score
      const satisfied: string[] = [];
      const responsibilities: string[] = [];
      const limitations: string[] = [];

      // 1. Match project type
      if (provider.supportedTypes.includes(answers.projectType)) {
        score += 20;
        satisfied.push(`Native support for ${answers.projectType.replace(/_/g, " ")}`);
      } else {
        score -= 20;
        limitations.push(`Not primarily optimized for ${answers.projectType.replace(/_/g, " ")}`);
      }

      // 2. Persistent data
      if (answers.requiresPersistentData) {
        if (provider.managedDatabases.includes("postgres") || provider.managedDatabases.includes("sqlite")) {
          score += 15;
          satisfied.push("Managed database support (PostgreSQL/SQLite)");
        } else if (provider.managedDatabases.includes("none")) {
          responsibilities.push("Self-managing and backing up database containers");
        }
      }

      // 3. Technical preference
      if (answers.technicalDifficultyPreference === provider.technicalDifficulty) {
        score += 10;
        satisfied.push(`Matches preferred ${provider.technicalDifficulty} maintenance complexity`);
      } else if (answers.technicalDifficultyPreference === "beginner" && provider.technicalDifficulty === "advanced") {
        score -= 25;
        limitations.push("Requires advanced Linux server administration and configuration");
      }

      // 4. Budget comfort
      if (answers.monthlyBudgetComfortUsd === "zero_to_10" && (provider.estimatedMonthlyEntryCostUsd <= 5 || provider.costCategory === "free_tier_available")) {
        score += 15;
        satisfied.push("Within zero-to-$10/mo budget threshold");
      }

      // 5. Control preference
      if (answers.controlPreference === "maximum_simplicity" && provider.technicalDifficulty === "beginner") {
        score += 10;
        satisfied.push("One-click Git push and automated zero-ops builds");
      } else if (answers.controlPreference === "full_infrastructure_control" && provider.technicalDifficulty === "advanced") {
        score += 15;
        satisfied.push("Full root terminal control and custom container orchestration");
      }

      // Verify if information is stale
      const reviewDate = new Date(provider.informationReviewBy).getTime();
      const isStaleData = Date.now() > reviewDate;

      // Always state customer responsibilities
      responsibilities.push("Managing production environment variables & API secrets");
      responsibilities.push("Direct billing and payment with the provider");
      responsibilities.push("Domain DNS record configuration");

      return {
        provider,
        matchScore: Math.max(0, Math.min(100, score)),
        satisfied,
        responsibilities,
        limitations,
        isStaleData,
      };
    });

    // Sort strictly by technical suitability score descending
    scored.sort((a, b) => b.matchScore - a.matchScore);

    const results: RecommendationResult[] = [];

    // 1. Best overall
    if (scored[0]) {
      const best = scored[0];
      results.push({
        role: "BEST_OVERALL",
        provider: best.provider,
        matchScore: best.matchScore,
        whyMatch: `Achieved the highest suitability score (${best.matchScore}%) for your ${answers.projectType.replace(/_/g, " ")}.`,
        satisfiedRequirements: best.satisfied,
        remainingCustomerResponsibilities: best.responsibilities,
        importantLimitations: best.limitations,
        isAffiliate: best.provider.hasAffiliateProgram,
        affiliateDisclosure: best.provider.affiliateDisclosureText,
        isStaleData: best.isStaleData,
      });
    }

    // 2. Simplest acceptable
    const simplestCandidate = scored.find((s) => s.provider.technicalDifficulty === "beginner" && s.provider.id !== results[0]?.provider.id);
    if (simplestCandidate) {
      results.push({
        role: "SIMPLEST",
        provider: simplestCandidate.provider,
        matchScore: simplestCandidate.matchScore,
        whyMatch: "Lowest maintenance overhead with automated build pipelines and zero server management.",
        satisfiedRequirements: simplestCandidate.satisfied,
        remainingCustomerResponsibilities: simplestCandidate.responsibilities,
        importantLimitations: simplestCandidate.limitations,
        isAffiliate: simplestCandidate.provider.hasAffiliateProgram,
        affiliateDisclosure: simplestCandidate.provider.affiliateDisclosureText,
        isStaleData: simplestCandidate.isStaleData,
      });
    }

    // 3. Lowest cost
    const lowestCostCandidate = scored.find(
      (s) =>
        (s.provider.costCategory === "free_tier_available" || s.provider.estimatedMonthlyEntryCostUsd <= 5) &&
        !results.some((r) => r.provider.id === s.provider.id)
    );
    if (lowestCostCandidate) {
      results.push({
        role: "LOWEST_COST",
        provider: lowestCostCandidate.provider,
        matchScore: lowestCostCandidate.matchScore,
        whyMatch: `Most economical baseline starting at $${lowestCostCandidate.provider.estimatedMonthlyEntryCostUsd}/mo or free tier.`,
        satisfiedRequirements: lowestCostCandidate.satisfied,
        remainingCustomerResponsibilities: lowestCostCandidate.responsibilities,
        importantLimitations: lowestCostCandidate.limitations,
        isAffiliate: lowestCostCandidate.provider.hasAffiliateProgram,
        affiliateDisclosure: lowestCostCandidate.provider.affiliateDisclosureText,
        isStaleData: lowestCostCandidate.isStaleData,
      });
    }

    return results;
  }

  /**
   * Prepares a sanitized deployment package with checklists, commands, and secret-free manifests.
   */
  public prepareHandoff(providerId: string, plan: ForgePlan): DeploymentHandoffPackage {
    const provider = DEPLOYMENT_PROVIDERS_REGISTRY.find((p) => p.id === providerId) ?? DEPLOYMENT_PROVIDERS_REGISTRY[0];

    return {
      providerId: provider.id,
      providerName: provider.name,
      appName: plan.appName,
      buildCommand: "npm run build",
      startCommand: "npm run start",
      requiredRuntimeVersion: "Node.js 20.x LTS",
      environmentVariablesManifest: [
        { name: "NODE_ENV", description: "Set to 'production' for optimal performance", required: true },
        { name: "PORT", description: "Application listener port (standard default: 3000)", required: true },
        { name: "DATABASE_URL", description: "Connection URI for permanent database instance", required: false },
      ],
      databaseMigrationNotes: [
        "Run database schema migrations before starting the web process.",
        "Ensure persistent storage volumes are mounted outside container ephemeral disk.",
      ],
      seedInstructions: "Execute 'npm run db:seed' if your application requires initial reference data.",
      domainConnectionInstructions: `Add a CNAME record in your DNS provider pointing to ${provider.id}.yourdomain.com`,
      providerChecklist: [
        `1. Create an account directly with ${provider.name} (${provider.websiteUrl})`,
        "2. Connect your Git repository or upload the prepared project ZIP",
        "3. Configure required environment variable names (do not commit secrets into git)",
        "4. Deploy and verify health check route '/api/health'",
      ],
      healthCheckRoute: "/api/health",
      rollbackGuidance: "Maintain previous Git commit tag; trigger instant rollback in provider dashboard if health check fails.",
      postDeploymentVerification: [
        "Verify SSL certificate provisioning (HTTPS status)",
        "Submit demonstration transaction or sample query",
        "Check provider runtime logs for uncaught exceptions",
      ],
    };
  }
}

export const globalDeploymentAdvisor = new DeploymentAdvisorService();
