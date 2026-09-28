import * as THREE from 'three';

// Live counterpart of the Den's baked ink/cel treatment. Artwork stays intact,
// surface detail follows the object, and masonry is painted rather than exposed.
export function illustrateHouseMaterial(material,{masonry=false}={}){
 if(!material.isMeshStandardMaterial||material.userData.houseIllustrated)return;
 material.userData.houseIllustrated=true;
 material.roughness=Math.max(.82,material.roughness);material.metalness=Math.min(.12,material.metalness);
 material.normalScale?.multiplyScalar(.24);
 if(/^glow(?:\.|$)/i.test(material.name)){material.emissive.set(0xffaa61);material.emissiveIntensity=.65;}
 const prior=material.onBeforeCompile,key=material.customProgramCacheKey();
 const artwork=/print|artwork|exterior|rain|night|glow/i.test(material.name);
 material.onBeforeCompile=function(shader,renderer){
  prior.call(this,shader,renderer);
  shader.vertexShader='varying vec3 houseInkLocal;\nvarying vec3 houseInkWorld;\nvarying vec3 houseInkNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   houseInkLocal=position;
   houseInkWorld=(modelMatrix*vec4(position,1.0)).xyz;
   houseInkNormal=normalize(mat3(modelMatrix)*normal);`);
  shader.fragmentShader='varying vec3 houseInkLocal;\nvarying vec3 houseInkWorld;\nvarying vec3 houseInkNormal;\n'+shader.fragmentShader;
  if(masonry)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 brickUV=vec2(abs(houseInkNormal.x)>abs(houseInkNormal.z)?houseInkWorld.z:houseInkWorld.x,houseInkWorld.y);
   float row=floor(brickUV.y/.27);
   vec2 brickCell=fract(vec2(brickUV.x/.66+mod(row,2.0)*.5,brickUV.y/.27));
   vec2 jointDistance=min(brickCell,1.0-brickCell)*vec2(.66,.27);
   float joint=1.0-smoothstep(.003,.012,min(jointDistance.x,jointDistance.y));
   float paint=.10+.035*sin(brickUV.x*13.0+sin(brickUV.y*19.0));
   diffuseColor.rgb*=1.0-joint*paint;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 inkIrradiance=max(outgoingLight-totalEmissiveRadiance,vec3(0.0))/max(diffuseColor.rgb,vec3(.015));
   float inkLight=dot(inkIrradiance,vec3(.2126,.7152,.0722));
   float inkBand=.22+.30*smoothstep(.20,.29,inkLight)+.42*smoothstep(.58,.70,inkLight)+.52*smoothstep(1.18,1.34,inkLight);
   vec3 inkChroma=clamp(inkIrradiance/max(inkLight,.04),vec3(.4),vec3(1.7));
   vec3 inkTint=mix(vec3(.72,.69,1.0),vec3(1.07,.96,.83),smoothstep(.18,1.3,inkLight));
   outgoingLight=diffuseColor.rgb*inkBand*inkChroma*inkTint+totalEmissiveRadiance;
   ${artwork?'':`
   float phase=dot(houseInkLocal,vec3(1.2,1.0,.4))*260.0;
   float wave=sin(phase),aa=max(fwidth(wave),.04);
   float stroke=smoothstep(.89-aa,.89+aa,wave);
   float inkPatch=sin(houseInkLocal.x*19.0+sin(houseInkLocal.y*27.0))*sin(houseInkLocal.z*23.0+houseInkLocal.y*13.0)*.5+.5;
   outgoingLight*=1.0-.30*stroke*smoothstep(.79,.88,inkPatch)*(1.0-smoothstep(.55,1.2,inkLight));`}
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`${key}-house-ink-1-${masonry}-${artwork}`;
 material.needsUpdate=true;
}

export function illustrateHouse(roots){
 const materials=new Map(),inks=new Map(),seen=new Set();
 for(const root of roots){
  const meshes=[];root.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.houseInk&&!seen.has(mesh)){seen.add(mesh);meshes.push(mesh);}});
  for(const mesh of meshes){
   if(mesh.userData.houseOutlined)continue;
   const masonry=/corridor.wall|far.wall|masonry|plaster|shared.wall/i.test(mesh.name.replaceAll('_',' '));
   const finish=original=>{
    const key=original.uuid+'-'+masonry;
    if(!materials.has(key)){
     const copy=original.clone();copy.onBeforeCompile=original.onBeforeCompile;copy.customProgramCacheKey=original.customProgramCacheKey;
     illustrateHouseMaterial(copy,{masonry});materials.set(key,copy);
    }
    return materials.get(key);
   };
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(finish):finish(mesh.material);
   mesh.geometry.computeBoundingBox();
   const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.getWorldScale(new THREE.Vector3()));
   const lampMaterial=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).find(m=>/^glow(?:\.|$)/i.test(m.name));
   if(lampMaterial&&!mesh.userData.housePractical){
    const light=new THREE.PointLight(0xffa258,5,4.5,2);light.name='Illustrated warm practical';
    mesh.geometry.boundingBox.getCenter(light.position);light.layers.mask=mesh.layers.mask;mesh.add(light);mesh.userData.housePractical=true;
   }
   if(Math.min(...size.toArray())<.012||Math.max(...size.toArray())<.12)continue;
   const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   if(source.transparent||/glow|exterior|rain|night/i.test(source.name))continue;
   // Room-owned contours inherit clipping and are disposed with that room.
   const clip=source.clippingPlanes;
   if(!inks.has(clip)){
    const ink=new THREE.MeshBasicMaterial({name:'House silhouette ink',color:0x06040c,side:THREE.BackSide,clippingPlanes:clip??null});
    ink.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     mvPosition.xyz+=normalize(normalMatrix*normal)*.004;
     gl_Position=projectionMatrix*mvPosition;`);};
    ink.customProgramCacheKey=()=> 'house-contour-1';inks.set(clip,ink);
   }
   const outline=new THREE.Mesh(mesh.geometry,inks.get(clip));outline.name='House ink contour';
   outline.layers.mask=mesh.layers.mask;outline.userData.houseInk=true;outline.raycast=()=>{};mesh.add(outline);mesh.userData.houseOutlined=true;
  }
 }
}
