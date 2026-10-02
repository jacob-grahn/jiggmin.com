# Den surface-lighting experiment

Open the source preview with `?denLighting=uv` to test camera-independent UV
lighting. Without that parameter, the original projection remains active.
Source Blender files and projected lighting assets are preserved.

## Lamp and curtain appearance transfer

Open `?denLighting=transfer` for the separate lamp/left-window curtain test.
Rebuild it locally with `node scene/scripts/transfer_den_appearance.mjs`, followed
by `npm run build`. No Blender render or cloud GPU is required.

The script samples the original room and cropped prop lighting plates using the
original camera, then writes those colors into existing surface UVs. Ray tests
against the static scene reject occluded texels, leaving the current lighting
bake on hidden surfaces. The curtain bounds select both fabric panels around the
left window; the rod remains unchanged. A three-texel gutter prevents seams.
The result uses ordinary UV textures at runtime, including while the lamp moves.

`after-appearance-transfer.jpg` records the 1280 × 720 result. The lamp's dark
pleat lines and curtain fold outlines return, although curtain edges remain softer
than the original projection. This preserves the original viewpoint's shading
and ink; it does not generate new silhouettes or highlights for other viewpoints.
Hidden surfaces can still show a transition to the previous bake when revealed.

The output is `web/assets/den-transferred.glb`. Geometry, UVs, transforms, and the
other eight textures were verified unchanged. The architecture texture receives
7,368 visible curtain samples and the lamp texture receives 462,994 samples.
The original projection and the previous UV experiment remain available.

## Texture allocation

The revised bake uses ten independent textures:

| Surface | Dimensions | Filtering |
| --- | --- | --- |
| Architecture | 4096 × 4096 | Denoised |
| Furniture | 4096 × 4096 | Denoised |
| Lamp | 2048 × 2048 | Denoised |
| Plant | 2048 × 2048 | Denoised |
| Mug | 1024 × 1024 | Denoised |
| Door | 1024 × 1024 | Denoised |
| Window | 1024 × 1536 | Native UVs, no denoising |
| Rug | 1600 × 1100 | Native UVs, no denoising |
| CRT | 1200 × 900 | Native UVs, no denoising |
| Poster | 700 × 1000 | Native UVs, no denoising |

The four authored images retain their original pixel dimensions and UV layout.
They are newly lit bakes, rather than copies of the original unlit image pixels.
They bypass denoising and use lossless storage, including production WebP
compression. The build test verifies identical decoded artwork pixels before
and after compression. Procedural surfaces have no original image resolution;
their atlas allocation is expanded separately. Cycles uses 64 samples with the
authored lights, toon/diffuse materials, and emission. The source Standard display
transform is applied once. Browser materials are unlit and not tone mapped again.

## Ink and interaction

`scene/scripts/ink_den_atlas.mjs` draws dark lines into each applicable lighting
texture after denoising. It identifies borders and creases of at least 35 degrees,
ignores coplanar triangulation and edges below .055 source units, and draws both
UV sides of seams. Width scales with texel density. Native artwork and small
reactive props are excluded. This pass changes texture pixels, not geometry.

These are fixed surface marks. Camera-dependent Freestyle silhouettes require
runtime outlines to follow every viewing angle. Existing procedural hatching
and authored ink marks are included in the lighting bake.

Cartridges and controller remain live. Reactive props retain resting baked
illumination and shadows; their UV lighting follows their movement. The CRT uses
its own texture while idle and retains the transparent game aperture during play.
Raycasting and dynamic shadow receivers cover every static room mesh.

## Rebuild

Use the den command in `docs/runpod-baking.md`, then ink the verified raw output:

```sh
node scene/scripts/ink_den_atlas.mjs .runpod/<run-id>/output/den-baked.glb web/assets/den-baked.glb
npm run build
```

Do not repeatedly ink an already inked atlas. The ink command's default input is
`scene/renders/den-uv-bake/den-uninked.glb`; retain an unmodified bake there for
local iterations. Ink changes do not require another paid bake.

The exporter clears selections across all view layers, preventing an unrelated
default Cube in another source scene from entering the export. The ink command
also removes that Cube from older raw bakes.

## Earlier comparisons

`before.jpg` records the original projection. `after.jpg` is the first shared
4096 atlas, and `after-ink.jpg` adds structural ink to that initial atlas. All
use a 1280 × 720 viewport; cartridges randomize on page load. That first atlas
softened the CRT lettering, poster, window, and rug. Its A5000 bake took 600.85
seconds and cost an estimated $0.053; pod deletion was confirmed.

## Native-resolution result and validation

`after-native-resolution.jpg` shows the revised ten-texture bake with structural
ink. The CRT lettering, poster, window detail, and rug remain clearly resolved.
The 4090 recipe took 429.97 seconds; the full run cost an estimated $0.1225 and
pod deletion was confirmed. Raw output is retained in
`.runpod/20261001-203725-1b2307/output/`.

Production compression reduces the model from 62.13 MB to 13.70 MB while keeping
all four artwork textures at their native sizes with identical decoded pixels.
All 213 JavaScript tests and nine cloud-runner tests pass. Browser hallway entry
and return to the den complete with no console errors.
