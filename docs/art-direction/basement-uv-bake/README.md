# Basement surface-lighting bake

Fixed basement surfaces use a 4096 × 4096 diffuse lighting atlas and a separate
2048 × 2048 ceiling atlas. Cycles computes direct illumination and diffuse bounce
at 128 samples; the HDR atlases are denoised before an AgX display transform.
Cool light enters through all three windows, with warm light from the ceiling
fixture. Original concrete and painted wall finishes are retained.

Movable props and runtime cartridges keep live materials and interactions. They
are excluded from the bake, including their shadows, so moving an object cannot
leave a permanent shadow behind. Their lighting can differ from the baked room.
The browser displays baked surfaces with unlit materials to avoid double lighting.

Rebuild from the repository root:

```sh
node scene/scripts/prepare_basement_bake.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python scene/scripts/bake_basement.py
```

The hallway and basement share preparation, UV packing, baking, denoising, and
export code, with separate room lighting configurations and assets. The original
basement.glb remains unchanged. The before and after screenshots use the same
resting camera and 1440 × 900 viewport.

Validation: all 121 tests pass, including atlas coverage, movable-prop exclusion,
and single application of baked lighting. Browser verification covered entering
the basement and activating a movable box, with no console errors. The exported
asset is approximately 5.5 MB.
