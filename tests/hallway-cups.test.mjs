import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHouseProps} from '../web/house-props.js';
import {createHallwayCups,cupLayout,cupPyramid,CUP_FLOOR_Y,CUP_WINDOW_LIGHT} from '../web/hallway-cups.js';
function setup(){
 const scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);
 const system=createHouseProps(model,scene,{floorY:CUP_FLOOR_Y,roomBounds:[4.8,0,6.3,6.8]});
 const game=createHallwayCups(scene,system,{texture:new THREE.Texture(),random:()=>.37});
 const advance=seconds=>{for(let i=0;i<seconds*60;i++)system.update(1/60);};
 const until=phase=>{for(let i=0;i<3000&&game.state.phase!==phase;i++)system.update(1/60);assert.equal(game.state.phase,phase);};
 return {system,game,advance,until};
}
test('cups reveal, shuffle, retry misses, then grow from three to ten and become throwable',()=>{
 const {system,game,advance,until}=setup();
 assert.equal(game.props.filter(p=>p.root.visible).length,4);
 game.press(10);assert.equal(game.state.phase,'reveal');
 game.press(0);assert.equal(game.state.phase,'reveal','animation ignores guesses');
 until('choose');assert.equal(game.props[10].root.visible,false);
 game.press((game.state.winner+1)%3);until('idle');assert.equal(game.state.count,3);
 game.press(0);until('choose');
 for(let n=3;n<=10;n++){
  assert.equal(game.state.count,n);game.press(game.state.winner);
  if(n<10){advance(.2);assert.equal(game.props[n].root.visible,true,'new cup is revealed underneath');until('choose');}
  else until('done');
 }
 assert.equal(game.props.filter(p=>p.root.visible).length,11);
 cupPyramid().forEach((v,i)=>assert.ok(game.props[i].root.position.distanceTo(v)<1e-6));
 for(const p of game.props){assert.equal(p.mode,'throw');assert.equal(p.onPress,undefined);assert.equal(system.physics.items.get(p.id).releaseOnContact,true);}
 const cup=game.props[9],home=cup.root.position.clone();system.physics.grab(cup.id,home);system.physics.release(new THREE.Vector3(0,2,2));advance(.5);
 assert.ok(cup.root.position.distanceTo(home)>.1);
 game.press(0);assert.equal(game.state.phase,'done');
});
test('reduced motion still permits every round and pyramid; dormant cups stay noncolliding',()=>{
 const {system,game}=setup();
 assert.equal(system.physics.items.get(game.props[8].id).body.collisionFilterMask,0);
 game.press(0);
 for(let frame=0;frame<20000&&game.state.phase!=='done';frame++){
  if(game.state.phase==='choose')game.press(game.state.winner);
  system.update(1/60,true);
 }
 assert.equal(game.state.phase,'done');assert.equal(game.state.count,10);
});

test('cups share their appearance and own only one disposable shadow map',()=>{
 const {game}=setup();
 const meshes=game.props.map(p=>p.root.children[0]);
 assert.equal(new Set(meshes.slice(0,10).map(m=>m.geometry)).size,1);
 assert.equal(new Set(meshes.slice(0,10).map(m=>m.material)).size,1);
 assert.ok(meshes.every(m=>m.castShadow));
 assert.ok(game.shadowLight.position.distanceTo(CUP_WINDOW_LIGHT)<1e-6);
 assert.ok(game.shadowLight.target.position.z>game.shadowLight.position.z,'window shadows project toward the viewer');
 for(const mesh of meshes)assert.ok((Array.isArray(mesh.material)?mesh.material[0]:mesh.material).uniforms.windowPosition.value.distanceTo(game.shadowLight.position)<1e-6,'shine and shadows use the same window source');assert.equal(game.shadowFloor.castShadow,false);
 assert.equal(game.shadowFloor.receiveShadow,true);
 assert.ok(game.shadowFloor.position.y>CUP_FLOOR_Y,'shadow overlay must sit above the visible floorboards');
 for(const prop of game.props.filter(p=>p.root.visible))assert.ok(Math.abs(prop.root.position.y-prop.size.y/2-CUP_FLOOR_Y)<1e-6,'objects rest on the visible floor');assert.equal(game.shadowLight.shadow.mapSize.x,512);
 let disposed=0;game.shadowLight.shadow.map={dispose(){disposed++;}};game.dispose();assert.equal(disposed,1);
});

