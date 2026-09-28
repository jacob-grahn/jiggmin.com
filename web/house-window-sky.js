import * as THREE from 'three';

export const MOONLIT_SKY_URL='/web/assets/house/windows/moonlit-sky.png';

// Window planes act as openings onto one infinitely distant environment.
// Sample by the actual world-space sightline, not by the plane's local UVs:
// small/faraway windows show less sky, and neighboring windows agree.
export function createMoonlitWindows(model,sky){
 sky.colorSpace=THREE.SRGBColorSpace;
 sky.wrapS=THREE.RepeatWrapping;
 sky.wrapT=THREE.ClampToEdgeWrapping;
 let count=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^(Rainy garden through hallway|Garden beyond window)/.test(mesh.name.replaceAll('_',' ')))return;
  const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const material=new THREE.MeshBasicMaterial({name:'Exterior shared moonlit sky',map:sky,side:source.side,clippingPlanes:source.clippingPlanes,toneMapped:false});
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 exteriorWorldPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    exteriorWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;`);
   shader.fragmentShader='varying vec3 exteriorWorldPosition;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    vec3 skyDirection=normalize(exteriorWorldPosition-cameraPosition);
    vec2 skyUV=vec2(atan(skyDirection.z,skyDirection.x)*0.15915494309+.5,
                    asin(clamp(skyDirection.y,-1.0,1.0))*0.31830988618+.5);
    diffuseColor*=texture2D(map,skyUV);
   `);
  };
  material.customProgramCacheKey=()=> 'shared-moonlit-window-sky-1';
  mesh.material=material;count++;
 });
 return count;
}
