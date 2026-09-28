import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {createHouseProps} from '../web/house-props.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class {constructor(type,values){Object.assign(this,{type},values);}};
async function roomProps(room,{baked=false,elevation=0,yaw=0}={}){
 const bytes=readFileSync(baked?`web/assets/house/${room}-baked.glb`:`scene/exports/house/${room}.glb`),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 // Physics/grouping tests need geometry; textures are exercised in the browser.
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
 delete doc.textures;delete doc.images;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 const scene=new THREE.Scene();scene.add(gltf.scene);gltf.scene.position.y=elevation;gltf.scene.rotation.y=yaw;
 return createHouseProps(gltf.scene,scene);
}
for(const room of ['hallway','workshop','attic','basement'])test(`${room}: small objects and complete framed art are interactive`,async()=>{
 const {props,physics}=await roomProps(room);
 assert.ok(props.length>20);
 const art=props.filter(p=>/picture.*backing/.test(p.title));
 if(room!=='attic')assert.ok(art.length);
 for(const p of art){assert.equal(p.mode,'throw');assert.ok(p.root.children.some(o=>/image/.test(o.name)));assert.ok(p.root.children.some(o=>/frame/.test(o.name)));}
 const ownership=new Set(),detailOwners=new Map();
 for(const p of props)for(const mesh of p.root.children){assert.ok(!ownership.has(mesh));ownership.add(mesh);assert.equal(mesh.userData.houseProp,p);if(mesh.name.includes('__')){const owner=mesh.name.split('__')[0];assert.ok(!detailOwners.has(owner)||detailOwners.get(owner)===p,'material detail detached from its original prop');detailOwners.set(owner,p);}}
 assert.ok(props.some(p=>p.mode==='wiggle'),'complex or fabric objects need the wiggle fallback');
 for(const p of props.filter(p=>p.mode==='throw'))assert.equal(physics.items.get(p.id).body.type,4,'decor should remain attached until picked up');
 assert.ok(!props.some(p=>/floorboard|masonry|door leaf|Window jamb|Deep sill/.test(p.title)));
 if(room==='workshop'){
  const clock=props.find(p=>p.hotspot==='working-hours'),tablet=props.find(p=>p.hotspot==='tablet');
  assert.ok(clock.root.children.some(o=>/Clock_face/.test(o.name)));
  assert.ok(!tablet.root.children.some(o=>/Task_lamp|Keycap/.test(o.name)),'nearby desk assemblies stay separate');
  const lamp=props.find(p=>p.title.startsWith('Task lamp'));
  assert.ok(lamp.root.children.some(o=>/Task_lamp_shade/.test(o.name)));
 }
 if(room==='attic'){
  const tricycle=props.find(p=>p.hotspot==='tricycle');
  assert.ok(tricycle,'tricycle retains its note interaction');
  const parts=tricycle.root.children;
  for(const name of ['tire','front_fork','rear_axle','black_saddle','swept_handlebar','rubber_pedal']){
   assert.ok(parts.some(o=>o.name.includes(`Tricycle_${name}`)),`${name} is detached from the tricycle`);
  }
  assert.ok(!props.some(p=>p!==tricycle&&p.root.children.some(o=>o.name.startsWith('Tricycle_'))),'tricycle must remain one assembly');
 }

});
test('wall art detaches, travels with its frame, and can cancel a grab',async()=>{
 const system=await roomProps('hallway'),p=system.props.find(p=>/Odd entrance picture/.test(p.title)),{physics}=system;
 const home=p.root.position.clone(),body=physics.items.get(p.id).body;
 physics.grab(p.id,home);physics.move(home.clone().add(new THREE.Vector3(-.4,.2,.1)));
 for(let i=0;i<30;i++)system.update(1/120);
 assert.ok(p.root.position.distanceTo(home)>.04);
 system.cancel();system.update(1/120);
 assert.equal(body.type,4);assert.equal(body.collisionFilterMask,-1);assert.ok(p.root.position.distanceTo(home)<1e-5);
 assert.ok(new THREE.Vector3(body.position.x,body.position.y,body.position.z).distanceTo(home)<1e-5);
 physics.grab(p.id,home);physics.release(new THREE.Vector3(-2,2,0));
 for(let i=0;i<120;i++)system.update(1/120);
 assert.ok(p.root.position.distanceTo(home)>.05);
 assert.ok(p.root.position.toArray().every(Number.isFinite));assert.ok(p.root.position.y>-.5);
 assert.equal(p.root.children.length,6,'frame and print must stay together');
});
test('wiggle returns exactly home and reduced motion clears the spring',async()=>{
 const system=await roomProps('workshop'),p=system.props.find(p=>p.mode==='wiggle');
 system.kick(p);system.update(1/60);assert.ok(p.root.quaternion.angleTo(p.rest)>0);
 system.update(1/60,true);assert.ok(p.root.quaternion.angleTo(p.rest)<1e-8);assert.equal(p.spring.angle,0);
});

