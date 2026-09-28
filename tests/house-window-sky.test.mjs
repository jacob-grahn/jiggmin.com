import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMoonlitWindows} from '../web/house-window-sky.js';

test('Every non-den window becomes a shared sky opening, while glass and other surfaces remain intact',()=>{
 const sky=new THREE.Texture();
 for(const [room,count] of Object.entries({hallway:2,basement:3,workshop:2,attic:1})){
  const bytes=readFileSync(`web/assets/house/${room}.glb`),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const root=new THREE.Group();
  for(const node of doc.nodes.filter(n=>n.mesh!==undefined)){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial());mesh.name=node.name.replaceAll(' ','_');root.add(mesh);
  }
  const originals=new Map(root.children.map(o=>[o,o.material]));
  assert.equal(createMoonlitWindows(root,sky),count);
  const replaced=root.children.filter(o=>o.material!==originals.get(o));assert.equal(replaced.length,count);
  for(const mesh of replaced){assert.equal(mesh.material.map,sky);assert.equal(mesh.material.toneMapped,false);assert.equal(mesh.material.color.getHex(),0xffffff);}
 }
});

test('Sky openings retain clipping and sample sightlines instead of fitting a picture to every window',()=>{
 const plane=new THREE.Plane(),source=new THREE.MeshBasicMaterial({clippingPlanes:[plane],side:THREE.DoubleSide});
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),source);mesh.name='Garden_beyond_window';root.add(mesh);
 createMoonlitWindows(root,new THREE.Texture());
 assert.equal(mesh.material.clippingPlanes,source.clippingPlanes);assert.equal(mesh.material.side,source.side);
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};mesh.material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/modelMatrix/);assert.match(shader.fragmentShader,/exteriorWorldPosition-cameraPosition/);
 assert.doesNotMatch(shader.fragmentShader,/vMapUv/);
});
