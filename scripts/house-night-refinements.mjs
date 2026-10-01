import * as THREE from 'three';
import sharp from 'sharp';
import {copyToDocument} from '@gltf-transform/functions';

function addMesh(doc,name,geometry,material,position,extras={}){
 const buffer=doc.getRoot().listBuffers()[0],p=doc.createPrimitive().setMaterial(material);
 for(const [semantic,attribute,type] of [['POSITION','position','VEC3'],['NORMAL','normal','VEC3'],['TEXCOORD_0','uv','VEC2']]){
  const a=geometry.getAttribute(attribute);if(a)p.setAttribute(semantic,doc.createAccessor().setType(type).setArray(a.array).setBuffer(buffer));
 }
 if(geometry.index)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
 const node=doc.createNode(name).setTranslation(position).setMesh(doc.createMesh(name).addPrimitive(p)).setExtras({style_source:'original-room-palette',...extras});
 doc.getRoot().listScenes()[0].addChild(node);geometry.dispose();return node;
}

export function refineBasement(doc){
 // This cloth was left suspended beside the pool table after its low table went.
 for(const n of [...doc.getRoot().listNodes()])if(n.getName()==='Ordinary rumpled cloth.003'||n.getExtras().house_fixed_detail)n.dispose();
 const fixed={release_room:'basement',preview_kind:'shell',bake_connection:true,bake_static:true,house_fixed_detail:true,house_fixed_receiver:true,house_authored_reflectance:true};
 const color=hex=>[...new THREE.Color(hex).toArray(),1];
 const metal=doc.createMaterial('Fixed cellar drain metal').setBaseColorFactor(color(0x777e79)).setRoughnessFactor(.82).setMetallicFactor(.15);
 const dark=doc.createMaterial('Fixed cellar drain recess').setBaseColorFactor(color(0x060909)).setRoughnessFactor(1);
 const brass=doc.createMaterial('Fixed cellar canopy brass').setBaseColorFactor(color(0x655332)).setRoughnessFactor(.82).setMetallicFactor(.15);
 const center=new THREE.Vector3(7.86,-3.991,3.168);
 addMesh(doc,'Basement floor drain recess',new THREE.CylinderGeometry(.24,.24,.008,48),dark,center.toArray(),fixed);
 const rim=new THREE.TorusGeometry(.235,.014,8,48);rim.rotateX(Math.PI/2);
 addMesh(doc,'Basement floor drain rim',rim,metal,center.clone().add(new THREE.Vector3(0,.015,0)).toArray(),fixed);
 for(let i=-3;i<=3;i++){
  const x=i*.057,length=2*Math.sqrt(.213**2-x*x);
  addMesh(doc,`Basement floor drain grate ${i+3}`,new THREE.BoxGeometry(.023,.016,length),metal,center.clone().add(new THREE.Vector3(x,.017,0)).toArray(),fixed);
 }
 addMesh(doc,'Basement ceiling light canopy',new THREE.CylinderGeometry(.095,.095,.045,32),brass,[6.96,-.195,2.16],fixed);
 const lamp=doc.getRoot().listNodes().find(n=>n.getName()==='Opal lamp');
 if(lamp)lamp.setExtras({...lamp.getExtras(),house_fixed_receiver:true,house_authored_reflectance:true,release_dynamic:false});
}

export async function refineHallAndExterior(doc,hall){
 for(const n of [...doc.getRoot().listNodes()])if(/^(?:Finish \/ )?(?:Hall|Rear hall|Attic access) .*light.*globe/i.test(n.getName())||n.getName()==='Attic pull cord'||n.getExtras().hatch_handle)n.dispose();
 const wood=hall.getRoot().listMaterials().find(m=>m.getName()==='wood');
 const painted=copyToDocument(doc,hall,[wood]).get(wood).clone().setName('Rough wood painted white').setRoughnessFactor(.96).setMetallicFactor(0);
 const source=wood.getBaseColorTexture();
 const image=await sharp(source.getImage()).greyscale().linear(.18,205).png().toBuffer();
 painted.setBaseColorFactor([1,1,1,1]).setBaseColorTexture(doc.createTexture('White paint over rough wood grain').setImage(image).setMimeType('image/png'));
 const hatch=doc.getRoot().listNodes().find(n=>n.getName()==='Attic hatch');
 if(hatch){
  const mesh=hatch.getMesh().clone();for(const p of mesh.listPrimitives())p.setMaterial(painted);
  hatch.setMesh(mesh).setExtras({...hatch.getExtras(),ceiling_paint:'painted white wood',house_authored_reflectance:true});
 }
 const iron=doc.createMaterial('Attic hatch iron handle').setBaseColorFactor([.018,.022,.027,1]).setRoughnessFactor(.85).setMetallicFactor(.15);
 const handle={release_room:'structure',preview_kind:'door',door_id:'attic',release_dynamic:true,bake_connection:true,hatch_handle:true};
 for(const [name,size,position] of [
  ['left mount',[.035,.055,.04],[8.94,2.53,7.43]],
  ['right mount',[.035,.055,.04],[8.94,2.53,7.67]],
  ['grip',[.035,.035,.28],[8.94,2.50,7.55]]
 ])addMesh(doc,`Attic hatch handle ${name}`,new THREE.BoxGeometry(...size),iron,position,handle);
 // Keep the moon's line of sight beside the nearest east-window pine.
 for(const n of doc.getRoot().listNodes().filter(n=>/^Finish \/ (?:window-view tree trunk|pine)/.test(n.getName()))){
  const p=n.getWorldMatrix();if(Math.abs(p[12]-19)<.2&&Math.abs(p[14]-8)<.2)n.setTranslation([p[12],p[13],p[14]+1.9]);
 }
 for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const kind=n.getExtras().preview_kind;
  if(['site','fixture'].includes(kind))n.setExtras({...n.getExtras(),release_dynamic:false,house_fixed_receiver:true});
  if(kind==='site'&&/tree|pine/i.test(n.getName())){
   const material=doc.createMaterial('Near-black moonlit tree').setBaseColorFactor([.00005,.000075,.000125,1]).setRoughnessFactor(1);
   const mesh=n.getMesh().clone();for(const p of mesh.listPrimitives())p.setMaterial(material);
   n.setMesh(mesh).setExtras({...n.getExtras(),house_authored_reflectance:true,house_tree_silhouette:true});
  }
 }
}
