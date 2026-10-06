// Derive window-visible scenery from authoring meshes; never alter bake masters.
import * as THREE from 'three';
import {KHRMaterialsUnlit} from '@gltf-transform/extensions';

export const isExteriorTree=node=>/^(Irregular leafy tree|Nearby bare branches)(?:\.\d+)?$/.test(node.getName());
const up=new THREE.Vector3(0,1,0);
function worldVertices(node){
 const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),points=[];
 for(const p of node.getMesh().listPrimitives()){
  const a=p.getAttribute('POSITION');
  for(let i=0;i<a.getCount();i++)points.push(new THREE.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));
 }
 return points;
}
const corners=box=>[...Array(8)].map((_,i)=>new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));

export function sceneryCameras(layout){
 const result=[];
 function add(id,position,quaternion,fov){
  // The house preserves horizontal coverage on narrow screens. Include wide
  // screens; evaluate only the authored, settled room cameras.
  const frusta=[.4,1.6,4].map(aspect=>{
   const fitted=2*Math.atan(Math.tan(fov*Math.PI/360)*Math.max(1,layout.aspect/aspect))*180/Math.PI;
   const camera=new THREE.PerspectiveCamera(Math.min(175,fitted),aspect,.01,250);
   camera.position.copy(position);camera.quaternion.copy(quaternion);camera.updateMatrixWorld();
   return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  });
  result.push({id,position:position.clone(),frusta});
 }
 for(const [id,v] of Object.entries(layout.views)){
  if(id==='overview')continue;const camera=new THREE.PerspectiveCamera();camera.position.fromArray(v.position);camera.lookAt(new THREE.Vector3(...v.target));add(id,camera.position,camera.quaternion,v.fov);
 }
 return result;
}

export function sceneryWindows(documents,layout){
 const result=[];
 for(const [room,doc] of documents)for(const node of doc.getRoot().listNodes()){
  if(!node.getMesh()||!(/glass/i.test(node.getName())||/^Garden beyond window(?:\.\d+)?$/.test(node.getName())))continue;
  const box=new THREE.Box3().setFromPoints(worldVertices(node)),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const axis=size.x<size.z?'x':'z',owner=room==='basement'?'basement':/garage/.test(node.getName())?'workshop':/attic/.test(node.getName())?'attic':/hall-rear/.test(node.getName())?'private-hall':'hub';
  const normal=new THREE.Vector3(axis==='x'?1:0,0,axis==='z'?1:0);
  if(normal.dot(new THREE.Vector3(...layout.views[owner].position).sub(center))>0)normal.negate();
  const right=new THREE.Vector3().crossVectors(up,normal);
  const width=axis==='x'?size.z:size.x,height=size.y;
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>center.clone().addScaledVector(right,x*(width/2)).addScaledVector(up,y*(height/2)));
  result.push({name:node.getName(),room,owner,center,normal,right,width,height,points});
 }
 return result;
}

// A conservative portal test: rejection requires the entire padded tree box
// to lie outside one plane. False positives keep scenery, never delete a sliver.
export function treeThroughWindow(box,window,camera){
 if(window.normal.dot(camera.position.clone().sub(window.center))>=-.01)return false;
 const points=corners(box),beyond=new THREE.Plane().setFromNormalAndCoplanarPoint(window.normal,window.center);
 if(points.every(p=>beyond.distanceToPoint(p)<0))return false;
 const middle=window.center.clone().addScaledVector(window.normal,1),planes=[beyond];
 for(let i=0;i<4;i++){
  const plane=new THREE.Plane().setFromCoplanarPoints(camera.position,window.points[i],window.points[(i+1)%4]);
  if(plane.distanceToPoint(middle)<0)plane.negate();planes.push(plane);
 }
 const intersects=planes=>planes.every(plane=>points.some(p=>plane.distanceToPoint(p)>=0));
 return intersects(planes)&&(camera.frusta??[camera.frustum]).some(f=>intersects(f.planes));
}

function simplifyLoop(points,tolerance=1){
 function simplify(p){
  if(p.length<=2)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  let max=0,index=0;
  for(let i=1;i<p.length-1;i++){
   const t=den?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/den)):0;
   const d=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(d>max){max=d;index=i;}
  }
  return max<=tolerance?[a,b]:[...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))];
 }
 let split=1;for(let i=2;i<points.length;i++)if(Math.hypot(...points[i].map((v,k)=>v-points[0][k]))>Math.hypot(...points[split].map((v,k)=>v-points[0][k])))split=i;
 return [...simplify(points.slice(0,split+1)).slice(0,-1),...simplify([...points.slice(split),points[0]]).slice(0,-1)];
}

