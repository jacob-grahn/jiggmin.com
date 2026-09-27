// Three.js selects lights per camera, not per receiving mesh. Render each room
// separately with its own lights, retaining depth so walls still occlude rooms.
export const ROOM_LAYERS={hallway:1,workshop:2,basement:3,attic:4,den:5};
export function assignRoomLighting(roots,id){
 for(const root of roots)root.traverse(object=>object.layers.set(ROOM_LAYERS[id]));
}
export function renderIsolatedRooms(renderer,world,camera,roomIds){
 const mask=camera.layers.mask,autoClear=renderer.autoClear;
 renderer.autoClear=false;
 try{
  renderer.clear();
  for(const layer of [0,...roomIds.map(id=>ROOM_LAYERS[id])]){
   camera.layers.set(layer);renderer.render(world,camera);
  }
 }finally{camera.layers.mask=mask;renderer.autoClear=autoClear;}
}
