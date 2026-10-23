import { useEffect, useMemo, useState } from "react";
import PlasmaBackdrop from "./components/PlasmaBackdrop";
import HudChrome from "./components/HudChrome";
import Landing from "./components/Landing";
import Inquest from "./components/Inquest";
import ForgeDirector from "./components/ForgeDirector";
import VerificationGate from "./components/VerificationGate";
import Deliverables from "./components/Deliverables";
import BookingModal from "./components/BookingModal";
import BuildPassModal from "./components/BuildPassModal";
import McpBenchModal from "./components/McpBenchModal";
import ConceptSandboxModal from "./components/ConceptSandboxModal";
import CortexTopologyMatrix from "./components/cortex/CortexTopologyMatrix";
import { useSession } from "./lib/session";
import { useScarcityAlerts, computeTelemetry } from "./lib/telemetry";
import { buildPlan } from "./lib/generator";
import { runAudit } from "./lib/audit";
import { redactSecrets } from "./lib/security";
import { orate, hush, startDrone, setDroneEnergy } from "./lib/voice";
import type { ForgePlan } from "./lib/types";
import type { DesignExploration } from "./lib/exploration-types";
import { globalExplorationService } from "./lib/exploration-service";

/** ---------- ORATOR.AI DESIGN STUDIO & APPLICATION SHELL ---------- */

