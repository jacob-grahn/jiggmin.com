# Jiggmin — Midnight Den

A static HTML game room with real 3D geometry, throwable physics cartridges and a tethered controller, baked midnight lighting, and a live Ruffle player inside the CRT.

## Project layout and Git

- `index.html`, `web/`: site source, optimized browser assets, and vendored runtimes.
- `data/`: versioned game catalog, checksums, source URLs, and archive notes.
- `scripts/`, `tests/`: download/build/preview tools and verification.
- `scene/`: Blender authoring scripts and documentation. Local `.blend` files, `textures/`, `renders/`, and `mockups/` are ignored by Git.
- `games/`: versioned archived SWFs, thumbnails, and loader payloads.
- `dist/`: generated static deployment output; ignored by Git.

The game archive is included in Git so a fresh clone can play games and build the complete site. The checked-in catalog lists the expected files and their hashes. Source artwork remains local and ignored; retain a separate backup of it. The fetch scripts can attempt downloads from the original mirror, but availability may change. No Blender source files are needed to run the exported website. Run `npm ci` to install dependencies for tests.

## Run locally

Run `npm start` from this directory, then open <http://127.0.0.1:8000>. Serve over HTTP; opening `index.html` as a file does not support the required module, WebAssembly, and game requests. Runtime files are vendored, so no npm installation or CDN connection is required to play standalone games. A static host must serve `.wasm` as `application/wasm`.

## Mouse controls

- Hold the left mouse button on a cartridge or controller to grip it. Move slowly to place it; flick and release to throw. Scroll while holding to adjust depth.
- Release a cartridge over the console slot. It aligns above the machine, presses down, and seats with a mechanical click before the game starts.
- The view eases closer while a cartridge is inserted. Pull the cartridge out to stop the game and ease back out.
- Escape cancels a held drag. Losing focus or pointer capture releases the object naturally.
- Loose cartridges that settle outside the camera view or behind furniture for five uninterrupted seconds glide into an empty shelf position. Visible cartridges stay where they land. Inserting a game cancels any in-progress shelf returns and disables automatic recovery until the cartridge is removed; recovery then starts with a fresh five-second timer. Held, inserted, moving, and shelved cartridges are excluded; the play zoom never recalls stored games. Shelf destinations are reserved and checked again on arrival.
- The physical controller stays tethered to the console. On touch layouts it floats into a control panel during play; its physical body and cord are suspended until you quit.

Five random games begin on the table on each page load. The other games occupy compact shelf positions, with 27 total spaces available for the 23-game collection. Refresh reshuffles the collection. The bottom bar has been removed; status announcements remain available to screen readers and load errors appear only when needed.

## Responsive views and touch input

The scene fills the viewport and crops around the TV without stretching, with a slightly lower camera while browsing. Wide views use the original left bookshelf; when that shelf cannot fit (aspect ratio below 1.38), stored cartridges move to a matching two-tier rack above the TV. The rack has 27 positions and physical collision volumes. Loose cartridges retain their physical positions when resizing. Browsing includes the upper rack; the slow play zoom prioritizes the CRT and reachable console cartridge.

Drag and throw cartridges with one finger. Near the console slot, touch dragging guides depth automatically so a cartridge from the upper rack can be inserted without a scroll wheel. On phone-sized or coarse-pointer screens, the controller appears beneath the console during play. In short landscape views it moves to the lower right. The joystick sends arrow keys, including diagonals; both A and B send Space. Shared presses are reference-counted so releasing A does not release a still-held B. Quit ejects the game. Blur, pointer cancellation, game replacement, and orientation changes release held controls. The TV accepts direct taps for mouse-driven menus and games.

Touch controls use bubbling keyboard events with legacy key codes, sent to the focused Ruffle player. The transparent touch hit surface has a CRT-shaped opening, while the rendered WebGL depth buffer continues to occlude the game. Game-specific mappings, selective controller visibility for mouse-only games, and save persistence remain separate work.

## Rendering and physics

The room is actual Blender mesh geometry in WebGL, with correct depth occlusion. The browsing camera sits 0.35 scene units lower than the original eye height. It slowly rises back while zooming into a game, with aspect-aware optical cropping centered on the TV. The projected CRT player and console target track their world-space anchors throughout the camera movement. A 3200 × 2000 Cycles lighting render is projected onto the static meshes per fragment, preserving the original lighting without requiring a full real-time path tracer. This is a view-dependent lighting bake, not a freely orbitable, UV-lightmapped room. The old flat backdrop is used only while loading.

Dynamic cartridges use physically lit materials and cast real-time shadows onto the room. Their repeated grip pieces are merged by material to reduce draw calls. Cartridges use 60% of the original model depth (8.7 cm in scene units); the render and collider share this scale, with tabletop poses adjusted to stay on the surface. The browser rebuilds cartridges with beveled shell halves, grip ribs, screw recesses, illustrated spine labels, a circuit-board tongue and gold connector pins. Each cartridge is a 320 g rigid box with its center of mass inside the shell. Cannon ES simulates gravity, friction, restitution, angular momentum, and cartridge-to-cartridge contacts at 120 Hz. The room uses 43 fixed collision volumes from the Blender scene. Decorative fine detail uses simplified collision geometry. Initial display poses sleep until touched or struck; the furniture remains stationary. The 580 g controller has compound shell, joystick, and button colliders. A 1.8 m cord constraint attaches its rear connector to the console: it stays slack nearby, pulls under tension, and applies torque at the connector. The mouse grip is limited to the available cord reach. The rendered cord sags and rests on the tabletop; it does not simulate knotting or wrapping around furniture.

