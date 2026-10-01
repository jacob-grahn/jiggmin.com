Three fixed smoke detectors are ceiling mounted in the hallway, garage, and basement. The hallway placement clears the moving attic hatch.

The detectors are authored in `scene/scripts/house_smoke_detectors.py`. `bake_smoke_detectors.py` uses the existing house's fixed occluders and original Blender/Cycles window rig, with 64 samples, denoising, and the same color grading. A small cellar bounce fill is used only during the bake to keep that fixture visible. The three detectors share a 1024 px baked atlas. They contain no lights, animation, hotspots, or physics bodies.

The shared renderer loads the baked `smoke-detectors.glb` with the fixed structure before material conversion and static batching. The original room assets and their atlases remain unchanged. Reference restoration and release publishing retain the supplemental fixture asset through `includeFixedFixtures`.

Repeat the additive bake and update the local preview with `node scripts/bake-smoke-detectors.mjs`. This requires Blender's usual macOS graphics access. Bake provenance is in `smoke-detector-bake-report.json`.

Validation: 18 targeted tests passed, including five ceiling-contact samples per detector against the actual release shell, baked texture checks, zero interactive props, and existing release lighting and fixture checks. The production build passed and compresses the complete shared fixture asset to approximately 70 KB. Review captures are in `smoke-detector-captures/`.
