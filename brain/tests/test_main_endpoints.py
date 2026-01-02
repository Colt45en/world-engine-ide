from brain.learning_model import LearningModel
import difflib


def test_edit_allowed_generates_patch():
    lm = LearningModel()
    # intent that maps to refactor -> refactor_lint has threshold 0.9
    report = lm.evaluate(intent="python.refactor", score=0.95)
    assert report.allowed

    original = "def f():\n    return 1\n"
    candidate = "def f(x):\n    return x\n"
    udiff = list(difflib.unified_diff(original.splitlines(keepends=True), candidate.splitlines(keepends=True), fromfile="original", tofile="candidate"))
    assert len(udiff) > 0


def test_edit_blocked_when_locked():
    lm = LearningModel()
    report = lm.evaluate(intent="python.refactor", score=0.5)
    assert not report.allowed
