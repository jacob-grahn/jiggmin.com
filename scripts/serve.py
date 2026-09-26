"""Local static preview with direct /slug support, matching generated game pages."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
from pathlib import Path
from build_routes import game_slugs

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        slug = unquote(urlsplit(path).path).strip('/')
        if slug in self.server.game_slugs:
            return str(ROOT / 'index.html')
        return super().translate_path(path)

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8000), Handler)
    server.game_slugs = game_slugs()
    print('Midnight Den: http://127.0.0.1:8000', flush=True)
    server.serve_forever()
