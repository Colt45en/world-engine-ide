# Usage

1. Start the server:

```bash
python main.py
```

2. Open the UI in your browser:

- Training UI: `http://127.0.0.1:8000` (serves `interface.html`)
- Patch demo: `http://127.0.0.1:8000/brain_ide_demo.html`

3. Submit training samples via the UI (`/submit`) to increase proficiency and unlock capabilities.

4. Generate/apply patches using the Patch Demo UI (`/edit`). Patch operations are gated; if a requested action is locked, the server returns HTTP 403 and does NOT run code evaluation or apply the patch.

Testing:

- Unit tests: `python -m unittest tests.test_editor_engine tests.test_learning_model_gating -v`
- Integration tests (attempt to contact a running server): `python -m unittest tests.test_integration_server -v` (will skip if the server is not running).

## World Engine IDE (Vite UI)

For the full IDE UI (Vite + Brain + Relay), follow the deterministic boot guide in [dev-start.md](dev-start.md).

Key routes in the IDE UI:

- Studio Dashboard: `http://localhost:5173/dashboard`
