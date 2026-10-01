import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishHallSurfaces} from '../web/house-hall-finishes.js';
import {createNaturalTree,replaceExteriorTrees} from '../web/house-exterior-trees.js';

test('ceiling lightmaps and painted hatch wood remain visible while hall mouldings stay hidden',()=>{
 const root=new THREE.Group(),map=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map});
 const ceiling=new THREE.Mesh(new THREE.BoxGeometry(),material);
 ceiling.userData={release_baked:'structure-den',house_bake_source:'Attic floor / hall ceiling.001'};
 const crown=new THREE.Mesh(new THREE.BoxGeometry(),material);
 crown.userData={release_baked:'structure-hall',house_bake_source:'Finish / ceiling moulding.013'};
 const skirting=new THREE.Mesh(new THREE.BoxGeometry(),material);
 skirting.userData={release_baked:'structure-hall',house_bake_source:'Finish / skirting.013'};
 const grain=new THREE.Texture(),hatchMaterial=new THREE.MeshStandardMaterial({map:grain,roughness:.9});
 const hatch=new THREE.Mesh(new THREE.BoxGeometry(),hatchMaterial);hatch.userData.house_bake_source='Attic hatch';
 root.add(ceiling,crown,skirting,hatch);finishHallSurfaces(root);
 assert.equal(crown.visible,false);assert.equal(skirting.visible,true);assert.equal(skirting.material,material);
 assert.equal(ceiling.material.map,map);
 assert.equal(ceiling.material,material,'keep the authored baked lighting');
 assert.equal(hatch.material,hatchMaterial);assert.equal(hatch.material.map,grain);
 assert.ok(hatch.material.isMeshStandardMaterial,'the hatch must still respond to the room lighting');
});

test('natural trees vary by seed and replace the old grove at its world positions',()=>{
 const first=createNaturalTree(23),repeat=createNaturalTree(23),other=createNaturalTree(24);
 assert.deepEqual(first.geometry.attributes.position.array,repeat.geometry.attributes.position.array);
 assert.notDeepEqual(first.geometry.attributes.position.array,other.geometry.attributes.position.array);
 const root=new THREE.Group();root.position.set(3,0,7);
 const trunk=new THREE.Mesh(new THREE.BoxGeometry());trunk.position.set(16,2,3);
 trunk.userData={house_tree_silhouette:true,house_bake_source:'Finish / window-view tree trunk.003'};
 root.add(trunk);const grove=replaceExteriorTrees(root);root.updateMatrixWorld(true);
 assert.equal(trunk.visible,false);assert.equal(grove.children.length,1);
 assert.deepEqual(grove.children[0].getWorldPosition(new THREE.Vector3()).toArray(),[19,0,10]);
 for(const tree of [first,repeat,other,...grove.children]){tree.geometry.dispose();tree.material.dispose();}
});
