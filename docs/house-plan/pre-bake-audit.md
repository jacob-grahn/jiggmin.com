# House pre-bake audit — 2026-09-29

Visual target: the original baked hallway, workroom, basement and attic, and the original live den. The house should keep their palette, window-led moonlight, objects and illustrated finish while moving them into a coherent floor plan. New connective surfaces should use the same source materials and receive a Blender lighting bake before release. Do not bake the current live-light approximation as the style target.

| Issue | Measured cause | Pre-bake correction |
| --- | --- | --- |
| Basement looks low and wide | Original shell was 4.0 m tall, 10 m wide and about 13.8 m deep. Current assembly scales it by `(1.2, 0.675, 0.9)`, yielding a 2.7 m ceiling and 12 m width. Furniture has a separate effective Y scale of 0.9. | User chose the original 4 m height. Deepen the floor and stair to −4 m, restore source-height shell/contents and recheck the horizontal fit before baking. |
| Wall finish differs | Old fixed surfaces carry Cycles lightmaps. New connecting walls use source paint/wood materials plus the browser's live illustrated hatch; they have no final lightmap. | Keep the original blue paint and restrained occasional hatching, then bake the connecting surfaces with moonlight entering through their actual windows. |
| Doors differ | The assembled layout uses simple 2.08 m cuboid leaves and separate raised-panel boxes. The old hallway has modeled recessed leaves, two panels, jambs, casings, hinges and brass knobs. | Refit that original door language and source wood/oak materials to the new openings. Bake the fixed casing and keep leaves separate for travel. |
| Hall runner missing | The original 1.16 × 11.1 m woven runner and fringe were explicitly omitted from the blockout because it crossed new junctions. | Refit a shorter runner to the cross hall, clear of the stair and mudroom thresholds, retaining the original weave, border and fringe. |
| Exterior shows at basement/stairs | The restored original basement has a rear wall and side walls but no front wall at world Z≈12; its original camera never needed one. The new stair path sees that missing side of the room. | Close the basement front perimeter and stair bay, with a real stair opening and window well only where planned. Inspect the whole descending route and the turn toward the pool table. |
| Front door shows exterior gaps | The door opening is 2.15 m high but the closed leaf reaches only 2.08 m; its side edges also stop about 1 cm short of the casing. | Size the leaf and stops to overlap the aperture. Check closed and moving-door frames from the actual route cameras. |
| Exploration is slower | Room contents are still unloaded after travel, but an 850-mesh shared structure stays loaded. Illustrated contours add more geometry, and five 1024² live shadow-casting window spotlights add render passes. | Remove the new live spots, keep static surfaces baked, reduce permanent shell draw calls, then measure frame timing and memory on this laptop before the final bake. |

The original room bake is `scene/scripts/bake_room.py`. The connected-house bake is `scene/scripts/bake_house_release.py`, but the current publisher (`scripts/restore-house-style.mjs`) bypasses its output. The live window spots have been removed. The current connected-house bake script still uses a global moon/sun and a different grade from the original room bake, so the expensive final command now stops before launching Blender. Rebuild its lighting from the original window rigs and validate a small test bake before release.

## Changes made

The basement floor and stairs now reach −4 m, and its furnishings retain their source height. The original basement lightmaps, shell, windows and room arrangement are back. The added front enclosure closes the previously missing side. The main hall has a shorter piece of the original woven runner, and the visited doors use the original paneled leaves, hinges and brass knobs. The front leaf overlaps its opening. Original wall and door materials are restored in the native production scene and published assets. Browser shadow maps and new live window spotlights are off. Room contents still unload when leaving a room.

The basement envelope is now resized as mesh geometry, while furnishings retain their original dimensions and move as rigid assemblies; its room root has unit scale. The tight U-stair can still fill the camera with a nearby wall during a return turn. The connecting shell remains unbaked and underlit. Exterior leaks and the den passage need final visual review across intermediate frames, and laptop frame time still needs measuring before the final bake. The current fast preview is for geometry and interaction decisions, not lighting approval.

