import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {roomMatrix,buildConnections,sampleRoute} from '../web/house-layout.js';
const layout=JSON.parse(readFileSync('web/assets/house/layout.json'));

test('every passage has a continuous reversible camera path clear of its enclosure',()=>{
 const {group}=buildConnections(layout);group.updateMatrixWorld(true);
 const walls=[];group.traverse(o=>{if(o.isMesh&&!o.parent.name?.includes('ladder')){o.material.side=THREE.DoubleSide;walls.push(o);}});
 for(const [room,path] of Object.entries(layout.routes)){
  const points=path.map(p=>new THREE.Vector3(...p));
  assert.deepEqual(sampleRoute(points,0).toArray(),path[0]);assert.deepEqual(sampleRoute(points,1).toArray(),path.at(-1));
  for(let i=1;i<points.length;i++){
   const delta=points[i].clone().sub(points[i-1]);
   const ray=new THREE.Raycaster(points[i-1],delta.clone().normalize(),.001,delta.length()-.001);
   const hits=ray.intersectObjects(walls,false).filter(h=>!h.object.name.startsWith('Attic ladder'));
   assert.equal(hits.length,0,`${room} crosses ${hits.map(h=>h.object.name)}`);
  }
  for(let i=0;i<=100;i++){
   const p=sampleRoute(points,i/100),reverse=sampleRoute([...points].reverse(),1-i/100);
   assert.ok(p.distanceTo(reverse)<1e-8);
   if(i)assert.ok(p.distanceTo(sampleRoute(points,(i-1)/100))<.5,'camera path jumps');
  }
 }
});
test('basement is one storey below and the stairs reach its floor',()=>{
 assert.equal(layout.rooms.basement.position[1],-4);
 const stairs=layout.geometry.filter(p=>p.name==='Basement stair tread');assert.equal(stairs.length,20);
 assert.ok(Math.abs(stairs.at(-1).position[1]+stairs.at(-1).size[1]/2+4)<1e-8);
 const threshold=new THREE.Vector3(3.6,0,layout.rooms.basement.front).applyMatrix4(roomMatrix(layout.rooms.basement));
 assert.ok(threshold.distanceTo(new THREE.Vector3(7.4,-4,1.8))<1e-8);
});
