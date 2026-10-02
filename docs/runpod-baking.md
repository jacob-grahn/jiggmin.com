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

```sh
npm run cloud:status
npm run cloud:quote
npm run cloud:test
npm run cloud:bake -- --quality test --budget 2 --max-hourly 1 --max-minutes 60
# Full resolution; same recipe and samples as release:house:bake:
npm run cloud:bake -- --quality final --budget 2 --max-hourly 1 --max-minutes 60
```

`npm run cloud:bake` uses the automatic allocator. It tries Secure Cloud GPUs in
this order: **RTX PRO 6000 Blackwell Workstation → RTX 5090 → RTX PRO 6000 Blackwell Server → RTX PRO 6000 Blackwell Max-Q**. Each candidate is tried once.
Unavailable quotes and candidates outside the requested hourly/budget/runtime
limits are skipped. If capacity disappears during creation, the runner checks
that no pod was created before trying the next GPU. Every selection and skip is
printed; the allocated GPU is recorded in the run's `state.json`.

Customize the order or pin a single GPU:

```sh
npm run cloud:bake -- --target den --budget .50 --max-hourly 1 --max-minutes 30
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

The recipe repairs source UV mapping (including signed object names and metre
mapping for primitives without UVs), applies corrected hallway ownership to the
window wall, and allocates per-room/surface atlases based on world surface area.
Cellar window spill starts on the room side of its opaque backdrop/masonry,
preventing a blocked, black bake. The reviewed cellar ceiling paint is retained.
Irradiance and albedo are baked separately. Only irradiance is denoised, then
multiplied by the untouched albedo in linear space before display grading.
PNG and EXR masters remain lossless. Production applies quality-80 WebP once,
keeps 18-bit atlas UV precision, and produces one shared asset set for all
browsers. Per-atlas delivery limits are 1024 or 2048 pixels to bound phone
texture memory; these are applied from the lossless masters before WebP
encoding. There are no phone variants or viewport-dependent texture resizes.

```sh
python3 scripts/runpod_bake.py auto --target house-atlases --quality final --budget 5 --max-hourly 2.50 --max-minutes 90
node scripts/assemble-house-atlases.mjs <verified-output>
```

The merger stages `scene/exports/house-release/atlas-refresh` for validation.
It does not deploy or install the results automatically. `--prepare-only` and
`--smoke` on `bake_house_atlases.py` provide a source audit and tiny local end-to-end
validation before paid rendering. The user rejected the illustrated hallway
experiment; this refresh uses the original materials and moonlit window rig.
