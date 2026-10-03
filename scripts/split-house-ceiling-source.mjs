// Source preparation only: make legacy spanning ceilings room-owned before baking.
import {Matrix4,Vector3} from 'three';
// Clip triangles in world space while interpolating every vertex attribute,
// including baked UVs. The adjoining pieces meet at the authored room boundary.
export function clipCeilingMesh(doc,mesh,matrix,room){
 const world=new Matrix4().fromArray(matrix),boundary=4.8;
 for(const primitive of [...mesh.listPrimitives()]){
  const semantics=primitive.listSemantics(),attributes=semantics.map(s=>primitive.getAttribute(s));
  const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices();
  const output=semantics.map(()=>[]),positionIndex=semantics.indexOf('POSITION');
  const distance=v=>{const x=new Vector3().fromArray(v[positionIndex]).applyMatrix4(world).x;return room==='den'?boundary-x:x-boundary;};
  const vertex=i=>attributes.map(a=>a.getElement(i,[]));
  const count=indices?.getCount()??positions.getCount();
  for(let i=0;i<count;i+=3){
   const triangle=[0,1,2].map(j=>vertex(indices?indices.getScalar(i+j):i+j)),polygon=[];
   for(let j=0;j<3;j++){
    const a=triangle[j],b=triangle[(j+1)%3],da=distance(a),db=distance(b);
    if(da>=0)polygon.push(a);
    if((da<0)!==(db<0)){const t=da/(da-db);polygon.push(a.map((values,k)=>values.map((v,c)=>v+(b[k][c]-v)*t)));}
   }
   for(let j=1;j<polygon.length-1;j++){
    const tri=[polygon[0],polygon[j],polygon[j+1]],points=tri.map(v=>new Vector3().fromArray(v[positionIndex]));
    if(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq()<1e-16)continue;
    for(const v of tri)v.forEach((values,k)=>output[k].push(...values));
   }
  }
  if(!output[0].length){mesh.removePrimitive(primitive);continue;}
  attributes.forEach((a,k)=>primitive.setAttribute(semantics[k],doc.createAccessor().setType(a.getType()).setArray(new Float32Array(output[k])).setBuffer(a.getBuffer())));
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from({length:output[0].length/attributes[0].getElementSize()},(_,i)=>i)).setBuffer(positions.getBuffer()));
 }
 return mesh;
}

export function splitSourceCeilings(doc){
 let count=0;
 for(const node of [...doc.getRoot().listNodes()]){
  if(!node.getMesh()||!node.getName().startsWith('Attic floor / hall ceiling'))continue;
  const matrix=new Matrix4().fromArray(node.getWorldMatrix()),points=[];
  for(const p of node.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)points.push(new Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));}
  const lo=Math.min(...points.map(p=>p.x)),hi=Math.max(...points.map(p=>p.x)),z=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2;
  if(z<=6.5||lo>=4.8-1e-6||hi<=4.8+1e-6)continue;
  for(const room of ['den','hallway']){
   const mesh=doc.createMesh(node.getMesh().getName());
   for(const p of node.getMesh().listPrimitives())mesh.addPrimitive(p.clone());
   clipCeilingMesh(doc,mesh,node.getWorldMatrix(),room);
   const part=doc.createNode(`${node.getName()} / ${room}`).setMatrix(node.getMatrix()).setMesh(mesh).setExtras({...node.getExtras(),source_shell_room:room,source_ceiling_object:node.getExtras().house_bake_source??node.getName()});
   const parent=node.getParentNode();if(parent)parent.addChild(part);else for(const scene of doc.getRoot().listScenes())if(scene.listChildren().includes(node))scene.addChild(part);
  }
  node.dispose();count++;
 }
 return count;
}
