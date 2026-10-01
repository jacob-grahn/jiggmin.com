import {doorMotion,ladderMotion} from './access-animation.js';
import {travelPose,travelDuration} from './travel-camera.js';
import {createFreeCamera,cameraReadout} from './free-camera.js';
import * as THREE from 'three';
import {GLTFLoader} from '/web/vendor/three/GLTFLoader.js';
import {OrbitControls} from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import {createRoute} from '/web/house-layout.js';
import {accelerateRaycasts} from '/web/raycast-acceleration.js';
import {resizeHouseCamera} from '/web/house-camera.js';
const $=id=>document.getElementById(id),world=new THREE.Scene();world.background=new THREE.Color('#80929c');
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
world.add(new THREE.HemisphereLight(0xddeaff,0x72614c,2));const sun=new THREE.DirectionalLight(0xfff2dd,2.2);sun.position.set(-5,18,12);world.add(sun);
const camera=new THREE.PerspectiveCamera(50,1.6,.035,250);const orbit=new OrbitControls(camera,renderer.domElement);orbit.enabled=false;orbit.addEventListener('change',()=>{if(orbit.enabled)draw();});
const ray=new THREE.Raycaster(),loader=new GLTFLoader();let model,metadata,meshes=[],route,activeId='workshop',progress=0,playing=false,direction=1,lastTime,signature='',loading=false,overview=false,doorsOpen=[],lastAudit=0,animationFrame;
const free=createFreeCamera(camera,$('canvas'),draw,()=>{setFree(false);draw();});
function setFree(enabled){lastAudit=0;free.enabled=enabled;$('freemove').setAttribute('aria-pressed',String(enabled));$('camera-hud').hidden=!enabled;}
const pathGroup=new THREE.Group(),lightGroup=new THREE.Group();world.add(pathGroup,lightGroup);const baseMats=new Map();const highlight=new THREE.MeshStandardMaterial({color:0xdba348,roughness:1,side:THREE.DoubleSide});
const targetButtons=new Map();for(const [id,label]of Object.entries({workshop:'Workbench',basement:'Basement',attic:'Attic'})){const b=document.createElement('button');b.className='target';b.textContent=label;b.onclick=()=>start(id,1);$('targets').append(b);targetButtons.set(id,b);}
function pose(id){const v=metadata.views[id];return {position:new THREE.Vector3(...v.position),quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(...v.position),new THREE.Vector3(...v.target),new THREE.Vector3(0,1,0)))};}
function setRoute(id){activeId=id;$('destination').value=id;const pts=metadata.routes[id].map(p=>new THREE.Vector3(...p));pts[0].copy(pose('hub').position);pts[pts.length-1].copy(pose(id).position);route=createRoute(pts);}
function updateVisibility(){
 doorsOpen=progress>0?({workshop:['mudroom','garage'],basement:['stairs'],attic:['attic'],den:['den'],'private-hall':[]}[activeId]??[]):[];
 for(const m of meshes){const k=m.userData.preview_kind;let visible=true;if(k==='contents')visible=$('contents').checked;if(['roof','ceiling'].includes(k))visible=$('ceiling').checked;if(k==='door'){visible=$('doors').checked;m.matrix.copy(doorMotion(m.userData.door_id,doorsOpen.includes(m.userData.door_id)?progress:0)).multiply(m.userData.restMatrix);m.matrixWorldNeedsUpdate=true;}if(k==='ladder'){visible=activeId==='attic'&&progress>.06;m.matrix.copy(ladderMotion(m.userData.ladder_section??2,progress)).multiply(m.userData.restMatrix);m.matrixWorldNeedsUpdate=true;}m.visible=visible;m.material=$('unfinished').checked&&['shell','roof','ceiling'].includes(k)?highlight:baseMats.get(m);}
 pathGroup.visible=$('paths').checked;
}
function applyProgress(){if(!metadata)return;setFree(false);overview=false;orbit.enabled=false;const view=travelPose(route,progress,metadata.views.hub,metadata.views[activeId],activeId,direction<0);camera.position.copy(view.position);camera.quaternion.copy(view.quaternion);$('progress').value=progress;$('percent').value=`${Math.round(progress*100)}%`;updateVisibility();draw();}
function start(id,dir){if(!metadata)return;stop();if(id!==activeId)progress=0;setRoute(id);direction=dir;if(dir===1&&progress>=1)progress=0;if(dir===-1&&progress<=0)progress=1;playing=true;lastTime=performance.now();$('travel').textContent='Pause';applyProgress();animationFrame=requestAnimationFrame(tick);}
function tick(now){if(!playing)return;const duration=travelDuration(route,metadata.views.hub,metadata.views[activeId],activeId,direction<0);progress=THREE.MathUtils.clamp(progress+Math.max(0,now-lastTime)/duration*Number($('speed').value)*direction,0,1);lastTime=now;applyProgress();if((direction>0&&progress===1)||(direction<0&&progress===0))stop();else animationFrame=requestAnimationFrame(tick);}
function stop(){playing=false;cancelAnimationFrame(animationFrame);$('travel').textContent='Travel';}
function hub(){stop();progress=0;direction=1;applyProgress();}
function resize(){const stage=$('stage'),mode=$('viewport').value;const [w,h]=mode==='auto'?[Math.max(320,innerWidth-52),Math.max(280,innerHeight-345)]:mode.split(',').map(Number);stage.style.width=`${w}px`;stage.style.aspectRatio=`${w}/${h}`;const rect=stage.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.userData.explorationLens={fov:metadata?.views.hub.fov??50,aspect:1.6};camera.fov=camera.userData.explorationLens.fov;if($('lens').value==='production')resizeHouseCamera(camera,rect.width/rect.height);else{camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}$('dimensions').textContent=`${Math.round(rect.width)} × ${Math.round(rect.height)} displayed · vertical FOV ${camera.fov.toFixed(1)}°`;draw();}
function blockers(){return meshes.filter(m=>m.visible&&!['site','ladder'].includes(m.userData.preview_kind));}
function unobstructed(target,id){const from=camera.position,delta=target.clone().sub(from),length=delta.length();ray.set(from,delta.normalize());ray.near=.04;ray.far=Math.max(.04,length-.13);const hits=ray.intersectObjects(blockers(),false);return !hits.some(h=>h.object.userData.door_id!==({workshop:'mudroom',basement:'stairs',attic:'attic'}[id]));}
function audit(){
 if(!metadata)return;camera.updateMatrixWorld();world.updateMatrixWorld(true);const rect=$('stage').getBoundingClientRect(),labels=[];
 for(const [id,point]of Object.entries(metadata.hub_targets)){
  const p=new THREE.Vector3(...point),projected=p.clone().project(camera),inside=Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z>-1&&projected.z<1;const samples=id==='attic'?[-.3,0,.3].map(dx=>p.clone().add(new THREE.Vector3(dx,-.02,.22))):[-.25,0,.25].map(dx=>p.clone().add(new THREE.Vector3(dx,0,id==='workshop'?.075:-.075)));const visibleSamples=inside?samples.filter(q=>unobstructed(q,id)).length:0;const clear=visibleSamples>0;const b=targetButtons.get(id);b.hidden=free.enabled||overview||progress>.005||!clear;b.style.left=`${(projected.x+1)/2*rect.width}px`;b.style.top=`${(1-projected.y)/2*rect.height}px`;
  if(!overview&&progress<.005)labels.push(`<span class="metric ${clear?'':'bad'}">${id}: ${!inside?'out of frame':clear?`visible (${visibleSamples}/3 samples)`:'occluded'}</span>`);
 }
 $('left').hidden=$('right').hidden=free.enabled||overview||progress>.005;
 // Camera clearance against actual triangles, rather than room envelope assumptions.
 let near=Infinity;for(const axis of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){ray.set(camera.position,new THREE.Vector3(...axis));ray.near=0;ray.far=.18;const hit=ray.intersectObjects(blockers(),false)[0];if(hit)near=Math.min(near,hit.distance);}
 if(near<.18)labels.push(`<span class="metric bad">Camera within ${Math.round(near*100)} cm of geometry</span>`);
 $('visibility').innerHTML=labels.join('');
}
function draw(){if(!metadata)return;renderer.render(world,camera);if(free.enabled)$('camera-pose').textContent=cameraReadout(camera);if((!playing&&!free.enabled)||performance.now()-lastAudit>180){audit();lastAudit=performance.now();}}
function dispose(root){const materials=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});const textures=new Set();materials.forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());}
async function load(force=false){
 if(loading)return;loading=true;try{const response=await fetch(`generated/preview.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error('Run npm run preview:house:build first.');const next=await response.json(),sig=JSON.stringify(next);if(sig===signature&&!force)return;
 const gltf=await loader.loadAsync(`generated/house.glb?t=${Date.now()}`);stop();if(model){world.remove(model);dispose(model);}model=gltf.scene;metadata=next;signature=sig;world.add(model);meshes=[];baseMats.clear();model.traverse(o=>{if(!o.isMesh)return;for(let parent=o;parent;parent=parent.parent)if(parent.userData.preview_kind){Object.assign(o.userData,parent.userData);break;}if(['door','ladder'].includes(o.userData.preview_kind)){o.updateMatrix();o.userData.restMatrix=o.matrix.clone();o.matrixAutoUpdate=false;}meshes.push(o);baseMats.set(o,o.material);for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=THREE.DoubleSide;});
 accelerateRaycasts(meshes);ray.firstHitOnly=true;lightGroup.clear();for(const l of metadata.lights??[]){const light=new THREE.PointLight(new THREE.Color(...l.color),l.intensity,8,2);light.position.fromArray(l.position);lightGroup.add(light);}
 while(pathGroup.children.length){const line=pathGroup.children[0];pathGroup.remove(line);dispose(line);}for(const [id,pts]of Object.entries(metadata.routes)){const curve=createRoute(pts.map(p=>new THREE.Vector3(...p)));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(150)),new THREE.LineBasicMaterial({color:id==='attic'?0xf2cb66:0x8de5c2,depthTest:false}));line.renderOrder=2;pathGroup.add(line);}
 setRoute(activeId);resize();if(free.enabled){updateVisibility();draw();}else applyProgress();const e=metadata.export;$('status').textContent=`Export ${e.seconds}s · ${(e.bytes/1048576).toFixed(1)} MB · ${e.triangles.toLocaleString()} triangles · ${e.mesh_batches} batches. Native scene: house-plan-preview.blend`;
 }catch(error){$('status').textContent=`Preview unavailable: ${error.message}`;console.error(error);}finally{loading=false;}}
$('travel').onclick=()=>{if(playing)stop();else start($('destination').value,1);};$('back').onclick=()=>{stop();start(activeId,-1);};$('hub').onclick=hub;
$('left').onclick=()=>{hub();start('private-hall',1);};$('right').onclick=()=>{hub();start('den',1);};$('destination').onchange=()=>{stop();progress=0;direction=1;setRoute($('destination').value);applyProgress();};$('progress').oninput=()=>{stop();progress=Number($('progress').value);applyProgress();};
$('freemove').onclick=()=>{if(!metadata)return;stop();overview=false;orbit.enabled=false;setFree(!free.enabled);draw();};
$('overview').onclick=()=>{if(!metadata)return;stop();setFree(false);overview=true;const v=pose('overview');camera.position.copy(v.position);camera.quaternion.copy(v.quaternion);orbit.target.fromArray(metadata.views.overview.target);orbit.enabled=true;orbit.update();draw();};
for(const id of ['contents','ceiling','doors','unfinished','paths'])$(id).onchange=()=>{updateVisibility();draw();};for(const id of ['viewport','lens'])$(id).onchange=resize;
$('reload').onclick=()=>load(true);$('capture').onclick=()=>{draw();const a=document.createElement('a');a.download=`house-${free.enabled?'free':overview?'overview':activeId}-${Math.round(progress*100)}.png`;a.href=renderer.domElement.toDataURL();a.click();};
new ResizeObserver(resize).observe(document.querySelector('main'));window.addEventListener('resize',resize);setInterval(()=>{if($('autoreload').checked&&!playing&&!document.hidden)load();},2500);
load();
