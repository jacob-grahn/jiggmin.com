import * as THREE from 'three';
import {mergeGeometries} from './vendor/three/BufferGeometryUtils.js';

// A camera-space light bake on actual 3D surfaces: the depth buffer, not DOM order,
// determines whether the rack, TV, or table hides a moving cartridge.
export function prepareRoom(gltf, camera, lighting) {
  lighting.colorSpace = THREE.SRGBColorSpace;
  lighting.minFilter = THREE.LinearFilter;
  camera.updateMatrixWorld(true);
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const material = new THREE.ShaderMaterial({
    uniforms:{lighting:{value:lighting},bakeProjection:{value:projection}},
    vertexShader:`varying vec4 bakePosition;
      uniform mat4 bakeProjection;
      void main(){vec4 world=modelMatrix*vec4(position,1.0);bakePosition=bakeProjection*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform sampler2D lighting;varying vec4 bakePosition;
      void main(){vec2 uv=bakePosition.xy/bakePosition.w*.5+.5;gl_FragColor=vec4(texture2D(lighting,uv).rgb,1.0);
      #include <colorspace_fragment>
      }`,side:THREE.DoubleSide
  });
  let shell, glass;
  gltf.scene.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=false;o.receiveShadow=false;if(o.userData.role==='crt_depth_surface')glass=o;else shell=o;}});
  // Only the moving objects cast onto this duplicate receiver. The static lighting
  // and contact shadows are already baked, so they must not be applied twice.
  const shadows=new THREE.Mesh(shell.geometry,new THREE.ShadowMaterial({opacity:.42,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  shadows.position.copy(shell.position);shadows.quaternion.copy(shell.quaternion);shadows.scale.copy(shell.scale);shadows.receiveShadow=true;shadows.renderOrder=2;shadows.material.depthWrite=false;
  gltf.scene.add(shadows);
  // The transparent, depth-writing CRT surface lets the real Ruffle player show
  // through the canvas, while closer cartridges still occlude it correctly.
  const aperture = new THREE.ShaderMaterial({vertexShader:`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`void main(){gl_FragColor=vec4(0.0);}`,blending:THREE.NoBlending,depthWrite:true,side:THREE.DoubleSide});
  // Animate only the glass: the room's baked lighting stays steady.
  const idle=material.clone();
  idle.uniforms.time={value:0};
  idle.fragmentShader=`uniform sampler2D lighting;uniform float time;varying vec4 bakePosition;
    float hash(float n){return fract(sin(n*127.1)*43758.5453);}
    void main(){
      vec2 uv=bakePosition.xy/bakePosition.w*.5+.5;
      float tick=floor(time*24.0);
      float flutter=(hash(tick)-.5)*.045;
      float dip=step(.94,hash(floor(time*7.0)))*.075;
      float breathing=.012*sin(time*2.3)+.009*sin(time*7.7);
      float band=exp(-pow((fract(uv.y-time*.065)-.5)/.075,2.0))*.025;
      vec3 color=texture2D(lighting,uv).rgb;
      gl_FragColor=vec4(color*(1.0+flutter+breathing-dip-band),1.0);
      #include <colorspace_fragment>
    }`;
  let playing=false,lastTick=-1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  glass.material=idle;glass.renderOrder=1;
  return {group:gltf.scene,shell,glass,
    setPlaying(value){playing=value;glass.material=playing?aperture:idle;},
    updateIdle(time){
      if(playing)return false;
      const tick=reducedMotion.matches?0:Math.floor(time*30);
      if(tick===lastTick)return false;
      lastTick=tick;idle.uniforms.time.value=reducedMotion.matches?0:time;return true;
    }
  };
}

export function addCartridgeLighting(scene,renderer) {
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  scene.add(new THREE.HemisphereLight(0x6d909b,0x23180f,.85));
  const fill=new THREE.DirectionalLight(0xa4bdc5,1.1);fill.position.set(-.5,2.8,6);scene.add(fill);
  const moon=new THREE.DirectionalLight(0x95c6e6,1.45);moon.position.set(-3.5,4,1);moon.target.position.set(-.7,.5,1);
  moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-5;moon.shadow.camera.right=5;moon.shadow.camera.top=5;moon.shadow.camera.bottom=-5;moon.shadow.camera.near=.2;moon.shadow.camera.far=14;moon.shadow.normalBias=.008;moon.shadow.bias=-.00015;moon.shadow.radius=3;scene.add(moon,moon.target);
  const lamp=new THREE.PointLight(0xffb66c,14,7,2);lamp.position.set(2.7,2.05,-.65);scene.add(lamp);
  const crt=new THREE.PointLight(0x69cddb,3.2,4,2);crt.position.set(0,1.9,.8);scene.add(crt);
  return {crt};
}

// Consolidate repeated grip/rim pieces, keeping independent cartridge roots.
export function optimizeCartridge(root) {
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(), batches=new Map(), originals=[];
  root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;
    const key=o.material.uuid, batch=batches.get(key)||{material:o.material,geometries:[],casts:false};
    const geometry=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    geometry.deleteAttribute('tangent');
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
    batch.geometries.push(geometry);batch.casts ||= o.castShadow;batches.set(key,batch);originals.push(o);
  });
  for(const o of originals)o.removeFromParent();
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.geometries,false);
    const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=batch.casts;mesh.receiveShadow=true;root.add(mesh);
    for(const g of batch.geometries)g.dispose();
  }
}
