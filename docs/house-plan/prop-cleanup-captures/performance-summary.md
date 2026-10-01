# House prop cleanup and local performance check

Measured in the local Codex in-app browser using the source house-release fixture at a 1335 × 1282 drawing-buffer resolution. These samples force redraws; they are not normal idle activity, a display FPS test, or a laptop temperature measurement. The live den is separate and is not included in this fixture.

| View | Props before → after | Draw calls before → after | Median render CPU ms before → after | Single-throw physics median / p95 ms |
|---|---:|---:|---:|---:|
| hallway | 17 → 13 | 838 → 168 | 15.8 → 4.5 | 0.2 / 0.8 |
| workshop | 46 → 46 | 407 → 169 | 17.4 → 4.8 | 1.5 / 3.0 |
| basement | 100 → 74 | 1219 → 377 | 21.9 → 11.7 | 0.5 / 0.9 |
| attic | 92 → 65 | 803 → 248 | 20.8 → 8.4 | 0.7 / 1.9 |
| private-hall | 0 → 0 | 431 → 117 | 12.1 → 5.6 | 0.0 / 0.0 |

All five views produced zero renders during the one-second idle sample, with zero awake dynamic props. Room rendering is already demand-driven. The main den animation loop also skips its rendering and physics while the house is open.

Rendering samples cover 90 animation-frame callbacks per view and include room passes plus screen target updates. Draw calls and triangles are accumulated across the entire frame. Eight separate synchronous GPU-completion samples use gl.finish(); they include CPU, GPU and synchronization overhead, and are stored as completedMedianMs. Frame interval values in the raw data are browser callback intervals, not a claim about game FPS. Timing varies with browser scheduling and background activity.

Active physics samples release one prop and measure 120 calls to physics.step(1/60), then restore all prop poses and pinned states. They are a limited interaction sample, not a stress test of every prop falling at once.

Changes: laundry rests near the basket base; decorative loose sheets, packing slips and rolled paper are removed; journal scraps are hidden until discovery; clipping shelf cloth and the spoon-like microphone are removed; the basement floor coil is continuous; the attic robot body, panel and four wheels share one physics body. Compatible rigid geometry is batched by material and layer, with static geometry kept in small spatial cells. Doors, ladders, glass and special surface shaders retain separate meshes. Batched surfaces use the existing triangle acceleration library for picking.

Validation: production build and 29 targeted checks passed, including transformed batch bounds/UVs, rigid robot throws, picking, discovery targets, existing prop assemblies, hall finishes and windows. The attic robot was also dragged in the browser.
