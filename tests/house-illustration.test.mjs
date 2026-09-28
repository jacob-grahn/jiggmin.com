import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {illustrateHouse} from '../web/house-illustration.js';
import {createRoomResources} from '../web/house-resources.js';

test('Illustrated rooms preserve artwork, clipping, picking, and light isolation',()=>{
 const art=new THREE.Texture(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),2);
 const original=new THREE.MeshStandardMaterial({map:art,clippingPlanes:[plane]});original.name='Actual kindergarten artwork';
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,.08),original);mesh.layers.set(3);
 const root=new THREE.Group();root.add(mesh);root.updateMatrixWorld(true);
 illustrateHouse([root]);
 assert.notEqual(mesh.material,original);assert.equal(mesh.material.map,art);
 assert.deepEqual(mesh.material.clippingPlanes,original.clippingPlanes);
 assert.equal(original.userData.houseIllustrated,undefined);
 const outline=mesh.children[0];assert.equal(outline.layers.mask,mesh.layers.mask);
 assert.deepEqual(outline.material.clippingPlanes,mesh.material.clippingPlanes);
 const hits=[];outline.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);
 illustrateHouse([root]);assert.equal(mesh.children.length,1);
});

test('Each room owns and disposes its ink materials without affecting another room',()=>{
 const make=()=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));root.updateMatrixWorld(true);illustrateHouse([root]);return root;};
 const a=make(),b=make(),inkA=a.children[0].children[0].material,inkB=b.children[0].children[0].material;
 assert.notEqual(inkA,inkB);let disposedA=0,disposedB=0;
 inkA.addEventListener('dispose',()=>disposedA++);inkB.addEventListener('dispose',()=>disposedB++);
 const resources=createRoomResources();resources.capture(a);resources.dispose();
 assert.equal(disposedA,1);assert.equal(disposedB,0);
});
