import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {configureWindowGlass,createMoonlitSky} from '../web/house-window-sky.js';

test('Exterior frames preserve physical dimensions and upright branches in transformed rooms',async()=>{
 const {windowExteriorFrame}=await import('../scripts/house-source/house-window-exterior.js');
 const root=new THREE.Group();root.position.set(6,-4,1.8);root.rotation.y=-Math.PI/2;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.65));mesh.position.set(-2.2,2.95,3.29);root.add(mesh);
 const frame=windowExteriorFrame(mesh);
 assert.ok(frame.center.distanceTo(mesh.getWorldPosition(new THREE.Vector3()))<1e-6);
 assert.ok(Math.abs(frame.size.x-1.8)<1e-6);assert.ok(Math.abs(frame.size.y-.65)<1e-6);
 assert.ok(Math.abs(frame.right.y)<1e-6);assert.ok(Math.abs(frame.right.dot(frame.normal))<1e-6);
 assert.ok(Math.abs(frame.normal.length()-1)<1e-6);
});

test('window setup configures glass without generating geometry',()=>{
 const root=new THREE.Group(),window=new THREE.Mesh(new THREE.PlaneGeometry(2,1.5));window.name='Garden beyond window';root.add(window);
 const geometry=window.geometry,glass=configureWindowGlass(root);
 assert.equal(glass.length,1);assert.equal(root.children.length,1);assert.equal(window.geometry,geometry);
 assert.equal(window.material.transparent,true);assert.equal(window.material.depthWrite,false);assert.ok(window.material.opacity<.1);
});

test('Sky is a separate enclosing environment with no depth writes',()=>{
 const sky=createMoonlitSky(new THREE.Texture());
 assert.equal(sky.geometry.type,'SphereGeometry');assert.equal(sky.material.side,THREE.BackSide);
 assert.equal(sky.material.depthWrite,false);assert.equal(sky.material.depthTest,false);
 assert.equal(sky.frustumCulled,false);
});
