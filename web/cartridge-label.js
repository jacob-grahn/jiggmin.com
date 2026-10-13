// The square texture is displayed on a 0.385 × 0.313 m label. Compensate
// for that physical aspect ratio so screenshots retain their original shapes.
export const CARTRIDGE_LABEL_ASPECT=.385/.313;
export function titleScreenFrame(image,label){
 const [sourceWidth,sourceHeight]=label.captureSize??[image.width,image.height];
 const bounds=label.titleBounds??[0,0,sourceWidth,sourceHeight];
 // Production WebP compression may resize each capture. Map authored bounds
 // to the decoded image dimensions before selecting the source rectangle.
 const [x,y,width,height]=bounds.map((value,index)=>value*(index%2?image.height/sourceHeight:image.width/sourceWidth));
 // Expand the tight title bounds with real screenshot context until the label
 // is filled. This preserves the maximum title scale without narrow strips.
 const frameWidth=Math.min(image.width,Math.max(width,height*CARTRIDGE_LABEL_ASPECT));
 const frameHeight=Math.min(image.height,Math.max(height,width/CARTRIDGE_LABEL_ASPECT));
 return [Math.max(0,Math.min(image.width-frameWidth,x+(width-frameWidth)/2)),
  Math.max(0,Math.min(image.height-frameHeight,y+(height-frameHeight)/2)),frameWidth,frameHeight];
}
export function drawCartridgeLabel(ctx,image,label,title){
 if(!['title-screen','opening-screen'].includes(label.style)){
  ctx.drawImage(image,0,0,512,512);return;
 }
 const caption=label.style==='opening-screen';
 ctx.fillStyle=label.background??'#000000';ctx.fillRect(0,0,512,512);
 const availableHeight=caption?352:512;
 // Framing is authored in original screenshot pixels, so the complete source
 // capture remains available and none of the original title lettering is edited.
 const [x,y,cropWidth,cropHeight]=titleScreenFrame(image,label);
 const ratio=cropWidth/cropHeight/CARTRIDGE_LABEL_ASPECT;
 const width=Math.min(512,availableHeight*ratio),height=width/ratio;
 ctx.drawImage(image,x,y,cropWidth,cropHeight,(512-width)/2,(availableHeight-height)/2,width,height);
 if(caption){
  ctx.fillStyle='#10191d';ctx.fillRect(0,352,512,160);
  ctx.fillStyle='#f4ecd5';ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=label.captionLines??[title];
  let size=64;ctx.font=`bold ${size}px Arial, sans-serif`;
  while(lines.some(line=>ctx.measureText(line).width>476)&&size>14)ctx.font=`bold ${--size}px Arial, sans-serif`;
  lines.forEach((line,index)=>ctx.fillText(line,256,432+(index-(lines.length-1)/2)*70));
  ctx.textAlign='start';ctx.textBaseline='alphabetic';
 }
}
