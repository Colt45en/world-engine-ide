#!/usr/bin/env python
"""Run database migrations for relay SQLite DB.

Usage:
  python scripts/db_migrate.py --db ./artifacts/e2e.sqlite
"""
from __future__ import annotations

import argparse
from pathlib import Path

from brain.migrations import apply_migrations


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", default="artifacts/e2e.sqlite")
    args = p.parse_args()

    dbp = Path(args.db)
    apply_migrations(dbp)
    print("Migrations applied to", dbp)

if __name__ == "__main__":
    main()
