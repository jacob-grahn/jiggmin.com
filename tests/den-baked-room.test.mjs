import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareBakedDen} from '../web/den-baked-room.js';
import {createContinuousDen} from '../web/house-den-continuity.js';

test('UV den retains its atlas through prop reactions, CRT playback, and house travel',()=>{
 const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 try{
  const scene=new THREE.Group(),atlas=new THREE.Texture();
  for(const [role,prop] of [['room_geometry'],['room_geometry'],['crt_depth_surface'],['reactive_prop','mug']]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({map:atlas}));
   mesh.userData={role,prop,den_baked:true};scene.add(mesh);
  }
  const room=prepareBakedDen({scene});
  assert.equal(room.shell.children.length,2);assert.equal(room.occluders.length,3);
  assert.equal(room.shell.children[0].material.map,atlas);assert.equal(room.shell.children[0].material.toneMapped,false);
  const idle=room.glass.material;
  assert.equal(idle.uniforms.atlas.value,atlas);assert.equal(idle.uniforms.bakeProjection,undefined);
  room.setPlaying(true);assert.equal(room.glass.material.blending,THREE.NoBlending);
  room.setPlaying(false);assert.equal(room.glass.material,idle);
  const prop=room.props[0];room.reactions.kick(prop,new THREE.Vector3(-1,0,0),false);room.reactions.update(.016,false);
  assert.notEqual(prop.quaternion.z,0);assert.equal(prop.material.map,atlas);
  const camera=new THREE.PerspectiveCamera();camera.position.set(.12,3,7.9);
  const house=createContinuousDen({scene,camera});
  const glass=house.scene.children.find(o=>o.userData.role==='crt_depth_surface');
  assert.equal(glass.material.uniforms.denProjectionRepair,undefined);
  assert.ok(glass.material.vertexShader.includes('atlasUV=uv'));
  assert.equal(glass.material.toneMapped,false);
 }finally{globalThis.matchMedia=previous;}
});
