import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {createHouseProps} from '../web/house-props.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class {constructor(type,values){Object.assign(this,{type},values);}};
async function roomProps(room){
 const bytes=readFileSync(`web/assets/house/${room}.glb`),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 // Physics/grouping tests need geometry; textures are exercised in the browser.
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
 delete doc.textures;delete doc.images;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 const scene=new THREE.Scene();scene.add(gltf.scene);
 return createHouseProps(gltf.scene,scene);
}
for(const room of ['hallway','workshop','attic','basement'])test(`${room}: small objects and complete framed art are interactive`,async()=>{
 const {props,physics}=await roomProps(room);
 assert.ok(props.length>20);
 const art=props.filter(p=>/picture.*backing/.test(p.title));
 if(room!=='attic')assert.ok(art.length);
 for(const p of art){assert.equal(p.mode,'throw');assert.ok(p.root.children.some(o=>/image/.test(o.name)));assert.ok(p.root.children.some(o=>/frame/.test(o.name)));}
 const ownership=new Set(),detailOwners=new Map();
 for(const p of props)for(const mesh of p.root.children){assert.ok(!ownership.has(mesh));ownership.add(mesh);assert.equal(mesh.userData.houseProp,p);if(mesh.name.includes('__')){const owner=mesh.name.split('__')[0];assert.ok(!detailOwners.has(owner)||detailOwners.get(owner)===p,'material detail detached from its original prop');detailOwners.set(owner,p);}}
 assert.ok(props.some(p=>p.mode==='wiggle'),'complex or fabric objects need the wiggle fallback');
 for(const p of props.filter(p=>p.mode==='throw'))assert.equal(physics.items.get(p.id).body.type,4,'decor should remain attached until picked up');
 assert.ok(!props.some(p=>/floorboard|masonry|door leaf|Window jamb|Deep sill/.test(p.title)));
 if(room==='workshop'){
  const clock=props.find(p=>p.hotspot==='working-hours'),tablet=props.find(p=>p.hotspot==='tablet');
  assert.ok(clock.root.children.some(o=>/Clock_face/.test(o.name)));
  assert.ok(!tablet.root.children.some(o=>/Task_lamp|Keycap/.test(o.name)),'nearby desk assemblies stay separate');
  const lamp=props.find(p=>p.title.startsWith('Task lamp'));
  assert.ok(lamp.root.children.some(o=>/Task_lamp_shade/.test(o.name)));
 }
 if(room==='attic'){
  const tricycle=props.find(p=>p.hotspot==='tricycle');
  assert.ok(tricycle,'tricycle retains its note interaction');
  const parts=tricycle.root.children;
  for(const name of ['tire','front_fork','rear_axle','black_saddle','swept_handlebar','rubber_pedal']){
   assert.ok(parts.some(o=>o.name.includes(`Tricycle_${name}`)),`${name} is detached from the tricycle`);
  }
  assert.ok(!props.some(p=>p!==tricycle&&p.root.children.some(o=>o.name.startsWith('Tricycle_'))),'tricycle must remain one assembly');
 }

});
test('wall art detaches, travels with its frame, and can cancel a grab',async()=>{
 const system=await roomProps('hallway'),p=system.props.find(p=>/Odd entrance picture/.test(p.title)),{physics}=system;
 const home=p.root.position.clone(),body=physics.items.get(p.id).body;
 physics.grab(p.id,home);physics.move(home.clone().add(new THREE.Vector3(-.4,.2,.1)));
 for(let i=0;i<30;i++)system.update(1/120);
 assert.ok(p.root.position.distanceTo(home)>.04);
 system.cancel();system.update(1/120);
 assert.equal(body.type,4);assert.equal(body.collisionFilterMask,-1);assert.ok(p.root.position.distanceTo(home)<1e-5);
 assert.ok(new THREE.Vector3(body.position.x,body.position.y,body.position.z).distanceTo(home)<1e-5);
 physics.grab(p.id,home);physics.release(new THREE.Vector3(-2,2,0));
 for(let i=0;i<120;i++)system.update(1/120);
 assert.ok(p.root.position.distanceTo(home)>.05);
 assert.ok(p.root.position.toArray().every(Number.isFinite));assert.ok(p.root.position.y>-.5);
 assert.equal(p.root.children.length,6,'frame and print must stay together');
});
test('wiggle returns exactly home and reduced motion clears the spring',async()=>{
 const system=await roomProps('workshop'),p=system.props.find(p=>p.mode==='wiggle');
 system.kick(p);system.update(1/60);assert.ok(p.root.quaternion.angleTo(p.rest)>0);
 system.update(1/60,true);assert.ok(p.root.quaternion.angleTo(p.rest)<1e-8);assert.equal(p.spring.angle,0);
});
