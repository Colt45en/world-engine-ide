"""Artifact registry helpers for tokenizers and models.

Provides functions to create run_ids, save tokenizers and models to an artifacts folder,
write manifest files, compute hashes, and load artifacts for inference.
"""
from __future__ import annotations

import hashlib
import json
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple


DEFAULT_ARTIFACTS_ROOT = Path("artifacts/runs")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def _git_sha_short() -> Tuple[str, bool]:
    try:
        sha = subprocess.check_output(["git", "rev-parse", "--short=8", "HEAD"]).decode().strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"]).decode().strip())
        return sha, dirty
    except Exception:
        return "nogit", False


def create_run_id() -> str:
    ts = _utc_now_iso()
    sha, _ = _git_sha_short()
    return f"{ts}_{sha}"


def hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def hash_tree(dirpath: Path) -> Dict[str, str]:
    """Returns a dict mapping relative file path -> sha256 hash for all files under dirpath."""
    out: Dict[str, str] = {}
    base = dirpath.resolve()
    for p in sorted(base.rglob("*")):
        if p.is_file():
            rel = str(p.relative_to(base))
            out[rel] = hash_file(p)
    return out


def write_manifest(manifest: dict, out_dir: Path) -> None:
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "manifest.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def save_tokenizer_assets(
    eng_vec, math_vec, phys_vec, out_dir: Path, config: Optional[dict] = None
) -> dict:
    """Save vocab files and tokenizer config to out_dir/tokenizer and return a mapping for manifest."""
    tok_dir = out_dir / "tokenizer"
    tok_dir.mkdir(parents=True, exist_ok=True)

    def _write_vocab(layer, fname: Path):
        vocab = []
        try:
            vocab = list(layer.get_vocabulary())
        except Exception:
            # best effort: try to access 'vocabulary' property
            vocab = getattr(layer, "vocabulary", [])
        with fname.open("w", encoding="utf-8") as f:
            for w in vocab:
                f.write(w + "\n")
        return fname.name

    eng_name = _write_vocab(eng_vec, tok_dir / "english_vocab.txt")
    math_name = _write_vocab(math_vec, tok_dir / "math_vocab.txt")
    phys_name = _write_vocab(phys_vec, tok_dir / "physics_vocab.txt")

    # write a basic tokenizer_config.json with some useful metadata
    cfg_meta = {
        "version": 1,
        "domains": ["english", "math", "physics"],
        "vocab_files": {"english": eng_name, "math": math_name, "physics": phys_name},
    }
    if config:
        # allow callers to include extra metadata without breaking schema
        cfg_meta["meta"] = config
    cfg_path = tok_dir / "tokenizer_config.json"
    with cfg_path.open("w", encoding="utf-8") as f:
        json.dump(cfg_meta, f, indent=2)

    # compute hashes
    hashes = {
        eng_name: hash_file(tok_dir / eng_name),
        math_name: hash_file(tok_dir / math_name),
        phys_name: hash_file(tok_dir / phys_name),
        "tokenizer_config.json": hash_file(cfg_path),
    }

    vocab_files = {"english": eng_name, "math": math_name, "physics": phys_name}

    return {
        "dir": str(tok_dir),
        "config_file": "tokenizer/tokenizer_config.json",
        "vocab_files": vocab_files,
        "hashes": hashes,
    }


def save_model_assets(model, out_dir: Path, save_format: str = "saved_model") -> dict:
    """Save model to out_dir/model using desired format and return model manifest info.

    save_format: 'saved_model' or 'keras'
    """
    model_dir = out_dir / "model"
    model_dir.mkdir(parents=True, exist_ok=True)

    if save_format == "saved_model":
        target = model_dir / "saved_model"
        # Keras will create directory
        model.save(str(target))
        hashes = hash_tree(target)
        return {"format": "saved_model", "path": "model/saved_model", "hashes": hashes}
    else:
        # save as single-file Keras format (.keras)
        target_file = model_dir / "keras.keras"
        model.save(str(target_file))
        return {"format": "keras", "path": "model/keras.keras", "hashes": {"keras.keras": hash_file(target_file)}}


