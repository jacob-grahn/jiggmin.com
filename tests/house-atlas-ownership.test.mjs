import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Matrix3,Matrix4,Vector3} from 'three';
import {shellOwner} from '../scripts/split-house-structure.mjs';
import {paintCeilings} from '../scripts/house-finishes.mjs';
const dir=process.env.ATLAS_REFRESH_DIR??'web/assets/house/release';
test('source preparation cannot repaint separated attic floors or cellar slab undersides',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/structure.glb`);
 const parts=doc.getRoot().listNodes().filter(n=>n.getMesh()&&/^(Cellar slab underside|Attic slab upper) \/ /.test(n.getName()));
 assert.equal(parts.length,18);const meshes=parts.map(n=>n.getMesh());paintCeilings(doc);
 parts.forEach((node,i)=>assert.equal(node.getMesh(),meshes[i],node.getName()));
});
test('lighting atlases and their image bytes belong to a single room',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),groups=new Map(),images=new Map(),hashes=new WeakMap();
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const doc=await io.read(`${dir}/${room}.glb`);
  for(const node of doc.getRoot().listNodes()){
   const e=node.getExtras();if(!node.getMesh()||!e.release_baked)continue;
   const group=e.atlas_group??e.release_baked,owner=group==='structure-exterior'?'exterior':room==='structure'?shellOwner(node.getName(),e):room;
   const owners=groups.get(group)??new Set();owners.add(owner);groups.set(group,owners);
   for(const p of node.getMesh().listPrimitives()){
    const texture=p.getMaterial()?.getEmissiveTexture()??p.getMaterial()?.getBaseColorTexture();assert.ok(texture,node.getName());
    if(!hashes.has(texture))hashes.set(texture,createHash('sha256').update(texture.getImage()).digest('hex'));
    const hash=hashes.get(texture),uses=images.get(hash)??new Map();
    uses.set(owner,node.getName());images.set(hash,uses);
   }
  }
 }
 for(const [group,owners]of groups)assert.equal(owners.size,1,`${group} mixes rooms: ${[...owners].join(', ')}`);
 for(const uses of images.values())assert.equal(uses.size,1,`Atlas image is shared between rooms: ${JSON.stringify(Object.fromEntries(uses))}`);
});
test('shared slabs contain only faces belonging to the assigned room',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/structure.glb`);let cellar=0,attic=0;
 for(const node of doc.getRoot().listNodes()){
  if(!node.getMesh())continue;const name=node.getName(),matrix=new Matrix3().getNormalMatrix(new Matrix4().fromArray(node.getWorldMatrix()));
  const lower=name.startsWith('Cellar slab underside / '),upper=name.startsWith('Attic slab upper / '),ground=name.startsWith('Main floor'),ceiling=name.startsWith('Attic floor / hall ceiling');
  if(!lower&&!upper&&!ground&&!ceiling)continue;
  if(lower){cellar++;assert.equal(shellOwner(name,node.getExtras()),'basement');}
  if(upper){attic++;assert.equal(shellOwner(name,node.getExtras()),'attic');}
  for(const p of node.getMesh().listPrimitives()){
   const indices=p.getIndices(),normal=p.getAttribute('NORMAL');
   for(let i=0;i<(indices?.getCount()??normal.getCount());i++){
    const y=new Vector3(...normal.getElement(indices?indices.getScalar(i):i,[])).applyMatrix3(matrix).normalize().y;
    if(lower)assert.ok(y<-.9,name);if(upper)assert.ok(y>.9,name);
    if(ground)assert.ok(y>=-.9,`${name}: basement underside still in upstairs mesh`);
    if(ceiling)assert.ok(y<=.9,`${name}: attic upper face still in downstairs mesh`);
   }
  }
 }
 assert.equal(cellar,8);assert.equal(attic,10);
});
