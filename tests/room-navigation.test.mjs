import test from 'node:test';
import assert from 'node:assert/strict';
import {fadeNavigation} from '../web/room-navigation.js';

test('navigation fades for one second, reverses from its visible opacity, and respects reduced motion',async()=>{
 const oldStyle=globalThis.getComputedStyle,oldMatch=globalThis.matchMedia;
 let reduced=false,rendered='1';const animations=[];
 globalThis.getComputedStyle=()=>({opacity:rendered});
 globalThis.matchMedia=()=>({matches:reduced});
 const node={style:{},animate(frames,options){
  let resolve,reject;
  const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){reject(new Error('cancelled'));},finish(){resolve();}};
  animations.push(animation);return animation;
 }};
 try{
  const leaving=fadeNavigation(node,false);
  assert.equal(node.style.opacity,'0');
  assert.equal(animations[0].options.duration,1000);
  assert.deepEqual(animations[0].frames,[{opacity:'1'},{opacity:'0'}]);
  assert.equal(fadeNavigation(node,false),leaving,'repeated visibility updates must not restart the fade');
  rendered='.4';const arriving=fadeNavigation(node,true);
  await leaving;
  assert.deepEqual(animations[1].frames,[{opacity:'.4'},{opacity:'1'}]);
  animations[1].finish();await arriving;
  reduced=true;const immediate=fadeNavigation(node,false);
  assert.equal(animations[2].options.duration,0);
  animations[2].finish();await immediate;
 }finally{globalThis.getComputedStyle=oldStyle;globalThis.matchMedia=oldMatch;}
});
