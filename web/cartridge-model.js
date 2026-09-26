import * as THREE from 'three';
import {addSurfacePatina,agePaper,seededRandom} from './surface-patina.js';

// Shared molded parts keep the detail inexpensive across the whole collection.
const shellMat=new THREE.MeshStandardMaterial({color:0x465353,roughness:.72});
const dark=new THREE.MeshStandardMaterial({color:0x11191a,roughness:.87});
const metal=new THREE.MeshStandardMaterial({color:0xc8a95c,metalness:.78,roughness:.31});
const pcb=new THREE.MeshStandardMaterial({color:0x24443b,roughness:.68});
const screw=new THREE.MeshStandardMaterial({color:0x53605f,metalness:.65,roughness:.5});
for(const mat of [shellMat,dark,metal,pcb,screw])addSurfacePatina(mat);
const rub=new THREE.MeshStandardMaterial({color:0x66716b,roughness:.86});
const outline=new THREE.Shape();
outline.moveTo(-.245,.052);outline.lineTo(-.205,.052);outline.lineTo(-.205,.025);outline.lineTo(.205,.025);outline.lineTo(.205,.052);outline.lineTo(.245,.052);outline.lineTo(.245,.425);outline.quadraticCurveTo(.245,.451,.22,.451);outline.lineTo(-.22,.451);outline.quadraticCurveTo(-.245,.451,-.245,.425);outline.closePath();
const half=new THREE.ExtrudeGeometry(outline,{depth:.056,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3,steps:1,curveSegments:6});
const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1);
function part(root,geometry,material,position,scale=[1,1,1]){
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function textFit(ctx,text,width,size){ctx.font=`bold ${size}px monospace`;while(ctx.measureText(text).width>width&&size>14)ctx.font=`bold ${--size}px monospace`;}
// Keep shelf lettering large; shorten names instead of shrinking long titles.
const spineTitles={
 'platform-racing':'Platform R.', 'platform-racing-2':'Platform R. 2', 'platform-racing-3':'Platform R. 3',
 'the-great-red-herring-chase':'Red Herring', 'neverending-light':'Neverending',
 'musical-evenizer':'Evenizer', 'uber-space-shooter':'Space Shooter',
 'kongregate-racing':'Kong Racing', 'beat-master-3000':'Beat Master',
 'click-upon-dots':'Click Dots', 'the-game-of-disorientation':'Disorientation',
 'uber-breakout':'U. Breakout', 'uber-breakout-2':'U. Breakout II',
 'kimblis-the-blue':'Kimblis'
};
export async function remodelCartridge(root,game){
 const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/'+src;});
 const image=await loadImage(game.thumbnail.file);
 const label=game.cartridgeLabel?await loadImage(game.cartridgeLabel.file).catch(()=>null):null;
 // Remove the old plain shell, grips and labels as one replaceable model.
 const old=[];root.traverse(o=>{if(o.isMesh)old.push(o);});for(const o of old)o.removeFromParent();
 const seed=[...game.id].reduce((s,c)=>s*31+c.charCodeAt(0),7)>>>0;
 const broken=game.gameplay?.mode==='broken';
 const brokenShape=new THREE.Shape();brokenShape.moveTo(-.245,.052);for(const [x,y] of [[.245,.052],[.245,.34],[.204,.355],[.228,.382],[.198,.407],[.221,.451],[-.22,.451],[-.245,.425]])brokenShape.lineTo(x,y);brokenShape.closePath();
 const shell=broken?new THREE.ExtrudeGeometry(brokenShape,{depth:.056,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,steps:1}):half.clone(),vertices=shell.attributes.position,corner=seed%2?-.235:.235;
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),dent=Math.exp(-((x-corner)**2+(y-.421)**2)/.00035)*.003;
  vertices.setX(i,x-Math.sign(corner)*dent);
 }
 shell.computeVertexNormals();
 part(root,shell,shellMat,[0,0,.007]);part(root,shell,shellMat,[0,0,-.063]);
 part(root,box,dark,[0,.237,0],[.481,.426,.012]);
 // The inset label is surrounded by a molded lip and lower finger recesses.
 part(root,box,dark,[0,.25,.068],[.405,.335,.012]);
 const front=document.createElement('canvas');front.width=512;front.height=512;
 const f=front.getContext('2d');f.fillStyle='#d0cfb5';f.fillRect(0,0,512,512);f.fillStyle='#233533';f.fillRect(12,12,488,46);f.fillStyle='#dedbc3';f.font='20px monospace';f.fillText('J / 0 1   •   ARCHIVE',28,43);f.drawImage(image,24,80,464,232);f.fillStyle='#253a35';textFit(f,game.title,464,30);f.fillText(game.title,24,358);f.font='17px monospace';f.fillText('J I G G M I N',24,462);
 // Finished artwork fills the inset; the original thumbnail remains on the spine.
 if(label)f.drawImage(label,0,0,512,512);
 agePaper(f,512,512,seed);
 if(broken){f.save();f.translate(256,395);f.rotate(-.13);f.fillStyle='#b5a55e';f.fillRect(-256,-29,512,58);f.fillStyle='#282c22';f.font='italic 46px "Bradley Hand", "Comic Sans MS", cursive';f.textAlign='center';f.fillText('broken',0,15);f.restore();}

 const map=new THREE.CanvasTexture(front);map.colorSpace=THREE.SRGBColorSpace;
 part(root,plane,new THREE.MeshStandardMaterial({map,roughness:.8}),[0,.25,.075],[.385,.313,1]);
 const spine=document.createElement('canvas');spine.width=128;spine.height=768;
 const c=spine.getContext('2d');c.fillStyle='#cac9ae';c.fillRect(0,0,128,768);
 c.drawImage(image,(image.width-image.height)/2,0,image.height,image.height,5,8,118,230);
 c.save();c.translate(64,738);c.rotate(-Math.PI/2);c.fillStyle='#172b28';
 c.font='bold 64px Arial, sans-serif';c.textBaseline='middle';
 let spineTitle=spineTitles[game.id]||game.title;
 // Future catalog entries also retain the same readable font size.
 if(c.measureText(spineTitle).width>438){while(spineTitle.length&&c.measureText(spineTitle+'…').width>438)spineTitle=spineTitle.slice(0,-1);spineTitle=spineTitle.trimEnd()+'…';}
 c.fillText(spineTitle,0,0);c.restore();
 agePaper(c,128,768,seed+1);
 if(broken){c.fillStyle='#b5a55e';c.fillRect(0,242,128,55);c.fillStyle='#282c22';c.font='italic 27px "Bradley Hand", "Comic Sans MS", cursive';c.fillText('broken',10,278);}
 const texture=new THREE.CanvasTexture(spine);texture.colorSpace=THREE.SRGBColorSpace;
 const labelMat=new THREE.MeshStandardMaterial({map:texture,roughness:.8});
 for(const sign of [-1,1]){
  const label=part(root,plane,labelMat,[sign*.25,.254,0],[.116,.354,1]);label.rotation.y=sign*Math.PI/2;label.castShadow=false;
  // Raised grip ribs, with dark recessed channels between them.
  for(let i=0;i<6;i++)part(root,box,shellMat,[sign*.222,.102+i*.044,.074],[.025,.013,.013]);
  for(const y of [.074,.417]){
   const recess=part(root,new THREE.CylinderGeometry(.015,.015,.004,12),dark,[sign*.176,y,-.068]);recess.rotation.x=Math.PI/2;
   const head=part(root,new THREE.CylinderGeometry(.009,.009,.003,10),screw,[sign*.176,y,-.071]);head.rotation.x=Math.PI/2;
   part(root,box,dark,[sign*.176,y,-.073],[.012,.002,.002]);
  }
 }
 if(broken){
  root.userData.title=game.title+' · damaged';
  const fracture=new THREE.MeshStandardMaterial({color:0x090e0f,roughness:1});
  const points=[[-.20,.43],[-.11,.36],[-.14,.32],[-.02,.24],[.01,.18],[.15,.09]];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];const crack=part(root,box,fracture,[(a[0]+b[0])/2,(a[1]+b[1])/2,.077],[.004,Math.hypot(dx,dy),.002]);crack.rotation.z=-Math.atan2(dx,dy);}
 }
 // Small edge nicks are geometry, so they catch light as the cartridge tumbles.
 const random=seededRandom(seed);
 for(let i=0;i<10;i++){
  const sign=random()>.5?1:-1,y=.095+random()*.31;
  const chip=part(root,box,rub,[sign*.24,y,.068],[.004+random()*.007,.0008+random()*.001,.001]);chip.rotation.z=(random()-.5)*.25;chip.castShadow=false;
 }
 const back=document.createElement('canvas');back.width=256;back.height=128;const b=back.getContext('2d');
 b.fillStyle='#66756f';b.fillRect(0,0,256,128);b.fillStyle='#263733';b.font='11px monospace';b.fillText('J / 0 1   GAME ARCHIVE',12,24);b.fillText('KEEP CONTACTS CLEAN',12,44);b.fillText('DO NOT OPEN • '+String(seed%100000).padStart(5,'0'),12,110);
 for(let x=14;x<240;x+=3){b.fillRect(x,59,random()>.5?1:2,29);}
 agePaper(b,256,128,seed+2);const backMap=new THREE.CanvasTexture(back);backMap.colorSpace=THREE.SRGBColorSpace;
 const backLabel=part(root,plane,new THREE.MeshStandardMaterial({map:backMap,roughness:.92}),[0,.245,-.071],[.29,.145,1]);backLabel.rotation.y=Math.PI;
 // Recessed connector mouth, exposed board tongue, and individual gold contacts.
 part(root,box,dark,[0,.032,0],[.382,.036,.12]);
 part(root,box,pcb,[0,.017,0],[.354,.028,.032]);
 for(let i=0;i<18;i++)for(const sign of [-1,1])part(root,box,metal,[-.163+i*.019,.016,sign*.018],[.012,.024,.003]);
 return root;
}
