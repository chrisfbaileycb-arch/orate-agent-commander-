import { useCallback, useEffect, useRef, useState } from "react";
import type { IngestItem, SessionState } from "./types";
import { globalEntitlementService, FREE_TRYOUTS_DEFAULT } from "./build-pass-service";

/** ---------- Session allowance + Build Pass Entitlement state ---------- */

const STORAGE_KEY = "orator.session.v1";
const BOOKINGS_KEY = "orator.bookings.v1";
export const FREE_SESSIONS = FREE_TRYOUTS_DEFAULT; // 3 free tryouts
export const CHARTER_PRICE_USD = 99; // Legacy alias for builder pass ($99)

function makeClientId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState;
      if (parsed && typeof parsed.clientId === "string") {
        return {
          ...parsed,
          chartered: parsed.chartered === true,
          freeSessions: FREE_SESSIONS,
          ingest: Array.isArray(parsed.ingest) ? parsed.ingest : [],
        };
      }
    }
  } catch {
    /* fall through to fresh session */
  }
  return {
    clientId: makeClientId(),
    status: "landing",
    sessionsUsed: 0,
    freeSessions: FREE_SESSIONS,
    chartered: false,
    answers: {},
    ingest: [],
    startedAt: Date.now(),
  };
}

export interface SessionApi {
  session: SessionState;
  remainingFree: number;
  isChartered: boolean;
  canForge: boolean;
  beginInquest: () => void;
  recordAnswer: (questionId: string, value: string) => void;
  recordIngest: (item: IngestItem) => void;
  beginForging: () => void;
  markDelivered: () => void;
  requirePayment: () => void;
  activateBuildPass: (tierId: "single" | "builder" | "studio") => void;
  payCharter: () => void; // Kept for interface backward-compatibility
  markBooked: (slotISO: string) => void;
  resetSession: () => void;
}

export function useSession(): SessionApi {
  const [session, setSession] = useState<SessionState>(loadSession);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* storage unavailable — session stays in memory */
    }
  }, [session]);

  const beginInquest = useCallback(() => {
    setSession((s) => ({ ...s, status: "inquest" }));
  }, []);

  const recordAnswer = useCallback((questionId: string, value: string) => {
    setSession((s) => ({ ...s, answers: { ...s.answers, [questionId]: value } }));
  }, []);

  const recordIngest = useCallback((item: IngestItem) => {
    setSession((s) => ({
      ...s,
      ingest: [...s.ingest, item].slice(-20), // cap context list
    }));
  }, []);

  const beginForging = useCallback(() => {
    // Note: Session count is finalized during verified delivery
    setSession((s) => ({ ...s, status: "forging" }));
  }, []);

  const markDelivered = useCallback(() => {
    const current = sessionRef.current;
    // Idempotently consume entitlement
    globalEntitlementService.consumeSession(current.clientId, `build-${Date.now()}`);
    setSession((s) => ({
      ...s,
      status: "delivered",
      sessionsUsed: s.sessionsUsed + 1,
    }));
  }, []);

  const requirePayment = useCallback(() => {
    setSession((s) => ({ ...s, status: "payment_required" }));
  }, []);

  const activateBuildPass = useCallback((tierId: "single" | "builder" | "studio") => {
    const current = sessionRef.current;
    globalEntitlementService.grantEvaluationPass(current.clientId, tierId);
    setSession((s) => ({
      ...s,
      status: "inquest",
      chartered: true,
      answers: {},
      ingest: [],
    }));
  }, []);

  const payCharter = useCallback(() => {
    activateBuildPass("builder");
  }, [activateBuildPass]);

  const markBooked = useCallback((slotISO: string) => {
    const current = sessionRef.current;
    try {
      const bookings = JSON.parse(localStorage.getItem(BOOKINGS_KEY) ?? "[]") as unknown[];
      bookings.push({ slotISO, clientId: current.clientId, createdAt: Date.now() });
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
    } catch {
      /* ignore */
    }
    setSession((s) => ({ ...s, status: "booked" }));
  }, []);

  const resetSession = useCallback(() => {
    setSession((s) => ({ ...s, status: "landing", answers: {}, ingest: [] }));
  }, []);

  const remainingFree = Math.max(0, session.freeSessions - session.sessionsUsed);
  const entitlement = globalEntitlementService.getAccount(session.clientId);
  const remainingPaid = Math.max(0, entitlement.paidSessionsPurchased - entitlement.paidSessionsUsed);

  const canForge = session.chartered || remainingFree > 0 || remainingPaid > 0 || entitlement.unlimitedEvaluation === true;
  const isChartered = session.chartered || remainingPaid > 0;

  return {
    session,
    remainingFree,
    isChartered,
    canForge,
    beginInquest,
    recordAnswer,
    recordIngest,
    beginForging,
    markDelivered,
    requirePayment,
    activateBuildPass,
    payCharter,
    markBooked,
    resetSession,
  };
}
