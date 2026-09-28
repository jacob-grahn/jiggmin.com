import * as CANNON from './vendor/cannon-es/cannon-es.js';

export const FIXED_STEP = 1 / 120;
export const CARTRIDGE_DEPTH_SCALE = .6;
export const CARTRIDGE_SIZE = [.51, .46, .145 * CARTRIDGE_DEPTH_SCALE];
const CENTER = new CANNON.Vec3(0, .23, 0);
export const CONTROLLER_CORD = {anchor: {x:-.44,y:.85,z:1.68}, plug: {x:0,y:.10,z:-.27}, length:1.8};

// A unilateral distance constraint: the cord can pull, but never push.
// Its off-center attachment also creates torque as the controller swings.
class CordConstraint extends CANNON.Constraint {
  constructor(anchor, body, pivot, length) {
    super(anchor, body, {collideConnected:false});
    this.pivot=pivot; this.length=length;
    const eq=new CANNON.ContactEquation(anchor,body);
    eq.minForce=-500; eq.maxForce=0;
    eq.setSpookParams(1e7,4,FIXED_STEP);
    this.equations.push(eq);
  }
  update() {
    const eq=this.equations[0];
    this.bodyB.quaternion.vmult(this.pivot,eq.rj);
    this.bodyB.position.vadd(eq.rj,eq.ni);
    eq.ni.vsub(this.bodyA.position,eq.ni);
    eq.ni.normalize(); eq.ni.scale(this.length,eq.ri);
  }
}
const MAX_SPEED = 8;
const vec = p => new CANNON.Vec3(p.x, p.y, p.z);
function limit(v, max) {const n = v.length(); if(n > max) v.scale(max / n, v);}

