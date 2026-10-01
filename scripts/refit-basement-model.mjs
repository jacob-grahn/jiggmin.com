import * as THREE from 'three';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('../scene/basement-refit.json',import.meta.url)));
const native=v=>[v.x,-v.z,v.y];
const center=node=>{
 const box=new THREE.Box3();for(const p of node.getMesh().listPrimitives()){
  const a=p.getAttribute('POSITION');box.union(new THREE.Box3(new THREE.Vector3(...a.getMin([])),new THREE.Vector3(...a.getMax([]))));
 }
 return box.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix())).getCenter(new THREE.Vector3());
};
export function refitBasementModel(doc){
 const nodes=doc.getRoot().listNodes().filter(n=>n.getMesh()),centers=new Map(nodes.map(n=>[n,center(n)]));
 const windows=nodes.filter(n=>/^Garden beyond window/.test(n.getName())).map(n=>native(centers.get(n)));
 const reshape=new THREE.Matrix4().makeScale(spec.envelope[0],spec.envelope[2],spec.envelope[1]);
 for(const node of nodes){
  const name=node.getName(),original=new THREE.Matrix4().fromArray(node.getWorldMatrix()),c=centers.get(node),p=native(c);
  const architectural=new RegExp(spec.architecture).test(name);
  let anchor;
  if(/^(Garden beyond window|Window (jamb|rail|cross|transom)|Deep sill)/.test(name))anchor=windows.reduce((a,b)=>Math.hypot(p[0]-a[0],p[1]-a[1])<Math.hypot(p[0]-b[0],p[1]-b[1])?a:b);
  else anchor=spec.assemblies.find(a=>new RegExp(a.names).test(name))?.anchor??spec.assemblies.find(a=>a.region&&p.every((v,i)=>v>=a.region[i*2]&&v<=a.region[i*2+1]))?.anchor;
  anchor??=p;
  const delta=new THREE.Vector3(anchor[0]*(spec.envelope[0]-1),0,-anchor[1]*(spec.envelope[1]-1));
  const world=new THREE.Matrix4().makeTranslation(...delta.toArray()).multiply(original),parent=node.getParentNode();
  node.setMatrix((parent?new THREE.Matrix4().fromArray(parent.getWorldMatrix()).invert():new THREE.Matrix4()).multiply(world).toArray());
  if(architectural){
   // Resize actual envelope vertices, keeping the room root at unit scale.
   // Each primitive/accessor is owned so shared source furniture is untouched.
   const mesh=node.getMesh().clone(),edit=world.clone().invert().multiply(reshape).multiply(original),normal=new THREE.Matrix3().getNormalMatrix(edit);node.setMesh(mesh);
   for(const primitive of [...mesh.listPrimitives()]){
    const own=primitive.clone();mesh.removePrimitive(primitive);mesh.addPrimitive(own);
    for(const semantic of ['POSITION','NORMAL']){
     const source=own.getAttribute(semantic);if(!source)continue;
     const accessor=source.clone().setArray(source.getArray().slice()),v=new THREE.Vector3();own.setAttribute(semantic,accessor);
     for(let i=0;i<accessor.getCount();i++){v.fromArray(source.getElement(i,[]));if(semantic==='POSITION')v.applyMatrix4(edit);else v.applyMatrix3(normal).normalize();accessor.setElement(i,v.toArray());}
    }
   }
  }
  node.setExtras({...node.getExtras(),basement_model_refit:true,refit_assembly:architectural?'envelope':anchor.slice(0,2).join(',')});
 }
}
