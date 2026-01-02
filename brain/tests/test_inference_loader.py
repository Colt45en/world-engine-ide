import pytest

try:
    import importlib
    importlib.import_module("tensorflow")
except Exception:
    pytest.skip("TensorFlow not available; skipping inference loader tests", allow_module_level=True)

from pathlib import Path
from brain.registry import load_model_and_tokenizers, create_run_id, save_tokenizer_assets, save_model_assets, build_manifest, write_manifest
from brain.surrogate_token_model import train_from_logs_routed


def test_load_model_and_tokenizers(tmp_path):
    logs = tmp_path / "logs.json"
    rows = [{"op": "safeDiv", "args": [10, 2], "res": {"ok": True, "value": 5.0}, "text": "10 / 2"}]
    logs.write_text(__import__('json').dumps(rows))

    artifacts_root = tmp_path / "artifacts" / "runs"
    artifacts_root.mkdir(parents=True)

    model, (eng, math, phys) = train_from_logs_routed(str(logs), op_filter="safeDiv", expand_derived=True)

    run_id = create_run_id()
    run_dir = artifacts_root / run_id
    run_dir.mkdir(parents=True)

    tok_meta = save_tokenizer_assets(eng, math, phys, run_dir)
    model_meta = save_model_assets(model, run_dir, save_format="saved_model")
    training_meta = {"dataset": logs.name, "epochs": 1}

    manifest = build_manifest(run_id=run_id, artifacts_root=artifacts_root, tokenizer_meta={
        "version": 1,
        "domains": ["english","math","physics"],
        "vocab_files": tok_meta.get("files", {}),
        "config_file": tok_meta.get("config_file"),
        "hashes": tok_meta.get("hashes", {})
    }, model_meta=model_meta, training_meta=training_meta)

    write_manifest(manifest, run_dir)

    res = load_model_and_tokenizers(run_id=run_id, artifacts_root=artifacts_root)
    assert res.get("model") is not None
    assert res.get("english_vectorizer") is not None
    # run a predict call
    model = res["model"]
    y = model.predict({"args": [[9.0, 3.0]], "english_text": [""], "math_text": ["9 / 3"], "physics_text": [""]})
    assert y.shape[0] == 1
