# World Engine IDE

## Overview

World Engine IDE is a React + Vite frontend paired with:

- a legacy Express static server for `public/`
- a Python **Brain** in `brain/` (IR + operators + containment/covenant + WebSocket relay)

This repo prioritizes:

- determinism (operator/state updates)
- reproducible builds (CI-enforced)
- single-source-of-truth documentation (`docs/`)

For canonical docs and subsystem links, start at [docs/README.md](docs/README.md).

---

## Architecture

### Frontend (React + Vite)

- Entry: `index.html` → `src/main.jsx` → `src/app.jsx`
- Routing: `react-router-dom` v5 (`Switch`, `Route component={...}`)
- Pages: `src/pages/`
- Components: `src/components/`

### Legacy static server (optional)

- `npm start` runs `scripts/start.js` to serve `public/` (defaults to port 3000)
- Legacy UI assets live under `public/` (e.g. `public/nexus/`)

### Python Brain (`brain/`)

- WebSocket relay server: `brain/src/brain/relay/ws_server.py` (default: `ws://localhost:9000`)
- IR models: `brain/src/brain/ir/models.py`
- Operators: `brain/src/brain/operators/`
- Containment/Covenant: `brain/src/brain/containment/`, `brain/src/brain/covenant/`

---

## Repository layout (high signal)

```
world-engine-ide
├─ src/                       # React + Vite app
│  ├─ main.jsx
│  ├─ app.jsx
│  ├─ pages/
│  └─ components/
├─ public/                    # legacy/static assets
│  └─ nexus/
├─ scripts/
│  └─ start.js                # Express static server for public/
├─ brain/                     # Python Brain
│  ├─ src/brain/
│  └─ tests/
├─ docs/                      # canonical documentation (single source of truth)
├─ package.json
└─ README.md
```

Rule: if a feature exists in both legacy static and React, there must be one canonical implementation; the other must be a thin wrapper or migrated.

---

## Quick start

### 1) Install (frontend)

```bash
npm install
```

### 2) Run Vite dev server (frontend)

```bash
npm run dev
```

### 3) Run legacy static server (optional)

```bash
npm start
```

### 4) Python Brain setup

This repo’s CI runs the Python gate on Python 3.12. If your local Python is newer and pip breaks, use Python 3.12/3.11 (or use Docker; see `docs/dev-start.md`).

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r brain/requirements.txt
python -m pip install -r brain/requirements-dev.txt
```

macOS/Linux:

```bash
source .venv/bin/activate
python -m pip install -r brain/requirements.txt
python -m pip install -r brain/requirements-dev.txt
```

### 5) Optional: Start the WebSocket relay

Only needed if you are using features that talk to the Brain relay.

The relay package lives under `brain/src`, so set `PYTHONPATH` if your environment doesn’t already include it.

Windows PowerShell:

```powershell
$Env:PYTHONPATH = "brain/src";
$Env:RELAY_PORT = "9001";
.\.venv\Scripts\python.exe -m brain.relay.ws_server
```

macOS/Linux:

```bash
PYTHONPATH=brain/src python -m brain.relay.ws_server
```

Relay listens on:

- `ws://localhost:9000` by default (override with `RELAY_PORT`)

To point the UI at a different relay URL, set `VITE_BRAIN_RELAY_URL`.

---

## Development workflow

### Frontend scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview `dist/`
- `npm run serve:dist` — serve `dist/` via a minimal Python server (SPA fallback)
- `npm run server:full` — serve `dist/` + run Brain relay (for Brain-gated routes)
- `npm start` — serve `public/` via Express (legacy)

### Quality gates (local)

- `npm run ci` — format + markdown lint + eslint + typecheck + build
- `npm run verify` — `npm run ci` + python lint/format-check/tests

### Python gates

- `npm run py:lint` — Ruff
- `npm run py:format:check` — Black
- `npm run py:test` — Pytest (`brain/tests`)

---

## WebSocket relay protocol (minimal)

Create session:

```json
{ "cmd": "CreateSession", "owner": "nexus-ui" }
```

Response:

```json
{ "type": "SessionCreated", "session_id": "..." }
```

Apply an operator:

```json
{ "cmd": "ApplyOperator", "session_id": "<id>", "operator": "ST", "params": {} }
```

Response shape:

```json
{ "type": "State.Snapshot", "session_id": "<id>", "state": { "...": "..." } }
```

See `brain/src/brain/relay/ws_server.py` for the authoritative protocol behavior.

---

## Documentation policy (required)

All documentation is canonical under `docs/`. If behavior changes, documentation must be updated in the same change set.

---

## License

MIT
