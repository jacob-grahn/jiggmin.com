import * as THREE from 'three';
import {CartridgePhysics} from './physics.js';
import {PropSpring} from './prop-reactions.js';

const structural=/floorboard|plank|skirting|corridor wall|cornice|ceiling|door|threshold|window|sill|rain drop|runner|sheathing|stud\b|joist|rafter|roof|insulation|masonry|concrete|slab|conduit|outlet|socket|workbench|work surface|table leg|shelf upright|archive shelf|wall shelf|shelf brass bracket|lamp stem|opal lamp|brass shade|attic hatch|coat hook|future lock|copper water pipe|duct|furnace|pegboard|peg hole|collar tie|purlin|ridge beam|support post|knee brace|hanging wire|red wire|junction/i;
const nameOf=o=>o.name.replaceAll('_',' ').replace(/\.?\d{3}$/,'');
const triangles=o=>(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
const sizeOf=box=>box.getSize(new THREE.Vector3());
const maxSize=box=>Math.max(...sizeOf(box).toArray());

// Group the original meshes; no lighting projection is tied to their rest pose.
// Explicit artwork families take precedence over proximity so frames never shed
// their print. The bounded overlap pass collects lids, lettering, and handles.
export function groupHouseProps(model,scene){
 model.updateMatrixWorld(true);
 const records=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  // glTF splits a mesh with several materials into children of one authored node.
  let owner=mesh.parent?.userData.surface_finish?mesh.parent:mesh;
  for(let parent=mesh.parent;parent&&parent!==model;parent=parent.parent)if(parent.userData.prop_assembly){owner=parent;break;}
  if(owner!==mesh)mesh.name=`${owner.name}__${mesh.name}`;
  const name=nameOf(owner),box=new THREE.Box3().setFromObject(mesh),hotspot=mesh.userData.hotspot??owner.userData.hotspot;
  const fixed=structural.test(name)||hotspot?.includes('door')||maxSize(box)>1.8;
  records.push({mesh,name,box,hotspot,fixed,owner});
 });
 const groups=[],assigned=new Set();
 function group(parts,key){
  const owners=new Set(parts.map(p=>p.owner));
  parts=records.filter(p=>parts.includes(p)||(!assigned.has(p)&&owners.has(p.owner)));
  const box=new THREE.Box3();for(const p of parts){assigned.add(p);box.union(p.box);}
  const item={parts,box,key};groups.push(item);return item;
 }
 // Authored prop boundaries override proximity (for example stacked cartons).
 for(const r of records.filter(r=>r.owner.userData.prop_assembly)){
  if(!assigned.has(r))group([r],r.hotspot);
 }
 for(const r of records.filter(r=>!r.fixed&&!assigned.has(r)&&/ backing$/.test(r.name))){
  const prefix=r.name.slice(0,-8);
  group(records.filter(p=>!p.fixed&&!assigned.has(p)&&p.name.startsWith(prefix)),null);
 }
 // Authored assemblies that sit close together on the desk must stay separate.
 const families=[
  /^(Keyboard|Keycap)$/,
  /^(Old graphics tablet|Tablet active surface|Tablet cable)$/,
  /^(Printed worn T-shirt|PR2 cartridge screenprint|T-shirt collar)/,
  /^(Kindergarten plate|Ceramic plate back)$/,
  /^(Working hours clock|Clock face|Clock hands)$/,
  /^(Crowland study|CROWLAND|Crow body|Crow head|Crow beak|Crow branch)$/,
  /^(Hammer wooden handle|Hammer steel head)$/,
  /^Task lamp/,
  /^(Small floor lamp|Small linen floor lamp shade)/,
  /^(Thirty days with Greg|30 DAYS|Bent note pin)/,
  /^(Loose Longtide paper study|L O N G T I D E|Pencilled universe orbit|Chart pencil star)$/,
  /^(Unframed Derron character draft|DERRON|Drawn character head|Character pencil)/,
 ];
 for(const family of families){
  const parts=records.filter(r=>(!r.fixed||/^(Small floor lamp|Small linen floor lamp shade)/.test(r.name))&&!assigned.has(r)&&family.test(r.name));
  if(parts.length)group(parts,parts.find(p=>p.hotspot)?.hotspot);
 }
 for(const seed of records.filter(r=>r.name==='Ordinary shoe'&&!assigned.has(r))){
  if(assigned.has(seed))continue;
  const capture=seed.box.clone().expandByScalar(.12);
  group([seed,...records.filter(r=>!assigned.has(r)&&/^(Shoe sole|Boot ankle|Loose shoe lace)$/.test(r.name)&&capture.intersectsBox(r.box))],null);
 }
 const semantic=new Map();
 for(const r of records)if(!r.fixed&&r.hotspot&&!assigned.has(r)){
  const list=semantic.get(r.hotspot)||[];list.push(r);semantic.set(r.hotspot,list);
 }
 for(const [key,parts] of semantic)group(parts,key);
 // Start with the largest object in each cluster, then absorb its small detail
 // meshes. A tiny tolerance joins flush lettering without grabbing nearby props.
 const seeds=records.filter(r=>!r.fixed&&!assigned.has(r)).sort((a,b)=>sizeOf(b.box).length()-sizeOf(a.box).length());
 for(const seed of [...groups,...seeds]){
  if(seed.mesh&&assigned.has(seed))continue;
  const g=seed.mesh?group([seed],seed.hotspot):seed;
  if(g.parts.some(p=>p.owner.userData.prop_assembly))continue;
  const capture=g.box.clone().expandByScalar(.025);
  let changed=true;
  while(changed){
   changed=false;
   for(const r of records){
    if(r.fixed||assigned.has(r)||r.hotspot)continue;
    if(!capture.intersectsBox(r.box))continue;
    if(/^(Plain |Unlabeled |Ordinary |Blank |Unmarked |Small |Stored |Loose |Folded |Opened |Empty |Dusty |Coiled |Chair |Laundry |Keyboard|Old |Stack|Short |Rough |Spare |Model |Broom)/.test(r.name))continue;
    const assembly=records.filter(p=>p.owner===r.owner&&!assigned.has(p));
    const assemblyBox=new THREE.Box3();for(const p of assembly)assemblyBox.union(p.box);
    const union=g.box.clone().union(assemblyBox);
    if(maxSize(union)>Math.max(1.8,maxSize(g.box)+.05))continue;
    // Avoid absorbing another full-sized object resting alongside this one.
    if(sizeOf(assemblyBox).length()>sizeOf(g.box).length()*.85)continue;
    g.parts.push(...assembly);g.box.copy(union);for(const p of assembly)assigned.add(p);changed=true;
   }
  }
 }
 const props=groups.map((g,index)=>{
  const root=new THREE.Group();root.position.copy(g.box.getCenter(new THREE.Vector3()));scene.add(root);root.updateMatrixWorld(true);
  for(const {mesh} of g.parts)root.attach(mesh);
  const count=g.parts.reduce((n,p)=>n+triangles(p.mesh),0);
  const mode=g.parts.some(p=>p.owner.userData.prop_mode==='throw')?'throw':count>12000||g.parts.length>40||maxSize(g.box)>1.8||g.parts.some(p=>/cloth|shirt|blanket|jacket|bag/i.test(p.name))?'wiggle':'throw';
  const title=g.parts[0].name;
  const prop={id:`prop-${index}`,root,size:sizeOf(g.box),mode,title,hotspot:g.key??g.parts.find(p=>p.hotspot)?.hotspot,
   rest:root.quaternion.clone(),spring:new PropSpring(12,3.5,.11),home:root.position.clone()};
  for(const {mesh} of g.parts)mesh.userData.houseProp=prop;
  return prop;
 });
 return {props,staticMeshes:records.filter(r=>!assigned.has(r)).map(r=>r.mesh)};
}

