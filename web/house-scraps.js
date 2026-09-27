import * as THREE from 'three';

export function createHiddenScraps(props,camera,scene,collected){
 const scraps=new Map(),paper=new THREE.MeshStandardMaterial({color:0xdfd0a9,roughness:1,side:THREE.DoubleSide});
 for(const prop of props){
  if(!prop.hotspot||collected.has(prop.hotspot))continue;
  const behind=prop.home.clone().sub(camera.position).normalize();
  const depth=Math.abs(behind.x)*prop.size.x/2+Math.abs(behind.y)*prop.size.y/2+Math.abs(behind.z)*prop.size.z/2;
  const geometry=new THREE.PlaneGeometry(.16,.22,2,2);
  const vertices=geometry.attributes.position;
  for(let i=0;i<vertices.count;i++)vertices.setZ(i,Math.sin(vertices.getX(i)*30)*.008);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,paper);mesh.name=`Hidden paper: ${prop.hotspot}`;
  mesh.position.copy(prop.home).addScaledVector(behind,depth+.006);mesh.quaternion.copy(camera.quaternion);scene.add(mesh);
  scraps.set(prop.hotspot,{mesh,prop});
 }
 return scraps;
}
