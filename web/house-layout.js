import * as THREE from 'three';

export function roomMatrix(room){
 return new THREE.Matrix4().compose(new THREE.Vector3(...room.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),room.yaw),new THREE.Vector3(1,1,1));
}
export function setAtticAccess(ladder,door,openness){
 const open=THREE.MathUtils.clamp(openness,0,1);
 // Retract along the stair slope into the ceiling before hiding the assembly.
 ladder.position.set(0,3.4*(1-open),1.13*(open-1));
 ladder.visible=open>0;
 if(door)door.pivot.rotation[door.axis]=door.angle*open;
}
export function buildConnections(layout){
 const group=new THREE.Group(),ladder=new THREE.Group();group.add(ladder);
 const materials={plaster:new THREE.MeshStandardMaterial({color:0x465956,roughness:1}),wood:new THREE.MeshStandardMaterial({color:0x49301e,roughness:.85}),rail:new THREE.MeshStandardMaterial({color:0x827c65,roughness:.65}),...Object.fromEntries(Object.entries({dark:0x23282c,cream:0xe0d4bd,ochre:0xc18c39,blue:0x345e81,rust:0xa34d34}).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.9})]))};
 for(const part of layout.geometry){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...part.size),materials[part.material]);mesh.name=part.name;mesh.position.fromArray(part.position);mesh.rotation.y=part.rotation??0;mesh.rotation.z=part.slope??0;
  (part.ladder?ladder:group).add(mesh);
 }
 ladder.visible=false;
 for(const position of [[-2,2.5,7],[-5,2.5,12],[0,5.2,-1]]){
  const light=new THREE.PointLight(0x9db2bc,2.5,7,2);light.position.fromArray(position);group.add(light);
 }
 return {group,ladder};
}

// Round each corner within a bounded radius, preserving narrow door clearances.
// Arc-length sampling keeps the camera moving through intermediate waypoints.
export function createRoute(points){
 const route=new THREE.CurvePath();let previous=points[0];
 for(let i=1;i<points.length-1;i++){
  const corner=points[i],before=points[i-1],after=points[i+1];
  const radius=Math.min(.45,corner.distanceTo(before)*.3,corner.distanceTo(after)*.3);
  const enter=corner.clone().add(before.clone().sub(corner).setLength(radius));
  const leave=corner.clone().add(after.clone().sub(corner).setLength(radius));
  route.add(new THREE.LineCurve3(previous.clone(),enter));
  route.add(new THREE.QuadraticBezierCurve3(enter,corner.clone(),leave));previous=leave;
 }
 route.add(new THREE.LineCurve3(previous.clone(),points.at(-1).clone()));
 return route;
}
export function travelEase(t){t=THREE.MathUtils.clamp(t,0,1);return THREE.MathUtils.clamp(t*t*t*(t*(t*6-15)+10),0,1);}
export function sampleRoute(points,t){return createRoute(points).getPoint(THREE.MathUtils.clamp(t,0,1));}

// One cubic, without intermediate joins or waypoint turns. The two handles
// keep the departure and arrival tangent along the rooms' forward direction.
export function createDenRoute(den,hallway,controls,reverse=false){
 const first=new THREE.Vector3(den.x,THREE.MathUtils.lerp(den.y,hallway.y,1/3),controls.departureZ);
 const second=new THREE.Vector3(hallway.x,THREE.MathUtils.lerp(den.y,hallway.y,2/3),controls.arrivalZ);
 const curve=reverse?new THREE.CubicBezierCurve3(hallway.clone(),second,first,den.clone()):new THREE.CubicBezierCurve3(den.clone(),first,second,hallway.clone());
 const route=new THREE.CurvePath();route.add(curve);return route;
}
