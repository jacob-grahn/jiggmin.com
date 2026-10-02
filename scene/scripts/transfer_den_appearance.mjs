// Transfer the original illustrated plates onto the lamp and both left-window
// curtains. Only camera-visible texels are painted; hidden surfaces keep the bake.
// No projection shader is used at runtime. Run from the repository root.
import {NodeIO} from '@gltf-transform/core';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

const io=new NodeIO();
const doc=await io.read('web/assets/den-baked.glb');
const original=await io.read('web/assets/room.glb');
const carts=await io.read('web/assets/cartridges.glb');
const cameraNode=carts.getRoot().listNodes().find(n=>n.getCamera());
const camera=new THREE.PerspectiveCamera(cameraNode.getCamera().getYFov()*180/Math.PI,1.6,.01,100);
camera.matrixWorld.fromArray(cameraNode.getWorldMatrix());
camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
const origin=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
const extras=original.getRoot().listNodes().find(n=>n.getExtras().role==='room_geometry').getExtras();
const project=new THREE.Matrix4().makeScale(...extras.bakeScale,1)
 .multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
async function pixels(path){return sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});}
const plates={architecture:await pixels('web/assets/room-lighting.webp'),lamp:await pixels('web/assets/room-props.webp')};
const meshes=[];
for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(primitive.getAttribute('POSITION').getArray().slice(),3));
 geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray().slice(),1));
 geometry.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
 meshes.push({node,primitive,geometry,bvh:new MeshBVH(geometry)});
}
const ray=new THREE.Ray(),direction=new THREE.Vector3(),point=new THREE.Vector3(),projected=new THREE.Vector3();
function visible(p){
 direction.subVectors(p,origin);const distance=direction.length();ray.set(origin,direction.divideScalar(distance));
 for(const mesh of meshes){const hit=mesh.bvh.raycastFirst(ray,THREE.DoubleSide,0,distance-.003);if(hit)return false;}
 return true;
}
function curtain(v){
 // World-space bounds of the two evaluated Soft hanging curtain objects in
 // midnight-den-illustrated.blend, converted from Blender Z-up to glTF Y-up.
 return v.y>=.8292&&v.y<=3.9602&&v.z>=-1.4732&&v.z<=-1.3268&&
  ((v.x>=-3.7217&&v.x<=-3.2383)||(v.x>=-1.697&&v.x<=-1.363));
}
const stats={};
for(const {node,primitive,geometry} of meshes){
 const key=node.getExtras().den_atlas;if(!['architecture','lamp'].includes(key))continue;
 const texture=primitive.getMaterial().getEmissiveTexture();
 const {data,info}=await pixels(texture.getImage());const {width,height,channels}=info;
 const mask=new Uint8Array(width*height),uv=primitive.getAttribute('TEXCOORD_0').getArray();
 const position=geometry.getAttribute('position'),indices=geometry.index.array;
 const plate=plates[key],pw=plate.info.width,ph=plate.info.height,pc=plate.info.channels;
 const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
 let triangles=0,painted=0;
 for(let i=0;i<indices.length;i+=3){
  const ids=[indices[i],indices[i+1],indices[i+2]];
  vertices.forEach((v,j)=>v.fromBufferAttribute(position,ids[j]));
  if(key==='architecture'&&!vertices.every(curtain))continue;
  triangles++;
  const [a,b,c]=ids.map(id=>[uv[id*2]*width-.5,uv[id*2+1]*height-.5]);
  const determinant=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(determinant)<1e-8)continue;
  const xmin=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0]))),xmax=Math.min(width-1,Math.floor(Math.max(a[0],b[0],c[0])));
  const ymin=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1]))),ymax=Math.min(height-1,Math.floor(Math.max(a[1],b[1],c[1])));
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const wa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/determinant;
   const wb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/determinant,wc=1-wa-wb;
   if(Math.min(wa,wb,wc)<-1e-6)continue;
   point.copy(vertices[0]).multiplyScalar(wa).addScaledVector(vertices[1],wb).addScaledVector(vertices[2],wc);
   if(!visible(point))continue;
   projected.copy(point).applyMatrix4(project);
   let u=projected.x*.5+.5,v=projected.y*.5+.5;
   if(key==='lamp'){const [cx,cy,cw,ch]=extras.propBakeRect;u=(u-cx)/cw;v=(v-cy)/ch;}
   if(u<0||u>1||v<0||v>1)continue;
   const px=Math.max(0,Math.min(pw-1,u*pw-.5)),py=Math.max(0,Math.min(ph-1,(1-v)*ph-.5));
   const sx=Math.floor(px),sy=Math.floor(py),fx=px-sx,fy=py-sy;
   for(let channel=0;channel<3;channel++){
    const sample=(xx,yy)=>plate.data[(Math.min(ph-1,yy)*pw+Math.min(pw-1,xx))*pc+channel];
    data[(y*width+x)*channels+channel]=Math.round((sample(sx,sy)*(1-fx)+sample(sx+1,sy)*fx)*(1-fy)+(sample(sx,sy+1)*(1-fx)+sample(sx+1,sy+1)*fx)*fy);
   }
   mask[y*width+x]=1;painted++;
  }
 }
 // A small gutter avoids pale seams under linear filtering. Smart-UV islands
 // have a .004 margin, wider than this three-texel dilation.
 for(let pass=0;pass<3;pass++){
  const next=mask.slice();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const i=y*width+x;if(mask[i])continue;
   const from=[i-1,i+1,i-width,i+width].find(j=>mask[j]);if(from===undefined)continue;
   for(let k=0;k<channels;k++)data[i*channels+k]=data[from*channels+k];next[i]=1;
  }
  mask.set(next);
 }
 if(!painted)throw new Error('No visible target texels: '+key);
 texture.setImage(await sharp(data,{raw:info}).png().toBuffer()).setMimeType('image/png');
 node.setExtras({...node.getExtras(),den_appearance_transfer:key==='lamp'?'lamp':'curtains'});
 stats[key]={triangles,painted,width,height};console.log(key,stats[key]);
}
await io.write('web/assets/den-transferred.glb',doc);
await writeFile('scene/renders/den-uv-bake/transfer-report.json',JSON.stringify(stats,null,2)+'\n');
