import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeIO,Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';
import * as THREE from 'three';
import {clipCeilingMesh,splitSourceCeilings} from '../scripts/split-house-ceiling-source.mjs';
import {shellOwner,SHELL_ROOMS} from '../scripts/split-house-structure.mjs';
import {createStructureStore} from '../web/house-structure-store.js';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const directory='web/assets/house/release';
const master=await io.read(`${directory}/structure.glb`);
const parts=new Map(await Promise.all(SHELL_ROOMS.map(async id=>[id,await io.read(`${directory}/structure/${id}.glb`)])));

test('every authored shell mesh has exactly one room owner and keeps its world transform',()=>{
 const nodes=new Map();for(const [room,doc] of parts)for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  assert.equal(n.getExtras().shell_room,room);
  assert.ok(!nodes.has(n.getName()),`duplicate ${n.getName()}`);nodes.set(n.getName(),n);
 }
 for(const n of master.getRoot().listNodes().filter(n=>n.getMesh())){
  const copy=nodes.get(n.getName());assert.ok(copy,`missing ${n.getName()}`);
  assert.ok(n.getWorldMatrix().every((v,i)=>Math.abs(v-copy.getWorldMatrix()[i])<1e-6),`moved ${n.getName()}`);
  const a=n.getMesh().listPrimitives(),b=copy.getMesh().listPrimitives();assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++){
   assert.deepEqual(b[i].getAttribute('POSITION').getArray(),a[i].getAttribute('POSITION').getArray());
   assert.deepEqual(b[i].getIndices()?.getArray(),a[i].getIndices()?.getArray());
  }
 }
});
test('stairs, landing, guards and stringers belong to the basement; garage slab stays in workshop',()=>{
 let count=0;
 for(const [room,doc] of parts)for(const n of doc.getRoot().listNodes()){
  const e=n.getExtras();if(e.preview_kind==='stair'||(/stair|flight|landing|stringer/i.test(n.getName())&&e.preview_kind!=='door')){assert.equal(room,'basement',n.getName());count++;}
  if(n.getName()==='Garage slab')assert.equal(room,'workshop');
 }
 assert.ok(count>=49);assert.equal(shellOwner('Finish / Half landing',{preview_kind:'stair'}),'basement');
});
test('hall package excludes other rooms’ complete atlases',()=>{
 const textures=parts.get('hallway').getRoot().listTextures();
 for(const t of textures)assert.ok(!/^structure-(attic|den|garage|stairs)/.test(t.getName()),t.getName());
});
test('cropped cross-room lightmaps preserve original texture coordinates and pixel values',async()=>{
 const originals=new Map(master.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getName(),n]));let checked=0;
 const decode=new Map();const pixels=async texture=>{if(!decode.has(texture))decode.set(texture,sharp(texture.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true}));return decode.get(texture);};
 for(const doc of parts.values())for(const n of doc.getRoot().listNodes()){
  const original=originals.get(n.getName());if(!original)continue;
  const a=original.getMesh().listPrimitives(),b=n.getMesh().listPrimitives();
  for(let pi=0;pi<a.length;pi++){
   const ta=a[pi].getMaterial()?.getEmissiveTexture(),tb=b[pi].getMaterial()?.getEmissiveTexture();if(!ta||!tb||ta.getName()===tb.getName())continue;
   const source=await pixels(ta),crop=await pixels(tb),uvA=a[pi].getAttribute('TEXCOORD_0'),uvB=b[pi].getAttribute('TEXCOORD_0');
   // Pixel-space displacement is a constant integer crop origin for every UV.
   const firstA=uvA.getElement(0,[]),firstB=uvB.getElement(0,[]);
   const left=Math.round(firstA[0]*source.info.width-firstB[0]*crop.info.width),top=Math.round(firstA[1]*source.info.height-firstB[1]*crop.info.height);
   for(let i=0;i<uvA.getCount();i+=Math.max(1,Math.floor(uvA.getCount()/50))){
    const aa=uvA.getElement(i,[]),bb=uvB.getElement(i,[]);
    assert.ok(Math.abs(aa[0]*source.info.width-bb[0]*crop.info.width-left)<.002);
    assert.ok(Math.abs(aa[1]*source.info.height-bb[1]*crop.info.height-top)<.002);
   }
   const x=Math.floor(crop.info.width/2),y=Math.floor(crop.info.height/2),i=(y*crop.info.width+x)*4,j=((y+top)*source.info.width+x+left)*4;
   assert.deepEqual(crop.data.subarray(i,i+4),source.data.subarray(j,j+4));checked++;
  }
 }
 assert.ok(checked>0);
});
test('hall shell texture allocation is below 55% of the old monolith',async()=>{
 const layout=JSON.parse(await readFile(`${directory}/layout.json`));
 assert.ok(layout.structureStreaming.rooms.hallway.textureMiB<607*.55);
 for(const room of SHELL_ROOMS)assert.ok(layout.structureAssets[room].includes(`/structure/${room}.glb?v=`));
});
test('shell store deduplicates loads and disposes resources on room departure',async()=>{
 let loads=0;const disposed=[];const store=createStructureStore({load:async id=>({id,n:++loads}),dispose:s=>disposed.push(s.id)});
 const [a,b]=await Promise.all([store.ensure('basement'),store.ensure('basement')]);assert.equal(a,b);assert.equal(loads,1);
 store.remove('basement');assert.deepEqual(disposed,['basement']);assert.equal(store.entries.size,0);
 await store.ensure('attic');await store.dispose();assert.deepEqual(disposed,['basement','attic']);
});
test('shells finishing after cancellation are disposed and cannot reattach',async()=>{
 let finish;const disposed=[];const store=createStructureStore({load:id=>new Promise(resolve=>{finish=()=>resolve({id});}),dispose:s=>disposed.push(s.id)});
 const request=store.ensure('basement'),done=store.dispose();finish();assert.equal(await request,null);await done;
 assert.equal(store.entries.size,0);assert.deepEqual(disposed,['basement']);assert.equal(await store.ensure('attic'),null);
});

