import * as THREE from 'three';

// Extend the authored open rim, preserving each baked UV seam around the pipe.
export function connectBasementPipe(pipe,wall,ceilingY){
 if(pipe.userData.ceilingConnected||!pipe.isMesh)return;
 pipe.updateMatrixWorld(true);
 const source=pipe.geometry,position=source.attributes.position,uv=source.attributes.uv,index=source.index;
 const points=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(pipe.matrixWorld));
 const endX=Math.max(...points.map(p=>p.x)),rim=points.filter(p=>Math.abs(p.x-endX)<1e-5);
 const center=new THREE.Box3().setFromPoints(rim).getCenter(new THREE.Vector3()),radius=Math.min(.16,ceilingY-center.y-.04);
 if(radius<=0)return;
 const edgePairs=[];
 for(let i=0;i<(index?.count??position.count);i+=3){
  const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
  if(!ids.some(id=>points[id].x<endX-.1))continue;
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3];if(Math.abs(points[a].x-endX)<1e-5&&Math.abs(points[b].x-endX)<1e-5)edgePairs.push([a,b]);}
 }
 const vertices=[],coords=[],indices=[],inverse=pipe.matrixWorld.clone().invert(),path=[];
 for(let i=0;i<=24;i++){
  const angle=i/24*Math.PI/2;
  path.push({center:new THREE.Vector3(center.x+radius*Math.sin(angle),center.y+radius*(1-Math.cos(angle)),center.z),normal:new THREE.Vector3(-Math.sin(angle),Math.cos(angle),0)});
 }
 // Finish inside the ceiling, so the pipe never has an exposed cap in the room.
 path.push({center:new THREE.Vector3(center.x+radius,ceilingY+.025,center.z),normal:new THREE.Vector3(-1,0,0)});
 for(const pair of edgePairs){
  const base=vertices.length/3;
  for(const step of path)for(const id of pair){
   const delta=points[id].clone().sub(center),p=step.center.clone().addScaledVector(step.normal,delta.y);p.z+=delta.z;
   vertices.push(...p.applyMatrix4(inverse).toArray());coords.push(uv.getX(id),uv.getY(id));
  }
  for(let i=0;i<path.length-1;i++){const a=base+i*2;indices.push(a,a+2,a+3,a,a+3,a+1);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const add=(name,geometry)=>{
  const mesh=new THREE.Mesh(geometry,pipe.material);mesh.name=name;mesh.userData={...pipe.userData,bake_connection:true,houseOutlined:true};pipe.add(mesh);return mesh;
 };
 const elbow=add('Copper pipe ceiling elbow',geometry);elbow.userData.pipeCenterline=path.map(p=>p.center.toArray());
 const wallZ=new THREE.Box3().setFromObject(wall).max.z;
 const sampleUV=new THREE.Vector2(uv.getX(edgePairs[0][0]),uv.getY(edgePairs[0][0]));
 function bracketGeometry(geometry){
  const uv=new Float32Array(geometry.attributes.position.count*2);for(let i=0;i<uv.length;i+=2){uv[i]=sampleUV.x;uv[i+1]=sampleUV.y;}
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.applyMatrix4(inverse);return geometry;
 }
 for(const x of [1.3,5.8,10.7]){
  const plate=new THREE.BoxGeometry(.055,.12,.008);plate.translate(x,center.y,wallZ+.002);add('Copper pipe wall mounting plate',bracketGeometry(plate));
  const band=new THREE.TorusGeometry(.046,.005,6,20);band.rotateY(Math.PI/2);band.translate(x,center.y,center.z);add('Copper pipe wall saddle',bracketGeometry(band));
 }
 pipe.userData.ceilingConnected=true;pipe.updateMatrixWorld(true);
}
