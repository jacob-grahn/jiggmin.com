import {assertUniqueTrim} from './filter-house-trim.mjs';
import {includeFixedFixtures} from './house-fixed-fixtures.mjs';
// Preserve approved placement while reusing the original room shading and UVs.
import * as THREE from 'three';
import {refitBasementModel} from './refit-basement-model.mjs';
import {refitRoomNode,editMesh} from './refit-room-models.mjs';
import {addPlywoodBacking} from './workshop-plywood.mjs';
import {refineBasement,refineHallAndExterior} from './house-night-refinements.mjs';
import {clearWorkshopOpenings,addWorkshopWindowFraming,paintCeilings,addBasementWindowReveals} from './house-finishes.mjs';
import {subtractWindowPrism} from '../web/house-window-openings.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition,dedup} from '@gltf-transform/functions';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),out=process.env.HOUSE_REFERENCE_OUT??'web/assets/house/release';
const family=s=>s.replace(/\.\d{3}$/,'').replaceAll('_',' ').toLowerCase();
function shape(mesh){
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const p of mesh.listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++){const v=a.getElement(i,[]);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}}}
 return [...lo,...hi];
}
const report={style:'original',rooms:{}};
let basementView;
for(const room of ['hallway','workshop','basement','attic']){
 const source=await io.read(`web/assets/house/${room}-baked.glb`);
 if(room==='basement'){
  // Resize only the envelope; original-size furnishings move as rigid assemblies.
  refitBasementModel(source);
  const root=source.getRoot(),scene=root.listScenes()[0],group=source.createNode('Refitted basement assembly');
  const placement=new THREE.Matrix4().makeTranslation(6,-4,3.06);
  basementView={position:[8.7,-2.35,10.5],target:[6.8,-3.05,3],fov:48};
  for(const node of [...scene.listChildren()]){
   if(node.getExtras().bake_connection||node.getCamera()){node.dispose();continue;}
   group.addChild(node);
  }
  group.setMatrix(placement.toArray());scene.addChild(group);
  let restored=0,baked=0;
  for(const node of root.listNodes()){
   const e=node.getExtras();
   if(node.getMesh()){
    node.setExtras({...e,release_room:room,preview_kind:e.bake_static?'shell':'contents',source_object:node.getName(),style_source:node.getName(),...(e.basement_baked?{release_baked:'original-basement'}:{})});restored++;if(e.basement_baked)baked++;
   }
   const light=node.getExtension('KHR_lights_punctual');if(light)light.setIntensity(light.getIntensity()*.012);
  }
  // Cut the approved stair opening out of the inherited ceiling, preserving UVs.
  for(const node of root.listNodes().filter(n=>/^Basement ceiling/.test(n.getName())&&n.getMesh()))for(const primitive of node.getMesh().listPrimitives()){
   const geometry=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1'};
   for(const semantic of primitive.listSemantics()){const a=primitive.getAttribute(semantic);geometry.setAttribute(names[semantic]??semantic,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}
   if(primitive.getIndices())geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(),1));
   const cut=subtractWindowPrism(geometry,new THREE.Matrix4().fromArray(node.getWorldMatrix()),{center:new THREE.Vector3(10.55,-.2,9.21),right:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),size:new THREE.Vector2(2.6,5)},2.64);
   if(cut){primitive.setIndices(null);for(const semantic of primitive.listSemantics()){const a=cut.getAttribute(names[semantic]??semantic);primitive.setAttribute(semantic,source.createAccessor().setType(primitive.getAttribute(semantic).getType()).setArray(a.array).setBuffer(root.listBuffers()[0]));}}
  }
  addBasementWindowReveals(source,await io.read('scene/exports/house/basement.glb'));
  refineBasement(source);
  paintCeilings(source);await source.transform(prune(),unpartition());await io.write(`${out}/${room}.glb`,source);report.rooms[room]={restored,baked};continue;
 }
 const doc=await io.read(`scene/exports/house-release/${room}.glb`);
 if(room==='workshop')for(const node of [...doc.getRoot().listNodes()])if(/^(Printed worn T-shirt|PR2 cartridge screenprint|T-shirt collar)/.test(node.getExtras().source_object??node.getName()))node.dispose();
 const candidates=source.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>({n,s:shape(n.getMesh())}));
 const placements={hallway:[[8.9,0,7.55],[.52,.85,.55],Math.PI/2],workshop:[[14.5,-.15,1.31],[5/6,1,.9],0],attic:[[6,2.8,6],[.85,1,.85],0]};
 const [position,scale,yaw]=placements[room],placement=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...scale));
 const center=(node,s)=>new THREE.Vector3(...s.slice(0,3).map((v,i)=>(v+s[i+3])/2)).applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
 let restored=0,baked=0;
 for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const extras=node.getExtras(),name=family(extras.source_object??node.getName()),s=shape(node.getMesh());
  const target=center(node,s);if(extras.preview_hall_refit)target.x+=1;
  const matches=candidates.filter(c=>family(c.n.getName())===name).map(c=>({...c,d:c.s.reduce((sum,v,i)=>sum+Math.abs(v-s[i]),0),distance:center(c.n,c.s).applyMatrix4(placement).distanceTo(target)})).filter(c=>c.d<.01).sort((a,b)=>a.distance-b.distance);
  const exact=extras.model_refit?candidates.find(c=>c.n.getName()===(extras.refit_source??extras.source_object)):null;
  if(!exact&&(!matches.length||matches[0].d>.01))throw Error(`No original style match: ${room}/${node.getName()}`);
  const original=(exact??matches[0]).n,map=copyToDocument(doc,source,[original.getMesh()]);node.setMesh(map.get(original.getMesh()));
  refitRoomNode(doc,node,original,source,room);
  if(original.getExtras()[`${room}_baked`]){extras.release_baked=`original-${room}`;baked++;}
  node.setExtras({...node.getExtras(),...extras,style_source:original.getName()});restored++;
 }
 // Move the entire plate display onto the clear wall beside the stair door.
 // One bracket was already shifted by the earlier partial refit.
 if(room==='hallway')for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const extras=node.getExtras(),name=extras.source_object??node.getName();
  if(!extras.preview_hall_refit&&/^(?:Kindergarten plate|Ceramic plate back|Plate stand|Plate wall shelf|Shelf brass bracket(?:\.001)?|Plain jar\.002|Jar screw lid\.002)$/.test(name)){
   const world=new THREE.Matrix4().fromArray(node.getWorldMatrix()),parent=node.getParentNode();
   const inverse=parent?new THREE.Matrix4().fromArray(parent.getWorldMatrix()).invert():new THREE.Matrix4();
   node.setMatrix(inverse.multiply(new THREE.Matrix4().makeTranslation(-1,0,0)).multiply(world).toArray());
   node.setExtras({...extras,preview_hall_refit:true,plate_door_clearance:true});
  }
 }
 if(room==='workshop')clearWorkshopOpenings(doc);
 paintCeilings(doc);
 await doc.transform(dedup(),prune(),unpartition());await io.write(`${out}/${room}.glb`,doc);report.rooms[room]={restored,baked};
}
const structure=await io.read('scene/exports/house-release/structure.glb');
// The original basement supplies these surfaces, including its three windows.
for(const node of [...structure.getRoot().listNodes()])if(/^(?:Finish \/ )?(Basement masonry|Basement slab|basement joist|cellar mortar|cellar side|cellar rear|Basement utility light)/i.test(node.getName()))node.dispose();
// New architecture inherits the actual original paint, timber and concrete
// materials, including their texture maps, rather than approximating their colors.
const hall=await io.read('scene/exports/house/hallway.glb'),cellar=await io.read('scene/exports/house/basement.glb');
const sources={plaster:[hall,'Corridor paint'],wall:[hall,'Corridor paint'],wood:[hall,'wood'],oak:[hall,'oak'],floor:[hall,'oak'],door:[hall,'wood'],trim:[hall,'wood'],roof:[hall,'wood'],cream:[hall,'Quiet ceiling'],masonry:[cellar,'Cellar painted plaster'],concrete:[cellar,'concrete']};
for(const mat of [...structure.getRoot().listMaterials()]){
 const kind=mat.getName().split(' / ').at(-1),source=sources[kind];
 if(source){
  const [doc,name]=source,original=doc.getRoot().listMaterials().find(m=>m.getName()===name);
  if(!original)throw Error(`Missing original surface ${name}`);
  const replacement=copyToDocument(structure,doc,[original]).get(original);
  for(const mesh of structure.getRoot().listMeshes())for(const p of mesh.listPrimitives())if(p.getMaterial()===mat)p.setMaterial(replacement);
 }else if(kind==='light'){mat.setBaseColorFactor([.65,.62,.56,1]);mat.setEmissiveFactor([0,0,0]);}
}
// The basement's restored windows need matching air wells in the yard.
for(const node of structure.getRoot().listNodes().filter(n=>/^Yard/.test(n.getName())&&n.getMesh()))for(const primitive of node.getMesh().listPrimitives()){
 const names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1'};let geometry=new THREE.BufferGeometry();
 for(const semantic of primitive.listSemantics()){const a=primitive.getAttribute(semantic);geometry.setAttribute(names[semantic]??semantic,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}
 if(primitive.getIndices())geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(),1));
 let changed=false;
 // These high cellar windows are below grade. Give the wells enough depth for
 // the seated camera to see sky above their far edges rather than the yard slab.
 for(const [x,z,width,depth] of [[3.36,-3.44,4,3.6],[8.64,-3.44,4,3.6],[-1.75,1.96,3.7,3.24]]){
  const cut=subtractWindowPrism(geometry,new THREE.Matrix4().fromArray(node.getWorldMatrix()),{center:new THREE.Vector3(x,-.45,z),right:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),size:new THREE.Vector2(width,4)},depth);
  if(cut){geometry=cut;changed=true;}
 }
 if(changed){primitive.setIndices(null);for(const semantic of primitive.listSemantics()){const a=geometry.getAttribute(names[semantic]??semantic);primitive.setAttribute(semantic,structure.createAccessor().setType(primitive.getAttribute(semantic).getType()).setArray(a.array).setBuffer(structure.getRoot().listBuffers()[0]));}}
}
// The underside of the attic floor is painted ceiling, not exposed floorboards.
const ceilingSource=hall.getRoot().listMaterials().find(m=>m.getName()==='Quiet ceiling');
const ceilingMaterial=copyToDocument(structure,hall,[ceilingSource]).get(ceilingSource);
for(const node of structure.getRoot().listNodes().filter(n=>/^Attic floor \/ hall ceiling/.test(n.getName())&&n.getMesh())){
 const mesh=node.getMesh().clone();node.setMesh(mesh);
 for(const primitive of [...mesh.listPrimitives()]){
  const normal=primitive.getAttribute('NORMAL'),indices=primitive.getIndices(),under=[],other=[],matrix=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  for(let i=0;i<(indices?.getCount()??normal.getCount());i+=3){const tri=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k),n=new THREE.Vector3(...normal.getElement(tri[0],[])).applyMatrix3(matrix);(n.y<-.5?under:other).push(...tri);}
  if(!under.length)continue;
  mesh.removePrimitive(primitive);
  for(const [list,material] of [[under,ceilingMaterial],[other,primitive.getMaterial()]])if(list.length)mesh.addPrimitive(primitive.clone().setMaterial(material).setIndices(structure.createAccessor().setType('SCALAR').setArray(new Uint32Array(list)).setBuffer(structure.getRoot().listBuffers()[0])));
 }
}
// Centre the opening behind the original den camera, retaining its full width.
// Detect the current centre so republishing a refitted source is idempotent.
const denLeaf=structure.getRoot().listNodes().find(n=>n.getExtras().door_id==='den'&&n.getExtras().source_object==='Recessed unmarked door leaf');
const denCentre=denLeaf.getWorldMatrix()[14],denLow=denCentre-.7,denHigh=denCentre+.7;
for(const node of structure.getRoot().listNodes().filter(n=>n.getMesh())){
 const bounds=shape(node.getMesh()),world=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 const box=new THREE.Box3(new THREE.Vector3(...bounds.slice(0,3)),new THREE.Vector3(...bounds.slice(3))).applyMatrix4(world);
 const delta=9.334-denCentre;let move;
 if(node.getExtras().door_id==='den'||/^Finish \/ den (?:casing|head|threshold)/.test(node.getName()))move=new THREE.Matrix4().makeTranslation(0,0,delta);
 else if(box.min.x>=4.69&&box.max.x<=4.91){
  if(Math.abs(box.max.z-denLow)<.01)move=new THREE.Matrix4().makeTranslation(0,0,box.min.z).multiply(new THREE.Matrix4().makeScale(1,1,(box.max.z-box.min.z+delta)/(box.max.z-box.min.z))).multiply(new THREE.Matrix4().makeTranslation(0,0,-box.min.z));
  else if(Math.abs(box.min.z-denHigh)<.01)move=new THREE.Matrix4().makeTranslation(0,0,box.max.z).multiply(new THREE.Matrix4().makeScale(1,1,(box.max.z-box.min.z-delta)/(box.max.z-box.min.z))).multiply(new THREE.Matrix4().makeTranslation(0,0,-box.max.z));
  else if(Math.abs(box.min.z-denLow)<.01&&Math.abs(box.max.z-denHigh)<.01)move=new THREE.Matrix4().makeTranslation(0,0,delta);
 }
 if(move){const parent=node.getParentNode(),inverse=parent?new THREE.Matrix4().fromArray(parent.getWorldMatrix()).invert():new THREE.Matrix4();node.setMatrix(inverse.multiply(move).multiply(world).toArray());}
}
for(const node of structure.getRoot().listNodes().filter(n=>/stair side enclosure/.test(n.getName())&&!n.getExtras().open_lower_stair)){
 const world=new THREE.Matrix4().fromArray(node.getWorldMatrix());editMesh(structure,node,world.clone().invert().multiply(new THREE.Matrix4().makeScale(1,.35,1)).multiply(world));node.setExtras({...node.getExtras(),open_lower_stair:true});
}
const originalWorkshop=await io.read('web/assets/house/workshop-baked.glb');
addPlywoodBacking(structure,originalWorkshop);clearWorkshopOpenings(structure);addWorkshopWindowFraming(structure,originalWorkshop);paintCeilings(structure);
await refineHallAndExterior(structure,hall);
await structure.transform(dedup(),prune(),unpartition());
for(const node of structure.getRoot().listNodes()){
 const fixedWindow=node.getExtras().preview_kind==='window'&&!/glass/i.test(node.getName());
 node.setExtras({...node.getExtras(),...(fixedWindow?{release_dynamic:false,house_window_receiver:true}:{}),style_source:'original-room-palette'});
}
assertUniqueTrim(structure);await io.write(`${out}/structure.glb`,structure);
const layout=JSON.parse(readFileSync('scene/exports/house-release/layout.json'));layout.style='original';layout.lights=[];
layout.views.workshop=JSON.parse(readFileSync('scene/workshop-seating.json')).view;
layout.routes.workshop[layout.routes.workshop.length-1]=layout.views.workshop.position;
for(const room of ['den','hallway','workshop','attic']){layout.source_report[room].staging_scale=[1,1,1];layout.source_report[room].model_refit=room==='den'?'Uniform scene-unit conversion applied to geometry; original game framing preserved':'Original-size furnishings placed as rigid assemblies';}
layout.source_report.basement.staging_scale=[1,1,1];layout.source_report.basement.model_refit='Envelope geometry resized; furnishings repositioned as rigid assemblies';
layout.views.basement=basementView;
// Leave the second flight directly into the view, without the old detour/backtrack.
layout.routes.basement=layout.routes.basement.slice(0,7);layout.routes.basement.push([11.15,-1.65,9.1],basementView.position);
layout.views.den.position=[4.137,1.65,9.334];layout.views.den.target=[-.1255,.968,9.4207];
// The source rooms carry Cycles lightmaps. Connecting walls need the same
// Blender bake; browser spotlights would change both style and frame cost.
delete layout.windowLights;
for(const room of ['structure','hallway','workshop','basement','attic']){
 const hash=createHash('sha256').update(readFileSync(`${out}/${room}.glb`)).digest('hex').slice(0,12);layout.assets[room]=`/web/assets/house/release/${room}.glb?v=${hash}`;
}
rmSync(`${out}/den.glb`,{force:true});
layout.assets.den=null; // The actual live den is cloned at the start of travel.
layout.routes.den=[layout.views.hub.position,[5.55,1.65,7.55],[5.55,1.65,layout.views.den.position[2]],layout.views.den.position];
writeFileSync(`${out}/layout.json`,JSON.stringify(includeFixedFixtures(layout),null,2)+'\n');
writeFileSync('docs/house-plan/style-restoration.json',JSON.stringify(report,null,2)+'\n');console.log(report);

await (await import('./split-house-structure.mjs')).splitHouseStructure({directory:out});
