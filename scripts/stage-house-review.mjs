// Apply the reviewed fixture geometry before Cycles packs new lighting UVs.
// Source-only fixture authoring; no browser fallback is required.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,unpartition} from '@gltf-transform/functions';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {fixtureAnchors,turnOffCeilingFixtures,refineRoomFixtures} from './house-source/house-fixture-refinements.js';
import {assertUniqueTrim} from './house-source/validate-trim.mjs';
globalThis.ProgressEvent??=class{};
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),out=process.argv[2]??'scene/exports/house-release/review-reference',models=new Map(),report={removed:{},fixed:{}};
for(const room of ['structure','basement','attic']){
 const doc=await io.read(`${out}/${room}.glb`),nodes=doc.getRoot().listNodes();nodes.forEach((n,i)=>n.setExtras({...n.getExtras(),house_review_node:i,house_bake_source:n.getExtras().source_ceiling_object??n.getName()}));
 const bytes=Buffer.from(await io.writeBinary(doc)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 json.materials=[];for(const m of json.meshes)for(const p of m.primitives)delete p.material;delete json.images;delete json.textures;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),''),root=gltf.scene,owners=new Map(),originalMeshes=new Map();
 root.traverse(o=>{const id=o.userData.house_review_node;if(id!==undefined&&!owners.has(id))owners.set(id,o);if(o.isMesh)originalMeshes.set(o,{geometry:o.geometry,primitive:gltf.parser.associations.get(o)?.primitives??0});});
 root.traverse(o=>{let owner=o;while(owner&&owner.userData.house_review_node===undefined)owner=owner.parent;if(owner&&owner!==o)Object.assign(o.userData,owner.userData);});
 models.set(room,{doc,nodes,root,owners,originalMeshes});
}
const structure=models.get('structure').root;structure.updateMatrixWorld(true);const anchors=fixtureAnchors(structure);
turnOffCeilingFixtures(structure);
for(const room of ['basement','attic'])refineRoomFixtures(models.get(room).root,room,{structure,...anchors});
const fixture=/^(Copper water pipe|Stored flexible hose|Loose electrical junction box|Misaligned junction cover|Attic bare work bulb|Bare bulb hanging wire|Attic bulb socket|Copper pipe ceiling elbow|Copper pipe wall mounting plate|Copper pipe wall saddle)$/;
for(const [room,{doc,nodes,root,owners,originalMeshes}] of models){
 const buffer=doc.getRoot().listBuffers()[0],removed=[],fixed=[],added=new Map(),matCache=new Map();root.updateMatrixWorld(true);
 const nameOf=o=>(o.userData.house_bake_source??o.userData.source_object??o.name.replaceAll('_',' ')).replace(/\.?\d{3}$/,'');
 const alive=o=>{for(let p=o;p;p=p.parent){if(!p.visible)return false;if(p===root)return true;}return false;};
 function reflectance(o){
  const name=nameOf(o),basic=o.material?.isMeshBasicMaterial;
  if(!basic&&!fixture.test(name)&&!/^(?:Finish \/ )?(Laundry light|Workshop overhead)/.test(name))return null;
  const color=basic?o.material.color.toArray():/Copper|water pipe/i.test(name)?new THREE.Color(0x655332).toArray():/hose/i.test(name)?new THREE.Color(0x171d23).toArray():new THREE.Color(0x394651).toArray();
  const key=JSON.stringify(color);if(!matCache.has(key))matCache.set(key,doc.createMaterial('Reviewed fixed fixture '+key).setBaseColorFactor([...color,1]).setRoughnessFactor(.85).setMetallicFactor(0));
  o.userData.house_authored_reflectance=true;o.userData.house_fixed_receiver=true;o.userData.review_fixed_fixture=true;o.userData.bake_connection=true;o.userData.release_dynamic=false;
  delete o.userData.release_baked;return matCache.get(key);
 }
 function geometry(g,material){
  const p=doc.createPrimitive().setMaterial(material);
  for(const [semantic,attribute,type] of [['POSITION','position','VEC3'],['NORMAL','normal','VEC3'],['TEXCOORD_0','uv','VEC2']]){
   const a=g.getAttribute(attribute);if(a){const array=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.getComponent(i,k);p.setAttribute(semantic,doc.createAccessor().setType(type).setArray(array).setBuffer(buffer));}
  }
  if(g.index)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(g.index.array.slice()).setBuffer(buffer));return p;
 }
 function extras(o,old={}){const e={...old,...o.userData};delete e.house_review_node;return e;}
 for(const [id,o] of owners){
  const n=nodes[id];if(!alive(o)){removed.push(n.getName());n.dispose();continue;}
  o.updateMatrix();n.setMatrix(o.matrix.toArray());
  const meshes=[];o.traverse(m=>{if(!m.isMesh||!originalMeshes.has(m))return;let owner=m;while(owner.parent&&owner!==o&&owner.parent.userData.house_review_node===id)owner=owner.parent;if(owner===o)meshes.push(m);});
  if(n.getMesh()){
   const old=n.getMesh(),mesh=doc.createMesh(old.getName());
   for(const m of meshes){const original=originalMeshes.get(m),p=old.listPrimitives()[original.primitive],material=reflectance(m)??p.getMaterial();mesh.addPrimitive(geometry(m.geometry,material));Object.assign(o.userData,m.userData);}
   if(mesh.listPrimitives().length)n.setMesh(mesh);else mesh.dispose();
  }
  n.setExtras(extras(o,n.getExtras()));if(o.userData.review_fixed_fixture)fixed.push(n.getName());
 }
 // New elbow, mounting plates and attic socket retain their exact parent pose.
 function add(o){
  if(added.has(o))return added.get(o);
  if(o===root)return doc.getRoot().listScenes()[0];
  const id=o.userData.house_review_node;if(id!==undefined&&owners.get(id)===o)return nodes[id];
  const parent=add(o.parent),n=doc.createNode(o.name.replaceAll('_',' '));o.updateMatrix();n.setMatrix(o.matrix.toArray());
  if(o.isMesh){const material=reflectance(o);if(!material)throw Error(`New fixture lacks reflectance: ${o.name}`);n.setMesh(doc.createMesh(n.getName()).addPrimitive(geometry(o.geometry,material)));fixed.push(n.getName());}
  n.setExtras(extras(o,{release_room:room,style_source:'original-room-palette'}));parent.addChild(n);added.set(o,n);return n;
 }
 root.traverse(o=>{if(o.isMesh&&!originalMeshes.has(o)&&alive(o))add(o);});
 doc.getRoot().listScenes()[0].setExtras({...doc.getRoot().listScenes()[0].getExtras(),review_fixtures_baked:true});
 await doc.transform(prune(),unpartition());if(room==='structure')assertUniqueTrim(doc);
 for(const n of doc.getRoot().listNodes().filter(n=>n.getMesh()))for(const p of n.getMesh().listPrimitives()){const counts=p.listAttributes().map(a=>a.getCount());if(new Set(counts).size>1)throw Error(`Mismatched geometry attributes: ${n.getName()} ${counts}`);}
 await io.write(`${out}/${room}.glb`,doc);
 report.removed[room]=removed;report.fixed[room]=fixed;console.log('REVIEW_STAGED',room,'fixed',fixed.length,'removed',removed.length);
}
const layout=JSON.parse(readFileSync(`${out}/layout.json`));layout.reviewPreparation=report;
writeFileSync(`${out}/layout.json`,JSON.stringify(layout,null,2)+'\n');writeFileSync(`${out}/review-report.json`,JSON.stringify(report,null,2)+'\n');
