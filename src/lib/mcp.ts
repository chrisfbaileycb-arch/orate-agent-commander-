/**
 * ORATOR MCP TOOL BENCH — Model Context Protocol servers for backend coding.
 *
 * Distilled from the AgenticSkills MCP directory (agenticskills.io/mcp,
 * 200+ servers across 22 categories). This bench curates the servers that
 * matter for forging backend software: databases, developer tools, cloud,
 * sandboxed execution, security, and integration surfaces.
 *
 * The forge seats MCP servers alongside skill playbooks: `mcpForPhase()`
 * returns the tool bench for a given phase, and the Director journal reports
 * which servers are attached as the build runs.
 */

export type McpCategory =
  | "databases"
  | "devtools"
  | "cloud"
  | "code-exec"
  | "security"
  | "comms"
  | "search"
  | "storage"
  | "payments"
  | "observability"
  | "knowledge"
  | "aggregator";

export interface McpServer {
  id: string;
  name: string;
  vendor: string;
  category: McpCategory;
  /** stdio (local process) or http (remote streamable). */
  transport: "stdio" | "http";
  /** Auth style the server expects. */
  auth: "api-key" | "oauth" | "none";
  /** Curated trust tier from the directory audit. */
  tier: "official" | "verified" | "community";
  desc: string;
  /** Forge phase ids this server serves (genesis, schema, backend, frontend, review, deploy). */
  serves: string[];
  /** Example mcp.json connection snippet. */
  connect: string;
}

