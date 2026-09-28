import * as THREE from 'three';
import {mergeGeometries} from './vendor/three/BufferGeometryUtils.js';

// A local, upright coordinate system for each opening, including rotated rooms.
// Geometry, glass, and scenery all use the same world-space window frame.
export function windowExteriorFrame(mesh){
 mesh.updateWorldMatrix(true,false);
 const positions=mesh.geometry.attributes.position;
 const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,0)
  .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 const up=new THREE.Vector3(0,1,0),right=new THREE.Vector3().crossVectors(up,normal).normalize();
 const center=new THREE.Vector3(),point=new THREE.Vector3();
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<positions.count;i++){
  point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
  minX=Math.min(minX,point.dot(right));maxX=Math.max(maxX,point.dot(right));
  minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);center.add(point);
 }
 center.divideScalar(positions.count);
 // Bounding midpoint avoids triangulation-dependent centers.
 center.addScaledVector(right,(minX+maxX)/2-center.dot(right));center.y=(minY+maxY)/2;
 return {center,normal,right,size:new THREE.Vector2(maxX-minX,maxY-minY)};
}

// Low-poly branches and boughs live outside the wall. Camera motion needs no
// update function or shader offsets: ordinary perspective supplies the parallax.
export function createWindowTrees(frame){
 const root=new THREE.Group();root.name='Window exterior trees';
 const {center,right,normal,size}=frame,up=new THREE.Vector3(0,1,0);
 const height=Math.max(size.y,1),flip=Math.sin(center.x*12.3+center.z*4.7)<0?-1:1;
 const basis=new THREE.Matrix4().makeBasis(right,up,normal);
 root.position.copy(center);root.quaternion.setFromRotationMatrix(basis);
 function branch(parts,a,b,r0,r1){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const geometry=new THREE.CylinderGeometry(r1,r0,delta.length(),6,1);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());parts.push(geometry);
 }
 const near=[];
 branch(near,[-.65,-1.6,0],[-.53,.15,.03],.055,.024);
 branch(near,[-.53,.15,.03],[-.74,1.25,-.06],.024,.003);
 branch(near,[-.60,-.55,0],[-.18,-.1,.09],.026,.01);
 branch(near,[-.18,-.1,.09],[.06,.47,.16],.01,.001);
 branch(near,[-.24,-.16,.07],[.2,.06,-.08],.01,.001);
 branch(near,[-.54,.06,.02],[-.95,.46,.13],.018,.001);
 branch(near,[-.62,.66,0],[-.27,.95,-.13],.013,.001);
 branch(near,[-.42,.82,-.07],[-.38,1.18,-.1],.006,.001);
 const far=[];
 branch(far,[.73,-1.7,0],[.67,1.25,0],.055,.005);
 for(let i=0;i<8;i++){
  const t=i/7,bough=new THREE.ConeGeometry(.08+.38*t,.38+.17*t,7);
  bough.rotateY(i*.7);bough.translate(.67+.05*t,1.02-i*.24,0);far.push(bough);
 }
 for(const [parts,depth,color] of [[near,.85,0x060b12],[far,2.8,0x101b28]]){
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
  geometry.scale(height*flip,height,height*.65);geometry.translate(0,0,depth);
  const tree=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({name:'Exterior ink tree',color,toneMapped:false,side:THREE.DoubleSide}));
  tree.name=depth<1?'Nearby bare branches':'Farther pine silhouette';tree.userData.houseOutlined=true;root.add(tree);
 }
 return root;
}
