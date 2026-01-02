"""Inference helper that loads artifacts by run_id and exposes a predict method."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from brain.src.brain.registry import load_model_and_tokenizers


class ArtifactRunner:
    def __init__(self, run_id: str = "latest", artifacts_root: str = "artifacts/runs"):
        res = load_model_and_tokenizers(run_id=run_id, artifacts_root=Path(artifacts_root))
        self.run_id = run_id
        self.manifest = res["manifest"]
        self.run_dir = res["run_dir"]
        self.model = res["model"]
        self.eng_vec = res["english_vectorizer"]
        self.math_vec = res["math_vectorizer"]
        self.phys_vec = res["physics_vectorizer"]

    def predict(self, a: float, b: float, text: str = "") -> float:
        # domain routing similar to surrogate_token_model route_text
        from .tokenizers import route_text, normalize_units_in_physics_text

        eng, mth, phy, mode = route_text(text)
        if phy:
            phy = normalize_units_in_physics_text(phy)

        X = {
            "args": [[a, b]],
            "english_text": [eng],
            "math_text": [mth],
            "physics_text": [phy],
        }
        y = self.model.predict(X, verbose=0)
        return float(y[0][0])
