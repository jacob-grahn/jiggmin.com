// A room owns its imported resources even after props and doors are reparented.
export function createRoomResources(){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 function texture(value){if(value?.isTexture)textures.add(value);else if(Array.isArray(value))value.forEach(texture);}
 return {
  capture(root){root.traverse(object=>{
   if(object.geometry)geometries.add(object.geometry);
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!material)continue;materials.add(material);
    Object.values(material).forEach(texture);
    for(const uniform of Object.values(material.uniforms??{}))texture(uniform.value);
   }
  });},
  dispose(){
   geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
   geometries.clear();materials.clear();textures.clear();
  },
 };
}
