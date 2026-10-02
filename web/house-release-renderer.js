import {fixtureAnchors,turnOffCeilingFixtures,refineRoomFixtures} from './house-fixture-refinements.js?v=fixture-refinement-3';
import {batchHouseMeshes} from './house-render-batches.js?v=prop-cleanup-1';
import {tidyHouseProps} from './house-prop-cleanup.js?v=prop-cleanup-1';
import {finishHallSurfaces} from './house-hall-finishes.js?v=hall-lighting-2';
import {applyHatchLighting} from './house-hatch-lighting.js?v=hatch-lighting-1';
import {replaceExteriorTrees} from './house-exterior-trees.js?v=house-reference-38';
import {hideExteriorGround} from './house-exterior-ground.js';
import {addBasementDetails,shadeBasementWindowSpills} from './basement-details.js';
// Production renderer for the approved, assembled house. Prop interaction and
// discovery behavior use the same modules as the original rooms.
import * as THREE from 'three';
import {GLTFLoader} from './model-loader.js';
import {createMoonlitWindows,createMoonlitSky,MOONLIT_SKY_URL,WINDOW_GLASS_LAYER} from './house-window-sky.js?v=panorama-dim-2';
import {createContinuousDen,integrateDenOpening} from './house-den-continuity.js?v=house-reference-30';
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
export function createHouseRenderer(host,{onActivate=()=>{},getDen,collected=new Set(),layoutURL='/web/assets/house/release/layout.json?v=prebake-refit-1'}={}) {
 const debugParams=new URLSearchParams(location.search),slowValue=debugParams.get('slowHouseTravel');
 // Slow motion must never encode PNGs during travel. Captures are manual only.
 const captureEnabled=debugParams.get('captureHouseTravel')==='1';
 const debugTravel=slowValue!==null||captureEnabled;
 const slowFactor=THREE.MathUtils.clamp(Number(slowValue)||1,1,20);
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.localClippingEnabled=true;
 renderer.shadowMap.enabled=false;
 renderer.domElement.className='house-canvas';host.prepend(renderer.domElement);
 const saveFrame=captureEnabled?document.createElement('button'):null;
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
     if(m.userData.ceiling_paint){
      // Preview the new paint using the existing baked illumination. The saved
      // Blender material supplies the actual reflectance for the final bake.
      const paint=new THREE.Color(...m.userData.ceiling_paint);
      material.onBeforeCompile=shader=>{shader.uniforms.ceilingPaint={value:paint};shader.fragmentShader='uniform vec3 ceilingPaint;\n'+shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*ceilingPaint*2.8;');};
      material.customProgramCacheKey=()=> 'cream-ceiling-reference-1';
     }
     return material;
    }
    if(m.transparent)o.castShadow=false;
    m.side=THREE.DoubleSide;return m;
   };
   o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });
 }
 function addRoom(id,gltf){
  tidyHouseProps(gltf.scene,id);materials(gltf.scene);world.add(gltf.scene);
  if(id==='basement'){
   const assembly=gltf.scene.getObjectByName('Refitted_basement_assembly')??gltf.scene.getObjectByName('Original_basement_assembly'),matrix=assembly.matrix.clone();
   assembly.matrix.identity();assembly.matrix.decompose(assembly.position,assembly.quaternion,assembly.scale);assembly.updateMatrixWorld(true);
   const details=addBasementDetails(gltf.scene);if(details.drain)details.drain.position.set(1.86,.009,.108);
   assembly.matrix.copy(matrix);matrix.decompose(assembly.position,assembly.quaternion,assembly.scale);assembly.updateMatrixWorld(true);
  }
  if(id==='basement')for(const cartridge of createBasementCartridges(getDen?.()?.basementCartridges??[])){
   cartridge.position.add(new THREE.Vector3(6.53,-4,3.29));gltf.scene.add(cartridge);
  }
  refineRoomFixtures(gltf.scene,id,{structure:connections.group,...connections.fixtureAnchors});
  const resources=createRoomResources();resources.capture(gltf.scene);const view=viewFor(id);
  const props=id==='den'||id==='private-hall'?{props:[],cancel(){},update(){return {};}}:createHouseProps(gltf.scene,world,{floorY:id==='basement'?-4:id==='attic'?2.8:0,roomBounds:id==='workshop'?[12,0,17,7]:id==='hallway'?[4.8,6.8,12,12]:[0,0,12,12],structureColliders:connections.structureColliders});
  const windows=id==='basement'?createMoonlitWindows(gltf.scene,sky,view.position):null;
  if(windows){world.add(windows.exterior);shadeBasementWindowSpills(gltf.scene,windows.frames);}
  const scraps=createHiddenScraps(props.props,view,world,collected);
  const roots=[gltf.scene,...(windows?[windows.exterior]:[]),...props.props.map(p=>p.root),...Array.from(scraps.values(),s=>s.mesh)];illustrateHouse(roots);roots.forEach(root=>resources.capture(root));
  assignRoomLighting(roots,id==='private-hall'?'hallway':id);
  if(!debugParams.has('unbatched')){batchHouseMeshes(gltf.scene,{staticCells:true});for(const prop of props.props)batchHouseMeshes(prop.root);}
  roots.forEach(root=>resources.capture(root));
  windows?.glass.forEach(mesh=>mesh.layers.set(WINDOW_GLASS_LAYER));
  rooms.set(id,{id,scene:world,resources,roots,model:gltf.scene,view,doors:new Map(),props,scraps,pickRoots:[connections.group,gltf.scene,...props.props.map(p=>p.root)]});
 }
 function unloadRoom(id){
  const room=rooms.get(id);if(!room)return;
  if(id==='den'){continuousDen.scene.removeFromParent();continuousDen.resources.dispose();continuousDen=null;rooms.delete(id);return;}
  room.props.cancel();room.roots.forEach(root=>root.removeFromParent());room.resources.dispose();rooms.delete(id);renderer.renderLists.dispose();
 }
 async function load(){
  if(!loading)loading=(async()=>{
   const response=await fetch(layoutURL,{cache:'no-cache'});if(!response.ok)throw Error('House layout unavailable');layout=await response.json();
   const gltf=await loader.loadAsync(debugParams.get('hallwayStyle')==='illustrated'?'/web/assets/house/hallway-style/structure.glb':debugParams.get('hallwayInk')==='transfer'?'/web/assets/house/hallway-ink/structure.glb':roomAsset('structure'));
   if(layout.fixedFixtures){const fixtures=await loader.loadAsync(layout.fixedFixtures);gltf.scene.add(fixtures.scene);}
   if(layout.hatchLighting){const reference=await loader.loadAsync(layout.hatchLighting);applyHatchLighting(gltf.scene,reference.scene);}
   integrateDenOpening(gltf.scene);materials(gltf.scene);
   const anchors=fixtureAnchors(gltf.scene);turnOffCeilingFixtures(gltf.scene);
   finishHallSurfaces(gltf.scene);replaceExteriorTrees(gltf.scene);hideExteriorGround(gltf.scene);
   const structureColliders=collectHouseStructureColliders(gltf.scene);
   illustrateHouse([gltf.scene]);
   if(!debugParams.has('unbatched'))batchHouseMeshes(gltf.scene,{staticCells:true});
   sky=await new THREE.TextureLoader().loadAsync(MOONLIT_SKY_URL);gltf.scene.add(createMoonlitSky(sky));
   const resources=createRoomResources();resources.capture(gltf.scene);world.add(gltf.scene);
   let denFloorReference;
   if(layout.denFloorReference){
    const reference=await loader.loadAsync(layout.denFloorReference);resources.capture(reference.scene);
    reference.scene.traverse(o=>{if(o.isMesh&&o.material.map)denFloorReference=o.material;});
   }
   const mechanisms=[];gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(o=>{if(!o.isMesh||!['door','ladder'].includes(o.userData.preview_kind))return;
    o.updateMatrix();mechanisms.push({mesh:o,rest:o.matrix.clone()});o.matrixAutoUpdate=false;
   });
   const lights=[];
   for(const l of layout.lights??[]){const light=new THREE.PointLight(new THREE.Color(...l.color),l.intensity,8,2);light.position.fromArray(l.position);world.add(light);lights.push(light);}
   let floorMaterial=denFloorReference;gltf.scene.traverse(o=>{if(!floorMaterial&&o.isMesh&&o.userData.preview_kind==='floor'&&o.material.name==='oak.001')floorMaterial=o.material;});
   connections={group:gltf.scene,resources,mechanisms,lights,floorMaterial,fixtureAnchors:anchors,structureColliders};access('',0);
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
  if(id==='den'){
   const source=getDen?.();if(!source?.scene||!source.camera)throw Error('The live den must be ready before house travel');
   continuousDen=createContinuousDen(source,{floorMaterial:connections.floorMaterial});world.add(continuousDen.scene);rooms.set(id,{id,view:continuousDen.endpointCamera()});return;
  }
  const gltf=id==='private-hall'?{scene:new THREE.Group()}:await loader.loadAsync(id==='hallway'&&debugParams.get('hallwayStyle')==='illustrated'?'/web/assets/house/hallway-style/hallway.glb':id==='hallway'&&debugParams.get('hallwayInk')==='transfer'?'/web/assets/house/hallway-ink/hallway.glb':roomAsset(id));
  if(ticket!==revision){const r=createRoomResources();r.capture(gltf.scene);r.dispose();return;}
  addRoom(id,gltf);
 }
 function cancel(){
  setActive(false);targets.clear();revision++;cancelAnimationFrame(frame);finish?.();finish=null;current=null;camera=null;
  access('',0);for(const id of [...rooms.keys()])unloadRoom(id);renderer.clear();
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
    if(t<1)frame=requestAnimationFrame(step);else{finish=null;resolve();}
   };frame=requestAnimationFrame(step);
  });
  if(ticket===revision){current=destination;camera.userData.explorationLens={fov:destination.view.fov,aspect:layout.aspect};}
 }
 async function travel(id,onReady=()=>{}){
  revealRevision++;setActive(false);targets.clear();const ticket=revision;await load();if(ticket!==revision)return;
  // Load both ends and the connecting hall only for the duration of travel.
  const initial=current?.id??(getDen?.()?.scene?'den':'hallway');
  const needed=new Set(initial===id?[id]:['hallway',id,initial]);
  await Promise.all([...needed].map(room=>ensureRoom(room,ticket)));
  if(ticket!==revision)return;
  if(!current){current=rooms.get(initial);camera=continuousDen?continuousDen.endpointCamera():viewFor(initial);denProgress=continuousDen?1:0;resize();}
  render();onReady();
  const from=current.id,destination=rooms.get(id);
  if(from===id){render();return;}
  if(from!=='hallway'&&id!=='hallway'){await moveAlong(rooms.get('hallway'),from,true);if(ticket!==revision)return;}
  if(id==='hallway')await moveAlong(destination,from,true);
  else await moveAlong(destination,id,false);
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
   world.add(cartridge);room.roots.push(cartridge);illustrateHouse([cartridge]);room.resources.capture(cartridge);
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
  dispose(){cancel();input.dispose();connections?.resources?.dispose();const resources=createRoomResources();resources.capture(world);resources.dispose();targetGeometry.dispose();targetMaterial.dispose();renderer.dispose();renderer.domElement.remove();saveFrame?.remove();}
 };
}