A point constraint attaches the exact pickup point to a moving grip target. Release combines the body's motion with recent pointer velocity. Speeds and catch-up time are bounded to keep small, fast objects stable. Dormant bodies sleep; hidden tabs pause the simulation. The WebGL renderer also stops redrawing when the scene is at rest. Outer collision walls and a continuous safety floor contain strong throws without teleporting cartridges home. Out-of-view loose cartridges return to free shelf slots after five seconds of rest, using an animated path in front of the furniture. Visibility samples account for the camera frustum and furniture occlusion.

The CRT uses a transparent, depth-writing mesh aperture, with the native Ruffle player behind the WebGL canvas. Foreground cartridges and furniture can therefore occlude the running game correctly. Pointer input passes through to Ruffle only when the cursor is on unobstructed glass. No copying of Ruffle's drawing buffer or experimental renderer is required.

- `scene/midnight-den-library.blend`: source scene, kept unchanged.
- `scene/scripts/export_physics_room.py`: freezes evaluated static geometry, exports colliders, and renders the high-resolution lighting plate.
- `scene/scripts/export_web.py`: exports cartridge geometry, camera, and screen/slot coordinates.
- `web/assets/room.glb`: static room surfaces and separate CRT depth surface.
- `web/assets/room-lighting.webp`: compressed lighting projection.
- `web/assets/colliders.json`: fixed room collision volumes.
- `web/assets/controller.glb`: separate beveled controller, removed from the static mesh and lighting.
- `web/controller-cord.js`: slack cord rendering.
- `web/assets/cartridges.glb`: 23 independently movable cartridges with game IDs.
- `web/physics.js`: rigid bodies, spring grip, docking, cancellation, controller collisions, and the cord constraint.
- `web/room-renderer.js`: projected lighting, shadows, CRT aperture, and mesh consolidation.
- `web/cartridge-model.js`: molded cartridge geometry and front/spine artwork.
- `web/library-behavior.js`: shelf positions, shuffle, and rest timer.
- `web/responsive-scene.js`: camera composition, upper rack geometry and collision proxies, and visibility sampling.
- `web/mobile-controller.js`, `web/touch-input.js`: touch gestures, shared key state, and Ruffle keyboard adapter.
- `web/app.js`: pointer interaction, frame loop, routes, and player lifecycle.
- `data/games.json`: source URLs, file integrity, and compatibility notes.

After running the Blender export, compress `scene/renders/room-lighting.png` with Pillow to `web/assets/room-lighting.webp` at quality 94. Blender source and raw PNGs are not needed in the deployed site. Three.js, Cannon ES, and Ruffle are pinned in the package files; vendored browser builds and upstream licenses live under `web/vendor/`.

## Verification and limits

`npm test` checks the model-to-game mapping, camera/slot alignment, URLs, local entry pages, payload selection, tabletop landing, throws and tumbling, spring grip and release, cartridge and controller collisions, cord slack and maximum reach under throws and dragging, docking, cancellation, and resetting. Browser checks cover room loading, physical dragging and throwing, dropping Effing Meteors into the slot and starting it, Uber Breakout loading through the CRT, native game input, cartridge extraction, and shelf recovery. Responsive checks cover portrait (390 × 844), landscape (844 × 390), and desktop (1440 × 900), upper-rack insertion, extraction, and shelf relocation. `/tests/fixtures/keyboard.html` is a local-only diagnostic movie: the SWF itself reports Space and arrow down/up events through Ruffle’s trace observer. Both buttons and all four directions were verified there. Actual phone hardware/multitouch and all-game compatibility remain separate checks.

Not every archived game is guaranteed compatible with Ruffle. Platform Racing 3 uses its validated standalone main SWF. Platform Racing 2 retains its loader because its downloaded main payload is not a standard SWF. Multiplayer/server-dependent games can still require external services and available servers. A successful player load does not prove every feature works.

## Game URLs

Open `/effing-meteors`, `/uber-breakout`, or any other ID from `data/games.json` to automatically insert that cartridge and load its game when the scene is ready. Inserting another cartridge updates the URL; completing a drag out of the console returns it to `/`. Back/Forward restores the corresponding game or empty console. Cancelling a drag keeps the same URL. Query strings and hashes are preserved. Browser autoplay policy may still require a click to enable sound.

`npm run build` assembles the deployable site in `dist/`, including the 23 static `<slug>/index.html` entry pages, web assets, game catalog, and local game files. Run it after changing `index.html` or adding a game. `npm start` serves both `/slug` and `/slug/` directly. Ordinary static directory hosts may redirect `/slug` to `/slug/`; both work. Deploy the contents of `dist/` at the domain root. No server-side game runtime is needed. Unknown routes return the static host's 404; if the host rewrites them to `index.html`, the app shows a game-not-found message.
