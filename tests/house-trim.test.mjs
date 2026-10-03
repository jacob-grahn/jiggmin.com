import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import {findDuplicateTrim,assertUniqueTrim} from '../scripts/house-source/validate-trim.mjs';

test('trim validation detects different diagonals without silently deleting source geometry',()=>{
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 const vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
 const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const board=(name,id,diagonal,translation)=>{
  const indices=faces.flatMap(([a,b,c,d])=>diagonal?[a,b,d,b,c,d]:[a,b,c,a,c,d]);
  const p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(vertices.flat())).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer));
  const node=doc.createNode(name).setMesh(doc.createMesh().addPrimitive(p)).setExtras({release_baked:'structure-hall',house_bake_id:id}).setTranslation(translation);scene.addChild(node);
 };
 board('Finish / ceiling moulding','a',false,[0,0,0]);board('Finish / ceiling moulding.001','b',true,[0,0,0]);board('Finish / ceiling moulding.002','c',false,[3,0,0]);
 assert.deepEqual(findDuplicateTrim(doc).map(r=>[r.id,r.retained]),[['b','a']]);
 assert.throws(()=>assertUniqueTrim(doc),/Duplicate trim/);
 assert.equal(doc.getRoot().listNodes().length,3,'validation must not mutate the source');
 doc.getRoot().listNodes().find(n=>n.getExtras().house_bake_id==='b').setTranslation([6,0,0]);
 assert.doesNotThrow(()=>assertUniqueTrim(doc));
});

import {execFileSync} from 'node:child_process';
test('finishing stages give every shared wall exactly one owner',()=>{
 const result=JSON.parse(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'scene/scripts');from house_trim import trim_walls_for_stage;print(json.dumps([trim_walls_for_stage(s) for s in (2,3,6,7)]))"],{encoding:'utf8'}));
 const walls=result.flat();assert.equal(new Set(walls).size,walls.length);
 assert.equal(walls.length,12,'retain trim ownership for all twelve finished walls');
 assert.ok(result[0].includes('Proposed wall 04'));assert.ok(result[0].includes('Proposed wall 02'));
});
