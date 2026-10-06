import * as T from 'three';
import {createRoute} from '../../web/house-layout.js';
import {travelPose} from '../../web/house-travel.js';
import {framing,composeCamera} from '../../web/responsive-scene.js';
export const VIEWPORTS=[{id:'phone-portrait',width:390,height:844,dpr:2},{id:'phone-landscape',width:844,height:390,dpr:2},{id:'desktop',width:1440,height:900,dpr:2}];
export function fittedCamera(view,aspect,sourceAspect=1.6){
 const fov=2*Math.atan(Math.tan(view.fov*Math.PI/360)*Math.max(1,sourceAspect/aspect))*180/Math.PI;
 const camera=new T.PerspectiveCamera(fov,aspect,.035,250);camera.position.fromArray(view.position);camera.lookAt(new T.Vector3(...view.target));camera.updateMatrixWorld();return camera;
}
export function houseCameras(layout,room,viewport,steps){
 const aspect=viewport.width/viewport.height,result=[];
 const add=(id,camera)=>result.push({id,camera,viewport:{width:viewport.width*viewport.dpr,height:viewport.height*viewport.dpr}});
 const own=room==='hallway'?['hub','private-hall']:[room];
 for(const id of own)add(`rest:${id}`,fittedCamera(layout.views[id],aspect,layout.aspect));
 if(steps<=0)return result;
 // Include both ends while passing through the hallway, and only the relevant
 // branch otherwise. Visibility is depth-tested against the assembled geometry.
 for(const id of room==='hallway'?Object.keys(layout.routes):[room]){
  if(!layout.routes[id]||id==='den')continue;
  const route=createRoute(layout.routes[id].map(p=>new T.Vector3(...p)),{arrivalRadius:id==='basement'?1.2:.45});
  for(const reverse of [false,true])for(let i=0;i<=steps;i++){
   const p=i/steps,pose=travelPose(route,p,layout.views.hub,layout.views[id],id,reverse);
   const view={...layout.views.hub,fov:T.MathUtils.lerp(layout.views.hub.fov,layout.views[id].fov,T.MathUtils.smoothstep(p,.75,1))};
   const camera=fittedCamera(view,aspect,layout.aspect);camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);camera.updateMatrixWorld();add(`travel:${id}:${reverse?'out':'in'}:${i}`,camera);
  }
 }
 return result;
}
export function denCameras(base,viewport){
 const original=base.clone();original.updateMatrixWorld();
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(0,.18),original);
 const focus=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-.34),new T.Vector3());
 return [false,true].map(playing=>{
  const aspect=viewport.width/viewport.height,frame=framing(aspect,playing),camera=base.clone();
  composeCamera(camera,{aspect,zoom:frame.zoom,focusY:frame.focusY,height:base.position.y-frame.cameraDrop},focus);
  return {id:`den:${playing?'playing':'idle'}`,camera,viewport:{width:viewport.width*viewport.dpr,height:viewport.height*viewport.dpr}};
 });
}

// Mirrors the den's rigid placement and blended lens during doorway travel.
export const DEN_TO_WORLD=new T.Matrix4().compose(new T.Vector3(-.208,0,9.4),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2),new T.Vector3(.55,.55,.55));
export function denTravelCameras(layout,base,viewport,steps){
 if(steps<=0)return [];
 const endpoint=denCameras(base,viewport)[0].camera,eye=endpoint.position.clone().applyMatrix4(DEN_TO_WORLD),points=layout.routes.den.map(p=>new T.Vector3(...p));
 points.splice(1,points.length-1,new T.Vector3(5.55,1.65,7.55),new T.Vector3(5.55,1.65,eye.z),eye);
 const route=createRoute(points),result=[],yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2),targetRotation=yaw.multiply(endpoint.quaternion);
 for(const reverse of [false,true])for(let i=0;i<=steps;i++){
  const p=i/steps,pose=travelPose(route,p,layout.views.hub,layout.views.den,'den',reverse),blend=T.MathUtils.smoothstep(pose.position.z,8,8.7);
  const camera=fittedCamera(layout.views.hub,viewport.width/viewport.height,layout.aspect);
  camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion).slerp(targetRotation,1-T.MathUtils.smoothstep(camera.position.x,4.95,5.55));
  camera.fov=T.MathUtils.lerp(camera.fov,endpoint.fov,blend);camera.zoom=T.MathUtils.lerp(1,endpoint.zoom,blend);camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[8]=endpoint.projectionMatrix.elements[8]*blend;camera.projectionMatrix.elements[9]=endpoint.projectionMatrix.elements[9]*blend;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld();
  result.push({id:`travel:den:${reverse?'out':'in'}:${i}`,camera,viewport:{width:viewport.width*viewport.dpr,height:viewport.height*viewport.dpr}});
 }
 return result;
}
