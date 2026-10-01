// Filter thin architectural boards inside their own UV faces. Preserve every
// texel sampled by non-trim geometry; the den and original room bakes are separate.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,unpartition} from '@gltf-transform/functions';
import * as THREE from 'three';
import sharp from 'sharp';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const toLinear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const toSRGB=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
export const trimFilterHash=()=>hash(readFileSync(new URL(import.meta.url)));
export function isBakedTrim(node){
 const e=node.getExtras();
 return Boolean(node.getMesh()&&e.release_baked&&!e.release_dynamic&&/^Finish \//.test(node.getName())&&/ceiling moulding|skirting| casing| head(?:\.\d+)?$|jamb|rail|sill|mullion|hatch liner/.test(node.getName()));
}
export function findDuplicateTrim(doc){
 const seen=new Map(),removed=[];
 for(const node of [...doc.getRoot().listNodes()]){
  if(!node.getMesh()||!/^Finish \//.test(node.getName())||!/ceiling moulding|skirting/.test(node.getName()))continue;
  const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),vertices=new Set();let triangles=0;
  for(const p of node.getMesh().listPrimitives()){
   const pos=p.getAttribute('POSITION');triangles+=(p.getIndices()?.getCount()??pos.getCount())/3;
   for(let i=0;i<pos.getCount();i++)vertices.add(new THREE.Vector3(...pos.getElement(i,[])).applyMatrix4(matrix).toArray().map(v=>Math.round(v*10000)).join(','));
  }
  // Only complete rectangular boards, independent of their diagonal triangulation.
  if(vertices.size!==8||triangles!==12)continue;
  const key=[...vertices].sort().join('|'),original=seen.get(key);
  if(original){removed.push({id:node.getExtras().house_bake_id,name:node.getName(),retained:original.getExtras().house_bake_id,group:node.getExtras().release_baked});}
  else seen.set(key,node);
 }
 return removed;
}
export function assertUniqueTrim(doc){
 const duplicates=findDuplicateTrim(doc);
 if(duplicates.length)throw Error(`Duplicate trim: ${duplicates.map(d=>d.name).join(', ')}. Fix the authoring scene before baking.`);
}
function triangleUVs(p,accept=()=>true){
 const uv=p.getAttribute('TEXCOORD_0'),indices=p.getIndices(),triangles=[];
 const pos=p.getAttribute('POSITION');
 for(let i=0;i<(indices?.getCount()??uv.getCount());i+=3){const corners=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k),v=corners.map(j=>new THREE.Vector3(...pos.getElement(j,[]))),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();if(accept(normal))triangles.push(corners.map(j=>uv.getElement(j,[])));}
 return triangles;
}
function faceUVs(p,accept=()=>true){
 const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),indices=p.getIndices(),groups=new Map();
 for(let i=0;i<(indices?.getCount()??pos.getCount());i+=3){
  const corners=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k),v=corners.map(j=>new THREE.Vector3(...pos.getElement(j,[])));
  const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
  if(!accept(normal))continue;
  const key=normal.toArray().map(v=>Math.round(v*10000)).join(',')+':'+Math.round(normal.dot(v[0])*10000);
  const points=groups.get(key)??[];points.push(...corners.map(j=>uv.getElement(j,[])));groups.set(key,points);
 }
 return [...groups.values()];
}
// Protect non-trim texels, including the footprint used by bilinear sampling.
export function protectUVTriangles(triangles,w,h){
 const mask=new Uint8Array(w*h);
 for(const tri of triangles){
  const v=tri.map(p=>[p[0]*w,p[1]*h]),lo=[0,1].map(k=>Math.max(0,Math.floor(Math.min(...v.map(p=>p[k]))))),hi=[0,1].map(k=>Math.min((k?h:w)-1,Math.ceil(Math.max(...v.map(p=>p[k])))));
  const edge=(a,b,x,y)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
   const e=v.map((a,i)=>edge(a,v[(i+1)%3],x+.5,y+.5));
   if(!(e.every(n=>n>=-1e-5)||e.every(n=>n<=1e-5)))continue;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)mask[(y+dy)*w+x+dx]=1;
  }
 }
 return mask;
}
export function filterFace(data,out,{width:w,height:h,channels:c},coords,protectedPixels,{minRadius=3,maxRadius=16,radiusScale=.035,padding=2}={}){
 const x0=Math.max(0,Math.ceil(Math.min(...coords.map(v=>v[0]))*w)),x1=Math.min(w-1,Math.floor(Math.max(...coords.map(v=>v[0]))*w));
 const y0=Math.max(0,Math.ceil(Math.min(...coords.map(v=>v[1]))*h)),y1=Math.min(h-1,Math.floor(Math.max(...coords.map(v=>v[1]))*h));
 const width=x1-x0+1,height=y1-y0+1;if(width<1||height<1)return false;
 const vertical=height>=width,L=vertical?height:width,S=vertical?width:height,lines=[];
 for(let l=0;l<L;l++){
  const rgb=[];
  for(let k=0;k<3;k++){
   const values=[];
   for(let s=0;s<S;s++){const x=vertical?x0+s:x0+l,y=vertical?y0+l:y0+s;values.push(toLinear(data[(y*w+x)*c+k]/255));}
   values.sort((a,b)=>a-b);const lo=Math.floor(S*.15),hi=Math.max(lo+1,Math.ceil(S*.85));
   rgb.push(values.slice(lo,hi).reduce((a,b)=>a+b,0)/(hi-lo));
  }
  lines.push(rgb);
 }
 const radius=Math.min(maxRadius,Math.max(minRadius,Math.round(L*radiusScale))),filtered=lines.map((_,l)=>[0,1,2].map(k=>{
  let sum=0,total=0;
  for(let j=-radius;j<=radius;j++){const weight=Math.exp(-j*j/(2*(radius/2)**2));sum+=lines[Math.max(0,Math.min(L-1,l+j))][k]*weight;total+=weight;}
  return Math.round(toSRGB(sum/total)*255);
 }));
 for(let y=Math.max(0,y0-padding);y<=Math.min(h-1,y1+padding);y++)for(let x=Math.max(0,x0-padding);x<=Math.min(w-1,x1+padding);x++){
  if(protectedPixels[y*w+x])continue;
  const l=Math.max(0,Math.min(L-1,vertical?y-y0:x-x0));for(let k=0;k<3;k++)out[(y*w+x)*c+k]=filtered[l][k];
 }
 return true;
}
// Ceiling paint is a broad plane, so filter in two dimensions rather than
// averaging across a thin board. Clamp every sample to its own UV chart.
export function filterCeilingFace(data,out,{width:w,height:h,channels:c},coords,protectedPixels){
 const x0=Math.max(0,Math.ceil(Math.min(...coords.map(v=>v[0]))*w)),x1=Math.min(w-1,Math.floor(Math.max(...coords.map(v=>v[0]))*w));
 const y0=Math.max(0,Math.ceil(Math.min(...coords.map(v=>v[1]))*h)),y1=Math.min(h-1,Math.floor(Math.max(...coords.map(v=>v[1]))*h));
 const W=x1-x0+1,H=y1-y0+1;if(W<1||H<1)return false;
 const radius=8,sigma=3,weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-((i-radius)**2)/(2*sigma*sigma))),sum=weights.reduce((a,b)=>a+b,0),temp=new Float32Array(W*H*3);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(let k=0;k<3;k++){
  let value=0;for(let d=-radius;d<=radius;d++)value+=weights[d+radius]*toLinear(data[((y+y0)*w+x0+Math.max(0,Math.min(W-1,x+d)))*c+k]/255);
  temp[(y*W+x)*3+k]=value/sum;
 }
 const filtered=new Uint8Array(W*H*3);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(let k=0;k<3;k++){
  let value=0;for(let d=-radius;d<=radius;d++)value+=weights[d+radius]*temp[(Math.max(0,Math.min(H-1,y+d))*W+x)*3+k];
  filtered[(y*W+x)*3+k]=Math.round(toSRGB(value/sum)*255);
 }
 for(let y=Math.max(0,y0-4);y<=Math.min(h-1,y1+4);y++)for(let x=Math.max(0,x0-4);x<=Math.min(w-1,x1+4);x++){
  if(protectedPixels[y*w+x])continue;
  const index=(Math.max(0,Math.min(H-1,y-y0))*W+Math.max(0,Math.min(W-1,x-x0)))*3;
  for(let k=0;k<3;k++)out[(y*w+x)*c+k]=filtered[index+k];
 }
 return true;
}
function isHallCeilingTrim(n){
 if(!/ceiling moulding/.test(n.getName()))return false;
 const [x,,z]=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(n.getWorldMatrix())).toArray();
 return x>=4.69&&x<=12.1&&z>=6.69&&z<=12.1;
}
const isHallCeiling=n=>Boolean(n.getMesh()&&n.getExtras().release_baked==='structure-hall'&&/^Attic floor \/ hall ceiling/.test(n.getName()));
function belowCeiling(node){const m=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().fromArray(node.getWorldMatrix()));return normal=>normal.clone().applyMatrix3(m).normalize().y<-.9;}
export async function filterHouseTrimBake(dir){
 const path=`${dir}/structure.glb`,reportPath=`${dir}/bake-report.json`,layoutPath=`${dir}/layout.json`,backup=`${dir}/structure-unfiltered.glb`;
 const report=JSON.parse(readFileSync(reportPath)),layout=JSON.parse(readFileSync(layoutPath)),scriptHash=trimFilterHash();let bytes=readFileSync(path);
 const previous=report.trimFiltering;
 if(previous?.outputStructureHash===hash(bytes)){
  if(previous.scriptHash===scriptHash)return previous;
  if(!existsSync(backup)||hash(readFileSync(backup))!==previous.inputStructureHash)throw Error('Missing matching unfiltered trim backup');
  bytes=readFileSync(backup);
 }
 const doc=await io.readBinary(new Uint8Array(bytes));assertUniqueTrim(doc);const trims=doc.getRoot().listNodes().filter(isBakedTrim);
 const ceilings=doc.getRoot().listNodes().filter(isHallCeiling);
 const textures=[...new Set([...trims,...ceilings].flatMap(n=>n.getMesh().listPrimitives().map(p=>p.getMaterial().getEmissiveTexture())))],atlasReports=[];
 for(const texture of textures){
  if(!texture)throw Error('Trim is missing its baked atlas');
  const {data,info}=await sharp(texture.getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true}),out=Buffer.from(data),otherTriangles=[];
  for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh()&&!isBakedTrim(n)))for(const p of n.getMesh().listPrimitives())if(p.getMaterial().getEmissiveTexture()===texture)otherTriangles.push(...triangleUVs(p,isHallCeiling(n)?normal=>!belowCeiling(n)(normal):()=>true));
  const protectedPixels=protectUVTriangles(otherTriangles,info.width,info.height);let faces=0;
  for(const n of trims)for(const p of n.getMesh().listPrimitives())if(p.getMaterial().getEmissiveTexture()===texture)for(const coords of faceUVs(p))if(filterFace(data,out,info,coords,protectedPixels,isHallCeilingTrim(n)?{minRadius:8,maxRadius:32,radiusScale:.12,padding:4}:{}))faces++;
  for(const n of ceilings)for(const p of n.getMesh().listPrimitives())if(p.getMaterial().getEmissiveTexture()===texture)for(const coords of faceUVs(p,belowCeiling(n)))if(filterCeilingFace(data,out,info,coords,protectedPixels))faces++;
  for(let i=0;i<protectedPixels.length;i++)if(protectedPixels[i])for(let k=0;k<info.channels;k++)if(out[i*info.channels+k]!==data[i*info.channels+k])throw Error('Trim filtering changed a non-trim texel');
  const png=await sharp(out,{raw:info}).png().toBuffer();atlasReports.push({name:texture.getName(),faces,inputHash:hash(texture.getImage()),outputHash:hash(png)});texture.setImage(new Uint8Array(png));
 }
 await doc.transform(prune(),unpartition());const output=await io.writeBinary(doc);
 const result={algorithm:'linear-light filtering within each board face and hallway ceiling underside; protected untargeted texels',scriptHash,inputStructureHash:hash(bytes),outputStructureHash:hash(output),filteredNodes:trims.map(n=>n.getExtras().house_bake_id),filteredCeilings:ceilings.map(n=>n.getExtras().house_bake_id),smoothedCeilingTrim:trims.filter(isHallCeilingTrim).map(n=>n.getExtras().house_bake_id),atlases:atlasReports};
 writeFileSync(backup,bytes);writeFileSync(path,output);report.trimFiltering=result;layout.lightingBake.report=report;
 layout.assets.structure=`/${dir}/structure.glb?v=${hash(output).slice(0,12)}`;
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');writeFileSync(layoutPath,JSON.stringify(layout,null,2)+'\n');
 console.log('TRIM_FILTERED',trims.length,'boards; source trim validated');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const quality=process.argv[2]??'final';if(!['test','final'].includes(quality))throw Error('Expected test or final');await filterHouseTrimBake(`scene/exports/house-release/${quality}`);
}
