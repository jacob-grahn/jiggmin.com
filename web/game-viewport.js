// Keep embedded games at their authored viewport size, then fit the whole
// viewport inside the CRT without stretching or clipping the game.
export function fitGameViewport(width,height,availableWidth,availableHeight){
 const scale=Math.min(availableWidth/width,availableHeight/height);
 return {scale,left:(availableWidth-width*scale)/2,top:(availableHeight-height*scale)/2};
}
