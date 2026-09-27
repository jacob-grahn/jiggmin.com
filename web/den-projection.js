import * as THREE from 'three';

// The camera-projected lighting plate includes the TV. Surfaces behind its
// silhouette were never visible in the bake and must not repeat that image.
export const TV_BOUNDS=new THREE.Box3(new THREE.Vector3(-1.39,1.05,-1.04),new THREE.Vector3(1.39,3.15,.27));
export function repairDenProjection(material,sourceCamera,inverseRoom){
 if(!material.isShaderMaterial||!material.uniforms?.lighting||material.uniforms.bakeModelMatrix)return;
 material.uniforms.denBakeEye={value:sourceCamera.position.clone()};
 material.uniforms.denInverseRoom={value:inverseRoom.clone()};
 material.uniforms.denTvMin={value:TV_BOUNDS.min.clone()};
 material.uniforms.denTvMax={value:TV_BOUNDS.max.clone()};
 const wallSample=new THREE.Vector4(0,3.5,-1.88,1).applyMatrix4(inverseRoom.clone().invert()).applyMatrix4(material.uniforms.bakeProjection.value);
 material.uniforms.denWallUv={value:new THREE.Vector2(wallSample.x/wallSample.w*.5+.5,wallSample.y/wallSample.w*.5+.5)};
 material.vertexShader='varying vec3 denSurfacePosition;uniform mat4 denInverseRoom;\n'+material.vertexShader.replace('void main(){','void main(){denSurfacePosition=(denInverseRoom*modelMatrix*vec4(position,1.0)).xyz;');
 material.fragmentShader=`uniform sampler2D lighting;varying vec3 denSurfacePosition;
 uniform vec3 denBakeEye;uniform vec3 denTvMin;uniform vec3 denTvMax;uniform vec2 denWallUv;
 vec4 denLighting(vec2 uv){
  vec3 direction=denSurfacePosition-denBakeEye;
  vec3 safeDirection=mix(vec3(.00001),direction,step(vec3(.00001),abs(direction)));
  vec3 a=(denTvMin-denBakeEye)/safeDirection,b=(denTvMax-denBakeEye)/safeDirection;
  vec3 nearHit=min(a,b),farHit=max(a,b);
  float enter=max(max(nearHit.x,nearHit.y),nearHit.z);
  float leave=min(min(farHit.x,farHit.y),farHit.z);
  if(enter>0.0&&leave>=enter&&leave<.999&&denSurfacePosition.z<denTvMin.z-.025){
   // Quiet plaster in the TV's shadow, with no screen, bezel or lettering.
   float grain=fract(sin(dot(denSurfacePosition.xy,vec2(127.1,311.7)))*43758.5453);
   vec3 wall=texture2D(lighting,denWallUv).rgb;
   return vec4(wall*(.96+.08*grain),1.0);
  }
  return texture2D(lighting,uv);
 }
 `+material.fragmentShader.replace('uniform sampler2D lighting;','').replace(/texture2D\(lighting,/g,'denLighting(');
}
