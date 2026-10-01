import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';import sharp from 'sharp';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {applyHatchLighting} from '../web/house-hatch-lighting.js';
globalThis.ProgressEvent??=class{};
const path='web/assets/house/release/attic-hatch-lighting.glb';
const hash=b=>createHash('sha256').update(b).digest('hex');
function triangles(node){
 const result=[],matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 for(const p of node.getMesh().listPrimitives()){
  const position=p.getAttribute('POSITION'),indices=p.getIndices();
  for(let i=0;i<(indices?.getCount()??position.getCount());i+=3)result.push([0,1,2].map(k=>new THREE.Vector3(...position.getElement(indices?indices.getScalar(i+k):i+k,[])).applyMatrix4(matrix).toArray().map(v=>Math.round(v*10000)).join(',')).sort().join(';'));
 }
 return result.sort();
}
async function model(path){
 const b=readFileSync(path),n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n));d.buffers[0].uri=`data:application/octet-stream;base64,${b.subarray(28+n).toString('base64')}`;
 d.materials=[];for(const m of d.meshes)for(const p of m.primitives)delete p.material;delete d.images;delete d.textures;
 return (await new GLTFLoader().parseAsync(JSON.stringify(d),'')).scene;
}
test('hatch reference lighting retains its reviewed geometry, painted grain and actual baked shading',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(path),shell=await io.read('web/assets/house/release/structure.glb');
 const patch=doc.getRoot().listNodes().find(n=>n.getMesh()),original=shell.getRoot().listNodes().find(n=>n.getName()==='Attic hatch');
 assert.deepEqual(triangles(patch),triangles(original));assert.equal(patch.getExtras().release_dynamic,true);
 const material=patch.getMesh().listPrimitives()[0].getMaterial(),image=material.getEmissiveTexture().getImage(),stats=await sharp(image).stats();
 assert.ok(stats.channels.some(c=>c.max-c.min>25),'bake must have visible lighting variation');
 assert.ok(patch.getMesh().listPrimitives().every(p=>p.getAttribute('TEXCOORD_0')));
 const report=JSON.parse(readFileSync('docs/house-plan/attic-hatch-bake-report.json')),layout=JSON.parse(readFileSync('web/assets/house/release/layout.json'));
 assert.equal(report.samples,64);assert.equal(report.bakedGLBHash,hash(readFileSync(path)));assert.equal(report.houseSourceKey,layout.lightingBake.report.sourceKey);
 assert.ok(layout.hatchLighting.startsWith('/'+path+'?v='));
});
test('applying the hatch lightmap preserves the moving door and hinge transform',async()=>{
 const root=await model('web/assets/house/release/structure.glb'),reference=await model(path);
 let hatch;root.traverse(o=>{if(o.userData.house_bake_source==='Attic hatch')hatch=o;});
 const matrix=hatch.matrix.clone(),parent=hatch.parent;applyHatchLighting(root,reference);
 assert.deepEqual(hatch.matrix.toArray(),matrix.toArray());assert.equal(hatch.parent,parent);
 assert.equal(hatch.userData.door_id,'attic');assert.equal(hatch.userData.release_dynamic,true);assert.equal(hatch.userData.hatch_reference_baked,true);
 assert.ok(hatch.geometry.attributes.uv);assert.equal(hatch.userData.house_window_bake,undefined);
});
