import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import {createContinuousDen,DEN_PLACEMENT,DEN_SOURCE_TO_WORLD,DEN_UNITS_TO_METRES,integrateDenOpening} from '../web/house-den-continuity.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('restored room textures come from the original artwork and lighting atlases',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const room of ['hallway','workshop','basement','attic']){
  const original=await io.read(`web/assets/house/${room}-baked.glb`),restored=await io.read(`web/assets/house/release/${room}.glb`);
  const originals=new Set(original.getRoot().listTextures().map(t=>hash(t.getImage())));
  const paintedLighting=new Set();
  for(const node of restored.getRoot().listNodes().filter(n=>n.getExtras().house_window_bake)){
   assert.equal(room,'basement');assert.ok(node.getExtras().ceiling_paint==='light cream'||node.getExtras().house_window_receiver||node.getExtras().house_fixed_receiver);
   for(const p of node.getMesh().listPrimitives())paintedLighting.add(hash(p.getMaterial().getEmissiveTexture().getImage()));
  }
  for(const texture of restored.getRoot().listTextures())assert.ok(originals.has(hash(texture.getImage()))||paintedLighting.has(hash(texture.getImage())),`${room}: newly substituted artwork texture`);
  for(const node of restored.getRoot().listNodes().filter(n=>n.getMesh()))assert.ok(node.getExtras().style_source);
 }
});
test('live den travel uses a rigid camera and preserves the original seated projection',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1.6,.1,100);
 camera.position.set(.157,3,7.9);camera.lookAt(0,1.7,.1);camera.updateMatrixWorld();
 camera.projectionMatrix.elements[9]=.07;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 const material=new THREE.MeshStandardMaterial({color:0x345e81}),compile=()=>{};material.onBeforeCompile=compile;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);scene.add(mesh);
 const den=createContinuousDen({scene,camera}),endpoint=den.endpointCamera();
 den.scene.updateMatrixWorld(true);endpoint.updateMatrixWorld(true);
 assert.deepEqual(endpoint.scale.toArray(),[1,1,1]);
 assert.deepEqual(den.scene.scale.toArray(),[1,1,1]);
 for(const point of [[-2,1,0],[0,2,.4],[2,.8,1],[.12,4,-1.8]]){
  const original=new THREE.Vector3(...point).project(camera),placed=new THREE.Vector3(...point).applyMatrix4(DEN_SOURCE_TO_WORLD).project(endpoint);
  assert.ok(Math.abs(original.x-placed.x)<1e-10);assert.ok(Math.abs(original.y-placed.y)<1e-10);
 }
 assert.equal(den.scene.children[0].geometry.parameters.width,1);
 den.scene.children[0].geometry.computeBoundingBox();assert.ok(Math.abs(den.scene.children[0].geometry.boundingBox.max.x-DEN_UNITS_TO_METRES/2)<1e-7);
 assert.deepEqual(endpoint.projectionMatrix.elements,camera.projectionMatrix.elements);
 assert.notEqual(den.scene.children[0].material,material);assert.equal(den.scene.children[0].material.onBeforeCompile,compile);
 assert.notEqual(den.scene.children[0].geometry,mesh.geometry);
 let disposed=false;mesh.geometry.addEventListener('dispose',()=>disposed=true);den.resources.dispose();assert.equal(disposed,false);
});
test('release uses the live den and the original connection palette without bright preview lamps',()=>{
 const layout=JSON.parse(readFileSync('web/assets/house/release/layout.json'));
 assert.equal(layout.style,'original');assert.equal(layout.assets.den,null);assert.deepEqual(layout.lights,[]);
 const source=readFileSync('web/house-release-renderer.js','utf8');assert.ok(!source.includes('handoffMaterial'));assert.ok(!source.includes('captureDen'));assert.ok(!source.includes('doorwayFade'));assert.ok(!source.includes('continuousDen.render('));
});

