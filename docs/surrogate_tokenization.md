# Surrogate Tokenization & Multi-Input Model

This document explains the tokenization, unit normalization, routing, and training helpers added to `brain/`.

## Summary

- Adds domain routing (English / Math / Physics) so each sample populates at most one text branch.
- Adds deterministic regex-based tokenization for math/physics and an English standardizer (TextVectorization friendly).
- Adds a unit normalization + derived-unit expansion (e.g., `N` -> `kg m s^-2`).
- Provides a multi-input surrogate model that combines numeric args with tokenized text branches.

## Files

- `brain/src/brain/tokenizers.py` - domain detection, unit normalization, regex patterns and helpers
- `brain/src/brain/surrogate_token_model.py` - vectorizer builders, model builder, training & predict helpers
- `brain/scripts/train_tokenized_surrogate.py` - simple CLI to train and save a model
- `brain/tests/*` - unit tests and a smoke training test

## Requirements

Recommended TensorFlow version: `tensorflow==2.12.0` (CPU and GPU support). Install into a Python virtualenv before training.

```
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r brain/requirements.txt
```

If TensorFlow is not available, TF-dependent tests are skipped automatically. This allows CI to run fast tests (tokenizer/unit tests) even when TensorFlow is not installed.

## Quick train example

```
python brain/scripts/train_tokenized_surrogate.py --logs brain/data/sample_logs.json --out-dir brain/models --op safeDiv --expand-derived
```

The script saves a Keras model to `brain/models/surrogate_safeDiv`.

## How tests behave

- `brain/tests/test_tokenizers.py` are pure-Python tests and will run on any environment.
- `brain/tests/test_training_smoke.py` requires TensorFlow; it will be skipped if TF cannot be imported.

### CI: TF smoke tests

The project has a dedicated GitHub Actions job `tf-smoke` that runs inside the official `tensorflow/tensorflow:2.12.0` Docker image and executes the TF-dependent smoke test (`brain/tests/test_training_smoke.py`). This ensures the TF training smoke test runs reproducibly in CI even if the runner's Python environment does not have TensorFlow installed locally.

**Status badge (weekly TF smoke):**

![TF smoke](https://github.com/Colt45en/world-engine-ide/actions/workflows/tf-smoke-schedule.yml/badge.svg)

The scheduled job runs weekly (Monday 03:00 UTC) and can be manually triggered via the workflow dispatch UI.

## Running tests locally (diagnostics)

If `pytest` is not available or Python's `typing` module raises errors (some Python dev builds, e.g. Python 3.13, have caused issues), use the diagnostic helper:

```
python scripts/check_python_typing.py
```

This script will tell you whether `typing` and `pytest` import correctly and give actionable instructions to create a virtualenv and install dependencies.

## Notes and future improvements

- Expand derived unit mapping with a larger dictionary and optional canonicalization to SI base units.
- Add tooling to save and load TextVectorization canonical vocab files so you can version and reuse them between runs.
- Consider adding a light-weight Docker environment for reproducible TF CPU installs for CI (useful if you want to run training smoke tests in CI).
