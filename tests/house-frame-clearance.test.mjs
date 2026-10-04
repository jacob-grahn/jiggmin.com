import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Box3,Matrix4,Vector3} from 'three';
const directory=process.env.ATLAS_REFRESH_DIR??'web/assets/house/release';
const document=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${directory}/structure.glb`);
const nodes=new Map(document.getRoot().listNodes().map(n=>[n.getName(),n]));
function bounds(name){
 const node=nodes.get(name);assert.ok(node,name);const box=new Box3(),matrix=new Matrix4().fromArray(node.getWorldMatrix());
 for(const primitive of node.getMesh().listPrimitives()){
  const a=primitive.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)box.expandByPoint(new Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));
 }
 return box;
}
test('door headers cover the wall reveal with real geometry clearance',()=>{
 const openings=[['den','Proposed wall 04.005'],['front','Proposed wall 02.001'],['mudroom','Proposed wall 10.001'],['stairs','Proposed wall 11.001'],['bedroom-1','Proposed wall 04.001'],['bedroom-2','Proposed wall 05.001'],['kitchen','Proposed wall 04.003'],['bath','Proposed wall 05.003']];
 const tested=new Set(openings.map(([name])=>`Finish / ${name} head`));
 for(const node of nodes.values())if(node.getExtras().release_baked==='hall-trim'&&/ head$/.test(node.getName()))assert.ok(tested.has(node.getName()),`Uncovered hallway doorway: ${node.getName()}`);
 for(const [opening,wall] of openings){
  const header=bounds(`Finish / ${opening} head`),reveal=bounds(wall);
  assert.ok(reveal.min.y-header.min.y>=.009,`${opening}: header competes with wall reveal`);
  for(const suffix of ['', '.001'])assert.ok(Math.abs(bounds(`Finish / ${opening} casing${suffix}`).max.y-header.min.y)<1e-5,`${opening}: overlapping front faces at head/casing joint`);
 }
});
test('hatch liner stands clear of the ceiling reveal and leaves room for the leaf',()=>{
 const left=bounds('Finish / hatch liner'),right=bounds('Finish / hatch liner.001'),front=bounds('Finish / hatch liner.002'),back=bounds('Finish / hatch liner.003'),leaf=bounds('Attic hatch');
 assert.ok(left.max.x>=8.7099&&right.min.x<=9.9401,'liner faces coincide with ceiling opening');
 assert.ok(front.max.z>=7.0599&&back.min.z<=8.0401,'liner faces coincide with ceiling opening');
 for(const gap of [leaf.min.x-left.max.x,right.min.x-leaf.max.x,leaf.min.z-front.max.z,back.min.z-leaf.max.z])assert.ok(gap>.004,'hatch leaf intersects liner');
});
test('hatch casing has butt joints instead of overlapping visible corner faces',()=>{
 const left=bounds('Finish / hatch casing'),right=bounds('Finish / hatch casing.001');
 for(const suffix of ['.002','.003']){
  const cross=bounds('Finish / hatch casing'+suffix);
  assert.ok(Math.abs(cross.min.x-left.max.x)<1e-5&&Math.abs(cross.max.x-right.min.x)<1e-5,'casing corners overlap');
 }
});
