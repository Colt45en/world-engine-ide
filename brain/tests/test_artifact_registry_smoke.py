import pytest
import json
import tempfile
import os
from pathlib import Path

try:
    import importlib
    importlib.import_module("tensorflow")
except Exception:
    pytest.skip("TensorFlow not available; skipping TF-dependent artifact tests", allow_module_level=True)

from brain.surrogate_token_model import train_from_logs_routed, predict_routed
from brain.registry import load_latest, load_by_run_id, verify_manifest_hashes


def test_artifact_registry_smoke(tmp_path):
    logs_path = tmp_path / "logs.json"
    rows = []
    for a, b in [(10, 2), (9, 3)]:
        rows.append({"op": "safeDiv", "args": [a, b], "res": {"ok": True, "value": a / b}, "text": f"{a} / {b}"})
    with open(logs_path, "w") as f:
        json.dump(rows, f)

    artifacts_root = tmp_path / "artifacts" / "runs"
    artifacts_root.mkdir(parents=True)

    # Train and export artifacts using the CLI module
    from brain.scripts.train_tokenized_surrogate import main as train_main

    # run training by invoking train_main with args via environment simulation
    # simpler: call train_from_logs_routed directly and then use registry functions
    model, (eng, math, phys) = train_from_logs_routed(str(logs_path), op_filter="safeDiv", expand_derived=True)

    from brain.registry import create_run_id, save_tokenizer_assets, save_model_assets, write_manifest, build_manifest

    run_id = create_run_id()
    run_dir = artifacts_root / run_id
    run_dir.mkdir(parents=True)

    tok_meta = save_tokenizer_assets(eng, math, phys, run_dir)
    model_meta = save_model_assets(model, run_dir, save_format="saved_model")
    training_meta = {"dataset": logs_path.name, "epochs": 1}

    manifest = build_manifest(run_id=run_id, artifacts_root=artifacts_root, tokenizer_meta={
        "version": 1,
        "domains": ["english","math","physics"],
        "vocab_files": tok_meta.get("files", {}),
        "config_file": tok_meta.get("config_file"),
        "hashes": tok_meta.get("hashes", {})
    }, model_meta=model_meta, training_meta=training_meta)

    write_manifest(manifest, run_dir)

    # load_latest should find it
    loaded = load_latest(artifacts_root)
    assert loaded and loaded["manifest"]["run_id"] == run_id

    ok, errs = verify_manifest_hashes(manifest, artifacts_root)
    assert ok, errs

    # Try a forward pass using loaded model
    import tensorflow as tf
    loaded_model = tf.keras.models.load_model(str(run_dir / model_meta["path"]))
    y = loaded_model.predict({"args": [[9.0, 3.0]], "english_text": [""], "math_text": ["9 / 3"], "physics_text": [""]})
    assert y.shape[0] == 1
