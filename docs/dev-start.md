# Developer quick-start (Docker)

This guide shows how to boot the full stack in a deterministic way using Docker Compose.

Prerequisites

- Docker Engine and docker-compose installed

Quick start

1. Copy `.env.example` to `.env` and adjust ports if needed:

```bash
cp .env.example .env
```

2. Build and start services:

```bash
make dev
```

This runs:

- Frontend (Vite) on http://localhost:5173
- Brain HTTP server on http://localhost:8000
- Brain WebSocket relay on ws://localhost:9000
- Orchestrator (daemon mode) that connects to the brain relay and accepts incoming envelopes

3. Check services:

```bash
./scripts/healthcheck.sh
```

4. To run the TF smoke test (optional):

```bash
make tf-smoke
```

5. To run the E2E integration test after artifacts are produced (CI or local):

- CI: the `e2e` job downloads artifacts from `tf-smoke` and runs `scripts/e2e_test.py`.
- Local: create artifacts (e.g., `make tf-smoke`), then:

```bash
make e2e
```

This will start `brain` and `orchestrator` and run `scripts/e2e_test.py` which loads the latest artifact and runs a deterministic predict check.

Relay WS E2E test (local)

- Install TensorFlow (2.12) and `websockets` in your Python environment (or use the Docker TF image):

```bash
pip install -r brain/requirements.txt
python -m pip install tensorflow==2.12.0
```

- Run the relay E2E pytest which starts the relay in test mode and sends an `Infer` envelope:

```bash
pytest brain/tests/test_relay_e2e.py -q
```

This test launches the relay as a subprocess with environment variables:

- `RELAY_TEST_MODE=1` — test mode (loads artifact model/tokenizers)
- `ARTIFACT_RUN_ID` — run id to load (the test writes a transient artifact)
- `ARTIFACTS_ROOT` — root folder where artifacts live
- `RELAY_LOG_JSON=1` — emit structured JSON logs to stdout
- `RELAY_PORT=0` — bind to an ephemeral port and print a `LISTENING` line

The test connects, sends an `Infer` command, and asserts the routing, tokenization and prediction fields are present and that a structured JSON log with the same `trace_id` was emitted.

Stopping services

```bash
make down
```

Notes

- The Docker images pin Python 3.11 and Node LTS for reproducible local runs.
- The `tf-smoke` job in CI and the optional `tf-smoke` Docker service run the TF training smoke test inside `tensorflow/tensorflow:2.12.0`.
- For local (non-Docker) runs of the Python quality gate, use Python 3.12 to match the CI `brain` job. If you see typing/pip-related import errors on newer interpreters, switch to 3.12.
- On Windows, `npm ci` can fail if native binaries (e.g. `esbuild.exe`) are locked by a running dev server or antivirus. Stop Vite/dev servers and retry.

Code quality gates

- Web gate: `npm run ci` (Prettier check + Markdown lint + ESLint + TypeScript typecheck + Vite build)
- Python gate:
  - Recommended interpreter: Python 3.12
  - `python -m ruff check brain`
  - `python -m black --check brain`
  - `pytest -q brain/tests`
- Combined: `npm run verify`
