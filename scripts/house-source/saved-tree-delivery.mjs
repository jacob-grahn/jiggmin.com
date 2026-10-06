// Replay the approved scenery selection; camera/window changes never recull trees.
import {readFile} from 'node:fs/promises';
import {copyToDocument} from '@gltf-transform/functions';

export async function applySavedTreeDelivery(documents,io){
 const report=JSON.parse(await readFile(new URL('./tree-delivery.json',import.meta.url)));
 const saved=await io.read(new URL('./tree-silhouettes.glb',import.meta.url).pathname);
 const replacements=new Map(saved.getRoot().listNodes().map(n=>[`${n.getExtras().tree_source_room}:${n.getName()}`,n]));
 for(const entry of report.trees){
  const doc=documents.get(entry.room),node=doc?.getRoot().listNodes().find(n=>n.getName()===entry.name);
  if(!node)continue;
  if(entry.action==='removed'){node.dispose();continue;}
  if(entry.action!=='silhouette')continue;
  const replacement=replacements.get(`${entry.room}:${entry.name}`);
  if(!replacement)throw Error(`Missing saved silhouette: ${entry.room}:${entry.name}`);
  const copied=copyToDocument(doc,saved,[replacement.getMesh()]);
  const extras={...node.getExtras(),tree_delivery:'crossed-silhouette',houseOutlined:true};
  for(const key of ['release_baked','atlas_group','atlas_source_id','atlas_delivery_max','atlas_lossless','house_window_bake'])delete extras[key];
  node.setMesh(copied.get(replacement.getMesh())).setExtras(extras);
 }
 return report;
}