export function maskContours(mask,width,height){
 const edges=new Map(),occupied=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&mask[y*width+x]>=128;
 const key=(x,y)=>y*(width+1)+x;
 const edge=(x,y,nx,ny)=>{const a=key(x,y),list=edges.get(a)??[];list.push(key(nx,ny));edges.set(a,list);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(occupied(x,y)){
  if(!occupied(x,y-1))edge(x,y,x+1,y);if(!occupied(x+1,y))edge(x+1,y,x+1,y+1);
  if(!occupied(x,y+1))edge(x+1,y+1,x,y+1);if(!occupied(x-1,y))edge(x,y+1,x,y);
 }
 const loops=[];
 while(edges.size){
  const start=edges.keys().next().value,points=[];let current=start,previous;
  do{
   points.push([current%(width+1),Math.floor(current/(width+1))]);const next=edges.get(current);if(!next)throw Error('Open tree contour');
   const direction=(a,b)=>b-a===1?0:b-a===width+1?1:b-a===-1?2:3;
   let index=0;if(previous!==undefined&&next.length>1){const d=direction(previous,current);index=next.findIndex(n=>(direction(current,n)-d+4)%4===1);if(index<0)index=0;}
   const target=next.splice(index,1)[0];if(!next.length)edges.delete(current);previous=current;current=target;
  }while(current!==start);
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
  if(Math.abs(area)>=3)loops.push({area,points:simplifyLoop(points)});
 }
 return loops;
}

// Clip actual triangles against the window portal and camera, avoiding the
// empty corners of a large canopy bounding box counting as visible foliage.
export function triangleThroughPlanes(triangle,planes){
 let polygon=triangle;
 for(const plane of planes){
  const clipped=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
   if(da>=0)clipped.push(a);
   if((da<0)!==(db<0))clipped.push(a.clone().lerp(b,da/(da-db)));
  }
  polygon=clipped;if(polygon.length<3)return false;
 }
 return polygon.some((p,i)=>i>1&&polygon[1].clone().sub(polygon[0]).cross(p.clone().sub(polygon[0])).lengthSq()>1e-12);
}
function meshThroughWindow(node,vertices,window,camera){
 const middle=window.center.clone().addScaledVector(window.normal,1);
 const planes=[new THREE.Plane().setFromNormalAndCoplanarPoint(window.normal,window.center)];
 for(let i=0;i<4;i++){
  const plane=new THREE.Plane().setFromCoplanarPoints(camera.position,window.points[i],window.points[(i+1)%4]);
  if(plane.distanceToPoint(middle)<0)plane.negate();planes.push(plane);
 }
 let offset=0;
 for(const primitive of node.getMesh().listPrimitives()){
  const positions=primitive.getAttribute('POSITION'),index=primitive.getIndices();
  for(let i=0;i<(index?.getCount()??positions.getCount());i+=3){
   const triangle=[0,1,2].map(k=>vertices[offset+(index?index.getScalar(i+k):i+k)]);
   if(camera.frusta.some(f=>triangleThroughPlanes(triangle,[...planes,...f.planes])))return true;
  }
  offset+=positions.getCount();
 }
 return false;
}