Pre-bake acceptance: compare the original and assembled hallway, workbench, basement and attic from the same camera angles; inspect both directions of every route at several intermediate frames; confirm no exterior leaks except through windows/open doors; verify the den endpoint matches its original framing; confirm the runner and door finish; measure laptop frame time with current and adjacent rooms loaded. The final Cycles bake starts only after this fast review passes.


## Continuous den passage

The den transition now places the original live 3D den in the shared house scene.
Its projected Cycles lighting stays anchored to the original camera, transformed
through the inverse room placement. Both rooms use the same travel camera and
depth buffer. The duplicate proposal envelope inside the den is trimmed away;
the shared wall, moving door and threshold remain. The scenic den foreground is
trimmed at the shared wall so it cannot extend into the entry.

The opening is now centred behind the original den camera (Z=9.334 m), preserving its 1.4 m width. The camera backs through it, then turns after
crossing the wall. The den copy now uses a uniform studio-unit conversion
of 0.55 applied to its geometry and positions, followed by a rigid placement.
Its camera has unit scale and an ordinary inverse; the original game scene,
responsive framing and interactions remain untouched. There is no fade or
position-triggered renderer switch.

Slow-motion review screenshots are in `den-transition-captures/`. The route is
also recorded in the preview spec and release layout/publisher. The doorway and route have been synced into both saved house Blender files. Before the final
bake, import the retained original den envelope into the production assembly: the runtime now uses that envelope rather than the
replacement walls. Original Blender sources and lighting plates remain untouched.

## Door clearance and den exit closure — 2026-09-30

The plate, backing, stand, shelf, both brackets and shelf jar now sit 1 m farther
along the cross-hall wall, clear of the basement door. The earlier partial move
had shifted only one bracket. `repair_plate_clearance.py` updates both saved
house Blender files; the style publisher applies the same idempotent placement.
The fast preview has been re-exported from that saved source.

The den overlap cut now retains the complete floor slab and ceiling, including
ceiling meshes whose glTF metadata lives on a parent group. The earlier cut
misclassified those multi-material ceiling meshes as walls and removed them. Keeping
only a landing strip was insufficient: the bottom rays at Exit 30% intersect
floor around X=2 m, farther inside the den. The slab infill sits just beneath
the original boards/rug, so their existing baked surfaces remain visible.
The original projected bake also ends before the newly exposed foreground;
that foreground uses the original wood atlas with a fixed floor shade sampled
from the den bake. This is preview coverage, not new live lighting or a final
lighting bake. The new connective surfaces still need the original Blender
window-lighting workflow before release.

Both den travel directions were replayed at 5× duration, with 10% milestone
screenshots. `den-transition-captures/repairs-review.png` shows the repaired
Exit 30% frame and the unobstructed hallway door. Geometry tests cover the floor
and ceiling inside the den as well as under the doorway, and verify the complete
plate assembly clears the door.

### Camera motion review — 2026-09-30

Travel now uses bounded quintic corner curves with matching tangents and zero curvature where they join straight passage runs. The existing doorway waypoints and room compositions remain intact. Heading is smoothed over distance, with unwrapped yaw so a turn cannot switch abruptly across 180 degrees. Endpoint views stay exact and the horizon stays upright.

A shared arc-length clock limits translation to 1.8 m/s and steering to 55 degrees/s, slowing locally during turns. It ramps velocity gently over the first/last 0.8 seconds instead of imposing a short maximum duration on a long route. The den uses the ordinary steering limit. The basement now flies directly from the lower stair flight to the final view, settling into its room-facing heading once. Den doorway travel also retains that room-facing heading in both directions.

The Blender preview uses the same motion clock, heading, and reverse orientation as production. Editable native waypoint curves remain unchanged; smoothing is performed by the shared browser modules. Source debug URLs accept `?slowHouseTravel=1` for normal speed with frame captures, or a larger multiplier for all routes. Captures remain in `den-transition-captures` for compatibility and now include branch names.

Numerical checks cover peak translation/steering speed in both directions, gentle starts/stops, smooth curve joins, exact endpoints, the basement's direct arrival, and the actual den steering. Browser captures were reviewed for the den, basement, workroom, and attic. The production and native-preview geometry checks use the new motion clock rather than the old easing profile. No Blender lighting bake was run.

