import test from 'node:test';
import assert from 'node:assert/strict';
import {SHELF_SLOTS,RestTimer,shuffled,zoomPoint} from '../web/library-behavior.js';
import {CartridgePhysics} from '../web/physics.js';
import {readFileSync} from 'node:fs';
const pose=(x,y,z)=>({position:{x,y,z},quaternion:{x:0,y:0,z:0,w:1}});
test('Shelf holds the full collection with thinner, separated cartridges',()=>{
 assert.equal(SHELF_SLOTS.length,27);
 for(const slot of SHELF_SLOTS){assert.ok(slot.position.x-.044> -3.332);assert.ok(slot.position.x+.044< -2.147);}
 assert.ok(SHELF_SLOTS[1].position.x-SHELF_SLOTS[0].position.x>.087);
 const ids=Array.from({length:23},(_,i)=>i),order=shuffled(ids,()=>.4);
 assert.equal(new Set(order).size,23);assert.deepEqual([...order].sort((a,b)=>a-b),ids);assert.notDeepEqual(order,ids);
});
test('Recovery requires five uninterrupted resting seconds out of view',()=>{
 const timer=new RestTimer(),lost={resting:true,visible:false,excluded:false};
 assert.equal(timer.update('a',4.9,lost),false);
 assert.equal(timer.update('a',.11,lost),true);
 for(const interruption of [{visible:true},{resting:false},{excluded:true}]){
  timer.update('a',0,{...lost,...interruption});assert.equal(timer.update('a',4.9,lost),false);
 }
});
test('Physical support distinguishes the table from the floor and survives sleeping',()=>{
 const p=new CartridgePhysics(JSON.parse(readFileSync('web/assets/colliders.json')));
 p.add('table',pose(1.6,2,1.5));p.place('table',pose(1.6,2,1.5));
 p.add('floor',pose(3.8,1,3));p.place('floor',pose(3.8,1,3));
 for(let i=0;i<120*8;i++)p.step(1/120);
 assert.equal(p.items.get('table').supported,true);
 assert.equal(p.items.get('floor').supported,false);
 assert.equal(p.items.get('table').body.sleepState,2);
});
test('Slow zoom retains both the CRT and console slot in view',()=>{
 for(const point of [[.341,.231],[.659,.562],[.477,.717]]){
  const [x,y]=zoomPoint(point,1.32);assert.ok(x>0&&x<1&&y>0&&y<1);
 }
});
test('TV, bookshelf and cartridge stacks remain valid resting places',()=>{
 const p=new CartridgePhysics(JSON.parse(readFileSync('web/assets/colliders.json')));
 for(const [id,position] of [['tv',[0,3.5,0]],['shelf',[-2.7,1.18,0]],['lower',[1.6,.72,1.5]],['upper',[1.6,1.25,1.5]]]){
  p.add(id,pose(...position));p.place(id,pose(...position));
 }
 for(let i=0;i<120*8;i++)p.step(1/120);
 for(const id of ['tv','shelf','lower','upper'])assert.equal(p.items.get(id).supported,true,id);
});
