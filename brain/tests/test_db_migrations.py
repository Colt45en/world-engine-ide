import sqlite3
from pathlib import Path

from brain.migrations import apply_migrations, get_applied_migrations


def test_apply_migrations(tmp_path):
    db_path = tmp_path / "e2e.sqlite"
    apply_migrations(db_path)

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    # schema_migrations should exist and contain version 1
    cur.execute("SELECT version, name FROM schema_migrations ORDER BY version")
    rows = cur.fetchall()
    assert len(rows) >= 1
    assert rows[0][0] == 1

    # infer_events table should exist
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='infer_events'")
    assert cur.fetchone() is not None

    conn.close()

    # get_applied_migrations should include 1
    applied = get_applied_migrations(db_path)
    assert 1 in applied