test('den backing motion keeps a rigid camera basis and projected bake fixed through the doorway',()=>{
 const sourceCamera=new THREE.PerspectiveCamera(48,1.6,.1,100);
 sourceCamera.position.set(.157,3,7.9);sourceCamera.lookAt(0,1.7,.1);sourceCamera.updateMatrixWorld();
 const scene=new THREE.Scene(),projection=new THREE.Matrix4().multiplyMatrices(sourceCamera.projectionMatrix,sourceCamera.matrixWorldInverse);
 const material=new THREE.ShaderMaterial({uniforms:{lighting:{value:new THREE.Texture()},bakeProjection:{value:projection.clone()}},vertexShader:'uniform mat4 bakeProjection;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main(){gl_FragColor=vec4(1.0);}'});
 scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
 const den=createContinuousDen({scene,camera:sourceCamera}),endpoint=den.endpointCamera();
 for(const distance of [0,.2,.7,1.4]){
  const pose={position:endpoint.position.clone().add(new THREE.Vector3(distance,0,0)),quaternion:new THREE.Quaternion()};
  const matrix=den.travelMatrix(pose,1);
  for(const i of [0,1,2,4,5,6,8,9,10])assert.ok(Math.abs(matrix.elements[i]-endpoint.matrix.elements[i])<1e-6);
  assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(pose.position)<1e-10);
 }
 assert.deepEqual(material.uniforms.bakeProjection.value.elements,projection.elements,'source bake was mutated');
 const bake=den.scene.children[0].material.uniforms.bakeProjection.value.clone().multiply(DEN_SOURCE_TO_WORLD);
 for(let i=0;i<16;i++)assert.ok(Math.abs(bake.elements[i]-projection.elements[i])<1e-10);
 den.resources.dispose();
});

test('den integration removes duplicate interior walls while retaining the shared doorway',()=>{
 const root=new THREE.Group(),inner=new THREE.Mesh(new THREE.BoxGeometry(.14,2.6,5.2)),shared=new THREE.Mesh(new THREE.BoxGeometry(.14,2.6,1));
 inner.position.set(0,1.3,9.4);shared.position.set(4.8,1.3,8.5);root.add(inner,shared);
 const original=shared.geometry;integrateDenOpening(root);
 assert.equal(inner.geometry.attributes.position.count,0);
 assert.equal(shared.geometry,original);
});

