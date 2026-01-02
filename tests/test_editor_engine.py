import unittest
from tests._compat import typing_works

if not typing_works():
    raise unittest.SkipTest("typing module broken in this Python build; skipping tests")

from editor_engine import EditorEngine


class TestEditorEngine(unittest.TestCase):
    def test_generate_and_apply(self):
        ee = EditorEngine()
        old = "def f():\n    return 1\n"
        new = "def f(x):\n    return x\n"
        diff = ee.generate_unified_diff(old, new)
        self.assertTrue(diff)
        pr = ee.apply_unified_diff(old, diff)
        self.assertTrue(pr.ok)
        self.assertEqual(pr.new_text, new)


if __name__ == "__main__":
    unittest.main()
