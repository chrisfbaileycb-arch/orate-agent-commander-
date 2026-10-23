/**
 * PREVIEW CAPSULE, DEPLOYMENT ADVISOR, AND BUILD PASS CONTRACTS
 *
 * Core data contracts for:
 * 1. Temporary Preview Capsules (lifecycle, sharing, security, feedback)
 * 2. Deployment Questionnaire & Evidence-based Provider Recommendations
 * 3. Configurable Build Pass Entitlements (no subscriptions, 3 free tryouts)
 */

import type { GeneratedFile } from "./types";

// ============================================================================
// 1. PREVIEW CAPSULE CONTRACTS
// ============================================================================

export type PreviewCapsuleStatus =
  | "REQUESTED"
  | "VALIDATING"
  | "BUILDING"
  | "DEPLOYING"
  | "READY"
  | "REBUILDING"
  | "FAILED"
  | "EXPIRING"
  | "EXPIRED"
  | "DELETING"
  | "DELETED";

export type ShareMode = "owner_only" | "public_link" | "passcode_protected";

export interface SharePolicy {
  mode: ShareMode;
  allowFeedback: boolean;
  passcodeHash?: string; // SHA-256 hex string — never plaintext
  regeneratedAt?: number;
}

export interface PreviewCapsule {
  id: string;
  projectId: string;
  ownerId: string;
  buildId: string;
  artifactManifestId: string;
  buildHash: string;
  status: PreviewCapsuleStatus;
  createdAt: number;
  readyAt?: number;
  expiresAt: number;
  deletedAt?: number;
  previewUrl?: string;
  sharePolicy: SharePolicy;
  accessTokenHash: string; // Token hash for unguessable link authorization
  temporaryDataNamespace: string;
  deploymentProvider: "in_memory_sandbox" | "ephemeral_container" | "preview_mock";
  deploymentReference: string;
  healthCheckStatus: "healthy" | "unhealthy" | "pending";
  lastHealthCheckAt?: number;
  buildLogReference?: string;
  cleanupStatus: "not_started" | "in_progress" | "verified_cleaned" | "retry_pending";
  cleanupVerifiedAt?: number;
  failureCode?: string;
  failureMessage?: string;
  files: GeneratedFile[];
  manifest: {
    appName: string;
    archetype: string;
    summary: string;
    stack: string[];
    entryPoint: string;
  };
}

export interface CreateCapsuleOptions {
  tier?: "free" | "paid";
  shareMode?: ShareMode;
  passcode?: string;
  customLifetimeHours?: number;
}

export interface CapsuleFeedback {
  id: string;
  capsuleId: string;
  buildId: string;
  currentRoute: string;
  type: "like" | "change" | "broken" | "confused" | "comment";
  comment: string;
  createdAt: number;
  authorLabel?: string;
}

// ============================================================================
// 2. DEPLOYMENT QUESTIONNAIRE & ADVISOR CONTRACTS
// ============================================================================

export type ProjectDeploymentType =
  | "static_website"
  | "web_application"
  | "saas_product"
  | "online_store"
  | "internal_business_tool"
  | "api_backend_service"
  | "mobile_support_site"
  | "other";

export interface DeploymentQuestionnaireAnswers {
  projectType: ProjectDeploymentType;
  requiresPersistentData: boolean;
  requiresUserAccounts: boolean;
  acceptsPayments: boolean;
  requiresFileStorage: boolean;
  requiresBackgroundJobs: boolean;
  requiresRealtime: boolean;
  expectedTraffic: "low" | "medium" | "high" | "unpredictable";
  technicalDifficultyPreference: "beginner" | "intermediate" | "advanced";
  monthlyBudgetComfortUsd: "zero_to_10" | "10_to_30" | "30_to_100" | "100_plus";
  controlPreference: "maximum_simplicity" | "balanced" | "full_infrastructure_control";
  requiresCustomDomain: boolean;
  requiresBusinessEmail: boolean;
  regulatoryOrResidencyRequirements: boolean;
  requiresAutoScaling: boolean;
}

export interface DeploymentProvider {
  id: string;
  name: string;
  websiteUrl: string;
  supportedTypes: ProjectDeploymentType[];
  supportsStatic: boolean;
  supportsServerRuntime: boolean;
  supportedRuntimes: string[];
  managedDatabases: ("postgres" | "sqlite" | "redis" | "mysql" | "none")[];
  authenticationSupport: boolean;
  objectStorageSupport: boolean;
  backgroundJobsSupport: boolean;
  realtimeSupport: boolean;
  geographicRegions: string[];
  technicalDifficulty: "beginner" | "intermediate" | "advanced";
  estimatedMonthlyEntryCostUsd: number;
  costCategory: "free_tier_available" | "budget" | "standard" | "scale";
  scalingCharacteristics: string;
  exportabilityRating: "high" | "moderate" | "locked_in";
  lockInNotes: string;
  customDomainSupported: boolean;
  hasAffiliateProgram: boolean;
  affiliateDisclosureText?: string;
  affiliateDestinationIdentifier?: string;
  informationVerifiedAt: string; // ISO date, e.g. "2026-06-01"
  informationReviewBy: string;   // ISO date, e.g. "2026-12-01"
}

export interface RecommendationResult {
  role: "BEST_OVERALL" | "SIMPLEST" | "LOWEST_COST";
  provider: DeploymentProvider;
  matchScore: number;
  whyMatch: string;
  satisfiedRequirements: string[];
  remainingCustomerResponsibilities: string[];
  importantLimitations: string[];
  isAffiliate: boolean;
  affiliateDisclosure?: string;
  isStaleData: boolean;
}

export interface DeploymentHandoffPackage {
  providerId: string;
  providerName: string;
  appName: string;
  buildCommand: string;
  startCommand: string;
  requiredRuntimeVersion: string;
  environmentVariablesManifest: { name: string; description: string; required: boolean }[];
  databaseMigrationNotes: string[];
  seedInstructions: string;
  domainConnectionInstructions: string;
  providerChecklist: string[];
  healthCheckRoute: string;
  rollbackGuidance: string;
  postDeploymentVerification: string[];
}

// ============================================================================
// 3. BUILD PASS & ENTITLEMENT CONTRACTS
// ============================================================================

export type BuildPassTierId = "executive" | "retainer" | "sprint" | "single" | "builder" | "studio";

export interface BuildPassTierConfig {
  id: BuildPassTierId;
  name: string;
  priceUsd: number;
  buildSessionsGranted: number;
  description: string;
  badge: string;
}

export interface EntitlementAccount {
  clientId: string;
  freeTryoutsUsed: number;
  freeTryoutsAllowed: number; // Exactly 3 free tryouts
  paidSessionsPurchased: number;
  paidSessionsUsed: number;
  reservedSessionId?: string;
  reservationExpiresAt?: number;
  unlimitedEvaluation?: boolean;
}
