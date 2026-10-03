import * as THREE from 'three';
import {mergeGeometries} from '../../web/vendor/three/BufferGeometryUtils.js';

// Fixed seeds keep the grove stable across visits. Bent limbs, unequal forks,
// and small overlapping leaf sprays give each silhouette a different outline.
export function createNaturalTree(seed,{height=6,leafy=true}={}){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const parts=[],up=new THREE.Vector3(0,1,0);
 function limb(start,end,radius){
  const delta=end.clone().sub(start),g=new THREE.CylinderGeometry(radius*.58,radius,delta.length(),7);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));
  g.translate(...start.clone().add(end).multiplyScalar(.5).toArray());parts.push(g);
 }
 function leaves(center,size){
  for(let i=0;i<9;i++){
   const g=new THREE.SphereGeometry(1,6,4),angle=random()*Math.PI*2,r=Math.sqrt(random())*size;
   const p=center.clone().add(new THREE.Vector3(Math.cos(angle)*r,(random()-.5)*size,Math.sin(angle)*r));
   const s=size*(.12+random()*.18);g.scale(s,s*(.5+random()*.7),s*(.65+random()*.5));
   g.rotateZ(random()*3);g.translate(...p.toArray());parts.push(g);
  }
 }
 function fork(start,direction,length,radius,depth){
  const middle=start.clone().addScaledVector(direction,length*.51);
  middle.x+=(random()-.5)*length*.17;middle.z+=(random()-.5)*length*.17;
  const end=middle.clone().addScaledVector(direction,length*.49);
  limb(start,middle,radius);limb(middle,end,radius*.76);
  if(depth===0){if(leafy)leaves(end,length*.65);return;}
  const count=depth===3?3:2;
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,spread=.4+random()*.7;
   const next=direction.clone().multiplyScalar(.5).add(new THREE.Vector3(Math.cos(angle)*spread,.3+random()*.6,Math.sin(angle)*spread)).normalize();
   fork(i===0?middle:end,next,length*(.53+random()*.22),radius*.55,depth-1);
  }
 }
 let start=new THREE.Vector3(),lean=new THREE.Vector3((random()-.5)*.28,1,(random()-.5)*.22).normalize();
 for(let i=0;i<5;i++){
  const end=start.clone().addScaledVector(lean,height/5);limb(start,end,height*(.022-i*.0037));
  if(i>0){
   const angle=i*2.399+random()*.8,dir=new THREE.Vector3(Math.cos(angle),.5+random()*.7,Math.sin(angle)).normalize();
   fork(end,dir,height*(.31+random()*.14)*(1-i*.08),height*.014*(1-i*.13),3);
  }
  start=end;lean.x+=(random()-.5)*.08;lean.z+=(random()-.5)*.08;lean.normalize();
 }
 const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({name:'Exterior ink tree',color:0x000000,toneMapped:false}));
 mesh.name=leafy?'Irregular leafy tree':'Nearby bare branches';mesh.userData.houseOutlined=true;return mesh;
}

export function replaceExteriorTrees(root){
 root.updateMatrixWorld(true);
 const old=[],positions=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.userData.house_tree_silhouette)return;
  old.push(mesh);
  if(/^(?:Tree trunk|Finish \/ window-view tree trunk)/.test(mesh.userData.house_bake_source??mesh.name.replaceAll('_',' ')))positions.push(mesh.getWorldPosition(new THREE.Vector3()));
 });
 old.forEach(mesh=>{mesh.visible=false;});
 const grove=new THREE.Group();grove.name='Natural exterior grove';
 const inverse=root.matrixWorld.clone().invert();
 positions.forEach((p,i)=>{
  const seed=472+i*97,tree=createNaturalTree(seed,{height:5.2+(i%5)*.47});
  // Existing trunk origins sit at their midpoints, around two meters above grade.
  p.y=p.x>10&&p.z<0?-2.7:0;tree.position.copy(p.applyMatrix4(inverse));grove.add(tree);
 });
 root.add(grove);return grove;
}
