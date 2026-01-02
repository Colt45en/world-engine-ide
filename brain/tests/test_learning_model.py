import pytest
from brain.learning_model import LearningModel


def test_allows_high_score():
    lm = LearningModel()
    report = lm.evaluate(intent="python.optimize", score=0.8)
    assert report.requested_action == "minor_edit"
    assert report.required_unlock == "minor_edits"
    assert report.allowed is True


def test_blocks_low_score():
    lm = LearningModel()
    report = lm.evaluate(intent="python.optimize", score=0.6)
    assert report.requested_action == "minor_edit"
    assert report.required_unlock == "minor_edits"
    assert report.allowed is False


def test_unknown_intent_defaults_to_assist():
    lm = LearningModel()
    report = lm.evaluate(intent="something.unknown", score=0.49)
    assert report.requested_action == "assist"
    assert report.required_unlock == "assist_mode"
    assert report.allowed is False
