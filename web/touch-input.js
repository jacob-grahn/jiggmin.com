export const KEY_INFO={Space:{key:' ',keyCode:32},ArrowLeft:{key:'ArrowLeft',keyCode:37},ArrowUp:{key:'ArrowUp',keyCode:38},ArrowRight:{key:'ArrowRight',keyCode:39},ArrowDown:{key:'ArrowDown',keyCode:40}};
for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')KEY_INFO['Key'+letter]={key:letter.toLowerCase(),keyCode:letter.charCodeAt(0)};
for(let digit=0;digit<=9;digit++)KEY_INFO['Digit'+digit]={key:String(digit),keyCode:48+digit};
Object.assign(KEY_INFO,{ShiftLeft:{key:'Shift',keyCode:16},Enter:{key:'Enter',keyCode:13},Escape:{key:'Escape',keyCode:27}});
export function joystickKeys(x,y){
 if(Math.hypot(x,y)<.22)return [];
 const keys=[];if(x<-.36)keys.push('ArrowLeft');if(x>.36)keys.push('ArrowRight');if(y<-.36)keys.push('ArrowUp');if(y>.36)keys.push('ArrowDown');return keys;
}
// Reference-count shared mappings: releasing A must not release a still-held B.
export class TouchKeys {
 constructor(emit){this.emit=emit;this.sources=new Map();this.held=new Set();}
 set(source,keys){if(keys.length)this.sources.set(source,new Set(keys));else this.sources.delete(source);this.sync();}
 sync(){const next=new Set([...this.sources.values()].flatMap(keys=>[...keys]));for(const key of this.held)if(!next.has(key))this.emit('keyup',key);for(const key of next)if(!this.held.has(key))this.emit('keydown',key);this.held=next;}
 releaseAll(){this.sources.clear();this.sync();}
}
export function sendRuffleKey(player,type,code){
 if(!player)return;
 // Ruffle listens to bubbling keyboard events while its host has focus, the
 // same event route used by its own virtual keyboard. No private WASM API.
 player.tabIndex=0;player.focus({preventScroll:true});
 const info=KEY_INFO[code];if(!info)return;const {key,keyCode}=info;
 player.dispatchEvent(new KeyboardEvent(type,{key,code,keyCode,which:keyCode,bubbles:true,composed:true,cancelable:true}));
}
