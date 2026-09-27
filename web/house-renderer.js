import {createHouseProps} from './house-props.js';
import {createHousePropInput} from './house-prop-input.js';
import {roomMatrix,buildConnections,sampleRoute} from './house-layout.js';
import {createHiddenScraps} from './house-scraps.js';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

export function createHouseRenderer(host,{onActivate=()=>{},getDen,collected=new Set()}={}) {
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.localClippingEnabled=true;
 renderer.domElement.className='house-canvas';host.prepend(renderer.domElement);
 const world=new THREE.Scene();world.background=new THREE.Color('#10191e');
 world.add(new THREE.HemisphereLight(0xadc8de,0x58412b,.45));
 const fill=new THREE.DirectionalLight(0xb8cee0,.35);fill.position.set(-3,5,5);world.add(fill);
 const loader=new GLTFLoader(),rooms=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let layout,connections,loading,current,camera,revision=0,frame,finish,propFrame,propTime=0,active=false,targets=new Map(),denClone;
 const input=createHousePropInput(host,{getRoom:()=>current,getCamera:()=>camera,onActivate,wake,reduced});
 function wake(){if(!active||propFrame||document.hidden)return;propTime=performance.now();propFrame=requestAnimationFrame(updateProps);}
 function updateProps(now){
  propFrame=null;if(!active||!current?.props||document.hidden)return;
  const {changed,animating}=current.props.update(Math.min((now-propTime)/1000,.05),reduced.matches);propTime=now;
  if(changed)render();if(animating)propFrame=requestAnimationFrame(updateProps);
 }
 function setActive(value){active=value;input.setEnabled(value);if(value)wake();else{cancelAnimationFrame(propFrame);propFrame=null;}}
 function updateTargets(){
  world.updateMatrixWorld(true);
  for(const [prop,button] of targets){
   const box=new THREE.Box3().setFromObject(prop.root),points=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
   const left=Math.max(0,Math.min(...points.map(p=>(p.x+1)/2))),right=Math.min(1,Math.max(...points.map(p=>(p.x+1)/2)));
   const top=Math.max(0,Math.min(...points.map(p=>(1-p.y)/2))),bottom=Math.min(1,Math.max(...points.map(p=>(1-p.y)/2)));
   button.hidden=right<=left||bottom<=top||points.every(p=>p.z>1||p.z< -1);
   Object.assign(button.style,{left:`${left*100}%`,top:`${top*100}%`,width:`${(right-left)*100}%`,height:`${(bottom-top)*100}%`});
  }
 }
 function render(){if(camera){renderer.render(world,camera);updateTargets();}}
 function resize(){input.cancel();const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);if(camera){camera.aspect=width/height;camera.updateProjectionMatrix();render();}}
 function setupDoors(model){
  const doors=new Map(),leaves=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if(o.userData.hotspot?.startsWith('door-'))leaves.push(o);});
  for(const leaf of leaves){
   const key=leaf.userData.hotspot;if(doors.has(key))continue;
   const center=leaf.getWorldPosition(new THREE.Vector3()),pivot=new THREE.Group();pivot.position.copy(center);
   if(key==='door-attic')pivot.position.set(0,2.98,.97);else{pivot.position.y=0;pivot.position.z+=key==='door-basement'?-.52:.52;}
   world.add(pivot);pivot.updateMatrixWorld(true);const parts=[];
   model.traverse(o=>{
    if(!o.isMesh)return;
    if(key==='door-attic'){if(o.userData.hotspot===key||/Hatch_pull_handle/.test(o.name))parts.push(o);}
    else if(/Recessed_unmarked_door_leaf|Recessed_door_panel|Unmarked_door_brass_knob/.test(o.name)&&o.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1.2)parts.push(o);
   });
   for(const part of parts)pivot.attach(part);
   doors.set(key,{pivot,axis:key==='door-attic'?'x':'y',angle:key==='door-basement'?-1.5:1.5});
  }
  return doors;
 }
 function addRoom(id,gltf){
  const spec=layout.rooms[id],matrix=roomMatrix(spec);gltf.scene.applyMatrix4(matrix);world.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
  const ceiling=[];
  const clipping=spec.front===undefined?null:new THREE.Plane(new THREE.Vector3(0,0,-1),spec.front).applyMatrix4(matrix);
  gltf.scene.traverse(o=>{
   if(o.isLight)o.intensity*=.012;
   if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   if(id==='hallway'&&/Corridor_ceiling/.test(o.name))ceiling.push(o);
   if(o.isMesh&&clipping){for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.clippingPlanes=[clipping];}
  });
  ceiling.forEach(o=>o.removeFromParent());
  const doors=id==='hallway'?setupDoors(gltf.scene):new Map();
  const authored=gltf.cameras[0];if(!authored)throw Error('Missing room camera');authored.updateWorldMatrix(true,false);
  const view=authored.clone();authored.getWorldPosition(view.position);authored.getWorldQuaternion(view.quaternion);
  if(spec.eyeHeight){const target=view.position.clone().add(view.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));view.position.y=spec.position[1]+spec.eyeHeight;view.lookAt(target);}
  const props=createHouseProps(gltf.scene,world);
  const propMaterials=new Map();
  for(const prop of props.props)prop.root.traverse(o=>{if(!o.isMesh||!clipping)return;const unclipped=m=>{if(!propMaterials.has(m)){const copy=m.clone();copy.clippingPlanes=null;propMaterials.set(m,copy);}return propMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(unclipped):unclipped(o.material);});
  const scraps=createHiddenScraps(props.props,view,world,collected);
  const room={id,scene:world,model:gltf.scene,view,doors,props,scraps,pickRoots:[gltf.scene,...props.props.map(p=>p.root),...Array.from(doors.values(),d=>d.pivot)]};rooms.set(id,room);
 }
 function refreshDen(){
  const source=getDen?.();if(!source?.scene||!source.camera)return;
  if(denClone){denClone.removeFromParent();denClone.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
  denClone=source.scene.clone(true);const matrix=roomMatrix(layout.rooms.den),inverse=matrix.clone().invert(),materials=new Map();
  denClone.traverse(o=>{
   if(!o.isMesh)return;
   function cloneMaterial(original){
    if(materials.has(original))return materials.get(original);
    const mat=original.clone();materials.set(original,mat);
    if(mat.uniforms?.bakeProjection&&!mat.vertexShader.includes('bakeModelMatrix'))mat.uniforms.bakeProjection.value.multiply(inverse);
    if(mat.isShaderMaterial){
     mat.vertexShader='varying float houseWorldX;\n'+mat.vertexShader.replace('void main(){','void main(){houseWorldX=(modelMatrix*vec4(position,1.0)).x;');
     mat.fragmentShader='varying float houseWorldX;\n'+mat.fragmentShader.replace('void main(){','void main(){if(houseWorldX > -7.5) discard;');
    }else mat.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),-7.5)];
    return mat;
   }
   o.material=Array.isArray(o.material)?o.material.map(cloneMaterial):cloneMaterial(o.material);
  });
  denClone.applyMatrix4(matrix);world.add(denClone);
  const view=source.camera.clone();view.position.applyMatrix4(matrix);view.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(matrix));
  rooms.set('den',{id:'den',scene:world,view});
 }
 async function load(){
  if(!loading)loading=(async()=>{
   const response=await fetch('/web/assets/house/layout.json');if(!response.ok)throw Error('House layout unavailable');layout=await response.json();
   const models=await Promise.all(['hallway','workshop','attic','basement'].map(async id=>[id,await loader.loadAsync(`/web/assets/house/${id}.glb`)]));
   connections=buildConnections(layout);world.add(connections.group);
   for(const [id,gltf] of models)addRoom(id,gltf);
   refreshDen();
  })().catch(error=>{loading=null;throw error;});
  await loading;
 }
 function cancel(){setActive(false);targets.clear();revision++;cancelAnimationFrame(frame);finish?.();finish=null;current=null;}
 function orientation(position,target){return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position,target,new THREE.Vector3(0,1,0)));}
 async function moveAlong(destination,path,doorId){
  const ticket=revision,points=[camera.position.clone(),...path.map(p=>new THREE.Vector3(...p)),destination.view.position.clone()];
  const startRotation=camera.quaternion.clone(),startFov=camera.fov,startZoom=camera.zoom;
  const length=points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0),duration=reduced.matches?0:Math.min(7500,Math.max(2000,length*230));
  const door=rooms.get('hallway').doors.get(doorId),startDoorAngle=door?.pivot.rotation[door.axis]??0;if(doorId==='door-attic')connections.ladder.visible=true;
  const began=performance.now();
  await new Promise(resolve=>{
   finish=resolve;
   const step=now=>{
    if(ticket!==revision){resolve();return;}
    const t=duration?Math.min(1,(now-began)/duration):1;
    camera.position.copy(sampleRoute(points,t));
    const ahead=sampleRoute(points,Math.min(1,t+.02)),look=orientation(camera.position,ahead);
    if(t<.15)look.slerpQuaternions(startRotation,look.clone(),t/.15);
    if(t>.8)look.slerp(destination.view.quaternion,(t-.8)/.2);
    camera.quaternion.copy(t===1?destination.view.quaternion:look);
    const ease=x=>x*x*(3-2*x),depart=ease(Math.min(1,t/.15)),arrive=ease(Math.max(0,(t-.8)/.2));
    camera.fov=THREE.MathUtils.lerp(THREE.MathUtils.lerp(startFov,60,depart),destination.view.fov,arrive);
    camera.zoom=THREE.MathUtils.lerp(THREE.MathUtils.lerp(startZoom,1,depart),destination.view.zoom,arrive);camera.updateProjectionMatrix();
    if(door)door.pivot.rotation[door.axis]=THREE.MathUtils.lerp(startDoorAngle,door.angle,Math.min(1,t*7));
    render();if(t<1)frame=requestAnimationFrame(step);else{finish=null;resolve();}
   };frame=requestAnimationFrame(step);
  });
  if(ticket===revision)current=destination;
 }
 async function travel(id){
  setActive(false);targets.clear();await load();
  if(!current||current.id==='den'){refreshDen();current=rooms.get('den')??rooms.get('hallway');camera=current.view.clone();resize();}
  const destination=rooms.get(id),from=current.id;
  const branch=id==='hallway'?from:id;
  const path=layout.routes[branch]??[];
  await moveAlong(destination,id==='hallway'?[...path].reverse():path,`door-${branch}`);
 }
 async function revealScrap(id){
  const scrap=current?.scraps?.get(id);if(!scrap)return null;
  const ticket=revision,start=scrap.mesh.position.clone(),end=scrap.prop.root.position.clone();
  end.addScaledVector(camera.position.clone().sub(end).normalize(),.4);end.y+=.25;
  const began=performance.now();
  await new Promise(resolve=>{
   const step=now=>{if(ticket!==revision){resolve();return;}const t=reduced.matches?1:Math.min(1,(now-began)/260);scrap.mesh.position.lerpVectors(start,end,t*t*(3-2*t));render();if(t<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);
  });
  if(ticket!==revision){scrap.mesh.position.copy(start);return null;}
  const point=end.project(camera);scrap.mesh.visible=false;render();
  return {x:(point.x+1)*50,y:(1-point.y)*50};
 }
 return {load,travel,depart:()=>travel('den'),resize,cancel,setActive,setInteractive:value=>input.setEnabled(value),revealScrap,cancelGrab:()=>input.cancel(),
  get props(){return current?.props?.props??[];},
  bindTargets(value){targets=value;updateTargets();},activateProp(prop){input.activate(prop);},
  dispose(){cancel();input.dispose();world.traverse(o=>{if(!denClone?.getObjectById(o.id))o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});renderer.dispose();renderer.domElement.remove();}
 };
}
