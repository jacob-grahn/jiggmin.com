import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import {treeThroughWindow,maskContours,isExteriorTree,sceneryCameras,triangleThroughPlanes} from '../scripts/house-source/tree-delivery.mjs';

test('portrait camera coverage includes scenery above the desktop vertical field of view',()=>{
 const layout={aspect:1.6,views:{hub:{position:[0,1,0],target:[0,1,-1],fov:50}},routes:{}};
 const cameras=sceneryCameras(layout),point=new THREE.Vector3(0,8,-10);
 assert.ok(cameras[0].frusta.some(f=>f.containsPoint(point)));
 const desktop=new THREE.PerspectiveCamera(50,1.6,.01,250);desktop.position.set(0,1,0);desktop.lookAt(0,1,-1);desktop.updateMatrixWorld();
 assert.equal(new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(desktop.projectionMatrix,desktop.matrixWorldInverse)).containsPoint(point),false);
});

test('tree delivery samples only resting views, regardless of travel routes',()=>{
 const views={hub:{position:[0,1,0],target:[0,1,-1],fov:50},overview:{position:[0,20,0],target:[0,0,0],fov:50}};
 assert.deepEqual(sceneryCameras({aspect:1.6,views,routes:{hub:[[0,1,0],[100,1,0]]}}).map(c=>c.id),['hub']);
});

test('triangle clipping rejects empty canopy bounds and retains aperture crossings',()=>{
 const planes=[new THREE.Plane(new THREE.Vector3(1,0,0),0),new THREE.Plane(new THREE.Vector3(0,1,0),0)];
 const triangle=points=>points.map(p=>new THREE.Vector3(...p));
 // Each plane intersects the bounds, but no part of this triangle reaches x/y >= 0.
 assert.equal(triangleThroughPlanes(triangle([[-2,1,0],[1,-2,0],[-2,-2,0]]),planes),false);
 assert.ok(triangleThroughPlanes(triangle([[-2,1,0],[2,1,0],[0,-2,0]]),planes));
});

test('portal culling keeps edge slivers and trees revealed by a moving camera',()=>{
 const window={center:new THREE.Vector3(0,1,0),normal:new THREE.Vector3(0,0,-1),points:[[-1,0,0],[1,0,0],[1,2,0],[-1,2,0]].map(p=>new THREE.Vector3(...p))};
 const camera=x=>({position:new THREE.Vector3(x,1,2),frustum:new THREE.Frustum()});
 const box=(x,z)=>new THREE.Box3(new THREE.Vector3(x,0,z),new THREE.Vector3(x+.2,2,z+.2));
 assert.ok(treeThroughWindow(box(0,-3),window,camera(0)));
 assert.ok(treeThroughWindow(box(2.3,-3),window,camera(0)),'keep a silhouette grazing the portal');
 assert.equal(treeThroughWindow(box(4,-3),window,camera(0)),false);
 assert.ok(treeThroughWindow(box(4,-3),window,camera(-2)),'travel can reveal a previously hidden tree');
 assert.equal(treeThroughWindow(box(0,1),window,camera(0)),false,'interior geometry cannot count as exterior');
});

test('silhouette contour extraction preserves holes and discards subpixel specks',()=>{
 const mask=new Uint8Array(12*12);
 for(let y=1;y<10;y++)for(let x=1;x<10;x++)if(!(x>=4&&x<7&&y>=4&&y<7))mask[y*12+x]=255;
 mask[11*12+11]=255;
 const loops=maskContours(mask,12,12);
 assert.equal(loops.filter(l=>l.area>0).length,1);assert.equal(loops.filter(l=>l.area<0).length,1);
 assert.equal(loops.reduce((s,l)=>s+l.area,0),72,'hole must stay transparent');
 assert.ok(loops.every(l=>l.points.length>=3));
});

test('delivery removes unseen trees and cuts tree triangles by at least 90%',async()=>{
 const report=JSON.parse(await readFile('web/assets/house/release/tree-delivery-report.json'));
 assert.equal(report.cameraSamples,6);assert.equal(report.visibility,'settled-cameras');assert.equal(report.windows.length,10);
 assert.equal(report.trees.filter(t=>t.action==='removed').length,26);
 assert.equal(report.trees.filter(t=>t.action==='silhouette').length,13);
 assert.ok(report.trees.filter(t=>t.action==='silhouette').every(t=>t.windows.length&&t.afterTriangles>0));
 const before=report.trees.reduce((s,t)=>s+t.beforeTriangles,0),after=report.trees.reduce((s,t)=>s+t.afterTriangles,0);
 assert.ok(after<before*.1,`${before} → ${after}`);
});

test('basement delivery preserves every non-tree mesh, transform, material and lightmap',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir='web/assets/house/release';
 const original=await io.read(`${dir}/basement.glb`),delivery=await io.read(`${dir}/scenery/basement.glb`);
 const nodes=new Map(delivery.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id??n.getName(),n]));
 for(const node of original.getRoot().listNodes().filter(n=>n.getMesh()&&!isExteriorTree(n))){
  const copy=nodes.get(node.getExtras().house_bake_id??node.getName());assert.ok(copy);assert.deepEqual(copy.getWorldMatrix(),node.getWorldMatrix(),node.getName());assert.deepEqual(copy.getExtras(),node.getExtras());
  const a=node.getMesh().listPrimitives(),b=copy.getMesh().listPrimitives();assert.equal(b.length,a.length);
  for(let i=0;i<a.length;i++){
   assert.deepEqual(b[i].getIndices()?.getArray(),a[i].getIndices()?.getArray());
   for(const semantic of a[i].listSemantics())assert.deepEqual(b[i].getAttribute(semantic).getArray(),a[i].getAttribute(semantic).getArray());
   assert.equal(b[i].getMaterial()?.getName(),a[i].getMaterial()?.getName());
   assert.deepEqual(b[i].getMaterial()?.getEmissiveTexture()?.getImage(),a[i].getMaterial()?.getEmissiveTexture()?.getImage());
  }
 }
 for(const node of delivery.getRoot().listNodes().filter(n=>n.getExtras().tree_delivery==='crossed-silhouette'))for(const primitive of node.getMesh().listPrimitives()){
  assert.ok(primitive.getMaterial().getExtension('KHR_materials_unlit'));assert.ok(primitive.getMaterial().getDoubleSided());
  assert.ok([...primitive.getAttribute('POSITION').getArray()].every(Number.isFinite));assert.equal(primitive.getMaterial().getBaseColorTexture(),null);assert.equal(primitive.getMaterial().getEmissiveTexture(),null);
 }
});
