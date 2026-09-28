import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWindowParallax} from '../web/house-window-parallax.js';

test('Window backdrop responds to camera translation, retains glass, and stays inside its image',()=>{
 const root=new THREE.Group(),map=new THREE.Texture();
 const window=new THREE.Mesh(new THREE.PlaneGeometry(2,1.5),new THREE.MeshStandardMaterial({map}));
 window.name='Rainy_garden_through_hallway';root.add(window);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(2,1.5),new THREE.MeshBasicMaterial());glass.name='Rain drop on glass';root.add(glass);
 const originalGlass=glass.material;
 root.position.set(3,2,-4);root.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera();camera.position.set(5,2,-4);camera.updateMatrixWorld(true);
 const view=createWindowParallax(root,camera);assert.equal(view.count,1);assert.equal(glass.material,originalGlass);assert.equal(window.material.map,map);
 const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};window.material.onBeforeCompile(shader);
 view.update(camera);assert.ok(shader.uniforms.windowShift.value.length()<1e-8);
 camera.position.z-=2;camera.updateMatrixWorld(true);view.update(camera);
 const first=shader.uniforms.windowShift.value.clone();assert.ok(first.x<0);assert.ok(Math.abs(first.y)<1e-8);
 camera.position.set(3,100,-1000);camera.updateMatrixWorld(true);view.update(camera);
 for(const offset of shader.uniforms.windowShift.value.toArray()){assert.ok(Number.isFinite(offset));assert.ok(Math.abs(offset)<.17);}
 camera.position.set(5,2,-4);camera.updateMatrixWorld(true);view.update(camera);assert.ok(shader.uniforms.windowShift.value.length()<1e-8);
});
