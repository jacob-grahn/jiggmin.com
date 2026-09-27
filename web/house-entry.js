// This small entrance is the only house module loaded with the den.
// Room code, notes, artwork, and bonus games are fetched after exploration begins.
const QUERY='(min-width: 1000px) and (min-aspect-ratio: 69/50) and (pointer: fine)';
export function createHouseEntry({host,onOpen,onExit,onError}){
 const media=matchMedia(QUERY),nav=document.createElement('nav');
 nav.className='house-entrance';nav.setAttribute('aria-label','Explore the house');
 const buttons=['left','right'].map(side=>{
  const button=document.createElement('button');button.className=`house-entrance-${side}`;
  button.type='button';button.setAttribute('aria-label','Explore the hallway');
  const arrow=document.createElement('span');arrow.textContent=side==='left'?'‹':'›';arrow.setAttribute('aria-hidden','true');
  const label=document.createElement('small');label.textContent='Explore';button.append(arrow,label);nav.append(button);return button;
 });
 host.append(nav);
 let instance,loading,stylesheet,active=false,ready=false,origin,entryTicket=0;
 const update=()=>{nav.hidden=!media.matches||active||!ready;};
 function styles(){
  return stylesheet??=new Promise((resolve,reject)=>{
   const link=document.createElement('link');link.rel='stylesheet';link.href='/web/house.css';
   link.onload=resolve;link.onerror=()=>{link.remove();stylesheet=null;reject(new Error('The house styles could not load. Try the arrow again.'));};document.head.append(link);
  });
 }
 async function open(event){
  if(!media.matches||loading||active)return;origin=event.currentTarget;const ticket=++entryTicket;
  buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true');});
  loading=(async()=>{
   if(!instance){const [module]=await Promise.all([import('./house.js'),styles()]);instance=await module.createHouse({
    onOpen(){active=true;update();onOpen?.();},
    onExit(){active=false;update();onExit?.();if(!nav.hidden)origin?.focus();},
   });}
   if(media.matches&&ticket===entryTicket)await instance.enter('hallway');
  })();
  try{await loading;}catch(error){instance?.exit();onError?.(error.message||'The house could not open. Try again.');}
  finally{loading=null;buttons.forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy');});update();}
 }
 for(const button of buttons)button.addEventListener('click',open);
 media.addEventListener('change',()=>{if(!media.matches){entryTicket++;instance?.exit();}update();});
 update();
 return {setReady(){ready=true;update();},exit(){entryTicket++;instance?.exit();}};
}
