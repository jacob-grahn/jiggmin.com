import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {groupHouseProps} from '../web/house-props.js';
import {roomMatrix} from '../web/house-layout.js';
import {prepareSurfaceBake} from '../web/hallway-bake.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
function asset(){const bytes=readFileSync('web/assets/house/basement-baked.glb'),length=bytes.readUInt32LE(12);return {bytes,length,doc:JSON.parse(bytes.subarray(20,20+length))};}
test('Basement retains its camera, live lamp, and baked fixed surfaces',()=>{
 const {bytes,doc}=asset();assert.ok(bytes.length<15*1024*1024);assert.equal(doc.cameras.length,1);
 const baked=doc.nodes.filter(n=>n.extras?.basement_baked);assert.ok(baked.length>40);
 const fixtures=doc.nodes.filter(n=>n.extras?.ceiling_fixture);assert.equal(fixtures.length,1);
 assert.ok(fixtures.every(n=>!n.extras.basement_baked));
 assert.equal(doc.extensions.KHR_lights_punctual.lights.length,3);
 for(const node of baked)for(const primitive of doc.meshes[node.mesh].primitives)assert.ok(primitive.attributes.TEXCOORD_0!==undefined);
});
test('Static surfaces occupy separate ceiling and room lighting atlases',()=>{
 const {bytes,length,doc}=asset(),binary=bytes.subarray(28+length);
 const read=(index)=>{
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],components=a.type==='VEC2'?2:1,size={5126:4,5125:4,5123:2,5121:1}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,j)=>{
   const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*components)+j*size;
   return a.componentType===5126?binary.readFloatLE(offset):size===4?binary.readUInt32LE(offset):size===2?binary.readUInt16LE(offset):binary.readUInt8(offset);
  }));
 };
 const areas=new Map();
 for(const n of doc.nodes.filter(n=>n.extras?.basement_baked))for(const p of doc.meshes[n.mesh].primitives){
  let area=areas.get(p.material)??0;
  const uv=read(p.attributes.TEXCOORD_0),indices=p.indices===undefined?uv.map((_,i)=>i):read(p.indices).flat();
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>uv[j]);area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
  areas.set(p.material,area);
 }
 assert.equal(areas.size,2);
 for(const area of areas.values())assert.ok(area>.05&&area<=1.01,`UV coverage ${area} indicates missing or overlapping atlas coordinates`);
});
test('Baked surfaces cannot become throwable props or leave permanently baked prop shadows',async()=>{
 const {bytes,length,doc}=asset();doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;delete doc.images;delete doc.textures;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const scene=new THREE.Scene();scene.add(gltf.scene);
 const {props}=groupHouseProps(gltf.scene,scene);assert.ok(props.length>100);
 for(const prop of props)prop.root.traverse(o=>assert.ok(!o.userData.basement_baked,`${o.name} incorrectly baked`));
});
test('Baked lighting is displayed once and remains attached to surfaces during camera movement',()=>{
 const map=new THREE.Texture(),source=new THREE.MeshStandardMaterial({emissiveMap:map});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),source);mesh.userData.basement_baked=true;
 const live=new THREE.Mesh(new THREE.BoxGeometry(),source),root=new THREE.Group();root.add(mesh,live);
 const uv=Array.from(mesh.geometry.attributes.uv.array);assert.equal(prepareSurfaceBake(root,'basement'),1);
 assert.equal(mesh.material.isMeshBasicMaterial,true);assert.equal(mesh.material.toneMapped,false);assert.equal(mesh.material.map,map);
 assert.equal(live.material,source);
 root.position.set(5,0,2);root.rotation.y=.7;root.updateMatrixWorld(true);
 assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),uv);assert.equal(mesh.material.uniforms,undefined);
});


test('Stairwell surfaces are included in the basement asset',()=>{
 const {doc}=asset(),layout=JSON.parse(readFileSync('web/assets/house/layout.json'));
 const stairs=doc.nodes.filter(n=>n.extras?.bake_connection);
 assert.equal(stairs.length,layout.geometry.filter(p=>p.name.startsWith('Basement stair')).length);
 assert.ok(stairs.every(n=>n.extras.basement_baked));
 const transform=roomMatrix(layout.rooms.basement);
 for(const stair of stairs){
  const name=stair.name.replace(/ UV(?:\.\d+)?$/,''),world=new THREE.Vector3(...stair.translation).applyMatrix4(transform);
  assert.ok(layout.geometry.some(p=>p.name===name&&world.distanceTo(new THREE.Vector3(...p.position))<.001),`${stair.name} must align with the hallway flight`);
 }
 assert.equal(stairs.filter(n=>n.name.startsWith('Basement stairwell ceiling')).length,1);
 assert.equal(stairs.filter(n=>n.name.startsWith('Basement stair recessed opal off')).length,2);
 assert.equal(stairs.filter(n=>n.name.startsWith('Basement stair art frame')).length,2);
});
test('Stairwell materials can remain unclipped beyond the basement doorway',()=>{
 const map=new THREE.Texture(),source=new THREE.MeshStandardMaterial({emissiveMap:map}),root=new THREE.Group();
 const room=new THREE.Mesh(new THREE.BoxGeometry(),source),stairs=room.clone();
 room.userData.basement_baked=true;stairs.userData={basement_baked:true,bake_connection:true};root.add(room,stairs);
 prepareSurfaceBake(root,'basement');
 room.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,0,-1),9.6)];
 assert.notEqual(room.material,stairs.material);assert.equal(stairs.material.clippingPlanes,null);
 assert.equal(stairs.material.map,room.material.map);
});
