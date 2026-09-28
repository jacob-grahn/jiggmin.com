// Reuse browser prop grouping to keep every movable assembly out of the bake.
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../../web/vendor/three/GLTFLoader.js';
import {groupHouseProps} from '../../web/house-props.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
const bytes=readFileSync('web/assets/house/hallway.glb'),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
const stripped=structuredClone(doc);stripped.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
stripped.materials=[];for(const mesh of stripped.meshes)for(const p of mesh.primitives)delete p.material;
delete stripped.textures;delete stripped.images;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(stripped),'');
const nodeFor=new Map();gltf.scene.traverse(o=>{
 if(!o.isMesh)return;
 for(let p=o;p;p=p.parent){const a=gltf.parser.associations.get(p);if(a?.nodes!==undefined){nodeFor.set(o,a.nodes);break;}}
});
const world=new THREE.Scene();world.add(gltf.scene);
const {props,staticMeshes}=groupHouseProps(gltf.scene,world);
const fixed=new Set(staticMeshes.map(o=>nodeFor.get(o))),moving=new Set();
for(const p of props)p.root.traverse(o=>{if(o.isMesh)moving.add(nodeFor.get(o));});
for(const [i,node] of doc.nodes.entries()){
 const door=/Recessed.unmarked.door.leaf|Recessed.door.panel|Unmarked.door.brass.knob|Attic.hatch|Hatch.pull.handle/i.test(node.name??'');
 node.extras={...node.extras,bake_static:fixed.has(i)&&!moving.has(i)&&!door,bake_source_node:i};
}
const json=Buffer.from(JSON.stringify(doc));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=bytes.subarray(28+length);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
writeFileSync('/tmp/hallway-bake-input.glb',Buffer.concat([header,padded,binHeader,binary]));
console.log(`${doc.nodes.filter(n=>n.extras.bake_static).length} static nodes; ${props.length} movable assemblies remain live.`);
