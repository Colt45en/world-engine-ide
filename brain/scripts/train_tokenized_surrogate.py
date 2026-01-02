#!/usr/bin/env python
"""Training CLI for tokenized surrogate model with artifact export support."""
import argparse
import json
import os
from pathlib import Path
import shutil

from brain.surrogate_token_model import train_from_logs_routed, build_vectorizers
from brain.registry import (
    create_run_id,
    save_tokenizer_assets,
    save_model_assets,
    write_manifest,
    build_manifest,
)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--logs", required=True, help="Path to JSON logs file")
    p.add_argument("--artifacts-root", default="artifacts/runs", help="Artifacts root folder")
    p.add_argument("--op", default="safeDiv", help="Op filter to train on")
    p.add_argument("--expand-derived", action="store_true", help="Expand derived units like N -> kg m s^-2")
    p.add_argument("--run-id", default=None, help="Optional run_id override")
    p.add_argument("--save-format", default="saved_model", choices=["saved_model", "keras"], help="Format to save model")
    p.add_argument("--epochs", type=int, default=10, help="Training epochs (for quick runs)")
    args = p.parse_args()

    artifacts_root = Path(args.artifacts_root)
    artifacts_root.mkdir(parents=True, exist_ok=True)

    run_id = args.run_id or create_run_id()
    run_dir = artifacts_root / run_id
    if run_dir.exists():
        print("Run dir exists, removing and re-creating")
        shutil.rmtree(run_dir)
    run_dir.mkdir(parents=True)

    print("Training model...")
    # train with provided logs; allow surrogate function to control epochs via code if needed
    model, (eng_vec, math_vec, phys_vec) = train_from_logs_routed(args.logs, op_filter=args.op, expand_derived=args.expand_derived)

    # Save tokenizer assets
    tok_meta = save_tokenizer_assets(eng_vec, math_vec, phys_vec, run_dir)

    # Save model
    model_meta = save_model_assets(model, run_dir, save_format=args.save_format)

    # Training metadata - simplistic capture
    training_meta = {"dataset": os.path.basename(args.logs), "epochs": args.epochs, "notes": "trained via train_tokenized_surrogate"}

    manifest = build_manifest(run_id=run_id, artifacts_root=artifacts_root, tokenizer_meta={
        "version": 1,
        "domains": ["english","math","physics"],
        "vocab_files": tok_meta.get("files", {}),
        "config_file": tok_meta.get("config_file"),
        "hashes": tok_meta.get("hashes", {})
    }, model_meta=model_meta, training_meta=training_meta)

    write_manifest(manifest, run_dir)
    # update top-level registry index for fast lookups
    try:
        from brain.registry import update_registry_index

        update_registry_index(manifest, artifacts_root=artifacts_root)
    except Exception:
        pass

    print("Exported artifacts to", run_dir)
    print("Manifest written:", run_dir / "manifest.json")

if __name__ == "__main__":
    main()

if __name__ == "__main__":
    main()
