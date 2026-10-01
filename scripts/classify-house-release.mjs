// Use exactly the runtime prop grouping before selecting static bake surfaces.
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from '../web/vendor/three/GLTFLoader.js';
import {groupHouseProps} from '../web/house-props.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,{type},values);}};
const result={};
for(const room of ['structure','den','hallway','workshop','basement','attic']){
 const bytes=readFileSync(`scene/exports/house-release/${room}.glb`),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
 doc.materials=[];for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;delete doc.textures;delete doc.images;delete doc.extensionsUsed;delete doc.extensionsRequired;
 const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const world=new THREE.Scene();world.add(scene);
 const nodes=new Map();scene.traverse(o=>{let p=o;while(p&&!p.userData.release_room)p=p.parent;if(p){Object.assign(o.userData,p.userData);nodes.set(o,p.name);}});
 const {props,staticMeshes}=room==='structure'||room==='den'?{props:[],staticMeshes:[]}:groupHouseProps(scene,world);
 const dynamic=new Set();for(const p of props)p.root.traverse(o=>{if(o.isMesh)dynamic.add(nodes.get(o));});
 result[room]={movable:[...dynamic],props:props.length,hotspots:[...new Set(props.map(p=>p.hotspot).filter(Boolean))],discoveries:props.filter(p=>p.hotspot).map(p=>({id:p.hotspot,title:p.title,position:p.home.toArray()}))};
 console.log(room,result[room].props,result[room].hotspots);
}
writeFileSync('scene/exports/house-release/classification.json',JSON.stringify(result,null,2)+'\n');
