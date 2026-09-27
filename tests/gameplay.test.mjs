import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {framing,projectPoint} from '../web/responsive-scene.js';
import {KEY_INFO,TouchKeys} from '../web/touch-input.js';
import {contentRect,VirtualPointer} from '../web/virtual-pointer.js';
const profiles=JSON.parse(readFileSync('data/gameplay.json')).games;
test('Every archived game has an explicit, supported gameplay profile',()=>{
 const games=JSON.parse(readFileSync('data/games.json')).games;
 assert.equal(Object.keys(profiles).length,games.length);
 for(const game of games){const p=profiles[game.id];assert.ok(p,game.id);assert.ok(['touch','controller','broken'].includes(p.mode));assert.ok(['arrows','wasd','mouse'].includes(p.controller.stick));assert.ok(['standard','arrows','twin-sticks'].includes(p.controller.layout||'standard'));for(const key of [...p.controller.a,...p.controller.b])assert.ok(key==='MouseLeft'||KEY_INFO[key],`${game.id}: ${key}`);}
 assert.equal(profiles.mines.mode,'touch');assert.equal(profiles['uber-breakout-2'].mode,'controller');
 assert.deepEqual(profiles['uber-breakout-2'].controller,{stick:'arrows',a:['KeyP'],b:[]});
 assert.deepEqual(profiles.orbit.controller,{stick:'mouse',a:['ArrowLeft'],b:['ArrowRight']});
 assert.deepEqual(profiles['uber-breakout'].controller,{stick:'arrows',a:['KeyP'],b:[]});
});
test('Touch mode closely frames the whole CRT without cropping it at phone and desktop ratios',()=>{
 for(const [w,h] of [[320,568],[390,844],[844,390],[1440,900],[2560,720]]){
  const a=w/h,f=framing(a,true,'touch'),c=framing(a,true,'controller');assert.ok(f.zoom>c.zoom);
  for(const corner of [[.34117925,.23090464],[.65867907,.23094141],[.65394878,.56194752],[.34589323,.56047577]]){
   const [x,y]=projectPoint(corner,a,f.zoom,f.focusY);assert.ok(x>.01&&x<.99&&y>.03&&y<.97,`${w}x${h}: ${x},${y}`);
  }
 }
});
test('Virtual pointer uses the game content rectangle, stays bounded, and releases held mouse buttons',()=>{
 assert.deepEqual(contentRect(640,360,4/3),{x:80,y:0,width:480,height:360});
 assert.deepEqual(contentRect(640,360,2/3),{x:200,y:0,width:240,height:360});
 const Original=globalThis.PointerEvent,events=[];
 globalThis.PointerEvent=class{constructor(type,options){this.type=type;Object.assign(this,options);}};
 try{
  const canvas={clientWidth:640,clientHeight:360,getBoundingClientRect:()=>({left:100,top:50,width:320,height:180}),dispatchEvent:e=>events.push(e)};
  const p=new VirtualPointer({getPlayer:()=>({shadowRoot:{querySelector:()=>canvas}}),getAspect:()=>4/3,cursor:{hidden:true,style:{}}});
  p.aim(1,-1);for(let i=0;i<600;i++)p.update(1/60);
  assert.ok(p.x<=.995&&p.y>=.005);assert.ok(events.every(e=>e.offsetX>=80&&e.offsetX<=560&&e.offsetY>=0&&e.offsetY<=360));
  p.button(true);assert.equal(events.at(-1).buttons,1);p.reset();assert.equal(events.at(-1).type,'pointerup');assert.equal(events.at(-1).buttons,0);assert.equal(p.dx,0);assert.equal(p.cursor.hidden,true);
 }finally{globalThis.PointerEvent=Original;}
});
test('Shared mouse and keyboard actions do not release another held source',()=>{
 const emitted=[],keys=new TouchKeys((...args)=>emitted.push(args));
 keys.set('a',['MouseLeft']);keys.set('b',['MouseLeft','KeyP']);keys.set('a',[]);
 assert.deepEqual(emitted,[['keydown','MouseLeft'],['keydown','KeyP']]);keys.releaseAll();
 assert.deepEqual(emitted.slice(2),[['keyup','MouseLeft'],['keyup','KeyP']]);
});

