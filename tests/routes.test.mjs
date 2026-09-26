import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveRoute,writeGameUrl} from '../web/routes.js';
const games=JSON.parse(readFileSync(new URL('../data/games.json',import.meta.url))).games;
test('Every game deep link resolves, including trailing slashes and encoded characters',()=>{
 for(const game of games){
  assert.equal(resolveRoute('/'+game.id,games).game,game);
  assert.equal(resolveRoute('/'+game.id+'/',games).game,game);
  const html=readFileSync(new URL('../dist/'+game.id+'/index.html',import.meta.url),'utf8');
  assert.match(html,/<base href="\/">/);
 }
 assert.equal(resolveRoute('/%65ffing-meteors',games).game.id,'effing-meteors');
});
test('Home, unknown slugs, malformed encoding, and nested paths are handled safely',()=>{
 for(const path of ['/','/index.html'])assert.equal(resolveRoute(path,games).kind,'home');
 for(const path of ['/no-such-game','/%zz','/games/effing-meteors','/effing-meteors/extra'])assert.equal(resolveRoute(path,games).kind,'missing');
});
test('Insert, replace, and eject create navigable URLs without duplicate entries',()=>{
 const location={pathname:'/',search:'?source=archive',hash:''},entries=[];
 const history={pushState(_state,_unused,url){entries.push(url);location.pathname=new URL(url,'http://localhost').pathname;}};
 writeGameUrl('effing-meteors',location,history);
 writeGameUrl('effing-meteors',location,history);
 writeGameUrl('uber-breakout',location,history);
 writeGameUrl(null,location,history);
 assert.deepEqual(entries,['/effing-meteors?source=archive','/uber-breakout?source=archive','/?source=archive']);
 assert.equal(resolveRoute(new URL(entries[0],'http://localhost').pathname,games).game.id,'effing-meteors');
 location.pathname='/effing-meteors/';writeGameUrl('effing-meteors',location,history);assert.equal(entries.length,3);
});
