import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


def log_patch(patch_meta: Dict[str, Any], patch_text: str, file_path: Optional[str] = None) -> Dict[str, Any]:
    """Append a patch record to a JSONL file. Returns the record written."""
    if not file_path:
        # default to repository root patches.jsonl
        repo_root = Path(__file__).resolve().parents[3]
        file_path = str(repo_root / "patches.jsonl")

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "meta": patch_meta,
        "patch": patch_text,
    }

    p = Path(file_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return record
