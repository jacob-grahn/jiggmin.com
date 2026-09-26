import {TouchKeys,joystickKeys,sendRuffleKey} from './touch-input.js?v=profiles-1';
import {VirtualPointer} from './virtual-pointer.js';
const DEFAULT={stick:'arrows',a:['Space'],b:['Space']};
const label=keys=>keys.length?keys.map(k=>({Space:'SPACE',MouseLeft:'CLICK',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',ShiftLeft:'SHIFT'}[k]||k.replace(/^Key|^Digit/,''))).join('+'):'—';
export function createMobileController({getPlayer,getAspect=()=>4/3,onQuit,onGesture}){
 const panel=document.getElementById('mobile-controller'),stick=document.getElementById('touch-stick'),knob=stick.querySelector('span');
 const cursor=document.createElement('div');cursor.id='virtual-cursor';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');document.getElementById('screen')?.append(cursor);
 const mouse=new VirtualPointer({getPlayer,getAspect,cursor});
 const keys=new TouchKeys((type,code)=>code==='MouseLeft'?mouse.button(type==='keydown'):sendRuffleKey(getPlayer(),type,code));
 let profile=DEFAULT,visible=false;const pointerSets=[],sticks=[];
 const reset=()=>{keys.releaseAll();mouse.reset();pointerSets.forEach(s=>s.clear());sticks.forEach(s=>{s.pointer=null;s.knob.style.transform='';});panel.querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed','false'));};
 const focus=()=>{onGesture();const p=getPlayer();if(p){p.tabIndex=0;p.focus({preventScroll:true});}};
 for(const [element,isAim] of [[stick,false],[document.getElementById('touch-aim'),true]]){
  const state={element,knob:element.querySelector('span'),pointer:null};sticks.push(state);
  const move=e=>{
   const r=element.getBoundingClientRect(),radius=r.width*.35;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
   state.knob.style.transform=`translate(${x*radius*.5}px,${y*radius*.5}px)`;
   if(isAim||profile.stick==='mouse'){mouse.aim(x,y);mouse.activate();if(isAim)keys.set('aim-fire',Math.hypot(x,y)>.22?['MouseLeft']:[]);return;}
   const mapping=profile.stick==='wasd'?{ArrowLeft:'KeyA',ArrowRight:'KeyD',ArrowUp:'KeyW',ArrowDown:'KeyS'}:{};
   keys.set('joystick',joystickKeys(x,y).map(k=>mapping[k]||k));
  };
  element.addEventListener('pointerdown',e=>{if(!visible||state.pointer!==null)return;e.preventDefault();focus();state.pointer=e.pointerId;element.setPointerCapture(e.pointerId);move(e);});
  element.addEventListener('pointermove',e=>{if(e.pointerId===state.pointer){e.preventDefault();move(e);}});
  const release=e=>{if(e.pointerId!==state.pointer)return;state.pointer=null;keys.set(isAim?'aim-fire':'joystick',[]);if(isAim||profile.stick==='mouse')mouse.aim(0,0);state.knob.style.transform='';};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,release);
 }
 for(const button of panel.querySelectorAll('[data-action], [data-key]')){
  const pointers=new Set();pointerSets.push(pointers);const mapping=()=>button.dataset.key?[button.dataset.key]:profile[button.dataset.action]||[];
  button.addEventListener('pointerdown',e=>{if(!visible)return;e.preventDefault();focus();button.setPointerCapture(e.pointerId);pointers.add(e.pointerId);keys.set('button-'+e.pointerId,mapping());button.setAttribute('aria-pressed','true');});
  const release=e=>{pointers.delete(e.pointerId);keys.set('button-'+e.pointerId,[]);button.setAttribute('aria-pressed',String(pointers.size>0));};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  button.addEventListener('click',e=>{if(e.detail===0&&visible){focus();keys.set('accessible-'+button.id,mapping());setTimeout(()=>keys.set('accessible-'+button.id,[]),100);}});
 }
 document.getElementById('touch-quit').addEventListener('click',()=>{reset();onQuit();});
 document.getElementById('screen')?.addEventListener('pointermove',e=>mouse.syncNative(e),{capture:true});
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 return {release:reset,update:dt=>mouse.update(dt),
  configure(value=DEFAULT){reset();profile=value;const layout=profile.layout||'standard';panel.dataset.layout=layout;stick.hidden=layout==='arrows';document.getElementById('touch-aim').hidden=layout!=='twin-sticks';document.getElementById('arrow-pad').hidden=layout!=='arrows';for(const id of ['touch-a','touch-b'])document.getElementById(id).hidden=layout==='arrows';for(const key of ['a','b']){const button=document.getElementById('touch-'+key),text=label(profile[key]||[]);button.querySelector('small').textContent=text;button.setAttribute('aria-label',`${key.toUpperCase()} — ${text}`);button.disabled=!profile[key]?.length;}
   const description=profile.stick==='mouse'?'Virtual mouse':profile.stick==='wasd'?'W A S D':'Arrow keys';stick.setAttribute('aria-label',`Joystick: ${description}`);document.getElementById('pad-mapping').textContent=layout==='twin-sticks'?'MOVE · AIM + FIRE':layout==='arrows'?'ARROW KEYS':description;
  },
  setVisible(value){if(visible===value)return;visible=value;reset();panel.classList.toggle('raised',value);panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));}
 };
}
