import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHousePropInput} from '../web/house-prop-input.js';
class Surface extends EventTarget {
 style={}; captured=false;
 getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
 setPointerCapture(){this.captured=true;}hasPointerCapture(){return this.captured;}releasePointerCapture(){this.captured=false;}
}
for(const gesture of ['tap','throw','cancel','lostpointercapture','blur','hidden','escape'])test(`${gesture}: paper discovery follows completed object interaction`,()=>{
 globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.hidden=false;
 const host=new Surface(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.z=4;camera.updateMatrixWorld();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());scene.add(mesh);
 const prop={id:'art',hotspot:'memory',mode:'throw',root:mesh,rest:mesh.quaternion.clone(),spring:{reset(){}}};mesh.userData.houseProp=prop;
 let releases=0,cancelled=0,kicks=0;const discoveries=[];
 const room={scene,props:{physics:{items:new Map([['art',{body:{type:4}}]]),grab(){},move(){},release(){releases++;}},kick(){kicks++;},cancel(){cancelled++;}}};
 const input=createHousePropInput(host,{getRoom:()=>room,getCamera:()=>camera,onActivate:id=>discoveries.push(id),wake(){},reduced:{matches:false}});input.setEnabled(true);
 function dispatch(type,x=50){const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:50});host.dispatchEvent(e);}
 dispatch('pointerdown');if(gesture!=='tap')dispatch('pointermove',80);
 if(gesture==='escape')input.cancel();
 else if(gesture==='blur')window.dispatchEvent(new Event('blur'));
 else if(gesture==='hidden'){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));}
 else dispatch(gesture==='cancel'?'pointercancel':gesture==='lostpointercapture'?gesture:'pointerup',80);
 // Capture loss after a normal release must not undo the completed throw.
 dispatch('lostpointercapture');
 assert.deepEqual(discoveries,['tap','throw'].includes(gesture)?['memory']:[]);
 assert.equal(releases,!['tap','escape'].includes(gesture)?1:0);assert.equal(cancelled,gesture==='escape'?1:0);assert.equal(kicks,gesture==='tap'?1:0);
 input.dispose();
});
