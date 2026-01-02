import http.client
import json
import socket
from typing import Any
import unittest

SERVER_HOST = '127.0.0.1'
SERVER_PORT = 8000


def is_port_open(host, port, timeout=0.5) -> bool:
    s = socket.socket()
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False


@unittest.skipUnless(is_port_open(SERVER_HOST, SERVER_PORT), "Server not running on localhost:8000")
class IntegrationServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = http.client.HTTPConnection(SERVER_HOST, SERVER_PORT, timeout=2)

    def tearDown(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    def post_json(self, path, payload) -> tuple[int, Any | dict[str, str]]:
        self.conn.request('POST', path, body=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
        r: http.client.HTTPResponse = self.conn.getresponse()
        data: str = r.read().decode('utf-8')
        try:
            body = json.loads(data) if data else {}
        except Exception:
            body: dict[str, str] = {'raw': data}
        return r.status, body

    def test_submit_training_sample(self) -> None:
        status, body = self.post_json('/submit', {'text': 'create function add', 'expected_intent': 'python.generate_code'})
        self.assertEqual(status, 200)
        self.assertIn('report', body)

    def test_generate_patch_blocked_or_allowed(self) -> None:
        # Attempt to generate a refactor patch; may be 200 or 403 depending on state
        status, _ = self.post_json('/edit', {'text': 'refactor', 'requested_action': 'refactor', 'old_code': 'def f():\n    return 1\n', 'new_code': 'def f(x):\n    return x\n'})
        self.assertIn(status, (200, 403))


if __name__ == '__main__':
    unittest.main()
