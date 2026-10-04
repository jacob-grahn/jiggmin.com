import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('generic bake preflight rejects unverified, missing and collapsed material UVs',()=>{
 execFileSync('python3',['-m','unittest','discover','-s','tests','-p','test_house_bake_uv_guard.py'],{stdio:'pipe'});
});
