import * as THREE from 'three';

export const LIFT_SECONDS=1.35;
export function dockBlend(progress){
 const t=Math.max(0,Math.min(1,progress));
 return {travel:1-Math.pow(1-Math.min(t/.8,1),3),ui:t===1?1:Math.max(0,(t-.8)/.2)};
}

// Keep the destination in camera space so a resizing/zooming CRT never leaves
// the physical pad behind its touch targets. Physics stays parked until landing.
export function createControllerDock({controller,physics,cord,camera,room,panel,controls,reducedMotion}){
 let progress=0,wanted=false,rest=null;
 const originalScale=controller.scale.clone();
 panel.classList.add('physical-handoff');
 cord.mesh.material.transparent=true;
 function setRaised(value){
  wanted=value;
  if(value&&!rest){
   rest=physics.pose('controller');
   physics.items.get('controller').cord.disable();physics.pin('controller',rest);
  }
 }
 function update(dt){
  if(!rest)return false;
  if(progress===1&&wanted)return false;
  progress=reducedMotion.matches?(wanted?1:0):THREE.MathUtils.clamp(progress+(wanted?1:-1)*dt/LIFT_SECONDS,0,1);
  const {travel,ui}=dockBlend(progress);
  const r=panel.getBoundingClientRect(),base=room.getBoundingClientRect();
  const nx=(r.left+r.width/2-base.left)/base.width*2-1;
  const ny=1-(r.top+r.height/2-base.top)/base.height*2;
  const depth=new THREE.Vector3(0,0,-3).applyMatrix4(camera.matrixWorld).project(camera).z;
  const destination=new THREE.Vector3(nx,ny,depth).unproject(camera);
  const left=new THREE.Vector3(nx-r.width/base.width,ny,depth).unproject(camera);
  const top=new THREE.Vector3(nx,ny+r.height/base.height,depth).unproject(camera);
  const width=destination.distanceTo(left)*2,height=destination.distanceTo(top)*2;
  const rotation=camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
  // Center the face (local y=.18) on the final UI plane.
  destination.add(new THREE.Vector3(0,-.18*width,0).applyQuaternion(rotation));
  controller.position.copy(rest.position).lerp(destination,travel);
  controller.position.y+=Math.sin(Math.PI*travel)*.3;
  controller.quaternion.copy(rest.quaternion).slerp(rotation,travel);
  controller.scale.copy(originalScale).lerp(new THREE.Vector3(width,width,height/.54),travel);
  controller.visible=ui<1;
  cord.mesh.material.opacity=Math.max(0,1-progress/.18);
  cord.mesh.visible=progress<.18;
  controls.setVisible(wanted&&ui>0);
  panel.style.setProperty('--handoff-opacity',ui);
  if(progress===0&&!wanted){
   controller.scale.copy(originalScale);physics.place('controller',rest,true);
   physics.items.get('controller').cord.enable();rest=null;cord.mesh.visible=true;cord.mesh.material.opacity=1;
  }
  return true;
 }
 return {setRaised,update,get active(){return rest!==null;}};
}
