# Components (short docs)

## `main.py`

- Exposes endpoints: `GET /` (UI), `GET /state`, `GET /config/reload`, `POST /submit`, `POST /edit`.
- Enforces capability gating: `POST /submit` is training; `POST /edit` is operational (generate/apply patches) and will 403 when locked.

## `learning_model.py`

- Tokenizes text, predicts intent via keyword_map, scores with per-dimension weights, maintains moving-window proficiency.
- Capability gating maps `requested_action` → required unlock; `evaluate()` returns `ScoreReport` including `allowed`.

## `editor_engine.py`

- Deterministic `generate_unified_diff(old, new)` using `difflib.unified_diff`.
- Strict `apply_unified_diff(old, diff)` that enforces exact context matches and hunk counts.

## `code_evaluator.py`

- AST parse + compile checks, forbidden import detection, dangerous builtin detection.
- Best-effort sandboxed subprocess runner with timeout and optional POSIX resource limits.

## `data_processor.py`

- Uses SQLite to log training `events`, running `progress`, and `patches` (auditable patch log).

Feedback: If you'd like a separate markdown doc per module with examples and more detailed API signatures, I can expand each file into `docs/<module>.md` files.
