import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {composeCamera} from '../web/responsive-scene.js';
import {resizeHouseCamera} from '../web/house-camera.js';
import {roomMatrix} from '../web/house-layout.js';

test('house camera preserves the den framing through travel and repeated resizes',()=>{
 for(const aspect of [1.4,1.6,2.1]){
  const den=new THREE.PerspectiveCamera(32,aspect,.1,100);
  den.position.set(.12,3,7.9);den.lookAt(0,1.5,0);
  composeCamera(den,{aspect,zoom:1,focusY:.41,height:2.65},new THREE.Vector3(0,2,.34));
  const matrix=roomMatrix({position:[-5.89,0,1.9],yaw:.3});
  const house=den.clone();house.position.applyMatrix4(matrix);
  house.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(matrix));
  const points=[new THREE.Vector3(0,2,.34),new THREE.Vector3(-2,0,-1)];
  const expected=points.map(point=>point.clone().project(den));
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
