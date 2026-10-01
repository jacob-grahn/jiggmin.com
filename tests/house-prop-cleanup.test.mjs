import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {tidyHouseProps} from '../web/house-prop-cleanup.js';
import {createHouseProps} from '../web/house-props.js';
import {batchHouseMeshes} from '../web/house-render-batches.js';
import {createHiddenScraps} from '../web/house-scraps.js';
import {illustrateHouse} from '../web/house-illustration.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{};
async function model(room){
 const b=readFileSync(`web/assets/house/release/${room}.glb`),n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n));
 d.buffers[0].uri=`data:application/octet-stream;base64,${b.subarray(28+n).toString('base64')}`;
 d.materials=[];for(const m of d.meshes)for(const p of m.primitives)delete p.material;delete d.images;delete d.textures;
 return (await new GLTFLoader().parseAsync(JSON.stringify(d),'')).scene;
}
test('release clutter cleanup settles laundry and removes loose sheets and shelf cloth',async()=>{
 for(const room of ['hallway','workshop','basement','attic']){
  const root=await model(room);tidyHouseProps(root,room);root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(!meshes.some(o=>/^(Blank_loose_paper|Small_plain_packing_slip|Unmarked_rolled_paper)/.test(o.name)));
  if(room!=='basement')continue;
  assert.ok(!meshes.some(o=>/^(Mic_stand|Microphone)$/.test(o.name)));
  const basket=meshes.find(o=>o.name==='Laundry_basket_base'),base=new THREE.Box3().setFromObject(basket),clothes=meshes.filter(o=>/^Ordinary_rumpled_cloth00[5-8]$/.test(o.name));
  assert.equal(clothes.length,4);const heap=new THREE.Box3();clothes.forEach(o=>heap.union(new THREE.Box3().setFromObject(o)));
  assert.ok(Math.abs(heap.min.y-base.max.y-.012)<1e-5);assert.ok(heap.max.y<base.max.y+.25);
  assert.ok(!meshes.some(o=>o.name==='Ordinary_rumpled_cloth'));
  const floorCoils=meshes.filter(o=>/Coiled.*cable/.test(o.name)&&new THREE.Box3().setFromObject(o).max.y< -3.8);
  assert.equal(floorCoils.length,1);assert.ok(floorCoils[0].geometry.isBufferGeometry);
 }
});
test('attic robot remains one physics body, including panel and all four wheels',async()=>{
 const root=await model('attic'),world=new THREE.Scene();world.add(root);tidyHouseProps(root,'attic');
 const system=createHouseProps(root,world,{floorY:2.8}),robot=system.props.find(p=>p.title==='Rough model farm robot'||p.root.children.some(m=>m.name==='Rough_model_farm_robot'));
 assert.ok(robot);assert.equal(robot.mode,'throw');assert.equal(robot.root.children.filter(m=>/^Model_robot_wheel/.test(m.name)).length,4);assert.ok(robot.root.children.some(m=>m.name==='Tiny_robot_solar_panel'));
 illustrateHouse([robot.root]);batchHouseMeshes(robot.root);
 const before=new THREE.Box3().setFromObject(robot.root).getSize(new THREE.Vector3());
 assert.ok(robot.root.children.every(m=>!m.isMesh||m.userData.houseInk||m.userData.houseProp===robot));
 const ray=new THREE.Raycaster(robot.home.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));ray.firstHitOnly=true;robot.root.updateMatrixWorld(true);
 assert.equal(ray.intersectObject(robot.root,true)[0]?.object.userData.houseProp,robot,'batched robot remains pickable');
 system.physics.grab(robot.id,robot.home);system.physics.release({x:1,y:2,z:0});for(let i=0;i<120;i++)system.update(1/120);
 const local=robot.root.quaternion.clone();robot.root.quaternion.identity();const after=new THREE.Box3().setFromObject(robot.root).getSize(new THREE.Vector3());robot.root.quaternion.copy(local);
 assert.ok(after.distanceTo(before)<1e-5,'assembled dimensions stay rigid while thrown');
});
test('render batching retains triangles, transforms, UVs and singleton contour children',()=>{
 const world=new THREE.Scene(),root=new THREE.Group();root.position.set(3,2,1);world.add(root);const mat=new THREE.MeshBasicMaterial();
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,.4),mat);m.position.x=i*.5;root.add(m);if(i===0){const contour=new THREE.Mesh(m.geometry,new THREE.MeshBasicMaterial({color:0}));contour.userData.houseInk=true;m.add(contour);}}
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 assert.equal(batchHouseMeshes(root),2);root.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.distanceTo(after.min)<1e-5&&bounds.max.distanceTo(after.max)<1e-5);
 let remaining=0;root.traverse(o=>{if(o.isMesh){remaining+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(o.geometry.attributes.uv);}});assert.equal(remaining,triangles);assert.equal(root.children.filter(o=>o.isMesh).length,2);
});

test('journal notes stay out of the room scenery until discovered',()=>{
 const root=new THREE.Group(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,1,3);scene.add(root);
 const prop={hotspot:'voices',home:new THREE.Vector3(),size:new THREE.Vector3(.2,.3,.4),root};
 const scraps=createHiddenScraps([prop],camera,scene,new Set());assert.equal(scraps.get('voices').mesh.visible,false);
 assert.equal(createHiddenScraps([prop],camera,scene,new Set(['voices'])).size,0);
});

test('cleanup and batching retain all journal discovery targets in the release rooms',async()=>{
 const notes=JSON.parse(readFileSync('data/house-notes.json')).notes;
 for(const room of ['hallway','workshop','basement','attic']){
  const root=await model(room),world=new THREE.Scene();world.add(root);tidyHouseProps(root,room);const system=createHouseProps(root,world,{floorY:room==='basement'?-4:room==='attic'?2.8:0});
  for(const id of new Set(notes.filter(n=>n.room===room).map(n=>n.hotspot)))assert.ok(system.props.some(p=>p.hotspot===id),`${room}: missing ${id}`);
  illustrateHouse([root,...system.props.map(p=>p.root)]);batchHouseMeshes(root,{staticCells:true});
  for(const prop of system.props){batchHouseMeshes(prop.root);assert.ok(prop.root.children.some(o=>o.isMesh&&!o.userData.houseInk&&o.userData.houseProp===prop));}
 }
});
