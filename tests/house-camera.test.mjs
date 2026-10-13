import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {composeCamera,framing} from '../web/responsive-scene.js';
import {createHouseTravelCamera,resizeHouseCamera} from '../web/house-camera.js';
import {roomMatrix} from '../web/house-layout.js';

test('house camera preserves the den framing through travel and repeated resizes',()=>{
 for(const aspect of [390/844,844/900,1.4,1.6,844/390,2.6]){
  const den=new THREE.PerspectiveCamera(32,aspect,.1,100);
  den.position.set(.12,3,7.9);den.lookAt(0,1.5,0);
  composeCamera(den,{aspect,...framing(aspect,false),height:2.65},new THREE.Vector3(0,2,.34));
  const matrix=roomMatrix({position:[-5.89,0,1.9],yaw:.3});
  const house=createHouseTravelCamera(den);house.position.applyMatrix4(matrix);
  house.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(matrix));
  const points=[new THREE.Vector3(0,2,.34),new THREE.Vector3(-2,0,-1)];
  const expected=points.map(point=>point.clone().project(den));
  resizeHouseCamera(house,aspect);house.updateMatrixWorld(true);
  points.forEach((point,i)=>assert.ok(point.clone().applyMatrix4(matrix).project(house).distanceTo(expected[i])<1e-10,'first travel frame must match the resting den'));
  for(const resizedAspect of [aspect,1.8,1.4,aspect])resizeHouseCamera(house,resizedAspect);
  house.updateMatrixWorld(true);
  points.forEach((point,i)=>assert.ok(point.clone().applyMatrix4(matrix).project(house).distanceTo(expected[i])<1e-10));
  const identity=house.projectionMatrix.clone().multiply(house.projectionMatrixInverse);
  identity.elements.forEach((value,i)=>assert.ok(Math.abs(value-(i%5===0?1:0))<1e-10));
 }
});

test('ordinary house cameras retain their standard lens on resize',()=>{
 const camera=new THREE.PerspectiveCamera(42,1.6,.1,100);
 resizeHouseCamera(camera,2);
 assert.deepEqual(camera.projectionMatrix.elements,new THREE.PerspectiveCamera(42,2,.1,100).projectionMatrix.elements);
});

test('portrait exploration preserves the room horizontal field of view',()=>{
 const camera=new THREE.PerspectiveCamera(42,1.6,.1,100);
 camera.userData.explorationLens={fov:42,aspect:1.6};
 const horizontal=camera.projectionMatrix.elements[0];
 for(const aspect of [390/844,844/390,390/844,1.6]){
  resizeHouseCamera(camera,aspect);
  if(aspect<1.6)assert.ok(Math.abs(camera.projectionMatrix.elements[0]-horizontal)<1e-10);
 }
 assert.equal(camera.fov,42);
});

test('cup rounds and pyramid stay centered and clear of bottom navigation across screen sizes',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {cupLayout,cupPyramid}=await import('../web/hallway-cups.js');
 const layout=JSON.parse(await readFile(new URL('../web/assets/house/release/layout.json',import.meta.url)));
 const view=layout.views['private-hall'];
 assert.deepEqual(layout.routes['private-hall'].at(-1),view.position,'travel reaches the cup camera');
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
  const camera=new THREE.PerspectiveCamera(view.fov,view.aspect,.035,250);
  camera.position.fromArray(view.position);camera.lookAt(...view.target);
  camera.userData.explorationLens={fov:view.fov,aspect:view.aspect};
  resizeHouseCamera(camera,width/height);camera.updateMatrixWorld();
  for(const positions of [...Array.from({length:8},(_,i)=>cupLayout(i+3)),cupPyramid()])for(const position of positions){
   const points=[];
   for(const x of [-.116,.116])for(const y of [-.135,.135])for(const z of [-.116,.116])points.push(position.clone().add(new THREE.Vector3(x,y,z)).project(camera));
   assert.ok(points.every(p=>Math.abs(p.x)<.95&&Math.abs(p.y)<.8),'every cup fits with margin');
   assert.ok(Math.max(...points.map(p=>(1-p.y)*height/2))<height-100,'cups clear the bottom controls');
   if(width<height)assert.ok((Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*width/2>34,'portrait cups remain individually tappable');
  }
 }
});
