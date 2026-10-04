import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Matrix3,Matrix4,Vector3} from 'three';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('window wall lighting UVs remain continuous across panel and triangle edges',async()=>{
 const doc=await io.read(`${process.env.ATLAS_REFRESH_DIR??'web/assets/house/release'}/structure/hallway.glb`),corners=new Map();let panels=0,repeats=0;
 for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().release_baked==='hall-window-wall')){
  panels++;const world=new Matrix4().fromArray(node.getWorldMatrix()),normal=new Matrix3().getNormalMatrix(world);
  for(const p of node.getMesh().listPrimitives()){
   const pos=p.getAttribute('POSITION'),norm=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0');
   for(let i=0;i<pos.getCount();i++){
    if(new Vector3(...norm.getElement(i,[])).applyMatrix3(normal).normalize().x>=-.9)continue;
    const key=new Vector3(...pos.getElement(i,[])).applyMatrix4(world).toArray().map(v=>Math.round(v*10000)).join(',');
    const value=uv.getElement(i,[]),old=corners.get(key);
    assert.ok(value.every(v=>v>0&&v<1));
    if(old){repeats++;assert.ok(value.every((v,k)=>Math.abs(v-old[k])<.00002),`wall UV seam at ${key}`);}
    else corners.set(key,value);
   }
  }
 }
 assert.equal(panels,4);assert.ok(repeats>5);
});
