import * as THREE from 'three';
import {createNaturalTree} from './house-exterior-trees.js';

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

// Branches live outside the wall; ordinary perspective supplies the parallax.
export function createWindowTrees(frame){
 const root=new THREE.Group();root.name='Window exterior trees';
 const {center,right,normal,size}=frame,up=new THREE.Vector3(0,1,0);
 const height=Math.max(size.y,1),seed=Math.abs(Math.round(center.x*1237+center.z*4711));
 const basis=new THREE.Matrix4().makeBasis(right,up,normal);
 root.position.copy(center);root.quaternion.setFromRotationMatrix(basis);
 for(const [x,depth,leafy,offset] of [[-.75,.85,false,0],[.9,2.8,true,81]]){
  const tree=createNaturalTree(seed+offset,{height:height*3.4,leafy});
  tree.position.set(x*height,-height*1.7,depth);root.add(tree);
 }
 return root;
}
