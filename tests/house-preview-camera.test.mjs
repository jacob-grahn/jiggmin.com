import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import * as T from 'three';import {createRoute} from '../web/house-layout.js';import {travelPose} from '../scene/preview/travel-camera.js';
const m=JSON.parse(execFileSync('python3',['scene/scripts/house_preview_spec.py'],{encoding:'utf8'}));
test('preview cameras stay upright throughout travel and retain both endpoint views',()=>{
 for(const [id,pts] of Object.entries(m.routes)){
  const route=createRoute(pts.map(p=>new T.Vector3(...p)));
  for(let i=0;i<=200;i++){const p=travelPose(route,i/200,m.views.hub,m.views[id],id);const right=new T.Vector3(1,0,0).applyQuaternion(p.quaternion);assert.ok(Math.abs(right.y)<1e-6,`${id} horizon tilted`);assert.ok(p.position.toArray().every(Number.isFinite));}
  for(const [t,v] of [[0,m.views.hub],[1,m.views[id]]]){const p=travelPose(route,t,m.views.hub,m.views[id],id);assert.ok(p.position.distanceTo(new T.Vector3(...v.position))<1e-6);const facing=new T.Vector3(0,0,-1).applyQuaternion(p.quaternion);assert.ok(facing.dot(new T.Vector3(...v.target).sub(p.position).normalize())>.999999);}
 }
});
