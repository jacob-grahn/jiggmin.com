import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {framing,projectPoint,UPPER_SLOTS,createUpperShelf,cartridgeVisible} from '../web/responsive-scene.js';
import {CartridgePhysics} from '../web/physics.js';
import {TouchKeys,joystickKeys,sendRuffleKey} from '../web/touch-input.js';

test('Responsive camera keeps the CRT and removable cartridge within phone, tablet and desktop crops',()=>{
 for(const [w,h] of [[320,568],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]])for(const playing of [false,true]){
  const aspect=w/h,f=framing(aspect,playing);
  for(const point of [[.341,.231],[.659,.562],[.477,.717]]){
   const [x,y]=projectPoint(point,aspect,f.zoom,f.focusY);
   assert.ok(x>.03&&x<.97&&y>.02&&y<.97,`${w}x${h}, play=${playing}: ${x},${y}`);
  }
  assert.equal(f.upper,aspect<1.38);
 }
});
test('CRT DOM coordinates match the shifted WebGL projection',()=>{
 const camera=new THREE.PerspectiveCamera(32,1.6,.1,100);camera.updateMatrixWorld();
 const point=new THREE.Vector3(.7,.9,-7),base=point.clone().project(camera),uv=[base.x/2+.5,.5-base.y/2];
 const f=framing(390/844,true);camera.aspect=390/844;camera.zoom=f.zoom;camera.updateProjectionMatrix();camera.projectionMatrix.elements[9]=2*(f.focusY-.5+.09*f.zoom);
 const actual=point.clone().project(camera),expected=projectPoint(uv,camera.aspect,f.zoom,f.focusY);
 assert.ok(Math.abs(actual.x/2+.5-expected[0])<1e-10);assert.ok(Math.abs(.5-actual.y/2-expected[1])<1e-10);
});
test('Upper rack fits the full collection and has solid shelves',()=>{
 assert.ok(UPPER_SLOTS.length>=23);
 const shelf=createUpperShelf(),physics=new CartridgePhysics(shelf.colliders),slot=UPPER_SLOTS[5];
 physics.add('cart',slot);physics.place('cart',{...slot,position:{...slot.position,y:slot.position.y+.3}});
 for(let i=0;i<600;i++)physics.step(1/120);
 assert.ok(Math.abs(physics.pose('cart').position.y-slot.position.y)<.02);
 assert.ok(UPPER_SLOTS[1].position.x-UPPER_SLOTS[0].position.x>.087);
});
test('Visibility distinguishes offscreen, obscured and partially visible cartridges',()=>{
 const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,0,5);camera.updateMatrixWorld();
 const cart=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.1));cart.updateMatrixWorld();
 assert.equal(cartridgeVisible(cart,camera,[]),true);
 cart.position.x=8;assert.equal(cartridgeVisible(cart,camera,[]),false);cart.position.x=0;
 const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2));wall.position.z=2;wall.updateMatrixWorld();
 assert.equal(cartridgeVisible(cart,camera,[wall]),false);
 wall.position.x=2.1;wall.updateMatrixWorld();assert.equal(cartridgeVisible(cart,camera,[wall]),true);
});
test('Joystick supports diagonals and shared A/B mapping cannot release Space early',()=>{
 assert.deepEqual(joystickKeys(.05,.1),[]);assert.deepEqual(joystickKeys(.7,-.7),['ArrowRight','ArrowUp']);
 const events=[],keys=new TouchKeys((...e)=>events.push(e));
 keys.set('a',['Space']);keys.set('b',['Space']);keys.set('a',[]);
 assert.deepEqual(events,[['keydown','Space']]);keys.set('joystick',['ArrowLeft']);keys.releaseAll();
 assert.deepEqual(events,[['keydown','Space'],['keydown','ArrowLeft'],['keyup','Space'],['keyup','ArrowLeft']]);
});
test('Ruffle adapter supplies legacy key codes and bubbling composed events',()=>{
 const Original=globalThis.KeyboardEvent;globalThis.KeyboardEvent=class{constructor(type,options){this.type=type;Object.assign(this,options);}};
 try{const events=[],player={focus(){this.focused=true;},dispatchEvent(e){events.push(e);}};
  sendRuffleKey(player,'keydown','Space');sendRuffleKey(player,'keyup','ArrowUp');
  assert.equal(player.focused,true);assert.equal(events[0].keyCode,32);assert.equal(events[1].which,38);assert.equal(events[0].bubbles,true);assert.equal(events[0].composed,true);
 }finally{globalThis.KeyboardEvent=Original;}
});
