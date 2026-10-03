// Author permanent scene edits before lighting. Publishing never runs geometry repairs.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,unpartition} from '@gltf-transform/functions';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {editModel} from './house-source/model-editor.mjs';
import {tidyHouseProps} from './house-source/house-prop-cleanup.js';
import {integrateDenOpening} from './house-source/den-opening.js';
import {replaceExteriorTrees} from './house-source/house-exterior-trees.js';
import {hideExteriorGround} from './house-source/house-exterior-ground.js';
import {finishHallSurfaces} from './house-source/house-hall-finishes.js';
import {windowExteriorFrame,createWindowTrees} from './house-source/house-window-exterior.js';
import {cutWindowOpenings} from './house-source/house-window-openings.js';
import {floorTexture} from './house-source/floor-texture.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
export async function prepareHouseStatic(directory){
 const layout=JSON.parse(await readFile(`${directory}/layout.json`));
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const path=`${directory}/${room}.glb`,doc=await io.read(path),scene=doc.getRoot().listScenes()[0];
  if(!scene.getExtras().static_source_revision){
   const editor=editModel(doc),root=editor.root;
   if(room==='structure'){
    integrateDenOpening(root);finishHallSurfaces(root);const grove=replaceExteriorTrees(root);grove.traverse(o=>Object.assign(o.userData,{source_shell_room:'hallway',preview_kind:'site',release_room:'structure',house_authored_reflectance:true,bake_connection:true}));hideExteriorGround(root);
   }else tidyHouseProps(root,room);
   if(room==='basement'){
    const windows=[];root.traverse(o=>{if(o.isMesh&&/^(Rainy garden through hallway|Garden beyond window)/.test(o.name.replaceAll('_',' ')))windows.push(o);});
    const eye=new THREE.Vector3(...layout.views.basement.position),frames=windows.map(mesh=>{const frame=windowExteriorFrame(mesh);if(frame.normal.dot(eye.clone().sub(frame.center))>0){frame.normal.negate();frame.right.negate();}frame.size.addScalar(-.04);return frame;});
    cutWindowOpenings(root,frames);
    for(const frame of frames){const trees=createWindowTrees(frame);trees.userData={release_room:'basement',bake_connection:true,source_scenery:true};root.add(trees);}
    root.traverse(o=>{if(o.isMesh&&/Basement painted masonry|Concrete slab/.test(o.name))Object.assign(o.userData,{house_fixed_receiver:true,source_rebake_required:true});});
   }
   editor.save();
   // The floor artwork is an authored reflectance texture with ordinary UVs.
   if(room==='basement'){
    const n=doc.getRoot().listNodes().find(n=>n.getName()==='Concrete slab');
    if(n){const texture=doc.createTexture('Basement floor artwork').setImage(await floorTexture()).setMimeType('image/png');
     const m=doc.createMaterial('Worn concrete with painted spills and tape').setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(.93);
     for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION'),uv=new Float32Array(a.getCount()*2);let loX=Infinity,hiX=-Infinity,loZ=Infinity,hiZ=-Infinity;for(let i=0;i<a.getCount();i++){const [x,,z]=a.getElement(i,[]);loX=Math.min(loX,x);hiX=Math.max(hiX,x);loZ=Math.min(loZ,z);hiZ=Math.max(hiZ,z);}for(let i=0;i<a.getCount();i++){const [x,,z]=a.getElement(i,[]);uv[i*2]=(x-loX)/(hiX-loX);uv[i*2+1]=1-(z-loZ)/(hiZ-loZ);}p.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(doc.getRoot().listBuffers()[0])).setMaterial(m);}
     n.setExtras({...n.getExtras(),house_authored_reflectance:true,house_fixed_receiver:true});
    }
   }
   scene.setExtras({...scene.getExtras(),static_source_revision:1});
  }
  await doc.transform(prune({keepAttributes:true,keepSolidTextures:true}),unpartition());await io.write(path,doc);
  const hash=createHash('sha256').update(await readFile(path)).digest('hex').slice(0,12);layout.assets[room]=`/${directory}/${room}.glb?v=${hash}`;
 }
 delete layout.hatchLighting;layout.staticSourceRevision=1;await writeFile(`${directory}/layout.json`,JSON.stringify(layout,null,2)+'\n');return layout;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareHouseStatic(process.argv[2]??'scene/exports/house-release/review-reference');
