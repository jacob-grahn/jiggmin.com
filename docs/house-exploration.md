# House exploration

The existing den is the entrance to four additional rooms. On desktop landscape screens (at least 1000 CSS pixels wide, aspect ratio at least 1.38, fine pointer), arrows at the edges invite exploration. Smaller screens keep the original den experience.

## Rooms and discoveries

- Hallway: a long, narrow corridor with unlabeled doors fitted into both walls, a locked door at the far end, a rainy window on the right, and a ceiling hatch with a pull cord leading to the attic. Shallow wall displays hold the kindergarten plate and community contests. Two doors remain unavailable for later expansion.
- Garage workshop: a close, downward view at one deep workbench built against exposed wall studs, with a bare concrete slab, surface conduit, and storage underneath. The drawing tablet, working hours, collaborating with Greg, game experiments, and two bonus cartridges share the work area.
- Attic: exposed joists and insulation, one leftover plywood sheet, low roof braces, a furnace, and haphazard wiring. The tricycle, opened black bag, Longtide notes, and farm dream are tucked among stored items, with no tables or finished flooring. The camera sits halfway toward the far wall and looks slightly left, keeping the view cramped; discovery objects and click targets follow that closer composition.
- Basement: the creative community, abandoned Neverending Light sequels, voice actors, and D's name.

Ordinary noninteractive household clutter and eclectic art surround the discoveries. Decor mixes original surreal prints with reused cartridge labels, including wall art, small standing pictures, stored prints, and a graphic T-shirt. Rooms should feel used, with uneven stacks and things put down wherever they fit; preserve clear click targets without isolating each discovery like a display.

Click objects to read their notes. Discoveries stay in a journal stored in localStorage under `jiggmin.house.journal.v1`; only known note IDs are saved. Objects remain in their rooms. If browser storage is unavailable, the journal works for the current visit and says so. No account or backend is required. All copy is adapted from Jacob's interview; see `docs/house-notes.md` for the editorial source.

Bonus cartridges are playable from their discovery or journal entry. A Murder in Crowland passed a gameplay smoke check. Inkclipse starts rounds in both mouse and keyboard modes after a reproducible transparent-button compatibility patch. Full game completion has not been tested.

## Loading and lifecycle

Only the small `web/house-entry.js` controller and entrance CSS join the initial den payload. The exploration code and stylesheet are requested on the first arrow click. Content and hotspot metadata load on entry; each room's image loads only when visiting it. Bonus metadata and SWFs load only when opening a cartridge. Browser caching handles revisits.

The den's rendering/physics updates pause while exploration is open, and any running den game is ejected. Return to den restores interaction without rebuilding its scene. Returning, resizing out of desktop eligibility, or closing a cartridge disposes its player. Browser Back/Forward returns to the den before applying the game route.

## Authoring

`data/house-notes.json` holds room descriptions, notes, and locked-door messages. Multiple notes can share an object hotspot. Stable note IDs preserve discoveries when copy changes.

`scene/scripts/build_house_rooms.py` authors the Blender scenes and rendered room plates. `web/assets/house/` holds deployment images and normalized hotspot rectangles. These camera renders preserve the modeled lighting while avoiding four more live 3D scenes on the GPU. The original den remains fully interactive 3D.

The full supplied plate photo stays local and is ignored at `docs/references/kindergarten-plate.jpg`. The cropped authoring texture at `scene/house-textures/plate-photo.jpg` is versioned for rebuilds; neither is downloaded on homepage load.

Do not add horror, jump scares, or supernatural behavior to the tricycle. Its story is Jacob's account of a coincidence.
