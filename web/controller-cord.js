import * as THREE from 'three';
import {CONTROLLER_CORD} from './physics.js?v=archive-2';

// A visual slack cord, with the physical length enforced at its two connectors.
// Redistribute slack sideways on the tabletop and let elevated spans sag.
export function createControllerCord(controller) {
 const anchor=new THREE.Vector3().copy(CONTROLLER_CORD.anchor);
 const plug=new THREE.Vector3().copy(CONTROLLER_CORD.plug);
 const material=new THREE.MeshStandardMaterial({color:0x161b21,roughness:.72});
 const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
 mesh.name='Controller cord';mesh.castShadow=true;mesh.receiveShadow=true;
 const last=new THREE.Vector3(Infinity,0,0);
 function update(){
  controller.updateWorldMatrix(true,false);
  const end=controller.localToWorld(plug.clone());
  if(last.distanceToSquared(end)<1e-9)return;
  last.copy(end);
  const delta=end.clone().sub(anchor),side=new THREE.Vector3(-delta.z,0,delta.x).normalize();
  const pointsFor=amplitude=>Array.from({length:33},(_,i)=>{
   const t=i/32,p=anchor.clone().lerp(end,t),wave=Math.sin(Math.PI*t);
   p.y-=amplitude*.65*wave;
   p.addScaledVector(side,amplitude*wave);
   // The cord lies on the table when both connectors are above it.
   const table=p.x> -2.3&&p.x<2.3&&p.z>.69&&p.z<2.41;
   p.y=Math.max(p.y,table&&anchor.y>=.7&&end.y>=.7?.709:.012);
   return p;
  });
  let low=0,high=CONTROLLER_CORD.length;
  for(let iteration=0;iteration<12;iteration++){
   const amplitude=(low+high)/2,points=pointsFor(amplitude);
   const length=points.slice(1).reduce((n,p,i)=>n+p.distanceTo(points[i]),0);
   if(length>CONTROLLER_CORD.length)high=amplitude;else low=amplitude;
  }
  const curve=new THREE.CatmullRomCurve3(pointsFor((low+high)/2));
  const old=mesh.geometry;mesh.geometry=new THREE.TubeGeometry(curve,64,.009,6,false);old.dispose();
 }
 update();return {mesh,update};
}
