// Scene positions use glTF coordinates: Y is up, Z points toward the viewer.
// The CSS indicator and hit test share one camera-scaled ellipse.
export function slotTarget(center,aspect=1.6,zoom=1){
 return {center,width:.15*zoom*1.6/aspect,height:.07*zoom};
}
export function inSlot(x,y,target,scale=1){
 const dx=(x-target.center[0])/(target.width*scale/2);
 const dy=(y-target.center[1])/(target.height*scale/2);
 return dx*dx+dy*dy<=1;
}
export function playbackFile(game){return game.playback?.file ?? (game.mainPayload?.swf?.signature ? game.mainPayload.file : game.file);}
