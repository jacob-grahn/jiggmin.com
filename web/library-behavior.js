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
 update(id,dt,{resting,supported,excluded}){
  if(!resting||supported||excluded){this.clear(id);return false;}
  const time=(this.elapsed.get(id)||0)+dt;this.elapsed.set(id,time);return time>=5;
 }
}
export const ease=t=>t*t*(3-2*t);
export function zoomPoint([x,y],zoom){return [(x-.5)*zoom+.5,(y-.5)*zoom+.5];}