Final validation: production build passed; 174 tests passed. Both actual-export clearance reports passed in forward and reverse travel with no structural, content, animated-access crossings, or body clearance warnings. Reference montages: `den-transition-captures/smooth-basement-review.png`, `smooth-basement-arrival.png`, `smooth-workshop-review.png`, and `smooth-attic-review.png`. These are preview captures; existing pending lighting bake work remains as documented above.


### Basement model refit and workroom shirt removal — 2026-09-30

Removed the three PR2 shirt pieces (cloth, printed chest panel, collar) from the published workroom and both saved Blender assemblies. The room generator and publisher omit them on subsequent exports.

Replaced the basement's `(1.2, 1, .9)` room transform with a translation-only root. `scene/basement-refit.json` defines the footprint and rigid placement stations. Only structural envelope vertices are resized; their normals and existing UVs are retained. Pool table parts and balls, recorder station, archive shelving, community table, stool, chair, laundry basket, window frames, and framed artwork retain their original proportions and move together. Runtime cartridges, drain, and ceiling canopy use rigid placement too. The balls are now true 14 cm spheres without a compensating scale.

The native preview and production files use the same refit. Their stair and window apertures are actual mesh openings. The room preparation and style publisher follow the refit so future exports preserve it. Original standalone room sources and lightmaps remain available; no lighting bake ran for this change.

Validation: build and 176 tests pass, including equality of every original furnishing's world-space rotation/scale basis and rigid alignment of all pool-table parts. Published and native-preview geometry checks pass in both travel directions. Browser review confirms both rooms load, the shirt prop is absent, and all five pool balls retain spherical shape. Frame captures: `den-transition-captures/basement-in-1.000.png` and `workshop-in-1.000.png`.


### All-room refit, plywood and direct cellar arrival — 2026-09-30

All room fitting transforms are now unit scale. The shared refit specification
is `scene/room-refit.json`; basement geometry and assembly stations remain in
`scene/basement-refit.json`. Furniture keeps its original proportions and moves
as complete assemblies. Studs and runner dimensions are edited in owned mesh
geometry instead of stretching the room. The den uses a uniform 0.55 conversion
from studio units to metres, including its camera and lighting projection.
Its original game scene and assets are untouched. The unstretched den needs
a small west-side floor/ceiling bay, reaching X=-1.4 m; the saved assemblies
contain that infill instead of squeezing the den to the old nominal footprint.

The workroom now has three plywood backing panels using the original workshop
wood material and baked atlas, with actual window and doorway apertures. The
shared Blender helper and publisher keep the panels on subsequent exports.

The final cellar leg lifts from the lower flight at (11.15,-1.65,9.1) and flies
directly to (8.7,-2.35,10.5). The lower side enclosure is open, leaving the
upper enclosure intact. Speed and steering caps still apply. Both saved Blender
files, the native preview and published routes use this path.

Validation: build and 178 tests pass. Published and native-preview route checks
pass in both directions with no shell, prop or animated-access crossings or
clearance warnings. The native preparation matcher restores all 111 hallway,
136 workshop, 285 basement and 244 attic objects. A browser comparison of the
original den bake and its house copy differs in only three colour channels
by more than 3/255 across the 960x540 frame (floating-point edge pixels); mean
channel difference is 0.0009/255. The TV-area artifact in the older cached
travel shader is gone after the corrected cache revision.

Current review captures are collected in `scale-refit-captures/`. No Blender
lighting bake was run. Connective-surface lighting and native den envelope
preparation remain the previously documented pre-bake work.

### Cream ceilings and open garage-window framing — 2026-09-30

`scene/house-finishes.json` now defines the light cream paint and framing dimensions.
The saved preview and production scenes paint ceiling surfaces, including the
basement and underside of the attic roof. Attic-floor top faces and exterior roof
faces retain their materials. The attic access lid, ceiling mouldings and exposed ceiling joists share
the cream finish; lamp fixtures retain their own materials. The original den
projection, game layout and controls remain unchanged.

Garage studs are trimmed clear of the rear and side-window apertures (and the
side doorway). Each window has full-height king studs, jack
studs, a header and a sill. Plywood backing retains its actual openings. The
Blender finishing helper and reference publisher repeat the same repair on later
exports. New framing reuses the original workshop wood material/atlas in the fast
preview. Cream basement paint is previewed from its existing baked illumination;
the saved Blender material supplies the actual paint for the final lighting bake.
No lighting bake ran for these edits.

