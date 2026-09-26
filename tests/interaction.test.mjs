import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {framing,captureSceneAnchors,composeCamera,projectWorld} from '../web/responsive-scene.js';
import {inSlot,playbackFile} from '../web/interaction.js';
const manifest=JSON.parse(readFileSync(new URL('../data/games.json',import.meta.url)));
const bytes=readFileSync(new URL('../web/assets/cartridges.glb',import.meta.url));
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const meta=JSON.parse(readFileSync(new URL('../web/assets/scene.json',import.meta.url)));
test('All 23 movable cartridge IDs resolve to a locally downloaded game',()=>{
 const roots=gltf.nodes.filter(n=>n.extras?.role==='draggable_cartridge');
 assert.equal(roots.length,23);assert.equal(new Set(roots.map(n=>n.extras.game_id)).size,23);
 assert.equal(roots.filter(n=>n.extras.storage==='table').length,5);
 assert.equal(roots.filter(n=>n.extras.storage==='rack').length,18);
 for(const n of roots){const game=manifest.games.find(g=>g.id===n.extras.game_id);assert.ok(game);assert.ok(existsSync(new URL('../'+playbackFile(game),import.meta.url)));}
});
test('Exported camera projects the real slot onto the mouse drop target',()=>{
 const node=gltf.nodes.find(n=>'camera' in n),data=gltf.cameras[node.camera].perspective;
 const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(data.yfov),data.aspectRatio,data.znear,data.zfar);
 camera.position.fromArray(node.translation);camera.quaternion.fromArray(node.rotation);camera.updateMatrixWorld();
 const slot=new THREE.Vector3(-.13,1.04,1.17).project(camera);
 assert.ok(Math.abs((slot.x+1)/2-meta.slot[0])<.0001);
 assert.ok(Math.abs((1-slot.y)/2-meta.slot[1])<.0001);
 assert.ok(inSlot(...meta.slot,meta.slot));assert.equal(inSlot(.1,.1,meta.slot),false);
});
test('Only validated standalone main payloads bypass a loader',()=>{
 const pr3=manifest.games.find(g=>g.id==='platform-racing-3');
 const pr2=manifest.games.find(g=>g.id==='platform-racing-2');
 assert.equal(playbackFile(pr3),pr3.mainPayload.file);
 assert.equal(playbackFile(pr2),pr2.file);
});

test('Lower browsing camera preserves TV focus and projects the real slot throughout the transition',()=>{
 const node=gltf.nodes.find(n=>'camera' in n),data=gltf.cameras[node.camera].perspective;
 const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(data.yfov),1.6,data.znear,data.zfar);
 camera.position.fromArray(node.translation);camera.quaternion.fromArray(node.rotation);camera.updateMatrixWorld();
 const anchors=captureSceneAnchors(camera,meta.screen,meta.slot),height=camera.position.y;
 for(const aspect of [390/844,1.6,844/390])for(const progress of [0,.25,.5,.75,1]){
  const browse=framing(aspect,false),play=framing(aspect,true);
  const zoom=THREE.MathUtils.lerp(browse.zoom,play.zoom,progress),focusY=THREE.MathUtils.lerp(browse.focusY,play.focusY,progress);
  composeCamera(camera,{aspect,zoom,focusY,height:height-.35*(1-progress)},anchors.focus);
  assert.equal(camera.position.y,height-.35*(1-progress));
  assert.ok(Math.abs(projectWorld(anchors.focus,camera)[1]-focusY)<1e-10);
  const actualSlot=projectWorld(new THREE.Vector3(-.13,1.04,1.17),camera),trackedSlot=projectWorld(anchors.slot,camera);
  assert.ok(Math.hypot(actualSlot[0]-trackedSlot[0],actualSlot[1]-trackedSlot[1])<.0001);
  for(const [x,y] of [...anchors.screen,anchors.slot].map(p=>projectWorld(p,camera)))assert.ok(x>0&&x<1&&y>0&&y<1);
 }
});
