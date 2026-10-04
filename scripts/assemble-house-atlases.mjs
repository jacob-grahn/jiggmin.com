// Install a verified all-room atlas bake on an unchanged release snapshot.
// Usage: node scripts/assemble-house-atlases.mjs RESULT_DIR [OUTPUT_DIR]
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition} from '@gltf-transform/functions';
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {splitHouseStructure} from './split-house-structure.mjs';
const result=process.argv[2],out=process.argv[3]??'scene/exports/house-release/atlas-refresh';
if(!result)throw Error('Expected verified result directory');
const input=process.argv[4]??'web/assets/house/release',io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const baked=await io.read(`${result}/house-atlases.glb`),report=JSON.parse(await readFile(`${result}/report.json`));
const replacements=new Map(baked.getRoot().listNodes().filter(n=>n.getExtras().atlas_source_id).map(n=>[n.getExtras().atlas_source_id,n]));
assert.equal(replacements.size,report.objects);
await mkdir(out,{recursive:true});let count=0,receivers=0;
const layout=JSON.parse(await readFile(`${input}/layout.json`));
for(const asset of ['structure','hallway','workshop','basement','attic']){
 const doc=await io.read(`${input}/${asset}.glb`),nodes=doc.getRoot().listNodes();
 for(const node of nodes)if((report.removedObjects??[]).some(entry=>entry.id===asset+':'+(node.getExtras().house_bake_id??node.getExtras().source_object??node.getName())))node.dispose();
 const matches=nodes.filter(n=>!n.isDisposed()).map(n=>[n,replacements.get(asset+':'+(n.getExtras().house_bake_id??n.getExtras().source_object??n.getName()))]).filter(([,b])=>b);
 const copied=copyToDocument(doc,baked,matches.map(([,b])=>b.getMesh()));
 for(const [node,patch] of matches){
  assert.ok(node.getWorldMatrix().every((v,i)=>Math.abs(v-patch.getWorldMatrix()[i])<.0001),'Moved '+node.getName());
  for(const p of patch.getMesh().listPrimitives())assert.equal(p.getMaterial().getEmissiveTexture().getMimeType(),'image/png','Bake must be lossless');
  node.setMesh(copied.get(patch.getMesh()));
  const group=patch.getExtras().atlas_group;
  const deliveryMax=['structure-hall','hall-ceilings','hall-trim'].includes(group)?2048:1024;
  node.setExtras({...node.getExtras(),release_baked:patch.getExtras().release_baked,atlas_group:group,atlas_delivery_max:deliveryMax,atlas_source_id:patch.getExtras().atlas_source_id,atlas_lossless:false});count++;
 }
 receivers+=doc.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().release_baked).length;
 await doc.transform(prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}),unpartition());
 await io.write(`${out}/${asset}.glb`,doc);
 const hash=createHash('sha256').update(await readFile(`${out}/${asset}.glb`)).digest('hex').slice(0,12);
 layout.assets[asset]=`/${out}/${asset}.glb?v=${hash}`;
 console.log('ATLAS_MERGE',asset,matches.length);
}
assert.equal(count,replacements.size);
const atlasRecords=Object.fromEntries(Object.entries(layout.atlasRefresh?.atlases??{}).map(([key,value])=>[key,{...value,masterDirectory:value.masterDirectory??layout.atlasRefresh.resultDirectory}]));
for(const [key,value] of Object.entries(report.atlases))atlasRecords[key]={...value,masterDirectory:result};
layout.atlasRefresh={...report,objects:receivers,rebakedObjects:report.objects,atlases:atlasRecords,resultDirectory:result,masterFormat:'PNG',webFormat:'WebP quality 80 lighting atlases',den:'original projection',delivery:'One shared asset set; 1024/2048px lighting atlas limits, WebP quality 80',retainedFixtureSourceKey:layout.atlasRefresh?.retainedFixtureSourceKey??layout.lightingBake?.report?.sourceKey};
const baseline=join(dirname(result),'input-baseline');
if(await stat(baseline).then(s=>s.isDirectory()).catch(()=>false))layout.atlasRefresh.baselineDirectory=baseline;
// Retain the established window-rig contract with the new bake provenance.
for(const field of ['hallwayBake','hallCeilingBake','hallWindowWallBake'])delete layout[field];
layout.lightingBake={quality:'final',source:'original-window-rig',report};
for(const field of ['denFloorReference','fixedFixtures'])if(layout[field]){
 const file=layout[field].split('?')[0].split('/').pop();await copyFile(`${input}/${file}`,`${out}/${file}`);const hash=createHash('sha256').update(await readFile(`${out}/${file}`)).digest('hex').slice(0,12);layout[field]=`/${out}/${file}?v=${hash}`;
}
await writeFile(`${out}/layout.json`,JSON.stringify(layout,null,2)+'\n');
await writeFile(`${out}/bake-report.json`,JSON.stringify(report,null,2)+'\n');
await splitHouseStructure({directory:out});
console.log('ATLAS_MERGE_COMPLETE',count,out);
