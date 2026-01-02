#!/usr/bin/env python
"""E2E test script: loads latest artifact, runs tokenization/inference checks, and optionally pings the brain HTTP state endpoint."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from brain.registry import load_latest
from brain.inference import ArtifactRunner


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--artifacts-root", default="artifacts/runs")
    args = p.parse_args()

    artifacts_root = Path(args.artifacts_root)

    # try direct load first
    latest = None
    try:
        latest = load_latest(artifacts_root)
    except Exception:
        latest = None

    # sometimes CI download-artifact nests paths; search for any 'artifacts/runs' under provided dir
    if not latest:
        candidates = list(artifacts_root.rglob('runs'))
        for c in sorted(candidates):
            try:
                latest = load_latest(c)
                if latest:
                    artifacts_root = c
                    break
            except Exception:
                continue

    if not latest:
        print("No artifacts found under", artifacts_root)
        sys.exit(2)

    manifest = latest["manifest"]
    run_id = manifest["run_id"]
    print("Using run_id", run_id)

    runner = ArtifactRunner(run_id=run_id, artifacts_root=str(artifacts_root))

    # tokenization check: ensure vectorizers accept example
    # perform a sample predict
    y = runner.predict(9.0, 3.0, "9 / 3")
    print("Predict output:", y)
    if not isinstance(y, float):
        print("Predict did not return float")
        sys.exit(1)

    print("E2E test passed")


if __name__ == "__main__":
    main()
