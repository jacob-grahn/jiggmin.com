# Room compression pipeline

Generate three review presets with `npm run assets:compare`, then run `npm run start:source`
and open <http://127.0.0.1:8000/tests/fixtures/compression-preview.html>. Use a
desktop landscape window (at least 1000 px wide) to explore the house. The quality
selector reloads the scene; it does not preserve the current room. Game URL
history is disabled inside this preview iframe.

## Production build

`npm run build` (including Cloudflare builds) copies the site into `dist/` and
then automatically applies Balanced to every GLB under `web/assets/`, every WebP
under `web/assets/labels/`, and the standalone room images listed in
`scripts/asset-compression.config.mjs`. `npm start`
builds and serves this compressed output. `npm run start:source` serves the
original exports and comparison fixtures for authoring work.

Update/export assets into `web/assets/` as usual, then build. Source files are
never overwritten: every build starts from the original exports, avoiding
cumulative lossy recompression. New GLBs are discovered recursively, including
embedded color textures. Add new standalone room images to `ROOM_IMAGES` in the
shared configuration. Geometry uses sequential Draco with 14-bit positions,
10-bit normals, and 12-bit UVs (18-bit UVs for baked house atlases); color images
use WebP quality 80, including all house lighting atlases. House lighting maps
are resized from lossless source masters to their 1024 or 2048 delivery caps
before encoding once. Triangle counts are preserved, and data maps are left in
their source format. Standalone cartridge labels are capped at 640×512
with aspect ratio preserved and no upscaling (the current 768×615 labels become
639×512 after pixel rounding), then encoded at WebP quality 80. Label URLs stay
unchanged; originals stay in the source tree. `LABEL_BOUNDS` controls this cap,
and new WebP labels placed under `web/assets/labels/` are picked up automatically.
The 24 current labels drop from 2,762,056 to 1,412,630 bytes (48.9% smaller).

Both production loaders use `web/model-loader.js` and the vendored Draco decoder
under `web/vendor/draco/`. No CDN or node_modules path is needed by the deployed
site. When upgrading Three.js, update `DRACOLoader.js` and its three glTF decoder
files from the same package version; a build test checks these copies.

Compression or validation failure fails the build. The generated
`dist/web/assets/compression-report.json` records settings, sizes, triangle counts,
and SHA-256 hashes of source and output files. Experiments remain in ignored
`scene/compression/` and are never deployed. Run `npm ci` with development
dependencies included before building; the build requires Node.js and Python 3.

## Measured presets

The initial comparison below used the PNG sky source. It has since been
converted losslessly to WebP for a consistent runtime URL; Balanced output remains
19.33 MB. These totals cover the den, cartridge and controller models, four baked room
models, den lighting/props/backdrop images, and the shared sky image. They exclude
games, cartridge labels, JavaScript and decoder overhead. MB means 1,000,000 bytes;
these are file sizes before HTTP compression, not measured network transfers.

| Preset | Image quality | Position / normal / UV bits | Total | Reduction |
| --- | ---: | --- | ---: | ---: |
| Original | Existing exports | Existing exports | 52.02 MB | — |
| High | 90 | 16 / 12 / 14 | 22.49 MB | 56.8% |
| Balanced | 80 | 14 / 10 / 12 | 19.33 MB | 62.8% |
| Smaller | 65 | 12 / 8 / 10 | 17.51 MB | 66.3% |

The table above predates standalone label compression and excludes those labels.
Current comparison reports include labels and their resolution cap as well. Room
texture dimensions and triangle counts remain unchanged in the default presets. Draco sequential
encoding preserves the triangle count, including source degeneracies; its
edgebreaker mode removed some degenerate triangles in the first experiment.
We do not merge, simplify, flatten, or rename objects: names, extras and object
ownership drive picking, physics, baked materials and discoveries.

The script decodes each generated model and verifies node names, hierarchy,
transforms, mesh/camera assignments, extras, triangle counts and finite positions.
This is structural validation, not a guarantee of indistinguishable appearance.

## Tuning

For example, generate a fourth custom preset:

```sh
npm run assets:compare -- --quality 85 --position-bits 14 --normal-bits 12 --uv-bits 14
```

Optional `--max-texture-size 2048` caps color textures' longest dimension while
preserving aspect ratio; leave it at 0 to retain resolution. Re-select Custom in
the preview after regenerating it. Change one control at a time to isolate its
effect. The three default presets are only starting points, not a universal
quality ranking. Image quality is an encoder parameter, not a percentage of
detail retained or bytes saved. Geometry precision is independent of it.

## Export guidelines for this site

- Keep authoring masters and generate every candidate from the same original.
  Current experiments recompress existing JPEG/WebP exports. For final delivery,
  encoding from original bake images avoids another generation of image loss.
- Compress geometry first. The 19.44 MB den GLB contains no images. The four
  extra-room GLBs contain 20.98 MB of geometry/structure and 6.12 MB of images.
  Draco or Meshopt with carefully chosen quantization is more useful here than
  only reducing JPEG quality.
- Tune color/baked-light texture quality separately from resolution. Examine
  dark gradients, ink outlines, printed text, the plate photo and paintings.
  Lower UV precision can produce seams even when geometry still looks correct.
- Preserve normal, roughness and other data maps more carefully than color maps.
  This experiment only recompresses base-color and emissive images. It leaves
  the source data maps alone; some were already exported as JPEG.
- WebP reduces download size, but does not provide GPU texture compression.
  If decoded texture memory or upload time is the bottleneck, evaluate KTX2 /
  Basis with mipmaps and Three.js KTX2Loader as a separate experiment. A smaller
  WebP file at the same dimensions does not mean a smaller GPU allocation.
- Keep per-room lazy loading and caching. Inspect network transfer with actual
  host compression enabled; the JSON reports include a local gzip estimate but
  do not assert that the host compresses GLBs. Include decoder cost and decode
  time when comparing overall loading performance.
- Test from the real cameras, including ultrawide views, transitions, close
  inspection and moving props. Consider selective simplification/LOD only after
  compression; preserve silhouettes and interactive assemblies.

References: [glTF Transform CLI](https://gltf-transform.dev/cli),
[Draco options](https://gltf-transform.dev/modules/functions/interfaces/DracoOptions),
[texture compression](https://gltf-transform.dev/modules/functions/functions/textureCompress),
[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).
