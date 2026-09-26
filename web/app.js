import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {inSlot,playbackFile} from './interaction.js';
import {resolveRoute,writeGameUrl} from './routes.js';
import {CartridgePhysics,CARTRIDGE_DEPTH_SCALE} from './physics.js?v=archive-2';
import {prepareRoom,addCartridgeLighting,optimizeCartridge} from './room-renderer.js?v=crt-flicker-1';
import {createControllerCord} from './controller-cord.js?v=2';
import {remodelCartridge} from './cartridge-model.js?v=1';
import {SHELF_SLOTS,shuffled,RestTimer,ease,zoomPoint} from './library-behavior.js';
const $=id=>document.getElementById(id),room=$('room'),canvas=$('cartridges'),status=$('status'),screen=$('screen'),slot=$('slot'),tip=$('tooltip');
const say=text=>status.textContent=text;
let renderer,camera,scene,environment,physics,cord,roots=[],games,meta,drag=null,inserted=null,player=null,loadId=0,lastTime=0,dirty=true;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),intersection=new THREE.Vector3();
const motions=new Map(),restTimer=new RestTimer();
let baseScreen,baseSlot,audioContext;
const dockPose={position:{x:-.13,y:.94,z:1.17},quaternion:{x:0,y:0,z:0,w:1}};
const gameId=root=>root.userData.game_id||'controller';
const isCartridge=root=>root.userData.role==='draggable_cartridge';
function coords(e){const r=room.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
function setRay(e){const [x,y]=coords(e);pointer.set(x*2-1,1-y*2);ray.setFromCamera(pointer,camera);}
function pick(e){
 setRay(e);const hit=ray.intersectObjects(roots,true)[0];if(!hit)return null;
 // Furniture blocks selection as well as rendering: no grabbing through the TV.
 const wall=ray.intersectObject(environment.shell,false)[0];if(wall&&wall.distance<hit.distance-.008)return null;
 let root=hit.object;while(root&&!roots.includes(root))root=root.parent;
 return root?{root,point:hit.point}:null;
}
function syncObjects(){for(const root of roots){const pose=physics.pose(gameId(root));if(root.position.distanceToSquared(pose.position)>1e-10||Math.abs(root.quaternion.x-pose.quaternion.x)+Math.abs(root.quaternion.y-pose.quaternion.y)+Math.abs(root.quaternion.z-pose.quaternion.z)+Math.abs(root.quaternion.w-pose.quaternion.w)>1e-7)dirty=true;root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);}}
function showError(message){say(message);$('error').textContent=message;$('error').hidden=false;}
function unlockAudio(){try{audioContext ||= new AudioContext();audioContext.resume().catch(()=>{});}catch{}}
function clickIn(){
 if(!audioContext||audioContext.state!=='running')return;
 const t=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
 osc.type='square';osc.frequency.setValueAtTime(190,t);osc.frequency.exponentialRampToValueAtTime(65,t+.055);
 gain.gain.setValueAtTime(.035,t);gain.gain.exponentialRampToValueAtTime(.001,t+.065);
 osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+.07);
}
function cancelMotion(root){
 const motion=motions.get(root);if(!motion)return;
 motions.delete(root);physics.place(gameId(root),physics.pose(gameId(root)));motion.resolve(false);
}
function animate(root,poses,durations,kind,slotIndex=null){
 cancelMotion(root);restTimer.clear(gameId(root));
 return new Promise(resolve=>{const start=physics.pose(gameId(root));physics.pin(gameId(root),start);motions.set(root,{poses:[start,...poses],durations,elapsed:0,segment:0,kind,slotIndex,resolve});});
}
function updateMotions(dt){
 for(const [root,m] of motions){
  m.elapsed+=dt;const duration=m.durations[m.segment],t=Math.min(m.elapsed/duration,1),a=m.poses[m.segment],b=m.poses[m.segment+1];
  const position=new THREE.Vector3().copy(a.position).lerp(b.position,ease(t));
  const quaternion=new THREE.Quaternion().copy(a.quaternion).slerp(new THREE.Quaternion().copy(b.quaternion),ease(t));
  physics.pin(gameId(root),{position,quaternion});
  if(t<1)continue;
  m.elapsed=0;m.segment++;
  if(m.segment<m.durations.length)continue;
  motions.delete(root);
  if(m.kind==='return'){
   if(!shelfSlotFree(root,m.slotIndex)){
    const index=emptyShelfSlot(root),front={position:{...b.position,z:.85},quaternion:b.quaternion};
    if(index>=0){const target=SHELF_SLOTS[index];animate(root,[front,{position:{...target.position,z:.85},quaternion:target.quaternion},target],[.4,.7,.5],'return',index);}
    else animate(root,[front,SHELF_SLOTS[m.slotIndex]],[1,.5],'return',m.slotIndex);
    m.resolve(false);continue;
   }
   physics.place(gameId(root),b,true);physics.items.get(gameId(root)).supported=true;say(`${root.userData.title} returned to an empty bookshelf space.`);
  }
  m.resolve(true);
 }
}
function shelfSlotFree(root,index){
 if([...motions].some(([other,m])=>other!==root&&m.slotIndex===index))return false;
 const p=SHELF_SLOTS[index].position,box=new THREE.Box3(new THREE.Vector3(p.x-.057,p.y+.01,p.z-.26),new THREE.Vector3(p.x+.057,p.y+.455,p.z+.26));
 return !roots.some(other=>other!==root&&other!==inserted&&box.intersectsBox(new THREE.Box3().setFromObject(other)));
}
function emptyShelfSlot(root){return SHELF_SLOTS.findIndex((_,i)=>shelfSlotFree(root,i));}
function recoverCartridges(dt){
 for(const root of roots){
  if(!isCartridge(root))continue;
  const id=gameId(root),item=physics.items.get(id),body=item.body;
  const resting=body.sleepState===2||(body.velocity.length()<.07&&body.angularVelocity.length()<.15);
  if(!restTimer.update(id,dt,{resting,supported:item.supported,excluded:root===inserted||drag?.root===root||motions.has(root)}))continue;
  const index=emptyShelfSlot(root);if(index<0)continue;
  const destination=SHELF_SLOTS[index],start=physics.pose(id),q=destination.quaternion;
  say(`${root.userData.title} is returning to the bookshelf.`);
  // Lift clear of furniture, travel in front of the rack, then slide into a gap.
  animate(root,[{position:{x:start.position.x,y:2.55,z:2.9},quaternion:start.quaternion},
   {position:{x:destination.position.x,y:2.55,z:.85},quaternion:q},
   {position:{x:destination.position.x,y:destination.position.y,z:.85},quaternion:q},destination],[.9,1,.8,.55],'return',index);
 }
}
function updateZoom(dt){
 const target=inserted?1.32:1,next=camera.zoom+(target-camera.zoom)*(1-Math.exp(-dt/1.25));
 if(Math.abs(camera.zoom-target)<.0001)return;
 camera.zoom=Math.abs(next-target)<.0001?target:next;camera.updateProjectionMatrix();
 meta.screen=baseScreen.map(p=>zoomPoint(p,camera.zoom));meta.slot=zoomPoint(baseSlot,camera.zoom);
 slot.style.left=`${meta.slot[0]*100}%`;slot.style.top=`${meta.slot[1]*100}%`;slot.style.width=`${15*camera.zoom}%`;
 screenTransform();dirty=true;
}
function stop(){loadId++;for(const [root,m] of motions)if(m.kind==='dock')cancelMotion(root);if(player){try{player.ruffle().suspend();}catch{}player.remove();player=null;}screen.hidden=true;$('player').replaceChildren();environment?.setPlaying(false);dirty=true;canvas.style.pointerEvents='auto';}
function eject({updateUrl=true}={}){
 if(drag)finishDrag({pointerId:drag.id},true);
 if(updateUrl)writeGameUrl(null);document.title='Jiggmin — Midnight Den';
 if(!inserted)return;const old=inserted;inserted=null;stop();
 // Eject with a little upward motion, onto a clear foreground area of the table.
 physics.place(gameId(old),{position:{x:.6,y:1.1,z:2.04},quaternion:{x:0,y:0,z:0,w:1}});
 const body=physics.items.get(gameId(old)).body;body.velocity.set(.18,.8,.12);body.angularVelocity.set(-1.5,.4,.7);
 say(`${old.userData.title} ejected. Catch it, or pick another game.`);
}
async function insert(root,{updateUrl=true}={}){
 if(!root||!isCartridge(root))return;if(updateUrl)writeGameUrl(gameId(root));if(inserted===root)return;
 if(inserted)eject({updateUrl:false});else stop();
 inserted=root;$('error').hidden=true;
 const game=games.find(g=>g.id===gameId(root)),ticket=++loadId;
 const hover={position:{x:-.13,y:1.3,z:1.17},quaternion:dockPose.quaternion};
 const seated=await animate(root,[hover,{position:{...dockPose.position,y:1.01},quaternion:dockPose.quaternion},dockPose],[.6,.7,.18],'dock');
 if(!seated||ticket!==loadId||inserted!==root)return;
 clickIn();
 document.title=`${game.title} — Jiggmin`;say(`Loading ${game.title}…`);screen.hidden=false;environment.setPlaying(true);dirty=true;
 try{
  if(!window.RufflePlayer?.newest)throw new Error('The Flash player could not start. Refresh and try again.');
  player=window.RufflePlayer.newest().createPlayer();const active=player;$('player').append(active);
  await active.ruffle().load({url:new URL('/'+playbackFile(game),location.origin).href,autoplay:'on',unmuteOverlay:'visible',scale:'showAll',letterbox:'on',backgroundColor:'#000000',allowScriptAccess:false,logLevel:'error'});
  if(ticket!==loadId)return;
  say(`${game.title}${game.entryPointKind==='loader'?' — this game may need its original online services.':' — pull out its cartridge to stop.'}`);
 }catch(error){if(ticket!==loadId)return;showError(`Couldn’t load ${game.title}. ${error.message||'Try another cartridge.'}`);screen.hidden=true;environment.setPlaying(false);dirty=true;}
}
function finishDrag(e,cancel=false,interrupted=false){
 if(!drag||e.pointerId!==drag.id)return;
 const d=drag;drag=null;room.classList.remove('dragging','over-slot');tip.hidden=true;canvas.style.cursor='grab';
 if(canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);
 if(cancel){physics.cancel();syncObjects();if(d.wasInserted)insert(d.root,{updateUrl:false});else say(`${d.root.userData.title} returned to where you picked it up.`);return;}
 const velocity=performance.now()-d.lastMove>120?new THREE.Vector3():d.velocity;
 const body=physics.items.get(gameId(d.root)).body;
 const nearDock=new THREE.Vector3(body.position.x,body.position.y,body.position.z).distanceTo(new THREE.Vector3(-.13,1.25,1.17))<1;
 const [x,y]=interrupted?[-1,-1]:coords(e);
 const centered=Math.abs(x-meta.slot[0])<.045&&Math.abs(y-meta.slot[1])<.025;
 const shouldDock=isCartridge(d.root)&&inSlot(x,y,meta.slot)&&nearDock&&(velocity.length()<3||centered);
 physics.release(velocity);
 if(shouldDock){insert(d.root);return;}
 if(d.wasInserted){writeGameUrl(null);document.title='Jiggmin — Midnight Den';}
 say(`${d.root.userData.title} — ${velocity.length()>1.4?'nice throw.':isCartridge(d.root)?'place it gently in the slot to play.':'the cord keeps it within reach.'}`);
}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||drag||!physics)return;const hit=pick(e);if(!hit)return;e.preventDefault();
 const {root,point}=hit,wasInserted=root===inserted;
 unlockAudio();cancelMotion(root);restTimer.clear(gameId(root));
 if(wasInserted){inserted=null;stop();}
 physics.grab(gameId(root),point);
 const normal=camera.getWorldDirection(new THREE.Vector3());
 const gripPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(point.x,point.y,Math.max(point.z,1.65)));
 drag={root,id:e.pointerId,wasInserted,plane:gripPlane,normal,velocity:new THREE.Vector3(),lastPoint:point.clone(),lastMove:performance.now()};
 canvas.setPointerCapture(e.pointerId);room.classList.add('dragging');canvas.style.cursor='grabbing';tip.hidden=true;
 moveGrip(e,true);say(`Holding ${root.userData.title}. Flick to throw; scroll to move closer or farther.`);
});
function moveGrip(e,first=false){
 setRay(e);if(!ray.ray.intersectPlane(drag.plane,intersection))return;
 intersection.x=THREE.MathUtils.clamp(intersection.x,-3.6,3.8);intersection.y=THREE.MathUtils.clamp(intersection.y,.13,4.5);intersection.z=THREE.MathUtils.clamp(intersection.z,-1.7,4);
 const now=performance.now(),dt=Math.max((now-drag.lastMove)/1000,.008);
 if(!first){const speed=intersection.clone().sub(drag.lastPoint).divideScalar(dt);drag.velocity.lerp(speed,.45);if(drag.velocity.length()>8)drag.velocity.setLength(8);}
 drag.lastPoint.copy(intersection);drag.lastMove=now;physics.move(intersection);
 room.classList.toggle('over-slot',isCartridge(drag.root)&&inSlot(...coords(e),meta.slot));
}
room.addEventListener('pointermove',e=>{
 if(!physics)return;
 if(drag){if(e.pointerId===drag.id)moveGrip(e);return;}
 const hit=pick(e);canvas.style.cursor=hit?'grab':'default';tip.hidden=!hit;
 // Let ordinary mouse input reach Ruffle through the transparent CRT aperture.
 const onGlass=!screen.hidden&&!hit&&ray.intersectObject(environment.glass,false).length>0;
 canvas.style.pointerEvents=onGlass?'none':'auto';
 if(hit){tip.textContent=hit.root.userData.title;const [x,y]=coords(e);tip.style.left=`${Math.min(x*100,75)}%`;tip.style.top=`${Math.max(2,y*100-8)}%`;}
},{capture:true});
room.addEventListener('wheel',e=>{if(!drag)return;e.preventDefault();drag.plane.translate(drag.normal.clone().multiplyScalar(THREE.MathUtils.clamp(e.deltaY*.002,-.25,.25)));moveGrip(e,true);},{passive:false});
canvas.addEventListener('pointerup',e=>finishDrag(e));canvas.addEventListener('pointercancel',e=>finishDrag(e,false,true));canvas.addEventListener('lostpointercapture',e=>{if(drag)finishDrag(e,false,true);});
room.addEventListener('pointerleave',()=>{tip.hidden=true;if(!drag)canvas.style.pointerEvents='auto';});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag)finishDrag({pointerId:drag.id},true);});
window.addEventListener('blur',()=>{if(drag)finishDrag({pointerId:drag.id},false,true);});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden&&drag)finishDrag({pointerId:drag.id},false,true);});

