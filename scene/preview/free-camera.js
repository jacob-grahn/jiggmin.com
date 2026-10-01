import * as THREE from 'three';

// Fly through walls so unfinished geometry can be inspected from either side.
export function createFreeCamera(camera, canvas, onChange, onExit) {
 const keys=new Set(), rotation=new THREE.Euler(0,0,0,'YXZ');
 const forward=new THREE.Vector3(),right=new THREE.Vector3(),move=new THREE.Vector3();
 const accepted=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
 let enabled=false,frame=0,last=0,pointer=null;
 function clear(){keys.clear();cancelAnimationFrame(frame);frame=0;if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);pointer=null;}
 function turn(yaw,pitch){rotation.setFromQuaternion(camera.quaternion,'YXZ');rotation.y+=yaw;rotation.x=THREE.MathUtils.clamp(rotation.x+pitch,-Math.PI/2+.01,Math.PI/2-.01);rotation.z=0;camera.quaternion.setFromEuler(rotation);}
 function advance(now){
  if(!enabled||!keys.size)return;
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  const axis=(a,b)=>Number(keys.has(a))-Number(keys.has(b));
  turn(axis('ArrowLeft','ArrowRight')*dt,axis('ArrowUp','ArrowDown')*dt);
  camera.getWorldDirection(forward);right.set(1,0,0).applyQuaternion(camera.quaternion);
  move.copy(forward).multiplyScalar(axis('KeyW','KeyS')).addScaledVector(right,axis('KeyD','KeyA'));move.y+=axis('KeyE','KeyQ');
  if(move.lengthSq()>0)camera.position.addScaledVector(move.normalize(),dt*2*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1));
  onChange();
 }
 function tick(now){frame=0;if(!enabled||!keys.size)return;advance(now);frame=requestAnimationFrame(tick);}
 canvas.addEventListener('keydown',event=>{
  if(!enabled)return;if(event.code==='Escape'){event.preventDefault();onExit();return;}
  if(!accepted.has(event.code))return;event.preventDefault();keys.add(event.code);if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
 });
 window.addEventListener('keyup',event=>{if(keys.has(event.code))advance(performance.now());keys.delete(event.code);if(!keys.size){cancelAnimationFrame(frame);frame=0;}});
 canvas.addEventListener('blur',clear);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 canvas.addEventListener('pointerdown',event=>{if(!enabled||event.button!==0)return;canvas.focus({preventScroll:true});pointer=event.pointerId;canvas.setPointerCapture(pointer);});
 canvas.addEventListener('pointermove',event=>{if(!enabled||pointer!==event.pointerId)return;turn(-event.movementX*.003,-event.movementY*.003);onChange();});
 canvas.addEventListener('pointerup',clear);canvas.addEventListener('pointercancel',clear);canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
 return {get enabled(){return enabled;},set enabled(value){enabled=value;clear();canvas.classList.toggle('free-moving',value);if(value)canvas.focus({preventScroll:true});}};
}

export function cameraReadout(camera){
 const p=camera.position,r=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ'),deg=THREE.MathUtils.radToDeg;
 const f=n=>(Math.abs(n)<.0005?0:n).toFixed(3);
 return `Position (m)  X ${f(p.x)}  Y ${f(p.y)}  Z ${f(p.z)}\nRotation (° · YXZ)  Pitch ${f(deg(r.x))}  Yaw ${f(deg(r.y))}  Roll ${f(deg(r.z))}\nBlender (m)  X ${f(p.x)}  Y ${f(-p.z)}  Z ${f(p.y)}`;
}
