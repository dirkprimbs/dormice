#!/usr/bin/env python3
"""Local server for development. Tells the browser to re-check every file, so a
reload never mixes old and new modules."""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', 8377), handler) as srv:
        print('Dormice at http://127.0.0.1:8377')
        srv.serve_forever()
