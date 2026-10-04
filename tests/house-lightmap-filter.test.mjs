import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const bundled='/Applications/Blender.app/Contents/Resources/4.5/python/bin/python3.11';
const python=process.env.BLENDER_PYTHON??(existsSync(bundled)?bundled:'python3');
test('irradiance speckle detection, historical trim regression, and UV chart isolation',t=>{
 const probe=spawnSync(python,['-c','import numpy'],{encoding:'utf8'});
 if(probe.status!==0){t.skip('Set BLENDER_PYTHON to a Python with NumPy (bundled with Blender).');return;}
 const result=spawnSync(python,['-m','unittest','discover','-s','tests','-p','test_house_lightmap_filter.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
