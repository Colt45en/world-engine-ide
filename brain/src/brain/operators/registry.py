from typing import Callable, Dict, Tuple, Any

class OperatorResult:
    def __init__(self, new_state: Dict[str, Any], delta: Dict[str, Any], audit: Dict[str, Any], risk: float, recommendations: Dict[str, Any] = None):
        self.new_state = new_state
        self.delta = delta
        self.audit = audit
        self.risk = risk
        self.recommendations = recommendations or {}

class OperatorRegistry:
    def __init__(self):
        self._operators: Dict[str, Callable[..., OperatorResult]] = {}

    def register(self, name: str, fn: Callable[..., OperatorResult]):
        self._operators[name] = fn

    def apply(self, name: str, state: Dict[str, Any], **kwargs) -> OperatorResult:
        if name not in self._operators:
            raise KeyError(f"Operator {name} not found")
        return self._operators[name](state, **kwargs)
