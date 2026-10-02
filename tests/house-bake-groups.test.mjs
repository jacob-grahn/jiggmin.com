import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';
import {getBounds} from '@gltf-transform/functions';

test('hallway window wall and trim are allocated to the hall, without moving garage surfaces',async()=>{
 const doc=await new NodeIO().read('web/assets/house/release/structure.glb');
 const expected=new Set([
  ...['002','003','004','005'].map(s=>'Proposed wall 03.'+s),
  ...['005','006','007'].map(s=>'Finish / skirting.'+s),
  ...['007','008','009'].map(s=>'Finish / ceiling moulding.'+s),
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
 assert.equal(groups.filter(g=>g==='structure-hall').length,16);
});
