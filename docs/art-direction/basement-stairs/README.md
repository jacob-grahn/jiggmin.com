# Basement stairwell

The stairwell is included in `basement-baked.glb`, in basement-local coordinates.
Runtime connector geometry omits the baked stairs, and their materials are exempt
from the basement front-wall clipping plane. All stairwell details remain fixed.

The twenty-tread flight has eased nosings, continuous wooden handrails and brackets,
a single cream sloping ceiling, two switched-off recessed fixtures, and two framed
abstract compositions. Blue light enters from the hallway end of the stairs.

Rebuild with `python3 scene/scripts/build_connected_house.py`, then
`node scene/scripts/prepare_basement_bake.mjs` and Blender's
`scene/scripts/bake_basement.py` entry point. The stair surfaces share the basement's
4096 room / 2048 ceiling atlases and 128-sample denoised diffuse bake.

Screenshots use a fixed inspection camera at the top of the flight, with the app’s
material treatment. This makes the architecture easier to compare than screenshots
taken at different instants during the moving-camera transition.

Validation: all 132 tests pass, including world-space alignment of every stairwell
part, unobstructed camera travel, fixed-prop classification, and independent
clipping of the room and stairwell materials.
The in-app hallway-to-basement transition completes, and the browser reports no
console errors.
