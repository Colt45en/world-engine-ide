# Copilot / AI Agent Instructions — Documentation‑First + Synchronization Contract (Generalized Edition)

## Mission

You are assisting in the development of a complex, multi‑module system that includes:

- editing workflows
- streaming workflows
- environment and mathematical systems
- physics and simulation
- real‑time rendering and tooling
- multi‑page UI and overlay systems

Your responsibility is to implement features AND maintain complete, synchronized documentation for every system, process, and workflow.

Documentation accuracy is not optional — it is part of the definition of “done.”

## Canonical Documentation Policy (Single Source of Truth)

### Canonical Documentation Folder

All documentation MUST live in a single, authoritative folder:

- docs/ (canonical source of truth)

No other location is considered primary unless explicitly generated from this folder.

### Required Documentation Index

Maintain a top‑level index inside the canonical documentation folder that:

- provides an overview of the entire system
- links to every subsystem document
- remains accurate at all times

## Documentation Requirements (Create + Update Automatically)

### “Documentation is a Build Artifact”

For every new system, process, or workflow you implement, you MUST:

- Create a corresponding documentation file in the canonical docs folder.
- Update that documentation whenever any of the following change:
  - behavior
  - APIs
  - configuration
  - protocol messages
  - UI flows
  - assumptions or invariants
  - data models or serialization
  - system boundaries or responsibilities

### What Counts as a System or Process

Documentation is required for:

- new subsystems
- new API endpoints or protocol messages
- new operators, macros, or pipeline stages
- new UI modules or pages
- new file formats or IR models
- new workflows, scripts, or commands
- new integration points or external tool connections

### Mandatory Sections for Every Subsystem Document

Each subsystem document MUST include:

- Purpose / Scope
- Architecture (components + boundaries)
- Data Model / IR (schemas + invariants)
- Control Flow (text‑based sequence diagrams acceptable)
- Interfaces (frontend, backend, protocol, etc.)
- State & Determinism Rules
- Error Handling & Recovery
- Testing Strategy
- Operational Notes (runtime expectations, environment variables, etc.)
- Changelog (brief, appended entries)

## Documentation Layout Standard (Generalized Structure)

Use a clean, predictable structure such as:

- docs/README — system overview + navigation
- docs/architecture/ — high‑level diagrams, module boundaries, repo map
- docs/systems/ — subsystem‑specific documentation
- docs/workflows/ — developer workflows, testing, build/release processes
- docs/reference/ — glossary, decision records, terminology

If a document already exists, update it instead of creating duplicates.

## Synchronization Rules (Mirrors, Overlays, Multi‑Location Rendering)

### Single Source of Truth for Duplicated Logic or Rendering

If a feature or content appears in more than one location:

- Only one implementation may be canonical.
- All other instances MUST be:
  - thin wrappers
  - renderers
  - adapters
  - or generated from the canonical source

### When Editing Any File With Mirrors

Whenever modifying a file that has mirrored or duplicated logic:

- Identify all mirror locations.
- Update them in the same change set.
- Update documentation to record:
  - what changed
  - where the canonical source lives
  - what is generated vs. handwritten
  - how to validate consistency

### No Divergence Rule

If mirrors cannot be kept synchronized:

- extract shared logic
- consolidate rendering paths
- unify adapters
- remove duplicated static logic

## Documentation Triggers (Hard Requirements)

You MUST update documentation when any of the following occur:

- new or changed routes
- new or changed protocol messages
- changes to data models or serialization
- changes to operators, macros, or scoring logic
- changes to state‑transition pipelines
- changes to rendering or mapping rules
- changes to ports, scripts, commands, or workflows
- changes affecting determinism or test expectations
- changes to legacy or transitional systems

## Output Standard for All Agent Work

Every change you produce MUST include:

- What changed
- Why it changed
- Which documentation was updated (with a short summary)
- How to verify the change

A change is not complete until the documentation update is included.

## Testing & Verification Obligations

For backend, frontend, protocol, or workflow changes:

- run and update tests
- ensure determinism where required
- verify UI behavior in development mode
- ensure protocol examples remain accurate
- confirm that documentation reflects real system behavior

## Documentation Style Requirements

- Write as if a new engineer must operate the system with zero tribal knowledge.
- Prefer explicit paths, examples, invariants, and message formats.
- Use MUST/SHALL for invariants; MAY for optional behavior.
- Keep documents concise but complete.
- Ensure the documentation index links to everything.

## “If Structure Is Missing, You Must Create It”

If a subsystem is planned but not yet implemented, create a documentation stub containing:

- scope
- expected interfaces
- invariants
- TODO list

This prevents undocumented “dark corners.”

## Final Enforcement Rule

Code and documentation must never drift.

If behavior changes, documentation MUST be updated in the same work unit.

## Optional: Documentation Consistency Checklist

Maintain a simple checklist in the testing workflow that includes:

- “Documentation updated?”

This reinforces the standard for all contributors.
