// Always encode source exports, never a previous compressed build.
import {mkdir, readFile, writeFile, stat, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {NodeIO, Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {draco, textureCompress} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import {BALANCED, PRESETS, ROOM_IMAGES, LABEL_BOUNDS} from './asset-compression.config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{
  production:{type:'boolean',default:false},output:{type:'string'},
  quality:{type:'string'}, 'position-bits':{type:'string'},
  'normal-bits':{type:'string'}, 'uv-bits':{type:'string'},
  'max-texture-size':{type:'string'},
}});
const production=values.production;
const output=resolve(root,values.output??(production?'dist/web/assets':'scene/compression'));
const sourceAssets=resolve(root,'web/assets');
assert.ok(output!==sourceAssets&&!sourceAssets.startsWith(output+'/'),'Output must not overwrite source assets');
assert.ok(!output.startsWith(sourceAssets+'/'),'Output must not be inside source assets');
const custom=Object.keys(values).some(key=>!['production','output'].includes(key));
if(production&&custom)throw Error('Production always uses the shared Balanced preset; use comparison mode for experiments.');
function integer(key,fallback,min,max){
  const n=Number(values[key]??fallback);
  if(!Number.isInteger(n)||n<min||n>max)throw Error(`${key} must be an integer from ${min} to ${max}`);
  return n;
}
const presets=production?[BALANCED]:custom?[{
  id:'custom',quality:integer('quality',80,1,100),
  positionBits:integer('position-bits',14,8,24),normalBits:integer('normal-bits',10,6,16),
  uvBits:integer('uv-bits',12,8,20),maxTextureSize:integer('max-texture-size',0,0,8192),
}]:PRESETS;
async function findAssets(directory,suffix){
  const result=[];
  for(const entry of await readdir(resolve(root,directory),{withFileTypes:true})){
    const path=`${directory}/${entry.name}`;
    if(entry.isDirectory())result.push(...await findAssets(path,suffix));
    else if(entry.isFile()&&path.endsWith(suffix))result.push(path);
  }
  return result.sort();
}
const models=await findAssets('web/assets','.glb');
const labels=await findAssets('web/assets/labels','.webp');
const labelSet=new Set(labels);
const images=ROOM_IMAGES.map(name=>`web/assets/${name}`);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder':await draco3d.createEncoderModule(),
  'draco3d.decoder':await draco3d.createDecoderModule(),
});
// Node names/extras/ownership are an API: picking, physics and baked shading use them.
function sceneSignature(document){
  const r=document.getRoot(),nodes=r.listNodes();
  return nodes.map(n=>({name:n.getName(),extras:n.getExtras(),matrix:n.getMatrix(),
    children:n.listChildren().map(child=>nodes.indexOf(child)),
    camera:n.getCamera()?.getName(),mesh:n.getMesh()?.getName()}));
}
function inspectGeometry(document){
  let triangles=0;
  for(const mesh of document.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const position=primitive.getAttribute('POSITION');
    assert.ok(position,'missing positions');
    assert.ok(position.getArray().every(Number.isFinite),'invalid positions');
    if(primitive.getMode()===4)triangles+=(primitive.getIndices()?.getCount()??position.getCount())/3;
  }
  return triangles;
}
await mkdir(output,{recursive:true});
for(const preset of presets){
  const report={...preset,labelBounds:LABEL_BOUNDS,assets:[],urls:{},originalBytes:0,bytes:0,gzipBytes:0};
  for(const source of [...models,...images,...labels]){
    const relative=source.replace(/^web\/assets\//,'').replace(/\.png$/,'.webp');
    const target=production?resolve(output,relative):resolve(output,preset.id,relative);
    await mkdir(dirname(target),{recursive:true});
    let beforeTriangles,afterTriangles;
    if(source.endsWith('.glb')){
      const document=await io.read(resolve(root,source));
      document.setLogger(new Logger(Logger.Verbosity.WARN));
      const signature=sceneSignature(document);
      beforeTriangles=inspectGeometry(document);
      await document.transform(textureCompress({encoder:sharp,targetFormat:'webp',
        slots:/^(baseColorTexture|emissiveTexture)$/,
        quality:preset.quality,effort:60,
        ...(preset.maxTextureSize?{resize:[preset.maxTextureSize,preset.maxTextureSize]}:{}),
      }),draco({method:'sequential',encodeSpeed:5,decodeSpeed:5,
        quantizePosition:preset.positionBits,quantizeNormal:preset.normalBits,
        quantizeTexcoord:preset.uvBits,quantizationVolume:'mesh'}));
      await io.write(target,document);
      const decoded=await io.read(target);
      assert.deepEqual(sceneSignature(decoded),signature,`${source}: scene structure changed`);
      afterTriangles=inspectGeometry(decoded);
      assert.equal(afterTriangles,beforeTriangles,`${source}: triangle count changed`);
    }else{
      let pipeline=sharp(resolve(root,source));
      if(labelSet.has(source)){
        const width=Math.min(LABEL_BOUNDS.width,preset.maxTextureSize||Infinity);
        const height=Math.min(LABEL_BOUNDS.height,preset.maxTextureSize||Infinity);
        pipeline=pipeline.resize({width,height,fit:'inside',withoutEnlargement:true});
      }else if(preset.maxTextureSize)pipeline=pipeline.resize({width:preset.maxTextureSize,height:preset.maxTextureSize,fit:'inside',withoutEnlargement:true});
      await pipeline.webp({quality:preset.quality,effort:6}).toFile(target);
    }
    const sourceData=await readFile(resolve(root,source));
    const originalBytes=sourceData.length;
    const bytes=(await stat(target)).size;
    const gzipBytes=gzipSync(await readFile(target)).length;
    const sourceHash=createHash('sha256').update(sourceData).digest('hex');
    const outputHash=createHash('sha256').update(await readFile(target)).digest('hex');
    report.assets.push({source,sourceHash,outputHash,originalBytes,bytes,gzipBytes,...(beforeTriangles===undefined?{}:{triangles:afterTriangles})});
    report.urls['/'+source]=production?`/web/assets/${relative}`:`/scene/compression/${preset.id}/${relative}`;
    report.originalBytes+=originalBytes;report.bytes+=bytes;report.gzipBytes+=gzipBytes;
    console.log(`${preset.id}: ${source}: ${(originalBytes/1e6).toFixed(2)} → ${(bytes/1e6).toFixed(2)} MB`);
  }
  await writeFile(production?resolve(output,'compression-report.json'):resolve(output,preset.id,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${preset.id} total: ${(report.bytes/1e6).toFixed(2)} MB (${(100*(1-report.bytes/report.originalBytes)).toFixed(1)}% smaller)`);
}
if(!production)console.log('Comparison: npm run start:source, then http://127.0.0.1:8000/tests/fixtures/compression-preview.html');
