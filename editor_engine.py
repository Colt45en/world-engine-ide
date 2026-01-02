"""
editor_engine.py
Deterministic patch generation + application.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class PatchResult:
    ok: bool
    diff: str
    new_text: str | None
    error: str | None


class EditorEngine:
    def __init__(self) -> None:
        pass

    def generate_unified_diff(self, old_text: str, new_text: str, fromfile: str = "a/code.py", tofile: str = "b/code.py") -> str:
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)
        diff_lines = list(
            difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile=fromfile,
                tofile=tofile,
                lineterm="",
            )
        )
        if not diff_lines:
            return ""
        return "\n".join(diff_lines) + "\n"

    def apply_unified_diff(self, old_text: str, diff_text: str) -> PatchResult:
        if not diff_text.strip():
            return PatchResult(ok=True, diff=diff_text, new_text=old_text, error=None)

        old_lines = old_text.splitlines(keepends=True)

        lines = diff_text.splitlines()
        idx = 0
        if idx < len(lines) and lines[idx].startswith("--- "):
            idx += 1
        if idx < len(lines) and lines[idx].startswith("+++ "):
            idx += 1

        hunk_re = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
        out: List[str] = []
        old_pos = 0

        while idx < len(lines):
            m = hunk_re.match(lines[idx])
            if not m:
                return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Invalid diff hunk header at line: {lines[idx]!r}")

            old_start = int(m.group(1))
            old_count = int(m.group(2) or "1")
            new_start = int(m.group(3))
            new_count = int(m.group(4) or "1")
            idx += 1

            target_old_index = old_start - 1
            if target_old_index < old_pos:
                return PatchResult(ok=False, diff=diff_text, new_text=None, error="Overlapping or out-of-order hunks.")

            out.extend(old_lines[old_pos:target_old_index])
            old_pos = target_old_index

            consumed_old = 0
            produced_new = 0

            while idx < len(lines) and not lines[idx].startswith("@@ "):
                line = lines[idx]
                if line.startswith("\\ No newline at end of file"):
                    idx += 1
                    continue

                if not line:
                    return PatchResult(ok=False, diff=diff_text, new_text=None, error="Malformed diff line (empty).")

                prefix = line[0]
                content = line[1:] + "\n"

                if prefix == " ":
                    if old_pos >= len(old_lines) or old_lines[old_pos] != content:
                        got = old_lines[old_pos] if old_pos < len(old_lines) else None
                        return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Context mismatch. Expected {content!r}, got {got!r}.")
                    out.append(content)
                    old_pos += 1
                    consumed_old += 1
                    produced_new += 1
                elif prefix == "-":
                    if old_pos >= len(old_lines) or old_lines[old_pos] != content:
                        got = old_lines[old_pos] if old_pos < len(old_lines) else None
                        return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Removal mismatch. Expected {content!r}, got {got!r}.")
                    old_pos += 1
                    consumed_old += 1
                elif prefix == "+":
                    out.append(content)
                    produced_new += 1
                else:
                    return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Unknown diff prefix {prefix!r} in line {line!r}.")

                idx += 1

            if old_count != consumed_old:
                return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Hunk old line count mismatch: header {old_count}, consumed {consumed_old}.")
            if new_count != produced_new:
                return PatchResult(ok=False, diff=diff_text, new_text=None, error=f"Hunk new line count mismatch: header {new_count}, produced {produced_new}.")

        out.extend(old_lines[old_pos:])

        new_text = "".join(out)
        return PatchResult(ok=True, diff=diff_text, new_text=new_text, error=None)
