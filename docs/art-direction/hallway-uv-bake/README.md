# Hallway surface-lighting experiment

The hallway's fixed surfaces use a 4096 × 4096 UV atlas plus a dedicated
2048 × 2048 ceiling atlas, baked at 128 samples with Cycles diffuse
color, direct lighting, and indirect lighting. Lighting follows each surface,
independent of the camera. The source hallway GLB and the den are unchanged.

The ceiling paint is light cream. The current variant uses saturated blue window
lights with the ceiling fixtures switched off: no baked orange spill, bulb
emission, or runtime practical lights.
The dedicated ceiling atlas improves texel density on the large ceiling planes.
Both HDR atlases are explicitly denoised before their display transform, with
−1.3 stops of exposure and a modest saturation increase for the nighttime palette. The atlas
is display-transformed once with AgX, then shown with unlit browser materials
so live lights and tone mapping do not shade it a second time. Existing mesh
outlines remain. This is baked diffuse appearance, not a view-dependent render
or a live reflection solution.

Doors, the attic hatch and cord, movable artwork, loose props, and the parallax
window views retain live materials. Movable objects are excluded as bake
occluders, so throwing them does not leave permanent shadows. Consequently
those objects do not have baked contact shadows. Their existing live lighting
can differ from the static surfaces' baked illumination.

The replacement ceiling and landing from `layout.json` are included in the bake.
The browser omits those duplicate connection meshes only for this experiment.
Other rooms retain their original models, lighting, and shaders.

Rebuild from the repository root:

```sh
node scene/scripts/prepare_hallway_bake.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python scene/scripts/bake_hallway.py
```

The preparation step uses the real browser prop grouping to classify fixed
geometry and writes a temporary input GLB. Blender leaves the original scene
assets intact and writes `hallway-baked.glb` and `hallway-bake.json`.
Intermediate HDR and PNG textures are saved under ignored `scene/renders/`.

`before.png` and `after.png` are browser captures at the hallway's resting camera
with the same 1440 × 900 viewport. `before-cream-lighting.png` preserves the
first bake before the cream ceiling and stronger blue/orange lighting revision. The original `hallway.glb` is retained for
comparison and an easy rollback.

Validation: all 117 automated tests pass, including atlas coverage, exclusion of
movable props and animated doors, and single application of the baked lighting.
Browser checks covered entering the hallway, traveling to the workshop and back,
and the parcel interaction, with no console errors. `door-open.png` shows the
live workshop door against the baked hallway surfaces.

`before-lights-off.png` preserves the cream-ceiling version with warm practicals.
`after.png` shows the current window-lit variant. Rebuild the previous lighting
with `--ceiling-lights-on`; each variant retains its own intermediate atlases.

The front pendant (shade, bulb, and stem) is removed at load to clear the attic
hatch. Future bakes also omit that fixture. The rear fixture remains switched off.
