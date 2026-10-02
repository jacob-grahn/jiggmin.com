// Update only picture materials and remove the obsolete Bitey credit geometry.
import {readFileSync,existsSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import sharp from 'sharp';
const dir='scene/house-textures/influences';
const placements=JSON.parse(readFileSync(`${dir}/placements.json`));
for(const p of placements){
 const height=1024,width=Math.round(height*p.width/p.height);
 await sharp(`${dir}/${p.file}`).resize(width,height,{fit:'contain',background:'#172126'}).flatten({background:'#172126'}).png().toFile(`${dir}/${p.texture}`);
}
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
export async function updateHouseArt(doc,room){
 let count=0;
 for(const node of [...doc.getRoot().listNodes()]){
  const name=node.getExtras().source_object??node.getName();
  if(name==='Bitey painting artist credit'){node.dispose();continue;}
  const p=placements.find(p=>p.room===room&&p.node===name);
  const bitey=name==='Bitey painting image';
  if(!p&&!bitey)continue;
  const path=bitey?'scene/house-textures/bitey/bitey-credited.png':`${dir}/${p.texture}`;
  const texture=doc.createTexture(`Print ${bitey?'Bitey credited':p.title}`).setImage(readFileSync(path)).setMimeType('image/png');
  const mesh=node.getMesh().clone();node.setMesh(mesh);
  for(const primitive of mesh.listPrimitives()){
   const material=primitive.getMaterial().clone().setName(`Print ${bitey?'Bitey credited':p.title}`);
   material.setBaseColorTexture(texture).setBaseColorFactor([1,1,1,1]);
   material.setEmissiveTexture(texture).setEmissiveFactor([.06,.06,.06]);
   material.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setRoughnessFactor(.85).setMetallicFactor(0);
   primitive.setMaterial(material);
  }
  node.setExtras({...node.getExtras(),artwork_title:bitey?'Bitey — Adam Phillips':p.title});count++;
 }
 return count;
}
if(process.argv[1]?.endsWith('update-house-art.mjs'))for(const room of ['hallway','workshop','basement','attic']){
 for(const path of [`web/assets/house/${room}-baked.glb`,`web/assets/house/release/${room}.glb`,`scene/exports/house/${room}.glb`,`scene/exports/house-release/${room}.glb`]){
  if(!existsSync(path))continue;
  const doc=await io.read(path),count=await updateHouseArt(doc,room);
  await doc.transform(prune());await io.write(path,doc);console.log(`${path}: ${count} pictures updated`);
 }
}
