import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import sharp from 'sharp';
import {prepareRoom} from '../web/room-renderer.js';
import {ROOM_IMAGES} from '../scripts/asset-compression.config.mjs';

test('dedicated CRT texture retains native pixel density and enters the production image pipeline',async()=>{
 const image=await sharp('web/assets/crt-screen.webp').metadata();
 assert.equal(image.width,1200);assert.equal(image.height,900);
 assert.ok(ROOM_IMAGES.includes('crt-screen.webp'));
});
test('CRT samples its own atlas with glass UVs while room shading, flicker, and playback remain independent',()=>{
 const original=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 try{
  const scene=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.updateMatrixWorld(true);
  for(const role of ['room_geometry','crt_depth_surface']){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.196,1.454));mesh.userData.role=role;
   mesh.geometry.deleteAttribute('uv');scene.add(mesh);
  }
  const lighting=new THREE.Texture(),crt=new THREE.Texture();
  const room=prepareRoom({scene},camera,lighting,lighting,crt),idle=room.glass.material;
  assert.equal(room.shell.material.uniforms.lighting.value,lighting);
  assert.equal(idle.uniforms.crtLighting.value,crt);
  assert.match(idle.fragmentShader,/texture2D\(crtLighting,crtUV\)/);
  const uv=room.glass.geometry.attributes.uv;
  assert.deepEqual(Array.from(uv.array),[0,1,1,1,0,0,1,0]);
  assert.equal(room.updateIdle(2),true);assert.equal(idle.uniforms.time.value,2);
  room.setPlaying(true);assert.equal(room.glass.material.blending,THREE.NoBlending);
  assert.equal(room.updateIdle(3),false);
  room.setPlaying(false);assert.equal(room.glass.material,idle);
 }finally{globalThis.matchMedia=original;}
});
