import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';
const dir=process.env.HOUSE_RELEASE_DIR??'web/assets/house/release';
test('moving hatch contains its own baked lighting and retains its hinge metadata',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/structure.glb`);
 const hatch=doc.getRoot().listNodes().find(n=>n.getName()==='Attic hatch');
 assert.equal(hatch.getExtras().door_id,'attic');assert.equal(hatch.getExtras().release_dynamic,true);
 for(const p of hatch.getMesh().listPrimitives()){
  assert.ok(p.getAttribute('TEXCOORD_0'));const texture=p.getMaterial().getEmissiveTexture();assert.ok(texture);
  const stats=await sharp(texture.getImage()).stats();assert.ok(stats.channels.some(c=>c.max-c.min>25));
 }
 const layout=JSON.parse(await readFile(`${dir}/layout.json`));assert.equal(layout.hatchLighting,undefined);
});
