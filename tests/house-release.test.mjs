import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {createHouseProps,groupHouseProps} from '../web/house-props.js';
import {travelPose} from '../web/house-travel.js';
import {createRoute} from '../web/house-layout.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
const dir=process.env.HOUSE_RELEASE_DIR??'web/assets/house/release';
function document(room){const bytes=readFileSync(`${dir}/${room}.glb`),n=bytes.readUInt32LE(12);return {bytes,n,doc:JSON.parse(bytes.subarray(20,20+n))};}
async function model(room){const {bytes,n,doc}=document(room);doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+n).toString('base64')}`;for(const node of doc.nodes)if(node.mesh!==undefined&&doc.meshes[node.mesh].primitives.every(p=>doc.materials[p.material]?.extensions?.KHR_materials_unlit))node.extras={...node.extras,authoredUnlit:true};doc.materials=[];for(const m of doc.meshes)for(const p of m.primitives)delete p.material;delete doc.images;delete doc.textures;delete doc.extensionsUsed;delete doc.extensionsRequired;return (await new GLTFLoader().parseAsync(JSON.stringify(doc),'')).scene;}
test('release retains every discoverable prop and keeps it out of static lightmaps',async()=>{
 const notes=JSON.parse(readFileSync('data/house-notes.json')).notes;
 for(const room of ['hallway','workshop','basement','attic']){
  const root=await model(room),world=new THREE.Scene();world.add(root);
  const {props}=createHouseProps(root,world,{floorY:room==='basement'?-4:room==='attic'?2.8:0});
  const layout=JSON.parse(readFileSync(`${dir}/layout.json`)),v=layout.views[room==='hallway'?'hub':room];
  const camera=new THREE.PerspectiveCamera(v.fov,1.6,.035,250);camera.position.fromArray(v.position);camera.lookAt(...v.target);camera.updateMatrixWorld();
  const cameras=[camera];
  for(const prop of props.filter(p=>p.hotspot))assert.ok(cameras.some(c=>{const p=prop.home.clone().project(c);return Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;}),`${room}: ${prop.hotspot} unreachable in both views`);
  for(const id of new Set(notes.filter(n=>n.room===room).map(n=>n.hotspot)))assert.ok(props.some(p=>p.hotspot===id),`${room}: missing ${id}`);
  for(const p of props)p.root.traverse(o=>{if(o.isMesh)assert.ok(!o.userData.release_baked,`${room}: movable ${o.name} was baked`);});
 }
});
test('release shell retains its selected style, independent doors and connected ladder sections',()=>{
 const {doc}=document('structure'),nodes=doc.nodes;
 const layout=JSON.parse(readFileSync(`${dir}/layout.json`));
 if(layout.style==='original'){
  assert.ok(nodes.every(n=>!n.mesh||n.extras?.style_source==='original-room-palette'||n.extras?.house_authored_reflectance));
  assert.ok(!nodes.some(n=>n.extras?.release_baked&&!n.extras?.workshop_plywood&&!n.extras?.workshop_window_frame&&!n.extras?.house_window_bake));
  if(layout.lightingBake){
   assert.equal(layout.lightingBake.source,'original-window-rig');
   assert.equal(layout.lightingBake.report.lighting.exposure,-1.3);
   assert.equal(layout.lightingBake.report.lighting.saturation,1.2);
   assert.equal(layout.lightingBake.report.lighting.liveWindowLights,false);
   for(const n of nodes.filter(n=>n.extras?.house_window_bake&&n.name!=='Attic hatch'))assert.ok(!['door','ladder'].includes(n.extras.preview_kind),'animated geometry was baked');
  }
  assert.equal(layout.assets.den,null);assert.deepEqual(layout.lights,[]);
 }else assert.ok(nodes.some(n=>n.extras?.release_baked));
 for(const id of ['mudroom','garage','stairs','den','attic'])assert.ok(nodes.some(n=>n.extras?.door_id===id),id);
 for(const section of [0,1,2])assert.ok(nodes.some(n=>n.extras?.ladder_section===section));
 for(const n of nodes.filter(n=>n.extras?.release_baked)){
  const mesh=doc.meshes[n.mesh];for(const p of mesh?.primitives??[]){assert.ok(p.attributes.TEXCOORD_0!==undefined);assert.ok(doc.materials[p.material].emissiveTexture);}
 }
});
test('release camera routes retain approved endpoints and upright travel',()=>{
 const layout=JSON.parse(readFileSync(`${dir}/layout.json`));
 for(const [id,points] of Object.entries(layout.routes)){
  const route=createRoute(points.map(p=>new THREE.Vector3(...p)));
  for(const [p,v] of [[0,layout.views.hub],[1,layout.views[id]]])assert.ok(travelPose(route,p,layout.views.hub,layout.views[id],id).position.distanceTo(new THREE.Vector3(...v.position))<.001);
  for(let i=0;i<=50;i++)for(const reverse of [false,true]){
   const pose=travelPose(route,i/50,layout.views.hub,layout.views[id],id,reverse);
   assert.ok(Math.abs(new THREE.Euler().setFromQuaternion(pose.quaternion,'YXZ').z)<1e-6);
  }
  if(id==='basement'){
   const midpoint=travelPose(route,.5,layout.views.hub,layout.views[id],id,true);
   const backward=route.getPoint(.4).sub(route.getPoint(.5)).normalize();
   const facing=new THREE.Vector3(0,0,-1).applyQuaternion(midpoint.quaternion);
   assert.ok(facing.dot(backward)>.4,'basement return should face toward the upper stairs');
  }
 }
});

test('all fixed release geometry is baked, including the exterior and authored cellar details',async t=>{
 const layout=JSON.parse(readFileSync(`${dir}/layout.json`));
 if(!(layout.lightingBake?.report?.lighting?.windowRevision>=3)){t.skip('Requires the current night bake');return;}
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const root=await model(room),world=new THREE.Scene();world.add(root);
  root.traverse(o=>{let owner=o;while(owner&&!owner.userData.release_room)owner=owner.parent;if(owner)Object.assign(o.userData,owner.userData);});
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const fixed=room==='structure'?meshes:groupHouseProps(root,world).staticMeshes;
  for(const mesh of fixed){
   if(['door','ladder'].includes(mesh.userData.preview_kind)||/Garden_beyond_window|glass/i.test(mesh.name))continue;
   assert.ok(mesh.userData.release_baked||mesh.userData.authoredUnlit,`${room}/${mesh.name}: fixed mesh still uses live lighting`);
  }
 }
});

test('night refinement removes the suspended cloth and hallway lamps while the hatch handle follows its panel',async()=>{
 const {doc:structure}=document('structure'),{doc:basement}=document('basement');
 assert.ok(!basement.nodes.some(n=>n.name==='Ordinary rumpled cloth.003'));
 assert.ok(!structure.nodes.some(n=>/^(?:Finish \/ )?(?:Hall|Rear hall|Attic access) .*light.*globe/i.test(n.name)));
 assert.ok(!structure.nodes.some(n=>n.name==='Attic pull cord'));
 const handle=structure.nodes.filter(n=>n.extras?.hatch_handle);assert.equal(handle.length,3);
 for(const n of handle){assert.equal(n.extras.door_id,'attic');assert.ok(n.extras.release_dynamic);}
 const panel=structure.nodes.find(n=>n.name==='Attic hatch');
 for(const p of structure.meshes[panel.mesh].primitives){const m=structure.materials[p.material];assert.ok(m.emissiveTexture||m.pbrMetallicRoughness.baseColorTexture);assert.ok(m.emissiveTexture||m.name==='Rough wood painted white');}
 assert.ok(!readFileSync('web/house.js','utf8').includes('Look right'));
});
