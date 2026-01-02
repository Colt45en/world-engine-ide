# Dev instructions (Vite + Python Relay)

Frontend (React + Vite):

- Start Vite dev server (serves at http://localhost:5173 or next free port):
  - npm run dev

Brain-first dev (UI + relay):

- Start the Python relay (ws://localhost:9000) and the Vite UI together:
  - npm run brain:dev

Consultant proxy (example)

- There's a small example Node/Express proxy under `server/consultant-proxy.js` that forwards POST /api/consultant to Ollama or OpenAI depending on environment variables.
- Usage (local Ollama): set `OLLAMA_URL=http://localhost:11434` and `OLLAMA_MODEL=llama2`, then run `node server/consultant-proxy.js` (default port 11435).
- Usage (OpenAI): set `OPENAI_API_KEY=sk-...` and optionally `OPENAI_MODEL=gpt-4o`, then run `node server/consultant-proxy.js`.
- The proxy accepts JSON { summary, prompt? } and returns { action, args, confidence, explanation } (or a safe fallback).
- Example Ollama-focused proxy and unit tests added at `server/consultant-ollama.js` and `server/test/consultant-ollama.test.js`. Run `npm run start:consultant-ollama` and `npm run test:consultant`.
- Optional integration test that runs against a live Ollama instance: `npm run test:consultant-int` (skips if `OLLAMA_URL` is not configured). Ensure Ollama is running locally (e.g. `ollama run`) before running the integration test.

LMN IDE

- A lightweight coding IDE preview is available at `public/tools/lmn-ide.html`. It provides multi-language editors, project controls (new/clone/rename/delete), snapshot commit (Time Machine), and a small neural-lattice visualizer. Use it for quick prototyping and local editing during demos.
- Strict mode: set `CONSULTANT_OLLAMA_STRICT=1` or `CONSULTANT_INTEGRATION_STRICT=1` to make the integration test fail if Ollama is not reachable. Examples:
  - macOS / Linux: `CONSULTANT_OLLAMA_STRICT=1 npm run test:consultant-int`
  - Windows PowerShell: `$Env:CONSULTANT_OLLAMA_STRICT = 1; npm run test:consultant-int`
  - Cross-platform npm script: `npm run test:consultant-int:strict` (uses `cross-env` to set the env var for you).
- Build for production:
  - npm run build
- Preview build:
  - npm run preview

Python Relay (brain):

- Create Python venv and install requirements:
  - python -m venv .venv
  - .venv\Scripts\activate (Windows)
  - pip install -r brain/requirements.txt
- Run tests: `pytest -q` from project root
- Start relay server:
  - python -m brain.relay.ws_server
  - Relay listens on ws://localhost:9000

Notes

- The Nexus page was converted to a native React page at `src/pages/Nexus.jsx` and is mounted at `/` (root route).
- The HUD component (`HUD` inside `Nexus.jsx`) connects to the relay at ws://localhost:9000 and creates a session on connect; use the "Apply ST" button to send a sample operator.
