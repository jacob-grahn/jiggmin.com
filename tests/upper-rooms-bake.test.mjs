import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {groupHouseProps} from '../web/house-props.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
for(const room of ['attic','workshop']){
function asset(){const bytes=readFileSync(`web/assets/house/${room}-baked.glb`),length=bytes.readUInt32LE(12);return {bytes,length,doc:JSON.parse(bytes.subarray(20,20+length))};}
test(`${room} retains its camera, lights, windows, and baked fixed surfaces`,()=>{
 const {bytes,doc}=asset();assert.ok(bytes.length<15*1024*1024);assert.equal(doc.cameras.length,1);
 const baked=doc.nodes.filter(n=>n.extras?.[room+'_baked']);assert.ok(baked.length>40);
 assert.equal(doc.extensions.KHR_lights_punctual.lights.length,2);
 const windows=doc.nodes.filter(n=>/Garden.beyond.window/.test(n.name));assert.equal(windows.length,room==='attic'?1:2);
 assert.ok(windows.every(n=>!n.extras?.[room+'_baked']));
 for(const node of baked)for(const primitive of doc.meshes[node.mesh].primitives)assert.ok(primitive.attributes.TEXCOORD_0!==undefined);
});
test(`${room} surfaces occupy separate overhead and room lighting atlases`,()=>{
 const {bytes,length,doc}=asset(),binary=bytes.subarray(28+length);
 const read=(index)=>{
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],components=a.type==='VEC2'?2:1,size={5126:4,5125:4,5123:2,5121:1}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,j)=>{
   const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*components)+j*size;
   return a.componentType===5126?binary.readFloatLE(offset):size===4?binary.readUInt32LE(offset):size===2?binary.readUInt16LE(offset):binary.readUInt8(offset);
  }));
 };
 const areas=new Map();
 for(const n of doc.nodes.filter(n=>n.extras?.[room+'_baked']))for(const p of doc.meshes[n.mesh].primitives){
  let area=areas.get(p.material)??0;
  const uv=read(p.attributes.TEXCOORD_0),indices=p.indices===undefined?uv.map((_,i)=>i):read(p.indices).flat();
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>uv[j]);area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
  areas.set(p.material,area);
 }
 assert.equal(areas.size,2);
 for(const area of areas.values())assert.ok(area>.05&&area<=1.01,`UV coverage ${area} indicates missing or overlapping atlas coordinates`);
});
test(`${room} movable props stay out of the bake`,async()=>{
 const {bytes,length,doc}=asset();doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;delete doc.images;delete doc.textures;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const scene=new THREE.Scene();scene.add(gltf.scene);
 const {props}=groupHouseProps(gltf.scene,scene);assert.ok(props.length>=(room==='attic'?90:45));
 for(const prop of props)prop.root.traverse(o=>assert.ok(!o.userData[room+'_baked'],`${o.name} incorrectly baked`));
});
}
