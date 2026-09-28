import * as THREE from 'three';

// Keep the glass, rain, and frame in place, but sample the exterior as a distant
// backdrop. Overscan supplies scenery at the edges when the camera walks past.
export function createWindowParallax(model,referenceCamera){
 const windows=[],eye=new THREE.Vector3(),relative=new THREE.Vector3();
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^(Rainy garden through hallway|Garden beyond window)/.test(mesh.name.replaceAll('_',' ')))return;
  const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const map=source.map??source.emissiveMap;if(!map)return;
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  if(!uv)return;
  // Recover the authored UV axes, independent of glTF's axis conversion and
  // the hallway's placement in the connected house.
  const corners=[];
  for(const target of [[0,0],[1,0],[0,1]]){
   let best=Infinity,index=0;
   for(let i=0;i<uv.count;i++){const d=(uv.getX(i)-target[0])**2+(uv.getY(i)-target[1])**2;if(d<best){best=d;index=i;}}
   corners.push(new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(mesh.matrixWorld));
  }
  const u=corners[1].clone().sub(corners[0]),v=corners[2].clone().sub(corners[0]);
  const size=new THREE.Vector2(u.length(),v.length());u.normalize();v.normalize();
  const normal=new THREE.Vector3().crossVectors(u,v).normalize();
  const center=corners[0].clone().addScaledVector(u,size.x/2).addScaledVector(v,size.y/2);
  referenceCamera.getWorldPosition(eye);relative.copy(eye).sub(center);
  if(relative.dot(normal)<0)normal.negate();
  const reference=new THREE.Vector2(relative.dot(u),relative.dot(v)).divideScalar(Math.max(.3,relative.dot(normal)));
  const shift={value:new THREE.Vector2()};
  const material=new THREE.MeshBasicMaterial({name:'Exterior parallax garden',map,side:source.side,color:0xcccccc,clippingPlanes:source.clippingPlanes});
  material.onBeforeCompile=shader=>{
   shader.uniforms.windowShift=shift;
   shader.fragmentShader='uniform vec2 windowShift;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
     vec2 windowUV=(vMapUv-.5)*.66+.5+windowShift;
     vec4 sampledDiffuseColor=texture2D(map,windowUV);
     diffuseColor*=sampledDiffuseColor;
    #endif
   `);
  };
  material.customProgramCacheKey=()=> 'window-parallax-1';mesh.material=material;
  windows.push({center,u,v,normal,reference,shift,size});
 });
 return {count:windows.length,update(camera){
  camera.getWorldPosition(eye);
  for(const window of windows){
   relative.copy(eye).sub(window.center);
   const distance=Math.max(.3,relative.dot(window.normal));
   const x=(relative.dot(window.u)/distance-window.reference.x)*.22;
   const y=(relative.dot(window.v)/distance-window.reference.y)*.22;
   // Smoothly bound the view inside the overscan, including grazing angles.
   window.shift.value.set(-.165*x/Math.sqrt(1+x*x),-.165*y/Math.sqrt(1+y*y));
  }
 }};
}
