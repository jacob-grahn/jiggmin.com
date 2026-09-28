// Refit existing exports without disturbing their baked UVs or movable props.
// Target heights match build_house_rooms.py; rerunning this is idempotent.
import {readFileSync,writeFileSync} from 'node:fs';
for(const path of ['scene/exports/house/basement.glb','web/assets/house/basement-baked.glb']){
 const bytes=readFileSync(path),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 const tail=Buffer.from(bytes.subarray(20+length)),binary=tail.subarray(8);
 for(const node of doc.nodes){
  if(!/^(Basement ceiling joist|Copper water pipe|Lamp stem)(?:\.|$)/.test(node.name??''))continue;
  const accessors=[...new Set(doc.meshes[node.mesh].primitives.map(p=>p.attributes.POSITION))].map(i=>doc.accessors[i]);
  const positions=accessors.flatMap(a=>{
   if(a.componentType!==5126||a.type!=='VEC3')throw Error('Expected float positions');
   const view=doc.bufferViews[a.bufferView],stride=view.byteStride??12,offset=(view.byteOffset??0)+(a.byteOffset??0);
   return Array.from({length:a.count},(_,i)=>({a,offset:offset+i*stride,y:binary.readFloatLE(offset+i*stride+4)}));
  });
  const lo=Math.min(...positions.map(p=>p.y)),hi=Math.max(...positions.map(p=>p.y));
  for(const p of positions){
   let y=p.y;
   if(node.name.startsWith('Basement ceiling joist'))y+=3.78-(lo+hi)/2;
   else if(node.name==='Copper water pipe'&&y>3.1)y+=3.62-hi;
   else if(node.name==='Lamp stem')y=lo+(y-lo)*(3.84-lo)/(hi-lo);
   binary.writeFloatLE(y,p.offset+4);
  }
  for(const a of accessors){
   const ys=positions.filter(p=>p.a===a).map(p=>binary.readFloatLE(p.offset+4));
   a.min[1]=Math.min(...ys);a.max[1]=Math.max(...ys);
  }
 }
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);
 writeFileSync(path,Buffer.concat([header,padded,tail]));
}
