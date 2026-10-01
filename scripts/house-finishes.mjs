// Paint and window-framing changes shared by every reference-style publish.
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {copyToDocument} from '@gltf-transform/functions';
import {editMesh} from './refit-room-models.mjs';
import {PLYWOOD_PANELS} from './workshop-plywood.mjs';
import {subtractWindowPrism} from '../web/house-window-openings.js';
import {windowExteriorFrame} from '../web/house-window-exterior.js';
export const FINISHES=JSON.parse(readFileSync(new URL('../scene/house-finishes.json',import.meta.url)));
const names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1'};
// The cellar's thick wall reveals previously existed only as unlit runtime caps.
// Author the same pieces in the assembly so Cycles can light their inner edges.
export function addBasementWindowReveals(doc,source){
 for(const n of [...doc.getRoot().listNodes()])if(n.getExtras().house_window_reveal)n.dispose();
 const wood=source.getRoot().listNodes().find(n=>n.getName()==='Deep sill').getMesh().listPrimitives()[0].getMaterial();
 const material=copyToDocument(doc,source,[wood]).get(wood),buffer=doc.getRoot().listBuffers()[0];
 const windows=doc.getRoot().listNodes().filter(n=>/^Garden beyond window/.test(n.getName())&&n.getMesh());
 windows.forEach((node,i)=>{
  const p=node.getMesh().listPrimitives()[0],g=new THREE.BufferGeometry();
  for(const [from,to] of [['POSITION','position'],['NORMAL','normal']]){const a=p.getAttribute(from);g.setAttribute(to,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}
  const window=new THREE.Mesh(g);window.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  const frame=windowExteriorFrame(window);if(frame.normal.dot(new THREE.Vector3(6,-2,6).sub(frame.center))>0){frame.normal.negate();frame.right.negate();}
  const w=frame.size.x-.04,h=frame.size.y-.04,t=.06,depth=.42;
  const basis=new THREE.Matrix4().makeBasis(frame.right,new THREE.Vector3(0,1,0),frame.normal).setPosition(frame.center);
  for(const [label,x,y,sx,sy] of [['left',-(w+t)/2,0,t,h+2*t],['right',(w+t)/2,0,t,h+2*t],['bottom',0,-(h+t)/2,w,t],['top',0,(h+t)/2,w,t]]){
   const geometry=new THREE.BoxGeometry(sx,sy,depth);geometry.translate(x,y,depth/2-.16);
   const primitive=doc.createPrimitive().setMaterial(material);
   for(const [sem,attr,type] of [['POSITION','position','VEC3'],['NORMAL','normal','VEC3'],['TEXCOORD_0','uv','VEC2']])primitive.setAttribute(sem,doc.createAccessor().setType(type).setArray(geometry.attributes[attr].array).setBuffer(buffer));
   primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
   const name=`Baked window reveal ${i} ${label}`;
   doc.getRoot().listScenes()[0].addChild(doc.createNode(name).setMatrix(basis.toArray()).setMesh(doc.createMesh(name).addPrimitive(primitive)).setExtras({
    house_window_reveal:true,house_window_receiver:true,release_room:'basement',preview_kind:'shell',bake_static:true,refit_assembly:'envelope',source_object:name,style_source:'Deep sill'
   }));geometry.dispose();
  }
  g.dispose();
 });
}
export function clearWorkshopOpenings(doc){
 // The original rear-wall framing owns this wall. The new window king/jack
 // assemblies replace two regular studs; the added rear row was redundant.
 for(const node of [...doc.getRoot().listNodes()]){
  const name=node.getExtras().refit_source??node.getExtras().source_object??node.getName();
  if(/^Finish \/ garage rear stud(?:\.\d+)?$/.test(name)||FINISHES.superseded_workshop_studs.includes(name))node.dispose();
 }
 const s=FINISHES.workshop_window_framing;
 for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh()&&/^(Exposed garage wall stud|Side exposed stud|Finish \/ garage (side|rear) stud)/.test(n.getExtras().source_object??n.getName()))){
  const mesh=node.getMesh().clone();node.setMesh(mesh);
  for(const old of [...mesh.listPrimitives()]){
   let g=new THREE.BufferGeometry();for(const sem of old.listSemantics()){const a=old.getAttribute(sem);g.setAttribute(names[sem]??sem,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}if(old.getIndices())g.setIndex(new THREE.BufferAttribute(old.getIndices().getArray(),1));
   let changed=false;
   for(const panel of PLYWOOD_PANELS){const f=panel.opening;const cut=subtractWindowPrism(g,new THREE.Matrix4().fromArray(node.getWorldMatrix()),{center:new THREE.Vector3(...f.center),normal:new THREE.Vector3(...f.normal),right:new THREE.Vector3(...f.right),size:new THREE.Vector2(f.size[0]+2*s.opening_clearance,f.size[1]+2*s.opening_clearance)},.8);if(cut){g=cut;changed=true;}}
   if(changed){const p=old.clone();mesh.removePrimitive(old);mesh.addPrimitive(p);p.setIndices(null);for(const sem of p.listSemantics()){const a=g.getAttribute(names[sem]??sem);p.setAttribute(sem,doc.createAccessor().setType(p.getAttribute(sem).getType()).setArray(a.array).setBuffer(doc.getRoot().listBuffers()[0]));}node.setExtras({...node.getExtras(),workshop_opening_cut:true});}
  }
 }
}
export function windowFramingParts(){
 const s=FINISHES.workshop_window_framing,parts=[];
 for(const panel of PLYWOOD_PANELS.filter(p=>p.name!=='Workshop plywood left')){
  const f=panel.opening,center=new THREE.Vector3(...f.center),right=new THREE.Vector3(...f.right),normal=new THREE.Vector3(...f.normal);
  center.addScaledVector(normal,panel.name.endsWith('right')?-.10:.23);
  const low=f.center[1]-f.size[1]/2-s.opening_clearance,high=f.center[1]+f.size[1]/2+s.opening_clearance,half=f.size[0]/2+s.opening_clearance;
  const add=(label,u,y,w,h)=>{const p=center.clone().addScaledVector(right,u);p.y=y;parts.push({name:`${panel.name} window ${label}`,center:p.toArray(),size:normal.z?[w,h,s.depth]:[s.depth,h,w],window:panel.name});};
  for(const sign of [-1,1]){
   add(`king ${sign}`,sign*(half+s.stud_width*1.5),(s.floor_y+s.top_y)/2,s.stud_width,s.top_y-s.floor_y);
   add(`jack ${sign}`,sign*(half+s.stud_width*.5),(s.floor_y+high)/2,s.stud_width,high-s.floor_y);
  }
  add('header',0,high+s.header_height/2,(half+s.stud_width)*2,s.header_height);
  add('sill',0,low-s.stud_width/2,half*2,s.stud_width);
 }
 return parts;
}
export function addWorkshopWindowFraming(doc,source){
 for(const n of [...doc.getRoot().listNodes()])if(n.getExtras().workshop_window_frame)n.dispose();
 const original=source.getRoot().listNodes().find(n=>n.getName()==='Exposed garage wall stud'),b=new THREE.Box3();for(const p of original.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');b.union(new THREE.Box3(new THREE.Vector3(...a.getMin([])),new THREE.Vector3(...a.getMax([]))));}b.applyMatrix4(new THREE.Matrix4().fromArray(original.getWorldMatrix()));
 for(const part of windowFramingParts()){
  const mesh=copyToDocument(doc,source,[original.getMesh()]).get(original.getMesh()),node=doc.createNode(part.name).setMesh(mesh).setExtras({workshop_window_frame:true,window:part.window,preview_kind:'shell',release_room:'structure',release_baked:'original-workshop',style_source:original.getName()});doc.getRoot().listScenes()[0].addChild(node);
  const ratio=new THREE.Vector3(...part.size).divide(b.getSize(new THREE.Vector3()));editMesh(doc,node,new THREE.Matrix4().makeTranslation(...part.center).multiply(new THREE.Matrix4().makeScale(...ratio.toArray())).multiply(new THREE.Matrix4().makeTranslation(...b.getCenter(new THREE.Vector3()).negate().toArray())).multiply(new THREE.Matrix4().fromArray(original.getWorldMatrix())));
 }
}
export function paintCeilings(doc){
 const paint=doc.createMaterial(FINISHES.ceiling.name).setBaseColorFactor([...FINISHES.ceiling.linear_rgb,1]).setRoughnessFactor(FINISHES.ceiling.roughness).setDoubleSided(true);
 for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const name=node.getExtras().source_object??node.getName();
  if(!/ceiling|Main pitched roof|Garage pitched roof|^Attic hatch$/i.test(name)||/light|lamp|canopy|fixture|stem/i.test(name))continue;
  const mesh=node.getMesh().clone();node.setMesh(mesh);const split=/floor \/ hall ceiling|pitched roof/i.test(name),normalMatrix=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  for(const old of [...mesh.listPrimitives()]){
   const indices=old.getIndices(),normal=old.getAttribute('NORMAL'),painted=[],other=[];
   for(let i=0;i<(indices?.getCount()??normal.getCount());i+=3){const tri=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k),n=new THREE.Vector3(...normal.getElement(tri[0],[])).applyMatrix3(normalMatrix).normalize();(!split||n.y<-.5?painted:other).push(...tri);}
   if(!painted.length)continue;mesh.removePrimitive(old);
   let material=paint;
   if(node.getExtras().release_baked){material=old.getMaterial().clone().setName(FINISHES.ceiling.name+' / reference lighting');material.setExtras({...material.getExtras(),ceiling_paint:FINISHES.ceiling.linear_rgb});}
   for(const [list,m]of [[painted,material],[other,old.getMaterial()]])if(list.length)mesh.addPrimitive(old.clone().setMaterial(m).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(list)).setBuffer(doc.getRoot().listBuffers()[0])));
  }
  node.setExtras({...node.getExtras(),ceiling_paint:'light cream'});
 }
}
