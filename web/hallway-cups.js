import * as THREE from 'three';
import {PropSpring} from './prop-reactions.js';

export const CUP_COUNT=10;
export const CUP_FLOOR_Y=.012;
// The baked "Rear hall window spill", converted from Blender's Z-up axes.
export const CUP_WINDOW_LIGHT=new THREE.Vector3(5.55,1.35,-.18);
const HEIGHT=.27,RADIUS=.115,BALL_Y=CUP_FLOOR_Y+.052,CENTER=new THREE.Vector3(5.55,CUP_FLOOR_Y+HEIGHT/2,2.9);
const smooth=t=>t*t*(3-2*t);
export function cupLayout(count){
 const rowCount=Math.ceil(count/4),rows=Array.from({length:rowCount},(_,row)=>Math.floor(count/rowCount)+(row<count%rowCount?1:0));
 return rows.flatMap((n,row)=>Array.from({length:n},(_,i)=>new THREE.Vector3(CENTER.x+(i-(n-1)/2)*.285,CENTER.y,CENTER.z-row*.72)));
}
export function cupPyramid(){
 return [4,3,2,1].flatMap((n,row)=>Array.from({length:n},(_,i)=>new THREE.Vector3(CENTER.x+(i-(n-1)/2)*.245,CENTER.y+row*HEIGHT,CENTER.z)));
}
function atlasUV(geometry,right=false){
 const uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(right?.505:.005)+uv.getX(i)*.49,.005+uv.getY(i)*.99);
 return geometry;
}
function metalCupGeometry(){
 // The reference's inverted conjuring cup: narrow closed top, tapered body,
 // and a broad straight skirt with a rolled shoulder and lower bead.
 const profile=[
  [0,.27],[.068,.27],[.071,.266],[.100,.065],[.104,.060],
  [.112,.058],[.115,.054],[.116,.049],[.116,.008],[.113,0],
  [.107,0],[.106,.008],[.106,.047],[.100,.052],[.065,.258],[0,.258],
 ].reverse().map(([r,y])=>new THREE.Vector2(r,y-HEIGHT/2));
 const geometry=new THREE.LatheGeometry(profile,64),p=geometry.attributes.position,uv=geometry.attributes.uv;
 geometry.normalizeNormals();
 // The reversed profile starts at the inner ceiling and runs down the inner wall.
 // Keep those faces dark, including when a finished cup is thrown upside down.
 const edges=profile.length-1,inner=[],outer=[],indices=geometry.index.array;
 for(let segment=0;segment<64;segment++){
  const start=segment*edges*6;
  inner.push(...indices.slice(start,start+5*6));
  outer.push(...indices.slice(start+5*6,start+edges*6));
 }
 geometry.setIndex([...inner,...outer]);
 geometry.addGroup(0,inner.length,1);geometry.addGroup(inner.length,outer.length,0);
 // Keep the skirt's patina aligned to its physical height, independent of
 // how many vertices are used to model the rolled edges.
 for(let i=0;i<p.count;i++)uv.setY(i,(p.getY(i)+HEIGHT/2)/HEIGHT);
 return atlasUV(geometry);
}

