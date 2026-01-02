import asyncio
import json
import os
import subprocess
import sys
import tempfile
import time

import pytest

try:
    import importlib
    importlib.import_module("websockets")
except Exception:
    pytest.skip("websockets not available; skipping relay E2E tests", allow_module_level=True)

try:
    import importlib
    importlib.import_module("tensorflow")
except Exception:
    pytest.skip("TensorFlow not available; skipping relay E2E tests", allow_module_level=True)

from pathlib import Path
from brain.surrogate_token_model import train_from_logs_routed
from brain.registry import create_run_id, save_tokenizer_assets, save_model_assets, build_manifest, write_manifest


@pytest.mark.timeout(120)
def test_relay_infer_end_to_end(tmp_path):
    # Prepare a small artifact
    logs = tmp_path / "logs.json"
    rows = [{"op": "safeDiv", "args": [10, 2], "res": {"ok": True, "value": 5.0}, "text": "10 / 2"}]
    logs.write_text(__import__('json').dumps(rows))

    artifacts_root = tmp_path / "artifacts" / "runs"
    artifacts_root.mkdir(parents=True)

    model, (eng, math, phys) = train_from_logs_routed(str(logs), op_filter="safeDiv", expand_derived=True)

    run_id = create_run_id()
    run_dir = artifacts_root / run_id
    run_dir.mkdir(parents=True)

    tok_meta = save_tokenizer_assets(eng, math, phys, run_dir)
    model_meta = save_model_assets(model, run_dir, save_format="saved_model")
    training_meta = {"dataset": logs.name, "epochs": 1}

    manifest = build_manifest(run_id=run_id, artifacts_root=artifacts_root, tokenizer_meta={
        "version": 1,
        "domains": ["english","math","physics"],
        "vocab_files": tok_meta.get("files", {}),
        "config_file": tok_meta.get("config_file"),
        "hashes": tok_meta.get("hashes", {})
    }, model_meta=model_meta, training_meta=training_meta)

    write_manifest(manifest, run_dir)

    # start relay in test mode
    env = os.environ.copy()
    env["RELAY_TEST_MODE"] = "1"
    env["ARTIFACT_RUN_ID"] = run_id
    env["ARTIFACTS_ROOT"] = str(artifacts_root)
    env["RELAY_LOG_JSON"] = "1"
    env["RELAY_PORT"] = "0"
    env["PYTHONPATH"] = os.pathsep.join([str(Path('brain/src').resolve()), env.get('PYTHONPATH','')])

    proc = subprocess.Popen([sys.executable, "-m", "brain.relay.ws_server"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, text=True)

    try:
        # read stdout until listening line
        start = time.time()
        listen_line = None
        while time.time() - start < 20:
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            if 'LISTENING' in line:
                listen_line = line.strip()
                break
        assert listen_line, "Relay did not start in time"

        # parse port
        # LISTENING ws://127.0.0.1:12345
        parts = listen_line.split()
        url = parts[1]
        ws_url = url

        # connect via websockets and send infer command
        import websockets

        async def run_client():
            async with websockets.connect(ws_url) as ws:
                trace_id = "test-123"
                msg = {
                    "cmd": "Infer",
                    "trace_id": trace_id,
                    "payload": {"text": "Hello world", "math": "x^2", "physics": "9.81 m/s^2"},
                }
                await ws.send(json.dumps(msg))
                raw = await ws.recv()
                resp = json.loads(raw)
                assert resp.get('type') == 'infer_result'
                assert resp.get('trace_id') == trace_id
                assert 'tokens' in resp
                assert 'prediction' in resp
                return resp

        resp = asyncio.get_event_loop().run_until_complete(run_client())

        # read some log lines and ensure a JSON event with trace_id exists
        found_log = False
        start = time.time()
        while time.time() - start < 5:
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            try:
                obj = json.loads(line.strip())
                if obj.get('event') == 'infer' and obj.get('trace_id') == 'test-123':
                    found_log = True
                    break
            except Exception:
                continue
        assert found_log, "Did not find infer log event with matching trace_id"

        # Verify DB record exists and matches
        import sqlite3
        db_path = Path(env["RELAY_DB_PATH"]) if "RELAY_DB_PATH" in env else (tmp_path / 'artifacts' / 'e2e.sqlite')
        assert db_path.exists(), f"DB file not found at {db_path}"
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT trace_id, run_id, routing, token_lengths, prediction FROM infer_events WHERE trace_id = ?", ("test-123",))
        row = cur.fetchone()
        assert row is not None, "No DB row found for trace_id"
        tid, rid, routing_json, token_lengths_json, pred = row
        assert tid == "test-123"
        assert rid == run_id
        r = json.loads(routing_json)
        assert r.get('english') is True and r.get('math') is True and r.get('physics') is True
        tl = json.loads(token_lengths_json)
        assert isinstance(tl.get('english'), int) and isinstance(pred, (float, int))

    finally:
        proc.terminate()
        proc.wait(timeout=5)
