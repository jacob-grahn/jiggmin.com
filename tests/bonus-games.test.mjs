import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('Inkclipse keeps its archived original and has transparent Up states with intact hit areas', async () => {
  const original = await readFile(path.join(root, 'games/bonus/inkclipse/original.swf'));
  assert.equal(hash(original), '7e4af89337908850aec5c8c15f91249ddaba415f32f131d9687dc0b24f13b416');
  const metadata = JSON.parse(await readFile(path.join(root, 'data/bonus-games.json'), 'utf8')).games.find(game => game.id === 'inkclipse');
  const playback = await readFile(path.join(root, metadata.file));
  assert.equal(playback.length, metadata.bytes);
  assert.equal(hash(playback), metadata.sha256);
  const inspection = execFileSync('python3', ['-c', `
import sys,struct,zlib
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'scripts'))
from swf_button_compat import tags,body_header_length,button_records
def menu(file):
 raw=Path(file).read_bytes();body=zlib.decompress(raw[8:]);result={}
 assert struct.unpack_from('<I',raw,4)[0]==len(body)+8
 def walk(data,offset):
  for kind,tag,header in tags(data,offset):
   if kind==39:walk(tag,4)
   if kind==34 and struct.unpack_from('<H',tag)[0] in (42,43):
    result[struct.unpack_from('<H',tag)[0]]=button_records(tag)[0]
 walk(body,body_header_length(body));return result
old=menu('games/bonus/inkclipse/original.swf');new=menu('games/bonus/inkclipse/game.swf')
assert old.keys()==new.keys()=={42,43}
for button in old:
 assert len(old[button])==1 and old[button][0]['flags']==8
 assert len(new[button])==2
 up,hit=new[button]
 assert hit['raw']==old[button][0]['raw'], 'Original hit geometry or transform changed'
 assert up['flags']==1 and up['character']==hit['character']==41
 assert up['prefix'][1:]==hit['prefix'][1:], 'Up state changed geometry'
 assert up['multipliers']==[256,256,256,0] and up['offsets'] is None
print('transparent states and original hit records verified')
`], {cwd:root, encoding:'utf8'});
  assert.match(inspection, /verified/);
});

test('bonus playback rebuild is deterministic and leaves originals untouched', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'jiggmin-bonus-'));
  try {
    const destination = path.join(temporary, 'games/bonus/inkclipse');
    await mkdir(destination, {recursive:true});
    await copyFile(path.join(root, 'games/bonus/inkclipse/original.swf'), path.join(destination, 'original.swf'));
    const script = path.join(root, 'scripts/prepare_bonus_games.py');
    execFileSync('python3', [script], {cwd:temporary});
    const first = await readFile(path.join(destination, 'game.swf'));
    execFileSync('python3', [script], {cwd:temporary});
    const second = await readFile(path.join(destination, 'game.swf'));
    assert.deepEqual(first, second);
    assert.deepEqual(first, await readFile(path.join(root, 'games/bonus/inkclipse/game.swf')));
    assert.equal(hash(await readFile(path.join(destination, 'original.swf'))), '7e4af89337908850aec5c8c15f91249ddaba415f32f131d9687dc0b24f13b416');
  } finally { await rm(temporary, {recursive:true, force:true}); }
});
