"""Assemble a self-contained static site under dist/, including game deep links."""
import json
import argparse
import shutil
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist'

def hydrate_release_exports():
    """A CI clone may leave LFS pointers; hydrate only browser source exports."""
    release = ROOT / 'web/assets/house/release'
    pointers = [path for path in release.rglob('*.glb')
                if path.stat().st_size < 1024 and
                path.read_bytes().startswith(b'version https://git-lfs.github.com/spec/v1')]
    if not pointers:
        return
    subprocess.run(['git', 'lfs', 'pull', '--include=web/assets/house/release/**', '--exclude='],
                   cwd=ROOT, check=True)
    for path in pointers:
        with path.open('rb') as source:
            if source.read(4) != b'glTF':
                raise RuntimeError(f'Git LFS did not restore {path.relative_to(ROOT)}')

def game_slugs():
    games = json.loads((ROOT / 'data/games.json').read_text())['games']
    bonus = json.loads((ROOT / 'data/bonus-games.json').read_text())['games']
    slugs = {game['id'] for game in games + bonus}
    for slug in slugs:
        if not slug or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in slug):
            raise ValueError(f'Invalid route slug: {slug}')
    return slugs

def build(output=OUTPUT, atlas_masters=False):
    output = Path(output).resolve()
    if output == ROOT or output in ROOT.parents or output.is_relative_to(ROOT / 'web'):
        raise ValueError('Build output must not overwrite source files')
    hydrate_release_exports()
    excluded = set() if atlas_masters else set(json.loads((ROOT / "scripts/production-asset-exclusions.json").read_text()))
    slugs = game_slugs()
    if not (ROOT / 'games').is_dir():
        raise FileNotFoundError('Restore the local games/ archive before building. See README.md.')
    subprocess.run(['node', str(ROOT / 'scripts/split-house-structure.mjs')], cwd=ROOT, check=True)
    output.mkdir(parents=True, exist_ok=True)
    html = (ROOT / 'index.html').read_text()
    (output / 'index.html').write_text(html)
    def ignore_source_assets(directory, names):
        ignored = {name for name in names if name in {'.DS_Store', '__pycache__'}}
        for name in names:
            path = Path(directory) / name
            if path.is_relative_to(ROOT / 'web/assets') and path.relative_to(ROOT / 'web/assets').as_posix() in excluded:
                ignored.add(name)
        return ignored
    for folder in ['web', 'data', 'games']:
        # Replace generated trees so removed source assets cannot survive a rebuild.
        if (output / folder).exists():
            shutil.rmtree(output / folder)
        shutil.copytree(ROOT / folder, output / folder, dirs_exist_ok=True,
                        ignore=ignore_source_assets)
    if not atlas_masters:
        layout_path = output / 'web/assets/house/release/layout.json'
        layout = json.loads(layout_path.read_text())
        layout.get('assets', {}).pop('structure', None)
        layout.pop('fixedFixtures', None)  # Already included in streamed room shells.
        layout_path.write_text(json.dumps(layout, indent=2) + '\n')
    for slug in slugs:
        directory = output / slug
        directory.mkdir(exist_ok=True)
        (directory / 'index.html').write_text(html)
    # Compression failures fail the build instead of silently publishing source GLBs.
    subprocess.run(['node', str(ROOT / 'scripts/compress-assets.mjs'), '--production',
                    '--output', str(output / 'web/assets'),
                    *(['--atlas-masters'] if atlas_masters else [])], cwd=ROOT, check=True)
    return slugs

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atlas-masters', action='store_true', help='Preserve embedded source textures without resizing or WebP encoding')
    args = parser.parse_args()
    output = ROOT / 'dist-atlas-masters' if args.atlas_masters else OUTPUT
    print(f'Built {output.name}/ with {len(build(output, args.atlas_masters))} static game routes.')
