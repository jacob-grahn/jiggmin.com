import * as THREE from 'three';
import {travelEase} from './house-layout.js?v=house-reference-38';
export const MAX_TRAVEL_SPEED=1.8; // metres per second, including easing's peak
export const MAX_TURN_SPEED=THREE.MathUtils.degToRad(55);
const tracks=new WeakMap(),motions=new WeakMap();
const clamp=THREE.MathUtils.clamp;
const smooth=x=>travelEase(clamp(x,0,1));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function angles(direction){return {yaw:Math.atan2(-direction.x,-direction.z),pitch:Math.atan2(direction.y,Math.hypot(direction.x,direction.z))};}
function blend(a,b,t){return {yaw:a.yaw+angleDelta(a.yaw,b.yaw)*t,pitch:THREE.MathUtils.lerp(a.pitch,b.pitch,t)};}
function viewAngles(v){return angles(new THREE.Vector3(...v.target).sub(new THREE.Vector3(...v.position)));}
function headingTrack(route,hub,destination,id,reverse){
 let cache=tracks.get(route);if(!cache){cache=new Map();tracks.set(route,cache);}
 const key=JSON.stringify([id,reverse,hub,destination]);if(cache.has(key))return cache.get(key);
 const firstFlight=route.curves.find(c=>c.isLineCurve3&&c.getTangent(.5).y<-.2);
 const length=route.getLength(),count=Math.max(80,Math.ceil(length/.04)),start=viewAngles(hub),end=viewAngles(destination),raw=[];
 for(let i=0;i<=count;i++){
  const distance=i/count*length,t=distance/length,position=route.getPoint(t);
  let look=angles(route.getTangent(t).multiplyScalar(reverse?-1:1));
  // Look steadily into the first stair flight instead of following the
  // doorway's short lateral jog and then turning back again.
  if(id==='basement'&&!reverse&&position.y>.5){
   const firstFlightYaw=start.yaw+angleDelta(start.yaw,angles(firstFlight?.getTangent(.5)??new THREE.Vector3(0,0,1)).yaw),relative=start.yaw+angleDelta(start.yaw,look.yaw);
   look.yaw=clamp(relative,Math.min(firstFlightYaw,start.yaw),Math.max(firstFlightYaw,start.yaw));
  }
  look.pitch=clamp(look.pitch,id==='attic'?-.35:-.48,id==='attic'?.75:.35);
  if(!reverse&&id==='basement')look.pitch=THREE.MathUtils.lerp(look.pitch,Math.min(look.pitch,-.62),smooth((1.65-position.y)/.5)*(1-smooth((t-.72)/.11)));
  if(id==='attic')look=blend(look,angles(new THREE.Vector3(...destination.target).sub(position)),smooth((position.y-2.55)/.75));
  // The basement arrival and den doorway keep the room-facing view.
  // Keep looking into the room instead of following that leg's reversed tangent.
  if(id==='basement'||id==='den'){
   const turn=id==='basement'?length-Math.min(4,length*.3):(route.arrivalStart??length-2.5);
   if(distance>=turn)look=end;
   else if(distance>turn-1.6)look=blend(look,end,smooth((distance-turn+1.6)/1.6));
  }
  if(i)look.yaw=raw[i-1].yaw+angleDelta(raw[i-1].yaw,look.yaw);
  raw.push(look);
 }
 // Anticipate bends over a short distance, without a frame-rate-dependent lag.
 // Unwrapped angles avoid jumps across +/- pi; interpolation is deterministic
 // so scrubbing the preview and reverse travel use the same continuous view.
 const reach=Math.ceil(.75/length*count),sigma=.28/length*count,track=[];
 for(let i=0;i<=count;i++){
  let yaw=0,pitch=0,total=0;
  for(let j=-reach;j<=reach;j++){
   const weight=Math.exp(-.5*(j/sigma)**2),v=raw[clamp(i+j,0,count)];
   yaw+=v.yaw*weight;pitch+=v.pitch*weight;total+=weight;
  }
  track.push({yaw:yaw/total,pitch:pitch/total});
 }
 // Blend in a shared, unwrapped angular coordinate. Selecting a new shortest
 // arc every frame can flip its sign at 180 degrees and cause a sudden spin.
 const startYaw=track[0].yaw+angleDelta(track[0].yaw,start.yaw),endYaw=track[count].yaw+angleDelta(track[count].yaw,end.yaw);
 for(let i=0;i<=count;i++){
  const distance=i/count*length,departure=smooth(distance/Math.min(1.1,length*.4)),arrival=smooth((distance-length+Math.min(1.6,length*.4))/Math.min(1.6,length*.4));
  const look=track[i];look.yaw=THREE.MathUtils.lerp(startYaw,look.yaw,departure);look.pitch=THREE.MathUtils.lerp(start.pitch,look.pitch,departure);
  look.yaw=THREE.MathUtils.lerp(look.yaw,endYaw,arrival);look.pitch=THREE.MathUtils.lerp(look.pitch,end.pitch,arrival);
 }
 cache.set(key,track);return track;
}
function poseAtDistance(route,t,track){
 const index=t*(track.length-1),i=Math.min(track.length-2,Math.floor(index)),weight=index-i;
 const yaw=THREE.MathUtils.lerp(track[i].yaw,track[i+1].yaw,weight),pitch=THREE.MathUtils.lerp(track[i].pitch,track[i+1].pitch,weight);
 return {position:route.getPoint(t),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'))};
}
function motion(route,hub,destination,id,reverse){
 const track=headingTrack(route,hub,destination,id,reverse);
 let cache=motions.get(route);if(!cache){cache=new WeakMap();motions.set(route,cache);}if(cache.has(track))return cache.get(track);
 const length=route.getLength(),times=[0],count=track.length-1;
 const turnLimit=MAX_TURN_SPEED;
 let previous=poseAtDistance(route,0,track).quaternion;
 for(let i=1;i<=count;i++){
  const q=poseAtDistance(route,i/count,track).quaternion;
  // Slow for steering as well as tight geometry. Straight runs retain their
  // speed instead of making the entire route crawl to accommodate one bend.
  times.push(times[i-1]+Math.max(length/count/MAX_TRAVEL_SPEED*1.01,previous.angleTo(q)/turnLimit*1.05));previous=q;
 }
 const cruiseTime=times.at(-1),ramp=Math.min(.8,cruiseTime/2),duration=cruiseTime+ramp;
 const result={track,times,cruiseTime,ramp,duration};cache.set(track,result);return result;
}
function easedClock(elapsed,duration,ramp){
 if(elapsed>duration-ramp)return duration-ramp-easedClock(duration-elapsed,duration,ramp);
 if(elapsed>=ramp)return elapsed-ramp/2;
 const t=elapsed/ramp;
 // Integral of quintic velocity easing: zero acceleration at both ends.
 return ramp*t**4*(2.5-3*t+t*t);
}
export function travelPose(route,progress,hub,destination,id,reverse=false){
 const m=motion(route,hub,destination,id,reverse),time=easedClock(clamp(progress,0,1)*m.duration,m.duration,m.ramp);
 let low=0,high=m.times.length-1;
 while(high-low>1){const mid=(low+high)>>1;if(m.times[mid]<=time)low=mid;else high=mid;}
 const fraction=clamp((time-m.times[low])/(m.times[high]-m.times[low]),0,1);
 return poseAtDistance(route,(low+fraction)/(m.times.length-1),m.track);
}
export function travelDuration(route,hub,destination,id,reverse=false){return motion(route,hub,destination,id,reverse).duration*1000;}
