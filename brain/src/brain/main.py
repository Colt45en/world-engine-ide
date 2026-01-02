import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Tuple
from urllib.parse import urlparse
from pathlib import Path

from brain.learning_model import LearningModel
import difflib


def json_response(handler: BaseHTTPRequestHandler, code: int, body: dict):
    b = json.dumps(body).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(b)))
    handler.end_headers()
    handler.wfile.write(b)


class SimpleRequestHandler(BaseHTTPRequestHandler):
    model = LearningModel()

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        data = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(data)
        except Exception:
            return {}

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/analyze":
            payload = self._read_json()
            intent = payload.get("intent")
            score = payload.get("score")
            report = self.model.evaluate(intent=intent, score=score)
            out = {
                "allowed": report.allowed,
                "requested_action": report.requested_action,
                "required_unlock": report.required_unlock,
                "score": report.score,
                "details": report.details,
            }
            if not report.allowed:
                return json_response(self, 403, out)
            return json_response(self, 200, out)

        elif parsed.path == "/edit":
            payload = self._read_json()
            intent = payload.get("intent")
            score = payload.get("score")
            original = payload.get("original", "")
            candidate = payload.get("candidate", "")

            report = self.model.evaluate(intent=intent, score=score)
            if not report.allowed:
                return json_response(self, 403, {"error": "action locked", "report": out})

            # generate unified diff
            orig_lines = original.splitlines(keepends=True)
            cand_lines = candidate.splitlines(keepends=True)
            udiff = list(difflib.unified_diff(orig_lines, cand_lines, fromfile="original", tofile="candidate"))
            patch_text = "".join(udiff)

            # In production this would call editor_engine.apply_unified_diff and data_processor.log_patch
            return json_response(self, 200, {"status": "applied", "patch": patch_text})

        else:
            return json_response(self, 404, {"error": "not found"})


def run(host: str = "127.0.0.1", port: int = 8000) -> Tuple[HTTPServer, SimpleRequestHandler]:
    server = HTTPServer((host, port), SimpleRequestHandler)
    print(f"Starting server at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down server")
        server.shutdown()
    return server, SimpleRequestHandler


if __name__ == "__main__":
    run()
