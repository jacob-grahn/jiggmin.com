// Source preparation only: make legacy spanning ceilings room-owned before baking.
import {Matrix4,Matrix3,Vector3} from 'three';
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

// Split existing faces before baking; never duplicate a visible surface.
export function splitSlabSurfaces(doc){
 let count=0;
 for(const node of [...doc.getRoot().listNodes()]){
  if(!node.getMesh())continue;
  const cellar=node.getName().startsWith('Main floor'),attic=node.getName().startsWith('Attic floor / hall ceiling');
  if(!cellar&&!attic)continue;
  const original=node.getMesh(),upper=doc.createMesh(original.getName()),lower=doc.createMesh(original.getName());
  const normalMatrix=new Matrix3().getNormalMatrix(new Matrix4().fromArray(node.getWorldMatrix()));
  let moved=0;
  for(const p of original.listPrimitives()){
   const indices=p.getIndices(),normal=p.getAttribute('NORMAL'),position=p.getAttribute('POSITION'),keep=[],separate=[];
   for(let i=0;i<(indices?.getCount()??position.getCount());i+=3){
    const tri=[0,1,2].map(k=>indices?indices.getScalar(i+k):i+k);
    const y=new Vector3(...normal.getElement(tri[0],[])).applyMatrix3(normalMatrix).normalize().y;
    ((cellar?-y:y)>.9?separate:keep).push(...tri);
   }
   const add=(mesh,array)=>{if(array.length)mesh.addPrimitive(p.clone().setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(array)).setBuffer(position.getBuffer())));};
   add(upper,keep);add(lower,separate);moved+=separate.length;
  }
  if(!moved){upper.dispose();lower.dispose();continue;}
  if(cellar){
   // The legacy den infill export lowered box vertices by 25 mm to sit
   // beneath the den's original boards. That clearance belongs upstairs;
   // the separate cellar underside follows the original flat model plane.
   const world=new Matrix4().fromArray(node.getWorldMatrix()),inverse=world.clone().invert();
   const heights=[];
   for(const p of lower.listPrimitives()){const a=p.getAttribute('POSITION'),ix=p.getIndices();for(let i=0;i<ix.getCount();i++)heights.push(new Vector3(...a.getElement(ix.getScalar(i),[])).applyMatrix4(world).y);}
   const high=Math.max(...heights),low=Math.min(...heights);
   if(high-low>.01){
    if(Math.abs(high-low-.025)>1e-5)throw Error('Unexpected cellar slab clearance: '+node.getName());
    for(const p of lower.listPrimitives()){
     const a=p.getAttribute('POSITION'),values=new Float32Array(a.getArray()),ix=p.getIndices();
     for(const id of new Set(ix.getArray())){const point=new Vector3(...a.getElement(id,[])).applyMatrix4(world);point.y=high;point.applyMatrix4(inverse).toArray(values,id*3);}
     p.setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(values).setBuffer(a.getBuffer()));
    }
   }
  }
  const e=node.getExtras(),prefix=cellar?'Cellar slab underside / ':'Attic slab upper / ',group=cellar?'basement-slab-ceilings':'attic-floor';
  const source=e.source_ceiling_object??e.source_object??node.getName();
  const part=doc.createNode(prefix+node.getName()).setMatrix(node.getMatrix()).setMesh(lower).setExtras({...e,
   house_bake_id:(e.house_bake_id??node.getName())+(cellar?':cellar-underside':':attic-upper'),
   source_object:prefix+source,house_bake_source:prefix+node.getName(),source_slab_object:prefix+source,
   source_shell_room:cellar?'basement':'attic',release_baked:group,atlas_group:group,preview_kind:cellar?'ceiling':'floor'});
  const parent=node.getParentNode();if(parent)parent.addChild(part);else for(const scene of doc.getRoot().listScenes())if(scene.listChildren().includes(node))scene.addChild(part);
  node.setMesh(upper);count++;
 }
 for(const node of doc.getRoot().listNodes())if(node.getName()==='Garage slab')node.setExtras({...node.getExtras(),source_shell_room:'workshop',release_baked:'structure-garage',atlas_group:'structure-garage'});
 for(const node of doc.getRoot().listNodes())if(/\b(stair|flight|landing|stringer)\b/i.test(node.getName())&&(node.getExtras().atlas_group??node.getExtras().release_baked)==='structure-hall')node.setExtras({...node.getExtras(),source_shell_room:'basement',release_baked:'structure-stairs',atlas_group:'structure-stairs'});
 return count;
}
