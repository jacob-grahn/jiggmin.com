import sharp from 'sharp';
import {drawBasementFloor} from './basement-floor-art.js';
// Small SVG-backed drawing surface for deterministic source artwork, not a browser canvas.
export async function floorTexture(width=2048){
 const height=Math.round(width*1.38),elements=[],stack=[];let transform='',path='',pixels;
 const ctx={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',lineJoin:'miter',
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:p=>{pixels=p.data;},
  save(){stack.push(transform);},restore(){transform=stack.pop();},scale(x,y){transform+=` scale(${x} ${y})`;},translate(x,y){transform+=` translate(${x} ${y})`;},rotate(a){transform+=` rotate(${a*180/Math.PI})`;},
  beginPath(){path='';},moveTo(x,y){path+=`M${x},${y} `;},lineTo(x,y){path+=`L${x},${y} `;},closePath(){path+='Z';},
  ellipse(x,y,rx,ry,a){const start=[x+rx*Math.cos(a),y+rx*Math.sin(a)],end=[x-rx*Math.cos(a),y-rx*Math.sin(a)];path+=`M${start} A${rx},${ry} ${a*180/Math.PI} 1 0 ${end} A${rx},${ry} ${a*180/Math.PI} 1 0 ${start} Z`;},
  fill(){elements.push(`<path d="${path}" transform="${transform}" fill="${this.fillStyle}"/>`);},
  stroke(){elements.push(`<path d="${path}" transform="${transform}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"/>`);}
 };drawBasementFloor(ctx,width);
 return sharp(Buffer.from(pixels),{raw:{width,height,channels:4}}).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${elements.join('')}</svg>`)}]).png().toBuffer();
}
