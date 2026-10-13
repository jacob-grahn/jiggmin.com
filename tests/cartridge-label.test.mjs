import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {titleScreenFrame,CARTRIDGE_LABEL_ASPECT} from '../web/cartridge-label.js';
const {games}=JSON.parse(fs.readFileSync('data/games.json'));
test('title crops retain all lettering after production image resizing',async()=>{
 for(const game of games){
  const label=game.cartridgeLabel;if(!label.titleBounds)continue;
  const image=await sharp('dist/'+label.file).metadata();
  const [x,y,w,h]=titleScreenFrame(image,label);
  const [sw,sh]=label.captureSize;
  const [tx,ty,tw,th]=label.titleBounds.map((v,i)=>v*(i%2?image.height/sh:image.width/sw));
  assert.ok(x>=0&&y>=0&&x+w<=image.width+1e-6&&y+h<=image.height+1e-6,game.id+' stays inside delivered image');
  assert.ok(x<=tx+1e-6&&y<=ty+1e-6&&x+w>=tx+tw-1e-6&&y+h>=ty+th-1e-6,game.id+' preserves all title lettering');
  assert.ok(Math.abs(Math.min(512/w,512/(h*CARTRIDGE_LABEL_ASPECT))-Math.min(512/tw,512/(th*CARTRIDGE_LABEL_ASPECT)))<1e-6,game.id+' keeps maximum title size');
 }
});
test('Effing Hail keeps real background above and below its title',()=>{
 const game=games.find(g=>g.id==='effing-hail'),label=game.cartridgeLabel;
 const [x,y,w,h]=titleScreenFrame({width:600,height:700},label);
 assert.equal(y,0);assert.equal(x,40);assert.equal(w,520);
 assert.ok(h>400,'keep the subtitle and surrounding background instead of a narrow text strip');
});
