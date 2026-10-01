// Snapshot the reviewed geometry. Bake only new fixed architecture and repainted ceilings.
import {assertUniqueTrim} from './filter-house-trim.mjs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),out='scene/exports/house-release/bake-input';mkdirSync(out,{recursive:true});
const classificationHash=createHash('sha256').update(readFileSync('scene/exports/house-release/classification.json')).digest('hex');
for(const room of ['structure','basement']){
 const doc=await io.read(`web/assets/house/release/${room}.glb`);
 if(room==='structure')assertUniqueTrim(doc);
 for(const [i,node] of doc.getRoot().listNodes().entries())if(node.getMesh())node.setExtras({...node.getExtras(),house_bake_id:`${room}:${i}`,house_bake_source:node.getName(),house_bake_classification:classificationHash});
 await io.write(`${out}/${room}.glb`,doc);
}
for(const room of ['hallway','workshop','attic'])copyFileSync(`web/assets/house/release/${room}.glb`,`${out}/${room}.glb`);
writeFileSync(`${out}/layout.json`,readFileSync('web/assets/house/release/layout.json'));
