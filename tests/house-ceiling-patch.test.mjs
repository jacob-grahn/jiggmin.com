import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceMaskedPixels} from '../scripts/patch-house-ceiling-bake.mjs';
test('ceiling rebake patch leaves unselected and neighboring surface pixels unchanged',()=>{
 const before=Buffer.from([1,2,3,4,5,6,7,8,9,10,11,12]);
 const replacement=Buffer.from([21,22,23,24,25,26,27,28,29,30,31,32]);
 const result=replaceMaskedPixels(before,replacement,3,new Uint8Array([1,1,0,1]),new Uint8Array([0,1,0,0]));
 assert.deepEqual(result.out,Buffer.from([21,22,23,4,5,6,7,8,9,30,31,32]));
 assert.equal(result.changed,2);assert.deepEqual(before,Buffer.from([1,2,3,4,5,6,7,8,9,10,11,12]));
});
