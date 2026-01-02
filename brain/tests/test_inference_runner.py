import pytest

try:
    import importlib
    importlib.import_module("tensorflow")
except Exception:
    pytest.skip("TensorFlow not available; skipping inference runner tests", allow_module_level=True)

from pathlib import Path
from brain.surrogate_token_model import train_from_logs_routed
from brain.registry import create_run_id, save_tokenizer_assets, save_model_assets, build_manifest, write_manifest
from brain.inference import ArtifactRunner


def test_artifact_runner_predict(tmp_path):
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

    runner = ArtifactRunner(run_id=run_id, artifacts_root=str(artifacts_root))
    y = runner.predict(9.0, 3.0, "9 / 3")
    assert isinstance(y, float)
