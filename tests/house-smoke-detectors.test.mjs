import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import sharp from 'sharp';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {groupHouseProps} from '../web/house-props.js';
globalThis.ProgressEvent??=class{};
const path='web/assets/house/release/smoke-detectors.glb';
test('three ceiling-mounted smoke detectors share an actual baked texture and have no live lights',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path),nodes=doc.getRoot().listNodes().filter(n=>n.getMesh());
 assert.equal(nodes.length,3);assert.equal(doc.getRoot().listTextures().length,1);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),ceilings=new THREE.Group();
 const models=await Promise.all(['structure','basement'].map(room=>io.read(`web/assets/house/release/${room}.glb`)));
 for(const n of models.flatMap(doc=>doc.getRoot().listNodes()).filter(n=>n.getMesh()&&/^(Attic floor \/ hall ceiling|Garage ceiling|Main floor|Basement ceiling|Cellar slab underside \/ Main floor)/.test(n.getName())))for(const p of n.getMesh().listPrimitives()){
  const g=new THREE.BufferGeometry(),a=p.getAttribute('POSITION');g.setAttribute('position',new THREE.BufferAttribute(a.getArray(),3));if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.applyMatrix4(new THREE.Matrix4().fromArray(n.getWorldMatrix()));ceilings.add(mesh);
 }
 ceilings.updateMatrixWorld(true);
 const positions={hallway:[10.3,2.6,7.55],garage:[14.8,2.6,1.5],basement:[3.36,-.2,2.4]};
 for(const node of nodes){
  const e=node.getExtras();assert.equal(e.bake_connection,true);assert.equal(e.release_dynamic,false);assert.equal(e.release_baked,'smoke-detectors');assert.equal(e.preview_kind,'fixture');assert.ok(!e.hotspot);
  const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),point=new THREE.Vector3().setFromMatrixPosition(matrix),nominal=new THREE.Vector3(...positions[e.house_smoke_detector]);assert.ok(Math.hypot(point.x-nominal.x,point.z-nominal.z)<1e-5);assert.ok(Math.abs(point.y-nominal.y)<.04);
  for(const [x,z] of [[0,0],[.05,0],[-.05,0],[0,.05],[0,-.05]]){
   const contact=new THREE.Vector3(x,0,z).applyMatrix4(matrix),origin=contact.clone().add(new THREE.Vector3(0,-.2,0)),hit=new THREE.Raycaster(origin,new THREE.Vector3(0,1,0),0,.3).intersectObject(ceilings,true)[0];
   assert.ok(hit&&Math.abs(hit.point.y-contact.y)<1e-5,`${e.house_smoke_detector}: mounting flange floats or crosses the ceiling`);
  }
  for(const p of node.getMesh().listPrimitives()){
   const uv=p.getAttribute('TEXCOORD_0'),texture=p.getMaterial().getEmissiveTexture();assert.ok(uv);assert.ok(texture);
   let low=1,high=0;for(let i=0;i<uv.getCount();i++){const u=uv.getElement(i,[])[0];low=Math.min(low,u);high=Math.max(high,u);}
   const {width,height}=await sharp(texture.getImage()).metadata(),left=Math.floor(low*width);
   const stats=await sharp(texture.getImage()).extract({left,top:0,width:Math.ceil(high*width)-left,height}).stats();
   assert.ok(stats.channels.some(c=>c.max>20),`${e.house_smoke_detector}: baked detector is too dark to see`);
  }
 }
 const pixels=await sharp(doc.getRoot().listTextures()[0].getImage()).resize(64,64).raw().toBuffer();assert.ok(new Set(pixels).size>25,'lighting atlas must contain baked surface shading');
 const b=readFileSync(path),length=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+length));assert.ok(!json.extensions?.KHR_lights_punctual);
 const report=JSON.parse(readFileSync('docs/house-plan/smoke-detector-bake-report.json'));assert.equal(report.bakedGLBHash,createHash('sha256').update(b).digest('hex'));assert.equal(report.samples,64);
 const layout=JSON.parse(readFileSync('web/assets/house/release/layout.json'));assert.ok(layout.fixedFixtures.startsWith('/'+path+'?v='));
 if(layout.reviewPreparation)assert.equal(report.houseSourceKey,layout.atlasRefresh?.retainedFixtureSourceKey??layout.lightingBake.report.sourceKey,'detector occluders must match the published house bake');
});
test('detectors remain fixed scenery and never create physics props',async()=>{
 const b=readFileSync(path),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length));doc.buffers[0].uri=`data:application/octet-stream;base64,${b.subarray(28+length).toString('base64')}`;
 doc.materials=[];for(const m of doc.meshes)for(const p of m.primitives)delete p.material;delete doc.images;delete doc.textures;delete doc.extensionsUsed;delete doc.extensionsRequired;
 const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(doc),''),world=new THREE.Scene();world.add(scene);
 const grouped=groupHouseProps(scene,world);assert.equal(grouped.props.length,0);assert.equal(grouped.staticMeshes.length,3);
});
