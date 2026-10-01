// Refit inherited furniture as rigid assemblies, with no room-wide fitting scale.
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
export const ROOM_REFIT=JSON.parse(readFileSync(new URL('../scene/room-refit.json',import.meta.url)));
const up=v=>new THREE.Vector3(v[0],v[2],-v[1]);
export function meshCenter(node){
 const box=new THREE.Box3();for(const p of node.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');box.union(new THREE.Box3(new THREE.Vector3(...a.getMin([])),new THREE.Vector3(...a.getMax([]))));}
 return box.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix())).getCenter(new THREE.Vector3());
}
export function editMesh(doc,node,matrix){
 const mesh=node.getMesh().clone(),normal=new THREE.Matrix3().getNormalMatrix(matrix);node.setMesh(mesh);
 for(const p of [...mesh.listPrimitives()]){
  const own=p.clone();mesh.removePrimitive(p);mesh.addPrimitive(own);
  for(const semantic of ['POSITION','NORMAL']){
   const source=own.getAttribute(semantic);if(!source)continue;
   const a=source.clone().setArray(source.getArray().slice());own.setAttribute(semantic,a);
   for(let i=0;i<a.getCount();i++){const v=new THREE.Vector3(...source.getElement(i,[]));if(semantic==='POSITION')v.applyMatrix4(matrix);else v.applyMatrix3(normal).normalize();a.setElement(i,v.toArray());}
  }
 }
}
export function refitRoomNode(doc,node,original,source,room){
 const spec=ROOM_REFIT[room],matrix=new THREE.Matrix4().fromArray(original.getWorldMatrix()),center=meshCenter(original);
 const rotation=new THREE.Matrix4().makeRotationY(spec.yaw),placement=new THREE.Matrix4().makeTranslation(...up(spec.translation).toArray()).multiply(rotation);
 const e=node.getExtras(),name=original.getName();let world=placement.clone().multiply(matrix),kind='rigid';
 if(e.preview_fitted_runner||/runner|fringe/i.test(name)){
  const scale=new THREE.Matrix4().makeScale(spec.runner_scale[0],spec.runner_scale[2],spec.runner_scale[1]);
  editMesh(doc,node,matrix.clone().invert().multiply(scale).multiply(matrix));kind='tailored-runner';
 }else if(spec.architecture&&new RegExp(spec.architecture).test(name)){
  const scale=new THREE.Matrix4().makeScale(spec.architecture_scale[0],spec.architecture_scale[2],spec.architecture_scale[1]);
  editMesh(doc,node,matrix.clone().invert().multiply(scale).multiply(matrix));kind='framing';
 }else if(room==='hallway'){
  let station=spec.assemblies.find(a=>new RegExp(a.names).test(name));
  const references=spec.assemblies.map(a=>({station:a,node:source.getRoot().listNodes().find(n=>n.getMesh()&&n.getName()===a.reference)})).filter(a=>a.node);
  if(!station){const nearest=references.map(a=>({...a,d:meshCenter(a.node).distanceTo(center)})).sort((a,b)=>a.d-b.d)[0];if(nearest?.d<.65)station=nearest.station;}
  const reference=references.find(a=>a.station===station)?.node,anchor=reference?meshCenter(reference):center;
  const delta=anchor.clone().multiply(new THREE.Vector3(spec.old_scale[0]-1,0,spec.old_scale[1]-1)).applyMatrix4(rotation);
  if(station?.offset)delta.add(up(station.offset));
  world.premultiply(new THREE.Matrix4().makeTranslation(...delta.toArray()));
  if(station?.offset)e.preview_hall_refit=true;
 }else if(room==='workshop'&&/^(Garage offcuts box|Ordinary rumpled cloth)/.test(name))world.premultiply(new THREE.Matrix4().makeTranslation(-.4,0,0));
 if(room==='workshop'){
  const station=spec.assemblies.find(a=>new RegExp(a.names).test(name));
  if(station){world.premultiply(new THREE.Matrix4().makeTranslation(...up(station.offset).toArray()));e.workshop_display_offset=station.offset;}
 }
 const parent=node.getParentNode();node.setMatrix((parent?new THREE.Matrix4().fromArray(parent.getWorldMatrix()).invert():new THREE.Matrix4()).multiply(world).toArray());
 node.setExtras({...e,model_refit:room,refit_kind:kind,refit_source:name});
}