def load_manifest(run_dir: Path) -> dict:
    mpath = run_dir / "manifest.json"
    with mpath.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_runs(artifacts_root: Path) -> list:
    runs = []
    if not artifacts_root.exists():
        return runs
    for p in artifacts_root.iterdir():
        if p.is_dir():
            runs.append(p.name)
    runs.sort()
    return runs


def load_latest(artifacts_root: Path = DEFAULT_ARTIFACTS_ROOT) -> Optional[dict]:
    runs = list_runs(artifacts_root)
    if not runs:
        return None
    latest = runs[-1]
    return load_by_run_id(latest, artifacts_root)


def load_by_run_id(run_id: str, artifacts_root: Path = DEFAULT_ARTIFACTS_ROOT) -> dict:
    run_dir = artifacts_root / run_id
    if not run_dir.exists():
        raise FileNotFoundError(f"Run {run_id} not found under {artifacts_root}")
    manifest = load_manifest(run_dir)
    return {"manifest": manifest, "path": str(run_dir)}


def _read_vocab_file(path: Path) -> list:
    with path.open("r", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f]


def _build_text_vectorizer_from_vocab(vocab: list, seq_len: int = 64):
    try:
        import tensorflow as tf  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("TensorFlow is required to build TextVectorization but is not available") from e

    layer = tf.keras.layers.TextVectorization(
        max_tokens=len(vocab) + 2,
        output_mode="int",
        output_sequence_length=seq_len,
        standardize=None,
        split="whitespace",
    )
    # set_vocabulary may not exist older/newer TF; use set_vocabulary when available, else adapt
    if hasattr(layer, "set_vocabulary"):
        layer.set_vocabulary(vocab)
    else:
        # adapt on dataset built from vocab
        ds = tf.data.Dataset.from_tensor_slices(vocab).batch(128)
        layer.adapt(ds)
    return layer


def load_model_and_tokenizers(run_id: str = "latest", artifacts_root: Path = DEFAULT_ARTIFACTS_ROOT) -> dict:
    """Load model and tokenizer vectorizers by run_id or 'latest'.

    Returns a dict: {
      'manifest': manifest,
      'run_dir': Path,
      'model': tf.keras.Model,
      'english_vectorizer': TextVectorization,
      'math_vectorizer': TextVectorization,
      'physics_vectorizer': TextVectorization,
    }

    Raises FileNotFoundError if artifacts missing, or RuntimeError if TF missing.
    """
    if run_id == "latest":
        latest = load_latest(artifacts_root)
        if not latest:
            raise FileNotFoundError("No runs available in artifacts root")
        manifest = latest["manifest"]
        run_dir = Path(latest["path"])
    else:
        loaded = load_by_run_id(run_id, artifacts_root)
        manifest = loaded["manifest"]
        run_dir = Path(loaded["path"])

    # verify files exist (basic check)
    tok_meta = manifest.get("tokenizer", {})
    tok_dir = run_dir / "tokenizer"
    # Back-compat: older manifests used "files" instead of "vocab_files".
    vocab_files = tok_meta.get("vocab_files") or tok_meta.get("files") or {}
    eng_file = tok_dir / vocab_files.get("english", "english_vocab.txt")
    math_file = tok_dir / vocab_files.get("math", "math_vocab.txt")
    phys_file = tok_dir / vocab_files.get("physics", "physics_vocab.txt")

    if not eng_file.exists() or not math_file.exists() or not phys_file.exists():
        raise FileNotFoundError("One or more tokenizer vocab files are missing for run_id=" + manifest.get("run_id", ""))

    try:
        import tensorflow as tf  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("TensorFlow is required to load model and tokenizers") from e

    # load model
    model_path = run_dir / manifest.get("model", {}).get("path", "model/saved_model")
    if not model_path.exists():
        raise FileNotFoundError(f"Model path {model_path} not found for run {manifest.get('run_id')}")
    model = tf.keras.models.load_model(str(model_path))

    # load vocabs and build vectorizers
    eng_vocab = _read_vocab_file(eng_file)
    math_vocab = _read_vocab_file(math_file)
    phys_vocab = _read_vocab_file(phys_file)

    eng_vec = _build_text_vectorizer_from_vocab(eng_vocab)
    math_vec = _build_text_vectorizer_from_vocab(math_vocab)
    phys_vec = _build_text_vectorizer_from_vocab(phys_vocab)

    return {
        "manifest": manifest,
        "run_dir": str(run_dir),
        "model": model,
        "english_vectorizer": eng_vec,
        "math_vectorizer": math_vec,
        "physics_vectorizer": phys_vec,
    }


