import sharp from 'sharp';

function color(image,u,v){
 // glTF atlas coordinates use the same top-left image convention as GLTFLoader.
 u=Math.max(0,Math.min(1,u));v=Math.max(0,Math.min(1,v));
 const x=u*image.width-.5,y=v*image.height-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
 const pixel=(x,y,c)=>image.data[(Math.max(0,Math.min(image.height-1,y))*image.width+Math.max(0,Math.min(image.width-1,x)))*4+c];
 return [0,1,2].map(c=>(pixel(x0,y0,c)*(1-fx)+pixel(x0+1,y0,c)*fx)*(1-fy)+(pixel(x0,y0+1,c)*(1-fx)+pixel(x0+1,y0+1,c)*fx)*fy);
}
export function sampledError(source,candidate,coordinates){
 let squared=0;const errors=[];
 for(const [u,v] of coordinates){const a=color(source,u,v),b=color(candidate,u,v),difference=a.map((n,i)=>Math.abs(n-b[i]));squared+=difference.reduce((s,n)=>s+n*n,0);errors.push(Math.max(...difference));}
 errors.sort((a,b)=>a-b);
 return {rms:Math.sqrt(squared/(coordinates.length*3)),p95:errors[Math.min(errors.length-1,Math.floor(errors.length*.95))]??0};
}
export async function detailEstimate(image,coordinates,{minimum=128,rmsLimit=2.5,p95Limit=6}={}){
 if(!coordinates.length)return null;
 const decode=async(width,height)=>{const {data,info}=await sharp(image).resize({width,height,fit:'fill',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};};
 const meta=await sharp(image).metadata(),source=await decode(meta.width,meta.height),maximum=Math.max(meta.width,meta.height),candidates=[];
 const edges=new Set([maximum]);
 for(let edge=Math.min(minimum,maximum);edge<maximum;edge*=2)edges.add(edge);
 for(let edge=maximum/2;edge>=minimum;edge/=2)edges.add(Math.round(edge));
 for(const edge of [...edges].sort((a,b)=>a-b)){const scale=edge/maximum;candidates.push([Math.max(1,Math.round(meta.width*scale)),Math.max(1,Math.round(meta.height*scale))]);}
 for(const [width,height] of candidates){
  const candidate=width===meta.width&&height===meta.height?source:await decode(width,height),error=sampledError(source,candidate,coordinates);
  if(error.rms<=rmsLimit&&error.p95<=p95Limit)return {width,height,samples:coordinates.length,rms:+error.rms.toFixed(2),p95:+error.p95.toFixed(2),rmsLimit,p95Limit};
 }
 return null;
}
