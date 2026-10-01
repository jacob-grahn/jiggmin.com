// Preserve the cream ceiling bake and the hatch's painted wood grain.
// Hide old hall mouldings when an older release export is loaded.
export function finishHallSurfaces(root){
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const name=mesh.userData.house_bake_source??mesh.name.replaceAll('_',' ');
  if(/^Finish \/ ceiling moulding/.test(name)&&['structure-hall','structure-den'].includes(mesh.userData.release_baked)){mesh.visible=false;return;}
  if(name==='Attic hatch'||/^Attic floor \/ hall ceiling/.test(name))mesh.userData.houseOutlined=true;
 });
}
