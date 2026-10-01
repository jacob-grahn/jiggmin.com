import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {collectHouseWallColliders,createHouseProps} from '../web/house-props.js';
import {tidyHouseProps} from '../web/house-prop-cleanup.js';
globalThis.ProgressEvent??=class{};
async function model(room){
 const b=readFileSync(`web/assets/house/release/${room}.glb`),n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n));
 d.buffers[0].uri=`data:application/octet-stream;base64,${b.subarray(28+n).toString('base64')}`;
 d.materials=[];for(const m of d.meshes)for(const p of m.primitives)delete p.material;delete d.images;delete d.textures;
 return (await new GLTFLoader().parseAsync(JSON.stringify(d),'')).scene;
}
test('production hallway throws collide with the visible right and left house walls',async()=>{
 const structure=await model('structure'),root=await model('hallway'),world=new THREE.Scene();world.add(root);tidyHouseProps(root,'hallway');
 const structureColliders=collectHouseWallColliders(structure);
 const {physics}=createHouseProps(root,world,{floorY:0,roomBounds:[4.8,6.8,12,12],structureColliders});
 // Isolate the walls from hanging pictures and other detachable decorations.
 for(const {body} of physics.items.values())physics.world.removeBody(body);
 for(const body of [...physics.world.bodies])if(!body.name&&body.shapes[0].halfExtents)physics.world.removeBody(body);
 for(const [side,name,limit] of [[1,'Proposed wall 11',8.23],[-1,'Proposed wall 10',6.87]]){
  const body=physics.add(`wall-probe-${side}`,{position:{x:8,y:1.5,z:7.55},quaternion:{x:0,y:0,z:0,w:1}},{size:[.12,.12,.12],center:{x:0,y:0,z:0}});
  const hits=[];body.addEventListener('collide',e=>hits.push(e.body.name));body.velocity.set(0,0,side*6);body.wakeUp();
  let extreme=body.position.z;
  for(let i=0;i<60;i++){physics.step(1/120);extreme=side>0?Math.max(extreme,body.position.z):Math.min(extreme,body.position.z);}
  assert.ok(hits.includes(name),`throw should hit ${name}, got ${hits}`);
  assert.ok(side>0?extreme<limit:extreme>limit,`prop crossed the visible wall: ${extreme}`);
  physics.world.removeBody(body);
 }
 // The basement doorway is an actual gap below its header, not a broad wall box.
 assert.ok(!structureColliders.some(c=>c.bounds.containsPoint(new THREE.Vector3(10.5,1.5,8.3))));
 assert.ok(structureColliders.some(c=>c.bounds.containsPoint(new THREE.Vector3(10.5,2.4,8.3))));
 assert.ok(!physics.world.bodies.some(b=>b.name==='Proposed wall 00'),'distant walls stay out of hallway physics');
});
