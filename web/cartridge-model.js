import * as THREE from 'three';

// Shared molded parts keep the detail inexpensive across the whole collection.
const shellMat=new THREE.MeshStandardMaterial({color:0x465353,roughness:.72});
const dark=new THREE.MeshStandardMaterial({color:0x11191a,roughness:.87});
const metal=new THREE.MeshStandardMaterial({color:0xc8a95c,metalness:.78,roughness:.31});
const pcb=new THREE.MeshStandardMaterial({color:0x24443b,roughness:.68});
const screw=new THREE.MeshStandardMaterial({color:0x53605f,metalness:.65,roughness:.5});
const outline=new THREE.Shape();
outline.moveTo(-.245,.052);outline.lineTo(-.205,.052);outline.lineTo(-.205,.025);outline.lineTo(.205,.025);outline.lineTo(.205,.052);outline.lineTo(.245,.052);outline.lineTo(.245,.425);outline.quadraticCurveTo(.245,.451,.22,.451);outline.lineTo(-.22,.451);outline.quadraticCurveTo(-.245,.451,-.245,.425);outline.closePath();
const half=new THREE.ExtrudeGeometry(outline,{depth:.056,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3,steps:1,curveSegments:6});
const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1);
function part(root,geometry,material,position,scale=[1,1,1]){
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function textFit(ctx,text,width,size){ctx.font=`bold ${size}px monospace`;while(ctx.measureText(text).width>width&&size>14)ctx.font=`bold ${--size}px monospace`;}
export async function remodelCartridge(root,game){
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/'+game.thumbnail.file;});
 // Remove the old plain shell, grips and labels as one replaceable model.
 const old=[];root.traverse(o=>{if(o.isMesh)old.push(o);});for(const o of old)o.removeFromParent();
 part(root,half,shellMat,[0,0,.007]);part(root,half,shellMat,[0,0,-.063]);
 part(root,box,dark,[0,.237,0],[.481,.426,.012]);
 // The inset label is surrounded by a molded lip and lower finger recesses.
 part(root,box,dark,[0,.25,.068],[.405,.335,.012]);
 const front=document.createElement('canvas');front.width=512;front.height=512;
 const f=front.getContext('2d');f.fillStyle='#d0cfb5';f.fillRect(0,0,512,512);f.fillStyle='#233533';f.fillRect(12,12,488,46);f.fillStyle='#dedbc3';f.font='20px monospace';f.fillText('J / 0 1   •   ARCHIVE',28,43);f.drawImage(image,24,80,464,232);f.fillStyle='#253a35';textFit(f,game.title,464,30);f.fillText(game.title,24,358);f.font='17px monospace';f.fillText('J I G G M I N',24,462);
 const map=new THREE.CanvasTexture(front);map.colorSpace=THREE.SRGBColorSpace;
 part(root,plane,new THREE.MeshStandardMaterial({map,roughness:.8}),[0,.25,.075],[.385,.313,1]);
 const spine=document.createElement('canvas');spine.width=128;spine.height=768;
 const c=spine.getContext('2d');c.fillStyle='#cac9ae';c.fillRect(0,0,128,768);
 c.drawImage(image,(image.width-image.height)/2,0,image.height,image.height,5,8,118,230);
 c.save();c.translate(80,728);c.rotate(-Math.PI/2);c.fillStyle='#203632';textFit(c,game.title,465,42);c.fillText(game.title,0,0);c.restore();
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
 // Recessed connector mouth, exposed board tongue, and individual gold contacts.
 part(root,box,dark,[0,.032,0],[.382,.036,.12]);
 part(root,box,pcb,[0,.017,0],[.354,.028,.032]);
 for(let i=0;i<18;i++)for(const sign of [-1,1])part(root,box,metal,[-.163+i*.019,.016,sign*.018],[.012,.024,.003]);
 return root;
}
