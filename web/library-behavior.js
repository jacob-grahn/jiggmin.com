export const SHELF_SLOTS=Array.from({length:27},(_,i)=>({
 position:{x:-3.25+(i%9)*.13,y:.12+Math.floor(i/9)*.52,z:0},
 quaternion:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}
}));
export function shuffled(items,random=Math.random){
 const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
export class RestTimer {
 constructor(){this.elapsed=new Map();}
 clear(id){this.elapsed.delete(id);}
 update(id,dt,{resting,visible,excluded}){
  if(!resting||visible||excluded){this.clear(id);return false;}
  const time=(this.elapsed.get(id)||0)+dt;this.elapsed.set(id,time);return time>=5;
 }
}
export const ease=t=>t*t*(3-2*t);
export function zoomPoint([x,y],zoom){return [(x-.5)*zoom+.5,(y-.5)*zoom+.5];}

// Round-robin recovery checks, with no catch-up burst after a pause.
export class RecoveryQueue {
 constructor(){this.lastMoved=new Map();this.cursor=0;this.nextCheck=0;}
 touch(id,now){this.lastMoved.set(id,now);}
 moved(id,now){if(this.lastMoved.has(id))this.lastMoved.set(id,now);}
 defer(now){this.nextCheck=now+1;}
 next(ids,now,eligible=()=>true){
  if(now<this.nextCheck)return null;
  this.defer(now);
  for(let n=0;n<ids.length;n++){
   const index=this.cursor%ids.length,id=ids[index];this.cursor=(index+1)%ids.length;
   if(this.lastMoved.has(id)&&now-this.lastMoved.get(id)>=5&&eligible(id))return id;
  }
  return null;
 }
}
