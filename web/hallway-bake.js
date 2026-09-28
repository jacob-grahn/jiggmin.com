import * as THREE from 'three';

export const isHallwayConnection=name=>name.startsWith('Hall ceiling')||name.startsWith('Hall landing')||name==='Den shared wall extension';

// The atlas already contains surface color, direct light, and diffuse bounce.
// Basic materials prevent a second lighting/tone-mapping pass in the browser.
export function prepareHallwayBake(model){
 // The front pendant blocks the attic hatch and its pull cord.
 const frontFixture=[];
 model.traverse(mesh=>{if(/^(Brass[ _]shade|Opal[ _]lamp|Lamp[ _]stem)$/.test(mesh.name))frontFixture.push(mesh);});
 for(const mesh of frontFixture)mesh.removeFromParent();
 return prepareSurfaceBake(model,'hallway');
}

export function prepareSurfaceBake(model,room){
 const materials=new Map();let count=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.userData[room+'_baked'])return;
  const convert=source=>{
   if(!materials.has(source)){
    const map=source.emissiveMap??source.map;
    if(!map)throw Error(`${room} bake is missing its surface texture`);
    materials.set(source,new THREE.MeshBasicMaterial({name:`${room} UV baked lighting`,map,color:0xffffff,side:THREE.DoubleSide,toneMapped:false}));
   }
   return materials.get(source);
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(convert):convert(mesh.material);count++;
 });
 if(!count)throw Error(`${room} has no baked surfaces`);
 return count;
}
