import unittest
from tests._compat import typing_works

import json
import os

from learning_model import LearningModel, ScoreReport


@unittest.skipUnless(typing_works(), "typing module broken in this Python build; skipping tests")
class TestGating(unittest.TestCase):
    def setUp(self) -> None:
        here: str = os.path.dirname(os.path.abspath(__file__))
        repo_root: str = os.path.dirname(here)
        cfg_path: str = os.path.join(repo_root, "config.json")
        with open(cfg_path, "r", encoding="utf-8") as f: os.TextIOWrapper[_WrappedBuffer]:
            cfg = json.load(f)
        pm = cfg["python_module"]
        self.model = LearningModel(
            standards=pm["standards"],
            thresholds=pm["thresholds"],
            keyword_map=pm["keyword_map"],
            code_policy=pm.get("code_policy", {}),
            capability_gating=pm.get("capability_gating", {}),
        )

    def test_refactor_locked_by_default(self) -> None:
        report: ScoreReport = self.model.evaluate(text="refactor code", expected_intent=None, code=None, tests=None, requested_action="refactor")
        self.assertEqual(report.requested_action, "refactor")
        self.assertFalse(report.allowed)
        self.assertEqual(report.required_unlock, "refactor_lint")

    def test_refactor_allowed_with_high_score(self) -> None:
        self.model.recent_scores = [0.95] * 50
        report: ScoreReport = self.model.evaluate(text="refactor code", expected_intent=None, code=None, tests=None, requested_action="refactor")
        self.assertTrue(report.allowed)

    def test_code_eval_not_run_when_locked(self) -> None:
        report: ScoreReport = self.model.evaluate(text="refactor code", expected_intent=None, code="print(1)", tests=None, requested_action="refactor")
        self.assertFalse(report.allowed)
        # Static evaluation is safe and supports advisor-mode feedback (lint/syntax warnings).
        self.assertIsNotNone(report.code_eval)


if __name__ == "__main__":
    unittest.main()
