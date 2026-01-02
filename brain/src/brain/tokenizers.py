"""Tokenization and unit normalization utilities for English, Math and Physics.

This module provides:
- domain detection (english/math/physics)
- unit normalization and derived-unit expansion (e.g., N -> kg m s^-2)
- regex tokenizers for math/physics suitable for TF graph use
- english standardization helper

Target: compatible with TensorFlow 2.12+ and Python 3.8+
"""
from __future__ import annotations

import re
from typing import Tuple

# Derived-unit expansion mapping (common SI derived units)
_DERIVED_UNITS = {
    "N": "kg m s^-2",
    "J": "kg m^2 s^-2",
    "W": "kg m^2 s^-3",
    "Pa": "kg m^-1 s^-2",
    "Hz": "s^-1",
    "C": "A s",
    "V": "kg m^2 s^-3 A^-1",
    "F": "kg^-1 m^-2 s^4 A^2",
    "Ω": "kg m^2 s^-3 A^-2",
    "S": "kg^-1 m^-2 s^3 A^2",
    "T": "kg s^-2 A^-1",
    "H": "kg m^2 s^-2 A^-2",
    "eV": "kg m^2 s^-2",
}

# Superscript translation map
_SUPERSCRIPT_MAP = str.maketrans({
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
    "⁺": "+",
})

# Regex hints for domain detection
# NOTE: Keep physics detection conservative. Single-letter units (e.g., "A") are common
# English words ("a") and can cause false positives if matched standalone.
_PHYSICS_KEYWORD_RE = re.compile(
    r"(?:ħ|μ0|ε0|k_B|R|N_A)"
    r"|(?:\bvelocity\b|\bacceleration\b|\bforce\b|\benergy\b|\bmomentum\b|\bfield\b)",
    re.IGNORECASE,
)

# Require a numeric context for unit-driven physics detection.
_PHYSICS_UNIT_WITH_NUMBER_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*"  # number
    r"(?:m\s*/\s*s(?:\s*\^\s*2)?|m\s*/\s*s²|kg|N|J|W|Pa|Hz|eV|mol|K|V|Ω|T|Gy|Sv)\b",
    re.IGNORECASE,
)

_LATEX_CMD_RE = re.compile(r"\\[A-Za-z]+")
_MATH_KEYWORD_RE = re.compile(r"\b(?:sin|cos|tan|log|ln|exp|sqrt|lim)\b", re.IGNORECASE)

_MATH_EXPR_ALLOWED_RE = re.compile(r"^[\d\s\.,\+\-\*\/\^=\%\(\)\[\]\{\}]+$")


def _looks_like_math_expression(text: str) -> bool:
    s = text.strip()
    if not s:
        return False
    # Must contain at least one digit and one operator.
    if not re.search(r"\d", s):
        return False
    if not re.search(r"[\+\-\*\/\^=\%]", s):
        return False
    # Disallow letters for the conservative "pure expression" heuristic.
    if re.search(r"[A-Za-z]", s):
        return False
    return bool(_MATH_EXPR_ALLOWED_RE.match(s))

Mode = Tuple[str, str, str, str]


def detect_domain(text: str) -> str:
    """Detect whether a text is physics, math, or english.

    Returns: "physics" | "math" | "english".
    """
    if not isinstance(text, str):
        return "english"
    # 1) Pure math expressions should win even without explicit math keywords.
    if _looks_like_math_expression(text):
        return "math"
    # 2) Physics only with strong signals (numeric units or domain keywords/constants).
    if _PHYSICS_UNIT_WITH_NUMBER_RE.search(text):
        return "physics"
    if _PHYSICS_KEYWORD_RE.search(text):
        return "physics"
    # 3) Symbolic/LaTeX math hints.
    if any(ch in text for ch in ("=", "^", "∑", "∏", "∫", "√", "∂")):
        return "math"
    if _LATEX_CMD_RE.search(text):
        return "math"
    if "d/dx" in text or _MATH_KEYWORD_RE.search(text):
        return "math"
    return "english"


def route_text(text: str) -> Mode:
    """Route text into exactly one populated channel.

    Returns (english_text, math_text, physics_text, mode)
    """
    mode = detect_domain(text)
    if mode == "english":
        return text, "", "", mode
    if mode == "math":
        return "", text, "", mode
    return "", "", text, mode


