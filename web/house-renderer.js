import {createBonusCartridge} from './bonus-cartridge-model.js';
import {createBasementCartridges} from './cartridge-storage.js';
import {illustrateHouse} from './house-illustration.js?v=3';
import {repairDenProjection} from './den-projection.js';
import {assignRoomLighting,renderIsolatedRooms} from './house-lighting.js';
import {createRoomResources} from './house-resources.js';
import {createHouseProps} from './house-props.js';
import {createHousePropInput} from './house-prop-input.js?v=bitey-1';
import {roomMatrix,buildConnections,createRoute,createDenRoute,travelEase,setAtticAccess} from './house-layout.js?v=bitey-1';
import {createHiddenScraps} from './house-scraps.js';
import {createWindowParallax} from './house-window-parallax.js';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

export function createHouseRenderer(host,{onActivate=()=>{},getDen,collected=new Set()}={}) {
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.localClippingEnabled=true;
 renderer.domElement.className='house-canvas';host.prepend(renderer.domElement);
 const world=new THREE.Scene();renderer.setClearColor('#10191e');
 const ambient=new THREE.HemisphereLight(0xadc8de,0x58412b,.45);ambient.layers.enableAll();world.add(ambient);
 const fill=new THREE.DirectionalLight(0xb8cee0,.35);fill.position.set(-3,5,5);fill.layers.enableAll();world.add(fill);
 const loader=new GLTFLoader(),rooms=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let layout,connections,loading,current,camera,revision=0,revealRevision=0,frame,finish,propFrame,propTime=0,active=false,targets=new Map(),denClone;
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
 function render(){if(camera){for(const room of rooms.values())room.windowParallax?.update(camera);renderIsolatedRooms(renderer,world,camera,[...rooms.keys()]);updateTargets();}}
 function resize(){input.cancel();const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);if(camera){camera.aspect=width/height;camera.updateProjectionMatrix();render();}}
 function setupDoors(model){
  const doors=new Map(),leaves=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if(o.userData.hotspot?.startsWith('door-'))leaves.push(o);});
  for(const leaf of leaves){
   const key=leaf.userData.hotspot;if(doors.has(key))continue;
   const center=leaf.getWorldPosition(new THREE.Vector3()),pivot=new THREE.Group();pivot.position.copy(center);
   if(key==='door-attic')pivot.position.set(0,2.98,.97);else{pivot.position.y=0;pivot.position.z+=key==='door-workshop'?-.52:.52;}
   world.add(pivot);pivot.updateMatrixWorld(true);const parts=[];
   model.traverse(o=>{
    if(!o.isMesh)return;
    if(key==='door-attic'){if(o.userData.hotspot===key||/Hatch_pull_handle/.test(o.name))parts.push(o);}
    else if(/Recessed_unmarked_door_leaf|Recessed_door_panel|Unmarked_door_brass_knob/.test(o.name)&&o.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1.2)parts.push(o);
   });
   for(const part of parts)pivot.attach(part);
   doors.set(key,{pivot,axis:key==='door-attic'?'x':'y',angle:key==='door-workshop'?-1.5:1.5});
  }
  return doors;
 }
 function addRoom(id,gltf){
  if(id==='basement')for(const cartridge of createBasementCartridges(getDen?.()?.basementCartridges??[]))gltf.scene.add(cartridge);
  const resources=createRoomResources();resources.capture(gltf.scene);
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
  if(spec.viewPosition){view.position.fromArray(spec.viewPosition);view.lookAt(new THREE.Vector3(...spec.viewTarget));}
  const props=createHouseProps(gltf.scene,world);
  const propMaterials=new Map();
  for(const prop of props.props)prop.root.traverse(o=>{if(!o.isMesh||!clipping)return;const unclipped=m=>{if(!propMaterials.has(m)){const copy=m.clone();copy.clippingPlanes=null;propMaterials.set(m,copy);}return propMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(unclipped):unclipped(o.material);});
  const scraps=createHiddenScraps(props.props,view,world,collected);
  const roots=[gltf.scene,...props.props.map(p=>p.root),...Array.from(doors.values(),d=>d.pivot),...Array.from(scraps.values(),s=>s.mesh)];
  illustrateHouse(roots);
  const windowParallax=id==='hallway'?createWindowParallax(gltf.scene,view):null;
  roots.forEach(root=>resources.capture(root));assignRoomLighting(roots,id);
  const room={id,resources,roots,windowParallax,scene:world,model:gltf.scene,view,doors,props,scraps,pickRoots:[gltf.scene,...props.props.map(p=>p.root),...Array.from(doors.values(),d=>d.pivot)]};rooms.set(id,room);
 }
 function refreshDen(){
  const source=getDen?.();if(!source?.scene||!source.camera)return;
  if(denClone)unloadRoom('den');
  const den=layout.rooms.den,right=den.position[0]+den.right,back=den.position[2]+den.back;
  denClone=source.scene.clone(true);const matrix=roomMatrix(den),inverse=matrix.clone().invert(),materials=new Map(),geometries=new Map(),textures=new Map();
  const ownTexture=texture=>{if(!textures.has(texture))textures.set(texture,texture.clone());return textures.get(texture);};
  denClone.traverse(o=>{
   if(!o.isMesh)return;
   if(!geometries.has(o.geometry))geometries.set(o.geometry,o.geometry.clone());o.geometry=geometries.get(o.geometry);
   function cloneMaterial(original){
    if(materials.has(original))return materials.get(original);
    const mat=original.clone();materials.set(original,mat);
    if(original.userData.denIllustrated){mat.onBeforeCompile=original.onBeforeCompile;mat.customProgramCacheKey=original.customProgramCacheKey;}
    for(const [key,value] of Object.entries(original))if(value?.isTexture)mat[key]=ownTexture(value);
    for(const [key,uniform] of Object.entries(original.uniforms??{}))if(uniform.value?.isTexture)mat.uniforms[key].value=ownTexture(uniform.value);
    if(mat.uniforms?.bakeProjection&&!mat.vertexShader.includes('bakeModelMatrix'))mat.uniforms.bakeProjection.value.multiply(inverse);
    if(mat.isShaderMaterial){
     mat.vertexShader='varying vec3 houseWorldPosition;\n'+mat.vertexShader.replace('void main(){','void main(){houseWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;');
     mat.fragmentShader='varying vec3 houseWorldPosition;\n'+mat.fragmentShader.replace('void main(){',`void main(){if(houseWorldPosition.x > ${right.toFixed(4)} || houseWorldPosition.z < ${back.toFixed(4)}) discard;`);
    }else mat.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),right),new THREE.Plane(new THREE.Vector3(0,0,1),-back)];
    repairDenProjection(mat,source.camera,inverse);
    return mat;
   }
   o.material=Array.isArray(o.material)?o.material.map(cloneMaterial):cloneMaterial(o.material);
  });
  denClone.applyMatrix4(matrix);assignRoomLighting([denClone],'den');world.add(denClone);
  const view=source.camera.clone();view.position.applyMatrix4(matrix);view.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(matrix));
  const resources=createRoomResources();resources.capture(denClone);
  rooms.set('den',{id:'den',scene:world,view,resources});
 }
 function unloadRoom(id){
  const room=rooms.get(id);if(!room)return;
  if(id==='den'){
   denClone?.removeFromParent();
   room.resources.dispose();denClone=null;
  }else{
   room.props.cancel();room.roots.forEach(root=>root.removeFromParent());room.resources.dispose();
  }
  rooms.delete(id);renderer.renderLists.dispose();
 }
 async function load(){
  if(!loading)loading=(async()=>{
   const response=await fetch('/web/assets/house/layout.json?v=bitey-1');if(!response.ok)throw Error('House layout unavailable');layout=await response.json();
   connections=buildConnections(layout);
   // The replacement ceiling belongs to the hallway, including its lighting.
   assignRoomLighting(connections.group.children.filter(o=>o.name.startsWith('Hall ceiling')||o.name.startsWith('Hall landing')||o.name==='Den shared wall extension'),'hallway');
   connections.resources=createRoomResources();connections.resources.capture(connections.group);
   illustrateHouse([connections.group]);connections.resources.capture(connections.group);world.add(connections.group);
  })().catch(error=>{loading=null;throw error;});
  await loading;
 }
 async function ensureRoom(id,ticket){
  if(rooms.has(id))return;
  if(id==='den'){refreshDen();return;}
  const gltf=await loader.loadAsync(`/web/assets/house/${id}.glb${id==='attic'?'?v=tricycle-2':id==='hallway'?'?v=bitey-1':id==='workshop'?'?v=desk-in-progress-1':''}`);
  if(ticket!==revision){const resources=createRoomResources();resources.capture(gltf.scene);resources.dispose();return;}
  addRoom(id,gltf);
 }
 function cancel(){
  setActive(false);targets.clear();revision++;cancelAnimationFrame(frame);finish?.();finish=null;current=null;
  if(connections)setAtticAccess(connections.ladder,rooms.get('hallway')?.doors.get('door-attic'),0);
  for(const id of [...rooms.keys()])unloadRoom(id);
  renderer.clear();
 }
 async function moveAlong(destination,path,doorId){
  const ticket=revision,points=[camera.position.clone(),...path.map(p=>new THREE.Vector3(...p)),destination.view.position.clone()];
  const route=doorId==='door-den'
   ?createDenRoute(destination.id==='den'?destination.view.position:camera.position,destination.id==='hallway'?destination.view.position:camera.position,layout.denCurve,destination.id==='den')
   :createRoute(points);
  const startRotation=camera.quaternion.clone();
  const length=route.getLength(),duration=reduced.matches?0:Math.min(10000,Math.max(2800,length*340));
  const door=rooms.get('hallway').doors.get(doorId),startDoorAngle=door?.pivot.rotation[door.axis]??0;
  const began=performance.now();
  await new Promise(resolve=>{
   finish=resolve;
   const step=now=>{
    if(ticket!==revision){resolve();return;}
    const t=duration?THREE.MathUtils.clamp((now-began)/duration,0,1):1;
    const progress=travelEase(t);
    camera.position.copy(route.getPoint(progress));
    // A single shortest rotation avoids whipping toward every path segment.
    camera.quaternion.slerpQuaternions(startRotation,destination.view.quaternion,progress);
    // Keep the same lens throughout exploration, including arrival. Changing
    // FOV or zoom during a dolly makes the scene appear to stretch.
    if(doorId==='door-attic')setAtticAccess(connections.ladder,door,THREE.MathUtils.lerp(startDoorAngle/door.angle,1,Math.min(1,t*7)));
    else if(door)door.pivot.rotation[door.axis]=THREE.MathUtils.lerp(startDoorAngle,door.angle,Math.min(1,t*7));
    render();if(t<1)frame=requestAnimationFrame(step);else{finish=null;resolve();}
   };frame=requestAnimationFrame(step);
  });
  if(ticket!==revision)return;
  current=destination;
  // Close behind the camera before releasing the room on the other side.
  if(door){
   const beganClosing=performance.now();
   await new Promise(resolve=>{
    finish=resolve;
    const close=now=>{
     if(ticket!==revision){resolve();return;}
     const t=reduced.matches?1:Math.min(1,(now-beganClosing)/700);
     if(doorId==='door-attic')setAtticAccess(connections.ladder,door,1-travelEase(t));
     else door.pivot.rotation[door.axis]=door.angle*(1-travelEase(t));render();
     if(t<1)frame=requestAnimationFrame(close);else{finish=null;resolve();}
    };frame=requestAnimationFrame(close);
   });
  }
 }
 async function travel(id){
  revealRevision++;
  setActive(false);targets.clear();const ticket=revision;await load();
  if(ticket!==revision)return;
  await Promise.all([...new Set(['hallway',id])].map(room=>ensureRoom(room,ticket)));
  if(ticket!==revision)return;
  if(!current||current.id==='den'){refreshDen();current=rooms.get('den')??rooms.get('hallway');camera=current.view.clone();resize();}
  const destination=rooms.get(id),from=current.id;
  const branch=id==='hallway'?from:id;
  const path=layout.routes[branch]??[];
  await moveAlong(destination,id==='hallway'?[...path].reverse():path,`door-${branch}`);
  if(ticket!==revision)return;
  for(const room of [...rooms.keys()])if(room!==id)unloadRoom(room);
  render();
 }
 async function revealScrap(id,bonusId){
  const room=current,scrap=room?.scraps?.get(id);if(!scrap)return null;
  const ticket=revision,revealTicket=++revealRevision,start=scrap.mesh.position.clone(),end=scrap.prop.root.position.clone();
  const valid=()=>ticket===revision&&revealTicket===revealRevision&&current===room;
  let cartridge;
  if(bonusId){
   cartridge=await createBonusCartridge(bonusId);
   const resources=createRoomResources();resources.capture(cartridge);
   if(!valid()){resources.dispose();return null;}
   cartridge.position.copy(start);cartridge.quaternion.copy(camera.quaternion);
   world.add(cartridge);room.roots.push(cartridge);room.resources.capture(cartridge);
   assignRoomLighting([cartridge],room.id);illustrateHouse([cartridge]);room.resources.capture(cartridge);
  }
  end.addScaledVector(camera.position.clone().sub(end).normalize(),bonusId ? .75 : .4);end.y+=bonusId ? .45 : .25;
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const paperEnd=end.clone().addScaledVector(right,bonusId?-.24:0);
  const cartridgeEnd=end.clone().addScaledVector(right,.17);
  const began=performance.now(),duration=bonusId?950:260;
  await new Promise(resolve=>{
   const step=now=>{
    if(!valid()){resolve();return;}
    const t=reduced.matches?1:Math.min(1,(now-began)/duration),blend=t*t*(3-2*t);
    scrap.mesh.position.lerpVectors(start,paperEnd,blend);
    if(cartridge)cartridge.position.lerpVectors(start,cartridgeEnd,blend);
    render();if(t<1)requestAnimationFrame(step);else resolve();
   };requestAnimationFrame(step);
  });
  if(!valid()){scrap.mesh.position.copy(start);if(cartridge)cartridge.visible=false;return null;}
  const point=end.project(camera);collected.add(id);scrap.mesh.visible=false;if(cartridge)cartridge.visible=false;render();
  return {x:(point.x+1)*50,y:(1-point.y)*50,cartridgeLabel:cartridge?.userData.labelImage};
 }
 return {load,travel,depart:()=>travel('den'),resize,cancel,setActive,setInteractive:value=>input.setEnabled(value),revealScrap,cancelGrab:()=>input.cancel(),
  get props(){return current?.props?.props??[];},
  get fixedTargets(){
   const result=new Map();current?.model?.traverse(o=>{if(o.userData.hotspot)result.set(o.userData.hotspot,{root:o});});
   for(const [id,door] of current?.doors??[])result.set(id,{root:door.pivot});
   return result;
  },
  bindTargets(value){targets=value;updateTargets();},activateProp(prop){input.activate(prop);},
  dispose(){cancel();input.dispose();connections?.resources?.dispose();const resources=createRoomResources();resources.capture(world);resources.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