test('Controller variants preserve user-selected controls',()=>{
 assert.equal(profiles['beat-master-3000'].controller.layout,'arrows');
 for(const id of ['neverending-light','cooties','kimblis-the-blue','red-earth-2'])assert.equal(profiles[id].controller.layout,'twin-sticks');
 assert.deepEqual(profiles.cooties.controller.b,[]);
 assert.deepEqual(profiles['red-earth-2'].controller.a,['MouseLeft']);
});
test('Repeated virtual clicks restore the cursor before every press and keep it alive at rest',()=>{
 const Original=globalThis.PointerEvent,events=[];globalThis.PointerEvent=class{constructor(type,options){this.type=type;Object.assign(this,options);}};
 try{
  const canvas={clientWidth:640,clientHeight:360,getBoundingClientRect:()=>({left:0,top:0,width:640,height:360}),dispatchEvent:e=>events.push(e)};
  const p=new VirtualPointer({getPlayer:()=>({shadowRoot:{querySelector:()=>canvas}}),getAspect:()=>16/9,cursor:{hidden:true,style:{}}});
  p.x=.7;p.y=.3;
  for(let i=0;i<3;i++){p.button(true);p.button(false);}
  assert.equal(events.filter(e=>e.type==='pointerdown').length,3);
  events.forEach((e,i)=>{if(e.type==='pointerdown')assert.equal(events[i-1].type,'pointermove');});
  p.update(.016);assert.equal(events.at(-1).type,'pointermove');assert.equal(p.x,.7);assert.equal(p.y,.3);
  p.reset();const count=events.length;p.update(.016);assert.equal(events.length,count);
 }finally{globalThis.PointerEvent=Original;}
});

test('Touch zoom fits each game content aspect, including portrait Hail and Meteors',()=>{
 for(const aspect of [390/844,844/390,1440/900])for(const ratio of [600/700,400/600,4/3,2.5]){
  const f=framing(aspect,true,'touch',ratio),w=Math.min(.318*1.6,.332*ratio),h=w/ratio;
  assert.ok(w*f.zoom/aspect<=.950001);assert.ok(h*f.zoom<=.860001);
  assert.ok(Math.abs(w*f.zoom/aspect-.95)<.000001||Math.abs(h*f.zoom-.86)<.000001);
  const [,center]=projectPoint([.5,.396],aspect,f.zoom,f.focusY);assert.ok(Math.abs(center-.5)<.000001);
 }
 assert.ok(framing(390/844,true,'touch',600/700).zoom>framing(390/844,true,'touch').zoom*1.7);
 assert.equal(framing(1.6,true,'controller',.5).zoom,framing(1.6,true,'controller').zoom);
});

test('Mobile controller framing leaves space for the pad and enlarges portrait games',()=>{
 for(const [w,h] of [[390,844],[320,568],[844,390]]){
  const a=w/h,ratio=4/3,f=framing(a,true,'controller',ratio,h);
  const gameWidth=Math.min(.318*1.6,.332*ratio),gameHeight=gameWidth/ratio;
  const [,center]=projectPoint([.5,.396],a,f.zoom,f.focusY);
  assert.ok(center-gameHeight*f.zoom/2>=0);
  assert.ok(center+gameHeight*f.zoom/2<1-(a>1.38?158:196)/h);
  assert.ok(gameWidth*f.zoom/a<=.950001);
  if(a<1)assert.ok(f.zoom>framing(a,true,'controller',ratio).zoom);
 }
});

test('Bubble Racing is an online touch cartridge with its own deep link and local artwork',()=>{
 const game=JSON.parse(readFileSync('data/games.json')).games.find(g=>g.id==='bubble-racing');
 assert.equal(game.playerType,'iframe');assert.equal(game.embedUrl,'https://bubbleracing.com/');
 assert.equal(profiles[game.id].mode,'touch');assert.ok(readFileSync(game.thumbnail.file).length>0);
 assert.ok(readFileSync('dist/bubble-racing/index.html','utf8').includes('<base href="/">'));
});