def _verify_tokenizer_hashes(run_dir: Path, manifest: dict) -> list:
    errors = []
    tok = manifest.get("tokenizer", {})
    tok_dir = run_dir / "tokenizer"

    for fname, expected in tok.get("hashes", {}).items():
        p = tok_dir / fname
        if not p.exists():
            errors.append(f"Missing file: tokenizer/{fname}")
            continue
        h = hash_file(p)
        if h != expected:
            errors.append(f"Hash mismatch for tokenizer/{fname}: {h} != {expected}")

    return errors


def _verify_model_hashes(run_dir: Path, manifest: dict) -> list:
    errors = []
    model = manifest.get("model", {})
    model_format = model.get("format")
    model_rel_path = model.get("path", "model")
    model_path = run_dir / model_rel_path

    if model_format == "saved_model":
        expected_tree = model.get("hashes", {})
        actual_tree = hash_tree(model_path)
        for rel, expected in expected_tree.items():
            actual = actual_tree.get(rel)
            if actual is None:
                errors.append(f"Missing model file: {rel}")
            elif actual != expected:
                errors.append(f"Model hash mismatch: {rel}: {actual} != {expected}")
        return errors

    if not model_path.exists():
        errors.append(f"Missing model file: {model_rel_path}")
        return errors

    expected_hashes = model.get("hashes", {})
    expected = next(iter(expected_hashes.values()), None)
    if expected:
        actual = hash_file(model_path)
        if actual != expected:
            errors.append(f"Model hash mismatch: {actual} != {expected}")

    return errors


def verify_manifest_hashes(manifest: dict, artifacts_root: Path = DEFAULT_ARTIFACTS_ROOT) -> Tuple[bool, list]:
    """Verify that all listed hashes in manifest are correct. Returns (ok, errors list)."""
    run_dir = artifacts_root / manifest["run_id"]
    errors = []
    errors.extend(_verify_tokenizer_hashes(run_dir, manifest))
    errors.extend(_verify_model_hashes(run_dir, manifest))
    return (len(errors) == 0, errors)


def build_manifest(
    run_id: str,
    tokenizer_meta: dict,
    model_meta: dict,
    training_meta: dict,
) -> dict:
    sha, dirty = _git_sha_short()
    m = {
        "schema_version": 1,
        "run_id": run_id,
        "created_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "git": {"sha": sha, "dirty": dirty},
        "environment": {
            "python": platform.python_version(),
            "tensorflow": None,
            "platform": platform.platform(),
        },
        "tokenizer": tokenizer_meta,
        "model": model_meta,
        "training": training_meta,
    }
    # attempt to detect TF version if available
    try:
        import tensorflow as tf  # type: ignore[import-not-found]

        m["environment"]["tensorflow"] = tf.__version__
    except Exception:
        m["environment"]["tensorflow"] = None

    return m


def update_registry_index(manifest: dict, artifacts_root: Path = DEFAULT_ARTIFACTS_ROOT) -> None:
    """Append or update a top-level registry.json with summary entries for fast lookup."""
    idx_path = (artifacts_root.parent / "registry.json").resolve()
    data = {}
    try:
        if idx_path.exists():
            with idx_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
    except Exception:
        data = {}

    key = manifest["run_id"]
    data[key] = {
        "run_id": manifest["run_id"],
        "created_utc": manifest["created_utc"],
        "git": manifest.get("git", {}),
        "training": manifest.get("training", {}),
        "tokenizer": manifest.get("tokenizer", {}),
        "model": manifest.get("model", {}),
    }
    idx_path.parent.mkdir(parents=True, exist_ok=True)
    with idx_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
