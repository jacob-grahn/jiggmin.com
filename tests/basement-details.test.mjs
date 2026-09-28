import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addBasementDetails} from '../web/basement-details.js';
import {groupHouseProps} from '../web/house-props.js';
import {createRoomResources} from '../web/house-resources.js';

test('floor detailing preserves baked lighting and keeps the grate fixed',()=>{
 const model=new THREE.Group(),scene=new THREE.Scene();scene.add(model);
 const lighting=new THREE.Texture(),source=new THREE.MeshBasicMaterial({map:lighting,toneMapped:false});
 const slab=new THREE.Mesh(new THREE.BoxGeometry(10,.2,13.8),source);slab.name='Concrete slab';slab.position.set(0,-.1,3.2);model.add(slab);
 const wear=new THREE.Texture(),resources=createRoomResources();
 const {drain}=addBasementDetails(model,{floorTexture:wear});resources.capture(model);
 assert.equal(slab.material.map,lighting);assert.equal(slab.material.toneMapped,false);assert.notEqual(slab.material,source);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};slab.material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.basementWear.value,wear);assert.match(shader.fragmentShader,/diffuseColor.rgb\*=/);
 assert.ok(!shader.vertexShader.includes('position.x--'));
 assert.equal(drain.children.length,9);
 const {props}=groupHouseProps(model,scene);assert.equal(props.length,0,'grate and ceiling canopy must stay attached');
 let disposed=false;wear.addEventListener('dispose',()=>disposed=true);resources.dispose();assert.equal(disposed,true);
});
test('basement joists and pendant reach the ceiling and the pipe clears the windows',()=>{
 for(const path of ['scene/exports/house/basement.glb','web/assets/house/basement-baked.glb']){
  const bytes=readFileSync(path),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const yBounds=node=>doc.meshes[node.mesh].primitives.map(p=>doc.accessors[p.attributes.POSITION]);
  for(const node of doc.nodes.filter(n=>n.name.startsWith('Basement ceiling joist'))){
   const ys=yBounds(node);assert.ok(Math.max(...ys.map(a=>a.max[1]))>=3.81);assert.ok(Math.min(...ys.map(a=>a.min[1]))>3.68);
  }
  const stem=yBounds(doc.nodes.find(n=>n.name==='Lamp stem'));assert.ok(Math.max(...stem.map(a=>a.max[1]))>=3.83);
  const pipe=yBounds(doc.nodes.find(n=>n.name==='Copper water pipe'));assert.ok(Math.max(...pipe.map(a=>a.max[1]))>3.6);
 }
});
