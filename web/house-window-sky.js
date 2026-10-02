import * as THREE from 'three';
import {windowExteriorFrame,createWindowTrees} from './house-window-exterior.js?v=house-reference-31';
import {cutWindowOpenings} from './house-window-openings.js';

export const MOONLIT_SKY_URL='/web/assets/house/windows/night-forest.webp';
export const WINDOW_GLASS_LAYER=6;

// One enclosing environment, rendered once before the house. Unlike the old
// window materials, this sky is actually behind the walls and exterior objects.
export function createMoonlitSky(sky){
 sky.colorSpace=THREE.SRGBColorSpace;sky.wrapS=THREE.RepeatWrapping;
 sky.magFilter=THREE.LinearFilter;sky.minFilter=THREE.LinearMipmapLinearFilter;
 const material=new THREE.MeshBasicMaterial({name:'Moonlit exterior sky',map:sky,side:THREE.BackSide,toneMapped:false,depthWrite:false,depthTest:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 skyDirection;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   skyDirection=position;`);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 mvPosition=viewMatrix*vec4(transformed+cameraPosition,1.0);
   gl_Position=projectionMatrix*mvPosition;gl_Position.z=gl_Position.w;`);
  shader.fragmentShader='varying vec3 skyDirection;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec3 direction=normalize(skyDirection);
   // Three repeats give each window three times the original texel density.
   // Scale both axes equally so trees retain their natural proportions.
   vec2 skyUV=vec2((atan(direction.z,direction.x)*0.15915494309+.5)*3.0,
    clamp(asin(clamp(direction.y,-1.0,1.0))*0.95492965855+.64,.02,.98));
   vec4 scenery=texture2D(map,skyUV);
   // Lift existing cloud rims and distant moonlit branches, preserving the
   // dark forest. Eye-level windows should see the sky above the tree line.
   float detail=dot(scenery.rgb,vec3(.2126,.7152,.0722));
   scenery.rgb*=mix(.18,.55,smoothstep(.035,.24,detail))*.5;
   // Retain the faint atmospheric halo and the room's baked illumination.
   // The visible moon disc is gone from both the shader and the image.
   float moonDistance=acos(clamp(dot(direction,normalize(vec3(1.0,.062,-.048))),-1.0,1.0));
   float halo=exp(-moonDistance*moonDistance/ .003)*.018;
   scenery.rgb+=vec3(.08,.12,.20)*halo;
   diffuseColor*=scenery;`);
 };
 material.customProgramCacheKey=()=> 'night-forest-world-sky-6';
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);
 mesh.name='Shared moonlit sky';mesh.frustumCulled=false;mesh.renderOrder=-1000;return mesh;
}

export function createMoonlitWindows(model,sky,eye){
 sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;
 const windows=[];model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(mesh.isMesh&&/^(Rainy garden through hallway|Garden beyond window)/.test(mesh.name.replaceAll('_',' ')))windows.push(mesh);
 });
 const frames=windows.map(mesh=>{
  const frame=windowExteriorFrame(mesh);
  // Point outward, away from the room's authored camera. No assumptions about
  // Blender's plane winding or the rotation of a room in the connected house.
  if(eye&&frame.normal.dot(eye.clone().sub(frame.center))>0){frame.normal.negate();frame.right.negate();}
  frame.size.addScalar(-.04);return frame;
 });
 const cutMeshes=cutWindowOpenings(model,frames);
 const exterior=new THREE.Group();exterior.name='Physical window exteriors';
 const glass=[];
 windows.forEach((mesh,i)=>{
  const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  mesh.material=new THREE.MeshBasicMaterial({name:'Clear window glass',color:0x192532,
   transparent:true,opacity:.025,toneMapped:false,
   depthWrite:false,side:THREE.DoubleSide,clippingPlanes:source.clippingPlanes});
  mesh.userData.houseOutlined=true;mesh.userData.windowGlass=true;glass.push(mesh);
  const frame=frames[i];exterior.add(createWindowTrees(frame));
  if(model.getObjectByName(`Baked window reveal ${i} left`)||model.getObjectByName(`Baked_window_reveal_${i}_left`))return;
  // Cap the newly cut edges with an actual wooden reveal. Its inner edges sit
  // just beyond the aperture, underneath the existing frame and sill.
  const reveal=new THREE.Group();reveal.position.copy(frame.center);
  reveal.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,new THREE.Vector3(0,1,0),frame.normal));
  const w=frame.size.x,h=frame.size.y,depth=.96,t=.06;
  const material=new THREE.MeshBasicMaterial({name:'Window reveal wood',color:0x202b32,toneMapped:false});
  for(const [x,y,sx,sy] of [[-(w+t)/2,0,t,h+2*t],[(w+t)/2,0,t,h+2*t],[0,-(h+t)/2,w,t],[0,(h+t)/2,w,t]]){
   const part=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,depth),material);
   part.position.set(x,y,depth/2-.16);part.name='Window opening reveal';part.userData.houseOutlined=true;reveal.add(part);
  }
  exterior.add(reveal);
 });
 return {count:windows.length,exterior,glass,frames,cutMeshes};
}
