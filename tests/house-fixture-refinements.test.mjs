import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as T from 'three';import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {fixtureAnchors,turnOffCeilingFixtures,refineRoomFixtures} from '../scripts/house-source/house-fixture-refinements.js';
import {replaceExteriorTrees} from '../scripts/house-source/house-exterior-trees.js';
globalThis.ProgressEvent??=class{};
const releaseDir=process.env.HOUSE_RELEASE_DIR??'web/assets/house/release';
async function model(room){const b=readFileSync(`${releaseDir}/${room}.glb`),n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n));d.buffers[0].uri=`data:application/octet-stream;base64,${b.subarray(28+n).toString('base64')}`;d.materials=[];for(const m of d.meshes)for(const p of m.primitives)delete p.material;delete d.images;delete d.textures;const root=(await new GLTFLoader().parseAsync(JSON.stringify(d),'')).scene;root.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});root.updateMatrixWorld(true);return root;}
const box=o=>new T.Box3().setFromObject(o),named=(root,name)=>{let result;root.traverse(o=>{if((o.userData.house_bake_source??o.userData.source_object??o.name.replaceAll('_',' '))===name)result??=o;});return result;};
test('basement pipes touch the rear wall and the orphan pencil is removed',async()=>{
 const root=await model('basement');refineRoomFixtures(root,'basement');const wall=box(named(root,'Basement painted masonry rear wall'));
 for(const name of ['Copper water pipe','Stored flexible hose']){
  const p=named(root,name);p.geometry.computeBoundingBox();const body=p.geometry.boundingBox.clone().applyMatrix4(p.matrixWorld);
  assert.ok(Math.abs(body.min.z-wall.max.z-(name==='Copper water pipe'?-.001:.003))<1e-5);assert.equal(p.userData.bake_connection,true);
 }
 assert.equal(named(root,'Pencil on ordinary paper'),undefined);
 const pipe=named(root,'Copper water pipe'),elbow=named(root,'Copper pipe ceiling elbow'),ceiling=box(named(root,'Basement ceiling'));
 assert.ok(elbow.geometry.attributes.position.count>200);assert.ok(box(elbow).max.y>ceiling.min.y+.015);
 const path=elbow.userData.pipeCenterline.map(p=>new T.Vector3(...p));
 assert.ok(path[1].clone().sub(path[0]).normalize().dot(new T.Vector3(1,0,0))>.999);
 assert.ok(path.at(-1).clone().sub(path.at(-2)).normalize().dot(new T.Vector3(0,1,0))>.999);
 const plates=pipe.children.filter(o=>/Copper.pipe.wall.mounting.plate/.test(o.name));assert.equal(plates.length,3);
 for(const plate of plates){const b=box(plate);assert.ok(b.min.z<wall.max.z&&b.max.z>wall.max.z,'mounting plate must meet the wall');assert.equal(plate.userData.bake_connection,true);}
});
test('attic bulb has a socket and ceiling-reaching cord, junction attaches to a post, cartons move forward',async()=>{
 const root=await model('attic'),structure=await model('structure'),anchors=fixtureAnchors(structure);
 refineRoomFixtures(root,'attic',{structure,...anchors});root.updateMatrixWorld(true);
 const bulb=named(root,'Attic bare work bulb'),wire=named(root,'Bare bulb hanging wire'),socket=named(root,'Attic bulb socket');
 assert.ok(box(bulb).getSize(new T.Vector3()).y>.18);assert.equal(bulb.userData.bake_connection,true);assert.ok(socket);
 assert.ok(box(wire).max.y>6.8);assert.ok(Math.abs(box(wire).min.y-box(socket).max.y)<1e-5);
 const ray=new T.Raycaster(box(wire).getCenter(new T.Vector3()),new T.Vector3(0,1,0));const roof=ray.intersectObject(structure,true)[0];assert.ok(Math.abs(box(wire).max.y-roof.point.y)<.006);
 const junction=named(root,'Loose electrical junction box'),b=box(junction);assert.ok(anchors.supports.some(p=>Math.abs(b.min.z-p.max.z-.004)<1e-5&&Math.abs(b.getCenter(new T.Vector3()).x-p.getCenter(new T.Vector3()).x)<1e-5));
 for(const name of ['Attic utility carton','Shifted smaller carton']){const b=box(named(root,name));assert.ok(b.getCenter(new T.Vector3()).z>5.8);assert.ok(Math.abs(b.min.y-3.055)<1e-5);}
});
test('garage and mudroom fittings stay present with non-emissive dim materials',async()=>{
 const root=await model('structure');turnOffCeilingFixtures(root);
 for(const name of ['Finish / Laundry light globe','Finish / Workshop overhead globe','Finish / Workshop overhead globe.001']){const o=named(root,name);assert.ok(o.visible);if(root.userData.review_fixtures_baked)assert.ok(o.userData.review_fixed_fixture);else{assert.equal(o.material.name,'Unlit ceiling fitting');assert.ok(o.material.isMeshBasicMaterial);}assert.equal(o.userData.houseOutlined,true);}
});
test('front workroom tree roots sit below the visible panorama floor',async()=>{
 const root=await model('structure'),grove=root.getObjectByName('Natural_exterior_grove');assert.ok(grove.children.some(o=>o.position.x>10&&o.position.z<0));
 for(const tree of grove.children)if(tree.position.x>10&&tree.position.z<0)assert.equal(tree.position.y,-2.7);
});
