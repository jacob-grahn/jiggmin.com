import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
export const textureSlots=[['baseColor','getBaseColorTexture','getBaseColorTextureInfo'],['emissive','getEmissiveTexture','getEmissiveTextureInfo'],['normal','getNormalTexture','getNormalTextureInfo'],['roughness','getMetallicRoughnessTexture','getMetallicRoughnessTextureInfo'],['occlusion','getOcclusionTexture','getOcclusionTextureInfo']];
export function projectedUV(matrix){return point=>{const p=new T.Vector4(...point.toArray(),1).applyMatrix4(matrix);return new T.Vector2(T.MathUtils.clamp(p.x/p.w*.5+.5,.0001,.9999),T.MathUtils.clamp(p.y/p.w*.5+.5,.0001,.9999));};}
export async function assembleScene(inputs,registry){
 const positions=[],indices=[],ranges=[];
 for(const {path,doc,projector,transform} of inputs)for(const node of doc.getRoot().listNodes()){
  if(!node.getMesh()||/glass|^Garden beyond window/i.test(node.getName()))continue;
  const matrix=new T.Matrix4().fromArray(node.getWorldMatrix()),extras=node.getExtras();
  if(transform)matrix.premultiply(transform);
  const movable=!extras.release_baked&&!extras.bake_connection&&(extras.prop_assembly||extras.bake_static===false||extras.prop_mode==='throw');
  for(const primitive of node.getMesh().listPrimitives()){
   if(primitive.getMode()!==4)continue;
   const position=primitive.getAttribute('POSITION'),index=primitive.getIndices(),start=indices.length/3,offset=positions.length/3,layers=[];
   for(let i=0;i<position.getCount();i++)positions.push(...new T.Vector3().fromArray(position.getElement(i,[])).applyMatrix4(matrix).toArray());
   for(let i=0;i<(index?.getCount()??position.getCount());i++)indices.push(offset+(index?index.getScalar(i):i));
   const material=primitive.getMaterial(),baked=extras.release_baked;
   if(projector){
    const source=projector(node);if(source)layers.push(source);
   }else if(material){
    for(const [slot,getTexture,getInfo] of textureSlots){
     const texture=material[getTexture]();if(!texture||(baked&&slot!=='emissive'))continue;
     const info=material[getInfo](),uv=primitive.getAttribute(`TEXCOORD_${info.getTexCoord()}`);if(!uv)continue;
     const id=`${path}#${doc.getRoot().listTextures().indexOf(texture)}`;
     if(!registry.has(id)){
      const metadata=await sharp(texture.getImage()).metadata();
      registry.set(id,{id,path,name:texture.getName(),width:metadata.width,height:metadata.height,image:texture.getImage(),hash:createHash('sha256').update(texture.getImage()).digest('hex'),wrapS:info.getWrapS(),wrapT:info.getWrapT(),slots:new Set(),samples:[],objects:new Map(),views:new Set()});
     }
     const record=registry.get(id);record.slots.add(slot);
     const transform=info.getExtension('KHR_texture_transform');
     layers.push({id,slot,uv,transform});
    }
   }
   ranges.push({start,end:indices.length/3,path,name:node.getName(),primitive,index,offset,layers,movable});
  }
 }
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setIndex(indices);
 const bvh=new MeshBVH(geometry,{indirect:true,targetLeafSize:8});
 function rangeFor(face){let lo=0,hi=ranges.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(face>=ranges[mid].end)lo=mid+1;else hi=mid;}return ranges[lo];}
 function triangle(face){return [0,1,2].map(k=>new T.Vector3().fromBufferAttribute(geometry.attributes.position,geometry.index.getX(face*3+k)));}
 function uvFor(range,layer,face){
  if(layer.project)return layer.project;
  return [0,1,2].map(k=>{
   const index=(face-range.start)*3+k,v=layer.uv.getElement(range.index?range.index.getScalar(index):index,[]),p=new T.Vector2(...v);
   if(layer.transform){const offset=layer.transform.getOffset(),scale=layer.transform.getScale(),rotation=layer.transform.getRotation(),u=p.x*scale[0],v=p.y*scale[1];p.set(Math.cos(rotation)*u-Math.sin(rotation)*v+offset[0],Math.sin(rotation)*u+Math.cos(rotation)*v+offset[1]);}
   return p;
  });
 }
 return {geometry,bvh,ranges,rangeFor,triangle,uvFor};
}
