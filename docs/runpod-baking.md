# Runpod house baking

The cloud runner uploads only the Blender house, bake inputs, scene Python scripts,
and texture folders. It runs the existing bake recipe with Blender 4.5.14 LTS and
NVIDIA OptiX, verifies the result archive, then deletes its temporary pod.
It never publishes or replaces current site assets.

The optional `--target hallway-style` recipe bakes only the moonlit illustrated
hallway experiment. It packages `house-release.blend`, the current hallway and
structure GLBs/layout, Python scene scripts and project texture folders. Its
verified outputs are `hallway-style.glb`, seven PNG/EXR atlases and reports.
The local merge and ink scripts install these into separate experimental assets;
the standard release models and projected den are preserved.

## Verified benchmark — October 1, 2026

The full house bake completed on a Secure Cloud RTX A5000 using Blender 4.5.14
and OptiX. Scene and recipe hashes match the saved local baseline. Both runs used
64 samples, ten atlases, and the same 2048/4096 resolutions.

| Measurement | Result |
| --- | --- |
| Saved local bake | 2,949.5 seconds (49m 10s) |
| Cloud bake | 279 seconds (4m 39s) |
| Bake speedup | 10.57× |
| Successful run including provisioning, transfers and deletion | 431 seconds (7m 11s) |
| Successful run estimated cost including disk | $0.0335 |
| Total estimated cost including setup retries | About $0.05 |
| Geometry verification | All 785 baked meshes unchanged |
| Output verification | Transfer checksum, source hash, ten atlas sizes, nonempty images |
| Cleanup | Pod deletion confirmed; account pod list empty |

Results and detailed verification are in `.runpod/20261001-161957-4c6978/`.
The site still uses its original assets. GPU and CPU lighting pixels are not
bit-identical; retain the usual visual review before publishing replacement maps.
4090 capacity was unavailable, and 5090 availability disappeared between checks;
the A5000 was available at $0.27/hour plus a small disk charge. Availability and
prices must be checked again for future jobs.

## Credentials

Set `RUNPOD_API_KEY` in the calling environment, or put `RUNPOD_API_KEY=...` in
`.env.runpod` at the project root with permissions `600`. This file and `.runpod/`
are ignored by Git. Never add credentials to source files or shell arguments.

## Commands

To inspect existing bakes without atlas downscaling or WebP encoding, run
`npm run build:atlas-masters`, then
`python3 scripts/serve.py --directory dist-atlas-masters --port 8004`.
This separate diagnostic build preserves all embedded source texture bytes and
dimensions, including PNG atlas masters, while retaining the normal geometry
compression. It requires no bake and leaves the production build settings unchanged.
Standalone images retain their normal build processing.

```sh
npm run cloud:status
npm run cloud:quote
npm run cloud:test
npm run cloud:bake -- --quality test
# Full resolution; same recipe and samples as release:house:bake:
npm run cloud:bake -- --quality final
```

`npm run cloud:bake` uses the automatic allocator. It tries Secure Cloud GPUs in
this order: **RTX PRO 6000 Blackwell Workstation → RTX PRO 6000 Blackwell Server → RTX 5090**. Each candidate is tried once.
Quotes and single-GPU benchmarks also default to the PRO 6000 Blackwell Workstation.
Default limits are **$5 total, $2.50/hour, and 60 minutes**, including provisioning
and result transfer. Max-Q, RTX 4090, A5000 and A4500 remain explicit options.
Unavailable quotes and candidates outside the requested hourly/budget/runtime
limits are skipped. If capacity disappears during creation, the runner checks
that no pod was created before trying the next GPU. Every selection and skip is
printed; the allocated GPU is recorded in the run's `state.json`.

Customize the order or pin a single GPU:

```sh
npm run cloud:bake -- --target den --gpu 'NVIDIA RTX A5000' --budget .50 --max-hourly 1 --max-minutes 30
npm run cloud:bake -- --gpus 'NVIDIA GeForce RTX 4090' 'NVIDIA RTX A5000' --quality final
npm run cloud:bake -- --gpu 'NVIDIA RTX A5000' --quality test
```

`--gpu` disables fallback. The original `python3 scripts/runpod_bake.py benchmark`
command remains a single-GPU entry point; `auto` is the new fallback entry point.
When all candidates are unavailable or ineligible, the command exits with the
reason for each candidate. It does not loop indefinitely.

The runner checks the current quote plus a conservative disk allowance, then
verifies the allocated pod price. A missing price or a price above the quote or
hourly limit causes deletion and an error. Account credit is required. Once any
pod is allocated, startup, bake, and download failures stop the run after cleanup;
they do not start another paid attempt. Network timeouts, unknown server errors,
authentication failures, and failures to list or clean up pods also stop fallback.
Consequently the budget is never reset across multiple paid bake attempts.

