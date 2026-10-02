import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the production travel coordinator without a WebGL context.
const source=readFileSync(new URL('../web/house-release-renderer.js',import.meta.url),'utf8');
const travelSource=source.slice(source.indexOf(' async function travel('),source.indexOf(' async function revealScrap('));
function coordinator(){
 const events=[],rooms=new Map([['workshop',{id:'workshop'}]]);
 const endpoint={den:true};
 const create=new Function('rooms','events','endpoint',`
  let revealRevision=0,revision=0,current=rooms.get('workshop'),camera,denProgress;
  const reduced={matches:true},targets=new Map(),continuousDen={endpointCamera:()=>endpoint};
  const setActive=()=>{},load=async()=>{};
  const ensureRoom=async id=>{events.push(['load',id]);rooms.set(id,{id});};
  const viewFor=id=>({id}),access=(...args)=>events.push(['access',...args]);
  const unloadRoom=id=>{events.push(['unload',id]);rooms.delete(id);};
  const resize=()=>events.push(['render',current.id]);
  const moveAlong=()=>{throw Error('Teleport must not animate a route');};
  ${travelSource}
  return {travel,state:()=>({current,camera,denProgress})};
 `);
 return {api:create(rooms,events,endpoint),events,rooms,endpoint};
}
for(const id of ['hallway','workshop','attic','basement','private-hall','den'])test(`reduced motion teleports directly to ${id}`,async()=>{
 const {api,events,rooms,endpoint}=coordinator();
 await api.travel(id,()=>events.push(['ready']));
 assert.deepEqual(events.filter(e=>e[0]==='load'),[['load',id]]);
 assert.deepEqual(events.filter(e=>e[0]==='render'),[['render',id]]);
 assert.deepEqual([...rooms.keys()],[id]);
 assert.deepEqual(events.at(-1),['ready']);
 assert.deepEqual(events.find(e=>e[0]==='access'),['access',id==='hallway'?'':id,id==='hallway'?0:1]);
 assert.equal(api.state().current.id,id);
 if(id==='den'){assert.equal(api.state().camera,endpoint);assert.equal(api.state().denProgress,1);}
});