test('den landing retains floor and ceiling beneath the backing route',()=>{
 const root=new THREE.Group(),floor=new THREE.Mesh(new THREE.BoxGeometry(4.8,.2,5.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ceiling=new THREE.Mesh(new THREE.BoxGeometry(4.8,.2,5.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 floor.position.set(2.4,-.1,9.4);floor.userData.preview_kind='floor';ceiling.position.set(2.4,2.7,9.4);
 const ceilingGroup=new THREE.Group();ceilingGroup.userData.preview_kind='ceiling';ceilingGroup.add(ceiling);root.add(floor,ceilingGroup);
 integrateDenOpening(root);root.updateMatrixWorld(true);
 for(const x of [.55,1.7,2.05,3.05,3.5,4.3,4.67]){
  const eye=new THREE.Vector3(x,1.7,9.334);
  assert.ok(new THREE.Raycaster(eye,new THREE.Vector3(0,-1,0),0,2).intersectObject(floor).length,'missing landing floor');
  assert.ok(new THREE.Raycaster(eye,new THREE.Vector3(0,1,0),0,1.5).intersectObject(ceiling).length,'missing landing ceiling');
 }
});
test('complete plate display sits clear of the basement doorway',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read('web/assets/house/release/hallway.glb');
 const nodes=doc.getRoot().listNodes().filter(n=>n.getMesh()&&/^(Kindergarten plate|Ceramic plate back|Plate stand|Plate wall shelf|Shelf brass bracket(?:\.001)?)$/.test(n.getExtras().source_object??n.getName()));
 assert.equal(nodes.length,6);
 for(const node of nodes){
  const box=new THREE.Box3();for(const p of node.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');box.union(new THREE.Box3(new THREE.Vector3(...a.getMin([])),new THREE.Vector3(...a.getMax([]))));}
  box.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  assert.ok(box.min.x>8.25&&box.max.x<9.4,`${node.getName()} was left behind`);
 }
});

test('new den foreground reuses an owned original wood atlas without moving its lighting bake',()=>{
 const camera=new THREE.PerspectiveCamera(32,1.6,.1,100);camera.position.set(.12,3,7.9);camera.updateMatrixWorld();
 const map=new THREE.Texture(),projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const material=new THREE.ShaderMaterial({uniforms:{lighting:{value:new THREE.Texture()},bakeProjection:{value:projection.clone()}},vertexShader:'uniform mat4 bakeProjection;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D lighting;void main(){vec2 uv=vec2(0.0);gl_FragColor=texture2D(lighting,uv);\n#include <colorspace_fragment>\n}'});
 const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
 const den=createContinuousDen({scene,camera},{floorMaterial:new THREE.MeshStandardMaterial({map})}),clone=den.scene.children[0].material;
 assert.notEqual(clone.uniforms.denFloorMap.value,map);assert.equal(clone.uniforms.denFloorMap.value.source,map.source);
 assert.deepEqual(material.uniforms.bakeProjection.value.elements,projection.elements);assert.equal(material.uniforms.denFloorMap,undefined);
 assert.ok(clone.fragmentShader.includes('denSurfacePosition.y<.025'));assert.ok(clone.fragmentShader.includes('uniform sampler2D denFloorMap'));
 assert.equal(clone.uniforms.denFloorReveal.value,0,'seated den projection must retain its exact original pixels');
 den.travelMatrix({position:den.endpointCamera().position.clone().add(new THREE.Vector3(1,0,0)),quaternion:den.endpointCamera().quaternion},1);
 assert.equal(clone.uniforms.denFloorReveal.value,1);
 let disposed=false;map.addEventListener('dispose',()=>disposed=true);den.resources.dispose();assert.equal(disposed,false);
});


test('basement is fitted as geometry while every furnishing retains its original proportions',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),original=await io.read('web/assets/house/basement-baked.glb'),placed=await io.read('web/assets/house/release/basement.glb');
 const originals=new Map(original.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getName(),n]));
 const assembly=placed.getRoot().listNodes().find(n=>n.getName()==='Refitted basement assembly');assert.deepEqual(assembly.getScale(),[1,1,1]);
 for(const node of placed.getRoot().listNodes().filter(n=>n.getMesh()&&n.getExtras().refit_assembly!=='envelope'&&!n.getExtras().house_fixed_detail)){
  const source=originals.get(node.getExtras().source_object);assert.ok(source,node.getName());
  const a=node.getWorldMatrix(),b=source.getWorldMatrix();
  for(const i of [0,1,2,4,5,6,8,9,10])assert.ok(Math.abs(a[i]-b[i])<1e-6,`${node.getName()} stretched`);
 }
 const pool=placed.getRoot().listNodes().filter(n=>/^Pool (table|ball)/.test(n.getName()));
 const shifts=pool.map(n=>{const a=n.getWorldMatrix(),b=originals.get(n.getExtras().source_object).getWorldMatrix();return[12,13,14].map(i=>a[i]-b[i]);});
 for(const shift of shifts)for(let i=0;i<3;i++)assert.ok(Math.abs(shift[i]-shifts[0][i])<1e-6,'pool-table parts drifted apart');
 assert.ok(!JSON.parse(readFileSync('web/assets/house/release/layout.json')).source_report.basement.staging_scale.some(v=>v!==1));
});

test('workroom no longer contains the removed shirt, print or collar',async()=>{
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('web/assets/house/release/workshop.glb');
 assert.ok(!doc.getRoot().listNodes().some(n=>/^(Printed worn T-shirt|PR2 cartridge screenprint|T-shirt collar)/.test(n.getExtras().source_object??n.getName())));
});


test('all other furniture keeps original size and orientation after removing room fitting scales',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const room of ['hallway','workshop','attic']){
  const source=await io.read(`web/assets/house/${room}-baked.glb`),doc=await io.read(`web/assets/house/release/${room}.glb`);
  const originals=new Map(source.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getName(),n]));
  const rotation=new THREE.Matrix4().makeRotationY(room==='hallway'?Math.PI/2:0);
  for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
   assert.equal(node.getExtras().model_refit,room,node.getName());
   const expected=rotation.clone().multiply(new THREE.Matrix4().fromArray(originals.get(node.getExtras().style_source).getWorldMatrix())),actual=node.getWorldMatrix();
   for(const i of [0,1,2,4,5,6,8,9,10])assert.ok(Math.abs(actual[i]-expected.elements[i])<1e-6,`${room}/${node.getName()} retains fitting scale`);
  }
 }
 const layout=JSON.parse(readFileSync('web/assets/house/release/layout.json'));
 for(const report of Object.values(layout.source_report))assert.deepEqual(report.staging_scale,[1,1,1]);
});

