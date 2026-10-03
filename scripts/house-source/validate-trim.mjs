import * as THREE from 'three';
export function findDuplicateTrim(doc){
 const seen=new Map(),removed=[];
 for(const node of [...doc.getRoot().listNodes()]){
  if(!node.getMesh()||!/^Finish \//.test(node.getName())||!/ceiling moulding|skirting/.test(node.getName()))continue;
  const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),vertices=new Set();let triangles=0;
  for(const p of node.getMesh().listPrimitives()){
   const pos=p.getAttribute('POSITION');triangles+=(p.getIndices()?.getCount()??pos.getCount())/3;
   for(let i=0;i<pos.getCount();i++)vertices.add(new THREE.Vector3(...pos.getElement(i,[])).applyMatrix4(matrix).toArray().map(v=>Math.round(v*10000)).join(','));
  }
  // Only complete rectangular boards, independent of their diagonal triangulation.
  if(vertices.size!==8||triangles!==12)continue;
  const key=[...vertices].sort().join('|'),original=seen.get(key);
  if(original){removed.push({id:node.getExtras().house_bake_id,name:node.getName(),retained:original.getExtras().house_bake_id,group:node.getExtras().release_baked});}
  else seen.set(key,node);
 }
 return removed;
}
export function assertUniqueTrim(doc){
 const duplicates=findDuplicateTrim(doc);
 if(duplicates.length)throw Error(`Duplicate trim: ${duplicates.map(d=>d.name).join(', ')}. Fix the authoring scene before baking.`);
}