test('ceiling cuts interpolate baked UVs and preserve total surface area',()=>{
 let area=0;
 for(const room of ['den','hallway']){
  const doc=new Document(),buffer=doc.createBuffer(),mesh=doc.createMesh();
  const attribute=(type,values)=>doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',attribute('VEC3',[0,0,0,2,0,0,0,2,0])).setAttribute('TEXCOORD_0',attribute('VEC2',[0,0,1,0,0,1])));
  clipCeilingMesh(doc,mesh,new THREE.Matrix4().makeTranslation(3.8,0,0).toArray(),room);
  const p=mesh.listPrimitives()[0],position=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0');
  for(let i=0;i<position.getCount();i++){
   const [x,y]=position.getElement(i,[]),[u,v]=uv.getElement(i,[]);
   assert.ok(Math.abs(u-x/2)<1e-6&&Math.abs(v-y/2)<1e-6,'baked UV mapping changed');
   assert.ok(room==='den'?x<=1.000001:x>=.999999);
  }
  for(let i=0;i<position.getCount();i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromArray(position.getElement(i+j,[])));area+=b.sub(a).cross(c.sub(a)).length()/2;}
 }
 assert.ok(Math.abs(area-2)<1e-6,'cut lost or duplicated surface area');
});

test('source ceiling sections belong wholly to one room before streaming',()=>{
 let den=0,hall=0;
 for(const n of master.getRoot().listNodes().filter(n=>n.getMesh()&&n.getName().startsWith('Attic floor / hall ceiling'))){
  const matrix=new THREE.Matrix4().fromArray(n.getWorldMatrix()),points=[];
  for(const p of n.getMesh().listPrimitives()){
   const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)points.push(new THREE.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));
  }
  const bounds=new THREE.Box3().setFromPoints(points);if(bounds.getCenter(new THREE.Vector3()).z<=6.5)continue;
  assert.ok(bounds.max.x<=4.800001||bounds.min.x>=4.799999,`${n.getName()} spans both rooms`);
  const room=bounds.max.x<=4.800001?'den':'hallway';room==='den'?den++:hall++;
  if(n.getExtras().source_shell_room)assert.equal(n.getExtras().source_shell_room,room);
 }
 assert.ok(den>=2&&hall>=2);assert.equal(splitSourceCeilings(master),0,'source preparation must be idempotent');
});
test('legacy source preparation produces separate bake surfaces and retains reflectance identity',()=>{
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),name='Attic floor / hall ceiling.001';
 const position=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,2.6,8,8,2.6,8,0,2.6,10])).setBuffer(buffer);
 scene.addChild(doc.createNode(name).setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',position))));
 assert.equal(splitSourceCeilings(doc),1);
 const nodes=scene.listChildren();assert.equal(nodes.length,2);
 assert.deepEqual(nodes.map(n=>n.getExtras().source_shell_room).sort(),['den','hallway']);
 for(const n of nodes)assert.equal(n.getExtras().source_ceiling_object,name);
 assert.notEqual(nodes[0].getMesh(),nodes[1].getMesh());assert.equal(splitSourceCeilings(doc),0);
});
