import assert from 'node:assert/strict';
import {MeshoptSimplifier} from 'meshoptimizer';
import {simplifyPrimitive,weldPrimitive} from '@gltf-transform/functions';

export const triangleCount=primitive=>primitive.getMode()===4?(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION').getCount())/3:0;

// Work on the in-memory delivery copy only. Welding compares every attribute,
// retaining UV/normal discontinuities; locked borders keep adjacent shells joined.
export async function simplifyGeometry(document,settings){
 assert.ok(Number.isFinite(settings.error)&&settings.error>=0,'Invalid geometry error threshold');
 await MeshoptSimplifier.ready;
 const meshes=[];
 for(const mesh of document.getRoot().listMeshes()){
  const primitives=[];
  for(const primitive of mesh.listPrimitives()){
   const beforeTriangles=triangleCount(primitive);
   if(beforeTriangles>1&&settings.error>0){
    weldPrimitive(primitive);
    simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,error:settings.error,lockBorder:settings.lockBorder,ratio:1/beforeTriangles});
   }
   const afterTriangles=triangleCount(primitive);
   assert.ok(afterTriangles<=beforeTriangles,'Simplification increased triangle count');
   assert.ok(!beforeTriangles||afterTriangles>0,'Simplification removed a mesh primitive');
   primitives.push({beforeTriangles,afterTriangles});
  }
  meshes.push({name:mesh.getName(),beforeTriangles:primitives.reduce((s,p)=>s+p.beforeTriangles,0),afterTriangles:primitives.reduce((s,p)=>s+p.afterTriangles,0),primitives});
 }
 const nodes=document.getRoot().listNodes().filter(n=>n.getMesh()).map(node=>{
  const mesh=meshes[document.getRoot().listMeshes().indexOf(node.getMesh())];
  return {name:node.getName(),mesh:mesh.name,beforeTriangles:mesh.beforeTriangles,afterTriangles:mesh.afterTriangles};
 });
 return {meshes,nodes,beforeTriangles:meshes.reduce((s,m)=>s+m.beforeTriangles,0),afterTriangles:meshes.reduce((s,m)=>s+m.afterTriangles,0)};
}
