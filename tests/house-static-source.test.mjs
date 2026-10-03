import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import {editModel} from '../scripts/house-source/model-editor.mjs';
import {floorTexture} from '../scripts/house-source/floor-texture.mjs';
import sharp from 'sharp';
test('source editor retains material ownership, transforms and UVs while removing empty geometry',async()=>{
 const d=new Document(),buffer=d.createBuffer(),scene=d.createScene(),mat=d.createMaterial('original');
 const primitive=()=>d.createPrimitive().setAttribute('POSITION',d.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer)).setAttribute('TEXCOORD_0',d.createAccessor().setType('VEC2').setArray(new Float32Array([0,0,1,0,0,1])).setBuffer(buffer)).setMaterial(mat);
 const parent=d.createNode('parent').setTranslation([3,4,5]),child=d.createNode('surface').setMesh(d.createMesh().addPrimitive(primitive()));scene.addChild(parent);parent.addChild(child);
 const editor=editModel(d),surface=editor.root.getObjectByName('surface');surface.position.x=2;
 const empty=d.createNode('empty').setMesh(d.createMesh().addPrimitive(primitive()));scene.addChild(empty);
 const added=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:0}));added.name='authored detail';surface.add(added);editor.save();
 assert.deepEqual(child.getWorldMatrix().slice(12,15),[5,4,5]);assert.equal(child.getMesh().listPrimitives()[0].getMaterial(),mat);
 assert.deepEqual([...child.getMesh().listPrimitives()[0].getAttribute('TEXCOORD_0').getArray()],[0,0,1,0,0,1]);
 assert.equal(child.listChildren()[0].getName(),'authored detail');assert.ok(child.listChildren()[0].getExtras().house_authored_reflectance);
 const again=editModel(d);again.root.getObjectByName('empty').geometry.setAttribute('position',new THREE.Float32BufferAttribute([],3));again.save();assert.equal(empty.getMesh(),null);
 const bytes=await new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(d);assert.ok(bytes.length);
});
test('floor artwork is generated deterministically before baking',async()=>{
 const a=await floorTexture(128),b=await floorTexture(128);assert.deepEqual(a,b);
 const meta=await sharp(a).metadata();assert.equal(meta.width,128);assert.equal(meta.height,177);
 const stats=await sharp(a).stats();assert.ok(stats.channels[0].max-stats.channels[0].min>100);
});
test('production renderer contains no static source repair hooks',async()=>{
 const renderer=await readFile('web/house-release-renderer.js','utf8');
 for(const hook of ['integrateDenOpening','tidyHouseProps','refineRoomFixtures','replaceExteriorTrees','shadeBasementWindowSpills','addBasementDetails','applyHatchLighting','ceiling_paint'])assert.ok(!renderer.includes(hook),hook);
 const sky=await readFile('web/house-window-sky.js','utf8');assert.ok(!sky.includes('cutWindowOpenings'));assert.ok(!sky.includes('createWindowTrees'));
});

test('prepared concrete floor has diffuse artwork and finite source UVs',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('scene/exports/house-release/bake-input/basement.glb');
 const floor=doc.getRoot().listNodes().find(n=>n.getName()==='Concrete slab');assert.ok(floor?.getExtras().house_authored_reflectance);
 for(const p of floor.getMesh().listPrimitives()){
  const m=p.getMaterial();assert.equal(m.getMetallicFactor(),0);assert.ok(m.getBaseColorTexture());
  assert.ok([...p.getAttribute('TEXCOORD_0').getArray()].every(Number.isFinite));
 }
});
