// Merge new moonlit surface bakes into copies of the current runtime models.
// Usage: node scene/scripts/prepare_hallway_style.mjs <verified bake GLB>
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {copyToDocument,unpartition,prune} from '@gltf-transform/functions';
import {mkdir,writeFile} from 'node:fs/promises';
const io=new NodeIO(),source=await io.read(process.argv[2]??'scene/renders/hallway-style/hallway-style.glb');
const out=process.argv[3]??'web/assets/house/hallway-style';await mkdir(out,{recursive:true});
const replacements=new Map(source.getRoot().listNodes().filter(n=>n.getExtras().hallway_style_source_id).map(n=>[n.getExtras().hallway_style_source_id,n]));
let replaced=0;const groups=new Map();
for(const asset of ['structure','hallway']){
 const target=await io.read(`web/assets/house/release/${asset}.glb`);
 const originals=target.getRoot().listNodes();
 const applicable=originals.map(node=>[node,replacements.get(asset+':'+(node.getExtras().house_bake_id??node.getExtras().source_object??node.getName()))]).filter(([,bake])=>bake);
 const map=copyToDocument(target,source,applicable.map(([,bake])=>bake.getMesh()));
 for(const [node,bake] of applicable){
  assert.ok(node.getWorldMatrix().every((v,i)=>Math.abs(v-bake.getWorldMatrix()[i])<.0001),'Bake transform changed: '+node.getName());
  node.setMesh(map.get(bake.getMesh()));
  node.setExtras({...node.getExtras(),texture_pixel_exact:true,hallway_style_group:bake.getExtras().hallway_style_group});
  groups.set(bake.getExtras().hallway_style_group,node.getMesh().listPrimitives()[0].getMaterial().getEmissiveTexture().getSize());replaced++;
 }
 // Preserve every hallway source image through build compression, including
 // the separate full-resolution picture artwork on live interactive objects.
 if(asset==='hallway')for(const node of originals)if(node.getMesh())node.setExtras({...node.getExtras(),texture_pixel_exact:true});
 await target.transform(prune({keepAttributes:true,keepLeaves:true}),unpartition());
 await io.write(`${out}/${asset}.glb`,target);
}
assert.equal(replaced,replacements.size,'Every baked receiver must match a runtime node');
await writeFile('scene/renders/hallway-style/merge-report.json',JSON.stringify({replaced,atlases:Object.fromEntries(groups)},null,2)+'\n');
console.log({replaced,atlases:Object.fromEntries(groups)});
