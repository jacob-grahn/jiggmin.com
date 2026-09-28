import * as THREE from 'three';
import {CARTRIDGE_DEPTH_SCALE} from './physics.js';

export const cartridgeRoom=game=>game.gameplay?.mode==='broken'?'basement':'den';

// Room unloading disposes these copies; the original cartridge resources remain
// available for future visits and are never shared with the den's live meshes.
export function copyCartridges(sources){
 const geometries=new Map(),materials=new Map(),textures=new Map();
 const copyMaterial=original=>{
  if(!materials.has(original)){
   const copy=original.clone();
   for(const [key,value] of Object.entries(copy))if(value?.isTexture){
    if(!textures.has(value))textures.set(value,value.clone());
    copy[key]=textures.get(value);
   }
   materials.set(original,copy);
  }
  return materials.get(original);
 };
 return sources.map(source=>{
  const root=source.clone(true);
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   if(!geometries.has(mesh.geometry))geometries.set(mesh.geometry,mesh.geometry.clone());
   mesh.geometry=geometries.get(mesh.geometry);
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(copyMaterial):copyMaterial(mesh.material);
  });
  return root;
 });
}

export function createBasementCartridges(sources){
 return copyCartridges(sources).map((root,index)=>{
  root.name=root.userData.title;
  root.userData={prop_assembly:true,prop_mode:'throw',game_id:root.userData.game_id};
  root.position.set(1.05+index*.65,2.055,-1.90);
  root.quaternion.identity();root.scale.set(1,1,CARTRIDGE_DEPTH_SCALE);
  return root;
 });
}
