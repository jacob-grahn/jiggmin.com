# Runpod house baking

The cloud runner uploads only the Blender house, bake inputs, scene Python scripts,
and texture folders. It runs the existing bake recipe with Blender 4.5.14 LTS and
NVIDIA OptiX, verifies the result archive, then deletes its temporary pod.
It never publishes or replaces current site assets.

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

Both bake commands create a paid Secure Cloud RTX 4090 pod. The runner checks the
current quote plus a conservative disk allowance, then verifies the allocated
pod price. A quote can change between lookup and allocation; an over-limit pod
is immediately deleted. Account credit and GPU availability are required.
Use `--gpu 'NVIDIA GeForce RTX 5090'` or `--gpu 'NVIDIA RTX A5000'` when appropriate;
the same price and runtime limits apply. The selected GPU never changes silently.

Outputs, source-file hashes, logs, timing, and cleanup state are saved in
`.runpod/<run-id>/`. Downloaded files are under `output/`; the run does not copy
them into the canonical release directory. Review and assemble the lighting
meshes before using the normal local release/publish pipeline.

## Cleanup and limits

The local process explicitly deletes its pod after success or failure and checks
the pod list to confirm deletion. It records a unique pod name before creation
and reconciles by name if creation returns an ambiguous network error. Never
blindly retry a creation request. A new invocation refuses to start while an
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
