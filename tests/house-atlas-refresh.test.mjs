import test from 'node:test';
import assert from 'node:assert/strict';
import {replacesWindowMaterial} from '../scripts/remove-unused-runtime-textures.mjs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {readFileSync,existsSync} from 'node:fs';
const dir=process.env.ATLAS_REFRESH_DIR??'web/assets/house/release';
const layout=JSON.parse(readFileSync(`${dir}/layout.json`));
const enabled=!!layout.atlasRefresh;
const baselineDirectory=layout.atlasRefresh?.baselineDirectory??'scene/exports/house-release/atlas-baseline';
const baselineAvailable=['structure','hallway','workshop','basement','attic'].every(room=>existsSync(`${baselineDirectory}/${room}.glb`));
const localBakeAvailable=enabled&&existsSync(`${layout.atlasRefresh.resultDirectory}/source-audit.json`)&&existsSync(`${layout.atlasRefresh.resultDirectory}/report.json`);
function points(node){return [...new Map(node.getMesh().listPrimitives().flatMap(p=>{
 const a=p.getAttribute('POSITION'),indices=p.getIndices();
 return Array.from({length:indices?.getCount()??a.getCount()},(_,i)=>{
  const point=a.getElement(indices?indices.getScalar(i):i,[]);return [point.join(','),point];
 });
})).values()];}
function sameSurfaceVertices(a,b,name){
 // Exporters may weld or split corners and round float32 coordinates. Ignore
 // unreferenced accessor vertices left by source face separation.
 const tolerance=.0001,near=(p,q)=>p.every((v,i)=>Math.abs(v-q[i])<=tolerance);
 const covered=(source,target)=>{
  const grid=new Map();for(const p of target){const key=p.map(v=>Math.floor(v/tolerance)).join(',');const bucket=grid.get(key)??[];bucket.push(p);grid.set(key,bucket);}
  return source.every(p=>{
   const [x,y,z]=p.map(v=>Math.floor(v/tolerance));
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)if(grid.get(`${x+dx},${y+dy},${z+dz}`)?.some(q=>near(p,q)))return true;
   return false;
  });
 };
 assert.ok(covered(a,b)&&covered(b,a),name);
}
test('full atlas refresh preserves geometry and live art while exporting lossless bake masters',{skip:!enabled||(!baselineAvailable&&'Local bake baseline is not included in Git')},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);let receivers=0;const groups=new Set();
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const source=await io.read(`${baselineDirectory}/${room}.glb`),after=await io.read(`${dir}/${room}.glb`);
  const originals=new Map(source.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id??n.getName(),n]));
  for(const n of after.getRoot().listNodes().filter(n=>n.getMesh())){
   const o=originals.get(n.getExtras().house_bake_id??n.getName());assert.ok(o,n.getName());assert.ok(n.getWorldMatrix().every((v,i)=>Math.abs(v-o.getWorldMatrix()[i])<=.000001),n.getName());sameSurfaceVertices(points(n),points(o),n.getName());
   if(n.getExtras().atlas_source_id){
    receivers++;groups.add(n.getExtras().atlas_group);
    for(const p of n.getMesh().listPrimitives())assert.equal(p.getMaterial().getEmissiveTexture().getMimeType(),'image/png');
   }else{
    const a=n.getMesh().listPrimitives(),b=o.getMesh().listPrimitives();
    for(let i=0;i<a.length;i++)for(const slot of ['BaseColor','Emissive'])assert.deepEqual(a[i].getMaterial()[`get${slot}Texture`]?.()?.getImage(),b[i].getMaterial()[`get${slot}Texture`]?.()?.getImage(),n.getName());
   }
  }
 }
 assert.equal(receivers,layout.atlasRefresh.objects);assert.equal(groups.size,Object.keys(layout.atlasRefresh.atlases).length);
 assert.equal(layout.atlasRefresh.denoise,'irradiance-only');
});
test('full atlas source mapping rejects mismatched geometry',{skip:!enabled||(!localBakeAvailable&&'Local bake audit and masters are not included in Git')},()=>{
 const audit=JSON.parse(readFileSync(`${layout.atlasRefresh.resultDirectory}/source-audit.json`));
 assert.equal(audit.length,layout.atlasRefresh.objects);
 for(const n of audit){
  if(n.maxSourceDistance===null){assert.ok(['authored-window-reveal-metres','authored-world-metres'].includes(n.mapping));assert.ok(n.projectedNewFaces>0,n.name);}
  else assert.ok(n.maxSourceDistance<=.01,n.name);
 }
 const master=JSON.parse(readFileSync(`${layout.atlasRefresh.resultDirectory}/report.json`));
 assert.equal(master.losslessBake,true);
 for(const [group,a] of Object.entries(master.atlases)){
  assert.ok(a.resolution[0]<=4096);assert.ok(existsSync(`${layout.atlasRefresh.resultDirectory}/${group}.png`));
 }
});

