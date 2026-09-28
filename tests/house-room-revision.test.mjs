import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {createHouseProps} from '../web/house-props.js';
import {roomBoundaryPlanes} from '../web/house-boundaries.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
function document(room){const bytes=readFileSync(`web/assets/house/${room}-baked.glb`),length=bytes.readUInt32LE(12);return {bytes,length,doc:JSON.parse(bytes.subarray(20,20+length))};}
test('attic floor and basement stair enclosure cannot render inside the hall',()=>{
 const [attic]=roomBoundaryPlanes('attic'),[basement]=roomBoundaryPlanes('basement');
 assert.ok(attic.distanceToPoint(new THREE.Vector3(0,3.08,-3))<0);
 assert.ok(attic.distanceToPoint(new THREE.Vector3(0,3.4,-3))>0);
 assert.ok(basement.distanceToPoint(new THREE.Vector3(-.5,2,-3.2))<0);
 assert.ok(basement.distanceToPoint(new THREE.Vector3(-1.5,1.7,-3.2))>0);
});
test('pool balls are independent spherical rigid bodies and table is fixed',async()=>{
 const {bytes,length,doc}=document('basement');
 doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;delete doc.images;delete doc.textures;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const scene=new THREE.Scene();scene.add(gltf.scene);
 const {props,physics}=createHouseProps(gltf.scene,scene),balls=props.filter(p=>p.title.startsWith('Pool ball'));
 assert.equal(balls.length,5);assert.ok(!props.some(p=>p.title.startsWith('Pool table')));
 for(const ball of balls){
  assert.equal(ball.mode,'throw');const body=physics.items.get(ball.id).body;
  assert.equal(body.shapes[0].constructor.name,'Sphere');
  physics.unpin(ball.id);body.velocity.set(1,2,0);
 }
 for(let i=0;i<120;i++)physics.step(1/60);
 for(const ball of balls){const p=physics.pose(ball.id).position;assert.ok(Number.isFinite(p.y));assert.ok(p.y>-.1,'ball falls through the floor');}
});
test('all exploration practical lights are off in the exported bakes',()=>{
 for(const room of ['workshop','attic','basement']){
  const {doc}=document(room),report=JSON.parse(readFileSync(`scene/exports/house/${room}-bake.json`));
  assert.equal(report.practicalLightsOn,false);
  assert.ok(!doc.materials.some(m=>/^glow(?:\.|$)/i.test(m.name??'')));
 }
});
test('basement windows align and the central tabletop has been removed',()=>{
 const {doc}=document('basement'),windows=doc.nodes.filter(n=>/^Garden.beyond.window/.test(n.name));
 assert.equal(windows.length,3);
 for(const window of windows)assert.ok(Math.abs(window.translation[1]-2.95)<.001);
 assert.ok(Math.abs(windows[0].translation[2]-windows[1].translation[2])<.001);
 assert.ok(!doc.nodes.some(n=>/^Work.surface/.test(n.name)&&Math.abs(n.translation[0]-.3)<.01));
 assert.ok(doc.nodes.some(n=>/^Archive.shelf/.test(n.name)));
});
test('attic standing position is behind the foreground brace',()=>{
 const {doc}=document('attic'),camera=doc.nodes.find(n=>n.camera!==undefined);
 assert.ok(Math.abs(camera.translation[2]-1.15)<.001);
});
