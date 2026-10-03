import * as THREE from 'three';
import {KHRMaterialsUnlit} from '@gltf-transform/extensions';
const names={POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv',TEXCOORD_1:'uv1',COLOR_0:'color'};
// Edit the actual export graph without decoding images or changing existing materials.
export function editModel(doc){
 const root=new THREE.Group(),nodes=new Map(),primitives=new Map(),materials=new Map();
 function build(n){
  let o=new THREE.Group();
  for(const p of n.getMesh()?.listPrimitives()??[]){
   const g=new THREE.BufferGeometry();for(const semantic of p.listSemantics()){const a=p.getAttribute(semantic);g.setAttribute(names[semantic]??semantic,new THREE.BufferAttribute(a.getArray().slice(),a.getElementSize(),a.getNormalized()));}
   if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray().slice(),1));
   const m=new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),source=p.getMaterial();if(source){m.name=source.getName();m.color.fromArray(source.getBaseColorFactor());materials.set(m,source);}
   const mesh=new THREE.Mesh(g,m);mesh.name=n.getName();mesh.userData={...n.getExtras()};if(n.getMesh().listPrimitives().length===1)o=mesh;else o.add(mesh);primitives.set(mesh,p);
  }
  o.name=n.getName();o.userData={...n.getExtras()};o.applyMatrix4(new THREE.Matrix4().fromArray(n.getMatrix()));nodes.set(o,n);
  for(const child of n.listChildren())o.add(build(child));return o;
 }
 const scene=doc.getRoot().listScenes()[0];root.userData={...scene.getExtras()};for(const n of scene.listChildren())root.add(build(n));root.updateMatrixWorld(true);
 function save(){
  const usedNames=new Set(doc.getRoot().listNodes().map(n=>n.getName()));
  const uniqueName=name=>{let candidate=name,i=1;while(usedNames.has(candidate))candidate=name+'.'+String(i++).padStart(3,'0');usedNames.add(candidate);return candidate;};
  const alive=new Set();root.traverse(o=>alive.add(o));for(const [o,n]of nodes)if(!alive.has(o)||!o.visible)n.dispose();
  const buffer=doc.getRoot().listBuffers()[0]??doc.createBuffer();
  function material(m){if(materials.has(m))return materials.get(m);const result=doc.createMaterial(m.name).setBaseColorFactor([...m.color.toArray(),m.opacity]).setRoughnessFactor(m.roughness??1).setMetallicFactor(m.metalness??0).setDoubleSided(m.side===THREE.DoubleSide);if(m.isMeshBasicMaterial)result.setExtension('KHR_materials_unlit',doc.createExtension(KHRMaterialsUnlit).createUnlit());materials.set(m,result);return result;}
  function geometry(o){if(!materials.has(o.material))Object.assign(o.userData,{house_authored_reflectance:true,bake_connection:true});const p=doc.createPrimitive().setMaterial(material(o.material));for(const [name,a]of Object.entries(o.geometry.attributes)){const semantic=Object.entries(names).find(([,v])=>v===name)?.[0]??name;const values=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.getComponent(i,k);p.setAttribute(semantic,doc.createAccessor().setType(['','SCALAR','VEC2','VEC3','VEC4'][a.itemSize]).setArray(values).setBuffer(buffer));}if(o.geometry.index)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(o.geometry.index.array.slice()).setBuffer(buffer));return p;}
  function write(o,parent){
   if(!o.visible)return;
   // Original primitive wrappers remain part of their authored node.
   if(primitives.has(o)&&!nodes.has(o))return;
   const n=nodes.get(o)??doc.createNode(uniqueName(o.name));o.updateMatrix();n.setMatrix(o.matrix.toArray()).setExtras({...o.userData});parent.addChild(n);
   const meshes=o.children.filter(c=>c.isMesh&&primitives.has(c)&&!nodes.has(c)&&c.visible&&c.geometry.attributes.position.count);
   if(o.isMesh&&o.geometry.attributes.position.count)meshes.push(o);
   if(meshes.length){const mesh=doc.createMesh(n.getName());for(const part of meshes){part.updateMatrix();let p=geometry(part);if(part!==o&&!part.matrix.equals(new THREE.Matrix4())){part.updateMatrix();const g=part.geometry.clone().applyMatrix4(part.matrix),original=part.geometry;part.geometry=g;p=geometry(part);part.geometry=original;g.dispose();}mesh.addPrimitive(p);Object.assign(o.userData,part.userData);}n.setMesh(mesh);n.setExtras({...o.userData});}
   else n.setMesh(null);
   for(const c of o.children)write(c,n);
  }
  for(const o of root.children)write(o,scene);
 }
 return {root,save,materials,nodes};
}
