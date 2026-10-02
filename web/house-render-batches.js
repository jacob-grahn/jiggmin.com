import * as THREE from 'three';
import {accelerateRaycasts} from './raycast-acceleration.js';
import {mergeGeometries} from './vendor/three/BufferGeometryUtils.js';

// Batch within one rigid prop or small static cells, preserving UVs, room layers,
// clipping and physics ownership. Doors, ladders and special surface shaders stay
// separate. Original resources remain owned by the room until it is unloaded.
export function batchHouseMeshes(root,{staticCells=false}={}){
 // Keep shallow picture assemblies intact: merging their backing and contour
 // meshes can put the contour in front of the separate artwork plane.
 if(!staticCells){
  let artwork=false;
  root.traverse(mesh=>{if(mesh.isMesh&&(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>/print|artwork/i.test(m.name)))artwork=true;});
  if(artwork)return 0;
 }
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.isSkinnedMesh)return;
  for(let o=mesh;o&&o!==root;o=o.parent){
   if(!o.visible||staticCells&&(o.userData.hotspot||['door','ladder'].includes(o.userData.preview_kind)))return;
  }
  const m=mesh.material,key=m.customProgramCacheKey();
  if(m.transparent||m.uniforms||/basement-floor-wear|plain-cream|ceiling-reference/.test(key))return;
  const maps=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','alphaMap'].map(k=>m[k]?.uuid??null);
  const position=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  const cell=staticCells?position.toArray().map(n=>Math.floor(n/3)).join(','):'';
  const signature=JSON.stringify([m.type,maps,m.color?.getHex(),m.emissive?.getHex(),m.emissiveIntensity,m.roughness,m.metalness,m.normalScale?.toArray(),m.side,m.toneMapped,m.depthWrite,m.depthTest,key,
   m.clippingPlanes?.map(p=>[...p.normal.toArray(),p.constant]),mesh.layers.mask,Boolean(mesh.userData.houseInk),cell,Object.entries(mesh.geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>[name,a.itemSize,a.normalized,(a.array??a.data.array).constructor.name])]);
  const list=groups.get(signature)??[];list.push(mesh);groups.set(signature,list);
 });
 let removed=0;
 for(const meshes of groups.values()){
  if(meshes.length<2)continue;
  const copies=meshes.map(mesh=>{
   let geometry=mesh.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
   // Imported models can mix indexed and non-indexed meshes in one material.
   if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
   for(const attribute of Object.values(geometry.attributes))attribute.gpuType=THREE.FloatType;
   geometry.clearGroups();return geometry;
  });
  const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());if(!geometry)continue;
  const first=meshes[0],batch=new THREE.Mesh(geometry,first.material);
  batch.name=first.userData.houseInk?'House ink contour batch':'House rigid surface batch';
  Object.assign(batch.userData,first.userData,{houseOutlined:true});batch.layers.mask=first.layers.mask;
  if(first.userData.houseInk)batch.raycast=()=>{};
  else accelerateRaycasts([batch]);
  // Extract all batches before deleting source parents and their contour children.
  root.add(batch);for(const mesh of meshes){for(const child of [...mesh.children])root.attach(child);mesh.removeFromParent();}removed+=meshes.length-1;
 }
 return removed;
}
