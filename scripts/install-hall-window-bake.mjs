// Replace only the six verified hallway frame meshes with their dedicated bake.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,dedup,prune,unpartition} from '@gltf-transform/functions';
import {Matrix4,Matrix3,Vector3} from 'three';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {splitHouseStructure} from './split-house-structure.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir='web/assets/house/release',bake='scene/exports/house-release/hall-window';
const doc=await io.read(`${dir}/structure.glb`),patches=await io.read(`${bake}/baked.glb`);
const ids=new Set(doc.getRoot().listNodes().filter(n=>n.getMesh()&&/^Finish \/ hall-right (jamb|rail|sill|mullion)/.test(n.getName())).map(n=>n.getExtras().house_bake_id));
if(ids.size!==6)throw Error('Missing released hallway frame');
const bakeReport=JSON.parse(readFileSync(`${bake}/bake-report.json`));
const byId=new Map(doc.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id,n]));
const pointKey=p=>p.map(x=>Math.round(x*10000)).join(',');
function triangles(node){
 const world=new Matrix4().fromArray(node.getWorldMatrix()),result=[];
 for(const p of node.getMesh().listPrimitives()){
  const position=p.getAttribute('POSITION'),index=p.getIndices();
  for(let i=0;i<(index?.getCount()??position.getCount());i+=3)result.push([0,1,2].map(k=>pointKey(new Vector3(...position.getElement(index?index.getScalar(i+k):i+k,[])).applyMatrix4(world).toArray())).sort().join('|'));
 }
 return result.sort();
}
let count=0;
for(const patch of patches.getRoot().listNodes().filter(n=>n.getMesh())){
 const id=patch.getExtras().house_bake_id,node=byId.get(id);
 if(!ids.delete(id)||!node||!/^Finish \/ hall-right (jamb|rail|sill|mullion)/.test(node.getName()))throw Error('Unexpected frame patch');
 if(JSON.stringify(triangles(node))!==JSON.stringify(triangles(patch)))throw Error(`Frame geometry changed: ${node.getName()}`);
 const mesh=copyToDocument(doc,patches,[patch.getMesh()]).get(patch.getMesh());
 const toLocal=new Matrix4().fromArray(node.getWorldMatrix()).invert().multiply(new Matrix4().fromArray(patch.getWorldMatrix())),normal=new Matrix3().getNormalMatrix(toLocal);
 for(const p of mesh.listPrimitives())for(const semantic of ['POSITION','NORMAL']){
  const a=p.getAttribute(semantic),array=new Float32Array(a.getCount()*3);
  for(let i=0;i<a.getCount();i++){
   const v=new Vector3(...a.getElement(i,[]));if(semantic==='POSITION')v.applyMatrix4(toLocal);else v.applyMatrix3(normal).normalize();v.toArray(array,i*3);
  }
  p.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(array).setBuffer(doc.getRoot().listBuffers()[0]));
 }
 node.setMesh(mesh).setExtras({...node.getExtras(),hall_window_finish:'smooth original palette',window_bake_samples:bakeReport.samples,atlas_delivery_max:1024});count++;
}
if(ids.size)throw Error('Missing frame patches');
await doc.transform(dedup(),prune({keepSolidTextures:true}),unpartition());
if(!existsSync(`${bake}/before-structure.glb`))copyFileSync(`${dir}/structure.glb`,`${bake}/before-structure.glb`);
await io.write(`${dir}/structure.glb`,doc);
const path=`${dir}/layout.json`,layout=JSON.parse(readFileSync(path));layout.hallWindowBake=bakeReport;
layout.assets.structure=`/${dir}/structure.glb?v=${createHash('sha256').update(readFileSync(`${dir}/structure.glb`)).digest('hex').slice(0,12)}`;
writeFileSync(path,JSON.stringify(layout,null,2)+'\n');await splitHouseStructure();console.log(`Installed ${count} smooth window members with unchanged geometry.`);
