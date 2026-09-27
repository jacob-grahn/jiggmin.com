import {MeshBVH,acceleratedRaycast} from './vendor/three-mesh-bvh/index.module.js';

// Index triangles once; moving a rigid prop does not invalidate its local tree.
// Install per mesh so unrelated cartridge geometry keeps its normal raycast.
export function accelerateRaycasts(meshes){
 for(const mesh of meshes){
  if(!mesh.geometry.boundsTree)mesh.geometry.boundsTree=new MeshBVH(mesh.geometry,{indirect:true});
  mesh.raycast=acceleratedRaycast;
 }
}
