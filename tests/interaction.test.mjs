import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
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
