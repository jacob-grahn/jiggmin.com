# House exploration

The existing den is the entrance to four additional rooms. On desktop landscape screens (at least 1000 CSS pixels wide, aspect ratio at least 1.38, fine pointer), one right-edge arrow invites exploration. Smaller screens keep the original den experience.

## Rooms and discoveries

- Hallway: a long, narrow corridor with unlabeled doors fitted into both walls, a locked door at the far end, a rainy window on the right, and a ceiling hatch with a pull cord leading to the attic. Shallow wall displays hold the kindergarten plate and community contests. The far-end door remains unavailable for later expansion.
- Garage workshop: a close, downward view at one deep workbench built against exposed wall studs, with a bare concrete slab, surface conduit, and storage underneath. The drawing tablet, working hours, collaborating with Greg, game experiments, and two bonus cartridges share the work area.
- Attic: exposed joists and insulation, one leftover plywood sheet, low roof braces, a furnace, and haphazard wiring. The tricycle, opened black bag, Longtide notes, and farm dream are tucked among stored items, with no tables or finished flooring. The camera stands slightly behind the foreground brace and looks left toward the far wall, with a little breathing room around the discoveries.
- Basement: a pool table on the left with five throwable billiard balls, rear archive shelves, the creative community, abandoned Neverending Light sequels, voice actors, and D's name. The center stays open; the unfinished-story folders sit on a rear shelf. Windows share one height and sit flush against the masonry.

Interactive household clutter and eclectic art surround the discoveries. Decor mixes original surreal prints with reused cartridge labels, including wall art, small standing pictures, stored prints, and a graphic T-shirt. Rooms should feel used, with uneven stacks and things put down wherever they fit; preserve clear click targets without isolating each discovery like a display.

Scraps of paper sit behind discovery objects. Tapping or throwing the object brings its unread paper forward; the X dismisses it. Collected papers no longer interrupt that object and can be reread from the notebook in the den. Discoveries stay in a journal stored in localStorage under `jiggmin.house.journal.v1`; only known note IDs are saved. Objects remain in their rooms. If browser storage is unavailable, the journal works for the current visit and says so. No account or backend is required. All copy is adapted from Jacob's interview; see `docs/house-notes.md` for the editorial source.

In the workshop, interact with the handsaw for Inkclipse or the framed crow picture for A Murder in Crowland. A physical cartridge floats up beside the paper. It is collected automatically and drops from the viewer onto the den table on the next return. Insert it into the console for normal playback, ejection, throwing, and shelf recovery. The journal keeps the note. Found cartridges and pending deliveries persist in localStorage; after delivery, a refresh restores them on a shelf. Existing journal discoveries migrate to pending deliveries. The four main-catalog cartridges marked broken are stored as movable objects on the basement’s upper archive shelf. A Murder in Crowland passed a gameplay smoke check. Inkclipse starts rounds in both mouse and keyboard modes after a reproducible transparent-button compatibility patch. Full game completion has not been tested.

## Loading and lifecycle

Only the small `web/house-entry.js` controller and entrance CSS join the initial den payload. The exploration code and stylesheet are requested on the first arrow click. Content, hotspot metadata, and the shared layout load on first exploration. Room GLBs load on demand for the current transition. Bonus metadata and SWFs load only when opening a cartridge. Only the current room remains in the Three.js world after arrival. During travel, each room and the connecting passages render with their own local lights in separate passes that share depth; loading another room cannot illuminate through walls or floors. The common ambient and directional fill remain constant across passes. Doors close before the departed room’s geometry, materials, textures, props, and physics references are released; revisits reload the model through the browser HTTP cache. The den and house share one WebGL renderer. On reaching the hall, both the original den resources and its temporary travel clone are released; returning rebuilds the den without preserving object poses. The camera follows reversible paths through actual door openings, connecting passages, basement stairs, and the attic ladder, then settles at the room view. There are no threshold fades or scene swaps. The den shares a single doorway with the near end of the hallway, with no connector corridor. Its transition uses one reversible S-shaped cubic curve and lands at the extended near end of the hallway with the den doorway visible, avoiding intermediate waypoint turns. The basement stairs use the farther left doorway, the garage workshop is on the right, and only the end door remains locked. Travel follows rounded corners at continuous speed with gentle acceleration and braking; the camera turns once toward the destination instead of pivoting at every waypoint. Exploration keeps the entrance camera’s field of view and zoom unchanged, including arrival, to avoid a dolly-zoom distortion. The den is cloned from its live scene for departure and arrival; its existing projected lighting is view-dependent during transit. Reduced-motion preferences skip travel. A single arrow returns through the corresponding hallway doorway. Rendering sleeps after camera, paper, and prop motion settles. The den journal opens without loading the house models.

