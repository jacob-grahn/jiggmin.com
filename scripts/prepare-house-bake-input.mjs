import {prepareHouseStatic} from './prepare-house-static.mjs';
import {splitSourceCeilings} from './split-house-ceiling-source.mjs';
// Snapshot the reviewed geometry. Bake only new fixed architecture and repainted ceilings.
import {assertUniqueTrim} from './house-source/validate-trim.mjs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),out='scene/exports/house-release/bake-input';mkdirSync(out,{recursive:true});
const source=process.env.HOUSE_REFERENCE_OUT??'web/assets/house/release';
await prepareHouseStatic(source);
const classificationHash=createHash('sha256').update(readFileSync('scene/exports/house-release/classification.json')).digest('hex');
for(const room of ['structure','basement','attic']){
 const doc=await io.read(`${source}/${room}.glb`);
 if(room==='structure'){splitSourceCeilings(doc);assertUniqueTrim(doc);}
 for(const [i,node] of doc.getRoot().listNodes().entries())if(node.getMesh())node.setExtras({...node.getExtras(),house_bake_id:`${room}:${i}`,house_bake_source:node.getExtras().source_ceiling_object??(node.getExtras().source_shell_room?node.getExtras().house_bake_source:null)??node.getName(),house_bake_classification:classificationHash});
 await io.write(`${out}/${room}.glb`,doc);
}
for(const room of ['hallway','workshop'])copyFileSync(`${source}/${room}.glb`,`${out}/${room}.glb`);
writeFileSync(`${out}/layout.json`,readFileSync(`${source}/layout.json`));