# Unit parsing helpers
_UNIT_TOKEN_RE = re.compile(r"^([A-Za-zΩμħε0-9]+)(?:\^([+\-]?\d+))?$")


def _parse_unit_atom(atom: str) -> Tuple[str, int]:
    atom = atom.strip()
    if not atom:
        raise ValueError("Empty unit atom")
    atom = atom.translate(_SUPERSCRIPT_MAP)
    m = _UNIT_TOKEN_RE.match(atom)
    if not m:
        return atom, 1
    unit = m.group(1)
    exp = m.group(2)
    return unit, int(exp) if exp is not None else 1


def normalize_unit_expression(expr: str, expand_derived: bool = True) -> str:
    """Normalize a unit expression to canonical space-separated tokens.

    Examples:
      'kg·m/s^2' -> 'kg m s^-2'
      'N m' -> 'kg m^2 s^-2'  (if expand_derived=True)
    """
    if not isinstance(expr, str) or not expr.strip():
        return ""
    s = expr.strip()
    s = s.replace("⋅", "·")
    s = re.sub(r"[\*·]", "·", s)
    s = re.sub(r"\s+", " ", s)

    parts = [p.strip() for p in s.split("/")]

    powers = {}

    def add_atoms(part: str, sign: int):
        atoms = []
        for chunk in part.split("·"):
            chunk = chunk.strip()
            if not chunk:
                continue
            atoms.extend([a for a in chunk.split(" ") if a])
        for atom in atoms:
            unit, p = _parse_unit_atom(atom)
            powers[unit] = powers.get(unit, 0) + sign * p

    if parts:
        add_atoms(parts[0], +1)
    for denom in parts[1:]:
        add_atoms(denom, -1)

    # Expand derived units into base units when requested
    if expand_derived:
        expanded = True
        # Keep expanding until no derived unit remains in powers
        while expanded:
            expanded = False
            for u in tuple(powers.keys()):
                if u in _DERIVED_UNITS and powers[u] != 0:
                    expanded = True
                    exp_str = _DERIVED_UNITS[u]
                    # parse expansion tokens (e.g., 'kg m s^-2')
                    for token in exp_str.split():
                        if token.endswith("^-"):
                            # defensive
                            continue
                        m = re.match(r"([A-Za-zΩμħε0-9]+)\^?([+\-]?\d+)?", token)
                        if not m:
                            continue
                        base = m.group(1)
                        pwr = int(m.group(2)) if m.group(2) else 1
                        powers[base] = powers.get(base, 0) + powers[u] * pwr
                    # remove the derived unit after expansion
                    del powers[u]
                    break

    # Build canonical string sorted by unit name for deterministic output
    out = []
    for unit in sorted(powers.keys()):
        p = powers[unit]
        if p == 0:
            continue
        if p == 1:
            out.append(unit)
        else:
            out.append(f"{unit}^{p}")

    # Convert caret '^' style to 'unit' or 'unit^exp' strings; user requested 's^-2' style
    normalized = " ".join(out)
    # replace caret with superscript minus normalization kept as '^' for clarity
    normalized = normalized.replace("^-", "^-")
    return normalized


_UNIT_PATTERN = (
    r"(\\[A-Za-z]+)"  # LaTeX commands
    r"|((?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+\-]?\d+)?)"  # numbers
    r"|([A-Za-zα-ωΑ-ΩμħεσπΔΩ]+(?:_[A-Za-z0-9α-ωΑ-ΩμħεσπΔΩ]+)?)"  # identifiers + subscripts
    r"|([+\-*/^=<>±×÷·∙⋅∗∧∨¬∩∪∈∉⊂⊆⊃⊇≈≠≤≥→←↔⇒⇐⇔∞∑∏∫∂∇∥⊥°%!])"  # symbols
    r"|([\(\)\[\]\{\},:;|])"
)


# The following function is intended to be used within tensorflow graph (tf.py_function etc.)
# but is implemented with tensorflow operations in surrogate model file. Kept here as reference.


def english_standardize(x: str) -> str:
    x = x.lower()
    x = re.sub(r"([.,!?;:(){}\[\]\"'])", r" \1 ", x)
    x = re.sub(r"\s+", " ", x)
    return x.strip()
