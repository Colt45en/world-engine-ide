# World Engine IDE — Documentation

This folder is the **single, canonical source of documentation** for the World Engine IDE.

If system behavior, APIs, protocols, or workflows change, the corresponding document in this folder **must be updated in the same change set**. Documentation elsewhere in the repository is non-authoritative.

---

## Architecture

- [`architecture/overview.md`](architecture/overview.md)
  Big-picture system layout, boundaries, and data flow.

- [`architecture/repo-map.md`](architecture/repo-map.md)
  Authoritative map of important directories and files.

---

## Systems

- [`systems/frontend-ui.md`](systems/frontend-ui.md)
  React pages, routing (react-router-dom v5), overlays, and editor panels.

- [`systems/legacy-static.md`](systems/legacy-static.md)
  Legacy static content under `public/` and migration rules.

- [`systems/turtle-stack.md`](systems/turtle-stack.md)
  Language DOM Tree (LDOM) system for visualizing code as multi-layer stack.

- [`systems/ws-relay-protocol.md`](systems/ws-relay-protocol.md)
  WebSocket message schema, commands, events, and compatibility.

- [`systems/brain-ir.md`](systems/brain-ir.md)
  IR models, serialization, and determinism rules.

- [`systems/operators.md`](systems/operators.md)
  Operator registry, state transitions, audit entries, and risk scoring.

- [`systems/containment.md`](systems/containment.md)
  Containment engine apply flow, snapshot/delta semantics.

- [`systems/render-pipeline.md`](systems/render-pipeline.md)
  Render schema/IR → UI mapping rules and performance constraints.

---

## Performance

- [`performance-guide.md`](performance-guide.md)
  Performance optimization guide for DOM tree rendering and code visualization.

---

## Workflows

- [`workflows/dev-quickstart.md`](workflows/dev-quickstart.md)
  Setup and local development commands.

- [`workflows/testing.md`](workflows/testing.md)
  Test strategy, commands, and determinism expectations.

- [`workflows/release-and-build.md`](workflows/release-and-build.md)
  Build outputs, preview, and release steps.

---

## Reference

- [`reference/glossary.md`](reference/glossary.md)
  Canonical definitions of project terms.

- [`reference/decisions.md`](reference/decisions.md)
  Architecture Decision Records (short, dated, rationale-first).

---

## Documentation Rules (Enforced)

- **No duplication**: Don't document the same system in multiple places.
- **Docs follow code**: If behavior changes, docs must change.
- **Canonical links only**: Link into `docs/` instead of copying text.
- **Stubs are allowed**: Planned systems must have a stub doc with scope and TODOs.

If a system exists without documentation here, it is considered incomplete.
