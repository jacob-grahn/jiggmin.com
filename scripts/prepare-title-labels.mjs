// Convert reviewed browser captures to lossless runtime labels. Screenshots are
// taken interactively with tests/fixtures/title-screen-capture.html.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const captures=path.join(root,'scene/renders/title-screens');
const catalogPath=path.join(root,'data/games.json');
const catalogText=await fs.readFile(catalogPath,'utf8');
const catalog=JSON.parse(catalogText);
const framing=JSON.parse(await fs.readFile(path.join(root,'data/cartridge-title-framing.json'),'utf8'));
const openingScreens=new Set(['musical-evenizer','kongregate-racing','click-upon-dots']);
for(const game of catalog.games){
 const source=path.join(captures,game.id+'.jpg');
 let input=await fs.readFile(source);
 if(game.id==='platform-racing-3'){
  // Use only the generated replacement for the login box. The logo and all
  // surrounding artwork remain pixels from the original browser screenshot.
  const patch=await sharp(path.join(captures,'platform-racing-3-cleanup.png'))
   .resize(675,480).extract({left:196,top:251,width:277,height:84}).toBuffer();
  input=await sharp(input).composite([{input:patch,left:196,top:251}]).png().toBuffer();
 }
 if(game.id==='uber-breakout-2'){
  const clean=await sharp(path.join(captures,'uber-breakout-2-cleanup.png')).resize(550,400).png().toBuffer();
  const regions=[[215,98,111,23],[178,142,184,22],[198,235,141,23],[230,275,78,24]];
  const patches=await Promise.all(regions.map(async([left,top,width,height])=>({
   input:await sharp(clean).extract({left,top,width,height}).toBuffer(),left,top
  })));
  input=await sharp(input).composite(patches).png().toBuffer();
 }
 const file=`web/assets/labels/${game.id}-title-screen${game.id==='uber-breakout-2'?'-v2':''}.webp`;
 await sharp(input).webp({lossless:true}).toFile(path.join(root,file));
 game.cartridgeLabel={file,style:openingScreens.has(game.id)?'opening-screen':'title-screen',
  capturedAt:'2026-10-13',captureSize:[game.embedWidth,game.embedHeight],source:game.id==='the-game-of-disorientation'?game.resolvedPage:game.embedUrl??(game.playback?.file??game.mainPayload?.file??game.file)};
 Object.assign(game.cartridgeLabel,framing[game.id]);
 if(game.id==='uber-breakout-2')game.cartridgeLabel.cleanup='Four menu button texts removed with imagegen; only those small rectangles composited into the original capture.';
 if(game.id==='platform-racing-3')game.cartridgeLabel.cleanup='Login status box removed with imagegen; only that rectangle composited into the original capture.';
}
let index=0;
await fs.writeFile(catalogPath,catalogText.replace(/"cartridgeLabel": \{[^}]*\}/g,()=>
 '"cartridgeLabel": '+JSON.stringify(catalog.games[index++].cartridgeLabel,null,2).replaceAll('\n','\n      ')));
console.log(`Prepared ${catalog.games.length} screenshot labels.`);