for(const height of [-4,3.2])test(`Throws stay in rooms at elevation ${height} without snapping home`,()=>{
 const scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);model.position.y=height;
 const floor=new THREE.Mesh(new THREE.BoxGeometry(2,.2,2));floor.name='Floorboard';model.add(floor);
 const cube=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,.15));cube.name='Ordinary block';cube.position.set(0,.5,0);model.add(cube);
 const system=createHouseProps(model,scene),prop=system.props[0],{physics}=system;
 physics.reset=()=>assert.fail('throws must not reset home');
 physics.grab(prop.id,prop.home);physics.release({x:8,y:4,z:3});
 for(let i=0;i<480;i++)system.update(1/120);
 assert.equal(physics.items.get(prop.id).body.type,1);
 assert.ok(prop.root.position.y>=height-.1,`fell below room: ${prop.root.position.y}`);
 assert.ok(Math.abs(prop.root.position.x)<1.25,'room walls must contain basement throws');
 assert.ok(prop.root.position.distanceTo(prop.home)>.1);
});

test('hallway cartons are independent props with tape textured onto each box',async()=>{
 const {props,physics}=await roomProps('hallway');
 const names=['Parcel by the wall','Smaller parcel leaning nearby','Low ordinary parcel'];
 const cartons=names.map(name=>props.find(p=>p.title===name));
 assert.ok(cartons.every(Boolean),'each carton must have its own prop');
 assert.equal(new Set(cartons.map(p=>p.id)).size,3);
 assert.ok(!props.some(p=>/Carton packing tape|Carton top seam/.test(p.title)),'tape and seams are not loose props');
 for(const p of cartons){
  assert.equal(p.mode,'throw');
  const owners=new Set(p.root.children.map(mesh=>mesh.name.split('__')[0]));
  assert.equal(owners.size,1,'a carton must not absorb another box');
  physics.grab(p.id,p.home);
  assert.equal(physics.held.id,p.id);
  for(const other of cartons.filter(other=>other!==p))assert.equal(physics.items.get(other.id).body.type,4);
  physics.cancel();
 }
 const bytes=readFileSync('scene/exports/house/hallway.glb'),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert.ok(!doc.nodes.some(n=>/Carton_packing_tape|Carton_top_seam/.test(n.name??'')));
 const taped=doc.materials.filter(m=>m.name.includes('taped cardboard'));
 assert.equal(taped.length,3);
 for(const material of taped)assert.ok(material.pbrMetallicRoughness.baseColorTexture,'tape must be in the box material');
});

test('workshop has intact computer and woodworking props with a flat printed keyboard',async()=>{
 const {props}=await roomProps('workshop');
 const computer=props.find(p=>p.title==='Open computer assembly');
 assert.ok(computer);assert.ok(computer.home.x<0);assert.equal(computer.hotspot,'destroyers');
 for(const title of ['Woodworking handsaw','Woodworking hand plane','Wooden mallet','Carpenter try square','Woodworking chisel']){
  const prop=props.find(p=>p.title===title);assert.ok(prop,title);assert.ok(prop.home.x>0,title);assert.equal(prop.mode,'throw',title);
  assert.equal(new Set(prop.root.children.map(mesh=>mesh.name.split('__')[0])).size,1,`${title} must stay assembled`);
 }
 const keyboard=props.find(p=>p.title==='Keyboard');assert.ok(keyboard);assert.equal(keyboard.mode,'throw');assert.ok(keyboard.size.y<.04);
 assert.ok(!props.some(p=>/Keycap|Inkclipse spinning orb|Zigzag puzzle piece|Four crew ship|Unfinished small component/.test(p.title)));
 const bytes=readFileSync('scene/exports/house/workshop.glb'),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const printed=doc.materials.find(m=>m.name==='Print keyboard-top');assert.ok(printed?.pbrMetallicRoughness.baseColorTexture);
 const camera=doc.nodes.find(n=>n.camera!==undefined);assert.ok(camera.translation[2]>2.9,'camera should stand farther back from bench');
});

for(const baked of [false,true])test(`attic ${baked?'baked':'source'}: throws clear the open space and collide with the pitched roof`,async()=>{
 const elevation=3.2,yaw=.35,{physics}=await roomProps('attic',{baked,elevation,yaw});
 const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const roofs=physics.world.bodies.filter(b=>/Pitched.unfinished.roof/.test(b.name??''));
 assert.equal(roofs.length,2);
 for(const roof of roofs)assert.ok(Math.min(...roof.shapes[0].halfExtents.toArray())<.01,'roof collider must be a thin sloped panel');
 for(const side of [-1,1]){
  const position=new THREE.Vector3(side*.7,1.5,-.9).applyQuaternion(rotation);position.y+=elevation;
  const body=physics.add(`roof-probe-${side}`,{position,quaternion:rotation},{size:[.1,.1,.1],center:{x:0,y:0,z:0}});
  const hits=[];body.addEventListener('collide',e=>hits.push(e.body.name));body.velocity.set(0,6,0);body.wakeUp();
  let peak=body.position.y;
  for(let i=0;i<65;i++){
   physics.step(1/120);peak=Math.max(peak,body.position.y);
   if(i===19){assert.ok(body.position.y>elevation+2.25,`throw height ${body.position.y-elevation}, hits ${hits}`);assert.deepEqual(hits,[]);}
  }
  assert.ok(hits.some(name=>/Pitched.unfinished.roof/.test(name??'')),'visible roof must still stop the throw');
  assert.ok(peak>elevation+2.6&&peak<elevation+2.78,`unexpected roof impact height: ${peak-elevation}`);
  assert.ok(body.velocity.y<0,'object should fall back after striking roof');
  physics.world.removeBody(body);
 }
});
