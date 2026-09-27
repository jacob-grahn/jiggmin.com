import assert from 'node:assert/strict';
import {accelerateRaycasts} from '../web/raycast-acceleration.js';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cartridgeVisible} from '../web/responsive-scene.js';
const bytes=readFileSync('web/assets/room.glb');
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const occluders=[];let triangles=0;
scene.traverse(o=>{if(o.isMesh&&['room_geometry','reactive_prop'].includes(o.userData.role)){o.material.side=THREE.DoubleSide;occluders.push(o);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
const b=readFileSync('web/assets/cartridges.glb'),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),n=g.nodes.find(n=>'camera' in n),c=g.cameras[n.camera].perspective;
const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(c.yfov),c.aspectRatio,c.znear,c.zfar);camera.position.fromArray(n.translation);camera.quaternion.fromArray(n.rotation);camera.updateMatrixWorld(true);
const roots=Array.from({length:24},(_,i)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.44,.5,.09));m.position.set((i%6-2.5)*.65,i<12?.8:.3,i<12?1.8:-.7);return m;});
function measure(label,items,iterations=7){
 const times=[];let result;
 for(let i=0;i<iterations;i++){const start=performance.now();result=items.map(r=>cartridgeVisible(r,camera,occluders));times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 console.log(JSON.stringify({label,triangles,cartridges:items.length,medianMs:+times[Math.floor(times.length/2)].toFixed(2),maxMs:+times.at(-1).toFixed(2),visible:result.filter(Boolean).length}));return result;
}
const table=roots.slice(0,5);
const normal=measure('before: five tabletop cartridges',table),stress=measure('before: 24 scattered cartridges',roots,3);
const start=performance.now();accelerateRaycasts(occluders);console.log('Index build:',Math.round(performance.now()-start),'ms');
assert.deepEqual(measure('after: five tabletop cartridges',table,50),normal);
assert.deepEqual(measure('after: 24 scattered cartridges',roots,50),stress);
// A rigid prop can move without rebuilding its local-space index.
for(const mesh of occluders.filter(m=>m.userData.role==='reactive_prop'))mesh.rotation.z+=.05;
scene.updateMatrixWorld(true);
const fast=roots.map(r=>cartridgeVisible(r,camera,occluders));
for(const mesh of occluders)mesh.raycast=THREE.Mesh.prototype.raycast;
assert.deepEqual(roots.map(r=>cartridgeVisible(r,camera,occluders)),fast);
console.log('Visibility results match, including moving props. CPU query benchmark; excludes GPU rendering.');
const {CartridgePhysics}=await import('../web/physics.js');
const physics=new CartridgePhysics(JSON.parse(readFileSync('web/assets/colliders.json')));
roots.forEach((r,i)=>physics.add(String(i),{position:r.position,quaternion:r.quaternion}));
const steps=[];
for(let i=0;i<600;i++){const start=performance.now();physics.step(1/60);steps.push(performance.now()-start);}
steps.sort((a,b)=>a-b);console.log(JSON.stringify({label:'physics: 24 falling then settling cartridges',medianMs:+steps[300].toFixed(2),p95Ms:+steps[570].toFixed(2),maxMs:+steps.at(-1).toFixed(2)}));
