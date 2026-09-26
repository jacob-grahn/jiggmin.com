import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CartridgePhysics} from '../web/physics.js';
const colliders=JSON.parse(readFileSync(new URL('../web/assets/colliders.json',import.meta.url)));
const pose=(x,y,z)=>({position:{x,y,z},quaternion:{x:0,y:0,z:0,w:1}});
function step(p,seconds){for(let i=0;i<seconds*120;i++)p.step(1/120);}
test('Dropped cartridge lands on the real tabletop instead of falling through',()=>{
 const p=new CartridgePhysics(colliders);p.add('test',pose(1.6,2,1.5));p.place('test',pose(1.6,2,1.5));step(p,4);
 const root=p.pose('test').position;assert.ok(root.y>.65&&root.y<.75,JSON.stringify(root));
});
test('A fast throw off the table tumbles and stays above the floor',()=>{
 const p=new CartridgePhysics(colliders);const b=p.add('test',pose(1.5,1.4,1.8));p.place('test',pose(1.5,1.4,1.8));b.velocity.set(6,2,1);b.angularVelocity.set(5,4,3);step(p,.3);
 assert.ok(Math.abs(b.quaternion.x)+Math.abs(b.quaternion.z)>.1);step(p,1.7);assert.ok(b.position.y>=.05);assert.ok(Number.isFinite(b.position.x));
});
test('Spring grip lifts a dynamic body and release preserves throw momentum',()=>{
 const p=new CartridgePhysics(colliders);p.add('test',pose(1.4,.71,1.8));p.grab('test',{x:1.4,y:1,z:1.85});p.move({x:1.4,y:2,z:2});step(p,1);
 const b=p.items.get('test').body;assert.ok(b.position.y>1.4);p.release({x:3,y:1,z:0});assert.ok(b.velocity.x>1.5);assert.equal(p.held,null);
});
test('Pinning holds the cartridge in the console; cancel and tidy restore poses',()=>{
 const p=new CartridgePhysics(colliders);p.add('test',pose(1.4,.71,1.8));const dock=pose(-.13,.94,1.17);p.pin('test',dock);step(p,1);
 assert.ok(Math.abs(p.pose('test').position.y-.94)<1e-6);
 p.grab('test',{x:-.13,y:1.3,z:1.2});p.move({x:1,y:2,z:2});step(p,.3);p.cancel();assert.ok(Math.abs(p.pose('test').position.y-.94)<1e-6);
 p.reset('test');assert.equal(p.pose('test').position.x,1.4);
});
test('Two cartridges collide and transfer momentum',()=>{
 const p=new CartridgePhysics([{name:'floor',center:[0,-.1,0],halfExtents:[10,.1,10],quaternion:[0,0,0,1]}]);
 const a=p.add('a',pose(-.7,1,0)),b=p.add('b',pose(0,1,0));p.place('a',pose(-.7,1,0));p.place('b',pose(0,1,0));a.velocity.set(4,0,0);step(p,.2);
 assert.ok(b.position.x>.04,'stationary cartridge should be knocked aside');
});
test('Strong throws hit the outer boundaries and never reset to their display pose',()=>{
 const p=new CartridgePhysics(colliders);const b=p.add('test',pose(1.5,1.4,2));p.place('test',pose(1.5,1.4,2));
 p.reset=()=>{throw Error('A thrown cartridge must not reset automatically');};
 b.velocity.set(8,4,3);b.angularVelocity.set(5,8,3);step(p,8);
 assert.ok(b.position.x<4.71&&b.position.z<4.71);
 assert.ok(b.position.y>=.01);
 assert.ok(Math.abs(p.pose('test').position.x-1.5)>.2);
});

test('Controller catches a falling cartridge and transfers collision momentum',()=>{
 const p=new CartridgePhysics([]),pad=p.addController('controller',pose(-1.3,.72,2));
 const cart=p.add('cart',pose(-1.3,1.6,2));p.place('cart',pose(-1.3,1.6,2));
 let hit=false;pad.addEventListener('collide',event=>{if(event.body===cart)hit=true;});
 step(p,.5);assert.ok(hit,'cartridge must hit the controller shell');
 assert.ok(pad.position.y<.8,'controller wakes and moves after impact');
});
test('Controller cord is slack nearby, catches a hard throw, and survives a grip beyond reach',()=>{
 const p=new CartridgePhysics([]),pad=p.addController('controller',pose(-1.3,1,2));
 const cord=p.items.get('controller').cord;
 const length=()=>pad.pointToWorldFrame(cord.pivot).distanceTo(cord.bodyA.position);
 p.place('controller',pose(-1.3,1,2));step(p,.03);
 assert.ok(Math.abs(pad.velocity.x)<.001,'slack cord must not pull or push horizontally');
 pad.velocity.set(-8,5,0);pad.angularVelocity.set(3,5,8);
 let farthest=0;for(let i=0;i<360;i++){p.step(1/120);farthest=Math.max(farthest,length());}
 assert.ok(farthest<cord.length+.08,`throw stretched cord to ${farthest}`);
 p.grab('controller',pad.position);p.move({x:-4,y:4,z:4});step(p,2);
 assert.ok(length()<cord.length+.08,`grip stretched cord to ${length()}`);
 p.release({x:-8,y:3,z:0});step(p,2);
 assert.ok(length()<cord.length+.08);assert.ok(Number.isFinite(pad.quaternion.w));
 p.reset('controller');assert.ok(Math.abs(p.pose('controller').position.x+1.3)<1e-8);
 assert.equal(pad.mass,.58,'reset must preserve controller mass');
});
