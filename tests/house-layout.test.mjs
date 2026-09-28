import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {roomMatrix,buildConnections,sampleRoute,travelEase,setAtticAccess} from '../web/house-layout.js';
const layout=JSON.parse(readFileSync('web/assets/house/layout.json'));
test('den shares a single hallway doorway without an intervening corridor',()=>{
 const {den,workshop}=layout.rooms;
 const anchors=JSON.parse(readFileSync('web/assets/house/anchors.json'));
 const doorway=new THREE.Vector3(...anchors.hallway['door-den'].position);
 const sharedWall=den.position[0]+den.right;
 assert.ok(Math.abs(doorway.x-sharedWall)<.05);
 assert.ok(layout.routes.den.some(p=>Math.abs(p[0]-sharedWall)<.05&&Math.abs(p[2]-doorway.z)<.05));
 assert.ok(!layout.geometry.some(p=>/Den (side passage|approach|passage corner|elbow)/.test(p.name)));
 const points=layout.routes.den.map(p=>new THREE.Vector3(...p));
 const distance=points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);
 assert.ok(distance<5,'den threshold should not require a long connecting passage');
 assert.ok(workshop.position[0]>0);
 assert.ok(layout.rooms.basement.position[0]<0);
 const workshopDoor=new THREE.Vector3(...anchors.hallway['door-workshop'].position);
 assert.ok(Math.abs(workshopDoor.z-workshop.position[2])<.05);
});
test('attic stairs retract with the hatch and reopen at their original position',()=>{
 const {ladder}=buildConnections(layout),door={pivot:new THREE.Group(),axis:'x',angle:1.5};
 setAtticAccess(ladder,door,1);
 assert.equal(ladder.visible,true);assert.deepEqual(ladder.position.toArray(),[0,0,0]);
 setAtticAccess(ladder,door,.5);
 assert.ok(ladder.position.y>0);assert.equal(door.pivot.rotation.x,.75);
 setAtticAccess(ladder,door,0);
 assert.equal(ladder.visible,false);assert.equal(door.pivot.rotation.x,0);
 setAtticAccess(ladder,door,1);
 assert.equal(ladder.visible,true);assert.deepEqual(ladder.position.toArray(),[0,0,0]);
 assert.equal(door.pivot.rotation.x,1.5);
});

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
   if(i){
    const previous=sampleRoute(points,(i-1)/100),delta=p.clone().sub(previous);
    assert.ok(delta.length()<.5,'camera path jumps');
    const ray=new THREE.Raycaster(previous,delta.clone().normalize(),.001,delta.length()-.001);
    const hits=ray.intersectObjects(walls,false).filter(h=>!h.object.name.startsWith('Attic ladder'));
    assert.equal(hits.length,0,`${room} rounded path crosses ${hits.map(h=>h.object.name)}`);
   }
  }
 }
});
test('basement is one storey below and the stairs reach its floor',()=>{
 assert.equal(layout.rooms.basement.position[1],-4);
 const stairs=layout.geometry.filter(p=>p.name==='Basement stair tread');assert.equal(stairs.length,20);
 assert.ok(Math.abs(stairs.at(-1).position[1]+stairs.at(-1).size[1]/2+4)<1e-8);
 const threshold=new THREE.Vector3(3.6,0,layout.rooms.basement.front).applyMatrix4(roomMatrix(layout.rooms.basement));
 assert.ok(threshold.distanceTo(new THREE.Vector3(-7.4,-4,-3.2))<1e-8);
});

test('travel eases gently at both endpoints',()=>{
 assert.equal(travelEase(0),0);assert.equal(travelEase(1),1);
 assert.ok(travelEase(.01)<.00002);
 assert.ok(1-travelEase(.99)<.00002);
 for(let i=0;i<=100;i++)assert.ok(Math.abs(travelEase(i/100)+travelEase(1-i/100)-1)<1e-12);
});

test('den sweep is one reversible curve crossing only the open doorway',async()=>{
 const {createDenRoute}=await import('../web/house-layout.js');
 const hallway=new THREE.Vector3(...layout.rooms.hallway.viewPosition);
 for(const height of [2.2,3]){
  const den=new THREE.Vector3(-5.77,height,9.8);
  const route=createDenRoute(den,hallway,layout.denCurve),reverse=createDenRoute(den,hallway,layout.denCurve,true);
  assert.equal(route.curves.length,1);
  assert.ok(route.getPoint(0).distanceTo(den)<1e-8);
  assert.ok(route.getPoint(1).distanceTo(hallway)<1e-8);
  let previous=den;
  for(let i=1;i<=500;i++){
   const point=route.getPoint(i/500);
   assert.ok(point.distanceTo(reverse.getPoint(1-i/500))<1e-6);
   assert.ok(point.x>=previous.x,'no lateral backtracking or extra turns');
   if(Math.abs(point.x+1.39)<.15){
    assert.ok(Math.abs(point.z-5.9)<.4,'sweep clears the door jambs');
    assert.ok(point.y<2.4,'sweep clears the lintel');
   }
   previous=point;
  }
 }
});

test('Basement stairs have a continuous pitched ceiling and unlit inset fittings',()=>{
 const ceiling=layout.geometry.filter(p=>p.name==='Basement stairwell ceiling');
 assert.equal(ceiling.length,1);assert.ok(Math.abs(ceiling[0].slope-Math.atan2(4,6))<1e-8);
 const rail=layout.geometry.filter(p=>p.name==='Basement stair handrail');
 assert.equal(rail.length,2);assert.ok(rail.every(p=>p.size[0]>6&&p.slope===ceiling[0].slope));
 assert.equal(layout.geometry.filter(p=>p.name==='Basement stair recessed opal off').length,2);
});

test('basement entrance sleeve seals the stair-wall seam without obstructing the doorway',()=>{
 const {group}=buildConnections({...layout,geometry:layout.geometry.filter(p=>p.name.startsWith('Basement entrance'))});
 group.updateMatrixWorld(true);
 for(const mesh of group.children.filter(o=>o.isMesh))mesh.material.side=THREE.DoubleSide;
 const solids=group.children.filter(o=>o.isMesh);
 for(const x of [-1.35,-1.4,-1.6,-1.95])for(const y of [.2,1.2,2.4])for(const side of [-1,1]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,y,-3.2),new THREE.Vector3(0,0,side),0,1);
  assert.ok(ray.intersectObjects(solids,false).length>0,`stair seam leaks at ${x}, ${y}`);
 }
 const doorway=new THREE.Raycaster(new THREE.Vector3(0,1.7,-3.2),new THREE.Vector3(-1,0,0),0,2.5);
 assert.equal(doorway.intersectObjects(solids,false).length,0);
});
