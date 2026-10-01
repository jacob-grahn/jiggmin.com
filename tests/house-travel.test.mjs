import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createRoute} from '../web/house-layout.js';
import {travelPose,travelDuration,MAX_TRAVEL_SPEED,MAX_TURN_SPEED} from '../web/house-travel.js';
const layout=JSON.parse(fs.readFileSync(new URL('../web/assets/house/release/layout.json',import.meta.url)));
const routeFor=id=>createRoute(layout.routes[id].map(p=>new T.Vector3(...p)));
test('all travel directions respect peak translation and steering speed, with gentle starts and stops',()=>{
 for(const id of Object.keys(layout.routes))for(const reverse of [false,true]){
  const route=routeFor(id),duration=travelDuration(route,layout.views.hub,layout.views[id],id,reverse)/1000;
  let previous=travelPose(route,0,layout.views.hub,layout.views[id],id,reverse);
  for(let i=1;i<=4000;i++){
   const pose=travelPose(route,i/4000,layout.views.hub,layout.views[id],id,reverse);
   const speed=pose.position.distanceTo(previous.position)*4000/duration;
   assert.ok(speed<=MAX_TRAVEL_SPEED+1e-4,`${id} ${reverse}: speed ${speed}`);
   assert.ok(previous.quaternion.angleTo(pose.quaternion)*4000/duration<=MAX_TURN_SPEED+1e-4,`${id}: turn too fast`);
   if(i===1||i===4000)assert.ok(speed<.001,`${id}: abrupt start/stop`);
   previous=pose;
  }
 }
});
test('passage curves join straight runs with matching tangent and zero curvature',()=>{
 for(const id of Object.keys(layout.routes)){
  const curves=routeFor(id).curves;
  for(let i=1;i<curves.length;i++){
   assert.ok(curves[i-1].getTangent(1).dot(curves[i].getTangent(0))>.999999);
  }
  for(const curve of curves.filter(c=>!c.isLineCurve3)){
   assert.ok(curve.getTangent(0).angleTo(curve.getTangent(.0001))<1e-6);
   assert.ok(curve.getTangent(1).angleTo(curve.getTangent(.9999))<1e-6);
  }
 }
});
test('basement arrival flies directly from the lower stair flight to its view',()=>{
 const points=layout.routes.basement;
 assert.ok(new T.Vector3(...points.at(-2)).distanceTo(new T.Vector3(11.15,-1.65,9.1))<1e-6);assert.deepEqual(points.at(-1),layout.views.basement.position);
 const route=routeFor('basement');let previous;
 for(let i=0;i<=1000;i++){
  const pose=travelPose(route,i/1000,layout.views.hub,layout.views.basement,'basement');
  if(previous&&pose.position.y< -2.34)assert.ok(pose.position.x<=previous.x+1e-8,'arrival doubles back');
  previous=pose.position;
 }
});
test('forward and reverse travel retain both original endpoint compositions',()=>{
 for(const id of Object.keys(layout.routes))for(const reverse of [false,true])for(const [p,view] of [[0,layout.views.hub],[1,layout.views[id]]]){
  const pose=travelPose(routeFor(id),p,layout.views.hub,layout.views[id],id,reverse);
  assert.ok(pose.position.distanceTo(new T.Vector3(...view.position))<1e-6);
  assert.ok(new T.Vector3(0,0,-1).applyQuaternion(pose.quaternion).dot(new T.Vector3(...view.target).sub(pose.position).normalize())>.999999);
 }
});

test('den steering stays smooth with a normal rigid camera',async()=>{
 const {createContinuousDen}=await import('../web/house-den-continuity.js');
 const camera=new T.PerspectiveCamera(32,1.6,.1,100);camera.position.set(.12,2.65,7.9);camera.lookAt(0,1.4,0);camera.updateMatrixWorld();
 const den=createContinuousDen({scene:new T.Scene(),camera}),eye=den.endpointCamera().position;
 const route=createRoute([new T.Vector3(...layout.views.hub.position),new T.Vector3(5.55,1.65,7.55),new T.Vector3(5.55,1.65,eye.z),eye]);
 for(const reverse of [false,true]){
  const duration=travelDuration(route,layout.views.hub,layout.views.den,'den',reverse)/1000;let previous;
  for(let i=0;i<=4000;i++){
   const pose=travelPose(route,i/4000,layout.views.hub,layout.views.den,'den',reverse);
   const matrix=den.travelMatrix(pose,T.MathUtils.smoothstep(pose.position.z,8,8.7),1-T.MathUtils.smoothstep(pose.position.x,4.95,5.55));
   const facing=new T.Vector3(0,0,-1).transformDirection(matrix);
   if(previous)assert.ok(previous.angleTo(facing)*4000/duration<=MAX_TURN_SPEED,'den camera turn exceeded the limit');
   previous=facing;
  }
 }
 den.resources.dispose();
});
