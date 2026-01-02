"""Check whether the current Python interpreter has a working `typing` module.

This script is intended to help users quickly detect the issue seen in some interpreters (TypeError from typing import).

Usage:
  python scripts/check_python_typing.py

It will try to import `typing` and `pytest` and print clear instructions if either fails.
"""
from __future__ import annotations

import sys
import traceback


def main():
    ok = True
    try:
        import typing  # type: ignore
        print("typing import: OK")
    except Exception as e:
        ok = False
        print("typing import: FAILED")
        traceback.print_exc()
        print()
        print("This Python interpreter has a broken 'typing' module (seen in some dev builds such as Python 3.13).")
        print("Recommended: use a supported Python interpreter (3.10-3.12) and create a virtualenv:")
        print("  python -m venv .venv")
        if sys.platform.startswith("win"):
            print("  .venv\\Scripts\\activate")
        else:
            print("  source .venv/bin/activate")
        print("Then install test deps:")
        print("  python -m pip install -r brain/requirements.txt")
        print("and run tests with:")
        print("  pytest -q")

    try:
        import pytest  # type: ignore
        print("pytest import: OK")
    except Exception:
        print("pytest import: FAILED or not installed")
        print("You can install pytest with: python -m pip install pytest")

    if ok:
        print("Environment looks OK for running tests.")
    else:
        print("Fix the interpreter as suggested above and re-run tests.")


if __name__ == "__main__":
    main()