async function silhouette(node,windows){
 const vertices=worldVertices(node),bounds=new THREE.Box3().setFromPoints(vertices),center=bounds.getCenter(new THREE.Vector3());
 const nearest=windows.toSorted((a,b)=>a.center.distanceToSquared(center)-b.center.distanceToSquared(center))[0];
 const normal=nearest.center.clone().sub(center);normal.y=0;normal.normalize();
 const inverse=new THREE.Matrix4().fromArray(node.getWorldMatrix()).invert(),positions=[],indices=[];
 // Two intersecting, double-sided cutouts preserve an upright silhouette when
 // the camera travels sideways; no textures, billboarding, or alpha overdraw.
 for(const axis of [normal,new THREE.Vector3().crossVectors(up,normal)]){
  const right=new THREE.Vector3().crossVectors(up,axis),xs=vertices.map(v=>v.dot(right));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=bounds.min.y,maxY=bounds.max.y;
  const height=256,width=Math.max(32,Math.ceil(height*(maxX-minX)/(maxY-minY))),pad=2;
  const sx=(width-pad*2)/(maxX-minX),sy=(height-pad*2)/(maxY-minY),mask=new Uint8Array(width*height);
  const projected=vertices.map(v=>[(v.dot(right)-minX)*sx+pad,(maxY-v.y)*sy+pad]);
  let offset=0;
  for(const primitive of node.getMesh().listPrimitives()){
   const a=primitive.getAttribute('POSITION'),index=primitive.getIndices();
   for(let i=0;i<(index?.getCount()??a.getCount());i+=3){
    const points=[0,1,2].map(k=>projected[offset+(index?index.getScalar(i+k):i+k)]);
    const low=Math.max(0,Math.ceil(Math.min(...points.map(p=>p[1]))-.5)),high=Math.min(height-1,Math.floor(Math.max(...points.map(p=>p[1]))-.5));
    for(let y=low;y<=high;y++){
     const intersections=[];
     for(let k=0;k<3;k++){
      const a=points[k],b=points[(k+1)%3],sample=y+.5;
      if((a[1]<=sample&&b[1]>sample)||(b[1]<=sample&&a[1]>sample))intersections.push(a[0]+(sample-a[1])/(b[1]-a[1])*(b[0]-a[0]));
     }
     if(intersections.length!==2)continue;
     const x0=Math.max(0,Math.ceil(Math.min(...intersections)-.5)),x1=Math.min(width-1,Math.floor(Math.max(...intersections)-.5));
     if(x1>=x0)mask.fill(255,y*width+x0,y*width+x1+1);
    }
   }
   offset+=a.getCount();
  }
  const loops=maskContours(mask,width,height);
  const outers=loops.filter(l=>l.area>=4&&l.points.length>=3).map(l=>({points:l.points,holes:[]}));
  const contains=(poly,p)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
  for(const hole of loops.filter(l=>l.area<=-12&&l.points.length>=3)){
   const parent=outers.filter(o=>contains(o.points,hole.points[0])).toSorted((a,b)=>Math.abs(THREE.ShapeUtils.area(a.points.map(p=>new THREE.Vector2(...p))))-Math.abs(THREE.ShapeUtils.area(b.points.map(p=>new THREE.Vector2(...p)))))[0];
   parent?.holes.push(hole.points);
  }
  for(const outer of outers){
   const contour=outer.points.map(p=>new THREE.Vector2(...p)),holes=outer.holes.map(h=>h.map(p=>new THREE.Vector2(...p))),faces=THREE.ShapeUtils.triangulateShape(contour,holes),base=positions.length/3;
   for(const p of [...contour,...holes.flat()]){
    const v=right.clone().multiplyScalar(minX+(p.x-pad)/sx).addScaledVector(up,maxY-(p.y-pad)/sy).addScaledVector(axis,center.dot(axis)).applyMatrix4(inverse);positions.push(...v.toArray());
   }
   for(const face of faces)indices.push(...face.map(i=>i+base));
  }
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}

export async function optimizeTreeDelivery(documents,layout){
 const cameras=sceneryCameras(layout),windows=sceneryWindows(documents,layout),report={version:2,visibility:'settled-cameras',cameraSamples:cameras.length,windows:windows.map(w=>({name:w.name,room:w.room,center:w.center.toArray(),size:[w.width,w.height]})),trees:[]};
 for(const [room,doc] of documents)for(const node of doc.getRoot().listNodes().filter(isExteriorTree)){
  const points=worldVertices(node),box=new THREE.Box3().setFromPoints(points);
  const visible=windows.filter(w=>(room!=='basement'||w.room==='basement')&&cameras.some(c=>c.id===w.owner&&treeThroughWindow(box,w,c)&&meshThroughWindow(node,points,w,c)));
  const before=node.getMesh().listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
  const entry={room,name:node.getName(),position:new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(node.getWorldMatrix())).toArray(),beforeTriangles:before,windows:visible.map(w=>w.name),afterTriangles:0};report.trees.push(entry);
  if(!visible.length){entry.action='removed';node.dispose();continue;}
  if(/^Nearby bare branches/.test(node.getName())){entry.action='retained-nearby';entry.afterTriangles=before;continue;}
  const {positions,indices}=await silhouette(node,visible);if(!indices.length)throw Error(`Empty silhouette: ${node.getName()}`);
  const buffer=doc.getRoot().listBuffers()[0],material=doc.createMaterial('Exterior black silhouette').setBaseColorFactor([0,0,0,1]).setDoubleSided(true).setRoughnessFactor(1);
  material.setExtension('KHR_materials_unlit',doc.createExtension(KHRMaterialsUnlit).createUnlit());
  const geometry=doc.createPrimitive().setMaterial(material).setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
  const extras={...node.getExtras(),tree_delivery:'crossed-silhouette',houseOutlined:true};
  // A silhouette has no lightmap. Other exterior surfaces retain their bake.
  for(const key of ['release_baked','atlas_group','atlas_source_id','atlas_delivery_max','atlas_lossless','house_window_bake'])delete extras[key];
  node.setMesh(doc.createMesh(node.getName()).addPrimitive(geometry));node.setExtras(extras);
  entry.action='silhouette';entry.afterTriangles=indices.length/3;
 }
 return report;
}
