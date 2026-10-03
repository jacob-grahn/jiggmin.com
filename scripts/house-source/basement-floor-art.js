export function drawBasementFloor(ctx,width=2048){
 let seed=73491;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const height=Math.round(width*1.38),pixels=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,cloud=Math.sin(x/91+Math.sin(y/170))*Math.cos(y/133)*9;
  const grit=random(),v=106+cloud+(grit-.5)*23-(grit<.018?25:0);
  pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);ctx.save();ctx.scale(width/10,width/10);ctx.translate(5,3.7);
 const line=(points,color,size)=>{ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();};
 // Irregular branching hairline cracks; no regular tile grid.
 const cracks=[
  [[-4.9,-2.4],[-3.8,-2.15],[-3.3,-1.8],[-2.55,-1.72]],
  [[-.7,-3.55],[-.54,-2.8],[-.84,-2.2],[-.58,-1.45],[-.1,-.91],[.04,-.15],[.63,.46],[.7,1.1]],
  [[.04,-.15],[-.58,.12],[-.82,.57],[-1.34,.8]],
  [[4.8,4.3],[3.92,3.9],[3.58,3.23],[2.9,3.02],[2.6,2.58]],
  [[3.58,3.23],[3.83,2.53],[3.65,2.04]],
  [[-2.8,8.8],[-2.05,7.55],[-1.8,6.8],[-.95,6.43],[-.55,5.64],[.3,5.3],[.6,4.6]],
 ];
 for(const points of cracks){line(points,'#898d8b',.043);line(points,'#30383b',.022);}
 // Old, irregular paint spills and small satellite droplets.
 for(const [x,z,r,color] of [[2.15,.95,.24,'#9c7951'],[-.3,3.3,.20,'#bbc0b5'],[2.7,4.7,.32,'#657f87'],[-3.9,.4,.25,'#86765b'],[.55,-1.1,.13,'#a99c79']]){
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2,d=r*(.6+random()*.6);const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d*.62;i?ctx.lineTo(px,pz):ctx.moveTo(px,pz);}
  ctx.closePath();ctx.fill();
  for(let i=0;i<22;i++){const a=random()*Math.PI*2,d=r*(.9+random()*1.8);ctx.beginPath();ctx.ellipse(x+Math.cos(a)*d,z+Math.sin(a)*d,.006+random()*.019,.005+random()*.011,random()*3,0,Math.PI*2);ctx.fill();}
 }
 // A playful, human-sized taped silhouette, laid across the open floor.
 ctx.save();ctx.translate(.9,2.15);ctx.rotate(-Math.PI/2+.12);
 const body=[[-.13,-.66],[-.28,-.55],[-.62,-.73],[-.82,-.53],[-.85,-.20],[-.71,-.15],[-.60,-.46],[-.37,-.31],[-.27,.16],[-.32,.43],[-.48,.86],[-.38,1.06],[-.18,1.04],[-.17,.79],[0,.40],[.14,.72],[.23,1.06],[.43,1.05],[.48,.91],[.34,.42],[.27,.12],[.29,-.25],[.53,-.04],[.76,-.12],[.76,-.28],[.57,-.28],[.32,-.57],[.13,-.66]];
 ctx.lineCap='square';ctx.lineJoin='miter';line([...body,body[0]],'#eeeeea',.039);
 const head=Array.from({length:13},(_,i)=>[Math.sin(i/12*Math.PI*2)*.17,-.83-Math.cos(i/12*Math.PI*2)*.20]);line(head,'#eeeeea',.039);
 ctx.restore();ctx.restore();
}

