# Brain — Phase 1 Backend

This folder contains the Phase 1 Python backend logic (replacement for `tier4_nucleus`).

Quick start:

1. Create environment: `python -m venv .venv && .venv\Scripts\activate` (Windows)
2. Install dev deps: `pip install -r brain/requirements.txt`
3. Run tests: `pytest -q brain/tests`
4. Run the relay server: `python -m brain.relay.ws_server` (use `PYTHONPATH=brain/src` if needed)

Agent guidelines:

## Design notes

- [Symbolic Thermodynamic AI Framework (design draft)](docs/symbolic-thermodynamic-ai-framework.md)

What's included:

- IR models (`brain.ir.models`) and JSONL serializer
- Operators and sample operators (`ST`, `CH`)
- Containment engine with session lifecycle and audit trail
- Covenant engine with minimal gating + safety ledger
- WebSocket relay serving `ws://localhost:9000`
- RenderTreeIR helpers
- Basic unit tests
