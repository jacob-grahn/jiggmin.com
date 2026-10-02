import * as THREE from 'three';
import {accelerateRaycasts} from './raycast-acceleration.js';
import {createPropReactions} from './prop-reactions.js?v=stronger-wiggle-2';

// The experimental atlas follows surface UVs, including while travelling or
// reacting to a tap. It is already display transformed: never tone map it twice.
export function prepareBakedDen(gltf){
 let glass;const shells=[],props=[];
 gltf.scene.traverse(o=>{
  if(!o.isMesh)return;
  if(o.userData.role==='room_geometry')shells.push(o);
  else if(o.userData.role==='crt_depth_surface')glass=o;
  else if(o.userData.role==='reactive_prop')props.push(o);
  const map=o.material.map??o.material.emissiveMap;if(map)map.anisotropy=8;
  o.material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,toneMapped:false});
  o.castShadow=false;o.receiveShadow=false;
 });
 if(!shells.length||!glass)throw new Error('Den UV bake is missing room or screen geometry');
 accelerateRaycasts([...shells,...props]);
 const shell=new THREE.Group();shell.name="Den baked static surfaces";gltf.scene.add(shell);
 for(const mesh of shells)shell.attach(mesh);
 for(const mesh of shells){
 const shadows=new THREE.Mesh(mesh.geometry,new THREE.ShadowMaterial({opacity:.42,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 mesh.updateWorldMatrix(true,false);shadows.applyMatrix4(mesh.matrixWorld);shadows.receiveShadow=true;shadows.renderOrder=2;shadows.material.depthWrite=false;gltf.scene.add(shadows);
 }
 const idle=new THREE.ShaderMaterial({
  uniforms:{atlas:{value:glass.material.map??glass.material.emissiveMap},time:{value:0}},
  vertexShader:'varying vec2 atlasUV;void main(){atlasUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform sampler2D atlas;uniform float time;varying vec2 atlasUV;
   void main(){vec3 color=texture2D(atlas,atlasUV).rgb;gl_FragColor=vec4(color*(1.0+.012*sin(time*2.3)+.009*sin(time*7.7)),1.0);
   #include <colorspace_fragment>
   }`,side:THREE.DoubleSide,toneMapped:false
 });
 const aperture=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main(){gl_FragColor=vec4(0.0);}',blending:THREE.NoBlending,depthWrite:true,side:THREE.DoubleSide});
 glass.material=idle;glass.renderOrder=1;
 let playing=false,lastTick=-1;const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 return {group:gltf.scene,shell,glass,props,reactions:createPropReactions(props),occluders:[...shells,...props],
  setPlaying(value){playing=value;glass.material=playing?aperture:idle;},
  updateIdle(time){if(playing)return false;const tick=reducedMotion.matches?0:Math.floor(time*30);if(tick===lastTick)return false;lastTick=tick;idle.uniforms.time.value=reducedMotion.matches?0:time;return true;}
 };
}
