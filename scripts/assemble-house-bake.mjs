// Overlay lighting meshes on the exact input snapshot; keep interactive objects intact.
import {NodeIO,Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition,dedup} from '@gltf-transform/functions';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const quality=process.argv[2]??'final';if(!['test','final'].includes(quality))throw Error('Expected test or final');
const dir=`scene/exports/house-release/${quality}`,input='scene/exports/house-release/bake-input',io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const report=JSON.parse(readFileSync(`${dir}/bake-report.json`));
// Den projection repair samples the original wood color in newly exposed floor
// pixels. Keep that color map separate from the new lighting atlas.
const shellReference=await io.read(`${input}/structure.glb`),oak=shellReference.getRoot().listMaterials().find(m=>m.getName().startsWith('oak')&&m.getBaseColorTexture());
if(!oak)throw Error('Missing original den foreground wood texture');
const reference=new Document(),referenceMaterial=copyToDocument(reference,shellReference,[oak]).get(oak),buffer=reference.createBuffer();
const position=reference.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,0,1])).setBuffer(buffer);
const uv=reference.createAccessor().setType('VEC2').setArray(new Float32Array([0,0,1,0,0,1])).setBuffer(buffer);
const primitive=reference.createPrimitive().setAttribute('POSITION',position).setAttribute('TEXCOORD_0',uv).setMaterial(referenceMaterial);
reference.createScene().addChild(reference.createNode('Original wood reference').setMesh(reference.createMesh().addPrimitive(primitive)));
await reference.transform(unpartition());await io.write(`${dir}/den-floor-reference.glb`,reference);
for(const room of ['structure','basement','attic']){
 const doc=await io.read(`${input}/${room}.glb`),baked=await io.read(`${dir}/${room}-lighting.glb`);
 const patches=new Map(baked.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().house_bake_id).map(n=>[n.getExtras().house_bake_id,n]));let count=0;
 for(const node of doc.getRoot().listNodes()){
  const patch=patches.get(node.getExtras().house_bake_id);if(!patch)continue;
  // glTF export must preserve local geometry and placement; a bake changes UVs
  // and material only. Reject changes before exposing a different layout.
  const a=node.getWorldMatrix(),b=patch.getWorldMatrix();if(a.some((v,i)=>Math.abs(v-b[i])>1e-4))throw Error(`Bake moved ${room}/${node.getName()}`);
  const mapping=copyToDocument(doc,baked,[patch.getMesh()]);node.setMesh(mapping.get(patch.getMesh()));
  const extras={...node.getExtras()};delete extras.source_rebake_required;
  node.setExtras({...extras,release_baked:patch.getExtras().release_baked,atlas_delivery_max:['structure-hall','hall-ceilings','structure-garage','basement-details'].includes(patch.getExtras().release_baked)?2048:1024,atlas_lossless:false,house_window_bake:true,...(patch.getExtras().house_window_receiver?{house_window_receiver:true}:{} )});count++;
 }
 if(count!==patches.size)throw Error(`Unmatched ${room} bake meshes: ${count}/${patches.size}`);
 for(const n of doc.getRoot().listNodes())if(n.getMesh()&&(n.getExtras().source_rebake_required||n.getMesh().listPrimitives().some(p=>p.getMaterial()?.getExtras().ceiling_paint)))throw Error(`Unbaked source repair: ${room}/${n.getName()}`);
 // Retain near-black baked maps: pruning can approximate them as one color.
 await doc.transform(dedup(),prune({keepSolidTextures:true}),unpartition());await io.write(`${dir}/${room}.glb`,doc);console.log('LIGHTING_OVERLAY',room,count);
}
for(const room of ['hallway','workshop'])copyFileSync(`${input}/${room}.glb`,`${dir}/${room}.glb`);
const layout=JSON.parse(readFileSync(`${input}/layout.json`));layout.lightingBake={quality,report,source:'original-window-rig'};
layout.denFloorReference=`/${dir}/den-floor-reference.glb`;
for(const room of ['structure','hallway','workshop','basement','attic']){const hash=createHash('sha256').update(readFileSync(`${dir}/${room}.glb`)).digest('hex').slice(0,12);layout.assets[room]=`/${dir}/${room}.glb?v=${hash}`;}
writeFileSync(`${dir}/layout.json`,JSON.stringify(layout,null,2)+'\n');
