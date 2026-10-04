// Install a verified underside-only patch, preserving all other released surfaces.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,dedup,prune,unpartition} from '@gltf-transform/functions';
import {Matrix4,Matrix3,Vector3} from 'three';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {splitHouseStructure} from './split-house-structure.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir='web/assets/house/release',bake='scene/exports/house-release/hall-ceiling';
const doc=await io.read(`${dir}/structure.glb`),patches=await io.read(`${bake}/baked.glb`);
const bakeReport=JSON.parse(readFileSync(`${bake}/bake-report.json`));
const byId=new Map(doc.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id,n]));
const pointKey=p=>p.map(x=>Math.round(x*10000)).join(',');
let count=0;
for(const patch of patches.getRoot().listNodes().filter(n=>n.getMesh())){
 const node=byId.get(patch.getExtras().house_bake_id);if(!node||node.getExtras().preview_kind!=='ceiling')throw Error(`Missing ceiling ${patch.getName()}`);
 const world=new Matrix4().fromArray(node.getWorldMatrix()),normalMatrix=new Matrix3().getNormalMatrix(world),inverse=world.clone().invert();
 const originalPoints=new Set(),retained=[];
 for(const p of node.getMesh().listPrimitives()){
  const index=p.getIndices(),normal=p.getAttribute('NORMAL'),position=p.getAttribute('POSITION'),keep=[];
  for(let i=0;i<(index?.getCount()??position.getCount());i+=3){
   const tri=[0,1,2].map(k=>index?index.getScalar(i+k):i+k);
   const down=new Vector3(...normal.getElement(tri[0],[])).applyMatrix3(normalMatrix).normalize().y<-.9;
   if(down)for(const id of tri)originalPoints.add(pointKey(new Vector3(...position.getElement(id,[])).applyMatrix4(world).toArray()));else keep.push(...tri);
  }
  if(keep.length)retained.push(p.clone().setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(doc.getRoot().listBuffers()[0])));
 }
 const patchWorld=new Matrix4().fromArray(patch.getWorldMatrix()),patchPoints=new Set();
 for(const p of patch.getMesh().listPrimitives())for(let i=0;i<p.getAttribute('POSITION').getCount();i++)patchPoints.add(pointKey(new Vector3(...p.getAttribute('POSITION').getElement(i,[])).applyMatrix4(patchWorld).toArray()));
 if(originalPoints.size!==patchPoints.size||[...originalPoints].some(k=>!patchPoints.has(k)))throw Error(`Ceiling patch changes geometry: ${node.getName()}`);
 const mesh=copyToDocument(doc,patches,[patch.getMesh()]).get(patch.getMesh());
 const toLocal=inverse.multiply(patchWorld),toLocalNormal=new Matrix3().getNormalMatrix(toLocal);
 for(const p of mesh.listPrimitives()){
  for(const semantic of ['POSITION','NORMAL']){
   const a=p.getAttribute(semantic),array=new Float32Array(a.getCount()*3);
   for(let i=0;i<a.getCount();i++){
    const v=new Vector3(...a.getElement(i,[]));if(semantic==='POSITION')v.applyMatrix4(toLocal);else v.applyMatrix3(toLocalNormal).normalize();v.toArray(array,i*3);
   }
   p.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(array).setBuffer(doc.getRoot().listBuffers()[0]));
  }
 }
 for(const p of retained)mesh.addPrimitive(p);
 node.setMesh(mesh).setExtras({...node.getExtras(),ceiling_finish:'smooth cream',ceiling_bake_samples:bakeReport.samples,atlas_delivery_max:2048});count++;
}
if(!count)throw Error('Empty ceiling patch');
await doc.transform(dedup(),prune({keepSolidTextures:true}),unpartition());
// Retain the pre-fix master for local visual comparison/recovery.
const {existsSync}=await import('node:fs');if(!existsSync(`${bake}/before-structure.glb`))copyFileSync(`${dir}/structure.glb`,`${bake}/before-structure.glb`);
await io.write(`${dir}/structure.glb`,doc);
const path=`${dir}/layout.json`,layout=JSON.parse(readFileSync(path));layout.hallCeilingBake=bakeReport;
layout.assets.structure=`/${dir}/structure.glb?v=${createHash('sha256').update(readFileSync(`${dir}/structure.glb`)).digest('hex').slice(0,12)}`;
writeFileSync(path,JSON.stringify(layout,null,2)+'\n');
await splitHouseStructure();console.log(`Installed ${count} smooth ceiling undersides; other faces preserved.`);
