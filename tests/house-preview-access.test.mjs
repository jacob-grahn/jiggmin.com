import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {hingeMatrix,doorMotion,ladderMotion} from '../scene/preview/access-animation.js';
test('hinge transforms retain pivot and fully opened ladder retains its authored shape',()=>{
 const p=new T.Vector3(9.95,2.61,7.55);assert.ok(p.clone().applyMatrix4(doorMotion('attic',1)).distanceTo(p)<1e-7);
 for(let i=0;i<3;i++)assert.ok(new T.Vector3(8,1,7.55).applyMatrix4(ladderMotion(i,1)).distanceTo(new T.Vector3(8,1,7.55))<1e-7);
});
test('folded ladder joints stay connected during deployment and reverse travel',()=>{
 const a=new T.Vector3(7.92,0,7.55),b=new T.Vector3(9.82,2.8,7.55);
 for(let i=0;i<=100;i++){const t=i/100;for(const [lower,upper,fraction]of [[0,1,1/3],[1,2,2/3]]){const joint=a.clone().lerp(b,fraction);assert.ok(joint.clone().applyMatrix4(ladderMotion(lower,t)).distanceTo(joint.clone().applyMatrix4(ladderMotion(upper,t)))<1e-6);}}
});
