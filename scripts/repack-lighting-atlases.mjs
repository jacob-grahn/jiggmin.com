import sharp from 'sharp';
import {prune} from '@gltf-transform/functions';

// Delivery-only repacking: source UVs and lossless bake masters stay editable.
export function packRectangles(rectangles,size){
 const pages=[];
 for(const r of [...rectangles].sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height)||b.width*b.height-a.width*a.height||a.id-b.id)){
  if(r.width>size||r.height>size)throw Error('Atlas region exceeds page');
  let best;
  for(const [page,p] of pages.entries())for(const [index,f] of p.free.entries())if(r.width<=f.width&&r.height<=f.height){
   const score=Math.min(f.width-r.width,f.height-r.height);
   if(!best||score<best.score)best={page,index,f,score};
  }
  if(!best){pages.push({free:[{x:0,y:0,width:size,height:size}],regions:[]});best={page:pages.length-1,index:0,f:pages.at(-1).free[0]};}
  const p=pages[best.page],f=best.f;p.free.splice(best.index,1);
  // Guillotine partitions never overlap; rotate neither pixels nor tangent bases.
  if(f.width-r.width>f.height-r.height){
   if(f.width>r.width)p.free.push({x:f.x+r.width,y:f.y,width:f.width-r.width,height:f.height});
   if(f.height>r.height)p.free.push({x:f.x,y:f.y+r.height,width:r.width,height:f.height-r.height});
  }else{
   if(f.height>r.height)p.free.push({x:f.x,y:f.y+r.height,width:f.width,height:f.height-r.height});
   if(f.width>r.width)p.free.push({x:f.x+r.width,y:f.y,width:f.width-r.width,height:r.height});
  }
  Object.assign(r,{page:best.page,x:f.x,y:f.y});p.regions.push(r);
 }
 return pages;
}

export function uvCharts(primitive,uv){
 const indices=primitive.getIndices(),count=indices?.getCount()??uv.getCount(),parents=Array.from({length:count/3},(_,i)=>i),edges=new Map(),triangles=[];
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const key=i=>uv.getElement(i,[]).map(v=>v.toFixed(6)).join(',');
 for(let i=0;i<count;i+=3){
  const t=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k);triangles.push(t);
  for(let k=0;k<3;k++){
   const a=key(t[k]),b=key(t[(k+1)%3]);if(a===b)continue;
   const edge=[a,b].sort().join('|'),other=edges.get(edge);
   if(other!==undefined)parents[root(i/3)]=root(other);else edges.set(edge,i/3);
  }
 }
 const charts=new Map();triangles.forEach((t,i)=>{const r=root(i),c=charts.get(r)??[];c.push(t);charts.set(r,c);});return [...charts.values()];
}

