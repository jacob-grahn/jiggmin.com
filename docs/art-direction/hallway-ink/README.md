# Hallway projected-ink transfer experiment

The den remains on its original camera projection. Open `?hallwayInk=transfer`
and enter the hallway to compare the optional ink transfer with the default room.

This first test isolates the den's Freestyle outline treatment. It does not
recreate the den's toon materials, warm light rig, or hand-authored hatching.
The hallway's existing lighting and color remain in place. Many hallway frames,
doors, and movable props already have live outlines and are not atlas receivers.

## Reproduce

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python scene/scripts/render_hallway_ink.py
node scene/scripts/transfer_hallway_ink.mjs
npm run build
```

The render imports current release geometry, uses the authored hallway hub
camera, and draws silhouettes and borders with the den's line color and thickness
(global 1.4, style 2.15). Creases and material boundaries are disabled. White
emission isolates line opacity without needing a lighting render or cloud GPU.
`line-pass.png` records that projected render at 2560 × 1600.

The transfer samples the line plate into the existing `structure-hall` and
`original-hallway` UV atlases. Visibility rays reject occluded surfaces. Nearby
rays reject the background half of foreground silhouette strokes, reducing the
risk of painting a foreground outline onto the wall behind it. Three-texel
gutters extend ink only outside occupied UV islands. Geometry, UV coordinates,
transforms, atlas dimensions and all other textures are preserved.

The experiment writes separate `web/assets/house/hallway-ink/{structure,hallway}.glb`
files. The standard release assets are not modified. There is no new runtime
projection shader: transferred lines follow their textured surfaces.

## Limits

This is a single-view experiment. Hidden surfaces receive no new lines, and
transferred silhouettes do not adapt as the camera moves. Matching the den's full
visual style will also require material and lighting art direction. UV texel
density limits how sharply thin projected strokes survive, especially on broad
surfaces. The original live contours remain active.

The first transfer wrote 4,392 samples across 41 meshes and two atlases.
`before.jpg` and `after.jpg` compare the same browser viewpoint.

The visible difference is subtle: much of the transferred ink coincides with
already-dark edges. This establishes the transfer workflow, but outlines alone
do not close the style gap. The default hallway remains unchanged. The build
and 21 focused house/camera/travel/lighting tests pass. Browser entry and travel
to the rear hall succeed without console errors.
