import {createStructureStore} from './house-structure-store.js?v=source-models-1';
import {batchHouseMeshes} from './house-render-batches.js?v=prop-cleanup-1';
// Production renderer for the approved, assembled house. Prop interaction and
// discovery behavior use the same modules as the original rooms.
import * as THREE from 'three';
import {GLTFLoader} from './model-loader.js';
import {configureWindowGlass,createMoonlitSky,MOONLIT_SKY_URL,WINDOW_GLASS_LAYER} from './house-window-sky.js?v=source-models-1';
import {createContinuousDen} from './house-den-continuity.js?v=source-models-1';
import {assignRoomLighting,renderIsolatedRooms} from './house-lighting.js';
import {illustrateHouse} from './house-illustration.js';
import {createRoomResources} from './house-resources.js';
import {createHouseProps,collectHouseStructureColliders} from './house-props.js?v=ceiling-collision-1';
import {createHousePropInput} from './house-prop-input.js?v=prop-cleanup-1';
import {createHiddenScraps} from './house-scraps.js?v=prop-cleanup-1';
import {createBonusCartridge} from './bonus-cartridge-model.js';
import {createBasementCartridges} from './cartridge-storage.js';
import {createRoute} from './house-layout.js?v=house-reference-38';
import {resizeHouseCamera} from './house-camera.js';
import {travelPose,travelDuration} from './house-travel.js?v=house-reference-38';
import {doorMotion,ladderMotion} from './house-access.js';
export function createHouseRenderer(host,{onActivate=()=>{},getDen,ensureDen,unloadDen,loadBasementCartridges,collected=new Set(),layoutURL='/web/assets/house/release/layout.json?v=source-models-1'}={}) {
 const debugParams=new URLSearchParams(location.search),slowValue=debugParams.get('slowHouseTravel');
 // Copy diagnostic frames during travel; defer PNG encoding until the burst ends.
 const captureEnabled=debugParams.get('captureHouseTravel')==='1';
 const debugTravel=slowValue!==null||captureEnabled;
 const slowFactor=THREE.MathUtils.clamp(Number(slowValue)||1,1,20);
 // The application owns one WebGL context. Move its canvas between views.
 const renderer=getDen?.()?.renderer;
 if(!renderer)throw Error('The shared renderer must be ready before house travel');
 function configureRenderer(){
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
  renderer.localClippingEnabled=true;renderer.shadowMap.enabled=false;renderer.setClearColor('#10191e');
 }
 configureRenderer();renderer.domElement.id='';renderer.domElement.classList.add('house-canvas');host.prepend(renderer.domElement);
 const saveFrame=captureEnabled?document.createElement('button'):null;
 const saveBurst=captureEnabled?document.createElement('button'):null;
 let burstArmed=false,burstFrames=[];
 const burstAt=THREE.MathUtils.clamp(Number(debugParams.get('captureHouseBurstAt')??.1),0,.95);
 function captureBurstFrame(branch,t,reverse){
  if(!burstArmed||t<burstAt)return;
  const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
  canvas.getContext('2d').drawImage(renderer.domElement,0,0);
  burstFrames.push({canvas,name:`${branch}-${reverse?'out':'in'}-${t.toFixed(6)}-${burstFrames.length}.png`});
  if(burstFrames.length<4)return;
  burstArmed=false;const frames=burstFrames;burstFrames=[];
  setTimeout(async()=>{
   try{
    for(const {canvas,name} of frames){
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
     const response=await fetch('/_house_capture',{method:'POST',headers:{'Content-Type':'image/png','X-House-Frame':name},body:blob});
     if(!response.ok)throw Error('Capture failed');
    }
    saveBurst.textContent='Saved 4 consecutive frames';
   }catch{saveBurst.textContent='Burst capture failed';}
  },0);
 }
 const captureFrame=()=>{
  render();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
  const context=canvas.getContext('2d');context.drawImage(renderer.domElement,0,0);
  const name=`${host.dataset.houseTravelBranch??'den'}-${host.dataset.houseTravelReverse==='true'?'out':'in'}-${host.dataset.houseTravelProgress??'endpoint'}.png`;
  canvas.toBlob(async blob=>{
   const response=await fetch('/_house_capture',{method:'POST',headers:{'Content-Type':'image/png','X-House-Frame':name},body:blob});
   if(saveFrame)saveFrame.textContent=response.ok?`Saved ${name}`:'Capture failed';
  },'image/png');
 };
 if(saveFrame){
  saveFrame.type='button';saveFrame.textContent='Save travel frame';saveFrame.setAttribute('aria-label','Save travel frame');
  Object.assign(saveFrame.style,{position:'absolute',top:'8px',right:'8px',zIndex:'10',padding:'6px 9px',background:'#17232d',color:'#fff',border:'1px solid #8092a0'});
  saveFrame.addEventListener('click',captureFrame);host.append(saveFrame);
  saveBurst.type='button';saveBurst.textContent='Capture next 4 movement frames';
  saveBurst.style.cssText=saveFrame.style.cssText;saveBurst.style.top='46px';
  saveBurst.addEventListener('click',()=>{burstFrames=[];burstArmed=true;saveBurst.textContent='Armed: next 4 movement frames';});host.append(saveBurst);
 }
 const world=new THREE.Scene();renderer.setClearColor('#10191e');
 const ambient=new THREE.HemisphereLight(0xadc8de,0x58412b,.45);for(const layer of [0,1,2,3,4])ambient.layers.enable(layer);world.add(ambient);
 const fill=new THREE.DirectionalLight(0xb8cee0,.35);fill.position.set(-3,5,5);for(const layer of [0,1,2,3,4])fill.layers.enable(layer);world.add(fill);
 const loader=new GLTFLoader(),rooms=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let layout,connections,loading,current,camera,revision=0,revealRevision=0,frame,finish,propFrame,propTime=0,active=false,targets=new Map();
 let continuousDen,sky,denProgress=0;
 const targetGeometry=new THREE.BoxGeometry(.7,1,.12),targetMaterial=new THREE.MeshBasicMaterial();
 const input=createHousePropInput(host,{getRoom:()=>current,getCamera:()=>camera,onActivate,wake,reduced});
 function wake(){if(!active||propFrame||document.hidden)return;propTime=performance.now();propFrame=requestAnimationFrame(updateProps);}
 function updateProps(now){
  propFrame=null;if(!active||!current?.props||document.hidden)return;
  const {changed,animating}=current.props.update(Math.min((now-propTime)/1000,.05),reduced.matches);propTime=now;
  if(changed)render();if(animating)propFrame=requestAnimationFrame(updateProps);
 }
 function setActive(value){active=value;input.setEnabled(value);if(value)wake();else{cancelAnimationFrame(propFrame);propFrame=null;}}
 function updateTargets(){
  world.updateMatrixWorld(true);const viewport=host.getBoundingClientRect();
  for(const [prop,button] of targets){
   const box=prop.localBounds?prop.localBounds.clone().applyMatrix4(prop.root.matrixWorld):new THREE.Box3().setFromObject(prop.root),points=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
   let left=Math.max(0,Math.min(...points.map(p=>(p.x+1)/2))),right=Math.min(1,Math.max(...points.map(p=>(p.x+1)/2)));
   let top=Math.max(0,Math.min(...points.map(p=>(1-p.y)/2))),bottom=Math.min(1,Math.max(...points.map(p=>(1-p.y)/2)));
   button.hidden=right<=left||bottom<=top||points.every(p=>p.z>1||p.z< -1);
   if(prop.navigation&&!button.hidden){
    const width=Math.max(right-left,56/viewport.width),height=Math.max(bottom-top,56/viewport.height);
    left=THREE.MathUtils.clamp((left+right-width)/2,0,1-width);top=THREE.MathUtils.clamp((top+bottom-height)/2,0,1-height);right=left+width;bottom=top+height;
   }
   Object.assign(button.style,{left:`${left*100}%`,top:`${top*100}%`,width:`${(right-left)*100}%`,height:`${(bottom-top)*100}%`});
  }
 }
 let renderedFrames=0;
 function render(){if(camera){
  renderedFrames++;
  host.dataset.houseLoadedRooms=[...rooms.keys()].join(',');
  host.dataset.houseLoadedShells=[...structures.entries.keys()].join(',');
  renderIsolatedRooms(renderer,world,camera,[...rooms.keys()].filter(id=>id!=='private-hall'),continuousDen?.exposure);
  updateTargets();
 }}
 function resize(){input.cancel();const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);if(camera){resizeHouseCamera(camera,width/height);render();}}
 function roomAsset(id){return layout.assets[id];}
 function viewFor(id){
  const v=layout.views[id==='hallway'?'hub':id],view=new THREE.PerspectiveCamera(v.fov,layout.aspect,.035,250);
  view.position.fromArray(v.position);view.lookAt(new THREE.Vector3(...v.target));view.userData.explorationLens={fov:v.fov,aspect:layout.aspect};return view;
 }
 function materials(root){
  root.traverse(o=>{
   let owner=o;while(owner&&!owner.userData.release_room)owner=owner.parent;
   if(owner)Object.assign(o.userData,owner.userData);
   if(!o.isMesh)return;
   const convert=m=>{
    if(o.userData.preview_kind==='window'&&/glass/i.test(o.name)){
     o.layers.set(WINDOW_GLASS_LAYER);o.userData.windowGlass=true;
     return new THREE.MeshBasicMaterial({name:'Clear house window glass',color:0x192532,
      transparent:true,opacity:.025,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    }
    if(!o.userData.release_baked&&o.userData.preview_kind==='site'&&/tree canopy|finish.*pine/i.test(o.name.replaceAll('_',' '))){
     return new THREE.MeshBasicMaterial({name:'Dark exterior foliage',color:0x0a1620,side:THREE.DoubleSide,toneMapped:false});
    }
    if(o.userData.release_baked){
     const map=m.emissiveMap??m.map;if(!map)throw Error('Missing house lightmap');
     const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,toneMapped:false});
     map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
     return material;
    }
    if(m.transparent)o.castShadow=false;
    m.side=THREE.DoubleSide;return m;
   };
   o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });
 }
 function addRoom(id,gltf){
  materials(gltf.scene);world.add(gltf.scene);
  if(id==='basement')for(const cartridge of createBasementCartridges(gltf.archive??[])){
   cartridge.position.add(new THREE.Vector3(6.53,-4,3.29));gltf.scene.add(cartridge);
  }
  const resources=createRoomResources();resources.capture(gltf.scene);const view=viewFor(id);
  const props=id==='den'||id==='private-hall'?{props:[],cancel(){},update(){return {};}}:createHouseProps(gltf.scene,world,{floorY:id==='basement'?-4:id==='attic'?2.8:0,roomBounds:id==='workshop'?[12,0,17,7]:id==='hallway'?[4.8,6.8,12,12]:[0,0,12,12],structureColliders:connections.structureColliders});
  const glass=id==='basement'?configureWindowGlass(gltf.scene):[];
  const scraps=createHiddenScraps(props.props,view,world,collected);
  const roots=[gltf.scene,...props.props.map(p=>p.root),...Array.from(scraps.values(),s=>s.mesh)];illustrateHouse(roots,{outlines:!debugParams.has('noHouseInk')});roots.forEach(root=>resources.capture(root));
  assignRoomLighting(roots,id==='private-hall'?'hallway':id);
  if(!debugParams.has('unbatched')){batchHouseMeshes(gltf.scene,{staticCells:true});for(const prop of props.props)batchHouseMeshes(prop.root);}
  roots.forEach(root=>resources.capture(root));
  glass.forEach(mesh=>mesh.layers.set(WINDOW_GLASS_LAYER));
  rooms.set(id,{id,scene:world,resources,roots,model:gltf.scene,view,doors:new Map(),props,scraps,pickRoots:[connections.group,gltf.scene,...props.props.map(p=>p.root)]});
 }
 function unloadRoom(id,{releaseDen=true}={}){
  const room=rooms.get(id);if(!room)return;
  if(id==='den'){continuousDen.scene.removeFromParent();continuousDen.resources.dispose();continuousDen=null;rooms.delete(id);if(releaseDen)unloadDen?.();structures.remove('den');refreshStructure();renderer.renderLists.dispose();return;}
  room.props.cancel();room.roots.forEach(root=>root.removeFromParent());room.resources.dispose({closeImages:true});rooms.delete(id);if(id!=='hallway'&&id!=='private-hall'){structures.remove(id);refreshStructure();}renderer.renderLists.dispose();
 }
 function refreshStructure(){
  if(!connections)return;
  connections.mechanisms=[...structures.entries.values()].flatMap(s=>s.mechanisms);
  connections.structureColliders=[...structures.entries.values()].flatMap(s=>s.colliders);
  connections.floorMaterial=structures.entries.get('den')?.floorMaterial;
 }
 const structures=createStructureStore({
  async load(id){
   const url=layout.structureAssets?.[id];if(!url)throw Error(`Missing room-owned structure: ${id}`);
   const resources=createRoomResources();let group;
   try{
    const gltf=await loader.loadAsync(url);group=gltf.scene;resources.capture(group);
    materials(group);
    const colliders=collectHouseStructureColliders(group),mechanisms=[];
    group.updateMatrixWorld(true);
    group.traverse(o=>{if(!o.isMesh||!['door','ladder'].includes(o.userData.preview_kind))return;
     o.updateMatrix();mechanisms.push({mesh:o,rest:o.matrix.clone()});o.matrixAutoUpdate=false;
    });
    illustrateHouse([group],{outlines:!debugParams.has('noHouseInk')});resources.capture(group);
    if(!debugParams.has('unbatched'))batchHouseMeshes(group,{staticCells:true});resources.capture(group);
    let floorMaterial;
    if(id==='den'&&layout.denFloorReference){const reference=await loader.loadAsync(layout.denFloorReference);resources.capture(reference.scene);reference.scene.traverse(o=>{if(o.isMesh&&o.material.map)floorMaterial=o.material;});}
    return {group,resources,mechanisms,colliders,floorMaterial};
   }catch(error){if(group)resources.capture(group);resources.dispose({closeImages:true});throw error;}
  },
  dispose(shell){shell.group.removeFromParent();shell.resources.dispose({closeImages:true});renderer.renderLists.dispose();}
 });
 async function ensureStructure(id){
  const key=id==='private-hall'?'hallway':id,shell=await structures.ensure(key);
  if(!shell||structures.entries.get(key)!==shell||!connections)return null;
  connections.group.add(shell.group);refreshStructure();return shell;
 }
 async function load(){
  if(!loading)loading=(async()=>{
   const response=await fetch(layoutURL,{cache:'no-cache'});if(!response.ok)throw Error('House layout unavailable');layout=await response.json();
   const group=new THREE.Group();world.add(group);
   connections={group,mechanisms:[],structureColliders:[]};
   // The hall is the only shared shell; all branch architecture is room-owned.
   await ensureStructure('hallway');
   sky=await new THREE.TextureLoader().loadAsync(MOONLIT_SKY_URL);world.add(createMoonlitSky(sky));
   for(const l of layout.lights??[]){const light=new THREE.PointLight(new THREE.Color(...l.color),l.intensity,8,2);light.position.fromArray(l.position);world.add(light);}
   access('',0);
  })().catch(error=>{loading=null;throw error;});
  await loading;
 }
 function access(branch,progress){
  const open={workshop:['mudroom','garage'],basement:['stairs'],attic:['attic'],den:['den']}[branch]??[];
  for(const {mesh,rest} of connections?.mechanisms??[]){
   if(mesh.userData.preview_kind==='ladder'){
    mesh.visible=branch==='attic'&&progress>.06;mesh.matrix.copy(ladderMotion(mesh.userData.ladder_section??2,progress)).multiply(rest);
   }else mesh.matrix.copy(doorMotion(mesh.userData.door_id,open.includes(mesh.userData.door_id)?progress:0)).multiply(rest);
   mesh.matrixWorldNeedsUpdate=true;
  }
 }
 async function ensureRoom(id,ticket){
  if(rooms.has(id))return;
  let gltf,archive=[];
  try{
   if(!await ensureStructure(id)||ticket!==revision)return;
   if(id==='den'){
    await ensureDen?.();if(ticket!==revision)return;configureRenderer();
    const source=getDen?.();if(!source?.scene||!source.camera)throw Error('The live den must be ready before house travel');
    continuousDen=createContinuousDen(source,{floorMaterial:connections.floorMaterial});world.add(continuousDen.scene);rooms.set(id,{id,view:continuousDen.endpointCamera()});return;
   }
   gltf=id==='private-hall'?{scene:new THREE.Group()}:await loader.loadAsync(id==='hallway'&&debugParams.get('hallwayStyle')==='illustrated'?'/web/assets/house/hallway-style/hallway.glb':id==='hallway'&&debugParams.get('hallwayInk')==='transfer'?'/web/assets/house/hallway-ink/hallway.glb':roomAsset(id));
   if(ticket!==revision)return;
   if(id==='basement')archive=await loadBasementCartridges?.()??[];
   if(ticket!==revision)return;
   gltf.archive=archive;addRoom(id,gltf);
  }finally{
   const r=createRoomResources();archive.forEach(root=>r.capture(root));r.dispose();
   if(!rooms.has(id)){
    if(gltf){gltf.scene.removeFromParent();r.capture(gltf.scene);}r.dispose({closeImages:true});
    if(id!=='hallway'&&id!=='private-hall'){structures.remove(id);refreshStructure();}
   }
  }
 }
 function cancel(){
  setActive(false);targets.clear();revision++;cancelAnimationFrame(frame);finish?.();finish=null;current=null;camera=null;
  access('',0);for(const id of [...rooms.keys()])unloadRoom(id,{releaseDen:false});renderer.clear();
 }
 async function moveAlong(destination,branch,reverse){
  const ticket=revision;
  const points=layout.routes[branch].map(p=>new THREE.Vector3(...p));
  if(branch==='den'){
   const eye=continuousDen.endpointCamera().position;
   // Back straight out of the den, then turn in the entry and cross hall.
   points.splice(1,points.length-1,new THREE.Vector3(5.55,1.65,7.55),new THREE.Vector3(5.55,1.65,eye.z),eye.clone());
  }
  const route=createRoute(points,{arrivalRadius:branch==='basement'?1.2:.45});
  const duration=reduced.matches?0:travelDuration(route,layout.views.hub,layout.views[branch],branch,reverse)*slowFactor,began=performance.now();
  await new Promise(resolve=>{
   finish=resolve;
   const step=now=>{
    if(ticket!==revision){resolve();return;}
    const t=duration?THREE.MathUtils.clamp((now-began)/duration,0,1):1,p=reverse?1-t:t;
    if(debugTravel){host.dataset.houseTravelBranch=branch;host.dataset.houseTravelProgress=p.toFixed(3);host.dataset.houseTravelReverse=String(reverse);}
    const pose=travelPose(route,p,layout.views.hub,layout.views[branch],branch,reverse);
    camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);
    // The den view stays fixed while backing through its door. Turn and settle
    // into the hub lens only after the camera has reached the cross hall.
    denProgress=branch==='den'?THREE.MathUtils.smoothstep(camera.position.z,8.0,8.7):0;
    if(!continuousDen||branch!=='den'){
     camera.matrixAutoUpdate=true;camera.scale.set(1,1,1);camera.zoom=1;
     const fit=fov=>2*Math.atan(Math.tan(fov*Math.PI/360)*Math.max(1,layout.aspect/camera.aspect))*180/Math.PI;
     camera.fov=THREE.MathUtils.lerp(fit(layout.views.hub.fov),fit(layout.views[branch].fov),THREE.MathUtils.smoothstep(p,.75,1));camera.updateProjectionMatrix();
    }
    if(continuousDen&&branch==='den'){
     const endpoint=continuousDen.endpointCamera();
     camera.matrixAutoUpdate=false;
     camera.matrix.copy(continuousDen.travelMatrix(pose,denProgress,1-THREE.MathUtils.smoothstep(camera.position.x,4.95,5.55)));
     camera.position.setFromMatrixPosition(camera.matrix);
     const hubFov=2*Math.atan(Math.tan(layout.fov*Math.PI/360)*Math.max(1,layout.aspect/camera.aspect))*180/Math.PI;
     camera.zoom=THREE.MathUtils.lerp(1,endpoint.zoom,denProgress);camera.fov=THREE.MathUtils.lerp(hubFov,endpoint.fov,denProgress);camera.updateProjectionMatrix();
     camera.projectionMatrix.elements[8]=endpoint.projectionMatrix.elements[8]*denProgress;camera.projectionMatrix.elements[9]=endpoint.projectionMatrix.elements[9]*denProgress;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    camera.matrixWorldNeedsUpdate=true;access(branch,p);render();
    captureBurstFrame(branch,t,reverse);
    if(t<1)frame=requestAnimationFrame(step);else{finish=null;resolve();}
   };frame=requestAnimationFrame(step);
  });
  if(ticket===revision){current=destination;camera.userData.explorationLens={fov:destination.view.fov,aspect:layout.aspect};}
 }
 async function travel(id,onReady=()=>{}){
  revealRevision++;setActive(false);targets.clear();const ticket=revision;await load();if(ticket!==revision)return;
  if(reduced.matches){
   // Release the old room before decoding its replacement, even for teleports.
   for(const room of [...rooms.keys()])if(room!==id)unloadRoom(room);
   if(id!=='den')unloadDen?.();
   current=null;camera=null;
   await ensureRoom(id,ticket);
   if(ticket!==revision)return;
   current=rooms.get(id);
   camera=id==='den'?continuousDen.endpointCamera():viewFor(id);
   denProgress=id==='den'?1:0;
   access(id==='hallway'?'':id,id==='hallway'?0:1);
   resize();onReady();return;
  }
  const initial=current?.id??(getDen?.()?.scene?'den':'hallway');
  await ensureRoom(initial,ticket);if(ticket!==revision)return;
  if(!current){current=rooms.get(initial);camera=continuousDen?continuousDen.endpointCamera():viewFor(initial);denProgress=continuousDen?1:0;resize();}
  if(initial===id){render();onReady();return;}
  await ensureRoom('hallway',ticket);if(ticket!==revision)return;
  render();onReady();
  if(initial!=='hallway'){
   await moveAlong(rooms.get('hallway'),initial,true);if(ticket!==revision)return;
   unloadRoom(initial);render();
  }
  // At the hall boundary there are no other rooms resident. Only now load
  // the next room, so travel never overlaps two non-hall rooms.
  if(id!=='hallway'){
   await ensureRoom(id,ticket);if(ticket!==revision)return;
   await moveAlong(rooms.get(id),id,false);if(ticket!==revision)return;
   unloadRoom('hallway');
  }
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
   world.add(cartridge);room.roots.push(cartridge);illustrateHouse([cartridge],{outlines:!debugParams.has('noHouseInk')});room.resources.capture(cartridge);
  }
  if(!valid())return null;scrap.mesh.visible=true;
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
  if(!valid()){scrap.mesh.visible=false;scrap.mesh.position.copy(start);if(cartridge)cartridge.visible=false;return null;}
  const point=end.project(camera);collected.add(id);scrap.mesh.visible=false;if(cartridge)cartridge.visible=false;render();
  return {x:(point.x+1)*50,y:(1-point.y)*50,cartridgeLabel:cartridge?.userData.labelImage};
 }
 async function benchmark({frames=90}={}){
  const waitFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const percentile=(values,p)=>values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
  const before=renderedFrames;await new Promise(resolve=>setTimeout(resolve,1000));
  const idleRenders=renderedFrames-before,submit=[],interval=[],updates=[],gpuComplete=[];
  const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;
  let previous=await waitFrame(),calls=0,triangles=0;
  try{
   for(let i=0;i<frames;i++){
    const now=await waitFrame();interval.push(now-previous);previous=now;
    let start=performance.now();current?.props?.update(1/60,reduced.matches);updates.push(performance.now()-start);
    renderer.info.reset();start=performance.now();render();submit.push(performance.now()-start);
    calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;
   }
   // A small separate sample includes GPU completion; this intentionally stalls.
   const gl=renderer.getContext();gl.finish();
   for(let i=0;i<8;i++){const start=performance.now();render();gl.finish();gpuComplete.push(performance.now()-start);}
  }finally{renderer.info.autoReset=autoReset;}
  const physics=current?.props?.physics,physicsTimes=[];
  if(physics){
   const saved=[...physics.items].map(([id,item])=>({id,pose:physics.pose(id),type:item.body.type,velocity:item.body.velocity.clone(),angular:item.body.angularVelocity.clone(),sleep:item.body.sleepState,releaseOnContact:item.releaseOnContact}));
   const probe=current.props.props.find(p=>p.mode==='throw');
   try{
    if(probe){physics.unpin(probe.id);physics.items.get(probe.id).body.velocity.set(.5,2,.3);
     for(let i=0;i<120;i++){const start=performance.now();physics.step(1/60);physicsTimes.push(performance.now()-start);}
    }
   }finally{
    for(const item of saved){
     if(item.type===4)physics.pin(item.id,item.pose,{releaseOnContact:item.releaseOnContact});
     else{physics.place(item.id,item.pose,item.sleep===2);physics.items.get(item.id).body.velocity.copy(item.velocity);physics.items.get(item.id).body.angularVelocity.copy(item.angular);}
    }
   }
  }
  return {room:current?.id,viewport:[renderer.domElement.width,renderer.domElement.height],props:current?.props?.props.length??0,
   bodies:physics?.world.bodies.length??0,awake:physics?[...physics.items.values()].filter(({body})=>body.type===1&&body.sleepState!==2).length:0,
   idleRenders,drawCalls:calls,triangles,submitMedianMs:+percentile(submit,.5).toFixed(2),submitP95Ms:+percentile(submit,.95).toFixed(2),
   throwPhysicsMedianMs:physicsTimes.length?+percentile(physicsTimes,.5).toFixed(2):0,throwPhysicsP95Ms:physicsTimes.length?+percentile(physicsTimes,.95).toFixed(2):0,
   updateMedianMs:+percentile(updates,.5).toFixed(3),frameMedianMs:+percentile(interval,.5).toFixed(2),
   completedMedianMs:+percentile(gpuComplete,.5).toFixed(2)};
 }
 return {load,travel,benchmark,capture(){render();return renderer.domElement.toDataURL('image/png');},depart:()=>travel('den'),resize,cancel,setActive,setInteractive:value=>input.setEnabled(value),revealScrap,cancelGrab:()=>input.cancel(),
  get props(){return current?.props?.props??[];},
  get fixedTargets(){
   const result=new Map();current?.model?.traverse(o=>{if(o.userData.hotspot)result.set(o.userData.hotspot,{root:o});});
   if(current?.id==='hallway')for(const [id,point] of Object.entries(layout.hub_targets)){
    const root=new THREE.Object3D();root.position.fromArray(point);root.updateMatrixWorld();
    // A small invisible target volume follows the actual door/hatch anchor.
    const box=new THREE.Mesh(targetGeometry,targetMaterial);box.scale.set(1,id==='attic'?.18:1.3,1);box.position.copy(root.position);box.updateMatrixWorld();result.set('door-'+id,{root:box,navigation:true});
   }
   return result;
  },
  bindTargets(value){targets=value;updateTargets();},activateProp(prop){input.activate(prop);},
  async dispose(){cancel();input.dispose();await loading?.catch(()=>{});await structures.dispose();const resources=createRoomResources();resources.capture(world);resources.dispose({closeImages:true});world.clear();connections=null;sky=null;loading=null;targetGeometry.dispose();targetMaterial.dispose();renderer.renderLists.dispose();saveFrame?.remove();saveBurst?.remove();}
 };
}