export function createHouseProps(model,scene){
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);
 const {props,staticMeshes}=groupHouseProps(model,scene);
 const colliders=[];
 for(const mesh of staticMeshes){
  if(/rain|garden|beyond|cord|fringe|window|cornice|skirting|threshold|jamb|casing/i.test(nameOf(mesh)))continue;
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();mesh.matrixWorld.decompose(position,rotation,scale);
  const center=box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),size=sizeOf(box).multiply(scale).toArray().map(v=>Math.max(.008,Math.abs(v)/2));
  colliders.push({name:mesh.name,center:center.toArray(),halfExtents:size,quaternion:rotation.toArray()});
 }
 for(const p of props.filter(p=>p.mode==='wiggle'))colliders.push({name:p.title,center:p.home.toArray(),halfExtents:p.size.toArray().map(n=>Math.max(.01,n/2)),quaternion:p.rest.toArray()});
 const x0=bounds.min.x-.25,x1=bounds.max.x+.25,z0=bounds.min.z-.25,z1=bounds.max.z+.25;
 const walls=[[x0,(z0+z1)/2,.1,(z1-z0)/2],[x1,(z0+z1)/2,.1,(z1-z0)/2],[(x0+x1)/2,z0,(x1-x0)/2,.1],[(x0+x1)/2,z1,(x1-x0)/2,.1]];
 const physics=new CartridgePhysics(colliders,()=>{},{bounds:walls,floorY:bounds.min.y});
 // Decorative objects remain attached until grabbed or hit by a loose object, including wall art.
 for(const p of props){
  if(p.mode==='wiggle')continue;
  physics.add(p.id,{position:p.root.position,quaternion:p.root.quaternion},{size:p.size.toArray().map(n=>Math.max(n,.025)),center:{x:0,y:0,z:0},mass:Math.max(.08,Math.min(2,p.size.x*p.size.y*p.size.z*25))});
  physics.pin(p.id,{position:p.root.position,quaternion:p.root.quaternion},{releaseOnContact:true});
 }
 let dirty=false;
 const tilt=new THREE.Quaternion();
 return {props,physics,
  kick(p,reduced=false){if(!reduced)p.spring.kick(1.2);dirty=true;},
  update(dt,reduced=false){
   const awake=physics.held||[...physics.items.values()].some(({body})=>body.type===1&&body.sleepState!==2);
   if(awake){physics.step(dt);dirty=true;}
   let animating=Boolean(awake);
   for(const p of props){
    const item=physics.items.get(p.id);
    if(item&&item.body.type===1){const pose=physics.pose(p.id);p.root.position.copy(pose.position);p.root.quaternion.copy(pose.quaternion);
    }else{
     if(reduced){if(p.spring.angle||p.spring.velocity){p.spring.reset();p.root.quaternion.copy(p.rest);dirty=true;}}
     else if(p.spring.step(dt)){tilt.setFromAxisAngle(new THREE.Vector3(0,0,1),p.spring.angle);p.root.quaternion.copy(p.rest).multiply(tilt);dirty=true;animating=true;}
    }
   }
   const changed=dirty;dirty=false;return {changed,animating};
  },
  cancel(){const id=physics.held?.id;physics.cancel();if(id){const p=props.find(p=>p.id===id),pose=physics.pose(id);p.root.position.copy(pose.position);p.root.quaternion.copy(pose.quaternion);}dirty=true;},
 };
}