Validation for these finish edits: build and all 180 tests pass. The final paint-only lid update also passes the 17 style/release checks. Both published and native-preview camera paths retain their clearance.

### Duplicate garage framing removed — 2026-09-30

The original workshop owns the rear and left framing; the house shell supplies
the right framing. Removed the eight added rear-wall studs and the two original
regular studs superseded by the rear window's king/jack assemblies. Kept the
window headers and sills. The finishing helper and publisher apply the same
cleanup, and the shell generator no longer creates a second rear row. Both saved
Blender assemblies and the native/published exports are updated.

Validation: build and 17 style/release tests pass. Native and published camera
clearance checks pass in both directions. Export inspection confirms eight
remaining rear regular studs, seven left studs, eight right studs and twelve
window-frame members, with no added rear row. No lighting bake ran.

### Garage window decorations relocated — 2026-09-30

Moved the whole pegboard assembly to the plywood right of the rear window, and
the Greg note with its lettering and pushpin below the clock on the left. The
42 component meshes retain their original dimensions, orientation, artwork and
materials. `scene/room-refit.json` supplies the assembly offsets to both native
and reference publishing helpers. Saved-scene updates track applied offsets so
reapplying finishes does not accumulate movement. Both Blender files and exports
are updated without a bake.

Validation: build and 17 style/release tests pass. Export geometry confirms all
42 parts clear the rear window, and native/published camera clearance checks
pass in both directions.

### Workshop seated view and tall chair — 2026-09-30

Kept the one-metre-high bench and raised the camera by 22 cm to [14.25, 1.87, 3.8].
The new view looks slightly right and higher, toward [14.65, 1.38, 0.2], with a
52-degree vertical field of view. This reduces the empty space below the bench
while retaining the desk projects. Added a tall wooden chair at the stop, with
a seat, splayed legs, backrest and footrest, matching the original timber palette.

`scene/workshop-seating.json` supplies the view and chair placement. The finish
helper updates both Blender assemblies and recreates the chair without duplication;
the reference publisher uses the same view and final route endpoint. The bench
and original room furniture retain their geometry and materials.

Validation: build and 23 style, release, travel and preview-camera tests pass.
Native and published route clearance checks pass in both directions. Saved/exported
chair geometry has 12 members and the camera/route endpoint match the specification.
No lighting bake ran.

### Original-window release bake — 2026-09-30

Completed the local release bake with the original window-only UV bake colors,
world strength, AgX exposure, saturation and explicit HDR denoising. The reviewed
assembly supplies the exact geometry. Six new atlases cover 598 fixed connecting
surfaces and four repainted basement-ceiling meshes: 4K for the hall, 2K for the den
surround, garage, attic, stairs and basement ceiling. The 64-sample final bake took
1,892 seconds. Original den and room furnishing/artwork atlases remain intact;
the hallway, workshop and attic assets are preserved byte for byte. Doors, ladders,
movable props and their shadows are excluded from the new static bake.

The publisher overlays lighting only, preserves every reviewed triangle, and
requires a matching small test bake before the full run. Completed atlases are
cached by source fingerprint; input meshes have deterministic ordering. A resumed
small bake reused all six atlases and produced byte-identical lighting GLBs.
The original wood color map remains available to the den's newly exposed floor;
its reveal is zero at the seated endpoint to preserve the original composition.
Neither editable Blender file nor the original source-room assets was overwritten.

Validation: build and all 183 tests pass. Final route checks in both directions
report no structural, contents or animated-access crossings or body-clearance
warnings; all tested viewport targets are reachable. The static seated-den browser
comparison reports a mean channel difference of 0.0010/255, with 22 channels over
3/255 (floating-point/antialias edges), identical to the small-bake comparison.
Reference and assembled captures are in `bake-captures/`. The final bake is published
locally; there was no deployment.

Full-resolution hallway, workshop, basement and attic views were checked in the
browser after publication, with entry/return captures saved alongside them.
The published-asset route audit also passes. The local browser remains open on
the baked house for review.
