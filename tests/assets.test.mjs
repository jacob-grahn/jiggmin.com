import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
test('All statically imported browser modules exist, including vendor dependencies',()=>{
 const seen=new Set();
 function visit(path){if(seen.has(path))return;seen.add(path);assert.ok(existsSync(path),path);
 const source=readFileSync(path,'utf8');
 for(const match of source.matchAll(/(?:import|export)\s+(?:[^;'"()]+?\s+from\s+)?['"]([^'"]+)['"]/g)){
  const spec=match[1].split('?')[0];
  if(spec==='three')visit(resolve('web/vendor/three/three.module.js'));
  else if(spec.startsWith('.'))visit(resolve(dirname(path),spec));
 }
 }visit(resolve('web/app.js'));assert.ok(seen.size>=10);
});
test('The room asset contains real depth geometry and a separate CRT aperture',()=>{
 const b=readFileSync('web/assets/room.glb'),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const room=g.nodes.find(n=>n.extras?.role==='room_geometry');assert.ok(room);
 assert.ok(g.nodes.some(n=>n.extras?.role==='crt_depth_surface'));
 const a=g.accessors[g.meshes[room.mesh].primitives[0].attributes.POSITION];
 assert.ok(a.max[2]-a.min[2]>3);assert.ok(a.max[1]-a.min[1]>3);
});
test('The movable controller has its own model and no duplicate static collision shell',()=>{
 const b=readFileSync('web/assets/controller.glb'),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.equal(g.nodes.filter(n=>n.extras?.role==='mobile_controller').length,1);
 for(const name of ['Pad • lower graphite shell','Pad • upper warm grey face','JOYSTICK • pivot'])
   assert.ok(g.nodes.some(n=>n.name===name),name);
 const colliders=JSON.parse(readFileSync('web/assets/colliders.json'));
 assert.ok(!colliders.some(c=>c.name.startsWith('Pad •')));
});
test('The detailed room keeps reactive props separate and all assets within the host limit',()=>{
 const b=readFileSync('web/assets/room.glb'),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const room=g.nodes.find(n=>n.extras?.role==='room_geometry');
 assert.ok(room.extras.bakeScale[0]<.5,'The light bake must cover ultrawide framing');
 assert.deepEqual(g.nodes.filter(n=>n.extras?.role==='reactive_prop').map(n=>n.extras.prop).sort(),['lamp','mug','plant']);
 for(const name of ['room.glb','room-lighting.webp','room-props.webp'])assert.ok(readFileSync(`web/assets/${name}`).length<25*1024*1024,name);
});
