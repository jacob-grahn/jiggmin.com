// Production and the comparison preview share exactly the same Balanced preset.
export const BALANCED={id:'balanced',quality:80,positionBits:14,normalBits:10,uvBits:12,maxTextureSize:0};
export const PRESETS=[
  {id:'high',quality:90,positionBits:16,normalBits:12,uvBits:14,maxTextureSize:0},
  BALANCED,
  {id:'smaller',quality:65,positionBits:12,normalBits:8,uvBits:10,maxTextureSize:0},
];
// GLB models and their embedded color textures are discovered automatically.
// Standalone room images to encode alongside those models:
export const ROOM_IMAGES=['room-lighting.webp','room-props.webp','den.webp','house/windows/moonlit-sky.webp'];
// Standalone WebP labels are discovered recursively; preserve aspect ratio.
export const LABEL_BOUNDS={width:640,height:512};
