import * as THREE from 'three';

// Surface artwork multiplies the existing UV lighting: moonlight and shadows
// stay attached to the slab, including under the pool table and furniture.
export function drawBasementFloor(ctx,width=2048){
 let seed=73491;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const height=Math.round(width*1.38),pixels=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,cloud=Math.sin(x/91+Math.sin(y/170))*Math.cos(y/133)*9;
  const grit=random(),v=106+cloud+(grit-.5)*23-(grit<.018?25:0);
  pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);ctx.save();ctx.scale(width/10,width/10);ctx.translate(5,3.7);
 const line=(points,color,size)=>{ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();};
 // Irregular branching hairline cracks; no regular tile grid.
 const cracks=[
  [[-4.9,-2.4],[-3.8,-2.15],[-3.3,-1.8],[-2.55,-1.72]],
  [[-.7,-3.55],[-.54,-2.8],[-.84,-2.2],[-.58,-1.45],[-.1,-.91],[.04,-.15],[.63,.46],[.7,1.1]],
  [[.04,-.15],[-.58,.12],[-.82,.57],[-1.34,.8]],
  [[4.8,4.3],[3.92,3.9],[3.58,3.23],[2.9,3.02],[2.6,2.58]],
  [[3.58,3.23],[3.83,2.53],[3.65,2.04]],
  [[-2.8,8.8],[-2.05,7.55],[-1.8,6.8],[-.95,6.43],[-.55,5.64],[.3,5.3],[.6,4.6]],
 ];
 for(const points of cracks){line(points,'#898d8b',.043);line(points,'#30383b',.022);}
 // Old, irregular paint spills and small satellite droplets.
 for(const [x,z,r,color] of [[2.15,.95,.24,'#9c7951'],[-.3,3.3,.20,'#bbc0b5'],[2.7,4.7,.32,'#657f87'],[-3.9,.4,.25,'#86765b'],[.55,-1.1,.13,'#a99c79']]){
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2,d=r*(.6+random()*.6);const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d*.62;i?ctx.lineTo(px,pz):ctx.moveTo(px,pz);}
  ctx.closePath();ctx.fill();
  for(let i=0;i<22;i++){const a=random()*Math.PI*2,d=r*(.9+random()*1.8);ctx.beginPath();ctx.ellipse(x+Math.cos(a)*d,z+Math.sin(a)*d,.006+random()*.019,.005+random()*.011,random()*3,0,Math.PI*2);ctx.fill();}
 }
 // A playful, human-sized taped silhouette, laid across the open floor.
 ctx.save();ctx.translate(.9,2.15);ctx.rotate(-Math.PI/2+.12);
 const body=[[-.13,-.66],[-.28,-.55],[-.62,-.73],[-.82,-.53],[-.85,-.20],[-.71,-.15],[-.60,-.46],[-.37,-.31],[-.27,.16],[-.32,.43],[-.48,.86],[-.38,1.06],[-.18,1.04],[-.17,.79],[0,.40],[.14,.72],[.23,1.06],[.43,1.05],[.48,.91],[.34,.42],[.27,.12],[.29,-.25],[.53,-.04],[.76,-.12],[.76,-.28],[.57,-.28],[.32,-.57],[.13,-.66]];
 ctx.lineCap='square';ctx.lineJoin='miter';line([...body,body[0]],'#eeeeea',.039);
 const head=Array.from({length:13},(_,i)=>[Math.sin(i/12*Math.PI*2)*.17,-.83-Math.cos(i/12*Math.PI*2)*.20]);line(head,'#eeeeea',.039);
 ctx.restore();ctx.restore();
}

// This cloth belonged to the removed low table. Set it on the floor beside
// the pool table, retaining the original geometry and texture coordinates.
export function settleBasementCloth(model){
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^Ordinary[ _]rumpled[ _]cloth/.test(mesh.name))return;
  const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3());
  if(Math.abs(center.x+.60)<.05&&Math.abs(center.z-2.02)<.05&&box.min.y>.1){
   mesh.scale.y*=.15;mesh.updateMatrixWorld(true);
   box.setFromObject(mesh);mesh.position.y+=.015-box.min.y;mesh.updateMatrixWorld(true);
  }
 });
}

