import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass
class ScoreReport:
    score: float
    requested_action: str
    required_unlock: Optional[str]
    allowed: bool
    details: Dict[str, Any]


class LearningModel:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.thresholds = self.config.get("python_module", {}).get("thresholds", {})
        self.capability_actions = self.config.get("python_module", {}).get("capability_gating", {}).get("actions", {})
        self.intent_map = self.config.get("python_module", {}).get("capability_gating", {}).get("intent_default_action", {})

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        # try explicit path, cwd, or repository root
        candidates = []
        if config_path:
            candidates.append(Path(config_path))
        candidates.append(Path.cwd() / "config.json")
        # try to walk up from this file's location
        repo_root = Path(__file__).resolve().parents[3]
        candidates.append(repo_root / "config.json")

        for p in candidates:
            try:
                if p.exists():
                    return json.loads(p.read_text())
            except Exception:
                continue
        # fallback to minimal default
        return {"python_module": {"thresholds": {}, "capability_gating": {"actions": {}, "intent_default_action": {}}}}

    def resolve_action_from_intent(self, intent: str) -> str:
        return self.intent_map.get(intent, self.intent_map.get("unknown", "assist"))

    def evaluate(self, *, intent: Optional[str] = None, score: Optional[float] = None, **extras) -> ScoreReport:
        """Evaluate a requested action and determine whether it is allowed under capability gating.

        Args:
            intent: a string intent name (e.g., 'python.optimize')
            score: a float [0,1] representing the model's confidence/score for the requested action
            extras: additional context (ignored for gating decisions but preserved in details)

        Returns:
            ScoreReport: includes requested_action, required_unlock, allowed flag, and details
        """
        requested_action = self.resolve_action_from_intent(intent or "unknown")
        required_unlock = self.capability_actions.get(requested_action)
        threshold = float(self.thresholds.get(required_unlock, 0.0)) if required_unlock else 0.0
        s = float(score) if score is not None else 0.0
        allowed = s >= threshold
        details = {"intent": intent, "threshold": threshold, "score": s}
        details.update(extras)
        return ScoreReport(score=s, requested_action=requested_action, required_unlock=required_unlock, allowed=allowed, details=details)