Outputs, source-file hashes, logs, timing, and cleanup state are saved in
`.runpod/<run-id>/`. Downloaded files are under `output/`; the run does not copy
them into the canonical release directory. Review and assemble the lighting
meshes before using the normal local release/publish pipeline.

## Cleanup and limits

The local process explicitly deletes its pod after success or failure and checks
the pod list to confirm deletion. It records a unique pod name before creation
and reconciles by name if creation returns an ambiguous network error. Never
blindly retry a creation request. Only an explicit no-capacity response, followed
by a successful pod-list check showing no matching pod, allows trying the next
GPU. If a pod is found despite a rejection, it is deleted and the run stops.
A new invocation refuses to start while an
existing `jiggmin-bake-` pod exists.

A second watchdog runs inside the cloud container. Its absolute deadline is
set before allocation; it explicitly calls Runpod to delete its own pod even if
the local computer disconnects. The Runpod API key is sent only to Runpod and
the temporary worker on Runpod, kept out of Blender's process environment, and
never included in downloaded artifacts or printed status. The worker endpoint
uses a separate random bearer token over Runpod's HTTPS proxy.

**The budget is a runtime guard, not a provider-enforced spending cap.** Container
startup failures, provider/API outages, or failure of both cleanup processes can
leave charges running. The watchdog starts only once the container starts.
The runner reserves 10% of the configured budget for cleanup and normally stops
two minutes before the watchdog deadline. Runpod's old `stopAfter` and
`terminateAfter` controls must not be relied on: they were removed from runpodctl
because the backend did not enforce them.

If interrupted, check `npm run cloud:status` and the latest `state.json`. To delete
a leftover project pod:

```sh
python3 scripts/runpod_bake.py delete POD_ID
```

While a worker is running, inspect its phase and recent logs with
`python3 scripts/runpod_bake.py progress POD_ID`.

This command refuses pods without the project's name prefix. There is no network
volume: termination discards the remote inputs and results. Verified local
downloads remain available. Storage prices and GPU prices may change; actual
Runpod billing is authoritative over the runner's elapsed-time cost estimate.

