import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../web/house-release-renderer.js',import.meta.url),'utf8');
const travelSource=source.slice(source.indexOf(' async function travel('),source.indexOf(' async function revealScrap('));
function coordinator(initial,{teleport=false,fail,interrupt}={}){
 const rooms=new Map(initial?[[initial,{id:initial}]]:[]),events=[];
 const create=new Function('rooms','events','initial','teleport','fail','interrupt',`
  let revealRevision=0,revision=0,current=rooms.get(initial),camera={},denProgress=0;
  let denResident=initial==='den',peak=rooms.size;
  const reduced={matches:teleport},targets=new Map();
  const continuousDen={endpointCamera:()=>({})};
  const getDen=()=>({scene:denResident?{}:null});
  const unloadDen=()=>{denResident=false;events.push(['release-den']);};
  const setActive=()=>{},load=async()=>{},viewFor=id=>({id}),access=()=>{};
  const render=()=>events.push(['render',current?.id]),resize=render;
  const unloadRoom=id=>{rooms.delete(id);events.push(['unload',id]);if(id==='den')unloadDen();};
  const ensureRoom=async id=>{
   if(rooms.has(id))return;
   events.push(['load',id]);
   if(id===fail)throw Error('load failed');
   rooms.set(id,{id});peak=Math.max(peak,rooms.size);
   if([...rooms.keys()].filter(r=>r!=='hallway').length>1)throw Error('Two rooms resident');
  };
  const moveAlong=async destination=>{current=destination;events.push(['arrive',destination.id]);if(interrupt===destination.id)revision++;};
  ${travelSource}
  return {travel,state:()=>({current,peak,denResident})};
 `);
 return {api:create(rooms,events,initial,teleport,fail,interrupt),events,rooms};
}
for(const from of ['den','workshop','attic','basement','private-hall','hallway']){
 for(const to of ['den','workshop','attic','basement','private-hall','hallway']){
  test(`${from} → ${to} keeps at most one room plus the hall`,async()=>{
   const {api,events,rooms}=coordinator(from);await api.travel(to);
   assert.deepEqual([...rooms.keys()],[to]);assert.ok(api.state().peak<=2);
   if(from!==to&&from!=='hallway'){
    assert.ok(events.findIndex(e=>e[0]==='arrive'&&e[1]==='hallway')<events.findIndex(e=>e[0]==='unload'&&e[1]===from));
    if(to!=='hallway')assert.ok(events.findIndex(e=>e[0]==='unload'&&e[1]===from)<events.findIndex(e=>e[0]==='load'&&e[1]===to));
   }
   if(from==='den'&&to!=='den')assert.equal(api.state().denResident,false);
  });
 }
}
test('teleport releases the old room before loading its replacement',async()=>{
 const {api,events}=coordinator('workshop',{teleport:true});await api.travel('basement');
 assert.ok(events.findIndex(e=>e[0]==='unload')<events.findIndex(e=>e[0]==='load'));
});
test('failed destination load leaves only the hall, and supports retry',async()=>{
 const {api,rooms}=coordinator('workshop',{fail:'basement'});
 await assert.rejects(api.travel('basement'),/load failed/);
 assert.deepEqual([...rooms.keys()],['hallway']);await api.travel('attic');assert.deepEqual([...rooms.keys()],['attic']);
});
test('cancelled travel does not start loading another room',async()=>{
 const {api,events}=coordinator('workshop',{interrupt:'hallway'});await api.travel('basement');
 assert.ok(!events.some(e=>e[0]==='load'&&e[1]==='basement'));
});

test('den unload drops live references and clears object state',async()=>{
 const THREE=await import('three');
 const {createRoomResources}=await import('../web/house-resources.js');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const unload=app.slice(app.indexOf('function unloadDen('),app.indexOf('function ensureDen('));
 let closed=0,disposed=0,shadowDisposed=0;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({map:new THREE.Texture({close(){closed++;}})}));
 mesh.userData.game_id='test';mesh.position.set(1,2,3);mesh.geometry.addEventListener('dispose',()=>disposed++);
 const run=new Function('THREE','mesh','createRoomResources','shadowDispose',`
  let scene=new THREE.Scene();scene.add(mesh);scene.shadow={dispose:shadowDispose};
  let roots=[mesh],basementCartridges=[],camera={},environment={setPlaying(){}},physics={},cord={},controller={},controllerDock={},upperShelf={},anchors={},upperBodies=[{}];
  let upperMode=true,shelfSlots=[],cameraDrop=1,focusY=1,denRevision=0;
  const room={dataset:{}},renderer={renderLists:{dispose(){}}},bonusPrepared=new Map(),stored=new Map([[mesh,2]]),motions=new Map([[mesh,{}]]),recovery={lastMoved:new Map([[mesh,1]])},SHELF_SLOTS=[];
  const gameId=root=>root.userData.game_id;
  ${unload}
  unloadDen();unloadDen();
  return {scene,camera,physics,roots,stored,motions,recovery,controllerDock,room};
 `);
 const state=run(THREE,mesh,createRoomResources,()=>shadowDisposed++);
 for(const key of ['scene','camera','physics','controllerDock'])assert.equal(state[key],null);
 assert.deepEqual(state.roots,[]);assert.equal(state.stored.size,0);assert.equal(state.motions.size,0);assert.equal(state.recovery.lastMoved.size,0);
 assert.equal(state.room.dataset.denLoaded,'false');
 assert.equal(disposed,1);assert.equal(closed,1);assert.equal(shadowDisposed,1);
});
