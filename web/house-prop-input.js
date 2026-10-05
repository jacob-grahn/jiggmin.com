import * as THREE from 'three';

export function createHousePropInput(host,{getRoom,getCamera,onActivate,wake,reduced}){
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),point=new THREE.Vector3();
 ray.firstHitOnly=true;
 ray.layers.enableAll(); // Picking is scoped by room roots, independent of lighting passes.
 let enabled=false,gesture,suppressClick=false;
 function pick(event){
  const room=getRoom(),camera=getCamera();if(!room||!camera)return;
  const rect=host.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  ray.setFromCamera(pointer,camera);room.scene.updateMatrixWorld(true);
  const hit=ray.intersectObjects(room.pickRoots??room.scene.children,true).find(hit=>{for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;return true;});
  return hit?.object.userData.houseProp?{...hit,prop:hit.object.userData.houseProp}:null;
 }
 function down(event){
  if(!enabled||event.button!==0||gesture)return;
  suppressClick=false;
  // Doorway controls take priority over props behind their screen-space buttons.
  if(event.target?.closest?.('.house-hotspot:not(.house-prop-target)'))return;
  const hit=pick(event);if(!hit)return;
  const normal=getCamera().getWorldDirection(new THREE.Vector3());
  gesture={prop:hit.prop,point:hit.point.clone(),id:event.pointerId,start:[event.clientX,event.clientY],dragged:false,
   plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),last:hit.point.clone(),velocity:new THREE.Vector3(),time:performance.now()};
  suppressClick=false;event.preventDefault();host.setPointerCapture(event.pointerId);
 }
 function move(event){
  if(!enabled)return;
  if(!gesture){host.style.cursor=pick(event)?'grab':'';return;}
  const g=gesture;if(g.id!==event.pointerId)return;
  if(!g.dragged&&Math.hypot(event.clientX-g.start[0],event.clientY-g.start[1])<6)return;
  if(g.prop.mode==='wiggle'||g.prop.mode==='game')return;
  if(!g.dragged){
   g.prop.spring.reset();if(getRoom().props.physics.items.get(g.prop.id).body.type!==1)g.prop.root.quaternion.copy(g.prop.rest);
   getRoom().props.physics.grab(g.prop.id,g.point);g.dragged=true;
  }
  pick(event); // Update the ray, including when the pointer leaves the object.
  if(!ray.ray.intersectPlane(g.plane,point))return;
  const now=performance.now(),dt=Math.max(.008,(now-g.time)/1000);
  const speed=point.clone().sub(g.last).divideScalar(dt);
  g.velocity.lerp(speed,.45);if(g.velocity.length()>8)g.velocity.setLength(8);g.last.copy(point);g.time=now;
  getRoom().props.physics.move(point);host.style.cursor='grabbing';wake();event.preventDefault();
 }
 function end(event,cancelled=false,interrupted=false){
  const g=gesture;if(!g||event.pointerId!==g.id)return;
  gesture=null;suppressClick=true;
  if(host.hasPointerCapture(g.id))host.releasePointerCapture(g.id);
  const room=getRoom();
  if(cancelled)room.props.cancel();
  else if(g.dragged){room.props.physics.release(performance.now()-g.time>120?new THREE.Vector3():g.velocity);if(!interrupted&&g.prop.hotspot)onActivate(g.prop.hotspot);}
  else if(!interrupted&&g.prop.onPress){g.prop.onPress();}
  else if(!interrupted){room.props.kick(g.prop,reduced.matches);if(g.prop.hotspot)onActivate(g.prop.hotspot);}
  host.style.cursor='';wake();
 }
 function click(event){if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}}
 function wheel(event){
  if(!gesture?.dragged)return;
  event.preventDefault();gesture.plane.constant+=THREE.MathUtils.clamp(event.deltaY*.002,-.15,.15);move({clientX:event.clientX,clientY:event.clientY,pointerId:gesture.id,preventDefault(){}});
 }
 function cancel(){const held=Boolean(gesture);if(gesture)end({pointerId:gesture.id},true);return held;}
 function lost(event){if(gesture?.id===event.pointerId)end(event,false,true);}
 function blur(){if(gesture)end({pointerId:gesture.id},false,true);}
 function visibility(){if(document.hidden)blur();else wake();}
 const cancelEvent=e=>end(e,false,true);
 host.addEventListener('pointerdown',down,true);host.addEventListener('pointermove',move);
 host.addEventListener('pointerup',end);host.addEventListener('pointercancel',cancelEvent);host.addEventListener('lostpointercapture',lost);
 host.addEventListener('click',click,true);host.addEventListener('wheel',wheel,{passive:false});
 window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
 return {
  cancel,
  setEnabled(value){enabled=value;if(!value)cancel();host.style.cursor='';},
  activate(prop){
   const room=getRoom();if(!enabled||!room)return;
   if(prop.onPress){prop.onPress();wake();return;}
   if(prop.mode==='throw'&&!prop.hotspot){
    const impulse=getCamera().position.clone().sub(prop.root.position).normalize().multiplyScalar(2);impulse.y=2;
    room.props.physics.grab(prop.id,prop.root.position);room.props.physics.release(impulse);
   }else room.props.kick(prop,reduced.matches);
   wake();if(prop.hotspot)onActivate(prop.hotspot);
  },
  dispose(){cancel();host.removeEventListener('pointerdown',down,true);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',end);host.removeEventListener('pointercancel',cancelEvent);host.removeEventListener('lostpointercapture',lost);host.removeEventListener('click',click,true);host.removeEventListener('wheel',wheel);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);}
 };
}