The den's rendering/physics updates pause while exploration is open, and any running den game is ejected. Return to den restores interaction without rebuilding its scene. Returning, resizing out of desktop eligibility, or closing a cartridge disposes its player. Browser Back/Forward returns to the den before applying the game route.

## Authoring

`data/house-notes.json` holds room descriptions, notes, and locked-door messages. Multiple notes can share an object hotspot. Stable note IDs preserve discoveries when copy changes.

`scene/scripts/build_house_rooms.py` authors the Blender scenes and rendered room plates. `scene/scripts/export_house_models.py` exports browser GLBs, authored cameras, and world-space interaction anchors without rendering stills. Run it with Blender in background mode after changing room geometry. `scene/exports/house/` holds the unbaked authoring models, reference renders, and bake reports. These are not deployed. `web/assets/house/` holds the baked runtime models and interaction/layout metadata. `web/house-release-renderer.js` supplies browser lighting, door pivots, camera travel, cancellation, and model caching. Blender procedural materials export with their authored base colors; image textures remain embedded. `scene/scripts/build_connected_house.py` writes the shared `layout.json`; run it with Blender to also assemble all five rooms and the connecting geometry into `scene/house-connected.blend`. This local authoring file is ignored, like the other Blender sources. Runtime GLBs are kept as separate assets but placed together using the same layout. The den and house exploration share one renderer.

The full supplied plate photo stays local and is ignored at `docs/references/kindergarten-plate.jpg`. The cropped authoring texture at `scene/house-textures/plate-photo.jpg` is versioned for rebuilds; neither is downloaded on homepage load.

Do not add horror, jump scares, or supernatural behavior to the tricycle. Its story is Jacob's account of a coincidence.


## Moving objects

Drag small objects to pick them up, then release to throw. Scroll while holding to change depth. Art prints and their frames move as one object. A tap or completed throw reveals any unread scrap hidden behind the object; cancelling a grab does not collect it. Its target follows the object after a throw. Keyboard users can focus an ordinary prop and press Enter to toss it, or activate a discovery to read it. Escape cancels the current grab.

`web/house-props.js` groups the exported meshes and shares the den's Cannon physics implementation, with room-specific collision boundaries. Furniture and room geometry provide simple box collision shapes. Objects stay attached in their authored positions until grabbed. Assemblies above 12,000 triangles or 40 meshes, oversized groups, and fabric use the den's damped spring reaction instead. Reduced motion suppresses those decorative wiggles. Door travel, hidden tabs, and exiting pause the room's physics; returning resumes it. Reading a paper disables grabbing while allowing released objects to settle. The renderer sleeps once objects settle.

## Surface finishing

The browser export runs `scene/scripts/detail_house_models.py` over every exploration room. UV-bound color, normal, and roughness textures provide timber grain, tarnish, scratches, paper fibers, cardboard, fabric weave, leather and plaster pores. Paper and cartons have small geometric irregularities; selected metal objects have shallow dents. Clock ticks, keyboard legends, fasteners, shoe stitching, notebook page edges, tricycle hardware and recorder details are joined to their original objects. Multi-material glTF primitives retain their authored object ownership so details move with their props. Artwork and the supplied plate photo retain their original UVs. The den is excluded.

Procedural texture intermediates are regenerated under `scene/house-textures/surface-finish/` and embedded in the GLBs. `scene/exports/house/surface-finish.json` records per-room mesh coverage. Re-export the room models, then rebuild the connected Blender source with `build_connected_house.py`.

## Moonlit rooms

The workshop, attic, and basement use window-only UV lighting bakes; practical fixtures stay switched off. Rebuild with `node scene/scripts/prepare_ROOM_bake.mjs` followed by Blender running `scene/scripts/bake_ROOM.py`. The attic floor is clipped at the hallway ceiling and the basement stair enclosure at the left doorway, including during travel. Billiard balls use spherical physics shapes; other household props retain their existing shapes.

Before rendering or reusing cached lighting, the production bake validates material
UVs for every selected receiver. UV-dependent materials must have explicitly authored
or restored coordinates, and every textured face must have finite, non-collapsed UVs.
This rejects accidental reuse of an earlier lighting atlas as reflectance coordinates.
Run `npm run bake:hallway -- --preflight` to check the current hallway without rendering
or installing assets. Dedicated ceiling and window bakes validate their own receivers.
The generic regression fixtures run with `node --test tests/house-bake-uv-guard.test.mjs`.
This checks coordinate safety; visual quality still needs whole-room review.