export class CartridgePhysics {
  constructor(colliders, onImpact = () => {}, {bounds, floorY=-.02} = {}) {
    this.world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: true});
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 18;
    this.world.solver.tolerance = .0001;
    this.world.defaultContactMaterial.friction = .48;
    this.world.defaultContactMaterial.restitution = .18;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.items = new Map(); this.accumulator = 0; this.held = null;
    this.addStatic(colliders);
    // Keep throws in the room with collisions, never by teleporting them home.
    // These outer boundaries sit beyond the visible furniture and inside the floor.
    for(const [x,z,hx,hz] of (bounds ?? [[-5.2,0,.5,5.7],[5.2,0,.5,5.7],[0,-5.2,5.7,.5],[0,5.2,5.7,.5]])) {
      const wall = new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(hx,10,hz))});
      wall.position.set(x,floorY+9,z);wall.aabbNeedsUpdate=true;this.world.addBody(wall);
    }
    const floor = new CANNON.Body({mass:0,shape:new CANNON.Plane()});
    floor.position.y=floorY;floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
    floor.aabbNeedsUpdate=true;this.world.addBody(floor);
    this.onImpact = onImpact;
  }
  addStatic(colliders) {
    return colliders.map(c=>{
      const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(...c.halfExtents))});
      body.position.set(...c.center);body.quaternion.set(...c.quaternion);body.name=c.name;body.aabbNeedsUpdate=true;
      body.safeSupport=/^(Coffee table top|CRT |Library •|Console |Upper library)/.test(c.name);
      this.world.addBody(body);return body;
    });
  }
  add(id, pose, {mass=.32, size=CARTRIDGE_SIZE, center=CENTER, shape='box'}={}) {
    const body = new CANNON.Body({mass, shape: shape==='sphere'?new CANNON.Sphere(Math.max(...size)/2):new CANNON.Box(new CANNON.Vec3(...size.map(size => size / 2))), linearDamping: .12, angularDamping: .3, allowSleep: true, sleepSpeedLimit: .09, sleepTimeLimit: .8});
    body.gameId = id;
    this.items.set(id, {body, mass, center:vec(center), home: {position:{x:pose.position.x,y:pose.position.y,z:pose.position.z},quaternion:{x:pose.quaternion.x,y:pose.quaternion.y,z:pose.quaternion.z,w:pose.quaternion.w}}});
    this.world.addBody(body);
    this.place(id, pose, true);
    body.addEventListener('collide', event => {
      const item=this.items.get(id);
      if(item.releaseOnContact && event.body.type===CANNON.Body.DYNAMIC && this.items.has(event.body.gameId)) this.unpin(id);
      const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if(speed > .45) this.onImpact(speed, body.position);
    });
    return body;
  }
  addController(id, pose) {
    const center=new CANNON.Vec3(0,.09,0);
    const body=this.add(id,pose,{mass:.58,size:[1,.18,.54],center});
    // Joystick cap and buttons have volume, including when the pad is upside down.
    body.addShape(new CANNON.Cylinder(.095,.095,.035,12),new CANNON.Vec3(-.278,.214,0));
    body.addShape(new CANNON.Cylinder(.027,.04,.10,8),new CANNON.Vec3(-.278,.16,0));
    for(const [x,z] of [[.225,.073],[.365,-.068]])
      body.addShape(new CANNON.Box(new CANNON.Vec3(.068,.023,.068)),new CANNON.Vec3(x,.114,z));
    const anchor=new CANNON.Body({mass:0,collisionFilterMask:0});
    anchor.position.copy(vec(CONTROLLER_CORD.anchor)); this.world.addBody(anchor);
    const pivot=vec(CONTROLLER_CORD.plug).vsub(center);
    const cord=new CordConstraint(anchor,body,pivot,CONTROLLER_CORD.length);
    this.world.addConstraint(cord); this.items.get(id).cord=cord;body.sleep();
    return body;
  }
  pose(id) {
    const {body:b,center} = this.items.get(id), offset = b.quaternion.vmult(center);
    return {position: {x:b.position.x-offset.x,y:b.position.y-offset.y,z:b.position.z-offset.z}, quaternion:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w}};
  }
  place(id, pose, sleep = false) {
    const {body:b,mass,center} = this.items.get(id);
    this.items.get(id).supported=false;
    this.items.get(id).releaseOnContact=false;
    b.type = CANNON.Body.DYNAMIC; b.mass = mass; b.collisionFilterMask = -1; b.updateMassProperties();
    b.quaternion.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w);
    b.position.copy(vec(pose.position).vadd(b.quaternion.vmult(center)));
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
    b.velocity.setZero(); b.angularVelocity.setZero(); b.force.setZero(); b.torque.setZero(); b.aabbNeedsUpdate = true;
    if(sleep) b.sleep(); else b.wakeUp();
  }
  updateSupport() {
    const links=new Map();
    for(const contact of this.world.contacts){
      const {bi,bj,ni}=contact;
      const upper=ni.y>.45?bj:ni.y<-.45?bi:null;
      if(!upper?.gameId)continue;
      const lower=upper===bi?bj:bi;
      if(!links.has(upper.gameId))links.set(upper.gameId,[]);
      links.get(upper.gameId).push(lower);
    }
    const supported=(id,seen=new Set())=>{
      if(seen.has(id))return false;seen.add(id);
      const item=this.items.get(id);
      if(item.body.sleepState===CANNON.Body.SLEEPING&&!links.has(id))return !!item.supported;
      return (links.get(id)||[]).some(body=>body.safeSupport||(body.gameId&&supported(body.gameId,new Set(seen))));
    };
    const result=new Map([...this.items.keys()].map(id=>[id,supported(id)]));
    for(const [id,value] of result)this.items.get(id).supported=value;
  }
  reset(id) {this.place(id, this.items.get(id).home, true);}
  pin(id, pose, {releaseOnContact=false}={}) {
    this.place(id, pose, true);
    const b = this.items.get(id).body;
    b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.collisionFilterMask = releaseOnContact ? -1 : 0; b.updateMassProperties();
    this.items.get(id).releaseOnContact=releaseOnContact;
  }
  unpin(id) {
    const item=this.items.get(id), body=item.body;
    item.releaseOnContact=false;
    body.type=CANNON.Body.DYNAMIC; body.mass=item.mass; body.collisionFilterMask=-1; body.updateMassProperties(); body.wakeUp();
  }
  grab(id, point) {
    if(this.held) this.release();
    const before = this.pose(id), body = this.items.get(id).body;
    const wasPinned = body.type === CANNON.Body.KINEMATIC;
    const releaseOnContact=this.items.get(id).releaseOnContact;
    this.unpin(id);
    const anchor = new CANNON.Body({mass: 0, type: CANNON.Body.KINEMATIC, collisionFilterMask: 0});
    anchor.position.copy(vec(point));
    this.world.addBody(anchor);
    const pivot = body.pointToLocalFrame(vec(point));
    const constraint = new CANNON.PointToPointConstraint(body, pivot, anchor, new CANNON.Vec3(), 80);
    for(const eq of constraint.equations) eq.setSpookParams(8e4, 4, FIXED_STEP);
    this.world.addConstraint(constraint);
    this.held = {id, body, anchor, constraint, target: vec(point), pivot, before, wasPinned, releaseOnContact};
  }
  move(point) {if(this.held) this.held.target.copy(vec(point));}
  release(velocity) {
    if(!this.held) return;
    const h = this.held;
    this.world.removeConstraint(h.constraint); this.world.removeBody(h.anchor); this.held = null;
    if(velocity) h.body.velocity.lerp(vec(velocity), .65, h.body.velocity);
    limit(h.body.velocity, MAX_SPEED); limit(h.body.angularVelocity, 24); h.body.wakeUp();
    return h;
  }
  cancel() {
    const h = this.release(); if(!h) return;
    if(h.wasPinned) this.pin(h.id, h.before, {releaseOnContact:h.releaseOnContact}); else this.place(h.id, h.before, true);
  }
  step(dt) {
    this.accumulator += Math.min(Math.max(dt,0), .08);
    let steps = 0;
    while(this.accumulator >= FIXED_STEP && steps++ < 10) {
      if(this.held) {
        const h = this.held;
        const cord=this.items.get(h.id).cord;
        if(cord){
          // Stop the mouse anchor at the available reach, so the grip and cord
          // never ask the solver to satisfy two incompatible hard constraints.
          const reach=cord.length-h.pivot.distanceTo(cord.pivot);
          const direction=h.target.vsub(cord.bodyA.position);
          limit(direction,Math.max(.1,reach));
          cord.bodyA.position.vadd(direction,h.target);
        }
        h.target.vsub(h.anchor.position, h.anchor.velocity); h.anchor.velocity.scale(26,h.anchor.velocity); limit(h.anchor.velocity,10);
        h.body.wakeUp();
      }
      for(const {body} of this.items.values()) {limit(body.velocity,MAX_SPEED); limit(body.angularVelocity,24);}
      this.world.step(FIXED_STEP); this.updateSupport(); this.accumulator -= FIXED_STEP;
    }
  }
}
