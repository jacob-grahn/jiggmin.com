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
the browser loads their finished meshes directly. Other room furnishings retain
their original textures. Clutter cleanup runs during source preparation; only
physics grouping remains at runtime. The full release command also rebuilds the
smoke detectors against the current source, retaining their separate shared atlas.
Their mounting positions and orientation are derived from the actual ceiling
surfaces, including the den floor’s small authored slope above the basement.

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

## Static source preparation — October 2, 2026

Permanent geometry, prop placement, window openings, exterior scenery, and floor
artwork are authored by `scripts/prepare-house-static.mjs` before baking.
`stage-house-review.mjs` authors the fixed fixtures. The browser only handles
interaction, camera travel, glass compositing, and room resource lifetimes.

The former trim/ceiling pixel-filter and ceiling-patch scripts have been retired.
Cycles lighting and its standard denoising pass produce the final lightmaps;
assembly no longer blurs selected UV islands. Duplicate trim is rejected by
`scripts/house-source/validate-trim.mjs` and fixed in the authoring scene.
