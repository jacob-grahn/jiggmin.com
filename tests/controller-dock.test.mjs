import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createControllerDock} from '../web/controller-dock.js';

test('Controller lift parks physics, reveals controls at arrival, and restores the pad on eject',()=>{
 const controller=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,390/844,.1,100);
 camera.position.set(0,2,8);camera.updateMatrixWorld();
 const rest={position:{x:-1,y:.7,z:2},quaternion:{x:0,y:0,z:0,w:1}};
 let enabled=true,pinned=false,restored=false,visible=false,opacity=0;
 const physics={pose:()=>rest,pin:()=>{pinned=true;},place:(_,pose)=>{assert.equal(pose,rest);restored=true;},items:new Map([['controller',{cord:{disable(){enabled=false;},enable(){enabled=true;}}}]])};
 const panel={classList:{add(){}},style:{setProperty(_,v){opacity=v;}},getBoundingClientRect:()=>({left:14,top:648,width:362,height:178})};
 const cord={mesh:new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial())};
 const dock=createControllerDock({controller,camera,physics,cord,panel,room:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})},controls:{setVisible(v){visible=v;}},reducedMotion:{matches:false}});
 dock.setRaised(true);dock.update(.6);
 assert.ok(pinned&&!enabled&&dock.active);assert.equal(visible,false);assert.equal(opacity,0);assert.ok(controller.visible);
 dock.update(.6);assert.ok(visible&&opacity>0&&opacity<1);
 dock.update(.2);assert.equal(visible,true);assert.equal(controller.visible,false);assert.equal(dock.update(.1),false);
 dock.setRaised(false);dock.update(.5);assert.ok(controller.visible);assert.equal(visible,false);
 // Changing games midway through the return must retain the original rest pose.
 dock.setRaised(true);dock.update(.2);assert.ok(dock.active&&!restored);
 dock.setRaised(false);dock.update(2);
 assert.ok(restored&&enabled&&!dock.active&&controller.visible);assert.deepEqual(controller.scale.toArray(),[1,1,1]);
 assert.ok(controller.position.distanceTo(new THREE.Vector3(-1,.7,2))<1e-8);
});
