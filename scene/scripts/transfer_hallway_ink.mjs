// Bake the den-style hallway line plate into existing room lightmaps.
// Run render_hallway_ink.py first. Original release files remain unchanged.
import {NodeIO} from '@gltf-transform/core';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const style=process.argv.includes('--style');
const io=new NodeIO(),out=style?'web/assets/house/hallway-style':'web/assets/house/hallway-ink';await mkdir(out,{recursive:true});
const input=style?out:'web/assets/house/release';
const config=JSON.parse(await readFile('scene/renders/hallway-ink/camera.json'));
const {view,aspect}=config,camera=new THREE.PerspectiveCamera(view.fov,aspect,.035,250);
camera.position.fromArray(view.position);camera.lookAt(new THREE.Vector3(...view.target));camera.updateMatrixWorld(true);
const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
const plate=await sharp('scene/renders/hallway-ink/lines.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const {width:pw,height:ph,channels:pc}=plate.info;
function alpha(x,y){
 if(x<0||y<0||x>=pw-1||y>=ph-1)return 0;
 const sx=Math.floor(x),sy=Math.floor(y),fx=x-sx,fy=y-sy;
 const at=(xx,yy)=>1-plate.data[(yy*pw+xx)*pc]/255;
 return (at(sx,sy)*(1-fx)+at(sx+1,sy)*fx)*(1-fy)+(at(sx,sy+1)*(1-fx)+at(sx+1,sy+1)*fx)*fy;
}
const docs=new Map(),parts=[],positions=[],indices=[];
for(const name of ['structure','hallway']){
 const doc=await io.read(`${input}/${name}.glb`);docs.set(name,doc);
 for(const node of doc.getRoot().listNodes()){
  const e=node.getExtras(),label=(e.house_bake_source??e.source_object??node.getName()).replaceAll('_',' ');
  if((label.startsWith('Finish / ceiling moulding')&&['structure-hall','structure-den'].includes(e.release_baked))||e.preview_kind==='ladder'||(e.preview_kind==='window'&&/glass/i.test(label)))continue;
  for(const primitive of node.getMesh()?.listPrimitives()??[]){
   const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),pos=primitive.getAttribute('POSITION'),idx=primitive.getIndices().getArray();
   const world=Array.from({length:pos.getCount()},(_,i)=>new THREE.Vector3().fromArray(pos.getArray(),i*3).applyMatrix4(matrix));
   const base=positions.length/3;for(const p of world)positions.push(p.x,p.y,p.z);for(const i of idx)indices.push(base+i);
   if(['structure-hall','original-hallway'].includes(e.release_baked))parts.push({node,primitive,world,idx});
  }
 }
}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
const bvh=new MeshBVH(geometry),ray=new THREE.Ray(),direction=new THREE.Vector3(),sample=new THREE.Vector3();
function visible(point,sx,sy){
 direction.subVectors(point,camera.position);const distance=direction.length();ray.set(camera.position,direction.divideScalar(distance));
 if(bvh.raycastFirst(ray,THREE.DoubleSide,0,distance-.003))return false;
 // Keep the foreground half of silhouette strokes. The outside half belongs
 // to the foreground object's contour, not the wall behind it.
 for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2]]){
  sample.set((sx+dx+.5)/pw*2-1,1-(sy+dy+.5)/ph*2,.5).unproject(camera);
  ray.set(camera.position,direction.subVectors(sample,camera.position).normalize());
  if(bvh.raycastFirst(ray,THREE.DoubleSide,0,distance-.04))return false;
 }
 return true;
}
const atlases=new Map();
for(const {primitive} of parts){
 const texture=primitive.getMaterial().getEmissiveTexture()??primitive.getMaterial().getBaseColorTexture();if(!texture)continue;
 if(!atlases.has(texture)){
  const image=await sharp(texture.getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true});
  atlases.set(texture,{...image,mask:new Uint8Array(image.info.width*image.info.height),occupied:new Uint8Array(image.info.width*image.info.height)});
 }
}
const p=new THREE.Vector3(),q=new THREE.Vector3();let samples=0,affected=0;
for(const {node,primitive,world,idx} of parts){
 const texture=primitive.getMaterial().getEmissiveTexture()??primitive.getMaterial().getBaseColorTexture(),atlas=atlases.get(texture);if(!atlas)continue;
 const {width:w,height:h}=atlas.info,uv=primitive.getAttribute('TEXCOORD_0').getArray();let count=0;
 for(let i=0;i<idx.length;i+=3){
  const ids=[idx[i],idx[i+1],idx[i+2]],v=ids.map(id=>world[id]);
  const [a,b,c]=ids.map(id=>[uv[id*2]*w-.5,uv[id*2+1]*h-.5]);
  const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-8)continue;
  for(let y=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])));y<=Math.min(h-1,Math.floor(Math.max(a[1],b[1],c[1])));y++)
  for(let x=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])));x<=Math.min(w-1,Math.floor(Math.max(a[0],b[0],c[0])));x++){
   const wa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,wb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,wc=1-wa-wb;
   if(Math.min(wa,wb,wc)<-1e-6)continue;const offset=y*w+x;atlas.occupied[offset]=1;
   p.copy(v[0]).multiplyScalar(wa).addScaledVector(v[1],wb).addScaledVector(v[2],wc);q.copy(p).applyMatrix4(projection);
   if(q.z< -1||q.z>1)continue;const sx=(q.x*.5+.5)*pw-.5,sy=(.5-q.y*.5)*ph-.5,strength=alpha(sx,sy);
   if(strength<.035||!visible(p,sx,sy))continue;
   atlas.mask[offset]=Math.max(atlas.mask[offset],Math.round(strength*255));count++;samples++;
  }
 }
 if(count){node.setExtras({...node.getExtras(),hallway_ink_transfer:true});affected++;}
}
let changedAtlases=0;
for(const [texture,atlas] of atlases){
 const {width:w,height:h,channels}=atlas.info;if(!atlas.mask.some(v=>v))continue;changedAtlases++;
 for(let pass=0;pass<3;pass++){
  const next=atlas.mask.slice();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(atlas.occupied[i])continue;next[i]=Math.max(atlas.mask[i],atlas.mask[i-1],atlas.mask[i+1],atlas.mask[i-w],atlas.mask[i+w]);}
  atlas.mask=next;
 }
 for(let i=0;i<atlas.mask.length;i++)if(atlas.mask[i]){
  const strength=atlas.mask[i]/255;
  for(let c=0;c<3;c++)atlas.data[i*channels+c]=Math.round(atlas.data[i*channels+c]*(1-strength)+[1,1,2][c]*strength);
 }
 texture.setImage(await sharp(atlas.data,{raw:atlas.info}).png().toBuffer()).setMimeType('image/png');
}
if(samples<100)throw new Error('Insufficient visible ink samples: '+samples);
for(const [name,doc] of docs)await io.write(`${out}/${name}.glb`,doc);
const report={samples,affected,changedAtlases,view,aspect,source:'render_hallway_ink.py',runtimeProjection:false};
await writeFile(`scene/renders/${style?'hallway-style':'hallway-ink'}/transfer-report.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
