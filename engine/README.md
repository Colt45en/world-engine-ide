# Geometry backend skeleton (WASM + native addon)

This folder is an **isolated** minimal skeleton for a dual-backend geometry implementation:

- **Browser**: WebAssembly backend (placeholder loader contract)
- **Node/editor**: **node-gyp** native addon using **C N-API** (no `node-addon-api` dependency)
- **One JS/TS API**: `engine/src/geometries/*` remains JS/TS-only

## Node addon build

From `engine/`:

- Install dev deps: `npm install`
- Build addon: `npm run native:build`

Expected output:

- `engine/native/build/Release/geometry.node`

## TypeScript build

From `engine/`:

- `npm run build`

## WASM build (placeholder)

`engine/src/platform/backend.browser.ts` expects a loader:

- `engine/wasm/geometry_wasm.js` exporting `initWasm()`

Replace the placeholder `engine/wasm/geometry_wasm.js` with your Emscripten-generated loader or an adapter.
