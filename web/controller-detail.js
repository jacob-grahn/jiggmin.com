import * as THREE from 'three';
import {addSurfacePatina,agePaper,seededRandom} from './surface-patina.js';

export function detailController(root){
 const dark=new THREE.MeshStandardMaterial({color:0x202a29,roughness:.87});
 const screw=addSurfacePatina(new THREE.MeshStandardMaterial({color:0x87928a,metalness:.7,roughness:.58}));
 const scuff=new THREE.MeshStandardMaterial({color:0x899385,roughness:.81});
 function part(geometry,material,position){const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.receiveShadow=true;root.add(m);return m;}
 // Small countersunk fasteners, with turned slots instead of four identical crosses.
 const random=seededRandom(101);
 for(const x of [-.38,.38])for(const z of [-.15,.16]){
  part(new THREE.CylinderGeometry(.012,.012,.0015,16),dark,[x,.181,z]);
  part(new THREE.CylinderGeometry(.008,.008,.002,12),screw,[x,.182,z]);
  const slot=part(new THREE.BoxGeometry(.010,.001,.0015),dark,[x,.1835,z]);slot.rotation.y=random()*Math.PI;
 }
 for(let i=0;i<16;i++){
  const x=(random()>.5?1:-1)*(.33+random()*.07),z=.17+random()*.02;
  const nick=part(new THREE.BoxGeometry(.004+random()*.012,.0006,.0009),scuff,[x,.181,z]);nick.rotation.y=random()*.4;
 }
 const label=document.createElement('canvas');label.width=512;label.height=256;const c=label.getContext('2d');
 c.fillStyle='#918f79';c.fillRect(0,0,512,256);c.fillStyle='#26352f';c.font='bold 30px monospace';c.fillText('J / 0 1',26,46);
 c.font='18px monospace';c.fillText('PERSONAL GAME CONTROLLER',26,80);c.fillText('MODEL 01   •   SERIAL 000028',26,116);c.fillText('MADE FOR LATE NIGHTS',26,224);
 for(let x=26;x<475;x+=5)c.fillRect(x,138,random()>.5?2:3,48);
 agePaper(c,512,256,101);const map=new THREE.CanvasTexture(label);map.colorSpace=THREE.SRGBColorSpace;
 const underside=part(new THREE.PlaneGeometry(.39,.19),new THREE.MeshStandardMaterial({map,roughness:.88}),[0,-.0015,0]);underside.rotation.x=Math.PI/2;
}
