import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
test('source finishing preserves original cellar timber and does not repaint floor undersides',t=>{
 const blender=process.env.BLENDER??'/Applications/Blender.app/Contents/MacOS/Blender';
 if(!existsSync(blender)){t.skip('Blender source-model check requires BLENDER');return;}
 const result=spawnSync(blender,['-b','--threads','1','--python-exit-code','1','--python','tests/check_house_ceiling_finish.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