export default function App() {
  const session = useSession();
  const [showBooking, setShowBooking] = useState(false);
  const [showBuildPass, setShowBuildPass] = useState(false);
  const [showBench, setShowBench] = useState(false);
  const [showCortex, setShowCortex] = useState(false);
  const [plan, setPlan] = useState<ForgePlan | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const audit = useMemo(() => (plan ? runAudit(plan) : null), [plan]);

  // Design Exploration states
  const [activeExploration, setActiveExploration] = useState<DesignExploration | null>(null);
  const [selectedSandboxExploration, setSelectedSandboxExploration] = useState<DesignExploration | null>(null);
  const [explorationsList, setExplorationsList] = useState<DesignExploration[]>(() =>
    globalExplorationService.getAllExplorations(session.session.clientId)
  );

  const remainingExplorations = globalExplorationService.getRemainingExplorations(session.session.clientId);
  const telemetry = useMemo(() => computeTelemetry(session.session.sessionsUsed), [session.session.sessionsUsed]);
  const alerts = useScarcityAlerts(session.session.status === "landing" || session.session.status === "inquest");

  const status = session.session.status;

  // Ambient drone: begins on first user gesture
  useEffect(() => {
    const ignite = () => {
      startDrone();
      setDroneEnergy(0.15);
      window.removeEventListener("pointerdown", ignite);
      window.removeEventListener("keydown", ignite);
    };
    window.addEventListener("pointerdown", ignite);
    window.addEventListener("keydown", ignite);
    return () => {
      window.removeEventListener("pointerdown", ignite);
      window.removeEventListener("keydown", ignite);
    };
  }, []);

  // Clean up speech on unmount
  useEffect(() => {
    return () => hush();
  }, []);

  useEffect(() => {
    if (status === "forging" && !plan) {
      session.resetSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Start a new Design Exploration
  const startExploration = () => {
    const check = globalExplorationService.canStartExploration(session.session.clientId);
    if (!check.allowed) {
      setShowBuildPass(true);
      return;
    }
    session.beginInquest();
  };

  // When Inquest completes: produce the Design Exploration (Concept Brief + Concept Sandbox)
  // or proceed directly to Complete Build if already in Complete Build mode
  const handleInquestComplete = async () => {
    try {
      // Conduct Design Exploration
      const exploration = await globalExplorationService.conductExploration(
        session.session.clientId,
        session.session.answers,
        session.session.ingest
      );
      setActiveExploration(exploration);
      setSelectedSandboxExploration(exploration);
      setExplorationsList(globalExplorationService.getAllExplorations(session.session.clientId));
      session.resetSession(); // Return smoothly to studio landing with sandbox open
    } catch (err: any) {
      console.error("Exploration error:", err);
    }
  };

  // Move a selected Design Exploration directly into a Complete Orator Build
  const handleMoveToCompleteBuild = (exploration: DesignExploration) => {
    setSelectedSandboxExploration(null);

    // If user has not purchased a build pass, open the Build Pass modal
    if (!session.canForge) {
      session.requirePayment();
      setShowBuildPass(true);
      return;
    }

    // Convert exploration seamlessly into a BuildBrief and build plan
    const brief = globalExplorationService.transitionToCompleteBuildBrief(exploration.id);
    setPlan(
      buildPlan(brief.preservedAnswers, session.session.clientId, session.isChartered ? "paid" : "free")
    );
    session.beginForging();
  };

  const handleForgeComplete = (finished: ForgePlan) => {
    redactSecrets(JSON.stringify(finished));
    setGateOpen(true);
  };

  const handleGateSealed = () => {
    setGateOpen(false);
    session.markDelivered();
  };

  const handleBook = (slotISO: string) => {
    session.markBooked(slotISO);
    setShowBooking(false);
  };

  const handleGrantPass = (tierId: "single" | "builder" | "studio") => {
    globalExplorationService.grantBuildPass(session.session.clientId, tierId);
    session.activateBuildPass(tierId);
    setShowBuildPass(false);
  };

  const newForge = () => {
    session.resetSession();
    setPlan(null);
    setGateOpen(false);
  };

  const tier: "free" | "paid" = session.isChartered ? "paid" : "free";

  return (
    <div className="bg-[#07070a] text-pearl isolate relative h-screen w-screen overflow-hidden flex flex-col font-mono-hud">
      <PlasmaBackdrop />
      <div className="grid-lines pointer-events-none fixed inset-0 opacity-40" />

      <main className="flex-1 min-h-0 relative overflow-hidden">
        {(status === "landing" || status === "booked" || status === "payment_required") && (
          <Landing
            session={session}
            telemetry={telemetry}
            explorations={explorationsList}
            remainingExplorations={remainingExplorations}
            onBeginExploration={startExploration}
            onOpenSandbox={(exp) => setSelectedSandboxExploration(exp)}
            onMoveToBuild={handleMoveToCompleteBuild}
            onBook={() => setShowBooking(true)}
            onOpenBuildPasses={() => setShowBuildPass(true)}
            onOpenCortex={() => setShowCortex(true)}
          />
        )}

        {status === "inquest" && (
          <div className="h-full overflow-y-auto">
            <Inquest
              answers={session.session.answers}
              ingest={session.session.ingest}
              onAnswer={session.recordAnswer}
              onIngest={session.recordIngest}
              onComplete={handleInquestComplete}
              onExit={session.resetSession}
            />
          </div>
        )}

        {status === "forging" && plan && !gateOpen && (
          <div className="h-full overflow-y-auto">
            <ForgeDirector
              plan={plan}
              tier={tier}
              onComplete={handleForgeComplete}
              onOpenCortex={() => setShowCortex(true)}
            />
          </div>
        )}

        {status === "forging" && plan && gateOpen && audit && (
          <div className="h-full overflow-y-auto">
            <VerificationGate audit={audit} onSeal={handleGateSealed} />
          </div>
        )}

        {status === "delivered" && plan && (
          <div className="h-full overflow-y-auto">
            <Deliverables
              plan={plan}
              auditScore={audit?.score ?? 0}
              auditPassed={audit?.passed ?? 0}
              auditTotal={audit?.total ?? 0}
              ingest={session.session.ingest}
              onNewForge={newForge}
            />
          </div>
        )}
      </main>

      {showBooking && (
        <BookingModal
          slotsRemaining={telemetry.slotsRemaining}
          onBook={handleBook}
          onClose={() => setShowBooking(false)}
        />
      )}

      {showBuildPass && (
        <BuildPassModal
          clientId={session.session.clientId}
          explorationsCompleted={3 - remainingExplorations}
          onGrantPass={handleGrantPass}
          onClose={() => setShowBuildPass(false)}
        />
      )}

      {selectedSandboxExploration && (
        <ConceptSandboxModal
          exploration={selectedSandboxExploration}
          onClose={() => setSelectedSandboxExploration(null)}
          onRefineDirection={() => {
            setSelectedSandboxExploration(null);
            session.beginInquest();
          }}
          onMoveToCompleteBuild={handleMoveToCompleteBuild}
        />
      )}

      {showBench && <McpBenchModal onClose={() => setShowBench(false)} />}

      {showCortex && (
        <CortexTopologyMatrix isModal onClose={() => setShowCortex(false)} />
      )}
    </div>
  );
}
