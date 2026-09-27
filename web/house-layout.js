import * as THREE from 'three';

export function roomMatrix(room){
 return new THREE.Matrix4().compose(new THREE.Vector3(...room.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),room.yaw),new THREE.Vector3(1,1,1));
}
export function buildConnections(layout){
 const group=new THREE.Group(),ladder=new THREE.Group();group.add(ladder);
 const materials={plaster:new THREE.MeshStandardMaterial({color:0x465956,roughness:1}),wood:new THREE.MeshStandardMaterial({color:0x49301e,roughness:.85}),rail:new THREE.MeshStandardMaterial({color:0x827c65,roughness:.65})};
 for(const part of layout.geometry){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...part.size),materials[part.material]);mesh.name=part.name;mesh.position.fromArray(part.position);mesh.rotation.y=part.rotation??0;
  (part.ladder?ladder:group).add(mesh);
 }
 ladder.visible=false;
 for(const position of [[-2,2.5,7],[-5,2.5,12],[4.4,.2,1.8],[0,5.2,-1]]){
  const light=new THREE.PointLight(0x9db2bc,2.5,7,2);light.position.fromArray(position);group.add(light);
 }
 return {group,ladder};
}

// Piecewise smooth interpolation stays inside the narrow passages. Curve
// smoothing at corners would cut through their walls and stairwell enclosure.
export function sampleRoute(points,t){
 const lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0);
 let distance=THREE.MathUtils.clamp(t,0,1)*total;
 for(let i=0;i<lengths.length;i++){
  if(distance<=lengths[i]||i===lengths.length-1){const u=lengths[i]?distance/lengths[i]:1;return points[i].clone().lerp(points[i+1],u*u*(3-2*u));}
  distance-=lengths[i];
 }
 return points[0].clone();
}
