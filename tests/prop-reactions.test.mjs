import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PropSpring,createPropReactions} from '../web/prop-reactions.js';

test('A nudge has a continuous start, bounded travel, and returns exactly to rest',()=>{
 const spring=new PropSpring();spring.kick(.6);assert.equal(spring.angle,0);
 spring.step(1/60);assert.ok(spring.angle>0);
 for(let i=0;i<2000;i++){if(i<180&&i%3===0)spring.kick(.8);spring.step(1/60);assert.ok(Math.abs(spring.angle)<=.075);}
 assert.equal(spring.angle,0);assert.equal(spring.velocity,0);assert.equal(spring.step(1/60),false);
});
test('Spring motion is consistent at 30 and 120 fps and stable after a frame stall',()=>{
 const a=new PropSpring(),b=new PropSpring();a.kick(.5);b.kick(.5);
 for(let i=0;i<30;i++)a.step(1/30);for(let i=0;i<120;i++)b.step(1/120);
 assert.ok(Math.abs(a.angle-b.angle)<1e-10);assert.ok(Math.abs(a.velocity-b.velocity)<1e-10);
 a.step(300);assert.equal(a.angle,0);assert.equal(a.velocity,0);
});
test('Props rotate about their existing pivots and reduced motion restores rest immediately',()=>{
 const prop=new THREE.Mesh(new THREE.BoxGeometry());prop.userData.prop='plant';prop.position.set(-1.67,1.111,-.52);prop.rotation.y=.2;
 const rest=prop.quaternion.clone(),position=prop.position.clone(),reactions=createPropReactions([prop]);
 reactions.kick(prop,new THREE.Vector3(-1.5,1.5,-.52));assert.equal(reactions.update(1/60),true);
 assert.ok(prop.quaternion.angleTo(rest)>.001);assert.deepEqual(prop.position,position);
 assert.equal(reactions.update(1/60,true),true);assert.deepEqual(prop.quaternion.toArray(),rest.toArray());
 reactions.kick(prop,new THREE.Vector3(),true);assert.equal(reactions.update(1/60,true),false);
});
test('Moving a prop leaves its baked texture coordinates fixed to its resting surface',async()=>{
 const {prepareRoom}=await import('../web/room-renderer.js');
 const original=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 try{
  const scene=new THREE.Group(),camera=new THREE.PerspectiveCamera(32,1.6,.1,100);
  camera.position.set(0,3,8);camera.lookAt(0,1.7,0);camera.updateMatrixWorld(true);
  for(const role of ['room_geometry','crt_depth_surface','reactive_prop']){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry());mesh.userData.role=role;
   if(role==='room_geometry')mesh.userData.propBakeRect=[.25,.2,.5,.6];
   if(role==='reactive_prop'){mesh.userData.prop='mug';mesh.position.set(1.66,1.119,.03);}
   scene.add(mesh);
  }
  const clean=new THREE.Texture(),lit=new THREE.Texture(),room=prepareRoom({scene},camera,clean,lit),prop=room.props[0];
  const vertex=new THREE.Vector4(.08,.2,0,1),uniforms=prop.material.uniforms;
  const projected=()=>vertex.clone().applyMatrix4(uniforms.bakeModelMatrix.value).applyMatrix4(uniforms.bakeProjection.value);
  const before=projected();
  const background=vertex.clone().applyMatrix4(uniforms.bakeModelMatrix.value).applyMatrix4(room.shell.material.uniforms.bakeProjection.value);
  assert.ok(Math.abs((before.x/before.w*.5+.5)-((background.x/background.w*.5+.5)-.25)/.5)<1e-10);
  assert.ok(Math.abs((before.y/before.w*.5+.5)-((background.y/background.w*.5+.5)-.2)/.6)<1e-10);
  room.reactions.kick(prop,new THREE.Vector3(1.7,1.3,.03));room.reactions.update(.05);scene.updateMatrixWorld(true);
  assert.ok(prop.quaternion.angleTo(new THREE.Quaternion())>.001);
  assert.deepEqual(projected().toArray(),before.toArray());
  assert.equal(prop.material.uniforms.lighting.value,lit);assert.equal(room.shell.material.uniforms.lighting.value,clean);
 }finally{globalThis.matchMedia=original;}
});
