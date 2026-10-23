import type { InquestAnswer } from "./types";

/** ---------- The 15-Question Conversational Inquest ---------- */

export interface InquestQuestion {
  id: string;
  phase: string;
  prompt: string;
  hint: string;
  placeholder: string;
  /** Short suggestions the user can tap to fill the input */
  suggestions?: string[];
}

export const INQUEST_QUESTIONS: InquestQuestion[] = [
  {
    id: "q1",
    phase: "GENESIS",
    prompt: "What software are we forging today?",
    hint: "One sentence. Plain language. The router does the rest.",
    placeholder: "e.g. A booking system for a boutique climbing gym",
    suggestions: [
      "A booking system for a climbing gym",
      "An internal CRM for my agency",
      "A habit tracker with streak analytics",
    ],
  },
  {
    id: "q2",
    phase: "GENESIS",
    prompt: "Who exactly wields this software?",
    hint: "Role or persona. Be specific — it shapes every screen.",
    placeholder: "e.g. Front-desk staff and members, on phones mostly",
  },
  {
    id: "q3",
    phase: "GENESIS",
    prompt: "What single outcome defines success?",
    hint: "If this product does only one thing perfectly, what is it?",
    placeholder: "e.g. A member books a class in under 30 seconds",
  },
  {
    id: "q4",
    phase: "ARCHITECTURE",
    prompt: "Which domains live inside the system?",
    hint: "Comma-separated nouns. The schema expert will normalize them.",
    placeholder: "e.g. members, classes, bookings, payments, waitlists",
  },
  {
    id: "q5",
    phase: "ARCHITECTURE",
    prompt: "Who may read, and who may write?",
    hint: "Name the roles and their powers.",
    placeholder: "e.g. Admins manage everything; members see only their bookings",
  },
  {
    id: "q6",
    phase: "ARCHITECTURE",
    prompt: "What must be true after every operation?",
    hint: "Invariants. The audit engine will enforce each one you list.",
    placeholder: "e.g. No double-booking a full class; payments always logged",
  },
  {
    id: "q7",
    phase: "BACKEND",
    prompt: "Where does data rest?",
    hint: "Database or storage preference, if any.",
    placeholder: "e.g. Postgres, or SQLite for simplicity",
    suggestions: ["Postgres", "SQLite", "MongoDB", "You decide"],
  },
  {
    id: "q8",
    phase: "BACKEND",
    prompt: "What external services must it speak to?",
    hint: "Payments, email, maps — list any, or skip.",
    placeholder: "e.g. Stripe for payments, SendGrid for confirmations",
  },
  {
    id: "q9",
    phase: "BACKEND",
    prompt: "What happens when it fails?",
    hint: "Fallbacks, retries, human handoffs.",
    placeholder: "e.g. Show a retry banner and email admin after 3 failures",
  },
  {
    id: "q10",
    phase: "INTERFACE",
    prompt: "Describe the primary screen.",
    hint: "The one view that carries 80% of usage.",
    placeholder: "e.g. Weekly grid of classes with instant booking",
  },
  {
    id: "q11",
    phase: "INTERFACE",
    prompt: "What is the visual temperament?",
    hint: "Two or three adjectives.",
    placeholder: "e.g. Calm, premium, high-contrast",
  },
  {
    id: "q12",
    phase: "INTERFACE",
    prompt: "Which device deserves first-class care?",
    hint: "Mobile-first, desktop-first, or both.",
    placeholder: "e.g. Mobile-first — members book from the gym floor",
    suggestions: ["Mobile-first", "Desktop-first", "Both equally"],
  },
  {
    id: "q13",
    phase: "OPERATIONS",
    prompt: "What must be measurable on day one?",
    hint: "Metrics, events, dashboards.",
    placeholder: "e.g. Bookings per class, no-show rate, peak hours",
  },
  {
    id: "q14",
    phase: "OPERATIONS",
    prompt: "What is the growth edge for v2?",
    hint: "One capability you'll want next.",
    placeholder: "e.g. Recurring memberships with auto-billing",
  },
  {
    id: "q15",
    phase: "OPERATIONS",
    prompt: "Any constraint the forge must respect?",
    hint: "Budget, deadlines, tech bans, compliance.",
    placeholder: "e.g. No paid tools; must run offline at the gym",
  },
];

export const INQUEST_PHASES = [
  "GENESIS",
  "ARCHITECTURE",
  "BACKEND",
  "INTERFACE",
  "OPERATIONS",
] as const;

export function phaseOf(index: number): string {
  return INQUEST_QUESTIONS[Math.min(index, INQUEST_QUESTIONS.length - 1)].phase;
}

/** Deterministic completion ratio helper for the halo ring */
export function ringProgress(index: number, total: number): number {
  return Math.max(0, Math.min(1, index / total));
}

export function summarizeInquest(answers: InquestAnswer[]): string {
  return answers
    .map((a) => {
      const q = INQUEST_QUESTIONS.find((q) => q.id === a.questionId);
      return `${q?.prompt ?? a.questionId}\n→ ${a.value}`;
    })
    .join("\n\n");
}
