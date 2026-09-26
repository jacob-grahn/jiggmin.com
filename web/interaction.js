// Scene positions use glTF coordinates: Y is up, Z points toward the viewer.
export function inSlot(x,y,slot){return Math.abs(x-slot[0])<.087 && Math.abs(y-slot[1])<.06;}
export function playbackFile(game){return game.mainPayload?.swf?.signature ? game.mainPayload.file : game.file;}