test('rounds fit four across with touch spacing and shuffle disjoint pairs faster as they grow',()=>{
 for(let n=3;n<=10;n++){
  const rows=new Map();
  for(const position of cupLayout(n)){
   if(!rows.has(position.z))rows.set(position.z,[]);
   rows.get(position.z).push(position);
  }
  assert.ok([...rows.values()].every(row=>row.length<=4));
  const depths=[...rows.keys()];
  for(let i=1;i<depths.length;i++)assert.ok(depths[i-1]-depths[i]>=.7);
 }
 const {game,advance,until}=setup();game.press(0);
 let previousDuration=Infinity;
 for(let n=3;n<=10;n++){
  until('shuffle');
  const before=game.props.slice(0,n).map(p=>p.root.position.clone());
  advance(.15);
  const moved=game.props.slice(0,n).filter((p,i)=>p.root.position.distanceTo(before[i])>.001).length;
  assert.equal(moved,n===10?10:n>8?6:n>4?4:2,`round ${n} moves distinct cups together`);
  let remaining=0;
  // A swap ends with every cup exactly on one of the row positions.
  while(remaining<60){
   game.update(1/60);remaining++;
   if(game.props.slice(0,n).every(p=>cupLayout(n).some(v=>p.root.position.distanceTo(v)<1e-6)))break;
  }
  const duration=.15+remaining/60;
  assert.ok(duration<previousDuration,`round ${n} shuffles faster`);previousDuration=duration;
  until('choose');
  const positions=game.props.slice(0,n).map(p=>p.root.position);
  assert.equal(new Set(positions.map(p=>p.toArray().join(','))).size,n,'each cup ends on a distinct spot');
  if(n<10)game.press(game.state.winner);
 }
});

test('every cup has a shared black interior on the inner profile only',()=>{
 const {game}=setup(),cup=game.props[0].root.children[0];
 assert.equal(cup.material[1].name,'Black cup interior');
 assert.ok(cup.material[1].color.r<.001);
 const groups=cup.geometry.groups;
 assert.equal(groups.length,2);
 assert.equal(groups.filter(g=>g.materialIndex===1).reduce((n,g)=>n+g.count,0),64*5*6);
 assert.equal(groups.reduce((n,g)=>n+g.count,0),cup.geometry.index.count);
});

test('winning cup lifts off a nested cup and moves aside while the new cup stays put',()=>{
 const {game,advance,until}=setup();game.press(0);until('choose');
 const winner=game.state.winner,origin=game.props[winner].root.position.clone();
 game.press(winner);
 assert.equal(game.props[3].root.visible,false,'nested cup stays concealed until the lift');
 advance(.7);
 const lower=game.props[3].root,upper=game.props[winner].root;
 assert.equal(lower.visible,true);
 assert.ok(lower.position.distanceTo(origin)<1e-6,'new cup is revealed at the original floor position');
 assert.equal(upper.position.x,origin.x);assert.equal(upper.position.z,origin.z);
 assert.ok(upper.position.y-origin.y>.27,'upper cup clears the new cup');
 advance(1.1);
 assert.ok(lower.position.distanceTo(origin)<1e-6,'lower cup stays put throughout the reveal');
 assert.ok(Math.abs(upper.position.y-origin.y)<1e-6,'upper cup settles on the floor');
 assert.ok(upper.position.distanceTo(origin)>.39,'upper cup moves clear of the new cup');
 until('choose');assert.equal(game.state.count,4);
});
