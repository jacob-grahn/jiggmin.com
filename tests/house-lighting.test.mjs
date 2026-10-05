import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {assignRoomLighting,renderIsolatedRooms} from '../web/house-lighting.js';

test('room lights cannot illuminate adjacent rooms; removing a room preserves remaining lighting',()=>{
 const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const ambient=new THREE.HemisphereLight();ambient.name='constant fill';ambient.layers.enableAll();world.add(ambient);
 const connector=new THREE.PointLight();connector.name='stairs';world.add(connector);
 function room(id){
  const group=new THREE.Group(),light=new THREE.PointLight();light.name=id;
  group.add(light,new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  const detachedProp=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  assignRoomLighting([group,detachedProp],id);world.add(group,detachedProp);return [group,detachedProp];
 }
 room('hallway');const basement=room('basement');
 let clears=0;const passes=[];
 const renderer={autoClear:true,clear(){clears++;},render(scene,view){
  assert.equal(this.autoClear,false,'later passes must retain the depth buffer');
  const lights=[];scene.traverse(o=>{if(o.isLight&&o.layers.test(view.layers))lights.push(o.name);});
  passes.push(lights);
 }};
 renderIsolatedRooms(renderer,world,camera,['hallway','basement']);
 assert.deepEqual(passes,[['constant fill','stairs'],['constant fill','hallway'],['constant fill','basement'],['constant fill']]);
 assert.equal(clears,1);assert.equal(renderer.autoClear,true);assert.equal(camera.layers.mask,1);
 basement.forEach(root=>root.removeFromParent());passes.length=0;
 renderIsolatedRooms(renderer,world,camera,['hallway']);
 assert.deepEqual(passes,[['constant fill','stairs'],['constant fill','hallway'],['constant fill']]);
});

test('cup shadow map updates only in the receiving room pass',()=>{
 const camera=new THREE.PerspectiveCamera(),passes=[];
 const renderer={autoClear:true,shadowMap:{enabled:true,autoUpdate:false,needsUpdate:false},clear(){},render(scene,view){passes.push({layer:Math.log2(view.layers.mask),update:this.shadowMap.needsUpdate});}};
 renderIsolatedRooms(renderer,new THREE.Scene(),camera,['hallway'],.85,1);
 assert.deepEqual(passes,[{layer:0,update:false},{layer:1,update:true},{layer:6,update:false}]);
 assert.equal(camera.layers.mask,1);assert.equal(renderer.shadowMap.needsUpdate,false);
});
