"""Simple SQLite migration helper for the Brain relay.

Provides:
- MIGRATIONS: ordered list of (version, name, sql)
- apply_migrations(db_path): applies missing migrations atomically
- get_applied_migrations(db_path): returns applied versions

Design notes:
- Migrations are small SQL snippets applied in order.
- A `schema_migrations` table records applied versions + timestamps.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

MIGRATIONS: List[Tuple[int, str, str]] = [
    (
        1,
        "create_infer_events",
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT,
            applied_at TEXT
        );

        CREATE TABLE IF NOT EXISTS infer_events (
            trace_id TEXT PRIMARY KEY,
            run_id TEXT,
            routing TEXT,
            token_lengths TEXT,
            prediction REAL,
            ts TEXT
        );
        PRAGMA journal_mode=WAL;
        """,
    ),
]


def _connect(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    return conn


def get_applied_migrations(db_path: Path) -> List[int]:
    try:
        conn = _connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        rows = cur.fetchall()
        conn.close()
        return [r[0] for r in rows]
    except Exception:
        return []


def apply_migrations(db_path: Path) -> None:
    conn = _connect(db_path)
    cur = conn.cursor()
    # ensure migrations table exists
    cur.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT,
            applied_at TEXT
        );"""
    )
    conn.commit()

    applied = set(get_applied_migrations(db_path))

    for version, name, sql in sorted(MIGRATIONS, key=lambda x: x[0]):
        if version in applied:
            continue
        # apply migration in transaction
        try:
            cur.executescript(sql)
            cur.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                (version, name, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            conn.close()
            raise
    conn.close()
