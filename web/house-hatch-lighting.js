// Carry the closed-pose lightmap with the moving hatch, keeping its hinge intact.
export function applyHatchLighting(structure,reference){
 let hatch,patch;
 structure.traverse(o=>{if(o.isMesh&&(o.userData.house_bake_source??o.name.replaceAll('_',' '))==='Attic hatch')hatch=o;});
 reference.traverse(o=>{if(o.isMesh&&o.userData.hatch_reference_baked)patch=o;});
 if(!hatch||!patch)throw Error('Missing attic hatch lighting reference');
 hatch.geometry.computeBoundingBox();patch.geometry.computeBoundingBox();
 const a=hatch.geometry.boundingBox,b=patch.geometry.boundingBox;
 if(a.min.distanceTo(b.min)>.002||a.max.distanceTo(b.max)>.002)throw Error('Hatch lighting does not match its geometry');
 const original=hatch.geometry;hatch.geometry=patch.geometry;hatch.material=patch.material;
 Object.assign(hatch.userData,{release_baked:'attic-hatch-closed',hatch_reference_baked:true,houseOutlined:true});
 original.dispose();
}
