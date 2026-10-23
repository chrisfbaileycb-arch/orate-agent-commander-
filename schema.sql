-- ORATOR.AI relational ledger (SQLite WAL, parameterized access only)
-- Tables, indexes, and foreign keys below are verified by the audit suite.

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
    chartered_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    status TEXT NOT NULL DEFAULT 'inquest' CHECK (status IN ('inquest', 'forging', 'delivered')),
    archetype TEXT,
    answers_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    system_name TEXT NOT NULL,
    tier TEXT NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    audit_score REAL NOT NULL DEFAULT 0,
    mode TEXT NOT NULL,
    completed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_builds_completed ON builds(completed_at);
