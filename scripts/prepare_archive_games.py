"""Rebuild repaired playback SWFs; originals and soundtrack files stay untouched.

Uses Python's standard library; no Adobe tools or decompiler required.
"""
import argparse
import hashlib
import struct
import zlib
from pathlib import Path
from swf_abc_compat import return_true_body, replace_abc_string

ROOT = Path(__file__).resolve().parents[1]
PATCHES = {
    'the-great-red-herring-chase': ('e6678413e9755d7092ef9b2db81aad7f7ffe9c7d2add0cfa7e65968ebd99e67e', 'allowedURL'),
    'musical-evenizer': ('99f62056f9d4a160ccd90a52cb79ba3bb5d448e007ff5a578d4cc7ebdd672ba4', '_i_----_'),
}
SONG_SOURCE = 'https://jiggmin2.com/games/musical-evenizer/files/songList.php'
SONG_LOCAL = '/games/musical-evenizer/song-list.txt'


def build(slug, raw):
    expected, method = PATCHES[slug]
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError(f'{slug}: original SWF changed; refusing to guess')
    body = return_true_body(raw, method)
    if slug == 'musical-evenizer':
        body = replace_abc_string(body, SONG_SOURCE, SONG_LOCAL)
    return raw[:4] + struct.pack('<I', len(body) + 8) + zlib.compress(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-root', type=Path, default=ROOT,
                        help='Write games/<slug>/game.swf beneath this directory')
    args = parser.parse_args()
    for slug in PATCHES:
        original = ROOT / 'games' / slug / f'{slug}.swf'
        output = args.output_root / 'games' / slug / 'game.swf'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(build(slug, original.read_bytes()))
        print(f'Rebuilt {output}')


if __name__ == '__main__':
    main()
