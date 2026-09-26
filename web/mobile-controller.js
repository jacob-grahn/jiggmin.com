import {TouchKeys,joystickKeys,sendRuffleKey} from './touch-input.js?v=1';
export function createMobileController({getPlayer,onQuit,onGesture}){
 const panel=document.getElementById('mobile-controller'),stick=document.getElementById('touch-stick'),knob=stick.querySelector('span');
 const keys=new TouchKeys((type,code)=>sendRuffleKey(getPlayer(),type,code));
 let stickPointer=null,visible=false;const pointerSets=[];
 const reset=()=>{keys.releaseAll();pointerSets.forEach(s=>s.clear());stickPointer=null;knob.style.transform='';panel.querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed','false'));};
 const focus=()=>{onGesture();const p=getPlayer();if(p){p.tabIndex=0;p.focus({preventScroll:true});}};
 function move(e){const r=stick.getBoundingClientRect(),radius=r.width*.35;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}knob.style.transform=`translate(${x*radius*.5}px,${y*radius*.5}px)`;keys.set('joystick',joystickKeys(x,y));}
 stick.addEventListener('pointerdown',e=>{if(!visible||stickPointer!==null)return;e.preventDefault();focus();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();move(e);}});
 const releaseStick=e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;keys.set('joystick',[]);knob.style.transform='';};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,releaseStick);
 for(const button of panel.querySelectorAll('[data-space]')){
  const pointers=new Set();pointerSets.push(pointers);
  button.addEventListener('pointerdown',e=>{if(!visible)return;e.preventDefault();focus();button.setPointerCapture(e.pointerId);pointers.add(e.pointerId);keys.set('button-'+e.pointerId,['Space']);button.setAttribute('aria-pressed','true');});
  const release=e=>{pointers.delete(e.pointerId);keys.set('button-'+e.pointerId,[]);button.setAttribute('aria-pressed',String(pointers.size>0));};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  button.addEventListener('click',e=>{if(e.detail===0&&visible){focus();keys.set('accessible-'+button.id,['Space']);setTimeout(()=>keys.set('accessible-'+button.id,[]),100);}});
 }
 document.getElementById('touch-quit').addEventListener('click',()=>{reset();onQuit();});
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 return {release:reset,setVisible(value){if(visible===value)return;visible=value;reset();panel.classList.toggle('raised',value);panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));}};
}
