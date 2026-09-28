import * as THREE from 'three';

// Local to the den: quantize illumination, never the label/artwork colors.
// Keep the existing maps, patina, shadows and skinning path intact.
export function illustrateMaterial(material){
 if(!material.isMeshStandardMaterial||material.userData.denIllustrated)return;
 const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey(),hasArtwork=!!material.map;
 material.userData.denIllustrated=true;
 material.roughness=Math.max(material.roughness,.78);material.metalness=Math.min(material.metalness,.18);
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  if(!hasArtwork){
   shader.vertexShader='varying vec3 denInkPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndenInkPosition=position;');
   shader.fragmentShader='varying vec3 denInkPosition;\n'+shader.fragmentShader;
  }
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 inkBase=max(diffuseColor.rgb,vec3(.012));
   vec3 inkIrradiance=max(outgoingLight-totalEmissiveRadiance,vec3(0.0))/inkBase;
   float inkLight=dot(inkIrradiance,vec3(.2126,.7152,.0722));
   float inkBand=.32+.34*smoothstep(.30,.34,inkLight)
     +.44*smoothstep(.72,.77,inkLight)+.48*smoothstep(1.35,1.42,inkLight);
   vec3 inkTint=mix(vec3(.68,.57,1.0),vec3(1.12,1.0,.78),smoothstep(.25,1.3,inkLight));
   outgoingLight=diffuseColor.rgb*inkBand*inkTint+totalEmissiveRadiance;
   ${hasArtwork?'':`
   float inkPhase=dot(denInkPosition,vec3(1.2,1.0,.4))*380.0;
   float inkWave=sin(inkPhase),inkAA=max(fwidth(inkWave),.03);
   float inkStroke=smoothstep(.88-inkAA,.88+inkAA,inkWave);
   float inkPatch=sin(denInkPosition.x*27.0+sin(denInkPosition.y*33.0))*sin(denInkPosition.z*21.0+denInkPosition.y*19.0)*.5+.5;
   outgoingLight*=1.0-.65*inkStroke*smoothstep(.74,.82,inkPatch)*(1.0-smoothstep(.7,1.4,inkLight));
   `}
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`${cacheKey}-den-ink-2-${hasArtwork}`;
 material.needsUpdate=true;
}

const ink=new THREE.ShaderMaterial({
 name:'Den silhouette ink',side:THREE.BackSide,
 uniforms:{inkWidth:{value:.0042}},
 vertexShader:`uniform float inkWidth;
 void main(){
  vec4 p=modelViewMatrix*vec4(position,1.0);
  vec3 n=normalize(normalMatrix*normal);
  p.xyz+=n*inkWidth;
  gl_Position=projectionMatrix*p;
 }`,
 fragmentShader:`void main(){gl_FragColor=vec4(.0003,.0002,.0005,1.0);
 #include <colorspace_fragment>
 }`
});

export function illustrateObject(root){
 const meshes=[];
 root.traverse(o=>{if(o.isMesh&&!o.userData.denInk)meshes.push(o);});
 for(const mesh of meshes){
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])illustrateMaterial(mat);
  // Ink substantial solid forms only. Labels, screws and thin ornamental marks
  // keep their existing details instead of acquiring a halo or extra hit target.
  if(mesh.userData.denOutlined)continue;
  const geometry=mesh.geometry;geometry.computeBoundingBox();
  const size=geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);
  if(Math.min(size.x,size.y,size.z)<.009||Math.max(size.x,size.y,size.z)<.10)continue;
  const outline=new THREE.Mesh(geometry,ink);outline.name='Den ink contour';
  outline.userData.denInk=true;outline.raycast=()=>{};outline.castShadow=false;outline.receiveShadow=false;
  mesh.add(outline);mesh.userData.denOutlined=true;
 }
}
