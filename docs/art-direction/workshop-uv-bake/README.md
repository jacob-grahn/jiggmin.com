# Workshop surface-lighting bake

Fixed surfaces use a 4096 × 4096 lighting atlas and a dedicated 2048 × 2048
ceiling/roof atlas. The bake includes diffuse color, direct illumination, and
bounced light, rendered at 64 samples and denoised before the AgX display transform.

Cool window lighting and warm practical lamps retain the room's nighttime palette.
Movable props, artwork, and the shared moonlit window sky remain live. Movable
objects are excluded from bake occlusion, so moving them does not leave a permanent
shadow; their shading can differ from the fixed surfaces.

Rebuild from the repository root:

```sh
node scene/scripts/prepare_workshop_bake.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python scene/scripts/bake_workshop.py
```

The original `scene/exports/house/workshop.glb` remains intact. `before.png` and `after.png` use the same
resting camera at 1440 × 900.

Validation: `npm test` passes all 129 tests, including atlas coverage, retained
room cameras/lights/windows, and exclusion of movable props from the bake.
Browser validation: room navigation and prop tossing work; no console errors.