export async function repackLightingAtlases(document,{pageSize=1024,groupCaps={},gutter=8}={}){
 const batches=new Map(),report={pageSize,gutter,groups:[]},r=document.getRoot();
 const meshOwners=new Map();for(const n of r.listNodes())if(n.getMesh()){const list=meshOwners.get(n.getMesh())??[];list.push(n);meshOwners.set(n.getMesh(),list);}
 for(const [mesh,nodes] of meshOwners){
  if(!nodes.every(n=>n.getExtras().release_baked))continue;
  for(const primitive of mesh.listPrimitives()){
   const material=primitive.getMaterial(),texture=material?.getEmissiveTexture(),info=material?.getEmissiveTextureInfo();
   if(!texture||primitive.getMode()!==4||primitive.listTargets().length||info.listExtensions().length)continue;
   // Only unlit baked reflectance. Other maps share UVs and must not be moved.
   if(material.getBaseColorTexture()||material.getNormalTexture()||material.getOcclusionTexture()||material.getMetallicRoughnessTexture())continue;
   const semantic='TEXCOORD_'+info.getTexCoord(),uv=primitive.getAttribute(semantic);if(!uv)continue;
   if(!uv.getArray().every(v=>Number.isFinite(v)&&v>=-.00001&&v<=1.00001))continue;
   const group=nodes[0].getExtras().atlas_group??nodes[0].getExtras().release_baked;
   const key=texture;let batch=batches.get(key);
   if(!batch){const cap=groupCaps[group]??pageSize,[w,h]=texture.getSize(),scale=Math.min(1,(cap-2*gutter-4)/Math.max(w,h));batch={texture,group,cap,width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),entries:[],regions:[],dedup:new Map()};batches.set(key,batch);}
   const entry={mesh,primitive,semantic,charts:[]};batch.entries.push(entry);
   for(const triangles of uvCharts(primitive,uv)){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const triangle of triangles)for(const i of triangle){const [u,v]=uv.getElement(i,[]),x=u*batch.width,y=v*batch.height;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    const left=Math.max(0,Math.floor(minX)-2),top=Math.max(0,Math.floor(minY)-2),right=Math.min(batch.width,Math.ceil(maxX)+2),bottom=Math.min(batch.height,Math.ceil(maxY)+2);
    const width=Math.max(1,right-left),height=Math.max(1,bottom-top),key=[left,top,width,height].join(',');
    let region=batch.dedup.get(key);if(!region){region={id:batch.regions.length,left,top,cropWidth:width,cropHeight:height,width:width+2*gutter,height:height+2*gutter};batch.regions.push(region);batch.dedup.set(key,region);}
    entry.charts.push({triangles,region});
   }
  }
 }
 for(const b of batches.values()){
  const pages=packRectangles(b.regions,b.cap);
  // A sparse or overlapping source chart layout may need extra rectangles.
  // Repacking must not increase the texture allocation over its old cap.
  const oldCap=Math.max(...b.entries.flatMap(e=>meshOwners.get(e.mesh).map(n=>n.getExtras().atlas_delivery_max??1024)));
  const [oldWidth,oldHeight]=b.texture.getSize(),oldScale=Math.min(1,oldCap/Math.max(oldWidth,oldHeight));
  if(pages.length*b.cap*b.cap>Math.ceil(oldWidth*oldScale)*Math.ceil(oldHeight*oldScale)){
   const image=await sharp(b.texture.getImage()).resize({width:b.cap,height:b.cap,fit:'inside',withoutEnlargement:true}).png().toBuffer();b.texture.setImage(image).setMimeType('image/png').setExtras({...b.texture.getExtras(),delivery_atlas:true,sourceGroup:b.group,pageSize:b.cap,retainedLayout:true});
   report.groups.push({group:b.group,sourceSize:[oldWidth,oldHeight],pages:1,size:b.cap,retainedLayout:true,pixels:b.texture.getSize().reduce((a,v)=>a*v,1)});continue;
  }
  const source=await sharp(b.texture.getImage()).resize(b.width,b.height).png().toBuffer();
  const textures=[];
  for(const [index,page] of pages.entries()){
   const composites=[];
   for(const c of page.regions){const image=await sharp(source).extract({left:c.left,top:c.top,width:c.cropWidth,height:c.cropHeight}).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).png().toBuffer();composites.push({input:image,left:c.x,top:c.y});}
   const pixels=await sharp({create:{width:b.cap,height:b.cap,channels:3,background:'#000'}}).composite(composites).png().toBuffer();
   textures.push(document.createTexture(`${b.group} / page ${index+1}`).setImage(pixels).setMimeType('image/png').setExtras({delivery_atlas:true,sourceGroup:b.group,page:index,pageSize:b.cap,gutter}));
  }
  const materialPages=new Map();
  for(const entry of b.entries){
   const original=entry.primitive,byPage=new Map();
   for(const c of entry.charts){const list=byPage.get(c.region.page)??[];list.push(c);byPage.set(c.region.page,list);}
   entry.mesh.removePrimitive(original);
   for(const [page,charts] of byPage){
    const p=document.createPrimitive().setMode(4).setExtras(original.getExtras()),oldMaterial=original.getMaterial();
    let materials=materialPages.get(oldMaterial);if(!materials){materials=new Map();materialPages.set(oldMaterial,materials);}
    let material=materials.get(page);if(!material){material=oldMaterial.clone().setEmissiveTexture(textures[page]);material.getEmissiveTextureInfo().setWrapS(33071).setWrapT(33071);materials.set(page,material);}p.setMaterial(material);
    const vertices=[],indices=[],lookup=new Map();
    for(const [chartIndex,c] of charts.entries())for(const triangle of c.triangles)for(const vertex of triangle){const key=chartIndex+':'+vertex;let id=lookup.get(key);if(id===undefined){id=vertices.length;lookup.set(key,id);vertices.push({vertex,region:c.region});}indices.push(id);}
    for(const semantic of original.listSemantics()){
     const a=original.getAttribute(semantic),ArrayType=a.getArray().constructor,array=new ArrayType(vertices.length*a.getElementSize());
     vertices.forEach(({vertex},i)=>{
      // Copy storage values unchanged, including normalized integer attributes.
      for(let k=0;k<a.getElementSize();k++)array[i*a.getElementSize()+k]=a.getArray()[vertex*a.getElementSize()+k];
     });
     const accessor=document.createAccessor(a.getName()).setBuffer(r.listBuffers()[0]).setType(a.getType()).setNormalized(a.getNormalized()).setArray(array);
     if(semantic===entry.semantic)vertices.forEach(({vertex,region},i)=>{const v=a.getElement(vertex,[]);accessor.setElement(i,[(v[0]*b.width-region.left+region.x+gutter)/b.cap,(v[1]*b.height-region.top+region.y+gutter)/b.cap]);});
     p.setAttribute(semantic,accessor);
    }
    p.setIndices(document.createAccessor().setBuffer(r.listBuffers()[0]).setType('SCALAR').setArray(new Uint32Array(indices)));entry.mesh.addPrimitive(p);
   }
  }
  report.groups.push({group:b.group,sourceSize:b.texture.getSize(),sampleSize:[b.width,b.height],regions:b.regions.length,pages:pages.length,size:b.cap,pixels:pages.length*b.cap*b.cap});
 }
 await document.transform(prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}));return report;
}
