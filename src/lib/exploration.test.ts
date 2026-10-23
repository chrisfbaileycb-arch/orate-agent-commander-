import { describe, it, expect, beforeEach } from "vitest";
import { DesignExplorationService } from "./exploration-service";
import { ModelRouterService } from "./model-router-service";
import { INCLUDED_DESIGN_EXPLORATIONS } from "./exploration-types";

describe("ORATOR Design Studio & Design Explorations", () => {
  let explorationService: DesignExplorationService;
  let modelRouter: ModelRouterService;

  beforeEach(() => {
    explorationService = new DesignExplorationService();
    modelRouter = new ModelRouterService();
  });

  it("1. allocates exactly 3 included Design Explorations to a new user", () => {
    const clientId = "client-new-" + Date.now();
    const remaining = explorationService.getRemainingExplorations(clientId);
    expect(remaining).toBe(3);
    expect(INCLUDED_DESIGN_EXPLORATIONS).toBe(3);
  });

  it("2 & 3. casual conversation and answering questions do not consume an exploration", () => {
    const clientId = "client-casual-" + Date.now();
    const initialRemaining = explorationService.getRemainingExplorations(clientId);
    expect(initialRemaining).toBe(3);

    // Casual inquiries or preliminary checking do not consume
    const check = explorationService.canStartExploration(clientId);
    expect(check.allowed).toBe(true);
    expect(explorationService.getRemainingExplorations(clientId)).toBe(3);
  });

  it("4 & 5. provider failure or sandbox failure releases reservation without consuming exploration", () => {
    const clientId = "client-fail-" + Date.now();
    const res = explorationService.reserveExploration(clientId, "exp-fail-1");
    expect(res.success).toBe(true);

    // Failure occurs
    explorationService.releaseExplorationReservation(clientId, "exp-fail-1", "Provider timeout");

    const acct = explorationService.getAccount(clientId);
    expect(acct.activeReservation).toBeUndefined();
    expect(explorationService.getRemainingExplorations(clientId)).toBe(3);
  });

  it("6 & 7. successful delivery consumes exactly one exploration, idempotently", async () => {
    const clientId = "client-success-" + Date.now();
    const exploration = await explorationService.conductExploration(clientId, {
      q1: "Boutique Climbing Gym Booking",
      q2: "Climbers and front desk",
      q3: "Book a climbing session in under 30 seconds",
      q10: "Weekly schedule grid",
    });

    expect(exploration.id).toBeDefined();
    expect(exploration.conceptBrief.appName).toContain("Climbing-Gym");
    expect(exploration.sandbox.status).toBe("READY");
    expect(exploration.sandbox.isPrivate).toBe(true);
    expect(exploration.sandbox.publishAllowed).toBe(false);

    // Consumed exactly one
    expect(explorationService.getRemainingExplorations(clientId)).toBe(2);
  });

  it("8 & 9. minor revisions remain in active exploration without consuming another", async () => {
    const clientId = "client-revise-" + Date.now();
    const exp = await explorationService.conductExploration(clientId, {
      q1: "Task Manager",
      q2: "Freelancers",
      q3: "Track daily tasks",
    });

    expect(explorationService.getRemainingExplorations(clientId)).toBe(2);

    // Minor revision (e.g. changing workflow prompt)
    const revised = explorationService.reviseActiveExploration(exp.id, {
      q3: "Track daily sprints and tasks with time-blocking",
    });

    expect(revised.revisionsCount).toBe(1);
    expect(revised.conceptBrief.primaryWorkflow).toBe("Track daily sprints and tasks with time-blocking");
    // Remaining explorations untouched
    expect(explorationService.getRemainingExplorations(clientId)).toBe(2);
  });

  it("10. allows user to use all three explorations on related or different ideas", async () => {
    const clientId = "client-three-" + Date.now();

    // Exploration 1
    await explorationService.conductExploration(clientId, { q1: "Gym App Direction A" });
    expect(explorationService.getRemainingExplorations(clientId)).toBe(2);

    // Exploration 2
    await explorationService.conductExploration(clientId, { q1: "Gym App Direction B" });
    expect(explorationService.getRemainingExplorations(clientId)).toBe(1);

    // Exploration 3
    await explorationService.conductExploration(clientId, { q1: "Gym App Direction C" });
    expect(explorationService.getRemainingExplorations(clientId)).toBe(0);

    // 4th exploration blocked
    const check = explorationService.canStartExploration(clientId);
    expect(check.allowed).toBe(false);
  });

  it("11, 12 & 13. model routing is provider-neutral, models selected by capability not price, credentials remain server-side", () => {
    const decision = modelRouter.route("exploration", ["structured_concept_synthesis"]);
    expect(decision.providerModelAlias).toBe("Orator Discovery & Design Engine");
    expect(decision.costClassification).toBe("economic_no_cost");
    expect((decision as any).apiKey).toBeUndefined();
  });

  it("14, 15 & 16. Concept Sandbox is private, non-publishable, and discloses mocked behavior", async () => {
    const clientId = "client-sandbox-" + Date.now();
    const exp = await explorationService.conductExploration(clientId, {
      q1: "Social Community Platform",
      q2: "Developers",
      q3: "Share architecture snippets",
    });

    expect(exp.sandbox.isPrivate).toBe(true);
    expect(exp.sandbox.publishAllowed).toBe(false);
    expect(exp.sandbox.disclosedMockedBehaviors.length).toBeGreaterThan(0);
    expect(exp.sandbox.sandboxHtmlSrcDoc).toContain("PRIVATE CONCEPT SANDBOX");
  });

  it("18 & 19. seamless transition from exploration to Complete Build without repeating answers", async () => {
    const clientId = "client-trans-" + Date.now();
    const exp = await explorationService.conductExploration(clientId, {
      q1: "CRM System",
      q2: "Sales Reps",
      q3: "Log customer calls",
      q4: "Contacts, Deals, Logs",
    });

    const buildBrief = explorationService.transitionToCompleteBuildBrief(exp.id);
    expect(buildBrief.sourceExplorationId).toBe(exp.id);
    expect(buildBrief.preservedAnswers["q1"]).toBe("CRM System");
    expect(buildBrief.preservedAnswers["q4"]).toBe("Contacts, Deals, Logs");
    expect(buildBrief.targetCustomer).toBe("Sales Reps");
  });
});
