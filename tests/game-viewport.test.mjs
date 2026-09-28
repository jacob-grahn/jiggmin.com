import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitGameViewport} from '../web/game-viewport.js';

test('Platform Racing 2 fits its complete 550 by 400 viewport inside the CRT',()=>{
 const {games}=JSON.parse(readFileSync(new URL('../data/games.json',import.meta.url)));
 const game=games.find(game=>game.id==='platform-racing-2');
 assert.equal(game.embedWidth,550);assert.equal(game.embedHeight,400);
 for(const [width,height] of [[640,420],[320,240],[900,400],[300,500]]){
  const fit=fitGameViewport(game.embedWidth,game.embedHeight,width,height);
  const displayedWidth=game.embedWidth*fit.scale,displayedHeight=game.embedHeight*fit.scale;
  assert.ok(fit.left>=0&&fit.top>=0);
  assert.ok(fit.left+displayedWidth<=width+1e-10);
  assert.ok(fit.top+displayedHeight<=height+1e-10);
  assert.ok(Math.abs(displayedWidth/displayedHeight-550/400)<1e-10);
  assert.ok(Math.abs(2*fit.left+displayedWidth-width)<1e-10);
  assert.ok(Math.abs(2*fit.top+displayedHeight-height)<1e-10);
  assert.ok(Math.abs(displayedWidth-width)<1e-10||Math.abs(displayedHeight-height)<1e-10);
 }
});
