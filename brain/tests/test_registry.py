from __future__ import annotations

from pathlib import Path

import pytest

from brain.registry import (
    DEFAULT_ARTIFACTS_ROOT,
    create_run_id,
    save_tokenizer_assets,
    verify_manifest_hashes,
)


class _FakeVectorizer:
    def __init__(self, vocab: list[str]):
        self._vocab = vocab

    def get_vocabulary(self):
        return list(self._vocab)


def test_create_run_id_has_timestamp_and_sha() -> None:
    run_id = create_run_id()
    # Example: 2025-01-01T00-00-00Z_deadbeef
    assert "T" in run_id
    assert "_" in run_id


def test_save_tokenizer_assets_schema(tmp_path: Path) -> None:
    eng = _FakeVectorizer(["a", "b"])
    math = _FakeVectorizer(["1", "+"])
    phys = _FakeVectorizer(["kg", "m", "s^-2"])

    meta = save_tokenizer_assets(eng, math, phys, tmp_path)

    assert "vocab_files" in meta
    assert set(meta["vocab_files"].keys()) == {"english", "math", "physics"}
    assert (tmp_path / "tokenizer" / meta["vocab_files"]["english"]).exists()
    assert (tmp_path / "tokenizer" / "tokenizer_config.json").exists()


def test_verify_manifest_hashes_tokenizer_only(tmp_path: Path) -> None:
    run_id = "test_run"
    run_dir = tmp_path / run_id

    eng = _FakeVectorizer(["hello"])
    math = _FakeVectorizer(["1"])
    phys = _FakeVectorizer(["kg"])

    tok_meta = save_tokenizer_assets(eng, math, phys, run_dir)

    manifest = {
        "run_id": run_id,
        "tokenizer": tok_meta,
        "model": {"format": "keras", "path": "model/does_not_exist.keras", "hashes": {}},
    }

    ok, errors = verify_manifest_hashes(manifest, artifacts_root=tmp_path)
    assert ok is False
    assert any("Missing model file" in e for e in errors)


@pytest.mark.parametrize("root", [DEFAULT_ARTIFACTS_ROOT])
def test_default_artifacts_root_is_relative(root: Path) -> None:
    # This is intentionally a relative Path so callers can resolve it per-workdir.
    assert not root.is_absolute()
