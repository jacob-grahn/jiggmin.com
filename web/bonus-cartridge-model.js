import * as THREE from 'three';
import {remodelCartridge} from './cartridge-model.js?v=screenprint-3';
import {copyCartridges} from './cartridge-storage.js';
import {getBonusGame} from './bonus-collection.js';
import {CARTRIDGE_DEPTH_SCALE} from './physics.js';

const templates=new Map();
export async function createBonusCartridge(id){
 if(!templates.has(id))templates.set(id,(async()=>{
  const game=await getBonusGame(id),root=new THREE.Group();root.name=game.title;
  root.userData={role:'draggable_cartridge',game_id:id,title:game.title,bonus:true};
  await remodelCartridge(root,game);root.scale.z=CARTRIDGE_DEPTH_SCALE;
  root.traverse(mesh=>{const image=mesh.material?.map?.image;if(image?.width===512&&image?.height===512&&image.toDataURL)root.userData.labelImage=image.toDataURL();});
  return root;
 })().catch(error=>{templates.delete(id);throw error;}));
 return copyCartridges([await templates.get(id)])[0];
}

export function bonusDeliveryPoses(camera,index=0){
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 const start=camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()),1.15).addScaledVector(up,-.42).addScaledVector(right,index%2?.30:-.30);
 return {
  start:{position:start,quaternion:camera.quaternion.clone()},
  drop:{position:new THREE.Vector3(index%2?.55:-.55,1.15,1.95),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,index%2?.12:-.12))},
 };
}
