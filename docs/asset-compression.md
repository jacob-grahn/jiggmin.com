# Room compression pipeline

Generate three review presets with `npm run assets:compare`, then run `npm run start:source`
and open <http://127.0.0.1:8000/tests/fixtures/compression-preview.html>. Use a
desktop landscape window (at least 1000 px wide) to explore the house. The quality
selector reloads the scene; it does not preserve the current room. Game URL
history is disabled inside this preview iframe.

## Production build

`npm run build` (including Cloudflare builds) copies the site into `dist/` and
then automatically applies Balanced to each packaged GLB under `web/assets/`, every WebP
under `web/assets/labels/`, and the standalone room images listed in
`scripts/asset-compression.config.mjs`. `npm start`
builds and serves this compressed output. `npm run start:source` serves the
original exports and comparison fixtures for authoring work.

Update/export assets into `web/assets/` as usual, then build. Source files are
never overwritten: every build starts from the original exports, avoiding
cumulative lossy recompression. New GLBs are discovered recursively, including
embedded color textures. Add new standalone room images to `ROOM_IMAGES` in the
shared configuration. The rear-hall cups and ball atlas is registered there;
`node scripts/create-hallway-cups-atlas.mjs` regenerates its lossless 1024×512
source master, and the build encodes it at WebP quality 80 without resizing
or changing its runtime URL. Geometry uses sequential Draco with 14-bit positions,
10-bit normals, and 12-bit UVs (18-bit UVs for baked house atlases); color images
use WebP quality 80, including all house lighting atlases. House lighting maps
are repacked from lossless source masters into room-owned 1024-square pages
before encoding once. Geometry is simplified before Draco encoding; data maps
stay in their source format. Every exported GLB uses the shared `GEOMETRY_SIMPLIFICATION` setting in
`scripts/asset-compression.config.mjs`. The initial error limit is `0.001`, relative
to each primitive's extent (0.1%). Reduction stops at that error limit rather than
forcing a fixed triangle percentage. Equivalent vertices are welded only when
all their attributes match; UV/normal seams remain distinct, and mesh borders are
locked to protect window apertures and adjoining shell sections. Nodes, transforms,
materials, names, interaction metadata, and at least one triangle per nonempty
primitive are retained. This step operates only on build copies, leaving Blender
sources and source GLBs intact. Procedural objects created in browser JavaScript
are outside this export step.

Set the shared error to `0` to disable reduction. In comparison mode, use
`node scripts/compress-assets.mjs --geometry-error 0.002` to try another threshold
without changing production. Inspect resting views, camera travel, and moving
props when tuning the threshold, especially baked surfaces and silhouette edges.

Standalone cartridge labels are capped at 640×512
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
`dist/web/assets/compression-report.json` records settings, sizes, source/delivery
triangle counts (including per-mesh and per-node breakdowns), and SHA-256 hashes of source and output files. Experiments remain in ignored
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
Current comparison reports include labels and their resolution cap as well.
The current delivery pipeline also simplifies geometry and repacks/resizes
lighting textures; the historical totals above predate those changes. Draco sequential
encoding preserves the resulting simplified triangle count; its
edgebreaker mode removed some degenerate triangles in the first experiment.
We do not flatten or rename scene objects: names, extras and object ownership
drive picking, physics, baked materials and discoveries. Delivery primitives
can be simplified or split between atlas pages while retaining that ownership.

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

## Estimate texture sizes before baking

Run `npm run textures:plan` after exporting source geometry. No site build,
Blender process, lighting bake, or source mutation is needed. The report is saved
to `docs/house-plan/texture-size-plan.json` with a filterable HTML report alongside
it. Open `docs/house-plan/texture-size-plan.html` to inspect suggestions and the
objects/views that drive each texture's density requirements.

The planner measures source geometry through phone portrait, phone landscape,
and desktop cameras at DPR 2. It samples resting views, both travel directions,
and den idle/playing framing and doorway travel. A depth-tested ray grid excludes
surfaces hidden behind other authored geometry. UV derivatives measure density
in both directions, including narrow/stretched islands. Movable house meshes
receive a conservative isolated close-up check from six directions at a minimum
0.6m surface-distance allowance. This is not a simulation of actual prop reach.