export function addBasementDetails(model,{floorTexture}={}){
 settleBasementCloth(model);
 if(!floorTexture){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=Math.round(canvas.width*1.38);
  drawBasementFloor(canvas.getContext('2d'),canvas.width);floorTexture=new THREE.CanvasTexture(canvas);
 }
 floorTexture.colorSpace=THREE.SRGBColorSpace;floorTexture.anisotropy=8;
 const slab=model.getObjectByName('Concrete_slab')??model.getObjectByName('Concrete slab');
 if(!slab)throw Error('Basement concrete slab is missing');
 slab.geometry.computeBoundingBox();const bounds=slab.geometry.boundingBox,size=bounds.getSize(new THREE.Vector3());
 const material=slab.material.clone();material.name='Moonlit worn basement concrete';material.basementWearMap=floorTexture;
 material.onBeforeCompile=shader=>{
  shader.uniforms.basementWear={value:floorTexture};
  shader.vertexShader='varying vec2 basementFloorUV;\nvarying float basementFloorTop;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   basementFloorUV=vec2((position.x-(${bounds.min.x.toFixed(5)}))/${size.x.toFixed(5)},1.0-(position.z-(${bounds.min.z.toFixed(5)}))/${size.z.toFixed(5)});
   basementFloorTop=step(.5,normal.y);`);
  shader.fragmentShader='uniform sampler2D basementWear;\nvarying vec2 basementFloorUV;\nvarying float basementFloorTop;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 baseLight=diffuseColor.rgb;
   vec3 wear=texture2D(basementWear,basementFloorUV).rgb;
   diffuseColor.rgb*=mix(vec3(1.0),wear*7.0,basementFloorTop);
   float whiteTape=smoothstep(.65,.80,min(wear.r,min(wear.g,wear.b)))*basementFloorTop;
   vec3 tapeLight=mix(vec3(dot(baseLight,vec3(.2126,.7152,.0722))),baseLight,.25)*10.0;
   diffuseColor.rgb=mix(diffuseColor.rgb,tapeLight,whiteTape);`);
 };
 material.customProgramCacheKey=()=> 'basement-floor-wear-2';slab.material=material;
 if(!model.getObjectByName('Basement_ceiling_light_canopy')&&!model.getObjectByName('Basement ceiling light canopy')){
  const canopy=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.045,32),new THREE.MeshStandardMaterial({color:0x655332,roughness:.82,metalness:.15}));
  canopy.name='Basement ceiling light canopy';canopy.position.set(.8,3.805,-1);model.add(canopy);
 }
 // The dark inset sits below the rim and bars, without a glowing flat decal.
 const drain=new THREE.Group();drain.name='Basement floor drain';drain.position.set(1.55,.009,.12);model.add(drain);
 const metal=new THREE.MeshStandardMaterial({color:0x777e79,roughness:.82,metalness:.15});
 const dark=new THREE.MeshStandardMaterial({color:0x060909,roughness:1});
 const mesh=(geometry,mat,name)=>{const o=new THREE.Mesh(geometry,mat);o.name='Basement floor drain '+name;drain.add(o);return o;};
 mesh(new THREE.CylinderGeometry(.24,.24,.008,48),dark,'recess');
 const rim=mesh(new THREE.TorusGeometry(.235,.014,8,48),metal,'rim');rim.rotation.x=Math.PI/2;rim.position.y=.015;
 for(let i=-3;i<=3;i++){
  const x=i*.057,length=2*Math.sqrt(.213**2-x*x);
  const bar=mesh(new THREE.BoxGeometry(.023,.016,length),metal,'grate');bar.position.set(x,.017,0);
 }
 return {slab,drain,floorTexture};
}

// The original bake put area lights inside the windows, leaving bright wedges
// on the wall below the sills. Suppress that direct spill while retaining the
// painted wall texture and the room's indirect lighting.
export function shadeBasementWindowSpills(model,frames){
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/Basement[ _]painted[ _]masonry/.test(mesh.name))return;
  const shade=source=>{
   const material=source.clone();
   material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 cellarWallPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     cellarWallPosition=(modelMatrix*vec4(position,1.0)).xyz;`);
    const masks=frames.map((frame,i)=>{
     shader.uniforms['cellarWindow'+i]={value:new THREE.Vector4(frame.center.x,frame.center.y-frame.size.y/2,frame.center.z,frame.size.x/2)};
     shader.uniforms['cellarRight'+i]={value:frame.right};
     shader.uniforms['cellarNormal'+i]={value:frame.normal};
     return `{
      vec3 delta=cellarWallPosition-cellarWindow${i}.xyz;
      float below=-delta.y;
      float mask=(1.0-smoothstep(cellarWindow${i}.w,cellarWindow${i}.w+.12,abs(dot(delta,cellarRight${i}))))
       *step(0.0,below)*(1.0-smoothstep(.25,.55,below))
       *(1.0-smoothstep(.15,.30,abs(dot(delta,cellarNormal${i}))));
      diffuseColor.rgb=mix(diffuseColor.rgb,min(diffuseColor.rgb,vec3(.008,.015,.022)),mask);
     }`;
    }).join('\n');
    shader.fragmentShader='varying vec3 cellarWallPosition;\n'+frames.map((_,i)=>`uniform vec4 cellarWindow${i}; uniform vec3 cellarRight${i}; uniform vec3 cellarNormal${i};`).join('\n')+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+masks);
   };
   material.customProgramCacheKey=()=>`cellar-window-spill-${frames.length}`;
   return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(shade):shade(mesh.material);
 });
}
