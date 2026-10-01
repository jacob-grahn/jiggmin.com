// This small entrance is the only house module loaded with the den.
// Room code, notes, artwork, and bonus games are fetched after exploration begins.
export function createHouseEntry({host,onOpen,onExit,onError,getDen,onCollectBonus}){
 const nav=document.createElement('nav');
 nav.className='house-entrance';nav.setAttribute('aria-label','Explore the house');
 const buttons=['bottom'].map(side=>{
  const button=document.createElement('button');button.className=`house-entrance-${side}`;
  button.type='button';button.setAttribute('aria-label','Explore the hallway');
  const arrow=document.createElement('span');arrow.textContent='↓';arrow.setAttribute('aria-hidden','true');
  button.append(arrow);nav.append(button);return button;
 });
 host.append(nav);
 let instance,loading,stylesheet,active=false,ready=false,playing=false,origin,entryTicket=0;
 const update=()=>{nav.hidden=active||!ready||playing;};
 function styles(){
  return stylesheet??=new Promise((resolve,reject)=>{
   const link=document.createElement('link');link.rel='stylesheet';link.href='/web/house.css?v=house-reference-30';
   link.onload=resolve;link.onerror=()=>{link.remove();stylesheet=null;reject(new Error('The house styles could not load. Try the arrow again.'));};document.head.append(link);
  });
 }
 async function open(originElement,journalRequest=false){
  if(loading||active)return;origin=originElement;const ticket=++entryTicket;
  buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true');});
  loading=(async()=>{
   if(!instance){const [module]=await Promise.all([import('./house.js?v=house-reference-46'),styles()]);instance=await module.createHouse({getDen,onCollectBonus,
    onOpen(){active=true;update();onOpen?.();},
    onExit(){active=false;update();onExit?.();if(origin?.isConnected&&!origin.hidden)origin.focus();},
   });}
   if(ticket===entryTicket){if(journalRequest)await instance.openJournal();else await instance.enter('hallway');}
  })();
  try{await loading;}catch(error){instance?.exit();onError?.(error.message||'The house could not open. Try again.');}
  finally{loading=null;buttons.forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy');});update();}
 }
 for(const button of buttons)button.addEventListener('click',event=>open(event.currentTarget));
 update();
 return {setPlaying(value){playing=value;update();},setReady(){ready=true;update();},openJournal(){if(ready)return open(null,true);},exit(){entryTicket++;instance?.exit();}};
}
