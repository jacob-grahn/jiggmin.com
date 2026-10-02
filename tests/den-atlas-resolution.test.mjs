import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression,EXTTextureWebP} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const expected={window:[1024,1536],rug:[1600,1100],screen:[1200,900],poster:[700,1000]};
test('den artwork retains native dimensions through production compression',async()=>{
 const io=new NodeIO().registerExtensions([KHRDracoMeshCompression,EXTTextureWebP]).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 const source=await io.read('web/assets/den-baked.glb'),built=await io.read('dist/web/assets/den-baked.glb');
 const native=source.getRoot().listNodes().filter(n=>n.getExtras().den_native_artwork);
 assert.equal(native.length,4);
 for(const node of native){
  const key=node.getExtras().den_atlas,texture=node.getMesh().listPrimitives()[0].getMaterial().getEmissiveTexture();
  assert.deepEqual(texture.getSize(),expected[key]);
  const counterpart=built.getRoot().listNodes().find(n=>n.getExtras().den_atlas===key);
  const compressed=counterpart.getMesh().listPrimitives()[0].getMaterial().getEmissiveTexture();
  assert.deepEqual(compressed.getSize(),expected[key]);
  assert.equal(compressed.getMimeType(),'image/webp');
 }
 assert.equal(source.getRoot().listTextures().length,10);
});
