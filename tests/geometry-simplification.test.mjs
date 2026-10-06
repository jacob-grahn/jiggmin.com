import test from 'node:test';
import assert from 'node:assert/strict';
import {Document,NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import {simplifyGeometry} from '../scripts/simplify-geometry.mjs';
import {GEOMETRY_SIMPLIFICATION} from '../scripts/asset-compression.config.mjs';

function fixture(){
 const doc=new Document().setLogger(new Logger(Logger.Verbosity.ERROR)),buffer=doc.createBuffer();
 const geometry=new THREE.PlaneGeometry(2,2,20,20),primitive=doc.createPrimitive();
 for(const [name,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){
  const attribute=geometry.attributes[name];
  primitive.setAttribute(semantic,doc.createAccessor().setType(attribute.itemSize===2?'VEC2':'VEC3').setArray(attribute.array.slice()).setBuffer(buffer));
 }
 primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array.slice()).setBuffer(buffer));
 primitive.setMaterial(doc.createMaterial('Baked surface').setBaseColorFactor([.3,.5,.7,1]));
 const mesh=doc.createMesh('Grid').addPrimitive(primitive),node=doc.createNode('Window wall').setMesh(mesh).setTranslation([1,2,3]).setExtras({house_bake_id:'wall',hotspot:'window'});
 doc.createScene().addChild(node);return {doc,node,primitive};
}

test('simplification preserves mesh boundaries, vertex attributes and interaction metadata',async()=>{
 const {doc,node,primitive}=fixture(),matrix=node.getWorldMatrix(),extras=node.getExtras(),material=primitive.getMaterial();
 const vertices=new Map(),boundary=new Set();
 const position=primitive.getAttribute('POSITION');
 for(let i=0;i<position.getCount();i++){
  const p=position.getElement(i,[]),key=p.join(',');
  vertices.set(key,[primitive.getAttribute('NORMAL').getElement(i,[]),primitive.getAttribute('TEXCOORD_0').getElement(i,[])]);
  if(Math.abs(p[0])===1||Math.abs(p[1])===1)boundary.add(key);
 }
 const report=await simplifyGeometry(doc,GEOMETRY_SIMPLIFICATION);
 assert.ok(report.afterTriangles<report.beforeTriangles/2);
 assert.deepEqual(node.getWorldMatrix(),matrix);assert.deepEqual(node.getExtras(),extras);assert.equal(primitive.getMaterial(),material);
 const remaining=new Set();
 for(let i=0;i<primitive.getAttribute('POSITION').getCount();i++){
  const key=primitive.getAttribute('POSITION').getElement(i,[]).join(',');remaining.add(key);
  assert.deepEqual([primitive.getAttribute('NORMAL').getElement(i,[]),primitive.getAttribute('TEXCOORD_0').getElement(i,[])],vertices.get(key));
 }
 for(const key of boundary)assert.ok(remaining.has(key),'locked boundary vertex moved or disappeared');
});

test('welding retains coincident vertices on different UV islands',async()=>{
 const doc=new Document(),buffer=doc.createBuffer(),primitive=doc.createPrimitive();
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,-1,0]);
 const uv=new Float32Array([0,0,1,0,0,1,0,1,1,1,0,0]);
 primitive.setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer));
 primitive.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
 doc.createMesh('UV islands').addPrimitive(primitive);
 const report=await simplifyGeometry(doc,GEOMETRY_SIMPLIFICATION);
 assert.equal(report.afterTriangles,2);
 assert.equal(primitive.getAttribute('POSITION').getCount(),6);
 assert.deepEqual(primitive.getAttribute('TEXCOORD_0').getArray(),uv);
});

test('zero threshold disables reduction and invalid thresholds fail',async()=>{
 const {doc}=fixture();const report=await simplifyGeometry(doc,{...GEOMETRY_SIMPLIFICATION,error:0});
 assert.equal(report.afterTriangles,report.beforeTriangles);
 await assert.rejects(simplifyGeometry(doc,{error:NaN}),/Invalid geometry/);
});

test('den delivery reduces dense geometry while retaining every named object',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('web/assets/room.glb');doc.setLogger(new Logger(Logger.Verbosity.ERROR));
 const names=doc.getRoot().listNodes().map(n=>n.getName()),report=await simplifyGeometry(doc,GEOMETRY_SIMPLIFICATION);
 assert.deepEqual(doc.getRoot().listNodes().map(n=>n.getName()),names);
 assert.ok(report.afterTriangles<report.beforeTriangles*.3);
 assert.ok(report.nodes.every(n=>n.afterTriangles>0));
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
  for(const semantic of p.listSemantics())assert.ok(p.getAttribute(semantic).getArray().every(Number.isFinite));
  assert.ok(p.getIndices().getArray().every(i=>i<p.getAttribute('POSITION').getCount()));
 }
});
