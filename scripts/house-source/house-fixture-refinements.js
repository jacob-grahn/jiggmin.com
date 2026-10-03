import * as THREE from 'three';
import {connectBasementPipe} from './basement-pipe.js';
const nameOf=o=>(o.userData.house_bake_source??o.userData.source_object??o.name.replaceAll('_',' ')).replace(/\.?\d{3}$/,'');
const boxOf=o=>new THREE.Box3().setFromObject(o);
function owners(root){const result=[];root.traverse(o=>{if(o===root||nameOf(o.parent)===nameOf(o))return;result.push(o);});return result;}
function moveWorld(object,delta){const p=object.getWorldPosition(new THREE.Vector3()).add(delta);object.position.copy(object.parent.worldToLocal(p));object.updateMatrixWorld(true);}
function fixed(object){object.traverse(o=>{o.userData.bake_connection=true;});}
function visible(mesh){for(let o=mesh;o;o=o.parent)if(!o.visible)return false;return !mesh.userData.houseInk;}

export function fixtureAnchors(structure){
 structure.updateMatrixWorld(true);
 const supports=[];structure.traverse(o=>{if(o.isMesh&&/^Attic roof support$/.test(nameOf(o)))supports.push(boxOf(o));});
 return {supports};
}
export function turnOffCeilingFixtures(structure){
 if(structure.userData.review_fixtures_baked)return;
 structure.traverse(o=>{
  if(!/^(?:Finish \/ )?(Laundry light|Workshop overhead)/.test(nameOf(o)))return;
  if(o.isLight)o.intensity=0;
  if(o.isMesh){o.material=new THREE.MeshBasicMaterial({name:'Unlit ceiling fitting',color:0x394651,toneMapped:false});o.userData.houseOutlined=true;}
 });
}
export function refineRoomFixtures(model,room,{structure,supports=[]}={}){
 if(model.userData.review_fixtures_baked)return;
 model.updateMatrixWorld(true);const objects=owners(model);
 if(room==='basement'){
  const wall=objects.find(o=>nameOf(o)==='Basement painted masonry rear wall');
  if(wall)for(const pipe of objects.filter(o=>/^(Copper water pipe|Stored flexible hose)$/.test(nameOf(o)))){
   const b=boxOf(pipe),copper=nameOf(pipe)==='Copper water pipe';moveWorld(pipe,new THREE.Vector3(0,0,boxOf(wall).max.z+(copper?-.001:.003)-b.min.z));fixed(pipe);
   if(copper){
    const ceiling=objects.find(o=>nameOf(o)==='Basement ceiling');
    connectBasementPipe(pipe,wall,ceiling?boxOf(ceiling).min.y:-.2);
   }
  }
  for(const pencil of objects.filter(o=>nameOf(o)==='Pencil on ordinary paper'))pencil.removeFromParent();
 }
 if(room!=='attic')return;
 const junction=objects.find(o=>nameOf(o)==='Loose electrical junction box'),cover=objects.find(o=>nameOf(o)==='Misaligned junction cover');
 if(junction&&supports.length){
  const p=boxOf(junction).getCenter(new THREE.Vector3()),size=boxOf(junction).getSize(new THREE.Vector3());
  const post=[...supports].sort((a,b)=>a.getCenter(new THREE.Vector3()).distanceToSquared(p)-b.getCenter(new THREE.Vector3()).distanceToSquared(p))[0];
  const target=post.getCenter(new THREE.Vector3());target.y=THREE.MathUtils.clamp(p.y,post.min.y+size.y/2+.08,post.max.y-size.y/2-.08);target.z=post.max.z+size.z/2+.004;
  const delta=target.sub(p);moveWorld(junction,delta);fixed(junction);
  if(cover){moveWorld(cover,delta);const b=boxOf(junction),c=boxOf(cover),desired=b.getCenter(new THREE.Vector3());desired.z=b.max.z+c.getSize(new THREE.Vector3()).z/2+.001;moveWorld(cover,desired.sub(c.getCenter(new THREE.Vector3())));fixed(cover);}
 }
 const bulb=objects.find(o=>nameOf(o)==='Attic bare work bulb'),wire=objects.find(o=>nameOf(o)==='Bare bulb hanging wire');
 if(bulb?.isMesh&&wire?.isMesh){
  const center=boxOf(bulb).getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(center,new THREE.Vector3(0,1,0),.15,8);ray.layers.enableAll();ray.firstHitOnly=true;
  structure?.updateMatrixWorld(true);
  const hit=structure?ray.intersectObject(structure,true).find(h=>visible(h.object)):null;
  const roofY=hit?.point.y??7.2;
  const profile=[[0,-.105],[.028,-.100],[.054,-.072],[.065,-.028],[.058,.008],[.040,.040],[.026,.074],[.023,.090],[0,.090]].map(([r,y])=>new THREE.Vector2(r,y));
  bulb.geometry=new THREE.LatheGeometry(profile,24);bulb.geometry.translate(...center.toArray());bulb.geometry.applyMatrix4(bulb.matrixWorld.clone().invert());
  bulb.material=new THREE.MeshBasicMaterial({name:'Unlit pear-shaped bulb',color:0x697582,toneMapped:false});bulb.userData.houseOutlined=true;fixed(bulb);
  const bottom=center.y+.134,top=roofY-.003;
  wire.geometry=new THREE.CylinderGeometry(.008,.008,top-bottom,8);wire.geometry.translate(center.x,(top+bottom)/2,center.z);wire.geometry.applyMatrix4(wire.matrixWorld.clone().invert());
  wire.material=new THREE.MeshBasicMaterial({name:'Ceiling-attached bulb cord',color:0x161e24,toneMapped:false});wire.userData.houseOutlined=true;fixed(wire);
  const socket=new THREE.Mesh(new THREE.CylinderGeometry(.027,.025,.06,16),new THREE.MeshBasicMaterial({name:'Bulb socket',color:0x30363d,toneMapped:false}));
  socket.name='Attic bulb socket';socket.geometry.translate(center.x,center.y+.104,center.z);socket.geometry.applyMatrix4(model.matrixWorld.clone().invert());socket.userData={release_room:'attic',bake_connection:true,houseOutlined:true};model.add(socket);
 }
 // Bring two independent cartons forward and unstack them onto the plywood.
 for(const [name,x,z] of [['Attic utility carton',5.25,5.9],['Shifted smaller carton',7.2,6.0]]){
  const carton=objects.find(o=>nameOf(o)===name);if(!carton)continue;
  const b=boxOf(carton),p=b.getCenter(new THREE.Vector3());moveWorld(carton,new THREE.Vector3(x-p.x,3.055-b.min.y,z-p.z));
 }
}
