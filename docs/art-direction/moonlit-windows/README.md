# Shared moonlit window exterior

Generated with the built-in image_gen tool. The eight non-den windows sample one equirectangular panorama by world-space sightline. This keeps scenery angularly consistent and avoids fitting a complete landscape into every small window. Existing frames, rain geometry, clipping, and room ownership remain.

Asset: web/assets/house/windows/moonlit-sky.webp (lossless source; the build produces quality-80 WebP)

Final generation prompt:

Use case: stylized-concept. Asset type: one seamless 360-degree equirectangular environment panorama, 2:1 aspect ratio, for a moonlit sky seen through small windows of a moody illustrated house. The image will wrap around the house: each window reveals only a tiny angular portion, NOT an entire landscape. Extremely restrained composition. Horizon exactly halfway down. Upper half: spacious muted slate-blue night sky, soft sparse cloud bands, stronger silver-blue moonlight, one small luminous moon with a broad soft cool halo at horizontal position 70%, vertical position 25%. Lower half: nearly featureless deep navy ground fading to ink darkness. Only a few widely spaced dark spruce crowns near the horizon, less than 12% image height; no dense forest, no nearby vegetation, no grass blades, no ferns, no paths, no mountains, no buildings, no water. Palette: ink navy #071321, dark blue #10263d, slate blue #38597b, brighter silver-blue #7898b7 limited to moon halo and thin clouds. Hand-painted simple shapes and soft restrained texture matching an illustrated nighttime game, not photographic. Readable moonlit sky, quiet eerie atmosphere. No window frames, no glass or rain speckles, no interiors, no text, no borders. Left and right edges must join seamlessly, no collage or panels.

Implementation: `web/house-window-sky.js` samples the panorama from the world-space
ray between the camera and each window fragment, equivalent to looking through a
window mask at a skybox. This avoids rebuilding wall openings or showing another
room behind translucent glass. The den is excluded. Generated colors are shown
without tinting, cel shading, or tone mapping. Frames and existing rain geometry
remain in place. The moonlit panorama changes the exterior view; room illumination
continues to use the existing baked or live lighting.

Validation: 123 tests pass, including all eight exterior openings and retained
clipping. Room-owned sky textures and materials are disposed when rooms unload.
