# Frontend UI

## Scope

This document describes the World Engine IDE frontend runtime, with an emphasis on routing, load-time performance, and the boundaries between “first paint” code and feature code.

## Routing (react-router-dom v5)

Routing is defined in `src/app.jsx` using `react-router-dom` v5 `Switch` + `Route`.

### Brain connectivity

The UI includes a `<BrainConnectionProvider>` so features can use `useBrainConnection()`.

- Brain connectivity is optional for navigation.
- The header shows Brain status (`connected` / `connecting` / `disconnected`).

### Route-based chunking

Non-home routes MUST be lazy loaded via `React.lazy` so they do not inflate the initial bundle.

- The home route (`/`) keeps the landing page eagerly imported for fastest first paint.
- Feature routes (dashboard/studio/tools) are `lazy(() => import(...))` and load only when navigated to.

## Pages

The landing page is `src/pages/Nexus.jsx`.

Lazy-loaded feature route modules are referenced from `src/app.jsx` (see imports near the top of the file).

## Overlays and editor panels

Feature modules SHOULD place heavy dependencies behind a lazy boundary at the feature edge (e.g., Three.js / R3F, editors, inspectors).

## State management

TODO

## Error handling

TODO

## Testing

TODO

## Build chunking (Vite)

Vite (Rollup) chunking is controlled in `vite.config.js` using `build.rollupOptions.output.manualChunks`.

### Vendor chunk policy

The config intentionally creates stable vendor chunks to improve caching across app changes:

- `react`: React + React DOM + `scheduler`
- `router`: `react-router*` and `history`
- `three`, `r3f`, `drei`: Three ecosystem chunks
- `vendor`: everything else in `node_modules/`

## Prefetching (runtime)

After the Brain connection becomes `connected`, the app prefetches common routes on idle (via `BrainPrefetch` in `src/app.jsx`). This improves perceived navigation performance without forcing those modules into the initial bundle.

## Changelog

- 2026-01-02: Added route-based chunking, stable vendor chunk splitting, and Brain-connected idle prefetching.
