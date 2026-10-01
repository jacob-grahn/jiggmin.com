# House release — original style and baked connections

The original den remains the main game scene and is cloned into house travel with
its original projected Cycles lighting and camera composition. Room furnishings,
artwork, door textures and the hallway runner retain their original materials and
lighting atlases. Furniture has rigid placement and unit room fitting transforms.
The den uses a uniform studio-unit conversion in geometry.

The release bake adds camera-independent Cycles diffuse atlases to the new fixed
architecture, workshop plywood/framing/chair, fixed window frames/recesses, exterior
geometry, stationary fixtures, cellar drain and cream basement ceiling.
It uses the original `bake_room.py` window colors, world strength, AgX exposure,
HDR denoising and saturation. Area emitters match the assembled house's rectangular
window apertures and sit just outside them, allowing inner jambs and sills to receive light while spreading less light
across the ceiling. Original blue colors and grading are retained; hall emitters
are lower, narrower and dimmer to avoid washing the ceiling. Remaining ceiling fixtures
remain off. There is no global sun or live window
spotlight setup. Existing approved room bakes are reused rather than regenerated.
Movable props and animated doors/ladders are excluded from static shadow baking.
Clear glazing is also excluded. The exterior uses the existing illustrated panorama,
framed higher to show moonlit clouds and graded dark with restrained backlit details.
The panorama has no painted moon disc; the shader glow and baked exterior backlight remain. Foreground trees use irregular silhouettes, and the panorama repeats three times using one shared texture. No volumetric rays or per-frame lighting updates are needed.
The below-grade cellar windows have wider exterior light wells, leaving a sky
sightline through their upper panes from the seated camera. Baked wooden recesses
match the masonry depth rather than extending a metre into those views.

## Rebuilding

After native scene edits, update the saved preview and production exports using the
existing scene editing helpers. Only regenerate production preparation when needed:

```sh
npm run release:house:prepare
python3 scripts/house_release.py test --review
# Inspect the small test bake before the expensive run:
# Open /tests/fixtures/house-release.html?test&clean
npm run release:house:bake
npm run release:house:publish
npm test
```

The test step snapshots the original-style assembly in
`scene/exports/house-release/bake-input/`. The full bake requires a matching test
source fingerprint. Individual completed atlases resume only when the native input,
reviewed geometry and bake scripts match. The bake never overwrites an editable
`.blend`. Lighting is overlaid on the snapshot, preserving object ownership,
interaction IDs, placement and triangles. Reports and EXR/PNG atlases are saved in
`scene/exports/house-release/test/` and `final/`.

The `--review` stage applies the shared fixture refinements to a separate raw
reference before snapshotting. It removes the hall mouldings, attaches the cellar
pipe and adds its ceiling bend and brackets, attaches the attic junction and bulb
cord/socket, moves the two attic cartons forward, and gives the garage and mudroom
fittings unlit reflectance. Those fixtures receive their own baked lighting, and
the baked scene flag prevents the browser from rebuilding them. Other room
furnishings retain their original textures; movable-clutter cleanup and grouping
still use the shared runtime helpers. Static smoke detectors retain their separate
shared production atlas.

Publication defaults to the completed original-window final bake when present.
`node scripts/publish-house-release.mjs --reference` or
`npm run release:house:style` restores the pre-bake reference assembly for comparison.
These are local operations and do not deploy the site.

The older tan bake reports and `release-hallway.png` are historical artifacts.
Bedrooms, bathroom and kitchen remain reserved behind closed doors as planned.

## Window refinement — September 30, 2026

The workshop, hall, attic and cellar use brighter cloud details from the existing
moonlit panorama. The illustration, near tree silhouettes and original room
furnishing atlases are retained. Glass stays clear and separate from the bake.
Fixed window wood now receives the same baked light as the surrounding architecture:
42 structure frame pieces and 33 cellar frame/recess pieces. Cellar recess caps
match the 0.42 m masonry depth; wider exterior wells expose the upper panes to sky
from the seated view without moving the windows or furnishings.

The rectangular window emitters sit outside the glass. Original light colors,
powers, world strength and grading are preserved. This catches the inner sills
and jambs and softens ceiling spill. There are no new live lights or light rays.

The reviewed 512 px test bake completed in 119.8 seconds. The den comparison
fixture retained its prior result: mean channel difference 0.0010, maximum 21,
with 22 channels differing by more than 3. Preview captures are saved in
`window-refinement-captures/`.

The final 64-sample bake completed in 4,395.3 seconds (about 73 minutes), with
seven atlases covering 677 fixed meshes. The hallway atlas is 4096 px; the six
others are 2048 px. The final bake was published locally. All 185 tests passed,
and all five camera routes were clear in both directions. Room entrance targets
passed at 16:10, 16:9, 4:3 and portrait aspect ratios. The final den comparison
retained exactly the same difference metrics as the test bake. The report is
saved as `release-bake-report.json`.

