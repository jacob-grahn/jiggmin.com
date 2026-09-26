// Object-space grain follows the object when it moves, even on meshes without UVs.
// The shader adds no texture downloads and preserves each model's existing artwork.
export function addSurfacePatina(material,{grain=.065,wear=.035}={}){
 if(!material.isMeshStandardMaterial||material.userData.patina)return material;
 material.userData.patina=true;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 patinaPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npatinaPosition=position;');
  shader.fragmentShader=`varying vec3 patinaPosition;
   float patinaHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float patinaNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(patinaHash(i),patinaHash(i+vec3(1,0,0)),f.x),mix(patinaHash(i+vec3(0,1,0)),patinaHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(patinaHash(i+vec3(0,0,1)),patinaHash(i+vec3(1,0,1)),f.x),mix(patinaHash(i+vec3(0,1,1)),patinaHash(i+vec3(1,1,1)),f.x),f.y),f.z);
   }\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float micrograin=patinaNoise(patinaPosition*280.0)-.5;
   float handwear=patinaNoise(patinaPosition*vec3(16.,34.,21.))-.5;
   diffuseColor.rgb*=1.0+micrograin*${grain.toFixed(4)}+handwear*${wear.toFixed(4)};`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+micrograin*.1-handwear*.09,.12,1.);`);
 };
 material.customProgramCacheKey=()=>`patina-${grain}-${wear}`;material.needsUpdate=true;return material;
}
export function seededRandom(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function agePaper(ctx,width,height,seed){
 const random=seededRandom(seed);ctx.save();
 for(let i=0;i<1500;i++){
  ctx.fillStyle=random()>.5?'rgba(71,56,26,.08)':'rgba(255,248,205,.10)';const size=random()*1.6+.3;ctx.fillRect(random()*width,random()*height,size,size);
 }
 // Lightly rubbed edges; keep the titles and artwork legible.
 const border=ctx.createLinearGradient(0,0,width,0);border.addColorStop(0,'#77664b77');border.addColorStop(.025,'#77664b00');border.addColorStop(.975,'#77664b00');border.addColorStop(1,'#77664b77');ctx.fillStyle=border;ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='rgba(234,226,192,.35)';ctx.lineWidth=.8;
 for(let i=0;i<14;i++){const x=random()*width,y=random()*height;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*18,y+random()*2);ctx.stroke();}
 ctx.fillStyle='#d8d1b8';
 for(const [x,y,sx,sy] of [[0,0,1,1],[width,height,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+sx*(2+random()*4),y);ctx.lineTo(x,y+sy*(3+random()*5));ctx.fill();}
 ctx.restore();
}
