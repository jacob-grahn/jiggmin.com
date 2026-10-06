import {prune} from '@gltf-transform/functions';

// Match the material replacements in house-release-renderer and house-window-sky.
export function replacesWindowMaterial(node,source){
 const e=node.getExtras(),name=node.getName().replaceAll('_',' ');
 return source.startsWith('web/assets/house/release/')&&
  ((e.preview_kind==='window'&&/glass/i.test(name))||
   (source.endsWith('/scenery/basement.glb')&&/^(Rainy garden through hallway|Garden beyond window)/.test(name)));
}
export async function removeUnusedRuntimeTextures(document,source){
 const root=document.getRoot(),before=root.listTextures().length;
 for(const node of root.listNodes()){
  if(source!=='web/assets/cartridges.glb'&&!replacesWindowMaterial(node,source))continue;
  for(const p of node.getMesh()?.listPrimitives()??[]){
   // A private replacement prevents changing a map used by another mesh.
   p.setMaterial(document.createMaterial('Runtime material replacement').setBaseColorFactor([1,1,1,1]));
  }
 }
 await document.transform(prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}));
 return {removedTextures:before-root.listTextures().length};
}