export const MCP_BENCH: McpServer[] = [
  // ---- Developer tools ----
  {
    id: "github",
    name: "GitHub",
    vendor: "GitHub",
    category: "devtools",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "Full GitHub API — repos, issues, PRs, CI/CD, code search, Dependabot alerts.",
    serves: ["genesis", "backend", "frontend", "review"],
    connect: `{ "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "ghp_..." } }`,
  },
  {
    id: "playwright",
    name: "Playwright",
    vendor: "Microsoft",
    category: "devtools",
    transport: "stdio",
    auth: "none",
    tier: "official",
    desc: "Browser automation via structured accessibility snapshots for testing and scraping.",
    serves: ["frontend", "review"],
    connect: `{ "command": "npx", "args": ["-y", "@playwright/mcp"] }`,
  },
  {
    id: "context7",
    name: "Context7",
    vendor: "Upstash",
    category: "devtools",
    transport: "stdio",
    auth: "none",
    tier: "official",
    desc: "Up-to-date library documentation pulled into AI context on demand.",
    serves: ["genesis", "backend", "frontend"],
    connect: `{ "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }`,
  },
  {
    id: "task-master",
    name: "Task Master",
    vendor: "eyaltoledano",
    category: "devtools",
    transport: "stdio",
    auth: "none",
    tier: "verified",
    desc: "PRD parsing and AI-driven development task management.",
    serves: ["genesis", "review"],
    connect: `{ "command": "npx", "args": ["-y", "task-master-ai"] }`,
  },

  // ---- Databases & data ----
  {
    id: "supabase",
    name: "Supabase",
    vendor: "Supabase",
    category: "databases",
    transport: "http",
    auth: "api-key",
    tier: "official",
    desc: "Full platform: database, auth, edge functions, storage, and branching.",
    serves: ["schema", "backend"],
    connect: `{ "url": "https://mcp.supabase.com/mcp", "headers": { "Authorization": "Bearer <access-token>" } }`,
  },
  {
    id: "neon",
    name: "Neon Postgres",
    vendor: "Neon",
    category: "databases",
    transport: "http",
    auth: "api-key",
    tier: "official",
    desc: "Serverless Postgres with branching — schema migrations and drift control.",
    serves: ["schema", "backend"],
    connect: `{ "url": "https://mcp.neon.tech/mcp", "headers": { "Neon-Connection-String": "postgres://..." } }`,
  },
  {
    id: "google-toolbox-dbs",
    name: "Google Toolbox for DBs",
    vendor: "Google",
    category: "databases",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "Fast, secure database tools for Postgres, MySQL, SQL Server, and friends.",
    serves: ["schema"],
    connect: `{ "command": "npx", "args": ["-y", "@google/genai-toolbox"] }`,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    vendor: "MongoDB",
    category: "databases",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "Atlas cluster inspection, document queries, and index guidance.",
    serves: ["schema", "backend"],
    connect: `{ "command": "npx", "args": ["-y", "mongodb-mcp-server"], "env": { "MDB_CONNECTION_STRING": "mongodb://..." } }`,
  },

  // ---- Cloud & infrastructure ----
  {
    id: "aws",
    name: "AWS MCP",
    vendor: "AWS",
    category: "cloud",
    transport: "http",
    auth: "api-key",
    tier: "official",
    desc: "Managed remote server + 30+ servers for Lambda, ECS, S3, DynamoDB, Bedrock.",
    serves: ["deploy", "backend"],
    connect: `{ "url": "https://aws-mcp.example.com/mcp", "env": { "AWS_PROFILE": "default" } }`,
  },
  {
    id: "google-cloud",
    name: "Google Cloud MCP",
    vendor: "Google",
    category: "cloud",
    transport: "http",
    auth: "api-key",
    tier: "official",
    desc: "Fully managed remote servers for BigQuery, GCE, GKE, and Cloud Run.",
    serves: ["deploy"],
    connect: `{ "url": "https://google-cloud-mcp.example.com/mcp" }`,
  },
  {
    id: "azure",
    name: "Azure MCP Server",
    vendor: "Microsoft",
    category: "cloud",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "47+ Azure services including AI Foundry, Cosmos DB, Storage, Log Analytics.",
    serves: ["deploy"],
    connect: `{ "command": "npx", "args": ["-y", "@azure/mcp"] }`,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    vendor: "Cloudflare",
    category: "cloud",
    transport: "http",
    auth: "oauth",
    tier: "official",
    desc: "Workers, KV, R2, D1, DNS, AI Gateway — 13+ managed remote servers.",
    serves: ["deploy", "frontend"],
    connect: `{ "url": "https://mcp.cloudflare.com/mcp" }`,
  },

  // ---- Code execution (jailed sandboxes) ----
  {
    id: "e2b",
    name: "E2B Sandbox",
    vendor: "E2B",
    category: "code-exec",
    transport: "http",
    auth: "api-key",
    tier: "verified",
    desc: "Secure cloud sandboxes for running AI-generated code in isolation.",
    serves: ["review", "backend"],
    connect: `{ "command": "npx", "args": ["-y", "e2b-mcp-server"], "env": { "E2B_API_KEY": "..." } }`,
  },
  {
    id: "mcp-run-python",
    name: "mcp-run-python",
    vendor: "Pydantic",
    category: "code-exec",
    transport: "stdio",
    auth: "none",
    tier: "verified",
    desc: "Run Python via Pydantic AI's secure execution environment.",
    serves: ["review"],
    connect: `{ "command": "npx", "args": ["-y", "mcp-run-python", "stdio"] }`,
  },
  {
    id: "riza",
    name: "Riza",
    vendor: "Riza",
    category: "code-exec",
    transport: "http",
    auth: "api-key",
    tier: "verified",
    desc: "Hardened isolated runtime for executing untrusted generated code.",
    serves: ["review"],
    connect: `{ "command": "npx", "args": ["-y", "@riza/mcp"], "env": { "RIZA_API_KEY": "..." } }`,
  },

  // ---- Security & identity ----
  {
    id: "auth0",
    name: "Auth0 MCP",
    vendor: "Auth0",
    category: "security",
    transport: "http",
    auth: "oauth",
    tier: "official",
    desc: "Manage Auth0 tenants: applications, users, roles, and logs.",
    serves: ["backend", "deploy"],
    connect: `{ "url": "https://mcp.auth0.com/mcp" }`,
  },
  {
    id: "snyk",
    name: "Snyk",
    vendor: "Snyk",
    category: "security",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "Vulnerability scanning for dependencies and containers.",
    serves: ["review"],
    connect: `{ "command": "npx", "args": ["-y", "snyk-mcp"], "env": { "SNYK_TOKEN": "..." } }`,
  },
  {
    id: "safedep",
    name: "SafeDep",
    vendor: "SafeDep",
    category: "security",
    transport: "stdio",
    auth: "api-key",
    tier: "verified",
    desc: "Malware and supply-chain risk analysis for open-source packages.",
    serves: ["review"],
    connect: `{ "command": "npx", "args": ["-y", "@safedep/mcp"] }`,
  },

  // ---- Payments & integration surfaces ----
  {
    id: "stripe",
    name: "Stripe",
    vendor: "Stripe",
    category: "payments",
    transport: "http",
    auth: "api-key",
    tier: "official",
    desc: "Payments, customers, subscriptions, and refunds via mcp.stripe.com.",
    serves: ["backend"],
    connect: `{ "command": "npx", "args": ["-y", "@stripe/mcp"], "env": { "STRIPE_API_KEY": "sk_live_..." } }`,
  },
  {
    id: "resend",
    name: "Twilio / Comms",
    vendor: "Twilio",
    category: "comms",
    transport: "stdio",
    auth: "api-key",
    tier: "official",
    desc: "SMS, email, and messaging integrations for application workflows.",
    serves: ["backend"],
    connect: `{ "command": "npx", "args": ["-y", "twilio-mcp"], "env": { "TWILIO_API_KEY": "..." } }`,
  },

  // ---- Observability ----
  {
    id: "sentry",
    name: "Sentry",
    vendor: "Sentry",
    category: "observability",
    transport: "http",
    auth: "oauth",
    tier: "official",
    desc: "Error tracking, performance telemetry, and stack traces.",
    serves: ["review", "deploy"],
    connect: `{ "url": "https://mcp.sentry.dev/mcp" }`,
  },
  {
    id: "netdata",
    name: "Netdata",
    vendor: "Netdata",
    category: "observability",
    transport: "stdio",
    auth: "none",
    tier: "community",
    desc: "Real-time infrastructure monitoring with MCP integration.",
    serves: ["deploy"],
    connect: `{ "command": "npx", "args": ["-y", "netdata-mcp"] }`,
  },

  // ---- Knowledge & memory ----
  {
    id: "cognee",
    name: "Cognee",
    vendor: "topoteretes",
    category: "knowledge",
    transport: "stdio",
    auth: "none",
    tier: "community",
    desc: "Memory manager with graph + vector stores and 30+ data sources.",
    serves: ["genesis", "backend"],
    connect: `{ "command": "npx", "args": ["-y", "cognee-mcp"] }`,
  },
  {
    id: "markitdown",
    name: "markitdown",
    vendor: "Microsoft",
    category: "knowledge",
    transport: "stdio",
    auth: "none",
    tier: "official",
    desc: "Convert documents to Markdown optimized for AI processing.",
    serves: ["genesis"],
    connect: `{ "command": "npx", "args": ["-y", "markitdown-mcp"] }`,
  },

  // ---- Aggregators ----
  {
    id: "pipedream",
    name: "Pipedream",
    vendor: "Pipedream",
    category: "aggregator",
    transport: "http",
    auth: "oauth",
    tier: "official",
    desc: "Multi-tool platform connecting thousands of APIs through one MCP interface.",
    serves: ["backend"],
    connect: `{ "url": "https://remote.mcp.pipedream.net/mcp" }`,
  },
  {
    id: "zapier",
    name: "Zapier",
    vendor: "Zapier",
    category: "aggregator",
    transport: "http",
    auth: "oauth",
    tier: "official",
    desc: "8,000+ app integrations exposed as MCP tools.",
    serves: ["backend"],
    connect: `{ "url": "https://mcp.zapier.com/mcp" }`,
  },
];

export const MCP_CATEGORY_LABELS: Record<McpCategory, string> = {
  databases: "Databases & Data",
  devtools: "Developer Tools",
  cloud: "Cloud & Infrastructure",
  "code-exec": "Code Execution",
  security: "Security & Identity",
  comms: "Communication & Email",
  search: "Search & Browsing",
  storage: "File Systems & Storage",
  payments: "Finance & Payments",
  observability: "Analytics & Monitoring",
  knowledge: "Knowledge & Memory",
  aggregator: "Aggregators & Platforms",
};

/** MCP servers seated for a forge phase id. */
export function mcpForPhase(phaseId: string): McpServer[] {
  const key = phaseId.toLowerCase();
  const direct = MCP_BENCH.filter((s) =>
    s.serves.some((p) => key.includes(p))
  );
  if (direct.length > 0) return direct;
  // Fallback: devtools always have something to say.
  return MCP_BENCH.filter((s) => s.category === "devtools").slice(0, 2);
}

/** Compact journal line for the build log. */
export function mcpJournalLine(s: McpServer): string {
  return `mcp · ${s.name} seated [${s.transport}] — ${s.desc}`;
}
