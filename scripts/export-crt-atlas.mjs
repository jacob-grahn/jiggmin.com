// Reuse the native, display-transformed CRT bake instead of enlarging the
// screen's low-resolution patch in the shared camera-projected room plate.
import {NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';
const io=new NodeIO();
const doc=await io.read(new URL('../web/assets/den-baked.glb',import.meta.url).pathname);
const screen=doc.getRoot().listNodes().find(node=>node.getExtras().den_atlas==='screen');
const texture=screen?.getMesh()?.listPrimitives()[0]?.getMaterial()?.getEmissiveTexture();
if(!texture)throw Error('The native den CRT bake is missing');
await sharp(texture.getImage()).webp({lossless:true}).toFile(new URL('../web/assets/crt-screen.webp',import.meta.url).pathname);
console.log(`Exported dedicated CRT atlas: ${texture.getSize().join(' × ')}`);
