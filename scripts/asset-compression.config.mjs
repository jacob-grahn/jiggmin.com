// Production and the comparison preview share exactly the same Balanced preset.
export const BALANCED={id:'balanced',quality:80,positionBits:14,normalBits:10,uvBits:12,maxTextureSize:0};
export const PRESETS=[
  {id:'high',quality:90,positionBits:16,normalBits:12,uvBits:14,maxTextureSize:0},
  BALANCED,
  {id:'smaller',quality:65,positionBits:12,normalBits:8,uvBits:10,maxTextureSize:0},
];
// GLB models and their embedded color textures are discovered automatically.
// Standalone room images to encode alongside those models:
export const ROOM_IMAGES=['room-lighting.webp','room-props.webp','crt-screen.webp','den.webp','house/windows/night-forest.webp','house/hallway-cups/atlas.webp'];
// Standalone WebP labels are discovered recursively; preserve aspect ratio.
export const LABEL_BOUNDS={width:640,height:512};

// Relative mesh error: 0.001 = 0.1% of each primitive's extent, not a fixed
// percentage of triangles. Shared by all delivery models and review presets.
export const GEOMETRY_SIMPLIFICATION={error:0.001,lockBorder:true};
// Room-owned lighting pages. Exceptions can retain density without changing masters.
export const LIGHTING_ATLASES={pageSize:1024,gutter:8,groupCaps:{}};
export const IMAGE_BOUNDS={'room-lighting.webp':2560,'room-props.webp':2048};
