from brain.data_processor import log_patch
import json


def test_log_patch_writes_file(tmp_path):
    file = tmp_path / "patches.jsonl"
    meta = {"author": "tester", "intent": "python.refactor"}
    patch_text = "---\n+def f(x):\n"
    record = log_patch(meta, patch_text, file_path=str(file))
    assert record["meta"] == meta
    assert record["patch"] == patch_text

    # verify file contains the JSON line
    with file.open("r", encoding="utf-8") as f:
        lines = f.readlines()
    assert len(lines) == 1
    parsed = json.loads(lines[0])
    assert parsed["meta"] == meta
    assert parsed["patch"] == patch_text
