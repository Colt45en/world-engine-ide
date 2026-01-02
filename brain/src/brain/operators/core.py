from typing import Dict, Any
from .registry import OperatorResult

# Sample deterministic operators

def op_st(state: Dict[str, Any], **kwargs) -> OperatorResult:
    """State Transform (ST) - applies a predictable update"""
    new_state = dict(state)
    delta = {"st_applied": True}
    new_state.update(kwargs.get("changes", {}))
    audit = {"op": "ST", "details": kwargs.get("changes", {})}
    risk = 0.1
    return OperatorResult(new_state, delta, audit, risk)


def op_ch(state: Dict[str, Any], **kwargs) -> OperatorResult:
    """Change/Challenge operator (CH) - small perturbation"""
    new_state = dict(state)
    changes = kwargs.get("changes", {})
    # deterministic but simple
    for k, v in changes.items():
        new_state[k] = v
    delta = changes
    audit = {"op": "CH", "changes": changes}
    risk = 0.2
    return OperatorResult(new_state, delta, audit, risk)


def op_xyz(state: Dict[str, Any], **kwargs) -> OperatorResult:
    """Example deterministic operator (XYZ) - sets a single key/value pair."""
    new_state = dict(state)
    key = kwargs.get("key")
    value = kwargs.get("value")

    if not isinstance(key, str) or not key:
        delta = {}
        audit = {"op": "XYZ", "ok": False, "error": "key must be a non-empty string"}
        return OperatorResult(new_state, delta, audit, risk=0.6)

    new_state[key] = value
    delta = {key: value}
    audit = {"op": "XYZ", "ok": True, "key": key}
    risk = 0.05
    return OperatorResult(new_state, delta, audit, risk)

# Registerable convenience
DEFAULT_OPERATORS = {
    "ST": op_st,
    "CH": op_ch,
    "XYZ": op_xyz,
}
