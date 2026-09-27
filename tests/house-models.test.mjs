import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const anchors=JSON.parse(readFileSync('web/assets/house/anchors.json'));
const hotspots=JSON.parse(readFileSync('web/assets/house/hotspots.json'));
for(const room of ['hallway','workshop','attic','basement']){
 test(`${room} has browser geometry, an authored camera, and world-space interaction anchors`,()=>{
  const bytes=readFileSync(`web/assets/house/${room}.glb`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.ok(bytes.length<15*1024*1024,'room exceeds lazy-load budget');
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(model.meshes.length>20,'room must contain modeled objects');
  assert.equal(model.cameras.length,1);
  assert.ok(model.cameras[0].perspective.yfov>0);
  for(const {id} of hotspots[room]){
   assert.equal(anchors[room][id].position.length,3);
   assert.ok(anchors[room][id].position.every(Number.isFinite));
   assert.ok(model.nodes.some(node=>node.extras?.hotspot===id),`${id} lacks model geometry`);
  }
  const detailed=model.nodes.filter(n=>n.mesh!==undefined&&n.extras?.detail_revision===1);
  const eligible=model.nodes.filter(n=>n.mesh!==undefined&&model.meshes[n.mesh].primitives.some(p=>model.materials[p.material]?.extras?.surface_finish));
  assert.ok(detailed.length>100);
  assert.ok(eligible.every(n=>n.extras?.detail_revision===1),'surface pass missed room objects');
  for(const material of model.materials.filter(m=>m.extras?.surface_finish)){
   assert.ok(material.normalTexture,'surface relief must survive glTF export');
   assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture,'surface wear must retain varying roughness');
  }
  for(const material of model.materials.filter(m=>['wood','oak','pale'].includes(m.name))){
   assert.ok(material.pbrMetallicRoughness.baseColorTexture || material.pbrMetallicRoughness.baseColorFactor[0]<.5,'procedural wood lost its color');
  }
 });
}
