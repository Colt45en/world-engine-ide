"""
learning_model.py
Adds code evaluation scoring (AST + sandbox execution) to the existing intent-based scoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from code_evaluator import CodeEvaluator, CodeEvalResult


@dataclass(frozen=True)
class ScoreReport:
    text: str
    predicted_intent: str
    expected_intent: str | None
    requested_action: str
    required_unlock: str
    allowed: bool
    total_score: float  # 0..1
    breakdown: dict[str, float]
    unlocks: dict[str, bool]
    unlocks_before: dict[str, bool]
    code_eval: dict[str, Any] | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "predicted_intent": self.predicted_intent,
            "expected_intent": self.expected_intent,
            "requested_action": self.requested_action,
            "required_unlock": self.required_unlock,
            "allowed": self.allowed,
            "total_score": self.total_score,
            "breakdown": self.breakdown,
            "unlocks": self.unlocks,
            "unlocks_before": self.unlocks_before,
            "code_eval": self.code_eval,
        }


class LearningModel:
    def __init__(
        self,
        standards: dict[str, Any],
        thresholds: dict[str, float],
        keyword_map: dict[str, Any],
        code_policy: dict[str, Any],
        capability_gating: dict[str, Any],
    ) -> None:
        self.standards: dict[str, Any] = standards
        self.thresholds: dict[str, float] = thresholds
        self.keyword_map: dict[str, Any] = keyword_map
        self.code_policy: dict[str, Any] = code_policy
        self.capability_gating: dict[str, Any] = capability_gating

        self.code_evaluator = CodeEvaluator(policy=code_policy)

        # Running progress (simple moving average of last N, default N=50)
        self.window_size = int(self.standards.get("moving_window_size", 50))
        self.recent_scores: list[float] = []
        self.current_percent: float = 0.0

        self.unlocked: dict[str, bool] = {
            "assist_mode": False,         # 50%
            "minor_edits": False,         # 70%
            "refactor_lint": False,       # 90%
            "autonomous_editing": False,  # 100%
        }

    def update_config(
        self,
        standards: dict[str, Any],
        thresholds: dict[str, float],
        keyword_map: dict[str, Any],
        code_policy: dict[str, Any],
        capability_gating: dict[str, Any],
    ) -> None:
        self.standards: dict[str, Any] = standards
        self.thresholds: dict[str, float] = thresholds
        self.keyword_map: dict[str, Any] = keyword_map
        self.code_policy: dict[str, Any] = code_policy
        self.capability_gating: dict[str, Any] = capability_gating
        self.code_evaluator = CodeEvaluator(policy=code_policy)
        self.window_size = int(self.standards.get("moving_window_size", 50))

    def _tokenize(self, text: str) -> list[str]:
        buf = []
        w = []
        for ch in text.lower():
            if ch.isalnum() or ch in ("_", "-"):
                w.append(ch)
            else:
                if w:
                    buf.append("".join(w))
                    w = []
        if w:
            buf.append("".join(w))
        return buf

    def _predict_intent(self, tokens: list[str]) -> tuple[str, float]:
        best_intent = "unknown"
        best_score = 0.0

        for intent, spec in self.keyword_map.items():
            kws: set[Any] = set((spec.get("keywords") or []))
            weight = float(spec.get("weight", 1.0))
            if not kws:
                continue

            hits: int = sum(1 for t in tokens if t in kws)
            raw: float = hits / max(1, len(kws))
            score: float = raw * weight

            if score > best_score:
                best_score: float = score
                best_intent: str = intent

        conf: float = min(1.0, best_score)
        return best_intent, conf

    def _score_intent(
        self,
        *,
        predicted_intent: str,
        expected_intent: str | None,
        confidence: float,
        tokens: list[str],
    ) -> dict[str, float]:
        weights = self.standards.get("weights", {})
        w_correct = float(weights.get("correctness", 0.55))
        w_clarity = float(weights.get("clarity", 0.20))
        w_safety = float(weights.get("safety", 0.15))
        w_conf = float(weights.get("confidence", 0.10))

        if expected_intent is None:
            correctness = 0.5
        else:
            correctness: float = 1.0 if predicted_intent == expected_intent else 0.0

        min_tokens = int(self.standards.get("min_tokens_for_full_clarity", 4))
        token_factor: float = min(1.0, len(tokens) / max(1, min_tokens))

        spec = self.keyword_map.get(predicted_intent, {}) if isinstance(self.keyword_map, dict) else {}
        kws: set[str] = {str(k) for k in (spec.get("keywords") or [])}
        any_hit: float = 1.0 if kws and any((t in kws) for t in tokens) else 0.0

        clarity: float = 0.5 * token_factor + 0.5 * any_hit
        safety = 1.0
        conf_score: float = max(0.0, min(1.0, confidence))

        breakdown: dict[str, float] = {
            "correctness": correctness,
            "clarity": clarity,
            "safety": safety,
            "confidence": conf_score,
        }

        total: float = (
            w_correct * correctness +
            w_clarity * clarity +
            w_safety * safety +
            w_conf * conf_score
        )
        breakdown["intent_total"] = max(0.0, min(1.0, total))
        return breakdown

    def _compute_unlocks(self, percent: float) -> dict[str, bool]:
        return {
            "assist_mode": percent >= float(self.thresholds.get("assist_mode", 0.50)),
            "minor_edits": percent >= float(self.thresholds.get("minor_edits", 0.70)),
            "refactor_lint": percent >= float(self.thresholds.get("refactor_lint", 0.90)),
            "autonomous_editing": percent >= float(self.thresholds.get("autonomous_editing", 1.00)),
        }

    def _authority_level(self, percent: float) -> dict[str, object]:
        """Human-readable authority state derived from thresholds.

        This is a presentation-layer mapping of the existing unlock thresholds.
        """
        t_assist = float(self.thresholds.get("assist_mode", 0.50))
        t_junior = float(self.thresholds.get("minor_edits", 0.70))
        t_senior = float(self.thresholds.get("refactor_lint", 0.90))
        t_arch = float(self.thresholds.get("autonomous_editing", 1.00))

        if percent >= t_arch:
            return {
                "level": "Architect",
                "range": [t_arch, 1.0],
                "capabilities": ["autonomous_edit"],
            }
        if percent >= t_senior:
            return {
                "level": "Senior Dev",
                "range": [t_senior, t_arch],
                "capabilities": ["refactor", "lint"],
            }
        if percent >= t_junior:
            return {
                "level": "Junior Dev",
                "range": [t_junior, t_senior],
                "capabilities": ["minor_edit"],
            }
        if percent >= t_assist:
            return {
                "level": "Advisor",
                "range": [t_assist, t_junior],
                "capabilities": ["assist"],
            }
        return {
            "level": "Observer",
            "range": [0.0, t_assist],
            "capabilities": [],
        }

    def _resolve_required_unlock(self, predicted_intent: str, requested_action: str | None) -> tuple[str, str]:
        """
        Returns (action, required_unlock_name).
        If requested_action missing, use intent_default_action[predicted_intent].
        Then map action -> required unlock via actions map.
        """
        actions_map = (self.capability_gating or {}).get("actions", {})
        defaults = (self.capability_gating or {}).get("intent_default_action", {})

        action: str | Any = (requested_action or "").strip() or defaults.get(predicted_intent, defaults.get("unknown", "assist"))
        if action not in actions_map:
            # fall back hard to assist
            action = "assist"
        required_unlock = actions_map.get(action, "assist_mode")
        return action, required_unlock

    def is_allowed(self, required_unlock: str) -> bool:
        # Unlocked map is authoritative
        return bool(self.unlocked.get(required_unlock, False))

    def evaluate(
        self,
        text: str,
        expected_intent: str | None,
        code: str | None,
        tests: str | None,
        requested_action: str | None,
    ) -> ScoreReport:
        tokens: list[str] = self._tokenize(text)
        pred, conf = self._predict_intent(tokens)

        # Resolve gating requirement for this request
        action, required_unlock = self._resolve_required_unlock(predicted_intent=pred, requested_action=requested_action)

        # Gate based on proficiency so far (before scoring this request).
        before_scores: list[float] = self.recent_scores[-self.window_size:]
        percent_before: float = sum(before_scores) / max(1, len(before_scores)) if before_scores else 0.0
        unlocks_before: dict[str, bool] = self._compute_unlocks(percent_before)
        allowed = bool(unlocks_before.get(required_unlock, False))

        intent_breakdown: dict[str, float] = self._score_intent(
            predicted_intent=pred,
            expected_intent=expected_intent,
            confidence=conf,
            tokens=tokens,
        )

        # Safe static evaluation (AST/compile/policy/complexity heuristics only; no execution).
        code_eval: CodeEvalResult | None = None
        code_score = None
        if code and code.strip():
            code_eval = self.code_evaluator.evaluate(code=code, tests=tests)
            code_score = float(code_eval.score)

        combo = self.standards.get("combo_weights", {})
        w_intent = float(combo.get("intent", 0.50))
        w_code: float = float(combo.get("code", 0.50)) if code_score is not None else 0.0

        # If no code score available, fall back to intent-only
        if code_score is None or w_code <= 0.0:
            total_score = float(intent_breakdown["intent_total"])
        else:
            denom = float(w_intent + w_code)
            if denom <= 0.0:
                total_score = float(intent_breakdown["intent_total"])
            else:
                total_score: float = (w_intent * float(intent_breakdown["intent_total"]) + w_code * float(code_score)) / denom
                total_score: float = max(0.0, min(1.0, total_score))

        breakdown: dict[str, float] = {
            "intent_total": float(intent_breakdown["intent_total"]),
            "total": float(total_score),
            "correctness": float(intent_breakdown["correctness"]),
            "clarity": float(intent_breakdown["clarity"]),
            "safety": float(intent_breakdown["safety"]),
            "confidence": float(intent_breakdown["confidence"]),
        }

        code_eval_dict = None
        if code_eval is not None:
            code_eval_dict = {
                "ok": bool(code_eval.ok),
                "score": float(code_eval.score),
                "breakdown": {k: float(v) for k, v in code_eval.breakdown.items()},
                "stdout": code_eval.stdout,
                "stderr": code_eval.stderr,
                "meta": code_eval.meta,
            }
            breakdown["code_score"] = float(code_eval.score)

        tmp_scores: list[float] = (self.recent_scores + [total_score])[-self.window_size:]
        percent: float = sum(tmp_scores) / max(1, len(tmp_scores))
        unlocks: dict[str, bool] = self._compute_unlocks(percent)

        return ScoreReport(
            text=text,
            predicted_intent=pred,
            expected_intent=expected_intent,
            requested_action=action,
            required_unlock=required_unlock,
            allowed=allowed,
            total_score=float(total_score),
            breakdown=dict(breakdown),
            unlocks=dict(unlocks),
            unlocks_before=dict(unlocks_before),
            code_eval=code_eval_dict,
        )

    def update_progress(self, report: ScoreReport) -> None:
        self.recent_scores.append(float(report.total_score))
        if len(self.recent_scores) > self.window_size:
            self.recent_scores = self.recent_scores[-self.window_size:]

        self.current_percent = sum(self.recent_scores) / max(1, len(self.recent_scores))
        self.unlocked: dict[str, bool] = self._compute_unlocks(self.current_percent)

    def get_state(self) -> dict[str, Any]:
        authority: dict[str, object] = self._authority_level(self.current_percent)
        return {
            "moving_window_size": self.window_size,
            "recent_samples": len(self.recent_scores),
            "proficiency_percent": round(self.current_percent * 100.0, 2),
            "unlocked": dict(self.unlocked),
            "thresholds": dict(self.thresholds),
            "capability_gating": self.capability_gating,
            "authority": authority,
        }
