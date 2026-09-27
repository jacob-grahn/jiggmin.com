import * as THREE from 'three';
import {addSurfacePatina} from './surface-patina.js';

// A closed clothbound book on the back-left library's top board.
export function createDenJournal(){
 const group=new THREE.Group(),meshes=[];
 group.name='Collected papers journal';
 group.position.set(-2.75,1.7175,.015);group.rotation.y=-.12;
 const cloth=addSurfacePatina(new THREE.MeshStandardMaterial({color:0x393c2c,roughness:.96}),{grain:.2,wear:.14});
 const paper=addSurfacePatina(new THREE.MeshStandardMaterial({color:0x8a8165,roughness:1}),{grain:.13,wear:.08});
 const spine=new THREE.MeshStandardMaterial({color:0x292d23,roughness:1});
 function box(size,position,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={prop:'journal',title:'Journal'};group.add(mesh);meshes.push(mesh);
 }
 box([.53,.013,.37],[0,.0065,0],cloth);
 box([.49,.049,.335],[.008,.0375,0],paper);
 box([.53,.013,.37],[0,.0685,0],cloth);
 box([.023,.075,.37],[-.2535,.0375,0],spine);
 // Fine page edges and a faded cloth bookmark keep the silhouette book-like.
 for(const y of [.024,.035,.047,.057])box([.487,.001,.001],[.008,y,.168],paper);
 box([.025,.002,.09],[.12,.015,.195],cloth);
 return {group,meshes};
}
