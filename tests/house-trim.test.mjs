import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import {filterFace,protectUVTriangles,findDuplicateTrim,assertUniqueTrim} from '../scripts/filter-house-trim.mjs';

test('thin-face filtering removes mottling while retaining its lighting gradient and protecting neighboring surfaces',()=>{
 const width=24,height=64,channels=3,data=Buffer.alloc(width*height*channels),out=Buffer.from(data);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=0;k<3;k++)data[(y*width+x)*3+k]=x<10?Math.min(255,45+y*2+(y%2?80:0)):[20,110,75][k];
 data.copy(out);
 const mask=protectUVTriangles([[[.5,0],[1,0],[1,1]],[[.5,0],[1,1],[.5,1]]],width,height);
 assert.ok(filterFace(data,out,{width,height,channels},[[.125,.05],[.35,.05],[.35,.95],[.125,.95]],mask));
 for(let i=0;i<mask.length;i++)if(mask[i])assert.deepEqual(out.subarray(i*3,i*3+3),data.subarray(i*3,i*3+3));
 const pixel=(buffer,y)=>buffer[(y*width+5)*3];
 assert.ok(Math.abs(pixel(out,30)-pixel(out,31))<10,'alternating bright patches should be smoothed');
 assert.ok(pixel(out,50)>pixel(out,10)+30,'the baked illumination gradient should remain');
 assert.deepEqual(out.subarray((30*width+20)*3,(30*width+20)*3+3),Buffer.from([20,110,75]));
});

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

import {filterCeilingFace} from '../scripts/filter-house-trim.mjs';
test('ceiling cleanup smooths a broad plane in both directions without changing adjacent surfaces',()=>{
 const width=40,height=40,channels=3,data=Buffer.alloc(width*height*channels);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=0;k<3;k++)data[(y*width+x)*3+k]=25+x+y+((x+y)%2?100:0);
 const out=Buffer.from(data),protectedPixels=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=30;x<width;x++)protectedPixels[y*width+x]=1;
 assert.ok(filterCeilingFace(data,out,{width,height,channels},[[.1,.1],[.7,.1],[.7,.9],[.1,.9]],protectedPixels));
 const pixel=(x,y)=>out[(y*width+x)*3];
 assert.ok(Math.abs(pixel(15,15)-pixel(16,15))<6);assert.ok(Math.abs(pixel(15,15)-pixel(15,16))<6);
 assert.ok(pixel(25,25)>pixel(10,10)+15,'preserve a broad illumination gradient');
 for(let i=0;i<protectedPixels.length;i++)if(protectedPixels[i])assert.deepEqual(out.subarray(i*3,i*3+3),data.subarray(i*3,i*3+3));
});
