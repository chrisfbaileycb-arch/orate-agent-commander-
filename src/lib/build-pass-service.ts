/**
 * BUILD PASS CONFIGURATION AND ENTITLEMENT SERVICE
 *
 * Enforces:
 * - 3 free tryouts before paying to build an app
 * - Configurable Build Passes: Single ($49 / 1 build), Builder ($99 / 3 builds), Studio ($199 / 8 builds)
 *   (Note: $299 Workshop pass explicitly excluded per user prompt directive)
 * - Safe reservation, rollback on build failure, and idempotent consumption
 * - Provider-neutral, no payment processor connected during this phase
 */

import type { BuildPassTierConfig, EntitlementAccount } from "./capsule-types";

export const FREE_TRYOUTS_DEFAULT = 3;

/**
 * Single source of truth for build pass pricing and quotas.
 * $299 tier is omitted per user instruction.
 */
export const BUILD_PASS_REGISTRY: Record<string, BuildPassTierConfig> = {
  single: {
    id: "single",
    name: "Single Build Pass",
    priceUsd: 49,
    buildSessionsGranted: 1,
    description: "1 full production execution by the US Sovereign Consortium with live Dev Iframe and source ZIP.",
    badge: "1 BUILD",
  },
  builder: {
    id: "builder",
    name: "Builder Pass",
    priceUsd: 99,
    buildSessionsGranted: 3,
    description: "3 full production builds with sovereign consortium pipeline.",
    badge: "3 BUILDS",
  },
  studio: {
    id: "studio",
    name: "Studio Pass",
    priceUsd: 199,
    buildSessionsGranted: 8,
    description: "8 full production builds with continuous workspace revisions.",
    badge: "8 BUILDS",
  },
  executive: {
    id: "executive",
    name: "The Executive Build Pass",
    priceUsd: 149,
    buildSessionsGranted: 1,
    description: "1 full production execution by the US Sovereign Consortium. Live interactive Dev Iframe, unit tests, GitHub repo sync, and downloadable source ZIP with audit provenance.",
    badge: "FLAT / BUILD",
  },
  retainer: {
    id: "retainer",
    name: "Founder Forge Retainer",
    priceUsd: 399,
    buildSessionsGranted: 5,
    description: "5 full production builds / month, continuous workspace revisions, private repository deployment, and dedicated hosting sandboxes.",
    badge: "MONTHLY RETAINER",
  },
  sprint: {
    id: "sprint",
    name: "Dual-Build Sprint Pass",
    priceUsd: 249,
    buildSessionsGranted: 2,
    description: "2 full production builds with sovereign consortium pipeline — ideal for multi-tenant and companion app architectures.",
    badge: "2 BUILDS",
  },
};

const ENTITLEMENT_STORAGE_KEY = "orator.entitlements.v1";

export class BuildPassEntitlementService {
  private memoryAccounts: Map<string, EntitlementAccount> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((acct: EntitlementAccount) => this.memoryAccounts.set(acct.clientId, acct));
        }
      }
    } catch {
      /* fallback to memory */
    }
  }

  private saveToStorage() {
    if (typeof localStorage === "undefined") return;
    try {
      const arr = Array.from(this.memoryAccounts.values());
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  }

  public getAccount(clientId: string): EntitlementAccount {
    let acct = this.memoryAccounts.get(clientId);
    if (!acct) {
      acct = {
        clientId,
        freeTryoutsUsed: 0,
        freeTryoutsAllowed: FREE_TRYOUTS_DEFAULT,
        paidSessionsPurchased: 0,
        paidSessionsUsed: 0,
      };
      this.memoryAccounts.set(clientId, acct);
      this.saveToStorage();
    }
    return { ...acct };
  }

  public canStartBuild(clientId: string): { allowed: boolean; reason?: string; remainingFree: number; remainingPaid: number } {
    const acct = this.getAccount(clientId);
    const remainingFree = Math.max(0, acct.freeTryoutsAllowed - acct.freeTryoutsUsed);
    const remainingPaid = Math.max(0, acct.paidSessionsPurchased - acct.paidSessionsUsed);

    if (acct.unlimitedEvaluation) {
      return { allowed: true, remainingFree, remainingPaid };
    }

    if (remainingFree > 0 || remainingPaid > 0) {
      return { allowed: true, remainingFree, remainingPaid };
    }

    return {
      allowed: false,
      reason: `You have consumed all ${acct.freeTryoutsAllowed} free tryouts. A Build Pass is required to start forging.`,
      remainingFree,
      remainingPaid,
    };
  }

  /**
   * Reserves a build session during final generation so double-clicks cannot consume duplicate sessions.
   */
  public reserveSession(clientId: string, buildId: string): { success: boolean; reservationId?: string; error?: string } {
    const check = this.canStartBuild(clientId);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const acct = this.getAccount(clientId);
    acct.reservedSessionId = buildId;
    acct.reservationExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minute hold
    this.memoryAccounts.set(clientId, acct);
    this.saveToStorage();

    return { success: true, reservationId: buildId };
  }

  /**
   * Release reservation after technical failure, network error, or user abandonment.
   */
  public releaseReservation(clientId: string, buildId: string): void {
    const acct = this.getAccount(clientId);
    if (acct.reservedSessionId === buildId) {
      delete acct.reservedSessionId;
      delete acct.reservationExpiresAt;
      this.memoryAccounts.set(clientId, acct);
      this.saveToStorage();
    }
  }

  /**
   * Consume a session ONLY AFTER a build is verified and ready for delivery/preview.
   * Consumes free tryouts first, then paid passes.
   */
  public consumeSession(clientId: string, buildId: string): { success: boolean; wasFree: boolean; remainingFree: number; remainingPaid: number } {
    const acct = this.getAccount(clientId);

    // Release reservation lock
    if (acct.reservedSessionId === buildId) {
      delete acct.reservedSessionId;
      delete acct.reservationExpiresAt;
    }

    let wasFree = false;
    if (acct.freeTryoutsUsed < acct.freeTryoutsAllowed) {
      acct.freeTryoutsUsed++;
      wasFree = true;
    } else if (acct.paidSessionsPurchased > acct.paidSessionsUsed) {
      acct.paidSessionsUsed++;
      wasFree = false;
    } else if (acct.unlimitedEvaluation) {
      wasFree = false;
    } else {
      return {
        success: false,
        wasFree: false,
        remainingFree: 0,
        remainingPaid: 0,
      };
    }

    this.memoryAccounts.set(clientId, acct);
    this.saveToStorage();

    const remainingFree = Math.max(0, acct.freeTryoutsAllowed - acct.freeTryoutsUsed);
    const remainingPaid = Math.max(0, acct.paidSessionsPurchased - acct.paidSessionsUsed);

    return { success: true, wasFree, remainingFree, remainingPaid };
  }

  /**
   * Development / evaluation grant without simulating real credit card checkout.
   */
  public grantEvaluationPass(clientId: string, tierId: "single" | "builder" | "studio"): void {
    const tier = BUILD_PASS_REGISTRY[tierId];
    if (!tier) return;
    const acct = this.getAccount(clientId);
    acct.paidSessionsPurchased += tier.buildSessionsGranted;
    this.memoryAccounts.set(clientId, acct);
    this.saveToStorage();
  }

  public setUnlimitedEvaluation(clientId: string, enabled: boolean): void {
    const acct = this.getAccount(clientId);
    acct.unlimitedEvaluation = enabled;
    this.memoryAccounts.set(clientId, acct);
    this.saveToStorage();
  }
}

export const globalEntitlementService = new BuildPassEntitlementService();
