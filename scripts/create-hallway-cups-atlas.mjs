import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
// A standalone, deterministic atlas: no house textures are opened or rebaked.
const width=1024,height=512,pixels=Buffer.alloc(width*height*3);
let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const noise=(random()-.5)*16,metal=x<512;
 let rgb;
 if(metal){
  const v=1-y/512;
  const mottling=Math.sin(x*.73+Math.sin(y*.41)*2)*Math.sin(y*.81+Math.sin(x*.37))*9;
  const tarnish=Math.max(0,Math.sin(x*.071+y*.113)*Math.sin(y*.097-x*.053));
  const pit=random()<.06?-(12+random()*25):0;
  const brushed=Math.sin(y*2.3+Math.sin(x*.13))*3;
  const band=v<.19?.73:v<.22?1.15:1;
  const base=(130+mottling+noise*.65+pit+brushed)*band;
  const patina=tarnish*26;
  rgb=[base-patina*.65,base-patina*.92,base-patina*1.12];
 }else{
  const u=x-512,warp=Math.sin(u*Math.PI/4),weft=Math.sin(y*Math.PI/4),over=(Math.floor(u/8)+Math.floor(y/8))%2;
  const yarn=(over?warp:weft)*15+Math.abs(over?weft:warp)*8,groove=u%8===0||y%8===0?-23:0;
  rgb=[153+yarn+noise+groove,27+yarn*.28+noise*.25+groove*.3,35+yarn*.32+noise*.25+groove*.4];
 }
 const i=(y*width+x)*3;rgb.forEach((v,j)=>pixels[i+j]=Math.max(0,Math.min(255,v)));
}
const dir='web/assets/house/hallway-cups';await mkdir(dir,{recursive:true});
await sharp(pixels,{raw:{width,height,channels:3}}).webp({lossless:true}).toFile(`${dir}/atlas.webp`);
await writeFile(`${dir}/atlas.json`,JSON.stringify({room:'private-hall',size:[width,height],regions:{metal:[0,0,.5,1],wovenBall:[.5,0,.5,1]},source:'scripts/create-hallway-cups-atlas.mjs'},null,2)+'\n');
