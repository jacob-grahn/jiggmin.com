import * as THREE from 'three';

// Exact damped spring integration: repeated taps add an impulse without jumping
// the pose, and frame stalls cannot make the spring unstable.
export class PropSpring {
 constructor(frequency=15,damping=4,limit=.075){Object.assign(this,{frequency,damping,limit,angle:0,velocity:0});}
 kick(impulse){this.velocity=THREE.MathUtils.clamp(this.velocity+impulse,-.9,.9);}
 step(dt){
  if(!this.angle&&!this.velocity)return false;
  const t=Math.max(0,dt),w=Math.sqrt(this.frequency**2-this.damping**2),decay=Math.exp(-this.damping*t),c=Math.cos(w*t),s=Math.sin(w*t),a=this.angle,v=this.velocity;
  this.angle=decay*(a*c+(v+this.damping*a)/w*s);
  this.velocity=decay*(v*c-(this.damping*v+this.frequency**2*a)/w*s);
  if(Math.abs(this.angle)>this.limit){this.angle=Math.sign(this.angle)*this.limit;this.velocity*=.25;}
  if(Math.abs(this.angle)<.00008&&Math.abs(this.velocity)<.0008)this.angle=this.velocity=0;
  return true; // Also draw the final frame at the exact rest pose.
 }
 reset(){this.angle=this.velocity=0;}
}
const personalities={
 mug:{title:'Late-night coffee',frequency:22,damping:5.5,limit:.045,impulse:.52},
 plant:{title:'Pothos',frequency:10,damping:2.7,limit:.065,impulse:.48},
 lamp:{title:'Reading lamp',frequency:15,damping:4,limit:.023,impulse:.28}
};
export function createPropReactions(meshes){
 const entries=new Map(meshes.map(mesh=>{
  const p=personalities[mesh.userData.prop],roll=new PropSpring(p.frequency,p.damping,p.limit),pitch=new PropSpring(p.frequency*1.13,p.damping,p.limit*.6);
  mesh.userData.title=p.title;return [mesh,{p,roll,pitch,rest:mesh.quaternion.clone()}];
 }));
 const tilt=new THREE.Quaternion(),euler=new THREE.Euler();
 return {
  kick(mesh,point,reducedMotion=false){
   const entry=entries.get(mesh);if(!entry)return false;
   if(!reducedMotion){const direction=point.x<mesh.getWorldPosition(new THREE.Vector3()).x?1:-1;entry.roll.kick(direction*entry.p.impulse);entry.pitch.kick(entry.p.impulse*.3);}
   return true;
  },
  update(dt,reducedMotion=false){
   let changed=false;
   for(const [mesh,e] of entries){
    if(reducedMotion){if(e.roll.angle||e.pitch.angle||e.roll.velocity||e.pitch.velocity){e.roll.reset();e.pitch.reset();mesh.quaternion.copy(e.rest);changed=true;}continue;}
    const roll=e.roll.step(dt),pitch=e.pitch.step(dt);if(!roll&&!pitch)continue;
    tilt.setFromEuler(euler.set(e.pitch.angle,0,e.roll.angle));mesh.quaternion.copy(e.rest).multiply(tilt);changed=true;
   }
   return changed;
  }
 };
}
