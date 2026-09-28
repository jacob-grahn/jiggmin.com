"""Local static preview with direct /slug support, matching generated game pages."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
from pathlib import Path
from build_routes import game_slugs
import argparse

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, request, client_address, server, **kwargs):
        super().__init__(request, client_address, server, directory=str(server.site_root), **kwargs)

    def translate_path(self, path):
        slug = unquote(urlsplit(path).path).strip('/')
        if slug in self.server.game_slugs:
            return str(self.server.site_root / 'index.html')
        return super().translate_path(path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true', help='Serve original exports and comparison fixtures')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    site_root = ROOT if args.source else ROOT / 'dist'
    if not (site_root / 'index.html').exists():
        parser.error('Run npm run build before previewing production output')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.site_root = site_root
    server.game_slugs = game_slugs()
    print(f'Midnight Den ({"source" if args.source else "balanced build"}): http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
