from brain.editor_engine import generate_unified_diff, apply_unified_diff


def test_generate_and_apply_diff():
    original = "def f():\n    return 1\n"
    candidate = "def f(x):\n    return x\n"
    patch = generate_unified_diff(original, candidate)
    assert patch
    applied = apply_unified_diff(original, patch)
    assert applied == candidate
