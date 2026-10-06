import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BALANCED,ROOM_IMAGES,LABEL_BOUNDS,GEOMETRY_SIMPLIFICATION} from '../scripts/asset-compression.config.mjs';
import sharp from 'sharp';

const report=JSON.parse(readFileSync('dist/web/assets/compression-report.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const gltf=bytes=>JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));

test('production automatically compresses every runtime model with the approved preset',()=>{
 for(const [key,value] of Object.entries(BALANCED))assert.equal(report[key],value);
 assert.deepEqual(report.geometrySimplification,GEOMETRY_SIMPLIFICATION);
 const excluded=JSON.parse(readFileSync('scripts/production-asset-exclusions.json'));
 const models=readdirSync('web/assets',{recursive:true}).filter(path=>path.endsWith('.glb')&&!excluded.includes(path)).map(path=>'web/assets/'+path);
 for(const path of excluded){assert.ok(existsSync('web/assets/'+path),'source must remain available');assert.ok(!existsSync('dist/web/assets/'+path),'unused asset was deployed: '+path);}
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
   assert.ok(asset.triangles<=asset.beforeTriangles);
   assert.equal(asset.geometry.beforeTriangles,asset.beforeTriangles);
   assert.equal(asset.geometry.afterTriangles,asset.triangles);
   assert.ok(asset.geometry.nodes.length>0);
   assert.ok(asset.geometry.meshes.every(m=>m.afterTriangles<=m.beforeTriangles));
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
  const bytes=readFileSync(`dist/web/assets/house/release/${room==='basement'?'scenery/basement':room}.glb`),doc=gltf(bytes),start=28+bytes.readUInt32LE(12),images=new Set();
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

test('lighting atlases are repacked from masters and encoded once at quality 80',async()=>{
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
 const draco3d=(await import('draco3dgltf')).default;
 const {repackLightingAtlases}=await import('../scripts/repack-lighting-atlases.mjs');
 const {LIGHTING_ATLASES}=await import('../scripts/asset-compression.config.mjs');
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 const path='web/assets/house/release/structure/hallway.glb',source=await io.read(path),built=await io.read('dist/'+path);
 await repackLightingAtlases(source,LIGHTING_ATLASES);
 const expected=new Map(source.getRoot().listTextures().filter(t=>t.getExtras().delivery_atlas).map(t=>[t.getName(),t]));
 assert.ok(expected.size>0);
 let checked=0;
 for(const t of built.getRoot().listTextures())if(t.getExtras().delivery_atlas){
  const master=expected.get(t.getName());assert.ok(master,t.getName());assert.deepEqual(t.getSize(),master.getSize());
  const encoded=await sharp(master.getImage()).webp({quality:80,effort:4}).toBuffer();
  assert.equal(hash(t.getImage()),hash(encoded),t.getName());checked++;
 }
 assert.equal(checked,expected.size);
});

test('rear-hall cups atlas is encoded from its master at production WebP quality without resizing',async()=>{
 const path='web/assets/house/hallway-cups/atlas.webp';
 const asset=report.assets.find(asset=>asset.source===path);
 assert.ok(asset,'standalone cups atlas must go through the production encoder');
 const expected=await sharp(path).webp({quality:BALANCED.quality,effort:6}).toBuffer();
 const built=readFileSync('dist/'+path),meta=await sharp(built).metadata();
 assert.equal(hash(built),hash(expected));
 assert.equal(meta.width,1024);assert.equal(meta.height,512);
 assert.equal(report.urls['/'+path],'/'+path);
 assert.ok(built.length<readFileSync(path).length);
});


test('production layout and live/debug loader asset URLs resolve',()=>{
 const layout=JSON.parse(readFileSync('dist/web/assets/house/release/layout.json'));
 assert.equal(layout.assets.structure,undefined);assert.equal(layout.fixedFixtures,undefined);
 const urls=[...Object.values(layout.assets),...Object.values(layout.structureAssets),layout.denFloorReference];
 for(const file of ['web/app.js','web/house-release-renderer.js','web/house-window-sky.js']){
  const text=readFileSync(file,'utf8');
  urls.push(...[...text.matchAll(/['"](\/web\/assets\/[^'"\s]+\.(?:glb|webp|json)(?:\?[^'"\s]*)?)['"]/g)].map(m=>m[1]));
 }
 for(const url of urls.filter(Boolean))assert.ok(existsSync('dist'+url.split('?')[0]),url);
});

test('discarded cartridge and window maps are absent from delivery GLBs',async()=>{
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
 const draco3d=(await import('draco3dgltf')).default;
 const {replacesWindowMaterial}=await import('../scripts/remove-unused-runtime-textures.mjs');
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 const carts=await io.read('dist/web/assets/cartridges.glb');assert.equal(carts.getRoot().listTextures().length,0);
 let checked=0;
 for(const asset of report.assets.filter(a=>a.source.startsWith('web/assets/house/release/')&&a.source.endsWith('.glb'))){
  const doc=await io.read('dist/'+asset.source);
  for(const n of doc.getRoot().listNodes().filter(n=>replacesWindowMaterial(n,asset.source)))for(const p of n.getMesh()?.listPrimitives()??[]){
   const m=p.getMaterial();for(const slot of ['BaseColor','Emissive','Normal','Occlusion','MetallicRoughness'])assert.equal(m['get'+slot+'Texture'](),null,n.getName());checked++;
  }
 }
 assert.ok(checked>0);
});
