import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Matrix3,Matrix4,Vector3} from 'three';

test('released ceiling has continuous lighting UVs across coincident triangle and slab edges',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 const doc=await io.read(`${process.env.ATLAS_REFRESH_DIR??'web/assets/house/release'}/structure/hallway.glb`);
 const coordinates=new Map();let repeats=0,surfaces=0;
 for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const world=new Matrix4().fromArray(node.getWorldMatrix()),normalMatrix=new Matrix3().getNormalMatrix(world);
  for(const p of node.getMesh().listPrimitives()){
   if(!/^Baked \/ (smooth-hall-ceiling|hall-ceilings)(\.\d+)?$/.test(p.getMaterial()?.getName()??''))continue;
   surfaces++;
   const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),norm=p.getAttribute('NORMAL');
   for(let i=0;i<pos.getCount();i++){
    if(new Vector3(...norm.getElement(i,[])).applyMatrix3(normalMatrix).normalize().y>=-.9)continue;
    const point=new Vector3(...pos.getElement(i,[])).applyMatrix4(world);
    const key=point.toArray().map(v=>Math.round(v*10000)).join(',');
    const value=uv.getElement(i,[]),previous=coordinates.get(key);
    assert.ok(value.every(v=>v>0&&v<1),'underside reaches atlas perimeter');
    if(previous){
     repeats++;
     assert.ok(value.every((v,k)=>Math.abs(v-previous[k])<.00002),`UV discontinuity at ${key}`);
    }else coordinates.set(key,value);
   }
  }
 }
 assert.equal(surfaces,8);assert.ok(repeats>10,'expected shared triangle and slab corners');
});