function windowMaterial(texture,color,metallic=false){
 return new THREE.ShaderMaterial({name:metallic?'Old scratched pewter cups':'Red woven ball',lights:true,toneMapped:false,
  uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,{map:{value:texture},diffuse:{value:new THREE.Color(color)},windowPosition:{value:CUP_WINDOW_LIGHT},opacity:{value:1}}]),
  vertexShader:THREE.ShaderLib.shadow.vertexShader
   .replace('#include <common>','varying vec2 cupUV;\nvarying vec3 cupNormal;\nvarying vec3 cupWorld;\n#include <common>')
   .replace('#include <begin_vertex>','#include <begin_vertex>\ncupUV=uv;')
   .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ncupWorld=(modelMatrix*vec4(transformed,1.)).xyz;cupNormal=normalize(mat3(modelMatrix)*normal);'),
  fragmentShader:THREE.ShaderLib.shadow.fragmentShader
   .replace('uniform vec3 color;','uniform vec3 diffuse;\nuniform sampler2D map;\nuniform vec3 windowPosition;\nvarying vec2 cupUV;\nvarying vec3 cupNormal;\nvarying vec3 cupWorld;')
   .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',`
    vec4 texel=texture2D(map,cupUV);
    vec3 N=normalize(cupNormal),L=normalize(windowPosition-cupWorld),V=normalize(cameraPosition-cupWorld);
    float lit=max(dot(N,L),0.),shadow=getShadowMask();
    vec3 surface=texel.rgb*diffuse*(.46+.62*lit*shadow);
    ${metallic?`
    vec3 H=normalize(L+V);
    float reflection=pow(max(dot(N,H),0.),28.);
    // The finite window aperture gives a broad, cool glint along backlit edges.
    float backlight=smoothstep(.2,.75,-dot(L,V));
    float rim=pow(1.-abs(dot(N,V)),3.)*backlight;
    surface+=vec3(.65,.78,1.)*(reflection*.38*shadow+rim*.65*mix(.65,1.,shadow));`:''}
    gl_FragColor=vec4(surface,opacity*texel.a);`),
 });
}

export function createHallwayCups(scene,system,{texture,random=Math.random}={}){
 const stage=new THREE.Group();stage.name='Rear hall cups and ball';scene.add(stage);
 const metal=windowMaterial(texture,0xdbe1e8,true);
 const wool=windowMaterial(texture,0xe8c6ca);
 const cupGeometry=metalCupGeometry();
 const cupMaterials=[metal,new THREE.MeshBasicMaterial({name:'Black cup interior',color:0x020203})];
 const cups=Array.from({length:CUP_COUNT},()=>new THREE.Mesh(cupGeometry,cupMaterials));
 const ball=new THREE.Mesh(atlasUV(new THREE.SphereGeometry(.052,32,24),true),wool);
 const objects=[...cups,ball],props=[];
 objects.forEach((mesh,i)=>{
  const root=new THREE.Group();root.name=i<CUP_COUNT?`Old metal cup ${i+1}`:'Red woven ball';root.add(mesh);stage.add(root);
  root.position.copy(i<3?cupLayout(3)[i]:CENTER);if(i===CUP_COUNT)root.position.set(CENTER.x,BALL_Y,CENTER.z+.3424);
  root.visible=i<3||i===CUP_COUNT;
  const size=i<CUP_COUNT?new THREE.Vector3(RADIUS*2,HEIGHT,RADIUS*2):new THREE.Vector3(.104,.104,.104);
  const prop={id:`hallway-cups-${i}`,root,title:root.name,size,mode:'game',rest:root.quaternion.clone(),spring:new PropSpring(12,3.5,.11),home:root.position.clone(),localBounds:new THREE.Box3(size.clone().multiplyScalar(-.5),size.clone().multiplyScalar(.5)),onPress:()=>press(i)};
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.houseProp=prop;props.push(prop);system.props.push(prop);
  system.physics.add(prop.id,{position:root.position,quaternion:root.quaternion},{size:size.toArray(),shape:i===CUP_COUNT?'sphere':'box',center:{x:0,y:0,z:0},mass:i===CUP_COUNT?.08:.22});
  system.physics.pin(prop.id,{position:root.position,quaternion:root.quaternion});
 });
 // One room-owned shadow map; the existing baked floor stays intact beneath it.
 const shadowLight=new THREE.DirectionalLight(0xc9dbed,0);
 shadowLight.name='Rear hall cup shadow light';shadowLight.position.copy(CUP_WINDOW_LIGHT);
 shadowLight.target.position.set(CENTER.x,CUP_FLOOR_Y,CENTER.z);shadowLight.castShadow=true;
 shadowLight.shadow.mapSize.set(512,512);shadowLight.shadow.bias=-.0002;
 shadowLight.shadow.normalBias=.003;shadowLight.shadow.radius=2;
 Object.assign(shadowLight.shadow.camera,{left:-1.5,right:1.5,top:4,bottom:-4,near:.1,far:12});
 shadowLight.shadow.camera.updateProjectionMatrix();stage.add(shadowLight,shadowLight.target);
 const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(1.48,6.76),new THREE.ShadowMaterial({color:0x080b12,opacity:.75,depthWrite:false}));
 shadowFloor.name='Rear hall floor shadow overlay';shadowFloor.rotation.x=-Math.PI/2;
 shadowFloor.position.set(5.55,CUP_FLOOR_Y+.002,3.4);shadowFloor.receiveShadow=true;shadowFloor.raycast=()=>{};stage.add(shadowFloor);
 const puff=new THREE.Group();puff.name='Odd little confetti poof';stage.add(puff);
 const confetti=Array.from({length:45},(_,i)=>{
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.018+(i%3)*.01,.018),new THREE.MeshBasicMaterial({color:[0xef665c,0xe8bf55,0x80b8a3,0xa79bcc,0xe4dacb][i%5],side:THREE.DoubleSide}));
  m.raycast=()=>{};m.visible=false;puff.add(m);
  return {mesh:m,velocity:new THREE.Vector3((random()-.5)*.85,.35+random()*.75,(random()-.5)*.85),spin:random()*9};
 });
 let count=3,phase='idle',time=0,winner=0,selected=0,swapIndex=0,swaps,nestedOrigin,puffOrigin;
 let order=cupLayout(count),starts;
 const setPhase=value=>{phase=value;time=0;};
 function pin(){for(const p of props)system.physics.pin(p.id,{position:p.root.position,quaternion:p.root.quaternion});}
 function begin(){
  winner=Math.floor(random()*count);order=cupLayout(count);starts=cups.slice(0,count).map(m=>m.parent.position.clone());
  ball.parent.visible=true;setPhase('reveal');
 }
 function nextSwap(){
  const indices=Array.from({length:count},(_,i)=>i);
  for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
  const pairs=count===10?5:count>8?3:count>4?2:1;
  swaps=Array.from({length:pairs},(_,i)=>{
   const a=indices[i*2],b=indices[i*2+1],fromA=order[a].clone(),fromB=order[b].clone();
   const direction=fromB.clone().sub(fromA).normalize();
   return {a,b,fromA,fromB,arc:new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar(.14)};
  });setPhase('shuffle');
 }
 function press(i){
  if(phase==='done'||!objects[i].parent.visible)return;
  if(phase==='idle'){begin();return;}
  if(phase!=='choose'||i===CUP_COUNT)return;
  selected=i;ball.parent.visible=true;ball.parent.position.copy(order[winner]);ball.parent.position.y=BALL_Y;
  if(i===winner){
   nestedOrigin=order[winner].clone();
   puffOrigin=nestedOrigin.clone();puffOrigin.y+=.4;
   if(count<CUP_COUNT){cups[count].parent.visible=false;cups[count].parent.position.copy(nestedOrigin);}
   setPhase('win');
  }else setPhase('miss');
 }
 function update(dt,reduced=false){
  if(phase==='idle'||phase==='choose'||phase==='done')return {changed:false,animating:false};
  time+=dt;const duration=reduced?.18:phase==='shuffle'?.85*Math.pow(.96,count-3):.85,t=Math.min(1,time/duration),e=smooth(t);
  if(phase==='reveal'){
   const target=order[winner].clone();target.y=BALL_Y;ball.parent.position.lerp(target,.15);
   cups.slice(0,count).forEach((m,i)=>{m.parent.position.lerpVectors(starts[i],order[i],e);if(i===winner)m.parent.position.y+=Math.sin(t*Math.PI)*.34;});
   if(t===1){ball.parent.position.copy(target);setPhase('cover');}
  }else if(phase==='cover'){
   // A beat with all cups down before the ball disappears and the shuffle begins.
   if(time>.35){ball.parent.visible=false;swapIndex=0;nextSwap();}
  }else if(phase==='shuffle'){
   for(const {a,b,fromA,fromB,arc} of swaps){
    cups[a].parent.position.lerpVectors(fromA,fromB,e);cups[b].parent.position.lerpVectors(fromB,fromA,e);
    const bend=reduced?0:Math.sin(t*Math.PI);
    cups[a].parent.position.addScaledVector(arc,bend);cups[b].parent.position.addScaledVector(arc,-bend);
   }
   if(t===1){
    for(const {a,b} of swaps)[order[a],order[b]]=[order[b],order[a]];
    if(++swapIndex>=count+2)setPhase('choose');else nextSwap();
   }
  }else if(phase==='miss'){
   cups[selected].parent.position.y=CENTER.y+e*.32;cups[winner].parent.position.y=CENTER.y+e*.32;
   if(time>1.7)setPhase('idle');
  }else if(phase==='win'){
   const lift=smooth(Math.min(1,time/(reduced?.18:.65)));
   cups[winner].parent.position.copy(nestedOrigin);cups[winner].parent.position.y+=lift*.36;
   confetti.forEach(({mesh,velocity,spin},i)=>{
    mesh.visible=time<1.6;const age=time;
    mesh.position.copy(puffOrigin).addScaledVector(velocity,age);mesh.position.y-=.5*age*age;
    mesh.rotation.set(age*spin,i+age*3,age*spin*.7);mesh.scale.setScalar(Math.max(0,1-age/1.6));
   });
   if(count<CUP_COUNT){
    // Reveal the second cup in place, as if it had been nested inside the winner.
    // The upper cup moves aside; the newly revealed cup stays on the floor.
    cups[count].parent.visible=lift*.36>.035;
    const end=nestedOrigin.clone();end.z+=.4;
    const aside=smooth(Math.min(1,Math.max(0,(time-.9)/.85)));
    const raised=nestedOrigin.clone();raised.y+=.36;
    cups[winner].parent.position.lerpVectors(raised,end,aside);
    if(time<.9)cups[winner].parent.position.y=nestedOrigin.y+lift*.36;
   }
   if(time>1.9){
    confetti.forEach(p=>p.mesh.visible=false);
    if(count<CUP_COUNT){count++;begin();}else{starts=cups.map(m=>m.parent.position.clone());setPhase('stack');}
   }
  }else if(phase==='stack'){
   const pyramid=cupPyramid();cups.forEach((m,i)=>{m.parent.position.lerpVectors(starts[i],pyramid[i],e);m.parent.position.y+=reduced?0:Math.sin(t*Math.PI)*.2;});
   ball.parent.position.lerp(new THREE.Vector3(CENTER.x+.56,BALL_Y,CENTER.z+.25),e);
   if(t===1){
    for(const p of props){p.mode='throw';p.onPress=undefined;p.home.copy(p.root.position);system.physics.pin(p.id,{position:p.root.position,quaternion:p.root.quaternion},{releaseOnContact:true});}
    setPhase('done');return {changed:true,animating:false};
   }
  }
  pin();return {changed:true,animating:true};
 }
 const baseUpdate=system.update.bind(system);
 system.update=(dt,reduced)=>{const base=baseUpdate(dt,reduced),game=update(dt,reduced);return {changed:base.changed||game.changed,animating:base.animating||game.animating};};
 return {root:stage,props,press,update,shadowLight,shadowFloor,dispose(){shadowLight.shadow.dispose();},get state(){return {phase,count,winner};}};
}
