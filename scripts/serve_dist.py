#!/usr/bin/env python3
"""Serve the Vite production build (`dist/`) with SPA fallback.

Goals:
- Zero third-party dependencies (stdlib only)
- SPA history fallback (deep links load `index.html`)
- Cache headers for hashed assets under `/assets/`

Usage:
  python scripts/serve_dist.py
  python scripts/serve_dist.py --port 5173 --host 0.0.0.0
  python scripts/serve_dist.py --open
"""

from __future__ import annotations

import argparse
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket


class SpaFallbackHandler(SimpleHTTPRequestHandler):
    """Static file handler with SPA fallback to /index.html."""

    def end_headers(self) -> None:
        request_path: str = self.path.split('?', 1)[0]

        # Cache policy:
        # - index.html: no-cache (so deployments update immediately)
        # - hashed assets: immutable (best caching)
        # - everything else: modest cache
        if request_path == '/' or request_path.endswith('.html'):
            self.send_header('Cache-Control', 'no-cache')
        elif request_path.startswith('/assets/'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control', 'public, max-age=3600')

        super().end_headers()

    def do_GET(self) -> None:
        # If a real file exists, serve it.
        translated = Path(self.translate_path(self.path))
        if translated.exists():
            super().do_GET()
            return

        # If the request looks like it was for a file (has an extension), do not
        # fall back to index.html; return 404 so missing assets fail loudly.
        request_path: str = self.path.split('?', 1)[0]
        if Path(request_path).suffix:
            self.send_error(404, 'File not found')
            return

        # SPA history fallback.
        self.path = '/index.html'
        super().do_GET()


def main(argv: list[str]) -> int:
    repo_root: Path = Path(__file__).resolve().parents[1]
    dist_dir: Path = repo_root / 'dist'

    parser = argparse.ArgumentParser(description='Serve Vite dist/ with SPA fallback')
    parser.add_argument('--host', default='127.0.0.1', help='Bind host (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=4173, help='Bind port (default: 4173)')
    parser.add_argument('--dir', default=str(dist_dir), help='Directory to serve (default: dist/)')
    parser.add_argument('--open', action='store_true', help='Open the server URL in your browser')
    args: argparse.Namespace = parser.parse_args(argv)

    serve_dir: Path = Path(args.dir).resolve()
    index_file: Path = serve_dir / 'index.html'
    if not index_file.exists():
        print(f"ERROR: {index_file} not found.", file=sys.stderr)
        print("Build the frontend first: npm run build", file=sys.stderr)
        return 2

    def make_handler(directory: Path) -> type[SpaFallbackHandler]:
        class BoundHandler(SpaFallbackHandler):
            def __init__(
                self,
                request: socket.socket,
                client_address: tuple[str, int],
                server: ThreadingHTTPServer,
            ) -> None:
                super().__init__(
                    request,
                    client_address,
                    server,
                    directory=str(directory),
                )

        return BoundHandler

    httpd = ThreadingHTTPServer((args.host, args.port), make_handler(serve_dir))

    url: str = f"http://{args.host}:{args.port}/"
    print(f"Serving {serve_dir} at {url}")

    if args.open:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down…")
        return 0

    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
