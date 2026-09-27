import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRoomResources} from '../web/house-resources.js';

test('unloading disposes shared room resources once, including detached doors and cloned prop materials',()=>{
 const room=new THREE.Group(),world=new THREE.Group(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture();
 const material=new THREE.MeshStandardMaterial({map:texture});
 const wall=new THREE.Mesh(geometry,material),door=new THREE.Mesh(geometry,material);room.add(wall,door);world.add(room);
 const resources=createRoomResources();resources.capture(room);
 world.attach(door);wall.removeFromParent();
 const propMaterial=material.clone();door.material=propMaterial;resources.capture(door);
 const counts=new Map();for(const value of [geometry,material,texture,propMaterial])value.addEventListener('dispose',()=>counts.set(value,(counts.get(value)??0)+1));
 const other=new THREE.MeshStandardMaterial();let otherDisposed=false;other.addEventListener('dispose',()=>otherDisposed=true);
 resources.dispose();resources.dispose();
 for(const value of [geometry,material,texture,propMaterial])assert.equal(counts.get(value),1);
 assert.equal(otherDisposed,false);
});

test('unloading includes textures in shader uniforms',()=>{
 const texture=new THREE.Texture(),material=new THREE.ShaderMaterial({uniforms:{surface:{value:texture}}});
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);
 const resources=createRoomResources();resources.capture(new THREE.Mesh(new THREE.PlaneGeometry(),material));resources.dispose();
 assert.equal(disposed,1);
});