The normal site was visually checked at all four room endpoints with no browser
warnings or errors. Final screenshots: [workshop](window-refinement-captures/workshop.jpg),
[hallway](window-refinement-captures/hallway.jpg),
[attic](window-refinement-captures/attic.jpg), and
[basement](window-refinement-captures/basement.jpg).

## Night and fixed-detail refinement — September 30, 2026

The basement has one camera view, aimed farther right. The suspended cloth beside
the pool table and the “Look right” control are removed. All original furnishing
proportions and the 4 m cellar height are retained. The drain and ceiling canopy
are now authored meshes, so the browser does not create duplicate live-lit pieces.

The hall ceiling lamps are removed. The attic hatch has a three-piece iron handle
that follows its hinge; its panel uses rough wood grain under white paint. The
hall window shows a moon, while the other windows retain dark cloud highlights.
Pale glass tint was reduced so it no longer washes black tree silhouettes gray.
All glazing is unlit. Moon backlight and lower, narrower hall window emitters are
Cycles bake sources only. No live window lights or volumetric effects were added.

The static bake includes exterior geometry and all stationary fixtures. Doors,
ladder sections, glazing, movable props and the animated hatch/handle remain
separate. The reviewed 512 px, 8-sample test bake completed in 85.0 seconds and
covers 845 meshes in nine atlases. All five routes are clear in both directions;
room targets and all four cellar hotspots remain reachable at 16:10, 16:9, 4:3
and portrait aspect ratios. The den comparison retains its existing mean channel
difference of 0.0010, maximum 21, and 22 channels differing by more than 3.

The final 64-sample bake finished October 1 in 3,330.4 seconds (about 56 minutes).
The hall atlas is 4096 px and the eight others are 2048 px. All 845 fixed meshes
passed the lighting overlay and ownership audits; all camera routes remained clear.
The complete release was published locally with source fingerprint
`f6ddbe8a8aa3ead7e8f5741d73546002bfd73a0a489ffb0805b0d450a6f45e72`.
The final den comparison has exactly the same difference metrics as the test bake.

All 187 tests passed against the published full bake.

All four room endpoints were visually checked on the normal site without browser
warnings or errors. Final captures: [hallway](night-refinement-captures/hallway.jpg),
[workshop](night-refinement-captures/workshop.jpg),
[basement](night-refinement-captures/basement.jpg), and
[attic](night-refinement-captures/attic.jpg).

## Trim correction — October 1, 2026

The thin ceiling mouldings, door surrounds and window framing had conspicuous
mottling in their baked lighting. `filter-house-trim.mjs` now filters each board
face independently in linear light after assembly, preserving the broad baked
illumination gradient. Non-trim UV texels, including their bilinear sampling
footprint, are explicitly protected and checked for byte-identical decoded pixel
values. Original room atlases, animated doors, artwork and the live den asset are
unchanged. This adds no runtime lighting, texture uploads or rendering work.

The original trim repair removed 31 exactly coincident skirting/moulding boards.
That duplication is now fixed upstream: stages 2, 6 and 7 had each generated trim
for shared walls 02 and 04. `house_trim.py` gives each wall one finishing-pass
owner, and the saved `house-plan-preview.blend` and staged structure export have
been repaired once. Authoring/export/bake checks now reject duplicates instead of
silently deleting geometry. The filter processes 170 fixed boards across five
existing atlases. The unfiltered structure is retained beside the final
bake as `structure-unfiltered.glb`, and `trimFiltering` in the bake report records
input/output hashes, filtered object IDs and filter revision.
Publication checks the filter revision. The pass runs automatically after bake
assembly and can be repeated without another Blender bake:

```sh
node scripts/filter-house-trim.mjs final
npm run release:house:publish
```

Regression checks cover smoothing without flattening the lighting gradient,
protection of neighboring texture islands, non-mutating duplicate validation
with different triangle diagonals, and unique ownership across finishing stages. The hallway comparison is in `trim-repair-captures/`.

The corrected final bake is published locally and the normal hallway preview has
been refreshed. All 190 tests pass. The five travel routes remain clear in both
directions, and entrance targets remain visible at 16:10, 16:9, 4:3 and portrait.

The upstream repair backups and verification records are in
`scene/exports/house-release/trim-source-repair/`. All retained staged geometry
and texture bytes were checked unchanged; all five corrected atlas images remain
byte-identical to the preceding preview. The completed bake’s
`house-release.blend` and `bake-input/` remain its original immutable input
snapshots, so its source fingerprint stays valid. The next prepare/test run
snapshots the repaired authoring scene. Reassembling the old raw bake (which
still contains duplicated boards) is intentionally rejected by validation.
No further lighting bake was needed for this source repair.

## Hallway ceiling and ceiling-trim follow-up — October 1, 2026

