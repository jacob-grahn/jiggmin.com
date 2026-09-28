import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBonusCollection,normalizeBonusGame,BONUS_KEY} from '../web/bonus-collection.js';
import {JOURNAL_KEY} from '../web/house-state.js';
import {bonusDeliveryPoses} from '../web/bonus-cartridge-model.js';
import {CartridgePhysics} from '../web/physics.js';
import {playbackFile} from '../web/interaction.js';
import {resolveRoute} from '../web/routes.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('found bonus cartridges persist until delivery and never duplicate',()=>{
 const storage=memory(),first=createBonusCollection(storage);
 assert.deepEqual(first.found,[]);assert.equal(first.collect('inkclipse'),true);assert.equal(first.collect('inkclipse'),false);assert.equal(first.collect('unknown'),false);
 const returning=createBonusCollection(storage);assert.equal(returning.pending('inkclipse'),true);
 returning.delivered('inkclipse');returning.delivered('unknown');
 const reload=createBonusCollection(storage);assert.deepEqual(reload.found,['inkclipse']);assert.equal(reload.pending('inkclipse'),false);
 reload.collect('a-murder-in-crowland');assert.equal(reload.pending('a-murder-in-crowland'),true);assert.equal(reload.pending('inkclipse'),false);
});
test('old journal bonus discoveries migrate to pending cartridges',()=>{
 const storage=memory();storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,ids:['crowland','inkclipse','tablet']}));
 const collection=createBonusCollection(storage);assert.deepEqual(collection.found,['a-murder-in-crowland','inkclipse']);
 for(const id of collection.found){assert.equal(collection.pending(id),true);collection.delivered(id);}
 for(const id of createBonusCollection(storage).found)assert.equal(createBonusCollection(storage).pending(id),false);
});
test('corrupt storage is ignored and unavailable storage still works during the visit',()=>{
 const storage=memory();storage.setItem(BONUS_KEY,'{');assert.deepEqual(createBonusCollection(storage).found,[]);
 storage.setItem(BONUS_KEY,JSON.stringify({version:1,found:['inkclipse','bad'],delivered:['a-murder-in-crowland','bad']}));
 const collection=createBonusCollection(storage);assert.deepEqual(collection.found,['inkclipse']);assert.equal(collection.pending('inkclipse'),true);
 const unavailable=createBonusCollection({getItem(){throw Error();},setItem(){throw Error();}});
 unavailable.collect('inkclipse');assert.equal(unavailable.pending('inkclipse'),true);unavailable.delivered('inkclipse');assert.equal(unavailable.pending('inkclipse'),false);
});
test('bonus games use ordinary cartridge artwork, console playback, and built routes',()=>{
 for(const original of JSON.parse(readFileSync('data/bonus-games.json')).games){
  const game=normalizeBonusGame(original);assert.equal(game.thumbnail.file,original.thumbnail);assert.equal(playbackFile(game),original.file);assert.equal(game.gameplay.mode,'touch');
  assert.equal(resolveRoute('/'+game.id,[game]).game,game);
  assert.match(readFileSync(`dist/${game.id}/index.html`,'utf8'),/<base href="\/">/);
 }
});
test('both delivery paths start near the viewer and drop cartridges onto the table',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,2.5,6);camera.lookAt(0,1,1.5);camera.updateMatrixWorld();
 const physics=new CartridgePhysics(JSON.parse(readFileSync('web/assets/colliders.json')));
 for(let index=0;index<2;index++){
  const {start,drop}=bonusDeliveryPoses(camera,index);
  assert.ok(start.position.distanceTo(camera.position)<1.4);assert.ok(start.position.z>drop.position.z);
  physics.add(String(index),drop);physics.place(String(index),drop);
 }
 for(let i=0;i<480;i++)physics.step(1/120);
 for(const id of ['0','1']){const body=physics.items.get(id).body;assert.ok(body.position.y>.69&&body.position.y<.82);assert.ok(Math.abs(body.position.x)<2);}
});
