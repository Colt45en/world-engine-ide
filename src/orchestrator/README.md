# Orchestrator (TypeScript)

A lightweight TypeScript orchestrator for the World Engine repository.

Features:

- In-memory Bus (pub/sub)
- Router with simple rules
- Link registry and Bridges (Console, WS -> Brain, SQLite outbox)
- Idempotency store and outbox
- Demo script `src/orchestrator/demo.ts`

Usage:

- Run the demo locally without Docker:
  - npx ts-node src/orchestrator/demo.ts

- Run the orchestrator in daemon mode (keeps running for Docker/Dev):
  - ORCH_DAEMON=1 npx ts-node src/orchestrator/index.ts

- Or use Docker compose to run the full stack (recommended for deterministic dev):
  - make dev
  - then browse to http://localhost:5173 and check Brain at http://localhost:8000/state

Notes:

- The WS bridge attempts to use `ws` package; if it's not installed the bridge becomes a retryable no-op.
- The SQLite outbox uses `better-sqlite3` if available, then `sqlite3`, otherwise falls back to an in-memory queue.

Suggestions:

- Add `ws` and `better-sqlite3` to devDependencies if you want durable bridging in dev:
  - `npm i -D ws better-sqlite3 @types/ws`

Contributions and improvements are welcome — the orchestrator skeleton is intentionally small and easily extended.
