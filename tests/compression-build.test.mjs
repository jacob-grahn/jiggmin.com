import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BALANCED,ROOM_IMAGES,LABEL_BOUNDS} from '../scripts/asset-compression.config.mjs';
import sharp from 'sharp';

const report=JSON.parse(readFileSync('dist/web/assets/compression-report.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const gltf=bytes=>JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));

test('production automatically compresses every runtime model with the approved preset',()=>{
 for(const [key,value] of Object.entries(BALANCED))assert.equal(report[key],value);
 const models=readdirSync('web/assets',{recursive:true}).filter(path=>path.endsWith('.glb')).map(path=>'web/assets/'+path);
 const labels=readdirSync('web/assets/labels',{recursive:true}).filter(path=>path.endsWith('.webp')).map(path=>'web/assets/labels/'+path);
 const expected=[...models,...ROOM_IMAGES.map(path=>'web/assets/'+path),...labels].sort();
 assert.deepEqual(report.assets.map(a=>a.source).sort(),expected);
 for(const asset of report.assets){
  const source=readFileSync(asset.source),built=readFileSync('dist/'+asset.source);
  assert.equal(hash(source),asset.sourceHash,'report must describe current source: '+asset.source);
  assert.equal(hash(built),asset.outputHash,'build must contain the validated output: '+asset.source);
  assert.equal(built.length,asset.bytes);
  if(asset.source.endsWith('.glb')){
   assert.ok(!gltf(source).extensionsRequired?.includes('KHR_draco_mesh_compression'),'source was overwritten');
   assert.ok(gltf(built).extensionsRequired.includes('KHR_draco_mesh_compression'),'runtime geometry is not compressed');
   assert.ok(asset.triangles>0);
  }else{
   assert.equal(built.toString('ascii',0,4),'RIFF');
   assert.equal(built.toString('ascii',8,12),'WEBP');
  }
 }
 assert.ok(report.bytes<report.originalBytes*.5,'expected substantial compression of current assets');
});

test('catalog labels are compressed within the label bounds without changing their URLs',async()=>{
 assert.deepEqual(report.labelBounds,LABEL_BOUNDS);
 const games=JSON.parse(readFileSync('data/games.json')).games;
 for(const game of games){
  if(!game.cartridgeLabel)continue;
  const path=game.cartridgeLabel.file;
  assert.ok(report.assets.some(asset=>asset.source===path),'label missing from pipeline: '+path);
  assert.equal(report.urls['/'+path],'/'+path);
  const source=await sharp(path).metadata(),built=await sharp('dist/'+path).metadata();
  assert.equal(built.format,'webp');
  assert.ok(built.width<=LABEL_BOUNDS.width&&built.height<=LABEL_BOUNDS.height);
  assert.ok(built.width<=source.width&&built.height<=source.height,'labels must not be enlarged');
  assert.ok(Math.abs(built.width-built.height*source.width/source.height)<=1,'aspect ratio must be preserved within pixel rounding');
 }
});

test('both production room loaders share self-hosted Draco decoding',()=>{
 for(const file of ['app.js','house-release-renderer.js'])assert.match(readFileSync('dist/web/'+file,'utf8'),/from '\.\/model-loader\.js'/);
 const loader=readFileSync('dist/web/model-loader.js','utf8');
 assert.match(loader,/setDecoderPath\('\/web\/vendor\/draco\/'\)/);
 assert.doesNotMatch(loader,/node_modules|https?:/);
 for(const file of ['draco_decoder.wasm','draco_wasm_wrapper.js','draco_decoder.js']){
  assert.ok(statSync('dist/web/vendor/draco/'+file).size>1000);
  assert.equal(hash(readFileSync('dist/web/vendor/draco/'+file)),hash(readFileSync('node_modules/three/examples/jsm/libs/draco/gltf/'+file)));
 }
});

test('retained original room lightmaps obey the shared phone delivery cap',async()=>{
 for(const room of ['hallway','workshop','basement','attic']){
  const bytes=readFileSync(`dist/web/assets/house/release/${room}.glb`),doc=gltf(bytes),start=28+bytes.readUInt32LE(12),images=new Set();
  for(const n of doc.nodes.filter(n=>String(n.extras?.release_baked??'').startsWith('original-'))){
   for(const p of doc.meshes[n.mesh]?.primitives??[]){
    const index=doc.materials[p.material]?.emissiveTexture?.index;if(index===undefined)continue;
    const t=doc.textures[index];images.add(t.extensions?.EXT_texture_webp?.source??t.source);
   }
  }
  assert.ok(images.size>0,room);
  for(const i of images){const view=doc.bufferViews[doc.images[i].bufferView],meta=await sharp(bytes.subarray(start+(view.byteOffset??0),start+(view.byteOffset??0)+view.byteLength)).metadata();assert.ok(Math.max(meta.width,meta.height)<=1024,`${room} retained an oversized lightmap`);}
 }
});

test('lighting atlases use the shared WebP quality 80 production encoder',async()=>{
 const path='web/assets/house/release/structure/hallway.glb';
 const sourceBytes=readFileSync(path),builtBytes=readFileSync('dist/'+path);
 const source=gltf(sourceBytes),built=gltf(builtBytes),checked=new Set();
 const image=(bytes,doc,index)=>{
  const t=doc.textures[index],i=t.extensions?.EXT_texture_webp?.source??t.source;
  const v=doc.bufferViews[doc.images[i].bufferView],start=28+bytes.readUInt32LE(12)+(v.byteOffset??0);
  return bytes.subarray(start,start+v.byteLength);
 };
 for(const n of source.nodes.filter(n=>n.extras?.atlas_group)){
  const output=built.nodes.find(o=>o.extras?.house_bake_id===n.extras.house_bake_id);
  assert.ok(output?.extras.atlas_group,n.name);
  for(const [i,p] of source.meshes[n.mesh].primitives.entries()){
   const index=source.materials[p.material].emissiveTexture?.index;
   if(index===undefined||checked.has(index))continue;checked.add(index);
   const cap=n.extras.atlas_delivery_max;
   const expected=await sharp(image(sourceBytes,source,index)).resize({width:cap,height:cap,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer();
   const q=built.meshes[output.mesh].primitives[i],outputIndex=built.materials[q.material].emissiveTexture.index;
   const actual=image(builtBytes,built,outputIndex);
   assert.equal(hash(actual),hash(expected),`${n.name}: lighting atlas differs from WebP quality 80`);
  }
 }
 assert.ok(checked.size>0,'expected a baked lighting atlas');
});
