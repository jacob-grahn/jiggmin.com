import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';

test('cellar moonlight starts clear of the opaque masonry and window backdrops',async()=>{
 const script=readFileSync('scene/scripts/house_bake_lighting.py','utf8');
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('web/assets/house/release/basement.glb'),occluders=[];
 for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().release_baked))for(const p of n.getMesh().listPrimitives()){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p.getAttribute('POSITION').getArray(),3));
  if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.name=n.getName();m.applyMatrix4(new THREE.Matrix4().fromArray(n.getWorldMatrix()));m.updateMatrixWorld();occluders.push(m);
 }
 const convert=s=>{const [x,y,z]=s.split(',').map(Number);return new THREE.Vector3(x,z,-y);};
 for(const name of ['left','right','side']){
  const args=script.match(new RegExp(`area\\('Cellar ${name} window spill',\\(([^)]+)\\),\\(([^)]+)\\)`));assert.ok(args);
  const origin=convert(args[1]),direction=convert(args[2]).sub(origin).normalize();
  const hits=new THREE.Raycaster(origin,direction,.001,.3).intersectObjects(occluders);
  assert.equal(hits.length,0,`${name} window moonlight is blocked at its source by ${hits[0]?.object.name}`);
 }
});
