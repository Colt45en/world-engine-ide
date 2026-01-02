from __future__ import annotations

import json
import sqlite3
import time
from typing import Any


class DataProcessor:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts_utc INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    predicted_intent TEXT NOT NULL,
                    expected_intent TEXT,
                    score REAL NOT NULL,
                    breakdown_json TEXT NOT NULL,
                    unlocks_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS progress (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    ts_utc INTEGER NOT NULL,
                    cumulative_score REAL NOT NULL,
                    samples INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS patches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts_utc INTEGER NOT NULL,
                    requested_action TEXT NOT NULL,
                    required_unlock TEXT NOT NULL,
                    allowed INTEGER NOT NULL,
                    old_hash TEXT NOT NULL,
                    new_hash TEXT NOT NULL,
                    diff_text TEXT NOT NULL,
                    meta_json TEXT NOT NULL
                )
                """
            )

            cur = conn.execute("SELECT id FROM progress WHERE id = 1")
            if cur.fetchone() is None:
                conn.execute(
                    "INSERT INTO progress (id, ts_utc, cumulative_score, samples) VALUES (1, ?, 0.0, 0)",
                    (int(time.time()),),
                )

    def log_event(
        self,
        text: str,
        predicted_intent: str,
        expected_intent: str | None,
        score: float,
        breakdown: dict[str, Any],
        unlocks: dict[str, bool],
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO events (ts_utc, text, predicted_intent, expected_intent, score, breakdown_json, unlocks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(time.time()),
                    text,
                    predicted_intent,
                    expected_intent,
                    float(score),
                    json.dumps(breakdown, ensure_ascii=False),
                    json.dumps(unlocks, ensure_ascii=False),
                ),
            )

            cur = conn.execute("SELECT cumulative_score, samples FROM progress WHERE id = 1")
            row = cur.fetchone()
            cumulative, samples = float(row[0]), int(row[1])
            cumulative += float(score)
            samples += 1
            conn.execute(
                "UPDATE progress SET ts_utc = ?, cumulative_score = ?, samples = ? WHERE id = 1",
                (int(time.time()), cumulative, samples),
            )

    def log_patch(
        self,
        requested_action: str,
        required_unlock: str,
        allowed: bool,
        old_hash: str,
        new_hash: str,
        diff_text: str,
        meta: dict[str, Any],
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO patches (ts_utc, requested_action, required_unlock, allowed, old_hash, new_hash, diff_text, meta_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(time.time()),
                    requested_action,
                    required_unlock,
                    1 if allowed else 0,
                    old_hash,
                    new_hash,
                    diff_text,
                    json.dumps(meta, ensure_ascii=False),
                ),
            )

    def get_aggregate_progress(self) -> dict[str, float | int]:
        with self._connect() as conn:
            cur = conn.execute("SELECT cumulative_score, samples FROM progress WHERE id = 1")
            row = cur.fetchone()
            return {"cumulative_score": float(row[0]), "samples": int(row[1])}
