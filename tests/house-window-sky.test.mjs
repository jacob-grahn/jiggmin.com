import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMoonlitWindows,createMoonlitSky} from '../web/house-window-sky.js';

test('Exterior frames preserve physical dimensions and upright branches in transformed rooms',async()=>{
 const {windowExteriorFrame}=await import('../web/house-window-exterior.js');
 const root=new THREE.Group();root.position.set(6,-4,1.8);root.rotation.y=-Math.PI/2;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.65));mesh.position.set(-2.2,2.95,3.29);root.add(mesh);
 const frame=windowExteriorFrame(mesh);
 assert.ok(frame.center.distanceTo(mesh.getWorldPosition(new THREE.Vector3()))<1e-6);
 assert.ok(Math.abs(frame.size.x-1.8)<1e-6);assert.ok(Math.abs(frame.size.y-.65)<1e-6);
 assert.ok(Math.abs(frame.right.y)<1e-6);assert.ok(Math.abs(frame.right.dot(frame.normal))<1e-6);
 assert.ok(Math.abs(frame.normal.length()-1)<1e-6);
});

test('Window glass is transparent, retains clipping, and has no exterior image shader',()=>{
 const root=new THREE.Group(),plane=new THREE.Plane(),source=new THREE.MeshBasicMaterial({clippingPlanes:[plane]});
 const window=new THREE.Mesh(new THREE.PlaneGeometry(2,1.5),source);window.name='Garden beyond window';root.add(window);
 const other=new THREE.Mesh(new THREE.BoxGeometry(),source);other.name='Window jamb';root.add(other);
 const result=createMoonlitWindows(root,new THREE.Texture(),new THREE.Vector3(0,0,2));
 assert.equal(result.count,1);assert.equal(window.material.transparent,true);assert.equal(window.material.depthWrite,false);
 assert.ok(window.material.opacity<.1);assert.equal(window.material.map,null);assert.equal(window.material.clippingPlanes[0],plane);
 assert.equal(other.material,source);assert.equal(result.frames[0].normal.z,-1);
 result.exterior.updateMatrixWorld(true);
 const trees=[];result.exterior.traverse(o=>{if(/bare branches|pine silhouette/.test(o.name))trees.push(o);});
 assert.equal(trees.length,2);
 for(const tree of trees){assert.ok(tree.geometry.attributes.position.count>30);assert.equal(tree.material.transparent,false);}
});

test('Sky is a separate enclosing environment with no depth writes',()=>{
 const sky=createMoonlitSky(new THREE.Texture());
 assert.equal(sky.geometry.type,'SphereGeometry');assert.equal(sky.material.side,THREE.BackSide);
 assert.equal(sky.material.depthWrite,false);assert.equal(sky.material.depthTest,false);
 assert.equal(sky.frustumCulled,false);
});