References: [Pod API](https://docs.runpod.io/api-reference/pods/POST/pods),
[pricing](https://docs.runpod.io/pods/pricing),
[deadline flag removal](https://github.com/runpod/runpodctl/pull/330).

## Den UV-lighting experiment

The den can use the same ephemeral GPU runner with its native illustrated scene:

```sh
python3 scripts/runpod_bake.py benchmark --target den --gpu 'NVIDIA RTX A5000' --budget .50 --max-hourly .40 --max-minutes 30
```

This target uploads the den source, scene scripts, and den textures. It returns
`den-baked.glb`, the HDR and denoised lighting atlas, and reports under the run's
`output/` directory. The default target remains `house`. Review the result before
copying `den-baked.glb` to `web/assets/`; the local source preview enables it with
`?denLighting=uv`. Omitting that parameter keeps the original projection.

## Full-room atlas refresh

`--target house-atlases` rebuilds the fixed surfaces in all five release models
from native reflectance, preserving the projected den and live artwork/props.
It uploads the Blender source, release models, authored repair bake inputs,
source basement model/refit metadata, Python bake scripts, and project textures.
The fallback pool prioritizes full Blackwell GPUs; it excludes MIG partitions
and no longer falls back to the slower A5000 automatically.

The recipe restores native material UVs before creating lighting UVs, authors
metre-scale coordinates for painted walls and otherwise unmapped textured faces,
and validates every textured triangle before rendering. Explicit source UVs also
control tangent-space normal maps. It preserves the current per-room atlas
allocations, including the separate hallway ceiling and window atlases, and uses
64 samples. Hallway door casings, headers, thresholds and baseboards use a
separate `hall-trim` atlas at 2048×2048 for both baking and delivery, freeing
space in `structure-hall`. Attic atlases use the same −1.3 exposure as the other rooms.
`--atlas-groups` on the cloud runner selects a partial refresh; all other surfaces
still participate in lighting, but their installed textures remain unchanged.
Each atlas records its own master directory so a partial refresh retains the
provenance and exact-pixel checks for masters from earlier bakes.
For example, the hallway allocation and attic exposure refresh is:

```sh
python3 scripts/runpod_bake.py auto --target house-atlases --quality final --atlas-groups structure-hall hall-trim structure-attic original-attic attic-hatch-closed attic-fixtures
```

Native source repairs persist in the `.blend` files and the source
generation pipeline. Source helpers are included in the upload fingerprint.
Cellar window spill starts on the room side of its opaque backdrop/masonry,
preventing a blocked, black bake. Ceiling paint is authored on the visible
ground-floor slab undersides in both editable models and `house_finishes.py`;
the separate cellar ceiling panels alone do not cover those undersides.
`check_house_source_uv.py` verifies UV restoration, coplanar seams, tangent normal
bases and preservation of the painted underside material slots.
Irradiance and albedo are baked separately. Only irradiance is denoised, then
multiplied by the untouched albedo in linear space before display grading.
Unlit source materials retain a separate emission contribution; the tiny Blender
fixture `scene/scripts/check_house_atlas_emission.py` verifies this with a glTF
light-path wrapper and a Principled material on adjacent faces.
PNG and EXR masters remain lossless. Production encodes lighting atlases as WebP at quality 80,
keeps 18-bit atlas UV precision, and produces one shared asset set for all
browsers. Per-atlas delivery limits are 1024 or 2048 pixels to bound phone
texture memory; these are applied from the lossless masters before WebP
encoding. There are no phone variants or viewport-dependent texture resizes.

```sh
python3 scripts/runpod_bake.py auto --target house-atlases --quality final
node scripts/assemble-house-atlases.mjs <verified-output>
ATLAS_REFRESH_DIR=scene/exports/house-release/atlas-refresh node --test --test-name-pattern='^(?!production)' tests/house-atlas-refresh.test.mjs
node scripts/publish-house-atlases.mjs
npm test
```

The default allocator starts with the full PRO 6000 Blackwell Workstation GPU.
Check the current quote before adjusting budget/hourly limits. Include provisioning and
result transfer in the time cap; a short rendering estimate alone is insufficient
for a cold worker. The normal runner verifies the output checksum and deletes the
pod before installing any assets.

```sh
python3 scripts/runpod_bake.py quote
# Override the limits when needed:
python3 scripts/runpod_bake.py auto --target house-atlases --quality final --budget 5 --max-hourly 2.50 --max-minutes 60
```

The merger stages `scene/exports/house-release/atlas-refresh` for validation.
It does not deploy or install the results automatically. `--prepare-only` and
`--smoke` on `bake_house_atlases.py` provide a source audit and tiny local end-to-end
validation before paid rendering. The user rejected the illustrated hallway
experiment; this refresh uses the original materials and moonlit window rig.

## Local atlas experiments and trim noise guard

Use `npm run bake:atlases -- hall-trim` to run the production atlas refresh on
this machine. It uses 64 samples and full timber normal strength, fingerprints
inputs, bakes, assembles, validates geometry, and publishes locally. No cloud
service is contacted. `--stage-only` leaves the result for inspection. Outputs,
raw linear irradiance, albedo, filtered irradiance, quality scores and the log
are saved under `scene/renders/local-atlases/<timestamp>/`.

The `hall-trim` lighting pass uses a normalized binomial filter with a four-texel
standard deviation within connected coplanar UV charts, replacing photographic
whole-atlas denoising for this group. Filtering cannot cross into another board
face or packed object. The twelve-texel bake gutter is rebuilt from filtered
lighting. The separate albedo pass retains wood grain; native timber normals
remain enabled. Other atlas groups retain their previous treatment.

`scene/scripts/house_lightmap_filter.py::speckle_score` returns a relative
high-frequency lighting contrast in [0,1]. Solid colors and linear gradients
score zero; half/full contrast alternating speckle score approximately .5/1.
The trim bake rejects measured chart interiors above .12 before export. Charts
without a two-texel interior are explicitly reported as too small to measure.
This is a numerical noise indicator, not image recognition: use irradiance,
not textured color, to avoid treating intentional wood grain as a defect. The
same function/masks can measure ceiling, wall and baseboard lighting, but those
atlases are not changed by this trim experiment. The regression fixture contains
raw pixels from the original noisy trim, so a disabled filter fails the guard.

Run `node --test tests/house-lightmap-filter.test.mjs` for the detector tests.
Outside macOS, set `BLENDER_PYTHON` to a Python interpreter with NumPy. NumPy is
included in Blender; no additional bake-time package is required. The atlas
publisher fingerprints this helper, and cloud input bundles include it too.

The trim compositor reopens the saved EXR passes instead of retaining mutable
generated images across subsequent bake operations. It writes a linear composite
EXR and rejects any difference above 1e-5 from filtered irradiance × albedo. This
checks the actual composited output as well as the filtering buffer. To retry
postprocessing without tracing new samples, use
`python3 scripts/reprocess-house-trim-local.py <local-bake-output>`; it verifies
that the model, lighting and reflectance inputs still match, keeps original ray
tracing provenance and pass checksums, and fingerprints the new postprocessing
inputs before assembling and publishing. It never contacts a cloud provider.
