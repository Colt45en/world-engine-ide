import difflib
from typing import List


def generate_unified_diff(original: str, candidate: str, fromfile: str = "original", tofile: str = "candidate") -> str:
    orig_lines = original.splitlines(keepends=True)
    cand_lines = candidate.splitlines(keepends=True)
    udiff = list(difflib.unified_diff(orig_lines, cand_lines, fromfile=fromfile, tofile=tofile))
    return "".join(udiff)


def apply_unified_diff(original: str, patch_text: str) -> str:
    if not patch_text:
        return original
    out_lines: List[str] = []
    orig_lines = original.splitlines(keepends=True)

    # Naive unified diff application: treat lines starting with ' ' as context, '-' as remove, '+' as add
    # This assumes the patch is a standard unified diff and that hunks are ordered.
    patch_lines = patch_text.splitlines(keepends=False)
    in_hunk = False
    idx = 0  # pointer into orig_lines
    for pl in patch_lines:
        if pl.startswith("@@"):
            in_hunk = True
            # we don't parse the range info for simplicity; we assume sequential processing
            continue
        if not in_hunk:
            continue
        if not pl:
            # empty line context
            out_lines.append("\n")
            continue
        tag = pl[0]
        content = pl[1:] + "\n"
        if tag == ' ':
            out_lines.append(content)
            idx += 1
        elif tag == '-':
            # skip this original line
            idx += 1
        elif tag == '+':
            out_lines.append(content)
        else:
            # unknown line, ignore
            pass

    # If no hunks were processed, return original
    if not in_hunk:
        return original

    return "".join(out_lines)
