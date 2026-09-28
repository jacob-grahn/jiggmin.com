import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {cartridgeRoom,createBasementCartridges} from '../web/cartridge-storage.js';
import {createHouseProps} from '../web/house-props.js';
import {createRoomResources} from '../web/house-resources.js';
const profiles=JSON.parse(readFileSync('data/gameplay.json')).games;
const games=JSON.parse(readFileSync('data/games.json')).games.map(game=>({...game,gameplay:profiles[game.id]}));
test('only the four broken cartridges are assigned to basement storage',()=>{
 assert.deepEqual(games.filter(game=>cartridgeRoom(game)==='basement').map(game=>game.id).sort(),['click-upon-dots','kongregate-racing','platform-racing','platform-racing-3']);
 assert.equal(games.filter(game=>cartridgeRoom(game)==='den').length,20);
});
test('basement cartridges stay whole and room disposal leaves original resources usable',()=>{
 const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture}),geometry=new THREE.BoxGeometry(.5,.46,.14);
 const sources=games.filter(game=>cartridgeRoom(game)==='basement').map(game=>{
  const root=new THREE.Group();root.userData={game_id:game.id,title:game.title};
  const shell=new THREE.Mesh(geometry,material);shell.position.y=.23;root.add(shell);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.38,.31),material);label.position.set(0,.25,.076);root.add(label);
  // Molded cartridges have many attached ribs, contacts, and screws.
  for(let i=0;i<45;i++){const detail=new THREE.Mesh(geometry,material);detail.scale.setScalar(.01);detail.position.y=.1;root.add(detail);}
  return root;
 });
 const copies=createBasementCartridges(sources),scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);model.add(...copies);
 const resources=createRoomResources();resources.capture(model);
 for(const root of copies){
  assert.notEqual(root.children[0].geometry,geometry);assert.notEqual(root.children[0].material,material);assert.notEqual(root.children[0].material.map,texture);
 }
 const {props,physics}=createHouseProps(model,scene);
 assert.equal(props.length,4);
 for(const prop of props){assert.equal(prop.mode,'throw');assert.equal(prop.root.children.length,47);assert.ok(physics.items.has(prop.id));}
 let disposed=false;for(const resource of [texture,material,geometry])resource.addEventListener('dispose',()=>{disposed=true;});
 resources.dispose();assert.equal(disposed,false);
});