test('workroom framing has plywood backing with original workshop artwork',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read('web/assets/house/release/structure.glb'),source=await io.read('web/assets/house/workshop-baked.glb');
 const hashes=new Set(source.getRoot().listTextures().map(t=>hash(t.getImage()))),panels=doc.getRoot().listNodes().filter(n=>n.getExtras().workshop_plywood);
 assert.equal(panels.length,3);
 for(const panel of panels){
  assert.deepEqual(panel.getScale(),[1,1,1]);
  for(const p of panel.getMesh().listPrimitives()){
   if(panel.getExtras().house_window_bake)assert.ok(p.getMaterial().getEmissiveTexture());
   else assert.ok(hashes.has(hash((p.getMaterial().getEmissiveTexture()??p.getMaterial().getBaseColorTexture()).getImage())));
  }
 }
});

test('workroom windows stay clear of old studs and have headers, sills and side framing',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 const {windowFramingParts}=await import('../scripts/house-finishes.mjs');
 const {PLYWOOD_PANELS}=await import('../scripts/workshop-plywood.mjs');
 const structure=await io.read('web/assets/house/release/structure.glb'),workshop=await io.read('web/assets/house/release/workshop.glb');
 const frames=structure.getRoot().listNodes().filter(n=>n.getExtras().workshop_window_frame);assert.equal(frames.length,12);
 for(const expected of windowFramingParts())assert.ok(frames.some(n=>n.getName()===expected.name));
 const studs=[...structure.getRoot().listNodes(),...workshop.getRoot().listNodes()].filter(n=>n.getMesh()&&/^(Exposed garage wall stud|Side exposed stud|Finish \/ garage (side|rear) stud)/.test(n.getExtras().source_object??n.getName()));
 // Every actual triangle, rather than a broad bounding box spanning the cut.
 for(const panel of PLYWOOD_PANELS.filter(p=>p.name!=='Workshop plywood left')){
  const f=panel.opening,center=new THREE.Vector3(...f.center),right=new THREE.Vector3(...f.right),normal=new THREE.Vector3(...f.normal);
  for(const node of studs)for(const primitive of node.getMesh().listPrimitives()){
   const position=primitive.getAttribute('POSITION'),indices=primitive.getIndices(),matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
   for(let i=0;i<(indices?.getCount()??position.getCount());i+=3){
    const triangle=[0,1,2].map(k=>new THREE.Vector3(...position.getElement(indices?indices.getScalar(i+k):i+k,[])).applyMatrix4(matrix));
    for(let u=-.4;u<=.4;u+=.2)for(let v=-.4;v<=.4;v+=.2){
     const target=center.clone().addScaledVector(right,u*f.size[0]);target.y+=v*f.size[1];
     const ray=new THREE.Ray(target.clone().addScaledVector(normal,1),normal.clone().negate()),hit=ray.intersectTriangle(...triangle,false,new THREE.Vector3());
     assert.ok(!hit||hit.distanceTo(target)> .5,`${node.getName()} blocks ${panel.name}`);
    }
   }
  }
 }
});

test('ceilings use cream paint without repainting the attic floor or exterior roof',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),structure=await io.read('web/assets/house/release/structure.glb'),cellar=await io.read('web/assets/house/release/basement.glb');
 const input=structure.getRoot().listNodes().some(n=>n.getExtras().house_window_bake)?await io.read('scene/exports/house-release/bake-input/structure.glb'):structure;
 const painted=structure.getRoot().listNodes().filter(n=>n.getExtras().ceiling_paint);assert.ok(painted.some(n=>n.getName()==='Garage ceiling'));
 for(const n of input.getRoot().listNodes().filter(n=>n.getExtras().ceiling_paint&&/floor \/ hall ceiling|Main pitched roof/.test(n.getName()))){
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().fromArray(n.getWorldMatrix()));
  for(const p of n.getMesh().listPrimitives()){
   const normals=p.getAttribute('NORMAL'),indices=p.getIndices(),cream=p.getMaterial().getName()==='Light cream ceiling';
   for(let i=0;i<indices.getCount();i+=3){const normal=new THREE.Vector3(...normals.getElement(indices.getScalar(i),[])).applyMatrix3(normalMatrix).normalize();assert.equal(cream,normal.y<-.5);}
  }
 }
 const ceiling=cellar.getRoot().listNodes().find(n=>n.getName()==='Basement ceiling');assert.equal(ceiling.getExtras().ceiling_paint,'light cream');
 for(const p of ceiling.getMesh().listPrimitives()){
  if(ceiling.getExtras().house_window_bake)assert.ok(p.getMaterial().getEmissiveTexture());
  else assert.deepEqual(p.getMaterial().getExtras().ceiling_paint,[.82,.76,.63]);
 }
});
