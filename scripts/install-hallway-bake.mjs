// Install hallway-only production lightmaps after verifying every triangle.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,dedup,prune,unpartition} from '@gltf-transform/functions';
import {Matrix4,Vector3} from 'three';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {splitHouseStructure} from './split-house-structure.mjs';
const wallOnly=process.argv.includes('--hall-window-wall');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir='web/assets/house/release',bake=wallOnly?'scene/exports/house-release/hall-window-wall':'scene/exports/house-release/hallway';
const doc=await io.read(`${dir}/structure.glb`),patches=await io.read(`${bake}/structure-lighting.glb`);
const hall=await io.read(`${dir}/structure/hallway.glb`);
const ids=new Set(hall.getRoot().listNodes().filter(n=>n.getMesh()&&(!wallOnly||/^Proposed wall 03/.test(n.getName()))).map(n=>n.getExtras().house_bake_id));
const bakeReport=JSON.parse(readFileSync(`${bake}/bake-report.json`));
const byId=new Map(doc.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id,n]));
function preserveGeometry(node,patch){
 const world=new Matrix4().fromArray(node.getWorldMatrix()),patchWorld=new Matrix4().fromArray(patch.getWorldMatrix()),cells=new Map(),records=new Map(),mapped=new Map(),size=.0002;let nextId=0;
 const cell=v=>v.toArray().map(c=>Math.floor(c/size));
 function nearest(point){
  const c=cell(point);let found,distance=Infinity;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const candidate of cells.get([c[0]+x,c[1]+y,c[2]+z].join(','))??[]){
   const d=point.distanceToSquared(candidate.point);if(d<distance){distance=d;found=candidate;}
  }
  return distance<=1e-8?found:null;
 }
 function identity(local){
  const point=new Vector3(...local).applyMatrix4(world),old=nearest(point);if(old)return old.id;
  const key=cell(point).join(','),entry={id:nextId++,point};if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);return entry.id;
 }
 for(const p of node.getMesh().listPrimitives()){
  const position=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),index=p.getIndices();
  for(let i=0;i<(index?.getCount()??position.getCount());i+=3){
   const corners=[0,1,2].map(k=>{const v=index?index.getScalar(i+k):i+k,local=position.getElement(v,[]);return {id:identity(local),position:local,normal:normal.getElement(v,[])};});
   const key=corners.map(c=>c.id).sort((a,b)=>a-b).join(',');if(!records.has(key))records.set(key,[]);records.get(key).push(corners);
  }
 }
 for(const p of patch.getMesh().listPrimitives()){
  const a=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),index=p.getIndices(),positions=[],normals=[],coords=[];
  for(let i=0;i<(index?.getCount()??a.getCount());i+=3){
   const corners=[0,1,2].map(k=>{const v=index?index.getScalar(i+k):i+k,match=nearest(new Vector3(...a.getElement(v,[])).applyMatrix4(patchWorld));if(!match)throw Error(`Export moved a vertex: ${node.getName()}`);return {id:match.id,uv:uv.getElement(v,[])};});
   const key=corners.map(c=>c.id).sort((a,b)=>a-b).join(','),original=records.get(key)?.pop();if(!original)throw Error(`Hallway topology changed: ${node.getName()}`);
   for(const corner of original){positions.push(...corner.position);normals.push(...corner.normal);coords.push(...corners.find(c=>c.id===corner.id).uv);}
  }
  mapped.set(p,{POSITION:new Float32Array(positions),NORMAL:new Float32Array(normals),TEXCOORD_0:new Float32Array(coords)});
 }
 if([...records.values()].some(r=>r.length))throw Error(`Bake omitted triangles: ${node.getName()}`);
 return mapped;
}
let count=0;
for(const patch of patches.getRoot().listNodes().filter(n=>n.getMesh())){
 const id=patch.getExtras().house_bake_id,node=byId.get(id);
 if(!ids.delete(id)||!node)throw Error('Unexpected hallway patch');
 const geometry=preserveGeometry(node,patch);
 const copied=copyToDocument(doc,patches,[patch.getMesh()]),mesh=copied.get(patch.getMesh());
 for(const [source,attributes] of geometry){
  const primitive=copied.get(source);primitive.setIndices(null);
  for(const [semantic,array] of Object.entries(attributes))primitive.setAttribute(semantic,doc.createAccessor().setType(semantic==='TEXCOORD_0'?'VEC2':'VEC3').setArray(array).setBuffer(doc.getRoot().listBuffers()[0]));
 }
 const group=patch.getExtras().release_baked;
 node.setMesh(mesh).setExtras({...node.getExtras(),release_baked:group,atlas_delivery_max:['structure-hall','hall-ceilings'].includes(group)?2048:1024,atlas_lossless:false,...(node.getExtras().hall_window_finish?{window_bake_samples:bakeReport.samples}:{}),...(node.getExtras().ceiling_finish?{ceiling_bake_samples:bakeReport.samples}:{})});count++;
}
if(!count)throw Error('Empty hallway bake');
if(wallOnly&&ids.size)throw Error('Bake omitted window wall pieces');
await doc.transform(dedup(),prune({keepSolidTextures:true}),unpartition());
if(!existsSync(`${bake}/before-structure.glb`))copyFileSync(`${dir}/structure.glb`,`${bake}/before-structure.glb`);
await io.write(`${dir}/structure.glb`,doc);
const path=`${dir}/layout.json`,layout=JSON.parse(readFileSync(path));
if(wallOnly)layout.hallWindowWallBake=bakeReport;
else{layout.hallwayBake=bakeReport;delete layout.hallWindowBake;delete layout.hallCeilingBake;delete layout.hallWindowWallBake;}
layout.assets.structure=`/${dir}/structure.glb?v=${createHash('sha256').update(readFileSync(`${dir}/structure.glb`)).digest('hex').slice(0,12)}`;
writeFileSync(path,JSON.stringify(layout,null,2)+'\n');await splitHouseStructure();console.log(`Installed ${count} hallway lighting meshes with unchanged geometry.`);
