import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {inSlot,playbackFile} from './interaction.js?v=taller-slot-1';
import {resolveRoute,writeGameUrl} from './routes.js';
import {CartridgePhysics,CARTRIDGE_DEPTH_SCALE} from './physics.js?v=responsive-1';
import {prepareRoom,addCartridgeLighting,optimizeCartridge} from './room-renderer.js?v=detailed-den-1';
import {createControllerCord} from './controller-cord.js?v=2';
import {remodelCartridge} from './cartridge-model.js?v=screenprint-3';
import {SHELF_SLOTS,shuffled,RestTimer,ease} from './library-behavior.js?v=visibility-1';
import {UPPER_SLOTS,framing,captureSceneAnchors,composeCamera,projectWorld,createUpperShelf,cartridgeVisible} from './responsive-scene.js?v=controller-zoom-2';
import {createControllerDock} from './controller-dock.js';
import {detailController} from './controller-detail.js';
import {addSurfacePatina} from './surface-patina.js';
import {createMobileController} from './mobile-controller.js?v=profiles-2';
const $=id=>document.getElementById(id),room=$('room'),canvas=$('cartridges'),status=$('status'),screen=$('screen'),slot=$('slot'),tip=$('tooltip');
const say=text=>status.textContent=text;
let renderer,camera,scene,environment,physics,cord,roots=[],games,meta,drag=null,inserted=null,player=null,loadId=0,lastTime=0,dirty=true;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),intersection=new THREE.Vector3();
const motions=new Map(),restTimer=new RestTimer();
let anchors,baseCameraHeight,cameraDrop=0,audioContext,controller,upperShelf,upperBodies=[],upperMode=false,shelfSlots=SHELF_SLOTS,mobileControls;
let focusY=.41,visibilityTick=0,controllerDock=null;
const stored=new Map(),visibility=new Map();
const touchLayout=matchMedia('(max-width:900px), (pointer:coarse)');
const touchSurface=document.createElement('div');touchSurface.id='touch-screen';room.append(touchSurface);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const dockPose={position:{x:-.13,y:.94,z:1.17},quaternion:{x:0,y:0,z:0,w:1}};
const gameId=root=>root.userData.game_id||'controller';
const currentGame=()=>games?.find(g=>g.id===inserted?.userData.game_id);
const currentMode=()=>currentGame()?.gameplay.mode||'controller';
const isCartridge=root=>root.userData.role==='draggable_cartridge';
function coords(e){const r=room.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
function setRay(e){const [x,y]=coords(e);pointer.set(x*2-1,1-y*2);ray.setFromCamera(pointer,camera);}
function pick(e){
 setRay(e);const hit=ray.intersectObjects(roots.filter(r=>r.visible&&!(r===controller&&controllerDock?.active)),true)[0];if(!hit)return null;
 // Furniture blocks selection as well as rendering: no grabbing through the TV.
 const wall=ray.intersectObjects([...environment.occluders,...(upperMode?[upperShelf.group]:[])],true)[0];if(wall&&wall.distance<hit.distance-.008)return null;
 let root=hit.object;while(root&&!roots.includes(root))root=root.parent;
 return root?{root,point:hit.point}:null;
}
function pickProp(e){
 setRay(e);const hit=ray.intersectObjects(environment.props,false)[0];if(!hit)return null;
 const blockers=ray.intersectObjects([environment.shell,...roots.filter(r=>r.visible&&!(r===controller&&controllerDock?.active)),...(upperMode?[upperShelf.group]:[])],true);
 if(blockers[0]?.distance<hit.distance-.008)return null;
 return hit;
}
function syncObjects(){for(const root of roots){if(root===controller&&controllerDock?.active)continue;const pose=physics.pose(gameId(root));if(root.position.distanceToSquared(pose.position)>1e-10||Math.abs(root.quaternion.x-pose.quaternion.x)+Math.abs(root.quaternion.y-pose.quaternion.y)+Math.abs(root.quaternion.z-pose.quaternion.z)+Math.abs(root.quaternion.w-pose.quaternion.w)>1e-7)dirty=true;root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);}}
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
    if(index>=0){const target=shelfSlots[index];animate(root,[front,{position:{...target.position,z:.85},quaternion:target.quaternion},target],[.4,.7,.5],'return',index);}
    else animate(root,[front,shelfSlots[m.slotIndex]],[1,.5],'return',m.slotIndex);
    m.resolve(false);continue;
   }
   physics.place(gameId(root),b,true);stored.set(root,m.slotIndex);physics.items.get(gameId(root)).supported=true;say(`${root.userData.title} returned to an empty bookshelf space.`);
  }
  m.resolve(true);
 }
}
function shelfSlotFree(root,index){
 if([...motions].some(([other,m])=>other!==root&&m.slotIndex===index))return false;
 const p=shelfSlots[index].position,box=new THREE.Box3(new THREE.Vector3(p.x-.057,p.y+.01,p.z-.26),new THREE.Vector3(p.x+.057,p.y+.455,p.z+.26));
 return !roots.some(other=>other!==root&&other!==inserted&&box.intersectsBox(new THREE.Box3().setFromObject(other)));
}
function emptyShelfSlot(root){return shelfSlots.findIndex((_,i)=>shelfSlotFree(root,i));}
function recoverCartridges(dt){
 if(inserted)return;
 visibilityTick+=dt;const check=visibilityTick>=.2;if(check)visibilityTick=0;
 const occluders=[...environment.occluders,...(upperMode?[upperShelf.group]:[])];
 for(const root of roots){
  if(!isCartridge(root))continue;
  const id=gameId(root),item=physics.items.get(id),body=item.body;
  const resting=body.sleepState===2||(body.velocity.length()<.07&&body.angularVelocity.length()<.15);
  if(stored.has(root)){
   const home=shelfSlots[stored.get(root)].position;
   if(root.position.distanceTo(new THREE.Vector3().copy(home))<.10)continue;
   stored.delete(root);
  }
  if(check&&resting){
   const index=shelfSlots.findIndex(p=>root.position.distanceTo(new THREE.Vector3().copy(p.position))<.06&&Math.abs(root.quaternion.dot(new THREE.Quaternion().copy(p.quaternion)))>.98);
   if(index>=0){stored.set(root,index);restTimer.clear(id);continue;}
  }
  if(check)visibility.set(root,cartridgeVisible(root,camera,occluders));
  if(!restTimer.update(id,dt,{resting,visible:visibility.get(root)!==false,excluded:root===inserted||drag?.root===root||motions.has(root)}))continue;
  const index=emptyShelfSlot(root);if(index<0)continue;
  const destination=shelfSlots[index],start=physics.pose(id),q=destination.quaternion;
  say(`${root.userData.title} is returning to the bookshelf.`);
  // Travel in front of furniture before sliding into a free shelf space.
  const travelY=upperMode?Math.max(3.1,destination.position.y):2.55;
  animate(root,[{position:{x:start.position.x,y:travelY,z:2.9},quaternion:start.quaternion},
   {position:{x:destination.position.x,y:travelY,z:.85},quaternion:q},
   {position:{x:destination.position.x,y:destination.position.y,z:.85},quaternion:q},destination],[.9,1,.8,.55],'return',index);
 }
}
function setShelfLayout(upper){
 if(upper===upperMode)return;
 if(drag)finishDrag({pointerId:drag.id},false,true);
 for(const [root,m] of [...motions])if(m.kind==='return')cancelMotion(root);
 upperMode=upper;shelfSlots=upper?UPPER_SLOTS:SHELF_SLOTS;
 upperShelf.group.visible=upper;for(const body of upperBodies)body.collisionFilterMask=upper?-1:0;
 for(const [root,index] of stored){const pose=shelfSlots[index];physics.place(gameId(root),pose,true);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);}
 restTimer.elapsed.clear();visibility.clear();dirty=true;
}
function updateProjection(){
 composeCamera(camera,{aspect:room.clientWidth/room.clientHeight,zoom:camera.zoom,focusY,height:baseCameraHeight-cameraDrop},anchors.focus);
 meta.screen=anchors.screen.map(p=>projectWorld(p,camera));
 meta.slot=projectWorld(anchors.slot,camera);
 slot.style.left=`${meta.slot[0]*100}%`;slot.style.top=`${meta.slot[1]*100}%`;slot.style.width=`${15*camera.zoom*1.6/camera.aspect}%`;
 screenTransform();updateTouchSurface();dirty=true;
}
function updateZoom(dt,immediate=false){
 const target=framing(room.clientWidth/room.clientHeight,!!inserted,currentMode(),currentGame()?currentGame().embedWidth/currentGame().embedHeight:null,touchLayout.matches?room.clientHeight:0);setShelfLayout(target.upper);
 const blend=immediate||reducedMotion.matches?1:1-Math.exp(-dt/1.25);
 if(!immediate&&Math.abs(camera.zoom-target.zoom)+Math.abs(focusY-target.focusY)+Math.abs(cameraDrop-target.cameraDrop)<.00001)return;
 camera.zoom+=(target.zoom-camera.zoom)*blend;focusY+=(target.focusY-focusY)*blend;cameraDrop+=(target.cameraDrop-cameraDrop)*blend;updateProjection();
}
function updateTouchSurface(){
 const enabled=touchLayout.matches;
 touchSurface.style.pointerEvents=enabled?'auto':'none';canvas.style.pointerEvents=enabled?'none':'auto';
 if(enabled&&!screen.hidden&&!drag){
  const p=meta.screen.map(([x,y])=>`${x*100}% ${y*100}%`);
  touchSurface.style.clipPath=`polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${p[0]},${p[3]},${p[2]},${p[1]},${p[0]})`;
 }else touchSurface.style.clipPath='none';
 const raised=!!player&&!screen.hidden&&currentMode()==='controller';
 $('eject-game').hidden=!inserted||raised;
 controllerDock?.setRaised(raised);
 const glassBottom=Math.max(...meta.screen.map(p=>p[1]))*room.clientHeight;
 const panel=$('mobile-controller');
 if(enabled&&raised){
  const compact=room.clientWidth/room.clientHeight>1.38&&room.clientHeight<600;
  panel.style.setProperty('--pad-top',`${room.clientHeight-(compact?158:196)}px`);
  panel.style.setProperty('--pad-scale',compact?.8:1);
  panel.style.left='50%';panel.style.width='';return;
 }
 const desiredTop=Math.max(glassBottom+18,(meta.slot[1]+.09)*room.clientHeight);
 const top=Math.max(glassBottom+18,Math.min(desiredTop,room.clientHeight-200));
 const landscape=room.clientWidth/room.clientHeight>1.38&&room.clientHeight<600;
 const scale=landscape?.8:Math.min(1,Math.max(.25,(room.clientHeight-top-12)/178));
 panel.style.setProperty('--pad-top',`${landscape?room.clientHeight-156:top}px`);
 panel.style.setProperty('--pad-scale',scale);
 panel.style.left=landscape?`${room.clientWidth-154}px`:'50%';
 panel.style.width=landscape?'360px':'';
}
function stop(){mobileControls?.release();loadId++;for(const [root,m] of motions)if(m.kind==='dock')cancelMotion(root);if(player){try{player.ruffle?.().suspend();}catch{}player.remove();player=null;}screen.hidden=true;$('player').replaceChildren();environment?.setPlaying(false);dirty=true;updateTouchSurface();}
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
 stored.delete(root);inserted=root;$('error').hidden=true;
 // Stop automatic returns during play; interrupted carts settle naturally.
 for(const [cart,motion] of [...motions])if(motion.kind==='return')cancelMotion(cart);
 restTimer.elapsed.clear();visibility.clear();visibilityTick=0;
 const game=games.find(g=>g.id===gameId(root)),ticket=++loadId;
 screen.classList.toggle('broken',game.gameplay.mode==='broken');mobileControls.configure(game.gameplay.controller);updateTouchSurface();
 const hover={position:{x:-.13,y:1.3,z:1.17},quaternion:dockPose.quaternion};
 const seated=await animate(root,[hover,{position:{...dockPose.position,y:1.01},quaternion:dockPose.quaternion},dockPose],[.6,.7,.18],'dock');
 if(!seated||ticket!==loadId||inserted!==root)return;
 clickIn();
 document.title=`${game.title} — Jiggmin`;say(`Loading ${game.title}…`);screen.hidden=false;environment.setPlaying(true);dirty=true;
 try{
  if(game.playerType==='iframe'){
   player=document.createElement('iframe');player.title=game.title;player.src=game.embedUrl;
   player.allow='autoplay; fullscreen';player.allowFullscreen=true;
   $('player').append(player);updateTouchSurface();
   say(`${game.title} — live HTML5 game; eject to return to the den.`);
   return;
  }
  if(!window.RufflePlayer?.newest)throw new Error('The Flash player could not start. Refresh and try again.');
  player=window.RufflePlayer.newest().createPlayer();const active=player;$('player').append(active);updateTouchSurface();
  await active.ruffle().load({url:new URL('/'+playbackFile(game),location.origin).href,autoplay:'on',unmuteOverlay:'visible',scale:'showAll',letterbox:'on',backgroundColor:'#000000',allowScriptAccess:false,logLevel:'error'});
  if(ticket!==loadId)return;
  say(`${game.title}${game.entryPointKind==='loader'?' — this game may need its original online services.':' — eject or pull out its cartridge to stop.'}`);
 }catch(error){if(ticket!==loadId)return;showError(`Couldn’t load ${game.title}. ${error.message||'Try another cartridge.'}`);screen.hidden=game.gameplay.mode!=='broken';environment.setPlaying(!screen.hidden);updateTouchSurface();dirty=true;}
}
function finishDrag(e,cancel=false,interrupted=false){
 if(!drag||e.pointerId!==drag.id)return;
 const d=drag;drag=null;room.classList.remove('dragging','over-slot');tip.hidden=true;canvas.style.cursor='grab';
 if(d.surface.hasPointerCapture(d.id))d.surface.releasePointerCapture(d.id);
 updateTouchSurface();
 if(cancel){physics.cancel();syncObjects();if(d.wasInserted)insert(d.root,{updateUrl:false});else say(`${d.root.userData.title} returned to where you picked it up.`);return;}
 const velocity=performance.now()-d.lastMove>120?new THREE.Vector3():d.velocity;
 const body=physics.items.get(gameId(d.root)).body;
 const nearDock=new THREE.Vector3(body.position.x,body.position.y,body.position.z).distanceTo(new THREE.Vector3(-.13,1.25,1.17))<(touchLayout.matches?1.8:1);
 const [x,y]=interrupted?[-1,-1]:coords(e);
 const centered=Math.abs(x-meta.slot[0])<.045&&Math.abs(y-meta.slot[1])<.025;
 const shouldDock=isCartridge(d.root)&&inSlot(x,y,meta.slot)&&nearDock&&(velocity.length()<3||centered);
 physics.release(velocity);
 if(shouldDock){insert(d.root);return;}
 if(d.wasInserted){writeGameUrl(null);document.title='Jiggmin — Midnight Den';}
 say(`${d.root.userData.title} — ${velocity.length()>1.4?'nice throw.':isCartridge(d.root)?'place it gently in the slot to play.':'the cord keeps it within reach.'}`);
}
for(const surface of [canvas,touchSurface])surface.addEventListener('pointerdown',e=>{
 if(e.button!==0||drag||!physics)return;const hit=pick(e);
 if(!hit){const prop=pickProp(e);if(prop){e.preventDefault();environment.reactions.kick(prop.object,prop.point,reducedMotion.matches);say(`${prop.object.userData.title} — ${reducedMotion.matches?'hello there.':'a little nudge.'}`);dirty=true;}return;}
 e.preventDefault();
 const {root,point}=hit,wasInserted=root===inserted;
 unlockAudio();stored.delete(root);cancelMotion(root);restTimer.clear(gameId(root));
 if(wasInserted){inserted=null;stop();}
 physics.grab(gameId(root),point);
 const normal=camera.getWorldDirection(new THREE.Vector3());
 const gripPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(point.x,point.y,Math.max(point.z,1.65)));
 drag={root,surface,id:e.pointerId,wasInserted,plane:gripPlane,normal,velocity:new THREE.Vector3(),lastPoint:point.clone(),lastMove:performance.now()};
 surface.setPointerCapture(e.pointerId);updateTouchSurface();room.classList.add('dragging');canvas.style.cursor='grabbing';tip.hidden=true;
 moveGrip(e,true);say(`Holding ${root.userData.title}. Flick to throw; scroll to move closer or farther.`);
});
function moveGrip(e,first=false){
 setRay(e);if(!ray.ray.intersectPlane(drag.plane,intersection))return;
 intersection.x=THREE.MathUtils.clamp(intersection.x,-3.6,3.8);intersection.y=THREE.MathUtils.clamp(intersection.y,.13,4.5);intersection.z=THREE.MathUtils.clamp(intersection.z,-1.7,4);
 // Touch has no scroll wheel for depth. Guide the grip toward the physical
 // slot when the finger enters its projected target, including from the high rack.
 if(touchLayout.matches&&isCartridge(drag.root)&&inSlot(...coords(e),meta.slot))intersection.z=1.35;
 const now=performance.now(),dt=Math.max((now-drag.lastMove)/1000,.008);
 if(!first){const speed=intersection.clone().sub(drag.lastPoint).divideScalar(dt);drag.velocity.lerp(speed,.45);if(drag.velocity.length()>8)drag.velocity.setLength(8);}
 drag.lastPoint.copy(intersection);drag.lastMove=now;physics.move(intersection);
 room.classList.toggle('over-slot',isCartridge(drag.root)&&inSlot(...coords(e),meta.slot));
}
room.addEventListener('pointermove',e=>{
 if(!physics)return;
 if(drag){if(e.pointerId===drag.id)moveGrip(e);return;}
 const hit=pick(e),prop=!hit?pickProp(e):null;canvas.style.cursor=hit?'grab':prop?'pointer':'default';tip.hidden=!hit&&!prop;
 // Let ordinary mouse input reach Ruffle through the transparent CRT aperture.
 const onGlass=!screen.hidden&&!hit&&!prop&&ray.intersectObject(environment.glass,false).length>0;
 if(!touchLayout.matches)canvas.style.pointerEvents=onGlass?'none':'auto';
 if(hit||prop){tip.textContent=hit?hit.root.userData.title:`${prop.object.userData.title} · tap to nudge`;const [x,y]=coords(e);tip.style.left=`${Math.min(x*100,75)}%`;tip.style.top=`${Math.max(2,y*100-8)}%`;}
},{capture:true});
room.addEventListener('wheel',e=>{if(!drag)return;e.preventDefault();drag.plane.translate(drag.normal.clone().multiplyScalar(THREE.MathUtils.clamp(e.deltaY*.002,-.25,.25)));moveGrip(e,true);},{passive:false});
for(const surface of [canvas,touchSurface]){surface.addEventListener('pointerup',e=>finishDrag(e));surface.addEventListener('pointercancel',e=>finishDrag(e,false,true));surface.addEventListener('lostpointercapture',e=>{if(drag)finishDrag(e,false,true);});}
room.addEventListener('pointerleave',()=>{tip.hidden=true;if(!drag&&!touchLayout.matches)canvas.style.pointerEvents='auto';});
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
 const [manifest,metadata,carts,roomModel,lighting,colliders,controllerModel,propLighting,profiles]=await Promise.all([
  json('/data/games.json?v=screenprint-3'),json('/web/assets/scene.json'),loader.loadAsync('/web/assets/cartridges.glb'),loader.loadAsync('/web/assets/room.glb?v=detailed-den-1'),new THREE.TextureLoader().loadAsync('/web/assets/room-lighting.webp?v=detailed-den-1'),json('/web/assets/colliders.json?v=detailed-den-1'),loader.loadAsync('/web/assets/controller.glb?v=beveled'),new THREE.TextureLoader().loadAsync('/web/assets/room-props.webp?v=detailed-den-1'),json('/data/gameplay.json?v=bubble-racing-1')
 ]);
 games=manifest.games;for(const game of games){game.gameplay=profiles.games[game.id];if(!game.gameplay)throw Error(`Missing gameplay profile: ${game.id}`);}meta=metadata;scene=new THREE.Scene();scene.add(carts.scene);camera=carts.cameras[0];camera.aspect=meta.cameraAspect;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 anchors=captureSceneAnchors(camera,meta.screen,meta.slot);baseCameraHeight=camera.position.y;
 environment=prepareRoom(roomModel,camera,lighting,propLighting);scene.add(environment.group);
 physics=new CartridgePhysics(colliders);
 upperShelf=createUpperShelf();scene.add(upperShelf.group);upperShelf.group.visible=false;
 upperBodies=physics.addStatic(upperShelf.colliders);for(const b of upperBodies)b.collisionFilterMask=0;
 carts.scene.traverse(o=>{
  if(o.userData.role==='draggable_cartridge')roots.push(o);
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
 });
 // New catalog entries use the same runtime cartridge mold as the original GLB.
 for(const game of games)if(!roots.some(root=>gameId(root)===game.id)){
  const root=new THREE.Group();root.name=game.title;
  root.userData={role:'draggable_cartridge',game_id:game.id,title:game.title,storage:'rack'};
  scene.add(root);roots.push(root);
 }
 const tablePoses=roots.filter(r=>r.userData.storage==='table').map(r=>({position:r.position.clone(),quaternion:r.quaternion.clone()}));
 await Promise.all(roots.map(root=>remodelCartridge(root,games.find(g=>g.id===gameId(root)))));
 const order=shuffled(roots);
 for(let i=0;i<order.length;i++){
  const root=order[i];optimizeCartridge(root);root.scale.z*=CARTRIDGE_DEPTH_SCALE;
  const index=i-5,pose=i<5?tablePoses[i]:SHELF_SLOTS[(index%3)*9+Math.floor(index/3)];
  root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.userData.storage=i<5?'table':'rack';if(i>=5)stored.set(root,(index%3)*9+Math.floor(index/3));
  if(i<5){
   if(framing(room.clientWidth/room.clientHeight,false).upper){
    const [x,z]=[[-.87,1.8],[.87,1.8],[-.6,2.18],[0,2.18],[.6,2.18]][i];root.position.x=x;root.position.z=z;
   }
   root.position.y+=.697-new THREE.Box3().setFromObject(root).min.y;
  }
  physics.add(gameId(root),{position:root.position,quaternion:root.quaternion});
  physics.items.get(gameId(root)).supported=true;
 }
 scene.add(controllerModel.scene);

 controllerModel.scene.traverse(o=>{
  if(o.userData.role==='mobile_controller')controller=o;
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const mat of (Array.isArray(o.material)?o.material:[o.material]))addSurfacePatina(mat,{grain:.09,wear:.06});}
 });
 if(!controller)throw Error('Controller model is missing');
 detailController(controller);
 controller.userData.title='J/01 controller';roots.push(controller);
 physics.addController(gameId(controller),{position:controller.position,quaternion:controller.quaternion});
 cord=createControllerCord(controller);scene.add(cord.mesh);
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 addCartridgeLighting(scene,renderer);
 document.querySelector('.backdrop').hidden=true;
 slot.style.left=`${meta.slot[0]*100}%`;slot.style.top=`${meta.slot[1]*100}%`;
 mobileControls=createMobileController({getPlayer:()=>player,getAspect:()=>{const g=currentGame();return g?g.embedWidth/g.embedHeight:4/3;},onQuit:()=>eject(),onGesture:unlockAudio});
 controllerDock=createControllerDock({controller,physics,cord,camera,room,panel:$('mobile-controller'),controls:mobileControls,reducedMotion});
 $('eject-game').addEventListener('click',()=>eject());
 touchLayout.addEventListener('change',()=>{mobileControls.release();updateTouchSurface();});
 new ResizeObserver(()=>{tip.hidden=true;mobileControls.release();if(drag)finishDrag({pointerId:drag.id},false,true);renderer.setSize(room.clientWidth,room.clientHeight,false);updateZoom(0,true);}).observe(room);
 updateZoom(0,true);

 renderer.setAnimationLoop(time=>{
  const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;lastTime=time;
  if(!document.hidden){mobileControls.update(dt);physics.step(dt);updateMotions(dt);syncObjects();recoverCartridges(dt);updateZoom(dt);dirty=controllerDock.update(dt)||dirty;const flicker=environment.updateIdle(time/1000);dirty=environment.reactions.update(dt,reducedMotion.matches)||dirty;if(dirty||drag||flicker){cord.update();renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=dirty||!!drag;renderer.render(scene,camera);dirty=false;}}
 });
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 applyRoute();
}
init().catch(error=>{console.error(error);showError(`The den couldn’t open. ${error.message}. Refresh to retry.`);});