The first trim filter excluded the ceiling planes, and its small smoothing radius
left broad patches on the ceiling mouldings. The completed bake also predates the
upstream duplicate-board repair. A targeted 256-sample, 4096-pixel bake replaced
lighting for six hallway ceiling slabs and 36 ceiling mouldings, excluding the
31 documented coincident copies. It took 713.91 seconds on four CPU threads.
This was a partial lighting update: geometry, UV packing and room assets stayed
unchanged. Its recipe snapshot, HDR/PNG outputs and source fingerprint are in
`scene/exports/house-release/ceiling-repair/`; `ceilingRepair` in the bake report
records its provenance and protected atlas patching.

Higher sampling alone did not remove all visible edge mottling. The existing
face-isolated texture filter now smooths the six ceiling undersides in two
dimensions and uses a larger radius/gutter for the hall's ceiling mouldings.
Other faces, including the upper attic-floor surfaces, retain their existing
pixels. Whole-room original assets, geometry and UVs were verified unchanged;
`ceiling-repair/verification.json` records the protected-pixel comparison.
No renderer lighting, texture-sampling or outline changes remain. The correction
uses the existing atlases and adds no runtime maps or draw calls.

All 192 tests pass. Before/after hallway captures are in
`docs/house-plan/ceiling-repair-captures/`. The corrected bake is published locally
and the normal preview is open at the hallway. New complete bakes automatically
use the expanded face filter after assembly; duplicate trim continues to be
rejected upstream rather than removed by export code.


## Reviewed fixture production bake — October 1, 2026

The reviewed geometry was staged before the new production bake, including the
wall-mounted basement pipe and ceiling bend, brackets, attic bulb and roof cord,
junction fittings, forward cartons, unlit garage/mudroom fittings, and removal of
the hall ceiling mouldings. The shared smoke-detector atlas was freshly baked
against the same input geometry. Runtime cleanup retains the earlier loose-paper,
cloth, rope, robot grouping, panorama, ground, tree and cream-ceiling refinements.

The 8-sample 512 px test bake passed geometry, fixture and route checks. The full
64-sample production bake completed in 2,949.5 seconds (about 49.2 minutes),
covering 785 fixed meshes in 10 atlases: 4096 px for the hall, 2048 px for the
other groups. Three static detectors share a separate 1024 px atlas at 64 samples.
The source fingerprint is `5ce9c63d81e3e82f33bbf330e007fc0931fb27315d19bff2bcab65ef257ecc69`.

Assembly preserves nearly black lighting maps instead of allowing texture pruning
to approximate them as constant colors. Tests compare the basement and attic
fixture atlas bytes with the generated PNGs, preserve every reviewed triangle,
and retain the original textures on untouched attic furnishings. The normal
`release:house:test` command now stages the reviewed fixtures before snapshotting.

The complete release is published locally. The production build and all 208 tests
pass. All five walking routes are clear in both directions, including the wider
basement arrival curve, and room targets pass all four tested viewport shapes.
Production review captures are in `review-release-captures/`.

## Ceiling and hatch lighting in the production site — October 1, 2026

Removed the flat cream runtime overrides so the hallway ceiling retains its
painted finish and baked window illumination. Hall ceiling mouldings remain
hidden when loading an older export.

The moving attic hatch now uses a separate 512 px, 64-sample closed-position
lightmap with painted-wood UVs. Its geometry, hinge, door metadata and animation
remain intact; its reference lighting moves with the rigid hatch and adds no live
lights. The bake shares the full release's source fingerprint. Reproduce it with
`node scripts/bake-attic-hatch.mjs`; subsequent publication preserves the
supplemental asset through `includeFixedFixtures`.

The actual production site is served from `dist` at `http://127.0.0.1:8000/`,
using normal house navigation without the fixture test controls.
The rebuilt production site and all 210 tests pass, including retained hatch
geometry, hinge transforms, baked shading and atlas provenance checks.

## Shared hallway wall collision — October 1, 2026

Room prop physics now includes nearby wall sections from the shared house
structure. Previously the visible right hallway wall lived outside the room's
physics model, allowing thrown props to pass through it. Wall colliders are
captured before render batching, preserving individual door/window openings,
then filtered by each room's bounds and elevation. Regression probes against
both actual hallway walls verify impact and prevent crossing the visible faces.
The production rebuild and all 211 tests pass.

## Hallway resource lifetime — October 1, 2026

The hallway contents now unload after arriving in another room. Travel loads
the origin, destination and connecting hallway, then removes every room except
the destination and disposes its owned textures, geometry and materials. A return
trip reloads the hallway before animation starts. Re-entering the current room
does not load the hallway unnecessarily. `data-house-loaded-rooms` on the house
host exposes the current room set for preview verification.
The production rebuild and all 211 tests pass. Production browser checks show
only `workshop`, `basement` or `attic` loaded after their respective arrivals;
return trips reload the hallway and remove the departing room.

The 360-degree outside panorama now uses two thirds of its previous shader
brightness. The adjustment reuses the existing image and preserves the separate
atmospheric halo and baked room lighting.
