# World Engine IDE - Overview

This repository provides a lightweight, auditable local "Brain" for intent-to-code workflows. Key components:

- `main.py` - Simple stdlib HTTP server exposing UI, /submit and /edit endpoints.
- `learning_model.py` - Deterministic scoring and capability gating (assist / minor_edit / refactor / autonomous).
- `code_evaluator.py` - Static analysis + sandboxed subprocess runner to evaluate code and tests.
- `editor_engine.py` - Deterministic unified-diff generator and strict apply function.
- `data_processor.py` - SQLite-backed event log and patch audit trail.
- `interface.html` / `public/brain_ide_demo.html` - HTML demos for training and patch-based editing.

The system is intentionally dependency-free (stdlib only) so it's easy to run locally and audit.
