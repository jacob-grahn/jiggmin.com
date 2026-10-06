import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import * as T from 'three';
import {textureDemand,minimumScale,recommendedSize} from '../scripts/texture-sizing/coverage.mjs';
import {assembleScene} from '../scripts/texture-sizing/scene.mjs';
import {fittedCamera} from '../scripts/texture-sizing/cameras.mjs';
const triangle=z=>[new T.Vector3(-1,-1,z),new T.Vector3(1,-1,z),new T.Vector3(-1,1,z)];
const uv=scale=>[new T.Vector2(0,0),new T.Vector2(scale,0),new T.Vector2(0,scale)];
function camera(){const c=new T.PerspectiveCamera(90,1,.035,250);c.updateMatrixWorld();return c;}
function demand(z=-2,width=1000,scale=1){return textureDemand(triangle(z),uv(scale),camera(),{width,height:width},{width:256,height:256});}

test('texture demand tracks projected pixel size, distance, DPR and UV allocation',()=>{
 assert.ok(Math.abs(demand()-500)<1e-6);
 assert.ok(Math.abs(demand(-4)-250)<1e-6);
 assert.ok(Math.abs(demand(-2,2000)-1000)<1e-6);
 assert.ok(Math.abs(demand(-2,1000,.25)-2000)<1e-6);
});
test('density detects stretched islands rather than relying on area alone',()=>{
 assert.equal(minimumScale(4,0,0,.25),.25);
 assert.ok(Math.abs(minimumScale(1,1,0,1)-(Math.sqrt(5)-1)/2)<1e-6);
 assert.equal(minimumScale(1,2,2,4),0);
 assert.equal(textureDemand(triangle(-2),uv(0),camera(),{width:1000,height:1000},{width:256,height:256}),null);
});
test('recommendations preserve aspect ratio and flag unmet requirements',()=>{
 assert.deepEqual(recommendedSize(700,1600,800),{width:1024,height:512,exceedsMaximum:false});
 assert.deepEqual(recommendedSize(10000,1600,800),{width:8192,height:4096,exceedsMaximum:true});
});
test('assembled scene depth-tests occlusion and resolves authored triangle ownership',async()=>{
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 for(const [name,z] of [['behind',-4],['front',-2]]){
  const primitive=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(triangle(z).flatMap(v=>v.toArray()))).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
 }
 const assembled=await assembleScene([{path:'fixture.glb',doc}],new Map());
 const hit=assembled.bvh.raycastFirst(new T.Ray(new T.Vector3(-.1,-.1,0),new T.Vector3(0,0,-1)),T.DoubleSide);
 assert.equal(assembled.rangeFor(hit.faceIndex).name,'front');assert.equal(hit.distance,2);
 assembled.geometry.dispose();
});
test('house portrait lens preserves horizontal room coverage',()=>{
 const view={fov:50,position:[0,0,0],target:[0,0,-1]},desktop=fittedCamera(view,1.6),portrait=fittedCamera(view,.4);
 assert.ok(Math.abs(desktop.projectionMatrix.elements[0]-portrait.projectionMatrix.elements[0])<1e-6);
});

test('visible-detail estimates reduce flat images but preserve sampled high-frequency detail',async()=>{
 const sharp=(await import('sharp')).default,{detailEstimate}=await import('../scripts/texture-sizing/detail.mjs');
 const flat=await sharp({create:{width:256,height:256,channels:4,background:{r:60,g:80,b:100,alpha:1}}}).png().toBuffer();
 const coordinates=Array.from({length:256},(_,i)=>[(i+.5)/256,(i+.5)/256]);
 assert.equal((await detailEstimate(flat,coordinates)).width,128);
 const pixels=new Uint8Array(256*256*4);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,c=(x+y)%2?255:0;pixels.set([c,c,c,255],i);}
 const checker=await sharp(pixels,{raw:{width:256,height:256,channels:4}}).png().toBuffer();
 assert.equal((await detailEstimate(checker,coordinates)).width,256);
});

test('den doorway travel reaches the framed source camera through rigid placement',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {denCameras,denTravelCameras,DEN_TO_WORLD}=await import('../scripts/texture-sizing/cameras.mjs');
 const layout=JSON.parse(await readFile('web/assets/house/release/layout.json'));
 const base=new T.PerspectiveCamera(32,1.6,.1,1000);base.position.set(.12,3,7.9);base.lookAt(0,1.6,0);base.updateMatrixWorld();
 const viewport={id:'test',width:390,height:844,dpr:2};
 const endpoint=denCameras(base,viewport)[0].camera,views=denTravelCameras(layout,base,viewport,4),arrival=views[4].camera;
 assert.ok(arrival.position.distanceTo(endpoint.position.clone().applyMatrix4(DEN_TO_WORLD))<1e-5);
 assert.ok(Math.abs(arrival.zoom-endpoint.zoom)<1e-6);
 assert.ok(views.every(v=>v.camera.projectionMatrix.elements.every(Number.isFinite)));
});
