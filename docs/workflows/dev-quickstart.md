# Dev Quickstart

## Prerequisites

- Node.js (LTS)
- Python 3 (for optional tooling and `serve:dist`)

## Install

```bash
npm install
```

## Run (frontend)

### Option A: Vite dev server (recommended)

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:5173/`).

### Option B: Production build + Python server (manual open, SPA fallback)

This is useful when you want a simple “just serve what’s built” server and manually open it in a browser.

```bash
npm run build
npm run serve:dist
```

Then open `http://127.0.0.1:4173/`.

Notes:

- Deep links work (unknown paths fall back to `index.html`).
- Missing asset requests (e.g. a missing `.js`) return 404 (no silent fallback).

### Option C: Full server (dist + Brain relay)

```bash
npm run build
npm run server:full
```

Open:

- `http://127.0.0.1:4173/` (UI)
- If you want Brain-backed features, open once with `?brainRelayUrl=ws://127.0.0.1:9001`

## Run (legacy static server)

Optional. Serves `public/` via Express.

```bash
npm start
```

## Optional: Run (Brain WebSocket relay)

Only needed for Brain-backed features.

Windows PowerShell:

```powershell
$Env:PYTHONPATH = "brain/src";
$Env:RELAY_PORT = "9001";
.\.venv\Scripts\python.exe -m brain.relay.ws_server
```

To point the UI at the relay, set `VITE_BRAIN_RELAY_URL`.

Runtime fallback (no rebuild):

- Open the app once with `?brainRelayUrl=ws://127.0.0.1:9001` (this is persisted to localStorage).
- After that, the UI will attempt to connect automatically when loaded.

Port note:

- If `9000` is already in use on your machine (common when Docker Desktop is running), use `RELAY_PORT=9001` (or any free port) and point `brainRelayUrl` at that.

## Common issues

### Vite restart disconnects (ERR_CONNECTION_REFUSED / RESET)

If you press `r` in the Vite terminal, Vite will restart the dev server. During the restart window the browser may briefly show connection errors. Wait until the terminal reports the server is ready, then refresh (Ctrl+R / Ctrl+Shift+R).

### Dist server says `index.html not found`

Run `npm run build` first. The Python server only serves the production build output in `dist/`.
