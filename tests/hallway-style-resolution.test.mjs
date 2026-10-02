import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import {existsSync} from 'node:fs';

test('illustrated hallway keeps seven surface atlases and texture dimensions through the build',{
 skip:!existsSync('web/assets/house/hallway-style/structure.glb')?'Full-resolution experimental bake not installed':false,
},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 const groups=new Map();let compared=0;
 for(const asset of ['structure','hallway']){
  const source=await io.read(`web/assets/house/hallway-style/${asset}.glb`),built=await io.read(`dist/web/assets/house/hallway-style/${asset}.glb`);
  const after=new Map(built.getRoot().listNodes().map(n=>[n.getName(),n]));const checked=new Set();
  for(const node of source.getRoot().listNodes()){
   if(!node.getExtras().texture_pixel_exact)continue;
   const other=after.get(node.getName());assert.ok(other);assert.equal(other.getExtras().texture_pixel_exact,true);
   for(const [i,primitive] of (node.getMesh()?.listPrimitives()??[]).entries()){
    const m=primitive.getMaterial(),n=other.getMesh().listPrimitives()[i].getMaterial();
    for(const slot of ['getEmissiveTexture','getBaseColorTexture']){
    const t=m[slot]();if(!t||checked.has(t))continue;checked.add(t);const u=n[slot]();
    assert.deepEqual(t.getSize(),u.getSize(),node.getName()+': dimensions');
    assert.equal(u.getMimeType(),'image/webp');compared++;
    const group=node.getExtras().hallway_style_group;if(group)groups.set(group,t.getSize());
    }
   }
  }
 }
 assert.deepEqual([...groups.keys()].sort(),['ceiling','floor','furnishings','runner','trim','wallsnorth','wallssouth']);
 for(const [group,size] of groups)assert.deepEqual(size,group==='furnishings'?[2048,2048]:[4096,4096]);
 assert.ok(compared>7,'Separate artwork textures are also checked');
});