The all-room recipe `scene/scripts/bake_house_atlases.py --prepare-only` runs this
preflight over every fixed receiver in the structure, hallway, workshop, basement
and attic. Source coordinates are restored per face to preserve material seams;
lighting coordinates remain separate. Painted wall coordinates are authored in
world metres in the native model. `scene/scripts/check_house_source_uv.py` provides
Blender integration checks for material seams, normal-map coordinates and face
material preservation. Ground-floor slab undersides retain their original timber
finish: these slabs sit below the separate cellar ceiling panel and form its
visible surface. The integration fixture protects the original finish on both
sides of the slabs.
See [the cloud workflow](runpod-baking.md#full-room-atlas-refresh)
for staging and validating a complete refresh before installation.

`npm run bake:hallway` uses the production lighting pipeline at 64 samples to
rebake the fixed shell currently delivered with the hallway. The window frame
has a separate 1024 atlas with a minimum width of 32 texels per face, and the
hallway ceilings have their own 2048 atlas. Their flat undersides use a continuous
world-plane UV mapping across slab and triangle boundaries, with 32-pixel perimeter
padding and extended bake margins. This prevents artificial seams from separately
packed ceiling triangles. `npm run bake:hall-ceiling` rebuilds only these undersides
at 64 samples; both paths include the UV helper in their cache fingerprints. The command
verifies the replacement geometry before updating the master and streamed assets;
it does not rebake the original furnishing atlases. Run `npm run build` afterward
to regenerate the compressed site assets.

Structural painted walls use metre-scale planar reflectance UVs authored by
`house_wall_uv.py`; material maps never use coordinates from a prior lighting
atlas. `npm run bake:hall-window-wall` rebakes only the four panels around the
hallway window at 64 samples, preserving the repaired ceiling and other surfaces.
The same wall finish mapping and continuous window-wall lighting UVs are used by
full bakes. Its 2048 source atlas is delivered at 1024 with WebP quality 80 encoding. Lossless PNG and EXR bake masters stay available
locally; delivery encoding does not require another bake.

The basement floor also receives deterministic concrete grain, branching cracks, paint splashes, and a white tape body outline from `scripts/house-source/basement-floor-art.js`. These marks are exported as a source material and receive baked lighting with the slab. The fixed drain has a dark inset, metal rim, and seven grate bars. Ceiling joists touch the ceiling, the pendant stem reaches its canopy, and the rear pipe clears the window frames. `scene/scripts/fit_basement_fixtures.mjs` applies these target heights to existing GLBs without repacking their lighting UVs; the authoring source uses the same heights for future exports.

## Room-owned structure and texture streaming

`node scripts/split-house-structure.mjs` derives `web/assets/house/release/structure/{hallway,den,workshop,basement,attic}.glb` from the full authored shell. `layout.structureAssets` points the browser at these files. The full `structure.glb` remains an authoring/bake input and is no longer requested by the production renderer. Builds and local publishing regenerate the split when its sources change.

The hallway shell contains the closed boundary doors, attic hatch, and exterior scenery. It stays loaded during exploration, alongside at most one branch shell. The stairs, landing, stringers, guardrails, and stair enclosure belong to the basement and load before descent. The workshop owns the garage slab despite its historical stair-atlas label. The attic owns the folding ladder. Room-specific smoke detectors travel with their rooms; the hatch lightmap stays in the hall.

Meshes retain their world transforms and geometry. The source generator authors separate den and hallway ceiling sections at world x = 4.8. Source preparation also splits legacy spanning panels before baking. Streaming only packages the resulting surfaces; it never cuts baked geometry. Existing baked panels were converted once with their original UV mapping preserved. Textures referenced only by other rooms are omitted. Where a bake atlas crosses a room boundary, the generator copies the relevant pixel rectangle with padding and remaps that room's UVs, without rebaking. On departure, room-owned geometry, materials, textures, and decoded bitmaps are disposed; cancelled asynchronous shell loads cannot reattach.


## Static model preparation

Permanent fixes are applied in `scripts/prepare-house-static.mjs`, called during
reference restoration and bake-input preparation. Source-only geometry helpers
live under `scripts/house-source/`. They author the den opening, remove redundant
surfaces and unwanted props, settle laundry, create the cable coil, cut basement
window apertures, and export exterior trees. The floor artwork is a deterministic
PNG material with planar source UVs, generated before Cycles runs.

The fixed-fixture staging pass authors pipes, bulb/socket/wire geometry and carton
placement before lighting. Cellar lights sit outside the actual apertures; edited
receiver vertices recover source material UVs before baking. The hatch receives
its own closed-pose lightmap in the normal bake and stays hidden from other bake
targets so its moving shadow is not painted onto the hall. The browser no longer
cuts openings, moves/removes decoration, generates trees or floor textures, tints
ceilings, masks basement light spills, or swaps hatch reference geometry.

The browser retains camera-dependent den projection, sky rendering, transparent
glass compositing, ink outlines, interaction/physics, door/ladder animation,
render batching and room resource disposal. These are presentation or interactive
behavior rather than permanent model repairs. The obsolete pre-release renderer
and targeted post-bake ceiling/trim painting tools have been removed.

Retained original furnishing lightmaps use the same 1024-pixel delivery cap as
other small baked groups. Source masters and separate artwork images retain their
resolution; compression applies the cap when building the runtime assets.

The hallway doorway and attic hatch frames use white painted timber, configured
in `scene/house-finishes.json`. `paint_door_frames` in the authoring finish pass
assigns white paint without changing the original normal maps. The finish is
saved in both `house-plan-preview.blend` and `house-release.blend`; it does not
recolor exported meshes. Picture/window frames, doors and skirting retain their
existing finishes. Refresh the trim through `npm run bake:atlases -- hall-trim`
when changing this finish.

Doorway and hatch clearance is authored by `scene/scripts/house_frame_geometry.py`
(and saved in both editable house models). Door headers extend 10 mm below the
wall opening's reveal; side casings butt into that underside. This covers all
eight hallway openings, including bedroom-1, bedroom-2, kitchen and bath in the
rear hallway. The release test also rejects hallway headers missing from its
coverage list. Hatch liners stand
10 mm inside the ceiling opening, the moving leaf has 5 mm clearance to the
liners, and horizontal hatch casings butt into the side casings rather than
sharing visible corner faces. Source finishing reapplies this repair idempotently.
Both bake paths restore the repaired frame geometry from the editable model,
so an older release GLB cannot reintroduce the coincident faces. The atlas cache
fingerprints the geometry helper. `tests/house-frame-clearance.test.mjs` checks
these constraints on delivered geometry before local atlas publication.

The ground-floor `Main floor` slabs retain their original oak on the undersides
visible from the cellar. The source finish pass must not include these slabs in
the cream ceiling paint selection: that repaint changes both the visible cellar
ceiling and its indirect bounce. `restore_cellar_ceiling_finish.py` restores the
retained original material slot in both editable models; the finish pass enforces
the same rule. `house-ceiling-finish.test.mjs` checks the saved models and runs the
finish pass in memory, checking that slab geometry, UVs and materials survive.

`python3 scripts/check-house-lighting.py REFERENCE_DIR CURRENT_DIR` compares
matching 1280 × 720 room endpoint screenshots against a live-site reference.
It converts sRGB to linear Rec.709 luminance and fails when a room differs by
more than 5%. The hallway measurement samples unchanged walls and ceiling, so
new white doorway paint does not count as a lighting increase. Each hallway
sample must also pass separately. Other rooms use
the whole matching endpoint view. Save the live reference, current images and
JSON report together when reviewing lighting; an overall mean does not establish
that every individual surface has identical lighting.

Shared slabs are authored as separate room surfaces by
`scene/scripts/house_slab_ownership.py`: cellar-facing `Main floor` undersides use
`basement-slab-ceilings`, and the upper faces of `Attic floor / hall ceiling` use
`attic-floor`. Both are 2048² source atlases. Upstairs floor tops and the hallway
ceiling undersides retain their own room atlases. The legacy source preparation
uses `splitSlabSurfaces` to preserve these same face boundaries and reflectance
UVs before baking. Stair details belong to `structure-stairs`; the garage slab
belongs to `structure-garage`. Attic landing rails are attic scenery, despite
their names containing “landing.” Atlas publication checks both group ownership
and the actual image bytes to reject mixed-room lightmaps.
Local runs retain their exact input models in `input-baseline`; assembly records
that directory for geometry and live-art checks. The comparison uses referenced
vertices with 0.1 mm tolerance for float32 export rounding, rather than an older
snapshot from before source repairs.

For flicker diagnosis, a local preview can be launched with
`python3 scripts/serve.py --port 8006 --capture-directory scene/renders/frame-flicker/consecutive`.
The URL parameters `captureHouseTravel=1&captureHouseBurstAt=0.28` expose a button
that captures four consecutive movement frames, copying the rendered canvas on
four animation frames and encoding PNGs after the burst. Arm it in the hallway
and enter the workshop to capture the doorframe during the approach. The optional
`noHouseInk=1` diagnostic disables contour meshes; normal previews retain them.
