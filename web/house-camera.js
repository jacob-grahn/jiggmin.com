// The den composes its view with an extra projection shift. Preserve that
// framing when resizing the exploration camera so both renderers agree.
export function resizeHouseCamera(camera,aspect){
 const {elements}=camera.projectionMatrix,x=elements[8],y=elements[9];
 camera.updateProjectionMatrix();
 const shiftX=x-elements[8],shiftY=y-elements[9];
 camera.aspect=aspect;camera.updateProjectionMatrix();
 elements[8]+=shiftX;elements[9]+=shiftY;
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
