import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createRoute} from '../web/house-layout.js';
const spec=JSON.parse(execFileSync('python3',['scene/scripts/house_preview_spec.py'],{encoding:'utf8'}));
const solids=spec.parts.filter(p=>['shell','floor','ceiling','roof'].includes(p.kind)).map(p=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...p.size),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.name=p.name;m.position.fromArray(p.center);m.rotation.z=p.slope??0;m.updateMatrixWorld();return m;});
test('preview travel curves clear proposed walls, floors and roof',()=>{
 for(const [id,points]of Object.entries(spec.routes)){
  const route=createRoute(points.map(p=>new THREE.Vector3(...p)));let previous=route.getPoint(0);
  for(let i=1;i<=800;i++){
   const point=route.getPoint(i/800),delta=point.clone().sub(previous),length=delta.length();
   const hits=new THREE.Raycaster(previous,delta.normalize(),.00001,length).intersectObjects(solids,false);
   assert.equal(hits.length,0,`${id} at ${(i/8).toFixed(1)}% hits ${hits.map(h=>h.object.name).join(', ')}`);previous=point;
  }
  assert.deepEqual(points[0],spec.views.hub.position);assert.deepEqual(points.at(-1),spec.views[id].position);
 }
});
test('new structural shell leaves actual door and hatch apertures',()=>{
 for(const [id,center]of Object.entries(spec.hub_targets)){
  const target=new THREE.Vector3(...center);if(id==='attic')target.z+=.25;
  const from=new THREE.Vector3(...spec.views.hub.position),delta=target.clone().sub(from);
  // Target door faces, not the back edge of an oblique jamb.
  if(id!=='attic')target.z+=id==='workshop'?.08:-.08;
  delta.copy(target).sub(from);const hits=new THREE.Raycaster(from,delta.clone().normalize(),.01,delta.length()-.1).intersectObjects(solids,false);
  assert.equal(hits.length,0,`${id}: ${hits.map(h=>h.object.name)}`);
 }
});
