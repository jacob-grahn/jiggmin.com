// The panorama already includes the forest floor. The old yard and paving
// slabs obscure it with a flat dark strip through the windows.
export function hideExteriorGround(root){
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.preview_kind!=='site')return;
  const name=mesh.userData.house_bake_source??mesh.name.replaceAll('_',' ');
  if(/^(?:Yard(?:\.\d+)?|Road|Drive|Turnaround|Garage apron)$/.test(name))mesh.visible=false;
 });
}
