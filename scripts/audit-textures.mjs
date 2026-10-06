// Read-only audit of exported textures. Build first to inspect delivery assets.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {listTextureSlots} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
const {values}=parseArgs({options:{output:{type:'string',default:'/tmp/jiggmin-texture-audit.json'}}});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
const digest=b=>createHash('sha256').update(b).digest('hex');
async function files(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=`${directory}/${entry.name}`;if(entry.isDirectory())result.push(...await files(path));else if(entry.isFile())result.push(path);}return result.sort();}
async function inspect(image){const metadata=await sharp(image).metadata();return {width:metadata.width,height:metadata.height,format:metadata.format,channels:metadata.channels,bytes:image.length,hash:digest(image),rgbaBytes:metadata.width*metadata.height*4,mipmappedRGBABytes:Math.ceil(metadata.width*metadata.height*4*4/3)};}
const excluded=new Set(JSON.parse(await readFile(new URL('./production-asset-exclusions.json',import.meta.url))));
const sourceFiles=await files('web/assets'),models=[],images=[];
for(const path of sourceFiles){
 if(path.endsWith('.glb')){
  const variants=[];
  for(const prefix of ['', 'dist/']){
   if(prefix&&excluded.has(path.slice('web/assets/'.length))){variants.push(null);continue;}
   const doc=await io.read(prefix+path);doc.setLogger(new Logger(Logger.Verbosity.ERROR));const textures=[];
   for(const texture of doc.getRoot().listTextures()){
    const owners=[];
    for(const node of doc.getRoot().listNodes()){
     if((node.getMesh()?.listPrimitives()??[]).some(p=>['getBaseColorTexture','getEmissiveTexture','getNormalTexture','getOcclusionTexture','getMetallicRoughnessTexture'].some(slot=>p.getMaterial()?.[slot]()===texture)))owners.push({name:node.getName(),baked:node.getExtras().release_baked??null,deliveryCap:node.getExtras().atlas_delivery_max??null});
    }
    textures.push({name:texture.getName(),slots:listTextureSlots(texture),owners,...await inspect(texture.getImage())});
   }
   variants.push({path:prefix+path,textures,rgbaBytes:textures.reduce((s,t)=>s+t.rgbaBytes,0),mipmappedRGBABytes:textures.reduce((s,t)=>s+t.mipmappedRGBABytes,0),encodedImageBytes:textures.reduce((s,t)=>s+t.bytes,0)});
  }
  models.push({source:variants[0],delivery:variants[1],...(variants[1]===null?{excludedFromProduction:true}:{})});
 }else if(/\.(png|webp|jpe?g)$/i.test(path)){
  images.push({path,source:await inspect(await readFile(path)),delivery:excluded.has(path.slice('web/assets/'.length))?null:await inspect(await readFile('dist/'+path))});
 }
}
await writeFile(values.output,JSON.stringify({estimate:'RGBA8; mipmap estimate adds 1/3. Excludes runtime canvases, render targets, and decoder copies. Texture records count allocations, not content-deduplicated images.',models,images},null,2)+'\n');
console.log(`Audited ${models.length} GLBs and ${images.length} standalone images → ${values.output}`);
