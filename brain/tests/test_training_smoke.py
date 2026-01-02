import pytest
import tempfile
import json
import numpy as np

# Skip this module if TensorFlow is not importable
try:
    import importlib
    importlib.import_module("tensorflow")
except Exception:
    pytest.skip("TensorFlow not available; skipping TF-dependent tests", allow_module_level=True)

from brain.surrogate_token_model import train_from_logs_routed, predict_routed


def make_sample_logs(path):
    rows = []
    for a, b in [(10, 2), (3, 5), (6, 3), (7, 1), (0.5, 0.2)]:
        rows.append({"op": "safeDiv", "args": [a, b], "res": {"ok": True, "value": a / b}, "text": f"{a} / {b}"})
    with open(path, "w") as f:
        json.dump(rows, f)


def test_training_and_predict(tmp_path):
    p = tmp_path / "logs.json"
    make_sample_logs(p)
    model, _ = train_from_logs_routed(str(p), op_filter="safeDiv", expand_derived=True)
    y = predict_routed(model, 9.0, 3.0, "9 / 3")
    assert abs(y - 3.0) < 1.0  # loose smoke check
