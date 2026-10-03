import * as THREE from 'three';

// Subtract a rectangular prism from triangles, preserving every interpolated
// vertex attribute (especially the baked-lighting UVs). These are real missing
// triangles, not shader discards or stencil masks. Each polygon is partitioned
// into outside pieces while its remaining inside portion passes to the next plane.
export function subtractWindowPrism(geometry,matrixWorld,frame,depth=.8){
 const {center,right,normal,size}=frame;
 const axes=[right,new THREE.Vector3(0,1,0),normal];
 const limits=[[-size.x/2,size.x/2],[-size.y/2,size.y/2],[-.16,depth]];
 const names=Object.keys(geometry.attributes),attributes=geometry.attributes;
 const positions=attributes.position,world=new THREE.Vector3();
 const coords=index=>{
  world.fromBufferAttribute(positions,index).applyMatrix4(matrixWorld).sub(center);
  return axes.map(axis=>world.dot(axis));
 };
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  world.set(x,y,z).applyMatrix4(matrixWorld).sub(center);
  axes.forEach((axis,i)=>{const v=world.dot(axis);lo[i]=Math.min(lo[i],v);hi[i]=Math.max(hi[i],v);});
 }
 if(limits.some(([min,max],i)=>hi[i]<=min+1e-6||lo[i]>=max-1e-6))return null;
 const vertex=index=>({p:coords(index),a:Object.fromEntries(names.map(name=>[name,Array.from({length:attributes[name].itemSize},(_,i)=>attributes[name].getComponent(index,i))]))});
 const lerp=(a,b,t)=>({p:a.p.map((v,i)=>v+(b.p[i]-v)*t),a:Object.fromEntries(names.map(name=>[name,a.a[name].map((v,i)=>v+(b.a[name][i]-v)*t)]))});
 const split=(poly,axis,bound,sign)=>{
  const inside=[],outside=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-bound)*sign,db=(b.p[axis]-bound)*sign;
   (da>=0?inside:outside).push(a);
   if((da>=0)!==(db>=0)){const hit=lerp(a,b,da/(da-db));inside.push(hit);outside.push(hit);}
  }
  return {inside,outside};
 };
 const result=new THREE.BufferGeometry(),data=Object.fromEntries(names.map(name=>[name,[]]));
 const area=poly=>{
  let sum=0;
  for(let i=1;i<poly.length-1;i++){
   const a=new THREE.Vector3(...poly[i].p).sub(new THREE.Vector3(...poly[0].p));
   const b=new THREE.Vector3(...poly[i+1].p).sub(new THREE.Vector3(...poly[0].p));
   sum+=a.cross(b).length()/2;
  }
  return sum;
 };
 const groups=geometry.groups.length?geometry.groups:[{start:0,count:geometry.index?.count??positions.count,materialIndex:0}];
 let removed=false,count=0;
 for(const group of groups){
  const start=count;
  for(let i=group.start;i<group.start+group.count;i+=3){
   const triangle=[0,1,2].map(j=>vertex(geometry.index?geometry.index.getX(i+j):i+j));
   let inside=triangle;const pieces=[];
   for(let axis=0;axis<3&&inside.length>=3;axis++){
    for(const [bound,sign] of [[limits[axis][0],1],[limits[axis][1],-1]]){
     const halves=split(inside,axis,bound,sign);if(halves.outside.length>=3)pieces.push(halves.outside);inside=halves.inside;
     if(inside.length<3)break;
    }
   }
   const intersects=inside.length>=3&&area(inside)>1e-7;
   if(intersects)removed=true;
   // If this triangle misses the hole, keep it untouched instead of subdividing it.
   for(const poly of intersects?pieces:[triangle])for(let j=1;j<poly.length-1;j++){
    if(area([poly[0],poly[j],poly[j+1]])<1e-12)continue;
    for(const v of [poly[0],poly[j],poly[j+1]])for(const name of names)data[name].push(...v.a[name]);
    count+=3;
   }
  }
  if(count>start)result.addGroup(start,count-start,group.materialIndex);
 }
 if(!removed){result.dispose();return null;}
 for(const name of names)result.setAttribute(name,new THREE.Float32BufferAttribute(data[name],attributes[name].itemSize));
 if(result.attributes.normal)result.normalizeNormals();
 result.computeBoundingBox();result.computeBoundingSphere();return result;
}

export const isWindowStructure=name=>/wall|plaster|sheathing|stud|conduit|rafter/i.test(name)&&!/window|picture|shelf|bench|parcel|print/i.test(name);

export function cutWindowOpenings(model,frames){
 const changed=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!isWindowStructure(mesh.name.replaceAll('_',' ')))return;
  let geometry=mesh.geometry,owned=false;
  for(const frame of frames){
   const cut=subtractWindowPrism(geometry,mesh.matrixWorld,frame);
   if(cut){if(owned)geometry.dispose();geometry=cut;owned=true;}
  }
  if(owned){mesh.geometry=geometry;mesh.userData.realWindowOpening=true;changed.push(mesh);}
 });
 return changed;
}