Each texture includes resting/travel/close-up density requirements, sampled
objects, limiting views, and worst-case requirements. Strict screen density can
produce excessive requirements for thin UV islands or a brief close wall pass.
The suggested size therefore also checks sampled texture detail: up to 512
visible UV coordinates are compared against downsampled source images. Lighting
uses an RMS error limit of 3 and a 95th-percentile channel error of 8 on an 8-bit
RGB scale; detailed textures use 2.5 and 6. Suggested sizes never upscale sources.
These are initial heuristics, not a visual-quality guarantee. They use existing
texture detail and cannot predict noise or changed lighting in a future bake.

Sampling can miss tiny objects, animated doors and ladders, clipping changes,
and new prop poses. A null recommendation means unmeasured, not removable.
Runtime-generated cartridge canvases and the sky shader are outside this tool.
Current UV allocations are measured; repacking an atlas requires another check.
The planner does not apply bake or delivery settings automatically.

Increase sampling with `npm run textures:plan -- --travel-steps 32 --grid-width 128`.
Use `--travel-steps 0` for resting views only, `--closeup-distance 0.8` to change
that allowance, or `--output /tmp/texture-plan.json` for an experiment. The
source/delivery inventory remains available with `npm run textures:audit`.

## Standard lighting pages

Every delivery build now runs `scripts/repack-lighting-atlases.mjs` before mesh
simplification and WebP encoding. Connected UV charts are cropped from resized
lossless source images and packed into 1024×1024 pages, with 8 pixels of copied
edge padding. UVs and primitive materials follow their new page; other vertex
attributes, scene ownership and authoring masters stay intact. Pages stay within
their existing texture group and room. Repeated material textures, normal maps,
roughness maps and native artwork keep their existing mappings.

Some existing layouts overlap or contain many tiny regions. If repacking would
increase their previous texture allocation, the build retains their UV layout
and resizes the image instead. `LIGHTING_ATLASES` controls the page size, padding
and per-group quality exceptions. The compression report records each group's
source dimensions, page count and whether its original layout was retained.
`npm run build:atlas-masters` still preserves embedded source texture pixels and UVs.

The den's camera-projected lighting remains a wide image: 2560×800, down from
5120×1600. It uses a different shader mapping and is deliberately not repacked
into square pages. Its prop image retains its aspect ratio and current detail.
`IMAGE_BOUNDS` controls these exceptions.

Future CPU bakes default to 1024-square images, so they trace fewer pixels at
the existing 64-sample setting. For larger render masters, use
`npm run bake:atlases -- hall-trim --profile render`; to override selected groups,
use `--atlas-size 2048`. These options change actual bake targets, rather than
scaling a completed image. Existing lossless masters remain unchanged by the
delivery resize/repack. A future bake can produce new chart layouts, which need
another visual review.

Before/after desktop and portrait captures are saved in
`docs/house-plan/atlas-comparison/`. The first reviewed pass reduces room lighting
pixels from 32.4 MP to 25.1 MP (23%) and the den lighting image by 75%. These are
texture allocation estimates; a room only loads its own branch and the hallway.

The tree selection is fixed in `scripts/house-source/tree-delivery.json`, with the
approved flat meshes in `tree-silhouettes.glb`. Builds replay these choices without
checking camera or window visibility. New trees remain authored until explicitly
added to that selection; changes to existing tree positions retain their transforms.

## Production asset cleanup

`scripts/production-asset-exclusions.json` is shared by packaging and compression.
It omits the old monolithic house shell, pre-release room models, superseded
basement, fixtures already present in room shells, unused alternate hallway
shells, and the previous sky image. All source files remain available to bake,
authoring, and comparison tools. Newly added assets are included by default.
The production layout omits references to the excluded shell and fixture files.
Alternate den and hallway models remain available through their existing debug
options. `build:atlas-masters` retains the complete asset set.

Before encoding delivery GLBs, the build removes embedded maps from window
materials replaced by clear glass and from the old cartridge meshes replaced
by runtime molds and labels. Nodes, cameras, transforms, and geometry are kept.
The currently displayed `night-forest.webp` sky is registered with the encoder.
