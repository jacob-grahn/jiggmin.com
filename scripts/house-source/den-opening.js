import * as THREE from 'three';
import {subtractWindowPrism} from './house-window-openings.js';
// The original den already has its walls, floor and window scenery. Remove the
// duplicate proposal envelope within it; retain the real shared entry wall.
export function integrateDenOpening(structure){
 structure.updateMatrixWorld(true);
 const frame={center:new THREE.Vector3(2.265,1.4,6.68),right:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),size:new THREE.Vector2(4.83,3.2)};
 structure.traverse(mesh=>{
  if(!mesh.isMesh)return;
  // glTF puts extras on a parent Group when a surface has several materials.
  let owner=mesh;while(owner&&!owner.userData.preview_kind)owner=owner.parent;
  const kind=owner?.userData.preview_kind;
  if(kind==='door')return;
  // Keep the complete slab and ceiling: rays through the backing camera's
  // foreground land well inside the den, not just beneath the doorway.
  if(['floor','ceiling'].includes(kind)){
   if(kind==='floor'){
    const geometry=mesh.geometry.clone(),position=geometry.attributes.position,world=new THREE.Vector3(),inverse=mesh.matrixWorld.clone().invert();
    for(let i=0;i<position.count;i++){
     world.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
     // Put the infill just beneath the original boards and rug, so their
     // existing baked surfaces retain priority in the original composition.
     if(world.x<4.70&&world.z>6.52&&world.z<12.23&&world.y>-.25&&world.y<.05){world.y-=.025;world.applyMatrix4(inverse);position.setXYZ(i,world.x,world.y,world.z);}
    }
    geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
   }
   return;
  }
  const cut=subtractWindowPrism(mesh.geometry,mesh.matrixWorld,frame,5.55);
  if(cut)mesh.geometry=cut;
 });
}
