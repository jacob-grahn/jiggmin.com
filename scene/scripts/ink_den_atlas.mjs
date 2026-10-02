// Add camera-independent structural ink to the existing UV lighting atlas.
// Run after the lighting bake; no second lighting bake or GPU rental is needed.
import {NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const source=process.argv[2]??'scene/renders/den-uv-bake/den-uninked.glb';
const target=process.argv[3]??'web/assets/den-baked.glb';
const io=new NodeIO(),doc=await io.read(source);
// Older source exports retained a selected default object from another scene.
for(const node of doc.getRoot().listNodes())if(node.getName()==='Cube'&&!node.getExtras().role)node.dispose();
const atlases=new Map(),stats={source,meshes:0,edges:0};
for(const node of doc.getRoot().listNodes()){
 if(!['room_geometry','den_door'].includes(node.getExtras().role)||node.getExtras().den_native_artwork)continue;
 for(const primitive of node.getMesh().listPrimitives()){
  const position=primitive.getAttribute('POSITION').getArray(),uv=primitive.getAttribute('TEXCOORD_0').getArray(),indices=primitive.getIndices().getArray();
  const texture=primitive.getMaterial().getEmissiveTexture();
  if(!atlases.has(texture))atlases.set(texture,[]);
  const paths=atlases.get(texture);
  const [width,height]=texture.getSize();
  // Weld positions only for adjacency analysis: UV seams stay independent.
  const weld=new Map(),ids=new Uint32Array(position.length/3);let next=0;
  for(let i=0;i<ids.length;i++){
   const key=[0,1,2].map(k=>Math.round(position[i*3+k]*1e5)).join(',');
   if(!weld.has(key))weld.set(key,next++);ids[i]=weld.get(key);
  }
  const edges=new Map();
  for(let i=0;i<indices.length;i+=3){
   const vertices=[indices[i],indices[i+1],indices[i+2]],a=vertices[0]*3,b=vertices[1]*3,c=vertices[2]*3;
   const ab=[0,1,2].map(k=>position[b+k]-position[a+k]),ac=[0,1,2].map(k=>position[c+k]-position[a+k]);
   const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
   const magnitude=Math.hypot(...normal);if(magnitude<1e-10)continue;
   for(let k=0;k<3;k++)normal[k]/=magnitude;
   for(let j=0;j<3;j++){
    const from=vertices[j],to=vertices[(j+1)%3],lo=Math.min(ids[from],ids[to]),hi=Math.max(ids[from],ids[to]);if(lo===hi)continue;
    const key=lo+':'+hi;
    if(!edges.has(key))edges.set(key,[]);edges.get(key).push({from,to,normal});
   }
  }
  for(const adjacent of edges.values()){
   // Ignore triangulation, smooth tessellation, and nonmanifold detail. Borders
   // and >= 35-degree creases get actual surface marks on both sides of seams.
   if(adjacent.length>2)continue;
   if(adjacent.length===2&&adjacent[0].normal.reduce((sum,v,k)=>sum+v*adjacent[1].normal[k],0)>Math.cos(35*Math.PI/180))continue;
   const {from,to}=adjacent[0],length=Math.hypot(...[0,1,2].map(k=>position[from*3+k]-position[to*3+k]));
   if(length<.055)continue;
   for(const edge of adjacent){
    const x1=uv[edge.from*2]*width,y1=uv[edge.from*2+1]*height,x2=uv[edge.to*2]*width,y2=uv[edge.to*2+1]*height;
    // Width scales with texel density, so a small UV island is not filled black.
    const pixels=Math.hypot(x2-x1,y2-y1),stroke=Math.max(.75,Math.min(3,pixels/length*.008));
    paths.push(`<path d="M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}" stroke-width="${stroke.toFixed(2)}"/>`);
   }
   stats.edges++;
  }
  stats.meshes++;
 }
}
if(!stats.edges)throw new Error('No den structural edges found');
for(const [texture,paths] of atlases){
const [width,height]=texture.getSize();
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g stroke="#09070f" stroke-opacity="0.92" stroke-linecap="round" fill="none">${paths.join('')}</g></svg>`);
const image=await sharp(texture.getImage()).composite([{input:svg}]).png().toBuffer();
texture.setImage(image).setMimeType('image/png').setName(texture.getName()+' with structural ink');
}
for(const node of doc.getRoot().listNodes())if(['room_geometry','den_door'].includes(node.getExtras().role)&&!node.getExtras().den_native_artwork)node.setExtras({...node.getExtras(),den_surface_ink:true});
await io.write(target,doc);
await writeFile('scene/renders/den-uv-bake/ink-report.json',JSON.stringify({...stats,atlases:atlases.size,creaseDegrees:35,minimumEdgeLength:.055},null,2)+'\n');
console.log(JSON.stringify(stats));