test('shared delivery atlases fit a bounded texture budget without changing masters',{skip:!enabled},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),groups=new Map();
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const d=await io.read(`${dir}/${room}.glb`);
  for(const n of d.getRoot().listNodes()){
   const e=n.getExtras();if(!e.atlas_group)continue;
   assert.ok([1024,2048].includes(e.atlas_delivery_max));
   const [w,h]=n.getMesh().listPrimitives()[0].getMaterial().getEmissiveTexture().getSize();
   const scale=Math.min(1,e.atlas_delivery_max/Math.max(w,h));groups.set(e.atlas_group,Math.round(w*scale)*Math.round(h*scale));
  }
 }
 assert.ok([...groups.values()].reduce((a,b)=>a+b,0)<=48*1024*1024,'Total shared atlas pixels must stay under 48 MP');
});

test('production serves one shared, phone-bounded WebP atlas set',{skip:!enabled},async()=>{
 const {readdirSync}=await import('node:fs');
 const draco3d=(await import('draco3dgltf')).default;
 const builtDir=process.env.ATLAS_BUILT_DIR??'dist/web/assets/house/release';
 const builtLayout=JSON.parse(readFileSync(`${builtDir}/layout.json`));
 assert.equal(builtLayout.mobileAssets,undefined);
 assert.ok(!readdirSync(builtDir).some(name=>name.includes('-mobile')));
 const renderer=readFileSync('web/house-release-renderer.js','utf8');
 assert.ok(!renderer.includes('compactTextures')&&!renderer.includes('mobileAssets'));
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 const groups=new Map(),pages=new Map();let bytes=0;
 for(const room of ['structure/hallway','structure/den','structure/workshop','structure/basement','structure/attic','hallway','workshop','scenery/basement','attic']){
  const path=`${builtDir}/${room}.glb`;bytes+=readFileSync(path).length;
  const source=await io.read(`${dir}/${room}.glb`),built=await io.read(path);
  const originals=new Map(source.getRoot().listNodes().map(n=>[n.getExtras().house_bake_id??n.getName(),n]));
  for(const n of built.getRoot().listNodes().filter(n=>n.getMesh())){
   const e=n.getExtras(),o=originals.get(e.house_bake_id??n.getName());
   if(replacesWindowMaterial(n,`web/assets/house/release/${room}.glb`))continue;
   if(e.atlas_group){
    for(const p of n.getMesh().listPrimitives()){
     const t=p.getMaterial().getEmissiveTexture(),[w,h]=t.getSize();
     assert.equal(t.getMimeType(),'image/webp');assert.ok(Math.max(w,h)<=e.atlas_delivery_max);
     groups.set(e.atlas_group,w*h);pages.set(createHash('sha256').update(t.getImage()).digest('hex'),w*h);
    }
   }else{
    // Live artwork keeps its original image dimensions through the shared build.
    for(const [i,p] of n.getMesh().listPrimitives().entries())for(const slot of ['BaseColor','Emissive']){
     const a=p.getMaterial()[`get${slot}Texture`](),b=o.getMesh().listPrimitives()[i].getMaterial()[`get${slot}Texture`]();
     if(b)assert.deepEqual(a.getSize(),b.getSize(),n.getName());
    }
   }
  }
 }
 assert.equal(groups.size,Object.keys(layout.atlasRefresh.atlases).length);
 const texels=[...pages.values()].reduce((a,b)=>a+b,0);
 assert.ok(texels<=48*1024*1024,'Atlas base levels exceed the shared texture budget');
 console.log(`Shared release: ${groups.size} atlases, ${(texels/1e6).toFixed(2)} MP, ${(bytes/1e6).toFixed(2)} MB across streamed room models`);
});

test('refreshed cellar wall lightmaps receive visible moonlight',{skip:!enabled},async()=>{
 const sharp=(await import('sharp')).default;
 const d=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/basement.glb`);
 const walls=d.getRoot().listNodes().filter(n=>n.getExtras().atlas_group&&/painted masonry/.test(n.getName()));assert.equal(walls.length,3);
 const decoded=new Map();
 for(const n of walls){
  let brightest=0;
  for(const p of n.getMesh().listPrimitives()){
   const texture=p.getMaterial().getEmissiveTexture();
   if(!decoded.has(texture))decoded.set(texture,await sharp(texture.getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true}));
   const {data,info}=decoded.get(texture),uv=p.getAttribute('TEXCOORD_0'),indices=p.getIndices();
   for(let i=0;i<(indices?.getCount()??uv.getCount());i+=3){
    const corners=[0,1,2].map(k=>uv.getElement(indices?indices.getScalar(i+k):i+k,[]));
    const u=corners.reduce((a,b)=>a+b[0],0)/3,v=corners.reduce((a,b)=>a+b[1],0)/3;
    const x=Math.max(0,Math.min(info.width-1,Math.floor(u*info.width))),y=Math.max(0,Math.min(info.height-1,Math.floor(v*info.height)));
    brightest=Math.max(brightest,data[(y*info.width+x)*info.channels+2]);
   }
  }
  assert.ok(brightest>15,`${n.getName()} is black despite its window light`);
 }
});
