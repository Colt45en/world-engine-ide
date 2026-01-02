#!/usr/bin/env python3
"""
main.py
Local training loop + HTTP server (stdlib only):
- Serves interface.html
- Accepts keyword submissions via POST /submit
- Scores them against standards
- Tracks progress + unlocks capabilities
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import ParseResult, urlparse

from data_processor import DataProcessor
from editor_engine import EditorEngine, PatchResult
from learning_model import LearningModel, ScoreReport

BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))


def load_config(config_path: str) -> dict[str, Any]:
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def sha256_text(s: str) -> str:
    import hashlib

    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class App:
    def __init__(self, config_path: str) -> None:
        self.config_path: str = config_path
        self.config: dict[str, Any] = load_config(config_path)

        db_path: str = os.path.join(BASE_DIR, self.config.get("db_path", "trainer.db"))
        self.data = DataProcessor(db_path=db_path)

        pm = self.config["python_module"]
        self.model = LearningModel(
            standards=pm["standards"],
            thresholds=pm["thresholds"],
            keyword_map=pm["keyword_map"],
            code_policy=pm["code_policy"],
            capability_gating=pm.get("capability_gating", {}),
        )

        self.patch_cfg = pm.get(
            "patch_editing",
            {
                "max_new_code_chars": 200000,
                "require_code_eval_pass": True,
                "require_write_token": True,
                "write_token_ttl_seconds": 120,
                "workspace_root": "workspace",
                "write_to_file": True,
                "max_changes_by_required_unlock": {"minor_edits": 10},
            },
        )
        self.editor = EditorEngine()

        # HMAC key used to mint short-lived write tokens.
        # - For single-worker MVP: defaults to an ephemeral per-process key (restart invalidates tokens).
        # - For multi-worker deployment: set WRITE_TOKEN_SECRET_B64 to a shared secret.
        secret_env: str | None = os.environ.get("WRITE_TOKEN_SECRET_B64")
        if secret_env:
            try:
                pad: str = "=" * ((4 - (len(secret_env) % 4)) % 4)
                decoded: bytes = base64.urlsafe_b64decode((secret_env + pad).encode("ascii"))
            except Exception:
                decoded: bytes = b""
            self._write_token_secret: bytes = decoded if len(decoded) >= 32 else secrets.token_bytes(32)
        else:
            self._write_token_secret: bytes = secrets.token_bytes(32)

        self.html_path: str = os.path.join(BASE_DIR, self.config.get("html_path", "interface.html"))

        self.workspace_root: Path = (Path(BASE_DIR) / str(self.patch_cfg.get("workspace_root", "workspace"))).resolve()
        self.workspace_root.mkdir(parents=True, exist_ok=True)

    def resolve_workspace_path(self, filename: str) -> Path:
        p = Path(filename)
        if p.is_absolute():
            raise ValueError("absolute paths are not allowed")
        target: Path = (self.workspace_root / p).resolve()
        try:
            target.relative_to(self.workspace_root)
        except Exception:
            raise ValueError("path escapes workspace")
        return target

    def issue_write_token(self, *, op: str, required_unlock: str, filename: str, base_code: str, diff_text: str) -> tuple[str, int]:
        ttl = int(self.patch_cfg.get("write_token_ttl_seconds", 120))
        now = int(time.time())
        payload = {
            "v": 1,
            "op": op,
            "ru": required_unlock,
            "iat": now,
            "exp": now + ttl,
            "nonce": secrets.token_urlsafe(12),
            "fn": filename,
            "base_hash": sha256_text(base_code),
            "diff_hash": sha256_text(diff_text),
        }
        raw: bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        payload_b64: bytes = base64.urlsafe_b64encode(raw).rstrip(b"=")
        sig: bytes = hmac.new(self._write_token_secret, payload_b64, hashlib.sha256).digest()
        sig_b64: bytes = base64.urlsafe_b64encode(sig).rstrip(b"=")
        token: str = (payload_b64 + b"." + sig_b64).decode("ascii")
        return token, ttl

    def verify_write_token(self, *, token: str, op: str, required_unlock: str, filename: str, base_code: str, diff_text: str) -> tuple[bool, str | None]:
        if not token or "." not in token:
            return False, "missing_or_malformed"

        payload_part, sig_part = token.split(".", 1)
        if not payload_part or not sig_part:
            return False, "missing_or_malformed"

        def _b64url_decode(s: str) -> bytes:
            # Restore padding for urlsafe base64.
            pad: str = "=" * ((4 - (len(s) % 4)) % 4)
            return base64.urlsafe_b64decode((s + pad).encode("ascii"))

        try:
            payload_raw: bytes = _b64url_decode(payload_part)
            sig: bytes = _b64url_decode(sig_part)
        except Exception:
            return False, "bad_base64"

        expected_sig: bytes = hmac.new(self._write_token_secret, payload_part.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            return False, "bad_signature"

        try:
            payload = json.loads(payload_raw.decode("utf-8"))
        except Exception:
            return False, "bad_payload"

        if payload.get("v") != 1:
            return False, "bad_version"
        if payload.get("op") != op:
            return False, "bad_op"
        if payload.get("ru") != required_unlock:
            return False, "wrong_unlock"
        if payload.get("fn") != filename:
            return False, "wrong_filename"
        if payload.get("base_hash") != sha256_text(base_code):
            return False, "wrong_base"
        if payload.get("diff_hash") != sha256_text(diff_text):
            return False, "wrong_diff"
        exp = payload.get("exp")
        if not isinstance(exp, int):
            return False, "bad_exp"
        if int(time.time()) > exp:
            return False, "expired"

        return True, None

    def reload_config(self) -> None:
        self.config: dict[str, Any] = load_config(self.config_path)
        pm = self.config["python_module"]
        self.model.update_config(
            standards=pm["standards"],
            thresholds=pm["thresholds"],
            keyword_map=pm["keyword_map"],
            code_policy=pm["code_policy"],
            capability_gating=pm.get("capability_gating", {}),
        )
        self.patch_cfg = pm.get("patch_editing", {"max_new_code_chars": 200000, "require_code_eval_pass": True})

APP: App | None = None


class Handler(BaseHTTPRequestHandler):
    server_version = "KeywordTrainer/0.4"

    @staticmethod
    def _diff_stats(diff_text: str) -> dict[str, int]:
        additions = 0
        deletions = 0
        for line in diff_text.splitlines():
            if not line:
                continue
            if line.startswith("+++") or line.startswith("---") or line.startswith("@@"):
                continue
            if line.startswith("+"):
                additions += 1
            elif line.startswith("-"):
                deletions += 1
        return {"additions": additions, "deletions": deletions, "total_changes": additions + deletions}

    @staticmethod
    def _max_changes_for_unlock(patch_cfg: dict[str, Any], required_unlock: str) -> int | None:
        mapping = patch_cfg.get("max_changes_by_required_unlock") or {}
        if not isinstance(mapping, dict):
            return None
        val = mapping.get(required_unlock)
        if val is None:
            return None
        try:
            return int(val)
        except Exception:
            return None

    def _send_json(self, code: int, payload: dict) -> None:
        data: bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, filepath: str, content_type: str) -> None:
        if not os.path.exists(filepath):
            self.send_error(404, "Not found")
            return
        with open(filepath, "rb") as f:
            body: bytes = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        sys.stdout.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), format % args))

    def do_GET(self) -> None:
        global APP
        assert APP is not None

        parsed: ParseResult = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self._send_file(APP.html_path, "text/html; charset=utf-8")
            return

        if parsed.path == "/state":
            self._send_json(200, APP.model.get_state())
            return

        if parsed.path == "/config/reload":
            APP.reload_config()
            self._send_json(200, {"ok": True, "message": "Config reloaded."})
            return

        self.send_error(404, "Not found")

    def _read_json(self) -> tuple[dict, str | None]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw: bytes = self.rfile.read(length)
            return json.loads(raw.decode("utf-8")), None
        except Exception as e:
            return {}, f"Invalid JSON: {e}"

    def do_POST(self) -> None:
        global APP
        assert APP is not None

        parsed: ParseResult = urlparse(self.path)

        if parsed.path == "/submit":
            req, err = self._read_json()
            if err:
                self._send_json(400, {"ok": False, "error": err})
                return

            text = (req.get("text") or "").strip()
            expected_intent = (req.get("expected_intent") or "").strip() or None
            requested_action = (req.get("requested_action") or "").strip() or None
            code = req.get("code")
            tests = req.get("tests")

            if not text and not (code and str(code).strip()):
                self._send_json(400, {"ok": False, "error": "Provide either text or code."})
                return

            report: ScoreReport = APP.model.evaluate(
                text=text or "(no-text)",
                expected_intent=expected_intent,
                code=str(code) if code is not None else None,
                tests=str(tests) if tests is not None else None,
                requested_action=requested_action,
            )

            APP.data.log_event(
                text=text or "(no-text)",
                predicted_intent=report.predicted_intent,
                expected_intent=report.expected_intent,
                score=report.total_score,
                breakdown=report.breakdown,
                unlocks=report.unlocks,
            )

            APP.model.update_progress(report)

            if not report.allowed:
                self._send_json(
                    403,
                    {
                        "ok": False,
                        "error": "Capability locked",
                        "message": f"Action '{report.requested_action}' requires '{report.required_unlock}' which is not unlocked yet.",
                        "report": report.to_dict(),
                        "state": APP.model.get_state(),
                    },
                )
                return

            self._send_json(200, {"ok": True, "report": report.to_dict(), "state": APP.model.get_state()})
            return

        if parsed.path == "/edit":
            req, err = self._read_json()
            if err:
                self._send_json(400, {"ok": False, "error": err})
                return

            text = (req.get("text") or "").strip() or "(no-text)"
            expected_intent = (req.get("expected_intent") or "").strip() or None
            requested_action = (req.get("requested_action") or "").strip() or None
            tests = req.get("tests")

            filename = str(req.get("filename") or "output_script.py")

            if "diff" in req and "base_code" in req:
                base_code = str(req.get("base_code") or "")
                diff_text = str(req.get("diff") or "")
                write_token = str(req.get("write_token") or "")
                op = "edit_apply_unified_diff"

                report: ScoreReport = APP.model.evaluate(
                    text=text,
                    expected_intent=expected_intent,
                    code=None,
                    tests=None,
                    requested_action=requested_action,
                )

                if not report.allowed:
                    self._send_json(
                        403,
                        {
                            "ok": False,
                            "error": "Capability locked",
                            "message": f"Action '{report.requested_action}' requires '{report.required_unlock}' which is not unlocked yet.",
                            "report": report.to_dict(),
                            "state": APP.model.get_state(),
                        },
                    )
                    return

                stats: dict[str, int] = self._diff_stats(diff_text)
                max_changes: int | None = self._max_changes_for_unlock(APP.patch_cfg, report.required_unlock)
                if max_changes is not None and stats["total_changes"] > max_changes:
                    self._send_json(
                        403,
                        {
                            "ok": False,
                            "error": "patch_too_large",
                            "message": f"Patch exceeds authority limit for '{report.required_unlock}': {stats['total_changes']} changes (max {max_changes}).",
                            "filename": filename,
                            "stats": stats,
                            "report": report.to_dict(),
                            "state": APP.model.get_state(),
                        },
                    )
                    return

                if bool(APP.patch_cfg.get("require_write_token", True)):
                    ok, why = APP.verify_write_token(
                        token=write_token,
                        op=op,
                        required_unlock=report.required_unlock,
                        filename=filename,
                        base_code=base_code,
                        diff_text=diff_text,
                    )
                    if not ok:
                        self._send_json(
                            401,
                            {
                                "ok": False,
                                "error": "write_token_required",
                                "reason": why,
                                "message": "Write token required to apply patches. Generate a patch first to receive a supervisor-issued token.",
                                "token_target": {"op": op, "required_unlock": report.required_unlock, "filename": filename, "base_hash": sha256_text(base_code), "diff_hash": sha256_text(diff_text)},
                                "report": report.to_dict(),
                                "state": APP.model.get_state(),
                            },
                        )
                        return

                pr: PatchResult = APP.editor.apply_unified_diff(old_text=base_code, diff_text=diff_text)
                if not pr.ok or pr.new_text is None:
                    APP.data.log_patch(
                        requested_action=report.requested_action,
                        required_unlock=report.required_unlock,
                        allowed=True,
                        old_hash=sha256_text(base_code),
                        new_hash=sha256_text(base_code),
                        diff_text=diff_text,
                        meta={"op": "apply", "error": pr.error},
                    )
                    self._send_json(400, {"ok": False, "error": "Patch apply failed", "details": pr.error})
                    return

                APP.data.log_patch(
                    requested_action=report.requested_action,
                    required_unlock=report.required_unlock,
                    allowed=True,
                    old_hash=sha256_text(base_code),
                    new_hash=sha256_text(pr.new_text),
                    diff_text=diff_text,
                    meta={"op": "apply"},
                )

                wrote_file = False
                if bool(APP.patch_cfg.get("write_to_file", True)):
                    try:
                        target: Path = APP.resolve_workspace_path(filename)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_text(pr.new_text, encoding="utf-8")
                        wrote_file = True
                    except Exception as e:
                        self._send_json(400, {"ok": False, "error": "file_write_failed", "message": str(e), "filename": filename})
                        return

                self._send_json(
                    200,
                    {
                        "ok": True,
                        "applied": True,
                        "new_code": pr.new_text,
                        "filename": filename,
                        "wrote_file": wrote_file,
                        "stats": stats,
                        "report": report.to_dict(),
                        "state": APP.model.get_state(),
                    },
                )
                return

            old_code = str(req.get("old_code") or "")
            new_code = str(req.get("new_code") or "")

            if not old_code and filename:
                try:
                    target: Path = APP.resolve_workspace_path(filename)
                    if target.exists():
                        old_code: str = target.read_text(encoding="utf-8")
                except Exception as e:
                    self._send_json(400, {"ok": False, "error": "file_read_failed", "message": str(e), "filename": filename})
                    return

            max_chars = int(APP.patch_cfg.get("max_new_code_chars", 200000))
            if len(new_code) > max_chars:
                self._send_json(400, {"ok": False, "error": f"new_code too large (>{max_chars} chars)."})
                return

            if not old_code and not new_code:
                self._send_json(400, {"ok": False, "error": "Provide old_code and new_code."})
                return

            report = APP.model.evaluate(
                text=text,
                expected_intent=expected_intent,
                code=old_code,
                tests=str(tests) if tests is not None else None,
                requested_action=requested_action,
            )

            if not report.allowed:
                APP.data.log_patch(
                    requested_action=report.requested_action,
                    required_unlock=report.required_unlock,
                    allowed=False,
                    old_hash=sha256_text(old_code),
                    new_hash=sha256_text(old_code),
                    diff_text="",
                    meta={"op": "generate", "blocked": True},
                )
                self._send_json(
                    403,
                    {
                        "ok": False,
                        "error": "Capability locked",
                        "message": f"Action '{report.requested_action}' requires '{report.required_unlock}' which is not unlocked yet.",
                        "report": report.to_dict(),
                        "state": APP.model.get_state(),
                    },
                )
                return

            require_pass = bool(APP.patch_cfg.get("require_code_eval_pass", True))
            if require_pass:
                ce: dict[str, Any] | None = report.code_eval
                if not ce or not bool(ce.get("ok", False)):
                    APP.data.log_patch(
                        requested_action=report.requested_action,
                        required_unlock=report.required_unlock,
                        allowed=True,
                        old_hash=sha256_text(old_code),
                        new_hash=sha256_text(old_code),
                        diff_text="",
                        meta={"op": "generate", "blocked_reason": "code_eval_not_ok"},
                    )
                    self._send_json(
                        400,
                        {
                            "ok": False,
                            "error": "Code evaluation did not pass; patch generation blocked by policy.",
                            "report": report.to_dict(),
                            "state": APP.model.get_state(),
                        },
                    )
                    return

            diff_text: str = APP.editor.generate_unified_diff(old_text=old_code, new_text=new_code)
            old_h: str = sha256_text(old_code)
            new_h: str = sha256_text(new_code)

            stats: dict[str, int] = self._diff_stats(diff_text)
            max_changes: int | None = self._max_changes_for_unlock(APP.patch_cfg, report.required_unlock)
            if max_changes is not None and stats["total_changes"] > max_changes:
                self._send_json(
                    403,
                    {
                        "ok": False,
                        "error": "patch_too_large",
                        "message": f"Patch exceeds authority limit for '{report.required_unlock}': {stats['total_changes']} changes (max {max_changes}).",
                        "filename": filename,
                        "stats": stats,
                        "report": report.to_dict(),
                        "state": APP.model.get_state(),
                    },
                )
                return

            write_token: str | None = None
            ttl: int | None = None
            op = "edit_apply_unified_diff"
            if bool(APP.patch_cfg.get("require_write_token", True)):
                write_token, ttl = APP.issue_write_token(op=op, required_unlock=report.required_unlock, filename=filename, base_code=old_code, diff_text=diff_text)

            APP.data.log_patch(
                requested_action=report.requested_action,
                required_unlock=report.required_unlock,
                allowed=True,
                old_hash=old_h,
                new_hash=new_h,
                diff_text=diff_text,
                meta={"op": "generate"},
            )

            self._send_json(
                200,
                {
                    "ok": True,
                    "filename": filename,
                    "base_code": old_code,
                    "diff": diff_text,
                    "old_hash": old_h,
                    "new_hash": new_h,
                    "write_token": write_token,
                    "expires_in_sec": ttl,
                    "token_target": {"op": op, "required_unlock": report.required_unlock, "filename": filename, "base_hash": old_h, "diff_hash": sha256_text(diff_text)},
                    "stats": stats,
                    "report": report.to_dict(),
                    "state": APP.model.get_state(),
                },
            )
            return

        self.send_error(404, "Not found")


def run_server(host: str, port: int, config_path: str) -> None:
    global APP
    APP = App(config_path=config_path)
    httpd = HTTPServer((host, port), Handler)
    print(f"Serving on http://{host}:{port}")
    print("GET  /, /state, /config/reload")
    print("POST /submit (training)")
    print("POST /edit   (generate/apply patches; gated)")
    print("")
    httpd.serve_forever()


def main() -> int:
    config_path: str = os.path.join(BASE_DIR, "config.json")
    host = "127.0.0.1"
    port = 8000

    if len(sys.argv) >= 2:
        host: str = sys.argv[1]
    if len(sys.argv) >= 3:
        port = int(sys.argv[2])

    run_server(host=host, port=port, config_path=config_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
