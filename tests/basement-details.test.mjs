import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('basement joists and pendant reach the ceiling and the pipe clears the windows',()=>{
 for(const path of ['scene/exports/house/basement.glb','web/assets/house/basement-baked.glb']){
  const bytes=readFileSync(path),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const yBounds=node=>doc.meshes[node.mesh].primitives.map(p=>doc.accessors[p.attributes.POSITION]);
  for(const node of doc.nodes.filter(n=>n.name.startsWith('Basement ceiling joist'))){
   const ys=yBounds(node);assert.ok(Math.max(...ys.map(a=>a.max[1]))>=3.81);assert.ok(Math.min(...ys.map(a=>a.min[1]))>3.68);
  }
  const stem=yBounds(doc.nodes.find(n=>n.name==='Lamp stem'));assert.ok(Math.max(...stem.map(a=>a.max[1]))>=3.83);
  const pipe=yBounds(doc.nodes.find(n=>n.name==='Copper water pipe'));assert.ok(Math.max(...pipe.map(a=>a.max[1]))>3.6);
 }
});
