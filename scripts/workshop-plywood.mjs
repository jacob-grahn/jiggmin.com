import * as THREE from 'three';
import {copyToDocument} from '@gltf-transform/functions';
import {editMesh} from './refit-room-models.mjs';
import {subtractWindowPrism} from './house-source/house-window-openings.js';
export const PLYWOOD_PANELS=[
 {name:'Workshop plywood rear',source:'Garage raw rear sheathing',center:[14.5,1.225,-.13],size:[4.86,2.75,.06],opening:{center:[14.45,1.625,-.13],size:[2.3,1.25],normal:[0,0,1],right:[1,0,0]}},
 {name:'Workshop plywood left',source:'Unfinished side sheathing',center:[12.07,1.225,3.3],size:[.06,2.75,7],opening:{center:[12.07,1.075,5.6],size:[1,2.15],normal:[1,0,0],right:[0,0,1]}},
 {name:'Workshop plywood right',source:'Unfinished side sheathing',center:[16.93,1.225,3.3],size:[.06,2.75,7],opening:{center:[16.93,1.625,2.8],size:[1.6,1.25],normal:[1,0,0],right:[0,0,1]}}
];
export function addPlywoodBacking(doc,source){
 for(const n of [...doc.getRoot().listNodes()])if(n.getExtras().workshop_plywood)n.dispose();
 for(const panel of PLYWOOD_PANELS){
  const original=source.getRoot().listNodes().find(n=>n.getName()===panel.source),mesh=copyToDocument(doc,source,[original.getMesh()]).get(original.getMesh());
  const node=doc.createNode(panel.name).setMesh(mesh).setExtras({workshop_plywood:true,release_room:'structure',preview_kind:'shell',release_baked:'original-workshop',style_source:panel.source});doc.getRoot().listScenes()[0].addChild(node);
  const bounds=new THREE.Box3();for(const p of mesh.listPrimitives()){const a=p.getAttribute('POSITION');bounds.union(new THREE.Box3(new THREE.Vector3(...a.getMin([])),new THREE.Vector3(...a.getMax([]))));}bounds.applyMatrix4(new THREE.Matrix4().fromArray(original.getWorldMatrix()));
  const ratio=new THREE.Vector3(...panel.size).divide(bounds.getSize(new THREE.Vector3()));
  const transform=new THREE.Matrix4().makeTranslation(...panel.center).multiply(new THREE.Matrix4().makeScale(...ratio.toArray())).multiply(new THREE.Matrix4().makeTranslation(...bounds.getCenter(new THREE.Vector3()).negate().toArray())).multiply(new THREE.Matrix4().fromArray(original.getWorldMatrix()));
  editMesh(doc,node,transform);
  const frame=panel.opening;
  for(const p of node.getMesh().listPrimitives()){
   const g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1'};
   for(const sem of p.listSemantics()){const a=p.getAttribute(sem);g.setAttribute(names[sem]??sem,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
   const cut=subtractWindowPrism(g,new THREE.Matrix4(),{center:new THREE.Vector3(...frame.center),right:new THREE.Vector3(...frame.right),normal:new THREE.Vector3(...frame.normal),size:new THREE.Vector2(...frame.size)},.5);
   if(cut){p.setIndices(null);for(const sem of p.listSemantics()){const a=cut.getAttribute(names[sem]??sem);p.setAttribute(sem,doc.createAccessor().setType(p.getAttribute(sem).getType()).setArray(a.array).setBuffer(doc.getRoot().listBuffers()[0]));}}
  }
 }
}
