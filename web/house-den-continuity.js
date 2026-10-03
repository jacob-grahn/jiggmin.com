import * as THREE from 'three';
import {createRoomResources} from './house-resources.js';
import {repairDenProjection} from './den-projection.js?v=house-reference-20';
import {assignRoomLighting} from './house-lighting.js';
// The authored den uses studio units. Convert uniformly in its cloned geometry;
// placement and all travel cameras are rigid, with no affine fitting basis.
export const DEN_UNITS_TO_METRES=.55;
export const DEN_PLACEMENT=new THREE.Matrix4().compose(new THREE.Vector3(-.208,0,9.4),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),new THREE.Vector3(1,1,1));
export const DEN_SOURCE_TO_WORLD=DEN_PLACEMENT.clone().multiply(new THREE.Matrix4().makeScale(DEN_UNITS_TO_METRES,DEN_UNITS_TO_METRES,DEN_UNITS_TO_METRES));
export function createContinuousDen(source,{floorMaterial}={}){
 const scene=source.scene.clone(true),resources=createRoomResources(),materials=new Map(),geometries=new Map(),textures=new Map();
 const texture=t=>{if(!textures.has(t))textures.set(t,t.clone());return textures.get(t);};
 scene.traverse(o=>{
  o.position.multiplyScalar(DEN_UNITS_TO_METRES);o.updateMatrix();
  if(o.isLight&&!o.isDirectionalLight&&!o.isHemisphereLight&&o.intensity!==undefined)o.intensity*=DEN_UNITS_TO_METRES**2;
  if(o.userData.role==='den_door')o.visible=false;
  if(!o.isMesh)return;
  if(!geometries.has(o.geometry))geometries.set(o.geometry,o.geometry.clone().scale(DEN_UNITS_TO_METRES,DEN_UNITS_TO_METRES,DEN_UNITS_TO_METRES));o.geometry=geometries.get(o.geometry);
  const own=original=>{
   if(materials.has(original))return materials.get(original);
   const m=original.clone();m.onBeforeCompile=original.onBeforeCompile;m.customProgramCacheKey=original.customProgramCacheKey;
   for(const [key,value]of Object.entries(original))if(value?.isTexture)m[key]=texture(value);
   for(const [key,uniform]of Object.entries(original.uniforms??{}))if(uniform.value?.isTexture)m.uniforms[key].value=texture(uniform.value);
   if(m.uniforms?.bakeProjection&&!m.uniforms.bakeModelMatrix)m.uniforms.bakeProjection.value.multiply(DEN_SOURCE_TO_WORLD.clone().invert());
   if(m.uniforms?.bakeModelMatrix)m.uniforms.bakeModelMatrix.value.multiply(new THREE.Matrix4().makeScale(1/DEN_UNITS_TO_METRES,1/DEN_UNITS_TO_METRES,1/DEN_UNITS_TO_METRES));
   repairDenProjection(m,source.camera,DEN_SOURCE_TO_WORLD.clone().invert());
   if(m.isShaderMaterial&&m.uniforms?.lighting&&!m.uniforms.bakeModelMatrix&&floorMaterial?.map){
    // The original camera bake ends at the rug. Newly exposed foreground
    // boards use the original house's wood atlas, with a fixed shade sampled
    // from the den bake. This is a surface texture, with no additional light.
    m.uniforms.denFloorMap={value:texture(floorMaterial.map)};
    m.uniforms.denFloorReveal={value:0};
    m.fragmentShader='uniform sampler2D denFloorMap;\nuniform float denFloorReveal;\n'+m.fragmentShader.replace('#include <colorspace_fragment>',`
     if(denSurfacePosition.y<.025){
      vec3 wood=texture2D(denFloorMap,fract(denSurfacePosition.xz*vec2(.45,.8))).rgb;
      vec3 shade=texture2D(lighting,vec2(.20,.06)).rgb;
      gl_FragColor.rgb=mix(gl_FragColor.rgb,shade*(.65+.7*wood),denFloorReveal*(1.0-smoothstep(.005,.035,uv.y)));
     }
     #include <colorspace_fragment>`);
   }
   // The shared rear wall owns the doorway. Trim the scenic den's oversized
   // foreground at that wall so it cannot extend through the entry hall.
   if(m.isShaderMaterial){
    m.vertexShader='varying vec3 denWorldPosition;\n'+m.vertexShader.replace('void main(){','void main(){denWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;');
    m.fragmentShader='varying vec3 denWorldPosition;\n'+m.fragmentShader.replace('void main(){','void main(){if(denWorldPosition.x>4.70)discard;');
   }else m.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),4.70)];
   materials.set(original,m);return m;
  };
  o.material=Array.isArray(o.material)?o.material.map(own):own(o.material);
 });
 scene.applyMatrix4(DEN_PLACEMENT);assignRoomLighting([scene],'den');resources.capture(scene);
 return {scene,resources,sourceCamera:source.camera,exposure:source.exposure??.95,
  travelMatrix(pose,_lensWeight,facingWeight=1){
   const eye=source.camera.position.clone().multiplyScalar(DEN_UNITS_TO_METRES).applyMatrix4(DEN_PLACEMENT);
   const repair=THREE.MathUtils.smoothstep(pose.position.distanceTo(eye),.15,.8);
   for(const m of materials.values())if(m.uniforms?.denProjectionRepair)m.uniforms.denProjectionRepair.value=repair;
   for(const m of materials.values())if(m.uniforms?.denFloorReveal)m.uniforms.denFloorReveal.value=repair;
   const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
   const rotation=pose.quaternion.clone().slerp(yaw.multiply(source.camera.quaternion),facingWeight);
   return new THREE.Matrix4().makeRotationFromQuaternion(rotation).setPosition(pose.position);
  },
  endpointCamera(){
   source.camera.updateMatrixWorld();const c=source.camera.clone();
   c.position.copy(source.camera.position).multiplyScalar(DEN_UNITS_TO_METRES).applyMatrix4(DEN_PLACEMENT);
   c.quaternion.copy(new THREE.Quaternion().setFromRotationMatrix(DEN_PLACEMENT)).multiply(source.camera.quaternion);
   c.scale.set(1,1,1);c.matrixAutoUpdate=true;c.updateMatrixWorld(true);return c;
  }
 };
}