function applyRoute(){
 if(!physics)return;if(drag)finishDrag({pointerId:drag.id},true);
 const route=resolveRoute(location.pathname,games);
 if(route.kind==='game'){insert(roots.find(r=>gameId(r)===route.game.id),{updateUrl:false});return;}
 eject({updateUrl:false});say(route.kind==='missing'?'That game isn’t in this collection. Pick a cartridge to play.':'Pick up a cartridge. Place it in the console—or give it a toss.');
}
window.addEventListener('popstate',applyRoute);
function screenTransform(){
 const w=room.clientWidth,h=room.clientHeight,points=meta.screen.map(([x,y])=>[x*w,y*h]);
 const width=640,height=640*Math.hypot(points[3][0]-points[0][0],points[3][1]-points[0][1])/Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]),src=[[0,0],[width,0],[width,height],[0,height]],a=[];
 for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=points[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
 for(let i=0;i<8;i++){let k=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[k][i]))k=j;[a[i],a[k]]=[a[k],a[i]];const t=a[i][i];for(let j=i;j<9;j++)a[i][j]/=t;for(let k=0;k<8;k++)if(k!==i){const t=a[k][i];for(let j=i;j<9;j++)a[k][j]-=t*a[i][j];}}
 const v=a.map(r=>r[8]);screen.style.width=`${width}px`;screen.style.height=`${height}px`;screen.style.transform=`matrix3d(${v[0]},${v[3]},0,${v[6]},${v[1]},${v[4]},0,${v[7]},0,0,1,0,${v[2]},${v[5]},0,1)`;
}
async function init(){
 const loader=new GLTFLoader();
 const json=async path=>{const r=await fetch(path);if(!r.ok)throw Error(`Could not load ${path}`);return r.json();};
 const [manifest,metadata,carts,roomModel,lighting,colliders,controllerModel]=await Promise.all([
  json('/data/games.json'),json('/web/assets/scene.json'),loader.loadAsync('/web/assets/cartridges.glb'),loader.loadAsync('/web/assets/room.glb?v=controller-1'),new THREE.TextureLoader().loadAsync('/web/assets/room-lighting.webp?v=controller-final'),json('/web/assets/colliders.json?v=controller-1'),loader.loadAsync('/web/assets/controller.glb?v=beveled')
 ]);
 games=manifest.games;meta=metadata;baseScreen=meta.screen.map(p=>[...p]);baseSlot=[...meta.slot];scene=new THREE.Scene();scene.add(carts.scene);camera=carts.cameras[0];camera.aspect=meta.cameraAspect;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 environment=prepareRoom(roomModel,camera,lighting);scene.add(environment.group);
 physics=new CartridgePhysics(colliders);
 carts.scene.traverse(o=>{
  if(o.userData.role==='draggable_cartridge')roots.push(o);
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
 });
 const tablePoses=roots.filter(r=>r.userData.storage==='table').map(r=>({position:r.position.clone(),quaternion:r.quaternion.clone()}));
 await Promise.all(roots.map(root=>remodelCartridge(root,games.find(g=>g.id===gameId(root)))));
 const order=shuffled(roots);
 for(let i=0;i<order.length;i++){
  const root=order[i];optimizeCartridge(root);root.scale.z*=CARTRIDGE_DEPTH_SCALE;
  const index=i-5,pose=i<5?tablePoses[i]:SHELF_SLOTS[(index%3)*9+Math.floor(index/3)];
  root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.userData.storage=i<5?'table':'rack';
  if(i<5)root.position.y+=.697-new THREE.Box3().setFromObject(root).min.y;
  physics.add(gameId(root),{position:root.position,quaternion:root.quaternion});
  physics.items.get(gameId(root)).supported=true;
 }
 scene.add(controllerModel.scene);
 let controller;
 controllerModel.scene.traverse(o=>{
  if(o.userData.role==='mobile_controller')controller=o;
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
 });
 if(!controller)throw Error('Controller model is missing');
 controller.userData.title='J/01 controller';roots.push(controller);
 physics.addController(gameId(controller),{position:controller.position,quaternion:controller.quaternion});
 cord=createControllerCord(controller);scene.add(cord.mesh);
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 addCartridgeLighting(scene,renderer);
 document.querySelector('.backdrop').hidden=true;
 slot.style.left=`${meta.slot[0]*100}%`;slot.style.top=`${meta.slot[1]*100}%`;
 new ResizeObserver(()=>{renderer.setSize(room.clientWidth,room.clientHeight,false);screenTransform();dirty=true;}).observe(room);

 renderer.setAnimationLoop(time=>{
  const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;lastTime=time;
  if(!document.hidden){physics.step(dt);updateMotions(dt);recoverCartridges(dt);syncObjects();updateZoom(dt);const flicker=environment.updateIdle(time/1000);if(dirty||drag||flicker){cord.update();renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=dirty||!!drag;renderer.render(scene,camera);dirty=false;}}
 });
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 applyRoute();
}
init().catch(error=>{console.error(error);showError(`The den couldn’t open. ${error.message}. Refresh to retry.`);});
