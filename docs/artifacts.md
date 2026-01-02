# Artifacts (tokenizers & models)

This document explains the artifact layout and how to export / load model + tokenizers.

## Layout

Artifacts are stored under `artifacts/runs/{run_id}/` with the following structure:

```
artifacts/
  runs/
    {run_id}/
      manifest.json
      tokenizer/
        english_vocab.txt
        math_vocab.txt
        physics_vocab.txt
        tokenizer_config.json
      model/
        saved_model/   # TF SavedModel directory
      logs/
        train_metrics.json
        train_args.json
```

### run_id format

`ISO8601Z_<gitsha8>` (e.g., `2025-12-30T19-55-12Z_ab12cd34`).

## Manifest

`manifest.json` is written by the training CLI and includes: git sha, environment info, tokenizer files and their hashes, model path and hashes, and training metadata.

## Loading artifacts

Use the registry helper `load_model_and_tokenizers(run_id)` to load a model and vectorizers in one call. Pass `run_id='latest'` to load the most recent run.

Example:

```py
from brain.registry import load_model_and_tokenizers
res = load_model_and_tokenizers('latest')
model = res['model']
eng = res['english_vectorizer']
math = res['math_vectorizer']
phys = res['physics_vectorizer']

# Convenience runner
from brain.inference import ArtifactRunner
runner = ArtifactRunner(run_id='latest')
runner.predict(9.0, 3.0, '9 / 3')
```

If manifest hashes do not match the files on disk, `verify_manifest_hashes()` can be used to detect corruption.

## CI notes

The `tf-smoke` CI job can run the training and export artifacts in a reproducible environment (TF Docker image). Consider uploading produced artifacts as build artifacts if you want to retain them across CI runs.
