import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {createHash} from 'node:crypto';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import {windowExteriorFrame} from '../web/house-window-exterior.js';
const dir=process.env.HOUSE_RELEASE_DIR??'web/assets/house/release',layout=JSON.parse(readFileSync(`${dir}/layout.json`));
function triangles(node){
 const result=new Set(),world=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 for(const p of node.getMesh().listPrimitives()){
  const pos=p.getAttribute('POSITION'),indices=p.getIndices();
  for(let i=0;i<(indices?.getCount()??pos.getCount());i+=3){
   const corners=[0,1,2].map(k=>new THREE.Vector3(...pos.getElement(indices?indices.getScalar(i+k):i+k,[])).applyMatrix4(world).toArray().map(c=>Math.round(c*10000)).join(',')).sort();
   result.add(corners.join(';'));
  }
 }
 return [...result].sort();
}
test('window bake changes only fixed surface lighting, retaining every reviewed triangle',{skip:!layout.lightingBake},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const room of ['structure','basement','attic']){
  const input=await io.read(`scene/exports/house-release/bake-input/${room}.glb`),output=await io.read(`${dir}/${room}.glb`);
  const sources=new Map(input.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getExtras().house_bake_id,n]));
  for(const node of output.getRoot().listNodes().filter(n=>n.getMesh())){
   const original=sources.get(node.getExtras().house_bake_id);assert.ok(original,node.getName());
   assert.deepEqual(triangles(node),triangles(original),`${room}/${node.getName()} geometry changed`);
   if(node.getExtras().house_window_bake){
    assert.ok(!node.getExtras().release_dynamic);assert.ok(!['door','ladder'].includes(node.getExtras().preview_kind));
    for(const p of node.getMesh().listPrimitives()){
     assert.ok(p.getMaterial().getEmissiveTexture());assert.ok(!p.getMaterial().getExtras().ceiling_paint,'preview ceiling grade was applied twice');
    }
   }else if(room==='attic'){
    const before=original.getMesh().listPrimitives(),after=node.getMesh().listPrimitives();
    assert.equal(after.length,before.length,node.getName());
    for(let i=0;i<after.length;i++){
     const a=after[i].getMaterial(),b=before[i].getMaterial();
     assert.deepEqual(a.getBaseColorFactor(),b.getBaseColorFactor(),node.getName());
     assert.deepEqual(a.getEmissiveFactor(),b.getEmissiveFactor(),node.getName());
     for(const slot of ['BaseColor','Emissive','Normal','Occlusion','MetallicRoughness']){
      assert.deepEqual(a[`get${slot}Texture`]()?.getImage(),b[`get${slot}Texture`]()?.getImage(),`${node.getName()} ${slot} texture changed`);
     }
    }
   }
  }
 }
});
test('window bake retains the original room assets byte for byte',{skip:!layout.lightingBake},()=>{
 for(const room of ['hallway','workshop'])assert.deepEqual(readFileSync(`${dir}/${room}.glb`),readFileSync(`scene/exports/house-release/bake-input/${room}.glb`));
 assert.equal(layout.assets.den,null);assert.deepEqual(layout.lights,[]);
});
test('basement and attic fixture lightmaps retain the exact generated pixels',{skip:!layout.reviewPreparation},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const room of ['basement','attic']){
  const doc=await io.read(`${dir}/${room}.glb`),nodes=doc.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().house_window_bake);
  for(const n of nodes)for(const p of n.getMesh().listPrimitives()){
   assert.ok(p.getAttribute('TEXCOORD_0'));
   const atlas=readFileSync(`scene/exports/house-release/${layout.lightingBake.quality}/${n.getExtras().release_baked}.png`);
   assert.equal(hash(p.getMaterial().getEmissiveTexture().getImage()),hash(atlas),n.getName());
   assert.deepEqual(p.getMaterial().getEmissiveFactor(),[1,1,1]);
  }
 }
});
test('fixed window frames and cellar recesses receive baked light while glass stays transparent',{skip:!(layout.lightingBake?.report?.lighting?.windowRevision>=2)},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const [room,count] of [['structure',42],['basement',33]]){
  const doc=await io.read(`${dir}/${room}.glb`),nodes=doc.getRoot().listNodes().filter(n=>n.getMesh());
  const receivers=nodes.filter(n=>n.getExtras().house_window_receiver);assert.equal(receivers.length,count,room);
  for(const n of receivers){assert.ok(n.getExtras().house_window_bake,n.getName());assert.ok(!n.getExtras().release_dynamic);}
  for(const n of nodes.filter(n=>/glass/.test(n.getName())))assert.ok(!n.getExtras().house_window_bake,n.getName());
 }
});
test('cellar upper panes have a sky sightline above the yard from the seated camera',{skip:!(layout.lightingBake?.report?.lighting?.windowRevision>=2)},async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),yard=new THREE.Group();
 const shell=await io.read(`${dir}/structure.glb`),cellar=await io.read(`${dir}/basement.glb`);
 const convert=(node,p)=>{
  const g=new THREE.BufferGeometry();for(const [from,to] of [['POSITION','position'],['NORMAL','normal']]){const a=p.getAttribute(from);if(a)g.setAttribute(to,new THREE.BufferAttribute(a.getArray(),a.getElementSize()));}
  if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));return mesh;
 };
 for(const n of shell.getRoot().listNodes().filter(n=>n.getMesh()&&/^Yard/.test(n.getName())))for(const p of n.getMesh().listPrimitives())yard.add(convert(n,p));
 yard.updateMatrixWorld(true);const eye=new THREE.Vector3(...layout.views.basement.position);
 const windows=cellar.getRoot().listNodes().filter(n=>n.getMesh()&&/^Garden beyond window/.test(n.getName()));assert.equal(windows.length,3);
 for(const node of windows){
  const frame=windowExteriorFrame(convert(node,node.getMesh().listPrimitives()[0])),point=frame.center.clone();point.y+=frame.size.y*.23;
  const direction=point.clone().sub(eye).normalize(),ray=new THREE.Raycaster(point.addScaledVector(direction,.01),direction,0,200);
  assert.equal(ray.intersectObject(yard,true).length,0,`${node.getName()} sees the yard slab instead of sky`);
 }
});
test('release pipeline requires a matching small bake before a full bake',()=>{
 const pipeline=readFileSync('scripts/house_release.py','utf8');assert.ok(pipeline.includes("report.get('sourceKey')!=source_key()"));
 const lighting=readFileSync('scene/scripts/house_bake_lighting.py','utf8');assert.ok(!lighting.includes("'SUN'"));assert.ok(!lighting.includes('preview_light'));
});
