import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';
import {getBounds} from '@gltf-transform/functions';

test('shared slab faces and garage slabs are allocated to their receiving rooms',()=>{
 const inputs=[['structure-hall','Cellar slab underside / Main floor'],['hall-ceilings','Attic slab upper / Attic floor / hall ceiling'],['structure-stairs','Garage slab'],['structure-hall','Finish / first flight riser'],['structure-hall','Finish / stairs head'],['structure-attic','Finish / attic landing rail']];
 const groups=JSON.parse(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'scene/scripts');from house_bake_groups import room_atlas_group;print(json.dumps([room_atlas_group(*x) for x in json.load(sys.stdin)]))"],{input:JSON.stringify(inputs),encoding:'utf8'}));
 assert.deepEqual(groups,['basement-slab-ceilings','attic-floor','structure-garage','structure-stairs','hall-trim','structure-attic']);
});

test('hallway joinery gets its own atlas without capturing walls, floors or other rooms',()=>{
 const inputs=[['structure-hall','Finish / den casing'],['structure-hall','Finish / front head'],['structure-hall','Finish / skirting.007'],['structure-hall','Finish / floor board'],['structure-hall','Proposed wall 03'],['structure-garage','Finish / garage-rear jamb'],['hall-window-frames','Finish / hall-right jamb']];
 const groups=JSON.parse(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'scene/scripts');from house_bake_groups import hallway_atlas_group;print(json.dumps([hallway_atlas_group(*x) for x in json.load(sys.stdin)]))"],{input:JSON.stringify(inputs),encoding:'utf8'}));
 assert.deepEqual(groups,['hall-trim','hall-trim','hall-trim','structure-hall','structure-hall','structure-garage','hall-window-frames']);
});

test('hallway window wall and trim are allocated to the hall, without moving garage surfaces',async()=>{
 const doc=await new NodeIO().read('web/assets/house/release/structure.glb');
 const expected=new Set([
  ...['002','003','004','005'].map(s=>'Proposed wall 03.'+s),
  ...['005','006','007'].map(s=>'Finish / skirting.'+s),
  'Finish / hall-right jamb','Finish / hall-right jamb.001',
  'Finish / hall-right rail','Finish / hall-right rail.001',
  'Finish / hall-right sill','Finish / hall-right mullion',
 ]);
 const nodes=doc.getRoot().listNodes().filter(n=>n.getMesh()&&(n.getExtras().release_baked==='structure-garage'||expected.has(n.getExtras().house_bake_source??n.getName())));
 const inputs=nodes.map(n=>{
  const {min,max}=getBounds(n);
  // glTF Y-up -> Blender Z-up.
  return [n.getExtras().house_bake_source??n.getName(),n.getExtras().preview_kind,[min,max].map(p=>[p[0],-p[2],p[1]])];
 });
 const groups=JSON.parse(execFileSync('python3',['-c',
  "import sys,json;sys.path.insert(0,'scene/scripts');from house_bake_groups import structural_group;print(json.dumps([structural_group(*x) for x in json.load(sys.stdin)]))"
 ],{input:JSON.stringify(inputs),encoding:'utf8'}));
 for(let i=0;i<nodes.length;i++)assert.equal(groups[i],expected.has(inputs[i][0])?'structure-hall':'structure-garage',inputs[i][0]);
 assert.equal(groups.filter(g=>g==='structure-hall').length,13);
 const removed=new Set(['007','008','009'].map(s=>'Finish / ceiling moulding.'+s));
 assert.ok(!doc.getRoot().listNodes().some(n=>removed.has(n.getExtras().house_bake_source??n.getName())), 'Removed hallway crown moulding must remain absent');
});
