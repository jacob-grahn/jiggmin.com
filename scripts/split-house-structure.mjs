// Derive streamed shell assets without changing the authored master or rebaking.
import {NodeIO,Document,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition} from '@gltf-transform/functions';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {Box3,Vector3,Matrix4} from 'three';

export const SHELL_ROOMS=['hallway','den','workshop','basement','attic'];
export function shellOwner(name,e={},bounds){
 if(e.source_shell_room)return e.source_shell_room;
 // Boundary doors/hatch stay with the hall so closed entrances never disappear.
 if(e.preview_kind==='door')return e.door_id==='vehicle'?'workshop':'hallway';
 // The cellar entrance trim is upstairs, despite its authored "stairs" name.
 if(/^Finish \/ stairs (casing|head|jamb|threshold)(?:\.\d+)?$/.test(name))return 'hallway';
 if(e.preview_kind==='ladder')return 'attic';
 if(e.house_smoke_detector)return e.house_smoke_detector==='garage'?'workshop':e.house_smoke_detector;
 if(name==='Garage slab')return 'workshop'; // Historical atlas label says stairs.
 if(/^Finish \/ attic /.test(name))return 'attic';
 if(e.preview_kind==='stair'||/stair|flight|landing|stringer|Cellar front closure/i.test(name))return 'basement';
 const group=e.atlas_group??e.release_baked??'';
 if(/^basement-/.test(group))return 'basement';
 if(/^attic-/.test(group)&&group!=='attic-hatch-closed')return 'attic';
 if(/^structure-garage/.test(group))return 'workshop';
 if(/^structure-den/.test(group))return 'den';
 if(/^structure-attic/.test(group))return 'attic';
 if(/^structure-stairs/.test(group))return 'basement';
 if(/garage|workshop/i.test(name))return 'workshop';
 if(/attic gable/i.test(name))return 'attic';
 if(!group&&bounds&&e.preview_kind!=='site'){
  const c=bounds.getCenter(new Vector3());
  if(c.y>2.75)return 'attic';if(c.y<-.2)return 'basement';
  const hallBoundary=/^(Proposed wall|Finish \/ skirting|Finish \/ ceiling moulding)/.test(name)&&bounds.min.x>=11.8&&bounds.max.x<=12.2&&bounds.min.z<8.299&&bounds.max.z>6.801;
  if(/^Finish \/ hall-right/.test(name)||hallBoundary)return 'hallway';
  if(c.x>=12)return 'workshop';if(c.x<4.8&&c.z>6.5)return 'den';
 }
 return 'hallway';
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const texturesOf=m=>m?[m.getBaseColorTexture(),m.getEmissiveTexture(),m.getNormalTexture(),m.getOcclusionTexture(),m.getMetallicRoughnessTexture()].filter(Boolean):[];
const local=url=>url.split('?')[0].replace(/^\//,'');
function inheritedExtras(node){const chain=[];for(let n=node;n;n=n.getParentNode())chain.unshift(n.getExtras());return Object.assign({},...chain);}
export async function splitHouseStructure({directory='web/assets/house/release'}={}){
 const layoutPath=`${directory}/layout.json`,layout=JSON.parse(await readFile(layoutPath));
 const paths=[`${directory}/structure.glb`,...['fixedFixtures','denFloorReference'].filter(k=>layout[k]).map(k=>local(layout[k]))];
 const key=hash(Buffer.concat([await readFile(fileURLToPath(import.meta.url)),...await Promise.all(paths.map(p=>readFile(p)))]));
 if(layout.structureStreaming?.sourceKey===key&&await Promise.all(SHELL_ROOMS.map(id=>readFile(`${directory}/structure/${id}.glb`).then(b=>hash(b)===layout.structureStreaming.rooms[id].sha256,()=>false))).then(v=>v.every(Boolean)))return layout.structureStreaming;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),master=await io.read(paths[0]);
 const sources=[master];
 if(layout.fixedFixtures)sources.push(await io.read(local(layout.fixedFixtures)));
 const assignments=new Map(),textureOwners=new Map();
 for(const source of sources)for(const node of source.getRoot().listNodes()){
  if(!node.getMesh())continue;
  const extras=inheritedExtras(node);let bounds;
  if(!extras.atlas_group&&!extras.release_baked){
   bounds=new Box3();const matrix=new Matrix4().fromArray(node.getWorldMatrix());
   for(const p of node.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)bounds.expandByPoint(new Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));}
  }
  const owners=[shellOwner(node.getName(),extras,bounds)];assignments.set(node,owners);
  for(const p of node.getMesh().listPrimitives())for(const t of texturesOf(p.getMaterial())){const rooms=textureOwners.get(t)??new Set();owners.forEach(owner=>rooms.add(owner));textureOwners.set(t,rooms);}
 }
 const manifest={version:1,sourceKey:key,rooms:{}};layout.structureAssets={};
 await mkdir(`${directory}/structure`,{recursive:true});
 for(const room of SHELL_ROOMS){
  const doc=new Document().setLogger(new Logger(Logger.Verbosity.WARN)),scene=doc.createScene(`House structure / ${room}`);
  scene.setExtras({...master.getRoot().listScenes()[0]?.getExtras(),shell_room:room});
  const sharedTextures=new Set();let count=0;
  for(const source of sources){
   const nodes=source.getRoot().listNodes().filter(n=>assignments.get(n)?.includes(room));
   const copied=copyToDocument(doc,source,nodes.map(n=>n.getMesh()));
   for(const node of nodes){
    const mesh=copied.get(node.getMesh());
    scene.addChild(doc.createNode(node.getName()).setMatrix(node.getWorldMatrix()).setMesh(mesh).setExtras({...inheritedExtras(node),shell_room:room}));count++;
   }
   for(const [texture,owners] of textureOwners)if(owners.size>1&&copied.has(texture))sharedTextures.add(copied.get(texture));
  }
  // Cross-room atlases (e.g. a hall-baked stair riser) get independent crops.
  // Padding preserves the original edge samples; all vertices keep their world pose.
  for(const texture of sharedTextures){
   const meta=await sharp(texture.getImage()).metadata();if(meta.width<512&&meta.height<512)continue;
   const primitives=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>texturesOf(p.getMaterial()).includes(texture));
   let u0=1,v0=1,u1=0,v1=0;
   for(const p of primitives){const uv=p.getAttribute('TEXCOORD_0');if(!uv)throw Error('Missing atlas UVs');for(let i=0;i<uv.getCount();i++){const [u,v]=uv.getElement(i,[]);u0=Math.min(u0,u);v0=Math.min(v0,v);u1=Math.max(u1,u);v1=Math.max(v1,v);}}
   if(u0<0||v0<0||u1>1||v1>1)throw Error(`Cannot crop repeating atlas ${texture.getName()}`);
   const left=Math.max(0,Math.floor(u0*meta.width)-8),top=Math.max(0,Math.floor(v0*meta.height)-8);
   const width=Math.min(meta.width,Math.ceil(u1*meta.width)+8)-left,height=Math.min(meta.height,Math.ceil(v1*meta.height)+8)-top;
   for(const p of primitives){const uv=p.getAttribute('TEXCOORD_0').clone();uv.setArray(uv.getArray().slice());p.setAttribute('TEXCOORD_0',uv);for(let i=0;i<uv.getCount();i++){const [u,v]=uv.getElement(i,[]);uv.setElement(i,[(u*meta.width-left)/width,(v*meta.height-top)/height]);}}
   texture.setImage(await sharp(texture.getImage()).extract({left,top,width,height}).png().toBuffer()).setMimeType('image/png').setName(`${room} / ${texture.getName()}`);
  }
  await doc.transform(prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}),unpartition());
  const path=`${directory}/structure/${room}.glb`;await io.write(path,doc);const bytes=await readFile(path);
  let textureBytes=0;const textures=[];
  for(const t of doc.getRoot().listTextures()){const m=await sharp(t.getImage()).metadata();textureBytes+=m.width*m.height*4*4/3;textures.push({name:t.getName(),width:m.width,height:m.height});}
  manifest.rooms[room]={nodes:count,bytes:bytes.length,textureMiB:+(textureBytes/1048576).toFixed(2),textures,sha256:hash(bytes)};
  layout.structureAssets[room]=`/${path}?v=${hash(bytes).slice(0,12)}`;
 }
 layout.structureStreaming=manifest;
 await writeFile(layoutPath,JSON.stringify(layout,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await splitHouseStructure();console.log(JSON.stringify(Object.fromEntries(Object.entries(report.rooms).map(([id,r])=>[id,{nodes:r.nodes,textureMiB:r.textureMiB,fileMiB:+(r.bytes/1048576).toFixed(2)}])),null,2));
}
