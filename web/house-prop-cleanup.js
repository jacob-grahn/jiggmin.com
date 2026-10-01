import * as THREE from 'three';
const authoredName=o=>(o.userData.house_bake_source??o.userData.source_object??o.name.replaceAll('_',' ')).replace(/\.?\d{3}$/,'');

// Remove loose decoration before it can become an independent physics body.
// Story artwork, bound books and labels belong to their rigid display objects.
export function tidyHouseProps(model,room){
 model.updateMatrixWorld(true);
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){
  const name=authoredName(mesh);
  if(/^(Blank loose paper|Small plain packing slip|Unmarked rolled paper)$/.test(name))mesh.removeFromParent();
  if(room==='basement'&&/^(Mic stand|Microphone)$/.test(name))mesh.removeFromParent();
 }
 if(room!=='basement')return;
 const basket=meshes.find(o=>authoredName(o)==='Laundry basket base');
 if(basket){
  const base=new THREE.Box3().setFromObject(basket),center=base.getCenter(new THREE.Vector3());
  const clothes=meshes.filter(o=>authoredName(o)==='Ordinary rumpled cloth').filter(o=>{
   const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
   return Math.abs(p.x-center.x)<.35&&Math.abs(p.z-center.z)<.28&&p.y>base.max.y&&p.y<base.max.y+.65;
  });
  const heap=new THREE.Box3();clothes.forEach(o=>heap.union(new THREE.Box3().setFromObject(o)));
  const drop=base.max.y+.012-heap.min.y;
  for(const cloth of clothes){
   const position=cloth.getWorldPosition(new THREE.Vector3());position.y+=drop;
   cloth.position.copy(cloth.parent.worldToLocal(position));cloth.updateMatrixWorld(true);
  }
 }
 // The drooping rag intersects the upper right archive shelf.
 for(const mesh of meshes)if(authoredName(mesh)==='Ordinary rumpled cloth'){
  const b=new THREE.Box3().setFromObject(mesh),p=b.getCenter(new THREE.Vector3());
  if(p.x>9&&p.z<1.5&&p.y>-2.3)mesh.removeFromParent();
 }
 // Replace disconnected concentric rings with a single continuous floor coil.
 const floorCoils=meshes.filter(o=>/^(Coiled spare cable|Trailing cable)$/.test(authoredName(o))&&new THREE.Box3().setFromObject(o).max.y< -3.8);
 if(floorCoils.length){
  floorCoils.forEach(o=>o.removeFromParent());
  const points=[],center=new THREE.Vector3(7.02,-3.963,2.538);
  for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*6,r=.12+.29*t;points.push(new THREE.Vector3(center.x+Math.cos(a)*r,center.y+.005*Math.sin(a),center.z+Math.sin(a)*r));}
  points.push(new THREE.Vector3(7.57,-3.963,2.59),new THREE.Vector3(7.78,-3.963,2.72),new THREE.Vector3(7.91,-3.963,2.75));
  const rope=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),160,.014,6,false),new THREE.MeshBasicMaterial({color:0x10171b,toneMapped:false}));
  rope.name='Coiled spare cable';rope.userData.release_room='basement';rope.userData.houseOutlined=true;
  model.updateMatrixWorld(true);rope.geometry.applyMatrix4(model.matrixWorld.clone().invert());model.add(rope);
 }
}
