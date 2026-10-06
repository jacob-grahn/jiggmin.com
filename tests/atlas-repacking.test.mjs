import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import sharp from 'sharp';
import {packRectangles,repackLightingAtlases,uvCharts} from '../scripts/repack-lighting-atlases.mjs';

test('atlas packing keeps every rectangle in bounds and nonoverlapping',()=>{
 const rectangles=Array.from({length:120},(_,id)=>({id,width:19+(id*13)%90,height:17+(id*23)%60}));
 const pages=packRectangles(rectangles,256);
 for(const p of pages)for(const a of p.regions){
  assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=256&&a.y+a.height<=256);
  for(const b of p.regions)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
 }
 assert.equal(pages.flatMap(p=>p.regions).length,120);
});

async function fixture(size=1024){
 const d=new Document(),buffer=d.createBuffer(),mesh=d.createMesh('surface');
 const pixels=Buffer.alloc(size*size*3);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*3;pixels[i]=x<size/2?240:20;pixels[i+1]=y/size*100;pixels[i+2]=x<size/2?20:240;}
 const texture=d.createTexture('test lighting').setImage(await sharp(pixels,{raw:{width:size,height:size,channels:3}}).png().toBuffer()).setMimeType('image/png');
 const material=d.createMaterial('bake').setBaseColorFactor([0,0,0,1]).setEmissiveFactor([1,1,1]).setEmissiveTexture(texture);
 const attr=(type,data)=>d.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(data));
 const p=d.createPrimitive().setMaterial(material).setAttribute('POSITION',attr('VEC3',[0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0])).setAttribute('NORMAL',attr('VEC3',[0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1])).setAttribute('TEXCOORD_0',attr('VEC2',[.1,.1,.3,.1,.1,.3,.6,.6,.8,.6,.6,.8]));
 mesh.addPrimitive(p);d.createScene().addChild(d.createNode('fixed wall').setMesh(mesh).setExtras({release_baked:'test',atlas_delivery_max:1024}));
 return {d,mesh,p,texture};
}
test('repacked UV charts preserve geometry, image orientation and baked colors',async()=>{
 const {d,mesh,p}=await fixture();assert.equal(uvCharts(p,p.getAttribute('TEXCOORD_0')).length,2);
 const original=Array.from(p.getAttribute('POSITION').getArray());
 const report=await repackLightingAtlases(d,{pageSize:128,gutter:8});assert.equal(report.groups[0].pages,1);
 const after=mesh.listPrimitives();assert.deepEqual(after.flatMap(p=>Array.from(p.getAttribute('POSITION').getArray())),original);
 const t=after[0].getMaterial().getEmissiveTexture(),{data,info}=await sharp(t.getImage()).raw().toBuffer({resolveWithObject:true});assert.deepEqual(t.getSize(),[128,128]);
 const uv=after[0].getAttribute('TEXCOORD_0');
 for(const [start,expected] of [[0,[240,17,20]],[3,[20,67,240]]]){
  const v=[0,0];for(let i=start;i<start+3;i++){const a=uv.getElement(i,[]);v[0]+=a[0]/3;v[1]+=a[1]/3;}
  const x=Math.floor(v[0]*128),y=Math.floor(v[1]*128),pixel=Array.from(data.subarray((y*128+x)*info.channels,(y*128+x)*info.channels+3));
  pixel.forEach((c,i)=>assert.ok(Math.abs(c-expected[i])<3,`${pixel} expected ${expected}`));
 }
 assert.equal(after[0].getMaterial().getEmissiveTextureInfo().getWrapS(),33071);
});
test('small images retain their layout when square-page padding would cost more memory',async()=>{
 const {d,texture}=await fixture(64);const image=Buffer.from(texture.getImage());
 const report=await repackLightingAtlases(d,{pageSize:1024,gutter:8});assert.ok(report.groups[0].retainedLayout);assert.deepEqual(texture.getSize(),[64,64]);
 const decoded=await sharp(image).raw().toBuffer(),after=await sharp(texture.getImage()).raw().toBuffer();assert.deepEqual(after,decoded);
});
