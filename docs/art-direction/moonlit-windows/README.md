# Shared moonlit window exterior

Generated with the built-in image_gen tool. The eight non-den windows sample one equirectangular panorama by world-space sightline. This keeps scenery angularly consistent and avoids fitting a complete landscape into every small window. Existing frames, rain geometry, clipping, and room ownership remain.

Asset: web/assets/house/windows/moonlit-sky.webp (lossless source; the build produces quality-80 WebP)

Original generation prompt (superseded by the comic-book revision below):

Use case: stylized-concept. Asset type: one seamless 360-degree equirectangular environment panorama, 2:1 aspect ratio, for a moonlit sky seen through small windows of a moody illustrated house. The image will wrap around the house: each window reveals only a tiny angular portion, NOT an entire landscape. Extremely restrained composition. Horizon exactly halfway down. Upper half: spacious muted slate-blue night sky, soft sparse cloud bands, stronger silver-blue moonlight, one small luminous moon with a broad soft cool halo at horizontal position 70%, vertical position 25%. Lower half: nearly featureless deep navy ground fading to ink darkness. Only a few widely spaced dark spruce crowns near the horizon, less than 12% image height; no dense forest, no nearby vegetation, no grass blades, no ferns, no paths, no mountains, no buildings, no water. Palette: ink navy #071321, dark blue #10263d, slate blue #38597b, brighter silver-blue #7898b7 limited to moon halo and thin clouds. Hand-painted simple shapes and soft restrained texture matching an illustrated nighttime game, not photographic. Readable moonlit sky, quiet eerie atmosphere. No window frames, no glass or rain speckles, no interiors, no text, no borders. Left and right edges must join seamlessly, no collage or panels.

Implementation: the panorama is on one enclosing sky mesh, rendered behind the
house. Permanent apertures and nearby scenery are authored before lighting in
`scripts/prepare-house-static.mjs`, using helpers in `scripts/house-source/`.
The exported models contain their openings; loading a room no longer clips walls.
Frames and rain geometry remain in place. Glass transparency and the shared sky
remain runtime presentation behavior. The den is excluded.

## Comic-book revision

Replaced the sparse panorama with layered woodland and clouds throughout the texture so small window crops contain visible detail. Generated using the built-in image_gen tool, with the prior woodland draft as the edit target and `docs/art-direction/den/midnight-ink-target.png` as the style reference only. The den itself is unchanged.

Final revision prompt:

Use case: style-transfer. Image 1 is the EDIT TARGET woodland panorama. Image 2 is STYLE REFERENCE ONLY, the project's inked den art. Redraw image 1 as bold hand-inked comic book art matching image 2's thick black irregular contour lines, simplified flat color shadow shapes, and short expressive hatch strokes implying surface textures. Preserve the woodland panorama composition, one moon, trees distributed across full width, layered depth, clouds throughout sky, 2:1 aspect ratio and horizon near middle. Dramatically stronger silver-blue BACKLIGHT behind black tree silhouettes and on cloud edges; large readable graphic light/shadow shapes. Bold heavy ink outlines around trunks, angular foliage masses, cloud banks and ground forms. Bark, leaves, rocks and cloud shading suggested with sparse smaller pen strokes and directional crosshatching instead of rendered realistic microtexture. Deep ink navy shadows, slate-blue midtones, pale blue moonlit rims, a few muted gray-green ground tones. No photorealism, no soft oil painting, no photographic foliage, no fuzzy airbrush shading. This texture wraps a 360 degree environment and is seen through small windows, so preserve identifiable tree/cloud forms across all directions, with left and right edges seamless and compatible. No empty flat blue expanses. No text, borders, comic panels, interiors, window frames or objects from the style-reference room. Only redraw the forest panorama, do not modify the den reference.

Validation: run the build and window-sky tests after replacing the asset. Room-owned sky textures and materials are disposed when rooms unload.

## Glass and nearby silhouettes

`scripts/house-source/house-window-exterior.js` builds merged low-poly branch and pine meshes,
centered 0.85 and 2.8 world units beyond each opening. Perspective supplies their
parallax. They share the same depth buffer as the walls and are disposed with
their room. Wooden reveal meshes cover the edges of the cut wall surfaces.

The former image planes are now separate MeshStandardMaterial glass panes with
7.5% opacity, depth writes disabled, and a restrained environment reflection.
Glass renders after all opaque room passes, so neighboring rooms cannot overwrite
its transparency during travel. This is an environment reflection, not a live
mirror of the interior. The shared sky has its own lifetime and remains available
when individual rooms unload.

Validation includes actual baked assets: all eight apertures are ray-tested at a
3×3 grid of points. Tests also check preservation of wall geometry, interpolated
UVs, transformed window frames, glass clipping, and room-resource disposal.
