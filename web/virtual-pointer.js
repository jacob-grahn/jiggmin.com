export function contentRect(width,height,aspect){
 const w=Math.min(width,height*aspect),h=w/aspect;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export class VirtualPointer {
 constructor({getPlayer,getAspect,cursor}){Object.assign(this,{getPlayer,getAspect,cursor,x:.5,y:.5,dx:0,dy:0,down:false,active:false});}
 canvas(){return this.getPlayer()?.shadowRoot?.querySelector('canvas')||null;}
 reset(){if(this.down)this.button(false);this.dx=this.dy=0;this.active=false;this.cursor.hidden=true;this.x=this.y=.5;}
 aim(x,y){const magnitude=Math.hypot(x,y);this.dx=magnitude>.22?x:0;this.dy=magnitude>.22?y:0;if(this.dx||this.dy){this.active=true;this.cursor.hidden=false;}}
 position(){const canvas=this.canvas();if(!canvas)return null;const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return null;const box=contentRect(width,height,this.getAspect());return {canvas,x:box.x+this.x*box.width,y:box.y+this.y*box.height,width,height};}
 emit(type){
  const p=this.position();if(!p)return false;
  const r=p.canvas.getBoundingClientRect();
  const event=new PointerEvent(type,{pointerId:9041,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons:this.down?1:0,clientX:r.left+p.x/p.width*r.width,clientY:r.top+p.y/p.height*r.height,bubbles:true,composed:true,cancelable:true});
  // Ruffle reads CSS-pixel offsets. Explicit offsets avoid the CRT's projective
  // CSS transform distorting coordinates in synthetic pointer events.
  Object.defineProperties(event,{offsetX:{value:p.x},offsetY:{value:p.y}});
  p.canvas.dispatchEvent(event);return true;
 }
 draw(){const p=this.position();if(!p)return;this.cursor.style.left=`${p.x/p.width*100}%`;this.cursor.style.top=`${p.y/p.height*100}%`;}
 update(dt){
  if(!this.active)return;
  const p=this.position();if(!p)return;const speed=.72;
  this.x=Math.max(.005,Math.min(.995,this.x+this.dx*speed*dt));
  this.y=Math.max(.005,Math.min(.995,this.y+this.dy*speed*dt*this.getAspect()));
  this.draw();this.emit('pointermove');
 }
 syncNative(event){
  if(!event.isTrusted)return;const p=this.position();if(!p)return;
  const r=p.canvas.getBoundingClientRect(),box=contentRect(p.width,p.height,this.getAspect());
  this.x=Math.max(0,Math.min(1,((event.clientX-r.left)/r.width*p.width-box.x)/box.width));
  this.y=Math.max(0,Math.min(1,((event.clientY-r.top)/r.height*p.height-box.y)/box.height));
  this.active=false;this.cursor.hidden=true;
 }
 activate(){this.active=true;this.cursor.hidden=false;this.draw();this.emit('pointerover');this.emit('pointerenter');this.emit('pointermove');}
 button(down){this.activate();this.down=down;this.emit(down?'pointerdown':'pointerup');}
}
