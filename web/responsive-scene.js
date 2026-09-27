import * as THREE from 'three';
import {addSurfacePatina} from './surface-patina.js';
export const UPPER_SLOTS=Array.from({length:27},(_,i)=>({position:{x:-.975+(i%14)*.15,y:3.30+Math.floor(i/14)*.57,z:.02},quaternion:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}}));
// Limit viewpoint travel to a modest dip; the room lighting remains tied to its bake.
export function framing(aspect,playing,mode='controller',gameAspect=null,mobileHeight=0){
 const upper=aspect<1.38;
 if(playing&&mode==='controller'&&mobileHeight>0){
  const shortLandscape=aspect>1.38&&mobileHeight<600;
  const reserved=shortLandscape?174:212;
  const available=Math.max(.2,(mobileHeight-reserved-24)/mobileHeight);
  const ratio=Number.isFinite(gameAspect)&&gameAspect>0?gameAspect:.318*1.6/.332;
  const width=Math.min(.318*1.6,.332*ratio),height=width/ratio;
  const zoom=Math.min(.95*aspect/width,available/height);
  return {upper,zoom,cameraDrop:0,focusY:12/mobileHeight+available/2+.014*zoom};
 }
 if(playing&&mode==='touch'){
  // Ruffle contains the game inside the CRT. Fit that content rectangle, allowing
  // unused letterboxing and the TV casing to extend beyond the viewport.
  const crtWidth=.318*1.6,crtHeight=.332;
  const ratio=Number.isFinite(gameAspect)&&gameAspect>0?gameAspect:crtWidth/crtHeight;
  const width=Math.min(crtWidth,crtHeight*ratio),height=width/ratio;
  const zoom=Math.min(.95*aspect/width,.86/height);
  return {upper,zoom,cameraDrop:0,focusY:.5+.014*zoom};
 }

 const zoom=upper?Math.min(playing?1.32:1,aspect/1.6*(playing?2.65:2.35)):(playing?1.32:1);
 return {upper,zoom,cameraDrop:playing?0:.35,focusY:upper?(playing?.32:.47):.41};
}
export function projectPoint([x,y],aspect,zoom,focusY){return [.5+(x-.5)*zoom*1.6/aspect,focusY+(y-.41)*zoom];}
export function captureSceneAnchors(camera,screen,slot){
 const ray=new THREE.Raycaster();
 const atDepth=([x,y],z)=>{ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),new THREE.Vector3());};
 return {screen:screen.map(p=>atDepth(p,.34)),slot:atDepth(slot,1.17),focus:atDepth([.5,.41],.34)};
}
export function projectWorld(point,camera){const p=point.clone().project(camera);return [(p.x+1)/2,(1-p.y)/2];}
export function composeCamera(camera,{aspect,zoom,focusY,height},focus){
 camera.position.y=height;camera.aspect=aspect;camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const current=projectWorld(focus,camera);
 camera.projectionMatrix.elements[9]+=2*(focusY-current[1]);
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
export function createUpperShelf(){
 const group=new THREE.Group(),colliders=[];
 const wood=new THREE.MeshStandardMaterial({color:0x36271d,roughness:.79});
 const edge=new THREE.MeshStandardMaterial({color:0x493428,roughness:.67});
 const metal=new THREE.MeshStandardMaterial({color:0x252e30,roughness:.49,metalness:.65});
 for(const mat of [wood,edge,metal])addSurfacePatina(mat,{grain:.12,wear:.12});
 function box(name,size,position,material=wood,solid=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);if(solid)colliders.push({name:'Upper library '+name,center:position,halfExtents:size.map(n=>n/2),quaternion:[0,0,0,1]});return mesh;}
 for(const y of [3.275,3.845,4.415]){box('board',[2.24,.05,.68],[0,y,.02]);box('front lip',[2.24,.025,.025],[0,y-.01,.365],edge,false);}
 for(const x of [-1.095,1.095])box('side',[.05,1.19,.68],[x,3.845,.02]);
 box('back',[2.19,1.19,.045],[0,3.845,-.30]);
 for(const x of [-.86,.86]){box('bracket',[.035,.23,.045],[x,3.17,-.23],metal,false);box('brace',[.035,.035,.40],[x,3.22,-.03],metal,false);}
 // Thin grain lines add scale and wear without another image download.
 for(let i=0;i<24;i++){const z=-.29+i*.027;box('grain',[2.12,.001,.0015],[0,3.301,z],edge,false);}
 return {group,colliders};
}
// A few surface samples handle partially visible carts and furniture occlusion.
// Other cartridges do not count as permanent occluders: stacks should stay put.
export function cartridgeVisible(root,camera,occluders){
 root.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const origin=camera.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster();
 ray.firstHitOnly=true;
 for(const [x,y,z] of [[0,0,0],[-.4,-.4,.4],[.4,-.4,.4],[-.4,.4,.4],[.4,.4,.4],[0,.4,-.4]]){
  const point=center.clone().add(new THREE.Vector3(x*size.x,y*size.y,z*size.z)),ndc=point.clone().project(camera);
  if(ndc.z<-1||ndc.z>1||Math.abs(ndc.x)>.98||Math.abs(ndc.y)>.98)continue;
  const direction=point.clone().sub(origin),distance=direction.length();ray.set(origin,direction.normalize());ray.far=distance-.035;
  const hits=ray.intersectObjects(occluders,true);
  if(!hits.length)return true;
 }
 return false;
}
