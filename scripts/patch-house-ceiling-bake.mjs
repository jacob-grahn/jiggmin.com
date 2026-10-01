// Apply a reviewed ceiling-only rebake to its existing UV charts. No geometry,
// atlas packing, runtime lighting, or unrelated texture pixels are changed.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import sharp from 'sharp';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertUniqueTrim,protectUVTriangles,filterHouseTrimBake} from './filter-house-trim.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
export function replaceMaskedPixels(original,replacement,channels,target,protectedPixels){
 const out=Buffer.from(original);let changed=0;
 for(let i=0;i<target.length;i++){
  if(!target[i]||protectedPixels[i])continue;
  let different=false;
  for(let k=0;k<channels;k++){const j=i*channels+k;different ||= out[j]!==replacement[j];out[j]=replacement[j];}
  if(different)changed++;
 }
 return {out,changed};
}
function triangles(node,p){
 const position=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),ix=p.getIndices(),matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),result=[];
 for(let i=0;i<(ix?.getCount()??position.getCount());i+=3){
  const indices=[0,1,2].map(k=>ix?ix.getScalar(i+k):i+k),v=indices.map(j=>new THREE.Vector3(...position.getElement(j,[])).applyMatrix4(matrix));
  const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
  result.push({normal,uv:indices.map(j=>uv.getElement(j,[]))});
 }
 return result;
}
export async function patchHouseCeilingBake({samples=256,resolution=4096}={}){
 const dir='scene/exports/house-release/final',repair='scene/exports/house-release/ceiling-repair',stem=`${repair}/ceiling-${samples}-${resolution}`;
 const metadata=JSON.parse(readFileSync(`${stem}.json`)),report=JSON.parse(readFileSync(`${dir}/bake-report.json`)),receivers=new Set(metadata.receivers);
 if(resolution!==4096||samples<128)throw Error('Expected a high-quality 4K ceiling repair');
 const provenance=JSON.parse(readFileSync(existsSync(`${stem}-source.json`)?`${stem}-source.json`:`${repair}/source.json`)),recipeSnapshot=provenance.recipeSnapshot??`${repair}/bake-recipe.py`;
 if(provenance.baseSourceKey!==report.sourceKey||provenance.samples!==samples||provenance.resolution!==resolution||provenance.recipeHash!==sha(readFileSync(recipeSnapshot)))throw Error('Ceiling repair source snapshot differs from the completed bake');
 const rawPath=`${dir}/structure-unfiltered.glb`,bytes=readFileSync(rawPath),doc=await io.readBinary(new Uint8Array(bytes));assertUniqueTrim(doc);
 const texture=doc.getRoot().listTextures().find(t=>t.getName()==='structure-hall');
 const original=await sharp(texture.getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true}),patch=await sharp(`${stem}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(JSON.stringify(original.info)!==JSON.stringify(patch.info))throw Error('Ceiling atlas dimensions differ');
 const {width,height,channels}=original.info,target=new Uint8Array(width*height),protectedTriangles=[],targetTriangles=[],found=new Set();
 for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh()))for(const p of n.getMesh().listPrimitives()){
  if(p.getMaterial()?.getEmissiveTexture()!==texture)continue;
  for(const tri of triangles(n,p)){
   // The top and edges of the attic floor retain their original timber shading.
   const selected=receivers.has(n.getExtras().house_bake_id)&&(!/^Attic floor \/ hall ceiling/.test(n.getName())||tri.normal.y<-.9);
   if(selected){targetTriangles.push(tri.uv);found.add(n.getExtras().house_bake_id);}else protectedTriangles.push(tri.uv);
  }
 }
 if(found.size!==receivers.size)throw Error('Missing ceiling repair receivers');
 const protectedPixels=protectUVTriangles(protectedTriangles,width,height);
 // Include the baked 12-pixel gutter. Every other surface's UV footprint is
 // protected, including one texel around its edges for bilinear sampling.
 for(const coords of targetTriangles){
  const x0=Math.max(0,Math.floor(Math.min(...coords.map(p=>p[0]))*width)-12),x1=Math.min(width,Math.ceil(Math.max(...coords.map(p=>p[0]))*width)+12);
  const y0=Math.max(0,Math.floor(Math.min(...coords.map(p=>p[1]))*height)-12),y1=Math.min(height,Math.ceil(Math.max(...coords.map(p=>p[1]))*height)+12);
  for(let y=y0;y<y1;y++)target.fill(1,y*width+x0,y*width+x1);
 }
 const {out,changed}=replaceMaskedPixels(original.data,patch.data,channels,target,protectedPixels);
 for(let i=0;i<target.length;i++)if(!target[i]||protectedPixels[i])for(let k=0;k<channels;k++)if(out[i*channels+k]!==original.data[i*channels+k])throw Error('Ceiling patch changed an unrelated pixel');
 const png=await sharp(out,{raw:original.info}).png().toBuffer(),inputAtlasHash=sha(texture.getImage());texture.setImage(new Uint8Array(png));
 const backup=`${repair}/structure-before-ceiling-repair.glb`;if(!existsSync(backup))copyFileSync(rawPath,backup);
 const output=await io.writeBinary(doc);writeFileSync(rawPath,output);writeFileSync(`${dir}/structure.glb`,output);
 report.ceilingRepair={...metadata,baseSourceKey:provenance.baseSourceKey,recipeHash:provenance.recipeHash,recipeSnapshot,patchScriptHash:sha(readFileSync(new URL(import.meta.url))),bakePNGHash:sha(readFileSync(`${stem}.png`)),inputAtlasHash,outputAtlasHash:sha(png),changedPixels:changed,untargetedPixelsUnchanged:true,geometryAndUVsUnchanged:true};
 delete report.trimFiltering;const layout=JSON.parse(readFileSync(`${dir}/layout.json`));layout.lightingBake.report=report;
 writeFileSync(`${dir}/bake-report.json`,JSON.stringify(report,null,2)+'\n');writeFileSync(`${dir}/layout.json`,JSON.stringify(layout,null,2)+'\n');
 await filterHouseTrimBake(dir);console.log('CEILING_PATCHED',receivers.size,'surfaces;',changed,'pixels; other surfaces protected');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await patchHouseCeilingBake();
