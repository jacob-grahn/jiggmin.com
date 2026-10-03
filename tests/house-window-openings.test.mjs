import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {subtractWindowPrism,isWindowStructure} from '../scripts/house-source/house-window-openings.js';
import {windowExteriorFrame} from '../scripts/house-source/house-window-exterior.js';
import {cutWindowOpenings} from '../scripts/house-source/house-window-openings.js';
import {roomMatrix} from '../web/house-layout.js';

const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
function rayHits(mesh,x,y){
 mesh.updateMatrixWorld(true);
 return new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1),0,4).intersectObject(mesh,false);
}
test('A real hole removes both faces of a slab and preserves wall and UVs around it',()=>{
 const source=new THREE.BoxGeometry(4,3,.3),frame={center:new THREE.Vector3(),right:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),size:new THREE.Vector2(1.4,1)};
 const cut=subtractWindowPrism(source,new THREE.Matrix4(),frame),mesh=new THREE.Mesh(cut,material);
 assert.equal(rayHits(mesh,0,0).length,0);assert.equal(rayHits(mesh,.6,.4).length,0);
 assert.ok(rayHits(mesh,1,0).length>0);assert.ok(rayHits(mesh,0,.8).length>0);
 for(let i=0;i<cut.attributes.position.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(cut.attributes.position,i);
  const normal=new THREE.Vector3().fromBufferAttribute(cut.attributes.normal,i);
  if(normal.z>.99){assert.ok(Math.abs(cut.attributes.uv.getX(i)-(p.x/4+.5))<1e-6);assert.ok(Math.abs(cut.attributes.uv.getY(i)-(p.y/3+.5))<1e-6);}
 }
 assert.equal(source.attributes.position.count,24,'authored/shared source geometry is not mutated');
 assert.equal(subtractWindowPrism(cut,new THREE.Matrix4(),frame),null,'reapplying the same cut is harmless');
});

test('All eight baked window positions have unobstructed physical apertures after conversion',async()=>{
 const layout=JSON.parse(readFileSync('web/assets/house/layout.json'));
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const [room,count] of Object.entries({hallway:2,workshop:2,basement:3,attic:1})){
  const doc=await io.read(`web/assets/house/${room}-baked.glb`),root=new THREE.Group();
  for(const node of doc.getRoot().listNodes()){
   const source=node.getMesh();if(!source)continue;
   if(!isWindowStructure(node.getName())&&!/^(Rainy garden through hallway|Garden beyond window)/.test(node.getName()))continue;
   for(const primitive of source.listPrimitives()){
    const geometry=new THREE.BufferGeometry();
    for(const [from,to] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv'],['TEXCOORD_1','uv1']]){
     const a=primitive.getAttribute(from);if(a)geometry.setAttribute(to,new THREE.BufferAttribute(a.getArray().slice(),a.getElementSize()));
    }
    if(primitive.getIndices())geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray().slice(),1));
    const mesh=new THREE.Mesh(geometry,material);mesh.name=node.getName();mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));root.add(mesh);
   }
  }
  const transform=roomMatrix(layout.rooms[room]);root.applyMatrix4(transform);root.updateMatrixWorld(true);
  const camera=doc.getRoot().listNodes().find(n=>n.getCamera());
  const eye=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(camera.getWorldMatrix())).applyMatrix4(transform);
  if(layout.rooms[room].viewPosition)eye.fromArray(layout.rooms[room].viewPosition);
  const windows=root.children.filter(m=>/^(Rainy garden through hallway|Garden beyond window)/.test(m.name));const frames=windows.map(m=>{const f=windowExteriorFrame(m);if(f.normal.dot(eye.clone().sub(f.center))>0){f.normal.negate();f.right.negate();}f.size.addScalar(-.04);return f;});const result={count:windows.length,frames,cutMeshes:cutWindowOpenings(root,frames)};assert.equal(result.count,count,room);
  assert.ok(result.cutMeshes.length>0,`${room} wall geometry changed`);
  const walls=root.children.filter(m=>isWindowStructure(m.name));
  for(const frame of result.frames)for(const x of [-.3,0,.3])for(const y of [-.3,0,.3]){
   const origin=frame.center.clone().addScaledVector(frame.right,x*frame.size.x).add(new THREE.Vector3(0,y*frame.size.y,0)).addScaledVector(frame.normal,-.15);
   const ray=new THREE.Raycaster(origin,frame.normal,0,.9);
   const hits=ray.intersectObjects(walls,false);
   assert.equal(hits.length,0,`${room} aperture obstructed by ${hits[0]?.object.name}`);
  }
 }
});
