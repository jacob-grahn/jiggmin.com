import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {playbackFile} from '../web/interaction.js';
const manifest=JSON.parse(readFileSync('data/games.json')).games;
const repaired=manifest.filter(g=>g.playback);
const hash=b=>createHash('sha256').update(b).digest('hex');

test('Repaired SWFs preserve originals, match manifest hashes, and rebuild deterministically',()=>{
 assert.equal(repaired.length,2);
 const dir=mkdtempSync(join(tmpdir(),'jiggmin-compat-'));
 try{
  for(let run=0;run<2;run++){
   execFileSync('python3',['scripts/prepare_archive_games.py','--output-root',dir]);
   for(const game of repaired){
    const original=readFileSync(game.file),patched=readFileSync(game.playback.file);
    assert.equal(hash(original),game.sha256,game.id+' original');
    assert.equal(hash(patched),game.playback.sha256);
    assert.equal(patched.length,game.playback.bytes);
    assert.deepEqual(readFileSync(join(dir,game.playback.file)),patched);
    assert.equal(patched.readUInt32LE(4),inflateSync(patched.subarray(8)).length+8);
    assert.equal(playbackFile(game),game.playback.file);
    assert.notDeepEqual(patched,original);
   }
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Patching refuses changed originals and missing method traits',()=>{
 execFileSync('python3',['-c',`
import sys
sys.path.insert(0, 'scripts')
from prepare_archive_games import build
from swf_abc_compat import return_true_body
from pathlib import Path
raw = Path('games/the-great-red-herring-chase/the-great-red-herring-chase.swf').read_bytes()
for action in (lambda: build('the-great-red-herring-chase', raw + b'x'), lambda: return_true_body(raw, 'nonexistent_method')):
    try: action()
    except ValueError: pass
    else: raise AssertionError('Unexpected input was accepted')
`]);
});

test('Evenizer soundtrack list and every MP3 are archived with integrity metadata',()=>{
 const songs=JSON.parse(readFileSync('games/musical-evenizer/songs.json')).songs;
 const list=readFileSync('games/musical-evenizer/song-list.txt','utf8');
 const entries=new URLSearchParams(list);
 assert.equal(songs.length,24);
 songs.forEach((song,i)=>{
  assert.equal(entries.get('url'+(i+1)).trim(),'/'+song.file);
  const bytes=readFileSync(song.file);
  assert.equal(bytes.length,song.bytes);
  assert.equal(hash(bytes),song.sha256);
 });
 const game=manifest.find(g=>g.id==='musical-evenizer');
 const body=inflateSync(readFileSync(game.playback.file).subarray(8));
 assert.ok(body.includes(Buffer.from('/games/musical-evenizer/song-list.txt')));
 assert.ok(!body.includes(Buffer.from('/files/songList.php')));
});
