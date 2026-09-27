# House exploration

The existing den is the entrance to four additional rooms. On desktop landscape screens (at least 1000 CSS pixels wide, aspect ratio at least 1.38, fine pointer), one right-edge arrow invites exploration. Smaller screens keep the original den experience.

## Rooms and discoveries

- Hallway: a long, narrow corridor with unlabeled doors fitted into both walls, a locked door at the far end, a rainy window on the right, and a ceiling hatch with a pull cord leading to the attic. Shallow wall displays hold the kindergarten plate and community contests. Two doors remain unavailable for later expansion.
- Garage workshop: a close, downward view at one deep workbench built against exposed wall studs, with a bare concrete slab, surface conduit, and storage underneath. The drawing tablet, working hours, collaborating with Greg, game experiments, and two bonus cartridges share the work area.
- Attic: exposed joists and insulation, one leftover plywood sheet, low roof braces, a furnace, and haphazard wiring. The tricycle, opened black bag, Longtide notes, and farm dream are tucked among stored items, with no tables or finished flooring. The camera sits halfway toward the far wall and looks slightly left, keeping the view cramped; discovery objects and click targets follow that closer composition.
- Basement: the creative community, abandoned Neverending Light sequels, voice actors, and D's name.

Interactive household clutter and eclectic art surround the discoveries. Decor mixes original surreal prints with reused cartridge labels, including wall art, small standing pictures, stored prints, and a graphic T-shirt. Rooms should feel used, with uneven stacks and things put down wherever they fit; preserve clear click targets without isolating each discovery like a display.

Scraps of paper sit behind discovery objects. Tapping or throwing the object brings its unread paper forward; the X dismisses it. Collected papers no longer interrupt that object and can be reread from the notebook in the den. Discoveries stay in a journal stored in localStorage under `jiggmin.house.journal.v1`; only known note IDs are saved. Objects remain in their rooms. If browser storage is unavailable, the journal works for the current visit and says so. No account or backend is required. All copy is adapted from Jacob's interview; see `docs/house-notes.md` for the editorial source.

Bonus cartridges are playable from their discovery or journal entry. A Murder in Crowland passed a gameplay smoke check. Inkclipse starts rounds in both mouse and keyboard modes after a reproducible transparent-button compatibility patch. Full game completion has not been tested.

## Loading and lifecycle

Only the small `web/house-entry.js` controller and entrance CSS join the initial den payload. The exploration code and stylesheet are requested on the first arrow click. Content, hotspot metadata, the shared layout, and all four room GLBs load together on first exploration. Bonus metadata and SWFs load only when opening a cartridge. Models stay cached for revisits. All rooms remain in one Three.js world. The camera follows reversible paths through actual door openings, connecting passages, basement stairs, and the attic ladder, then settles at the room view. There are no threshold fades or scene swaps. The den is cloned from its live scene for departure and arrival; its existing projected lighting is view-dependent during transit. Reduced-motion preferences skip travel. A single arrow returns through the corresponding hallway doorway. Rendering sleeps after camera, paper, and prop motion settles. The den journal opens without loading the house models.

The den's rendering/physics updates pause while exploration is open, and any running den game is ejected. Return to den restores interaction without rebuilding its scene. Returning, resizing out of desktop eligibility, or closing a cartridge disposes its player. Browser Back/Forward returns to the den before applying the game route.

## Authoring

`data/house-notes.json` holds room descriptions, notes, and locked-door messages. Multiple notes can share an object hotspot. Stable note IDs preserve discoveries when copy changes.

`scene/scripts/build_house_rooms.py` authors the Blender scenes and rendered room plates. `scene/scripts/export_house_models.py` exports browser GLBs, authored cameras, and world-space interaction anchors without rendering stills. Run it with Blender in background mode after changing room geometry. `web/assets/house/` holds these models, normalized hotspot rectangles, and legacy reference renders. `web/house-renderer.js` supplies browser lighting, door pivots, camera travel, cancellation, and model caching. Blender procedural materials export with their authored base colors; image textures remain embedded. `scene/scripts/build_connected_house.py` writes the shared `layout.json`; run it with Blender to also assemble all five rooms and the connecting geometry into `scene/house-connected.blend`. This local authoring file is ignored, like the other Blender sources. Runtime GLBs are kept as separate assets but placed together using the same layout. The den retains its original renderer for games.

The full supplied plate photo stays local and is ignored at `docs/references/kindergarten-plate.jpg`. The cropped authoring texture at `scene/house-textures/plate-photo.jpg` is versioned for rebuilds; neither is downloaded on homepage load.

Do not add horror, jump scares, or supernatural behavior to the tricycle. Its story is Jacob's account of a coincidence.


## Moving objects

Drag small objects to pick them up, then release to throw. Scroll while holding to change depth. Art prints and their frames move as one object. A tap or completed throw reveals any unread scrap hidden behind the object; cancelling a grab does not collect it. Its target follows the object after a throw. Keyboard users can focus an ordinary prop and press Enter to toss it, or activate a discovery to read it. Escape cancels the current grab.

`web/house-props.js` groups the exported meshes and shares the den's Cannon physics implementation, with room-specific collision boundaries. Furniture and room geometry provide simple box collision shapes. Objects stay attached in their authored positions until grabbed. Assemblies above 12,000 triangles or 40 meshes, oversized groups, and fabric use the den's damped spring reaction instead. Reduced motion suppresses those decorative wiggles. Door travel, hidden tabs, and exiting pause the room's physics; returning resumes it. Reading a paper disables grabbing while allowing released objects to settle. The renderer sleeps once objects settle.

## Surface finishing

The browser export runs `scene/scripts/detail_house_models.py` over every exploration room. UV-bound color, normal, and roughness textures provide timber grain, tarnish, scratches, paper fibers, cardboard, fabric weave, leather and plaster pores. Paper and cartons have small geometric irregularities; selected metal objects have shallow dents. Clock ticks, keyboard legends, fasteners, shoe stitching, notebook page edges, tricycle hardware and recorder details are joined to their original objects. Multi-material glTF primitives retain their authored object ownership so details move with their props. Artwork and the supplied plate photo retain their original UVs. The den is excluded.

Procedural texture intermediates are regenerated under `scene/house-textures/surface-finish/` and embedded in the GLBs. `web/assets/house/surface-finish.json` records per-room mesh coverage. Re-export the room models, then rebuild the connected Blender source with `build_connected_house.py`.
