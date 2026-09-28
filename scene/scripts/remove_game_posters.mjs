// Remove the old poster assemblies without altering the baked lighting or UVs.
// The authoring source omits them too; this updates existing exports in place.
import {readFileSync,writeFileSync} from 'node:fs';
const poster=/^(Red Earth garage poster|Cooties unframed stored print|Neverending Light leaning print)(?: |$)/;
for(const room of ['workshop','attic','basement'])for(const path of [`scene/exports/house/${room}.glb`,`web/assets/house/${room}-baked.glb`]){
 const bytes=readFileSync(path),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 if(doc.skins?.length||doc.animations?.length)throw Error(`Unexpected animated room: ${path}`);
 const removed=new Set();
 function remove(index){if(removed.has(index))return;removed.add(index);for(const child of doc.nodes[index].children??[])remove(child);}
 doc.nodes.forEach((node,index)=>{if(poster.test(node.name??''))remove(index);});
 if(!removed.size)continue;
 const remap=new Map();doc.nodes.forEach((node,index)=>{if(!removed.has(index))remap.set(index,remap.size);});
 const references=indices=>indices.filter(i=>!removed.has(i)).map(i=>remap.get(i));
 doc.nodes=doc.nodes.filter((node,index)=>!removed.has(index));
 for(const node of doc.nodes)if(node.children)node.children=references(node.children);
 for(const scene of doc.scenes)scene.nodes=references(scene.nodes??[]);
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const tail=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);
 writeFileSync(path,Buffer.concat([header,padded,tail]));
 console.log(`${path}: removed ${removed.size} poster nodes`);
}
