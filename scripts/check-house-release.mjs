// Optional check of the actual Blender export, including edits made after generation.
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {accelerateRaycasts} from '../web/raycast-acceleration.js';
import {createRoute} from '../web/house-layout.js';
import {DEN_SOURCE_TO_WORLD} from '../web/house-den-continuity.js';
import {travelPose} from '../web/house-travel.js';
import {doorMotion,ladderMotion} from '../web/house-access.js';
const dir=process.env.HOUSE_RELEASE_DIR??'web/assets/house/release';
const meta=JSON.parse(fs.readFileSync(`${dir}/layout.json`));
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(t,v){Object.assign(this,v);}};
const scene=new THREE.Group();
for(const room of Object.keys(meta.assets)){
 const liveDen=room==='den'&&meta.style==='original';
 const bytes=fs.readFileSync(liveDen?'web/assets/room.glb':`${dir}/${room}.glb`),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 delete json.images;delete json.textures;delete json.extensionsRequired;delete json.extensionsUsed;json.materials=[];for(const m of json.meshes)for(const p of m.primitives)delete p.material;
 const model=await new GLTFLoader().parseAsync(JSON.stringify(json),'');scene.add(model.scene);
 if(liveDen){model.scene.applyMatrix4(DEN_SOURCE_TO_WORLD);model.scene.traverse(o=>{if(o.isMesh)o.userData.preview_kind=o.userData.role==='room_geometry'?'shell':'contents';});}
 model.scene.traverse(o=>{let p=o;while(p&&!p.userData.preview_kind)p=p.parent;if(p)Object.assign(o.userData,p.userData);});
}
scene.updateMatrixWorld(true);const gltf={scene};
const shells=[],contents=[],mechanisms=[];gltf.scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=THREE.DoubleSide;if(['shell','floor','ceiling','roof','stair'].includes(o.userData.preview_kind))shells.push(o);if(o.userData.preview_kind==='contents')contents.push(o);if(['door','ladder'].includes(o.userData.preview_kind)){o.updateMatrix();o.userData.restMatrix=o.matrix.clone();o.matrixAutoUpdate=false;mechanisms.push(o);}});accelerateRaycasts([...shells,...contents,...mechanisms]);
const report={export:meta.export,routes:{},viewport_targets:{}};let failures=0;
for(const [id,points]of Object.entries(meta.routes))for(const reverse of [false,true]){
 const route=createRoute(points.map(p=>new THREE.Vector3(...p))),hits=new Set(),propHits=new Set(),accessHits=new Set(),clearanceHits=new Set();let previous=route.getPoint(reverse?1:0);
 for(let i=1;i<=800;i++){
  const progress=reverse?1-i/800:i/800,opened=({workshop:['mudroom','garage'],basement:['stairs'],attic:['attic'],den:['den'],'private-hall':[]}[id]);
  for(const o of mechanisms){o.matrix.copy(o.userData.preview_kind==='door'?doorMotion(o.userData.door_id,opened.includes(o.userData.door_id)?progress:0):ladderMotion(o.userData.ladder_section??2,progress)).multiply(o.userData.restMatrix);o.updateMatrixWorld(true);}
  const p=travelPose(route,progress,meta.views.hub,meta.views[id],id,reverse).position,delta=p.clone().sub(previous),ray=new THREE.Raycaster(previous,delta.clone().normalize(),.00001,delta.length());ray.firstHitOnly=true;
  for(const hit of ray.intersectObjects(shells,false))hits.add(`${hit.object.name} @ ${(i/8).toFixed(1)}%`);
  for(const hit of ray.intersectObjects(contents,false))propHits.add(`${hit.object.name} @ ${(i/8).toFixed(1)}%`);
  for(const hit of ray.intersectObjects(mechanisms.filter(o=>o.userData.preview_kind==='door'||(id==='attic'&&progress>.06)),false))accessHits.add(`${hit.object.name} @ ${(i/8).toFixed(1)}%`);
  if(i%4===0){
   // Sample a 44 cm wide walking envelope below the eye, plus head clearance.
   for(const height of [0,-.65,-1.30])for(let angle=0;angle<8;angle++){
    const origin=p.clone().add(new THREE.Vector3(0,height,0)),d=new THREE.Vector3(Math.cos(angle*Math.PI/4),0,Math.sin(angle*Math.PI/4));const probe=new THREE.Raycaster(origin,d,.001,.22);probe.firstHitOnly=true;
    const hit=probe.intersectObjects(shells,false)[0];if(hit)clearanceHits.add(`${hit.object.name} @ ${(i/8).toFixed(1)}%`);
   }
   const probe=new THREE.Raycaster(p,new THREE.Vector3(0,1,0),.001,.16);probe.firstHitOnly=true;const hit=probe.intersectObjects(shells,false)[0];if(hit)clearanceHits.add(`${hit.object.name} head @ ${(i/8).toFixed(1)}%`);
  }
  previous=p;
 }
 const result={structural_crossings:[...hits],contents_crossings:[...propHits],animated_access_crossings:[...accessHits],body_clearance_warnings:[...clearanceHits]};
 if(reverse)report.routes[id].return=result;else report.routes[id]=result;failures+=hits.size+propHits.size+accessHits.size+clearanceHits.size;
}
for(const [label,aspect]of [['16:10',1.6],['16:9',16/9],['4:3',4/3],['portrait',390/844]]){
 const v=meta.views.hub,camera=new THREE.PerspectiveCamera(2*Math.atan(Math.tan(v.fov*Math.PI/360)*Math.max(1,1.6/aspect))*180/Math.PI,aspect,.035,250);camera.position.fromArray(v.position);camera.lookAt(...v.target);camera.updateMatrixWorld();report.viewport_targets[label]=Object.fromEntries(Object.entries(meta.hub_targets).map(([id,point])=>{const p=new THREE.Vector3(...point).project(camera);return[id,Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1];}));
}
fs.writeFileSync(`${dir}/clearance-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures)process.exitCode=1;
