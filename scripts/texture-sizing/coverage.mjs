import * as T from 'three';

// The smaller singular value measures the least-resolved texture direction.
// Area alone misses stretched UVs and long, narrow islands.
export function minimumScale(a,b,c,d){
 const sum=a*a+b*b+c*c+d*d,det=a*d-b*c;
 const largest=(sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2;
 return largest>0?Math.abs(det)/Math.sqrt(largest):0;
}
export function textureDemand(triangle,uv,camera,viewport,texture,pixelsPerPixel=1,point){
 const surface=new T.Triangle(...triangle),normal=surface.getNormal(new T.Vector3());
 if(normal.lengthSq()<1e-12)return null;
 const center=point??surface.getMidpoint(new T.Vector3()),projected=center.clone().project(camera);
 if(projected.z<-1||projected.z>1)return null;
 const plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,center);
 function sample(dx,dy){
  const direction=new T.Vector3(projected.x+dx*2/viewport.width,projected.y-dy*2/viewport.height,.5).unproject(camera).sub(camera.position).normalize();
  const hit=new T.Ray(camera.position,direction).intersectPlane(plane,new T.Vector3());if(!hit)return null;
  if(typeof uv==='function')return uv(hit);
  const bary=surface.getBarycoord(hit,new T.Vector3());if(!bary)return null;
  return new T.Vector2().addScaledVector(uv[0],bary.x).addScaledVector(uv[1],bary.y).addScaledVector(uv[2],bary.z);
 }
 const origin=sample(0,0),x=sample(1,0),y=sample(0,1);if(!origin||!x||!y)return null;
 x.sub(origin);y.sub(origin);
 const scale=minimumScale(x.x*texture.width,y.x*texture.width,x.y*texture.height,y.y*texture.height);
 if(scale<1e-10||!Number.isFinite(scale))return null;
 return Math.max(texture.width,texture.height)*pixelsPerPixel/scale;
}
export function recommendedSize(demand,width,height,{minimum=128,maximum=8192}={}){
 const edge=Math.min(maximum,2**Math.ceil(Math.log2(Math.max(minimum,demand))));
 const scale=edge/Math.max(width,height);
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),exceedsMaximum:demand>maximum};
}

export function uvAtPoint(triangle,uv,point){
 if(typeof uv==='function')return uv(point);
 const bary=new T.Triangle(...triangle).getBarycoord(point,new T.Vector3());
 return bary?new T.Vector2().addScaledVector(uv[0],bary.x).addScaledVector(uv[1],bary.y).addScaledVector(uv[2],bary.z):null;
}
