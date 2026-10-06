// Estimates texture demand from source geometry and cameras; no build or bake.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseArgs} from 'node:util';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
import sharp from 'sharp';
import {textureDemand,recommendedSize,uvAtPoint} from './texture-sizing/coverage.mjs';
import {VIEWPORTS,houseCameras,denCameras,denTravelCameras,DEN_TO_WORLD} from './texture-sizing/cameras.mjs';
import {assembleScene,projectedUV} from './texture-sizing/scene.mjs';
import {renderReport} from './texture-sizing/report.mjs';
import {detailEstimate} from './texture-sizing/detail.mjs';
const {values}=parseArgs({options:{output:{type:'string',default:'docs/house-plan/texture-size-plan.json'},'travel-steps':{type:'string',default:'16'},'grid-width':{type:'string',default:'80'},'closeup-distance':{type:'string',default:'0.6'}}});
const steps=Number(values['travel-steps']),gridWidth=Number(values['grid-width']),closeupDistance=Number(values['closeup-distance']);
if(!Number.isInteger(steps)||steps<0||steps>200||!Number.isInteger(gridWidth)||gridWidth<16||gridWidth>512||!Number.isFinite(closeupDistance)||closeupDistance<=0)throw Error('Invalid sampling settings');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),layout=JSON.parse(await readFile('web/assets/house/release/layout.json')),registry=new Map(),documents=new Map(),stats={cameraViews:0,rays:0,surfaceHits:0,degenerateUVHits:0};
const local=url=>url.split('?')[0].replace(/^\//,'');
async function input(path){if(!documents.has(path))documents.set(path,await io.read(path));return {path,doc:documents.get(path)};}
function recordDemand(layer,range,demand,view,uv){
 if(demand===null||!Number.isFinite(demand)){stats.degenerateUVHits++;return;}
 const record=registry.get(layer.id);record.samples.push(demand);record.views.add(view);
 const kind=view.includes('closeup:')?'closeup':view.includes('travel:')?'travel':'rest';
 record.byContext??={rest:[],travel:[],closeup:[]};record.byContext[kind].push(demand);
 record.coordinates??=[];
 if(uv){
  // Deterministic reservoir sampling bounds image-analysis work per texture.
  const number=record.samples.length,index=((number*2654435761)>>>0)%number;
  const wrap=(value,mode)=>mode===10497?value-Math.floor(value):mode===33648?1-Math.abs((value%2+2)%2-1):T.MathUtils.clamp(value,0,1);
  const coordinate=[wrap(uv.x,record.wrapS),wrap(uv.y,record.wrapT)];
  if(record.coordinates.length<512)record.coordinates.push(coordinate);else if(index<512)record.coordinates[index]=coordinate;
 }
 const key=range.path+'#'+range.name,object=record.objects.get(key)??{path:range.path,name:range.name,samples:0,maxRequiredEdge:0,limitingView:null};
 object.samples++;if(demand>object.maxRequiredEdge){object.maxRequiredEdge=demand;object.limitingView=view;}record.objects.set(key,object);
}
function sampleScene(scene,views){
 const raycaster=new T.Raycaster();
 for(const {id,camera,viewport} of views){
  stats.cameraViews++;const aspect=viewport.width/viewport.height,columns=gridWidth,rows=Math.max(16,Math.round(columns/aspect));
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   raycaster.setFromCamera(new T.Vector2((x+.5)/columns*2-1,1-(y+.5)/rows*2),camera);stats.rays++;
   const hit=scene.bvh.raycastFirst(raycaster.ray,T.DoubleSide,camera.near,camera.far);if(!hit)continue;stats.surfaceHits++;
   const range=scene.rangeFor(hit.faceIndex),triangle=scene.triangle(hit.faceIndex);
   for(const layer of range.layers){
    const texture=registry.get(layer.id),ratio=layer.slot==='emissive'?1:1.5;
    recordDemand(layer,range,textureDemand(triangle,scene.uvFor(range,layer,hit.faceIndex),camera,viewport,texture,ratio,hit.point),id,uvAtPoint(triangle,scene.uvFor(range,layer,hit.faceIndex),hit.point));
   }
  }
 }
}
function closeups(scene){
 // Isolated, conservative allowance: movable mesh at least 0.6m from the eye.
 // Sample authored UVs from six directions, without changing its geometry.
 if(closeupDistance===0)return;
 for(const range of scene.ranges.filter(r=>r.movable&&r.layers.length)){
  const box=new T.Box3();for(let face=range.start;face<range.end;face++)scene.triangle(face).forEach(p=>box.expandByPoint(p));
  const center=box.getCenter(new T.Vector3()),radius=box.getSize(new T.Vector3()).length()/2;
  if(radius>1.8)continue;
  for(const axis of [new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1),new T.Vector3(0,0,-1)]){
   const camera=new T.PerspectiveCamera(50,1,.035,250);camera.position.copy(center).addScaledVector(axis,radius+closeupDistance);camera.lookAt(center);camera.updateMatrixWorld();
   const stride=Math.max(1,Math.ceil((range.end-range.start)/128));
   for(let face=range.start;face<range.end;face+=stride){
    const triangle=scene.triangle(face),point=new T.Triangle(...triangle).getMidpoint(new T.Vector3()),screen=point.clone().project(camera);if(Math.abs(screen.x)>1||Math.abs(screen.y)>1||Math.abs(screen.z)>1)continue;
    for(const layer of range.layers){const texture=registry.get(layer.id);recordDemand(layer,range,textureDemand(triangle,scene.uvFor(range,layer,face),camera,{width:1688,height:1688},texture,layer.slot==='emissive'?1:1.5,point),`closeup:conservative-${closeupDistance}m`,uvAtPoint(triangle,scene.uvFor(range,layer,face),point));}
   }
  }
 }
}
const hall=[await input(local(layout.structureAssets.hallway)),await input(local(layout.assets.hallway))];
for(const room of ['hallway','workshop','basement','attic']){
 const inputs=room==='hallway'?hall:[...hall,await input(local(layout.structureAssets[room])),await input(local(layout.assets[room]))];
 console.log(`Measuring ${room}…`);const scene=await assembleScene(inputs,registry);
 for(const viewport of VIEWPORTS)sampleScene(scene,houseCameras(layout,room,viewport,room==='hallway'?0:steps).map(v=>({...v,id:viewport.id+':'+v.id})));
 closeups(scene);scene.geometry.dispose();
}
// Default den uses camera-projected lighting, not mesh UVs. Reproduce its
// shader projection and prop crop so the same density calculation applies.
const carts=await input('web/assets/cartridges.glb'),cameraNode=carts.doc.getRoot().listNodes().find(n=>n.getCamera()),lens=cameraNode.getCamera(),base=new T.PerspectiveCamera(T.MathUtils.radToDeg(lens.getYFov()),lens.getAspectRatio(),lens.getZNear(),lens.getZFar());
base.matrix.fromArray(cameraNode.getWorldMatrix());base.matrix.decompose(base.position,base.quaternion,base.scale);base.updateMatrixWorld();
const den=await input('web/assets/room.glb'),shell=den.doc.getRoot().listNodes().find(n=>n.getExtras().role==='room_geometry'),extras=shell.getExtras();
const bakeMatrix=new T.Matrix4().makeScale(...extras.bakeScale,1).multiply(base.projectionMatrix).multiply(base.matrixWorldInverse);
for(const path of ['web/assets/room-lighting.webp','web/assets/room-props.webp']){const metadata=await sharp(await readFile(path)).metadata();registry.set(path,{id:path,path,name:path.split('/').at(-1),image:await readFile(path),width:metadata.width,height:metadata.height,slots:new Set(['projectedLighting']),samples:[],objects:new Map(),views:new Set()});}
den.projector=node=>{
 const role=node.getExtras().role;if(!['room_geometry','reactive_prop','crt_depth_surface'].includes(role))return null;
 const prop=role==='reactive_prop',matrix=bakeMatrix.clone();
 if(den.transform)matrix.multiply(den.transform.clone().invert());
 if(prop){const [x,y,w,h]=extras.propBakeRect;matrix.premultiply(new T.Matrix4().set(1/w,0,0,(1-2*x-w)/w,0,1/h,0,(1-2*y-h)/h,0,0,1,0,0,0,0,1));}
 return {id:prop?'web/assets/room-props.webp':'web/assets/room-lighting.webp',slot:'emissive',project:projectedUV(matrix)};
};
console.log('Measuring den…');const denScene=await assembleScene([den],registry);
for(const viewport of VIEWPORTS)sampleScene(denScene,denCameras(base,viewport).map(v=>({...v,id:viewport.id+':'+v.id})));
denScene.geometry.dispose();
if(steps>0){
 console.log('Measuring den doorway travel…');den.transform=DEN_TO_WORLD;
 const doorway=await assembleScene([...hall,await input(local(layout.structureAssets.den)),den],registry);
 for(const viewport of VIEWPORTS)sampleScene(doorway,denTravelCameras(layout,base,viewport,steps).map(v=>({...v,id:viewport.id+':'+v.id})));
 doorway.geometry.dispose();
}
console.log('Checking visible texture detail…');
const textures=[];
for(const r of registry.values()){
 const samples=r.samples.toSorted((a,b)=>a-b),p99=samples.length?samples[Math.min(samples.length-1,Math.floor(samples.length*.99))]:null,max=samples.at(-1)??null;
 const contexts=Object.fromEntries(Object.entries(r.byContext??{}).map(([key,values])=>{const sorted=values.toSorted((a,b)=>a-b);return [key,{samples:values.length,p99RequiredEdge:sorted.length?Math.ceil(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.99))]):null,maxRequiredEdge:sorted.length?Math.ceil(sorted.at(-1)):null}];}));
 const lighting=[...r.slots].every(slot=>slot==='emissive'||slot==='projectedLighting');
 const detail=await detailEstimate(r.image,r.coordinates??[],{minimum:lighting?512:128,rmsLimit:lighting?3:2.5,p95Limit:lighting?8:6});
 const coverage=p99===null?null:recommendedSize(p99,r.width,r.height);
 if(coverage&&Math.max(coverage.width,coverage.height)>Math.max(r.width,r.height)){coverage.width=r.width;coverage.height=r.height;coverage.sourceInsufficient=true;}
 textures.push({id:r.id,path:r.path,name:r.name,currentSize:[r.width,r.height],slots:[...r.slots],samples:samples.length,views:[...r.views],p99RequiredEdge:p99===null?null:Math.ceil(p99),maxRequiredEdge:max===null?null:Math.ceil(max),contexts,coverageEstimate:coverage,detailEstimate:detail,recommended:detail?{width:detail.width,height:detail.height}:coverage,worstCase:max===null?null:recommendedSize(max,r.width,r.height),objects:[...r.objects.values()].map(o=>({...o,maxRequiredEdge:Math.ceil(o.maxRequiredEdge)})).sort((a,b)=>b.maxRequiredEdge-a.maxRequiredEdge)});
}
textures.sort((a,b)=>(b.p99RequiredEdge??0)-(a.p99RequiredEdge??0));
const report={version:1,settings:{viewports:VIEWPORTS,travelSteps:steps,gridWidth,closeupDistance,lightingTexelsPerPixel:1,detailTexelsPerPixel:1.5,recommendationPercentile:99},stats,limitations:['Recommendations are advisory; no source, bake, or delivery settings are changed.',
'Recommended sizes use sampled resampling error against existing source images. Screen-density estimates and context breakdowns are separate; soft lighting need not meet one texel per screen pixel.',
'Visible-detail checks use up to 512 UV samples per texture and can miss seams, fine lettering, or changed lighting in future bakes. No recommendation upscales its source.','Coarse depth-tested samples can miss tiny visible surfaces. Null recommendations mean unmeasured, not removable.','Resting geometry is used during travel; animated doors, ladder movement, clipping and moving props can change visibility.','Runtime-generated cartridge canvases and the sky shader are not measured. Den idle/playing framing and doorway travel are measured.','Close-up allowances use isolated authored meshes from six directions; prop rotation, grouping and reach are approximations.','Texture recommendations retain current UV allocations; a newly packed bake atlas needs another measurement.','The 99th-percentile recommendation tolerates rare undersampling; worstCase and limiting object/view remain available.'],textures};
await mkdir(dirname(values.output),{recursive:true});await writeFile(values.output,JSON.stringify(report,null,2)+'\n');
await writeFile(values.output.replace(/\.json$/, '')+'.html',renderReport(report));
console.log(`Measured ${textures.length} textures, ${stats.cameraViews} views, ${stats.rays.toLocaleString()} rays → ${values.output}`);
