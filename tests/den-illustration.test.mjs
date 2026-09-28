import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {illustrateObject} from '../web/den-illustration.js';

test('Den ink follows moving geometry without adding picking targets or changing placement bounds',()=>{
 const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.12),new THREE.MeshStandardMaterial());
 root.add(body);root.position.set(1,2,3);root.rotation.y=.6;root.updateMatrixWorld(true);
 const before=new THREE.Box3().setFromObject(root);
 illustrateObject(root);illustrateObject(root);root.updateMatrixWorld(true);
 assert.equal(body.children.length,1);
 assert.deepEqual(new THREE.Box3().setFromObject(root),before);
 const ray=new THREE.Raycaster(new THREE.Vector3(1,2,5),new THREE.Vector3(0,0,-1));
 const hits=ray.intersectObject(root,true);
 assert.ok(hits.length>0);assert.ok(hits.every(hit=>hit.object===body));
 root.position.x=4;root.updateMatrixWorld(true);
 assert.equal(body.children[0].getWorldPosition(new THREE.Vector3()).x,4);
 assert.equal(body.children[0].castShadow,false);
});

test('Printed artwork remains mapped and thin labels do not acquire silhouette shells',()=>{
 const map=new THREE.Texture(),mat=new THREE.MeshStandardMaterial({map});
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.4,.3),mat);
 illustrateObject(label);
 assert.equal(label.children.length,0);assert.equal(mat.map,map);
 assert.equal(mat.transparent,false);assert.equal(mat.depthWrite,true);
});
