-- Deterministic seed fixtures for the ORATOR.AI ledger.

INSERT INTO clients (id, tier, chartered_at, created_at) VALUES
    ('seed-client-0001', 'paid', '2026-01-05T09:30:00Z', '2026-01-05T09:30:00Z'),
    ('seed-client-0002', 'free', NULL, '2026-01-06T12:00:00Z');

INSERT INTO sessions (id, client_id, status, archetype, answers_json, started_at, completed_at) VALUES
    ('seed-session-0001', 'seed-client-0001', 'delivered', 'commerce',
     '{"q1": "A booking system for a boutique climbing gym"}',
     '2026-01-05T09:31:00Z', '2026-01-05T09:32:00Z');

INSERT INTO builds (id, session_id, system_name, tier, file_count, audit_score, mode, completed_at) VALUES
    ('build_seed0001', 'seed-session-0001', 'Climbing-Gym-Booking', 'complete', 17, 100.0, 'paid', '2026-01-05T09:32:00Z');
