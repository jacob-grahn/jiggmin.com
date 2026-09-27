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

## Explore the house

On desktop landscape screens, the right-edge arrow opens a hallway, garage workshop, unfinished attic, and basement. Tap or throw objects to reveal hidden paper scraps, then reread collected papers in the den’s journal. Discoveries are saved in this browser. Two workshop cartridges reveal playable recovered experiments: Inkclipse and A Murder in Crowland.

The additional Blender-exported models load together on first exploration and share one connected 3D house. Doors open as the camera travels through passages, basement stairs, and an attic ladder; a single arrow returns to the hallway. Exploration pauses the den and stops its active game; Return to den restores the original room. Smaller screens retain the original game room. See [house exploration](docs/house-exploration.md) for loading, content, and authoring details.

## Mouse controls

- Hold the left mouse button on a cartridge or controller to grip it. Move slowly to place it; flick and release to throw. Scroll while holding to adjust depth.
- Release a cartridge over the console slot. It aligns above the machine, presses down, and seats with a mechanical click before the game starts.
- The view eases closer while a cartridge is inserted. Pull the cartridge out to stop the game and ease back out.
- Escape cancels a held drag. Losing focus or pointer capture releases the object naturally.
- Loose cartridges that settle outside the camera view or behind furniture for five uninterrupted seconds glide into an empty shelf position. Visible cartridges stay where they land. Inserting a game cancels any in-progress shelf returns and disables automatic recovery until the cartridge is removed; recovery then starts with a fresh five-second timer. Held, inserted, moving, and shelved cartridges are excluded; the play zoom never recalls stored games. Shelf destinations are reserved and checked again on arrival.
- The physical controller stays tethered to the console. For controller-mode games it floats into a control panel on desktop and mobile during play; its physical body and cord are suspended until you quit.

Five random games begin on the table on each page load. The other games occupy compact shelf positions, with 27 total spaces available for the 24-game collection. Refresh reshuffles the collection. The bottom bar has been removed; status announcements remain available to screen readers and load errors appear only when needed.

## Responsive views and touch input

The scene fills the viewport and crops around the TV without stretching, with a slightly lower camera while browsing. Wide views use the original left bookshelf; when that shelf cannot fit (aspect ratio below 1.38), stored cartridges move to a matching two-tier rack above the TV. The rack has 27 positions and physical collision volumes. Loose cartridges retain their physical positions when resizing. Browsing includes the upper rack; the slow play zoom prioritizes the CRT and reachable console cartridge.

Drag and throw cartridges with one finger. Near the console slot, touch dragging guides depth automatically so a cartridge from the upper rack can be inserted without a scroll wheel. The TV accepts direct taps for mouse-driven menus and games.

Each game has a profile in `data/gameplay.json`. See [the game-by-game review](docs/gameplay-review.md) for bindings, evidence, and provisional decisions.

- **Touch:** a slow, close zoom fits the game’s dimensions to the viewport, cropping unused CRT letterboxing for portrait or wide games; a floating Eject button returns to the room. No controller obscures the game.
- **Controller:** the controller appears below the screen on desktop and mobile (lower right in short mobile landscape). The stick supports arrows, WASD, or a virtual mouse; A/B can send different keys or left mouse. Layouts are `standard`, `arrows` (four separate keys for Beat Master), or `twin-sticks` (movement plus aim/fire). Deflecting the right stick holds left click; release stops firing or throws in Cooties. A clicks the retained virtual cursor. Labels show the current bindings. Quit ejects the game.
- **Broken:** a chipped, cracked cartridge with handwritten “broken” tape produces a flickering, distorted CRT overlay. The original game still loads for inspection. Reduced-motion preferences disable distortion animation.

Keyboard inputs use bubbling events with legacy key codes sent to Ruffle. The virtual mouse sends pointer events with canvas-local offsets, accounts for letterboxing, and stays within the game. Shared presses are reference-counted. Blur, cancellation, game replacement, resizing, and quitting release held inputs. Direct screen input remains available alongside the pad. Some hybrid movement/aiming games still need playtesting on physical phones; save persistence is separate work.

Click or tap the mug, pothos, or reading lamp for a small, damped wobble. Repeated nudges add momentum without snapping the prop back to its starting pose. These decorative reactions respect reduced-motion preferences.

## Rendering and physics

The room is actual Blender mesh geometry in WebGL, with correct depth occlusion. The browsing camera sits 0.35 scene units lower than the original eye height. It slowly rises back while zooming into a game, with aspect-aware optical cropping centered on the TV. The projected CRT player and console target track their world-space anchors throughout the camera movement. A 5120 × 1600 Cycles lighting render covers expanded room geometry, with 2.3× the original horizontal coverage and 1.15× the vertical coverage. Its projection stays independent of the responsive viewing camera, so ultrawide screens reveal more room instead of repeating the edges of the old image. Texture coordinates are clamped and fade to darkness beyond the outer bake boundary. This is a view-dependent lighting bake, not a freely orbitable, UV-lightmapped room. The old flat backdrop is used only while loading.

The static art pass adds uneven roughness, rubbed edges, ceramic chips, wood scratches and coffee rings, leaf veins, shade stitching, paper edges, handwritten notes, and chair piping. Runtime cartridges and the controller have object-space material grain, nicks, aged labels, and fasteners. Cartridge corners have small individual dents.

Reactive props retain their resting lighting coordinates while their geometry rotates around a contact pivot. A second background plate reveals the real surfaces behind them, with their indirect light and contact shadows retained. Their movement is deliberately small; the baked shadows do not move, and these props are decorative spring reactions rather than throwable rigid bodies.

Dynamic cartridges use physically lit materials and cast real-time shadows onto the room. Their repeated grip pieces are merged by material to reduce draw calls. Cartridges use 60% of the original model depth (8.7 cm in scene units); the render and collider share this scale, with tabletop poses adjusted to stay on the surface. The browser rebuilds cartridges with beveled shell halves, grip ribs, screw recesses, illustrated spine labels, a circuit-board tongue and gold connector pins. Each cartridge is a 320 g rigid box with its center of mass inside the shell. Cannon ES simulates gravity, friction, restitution, angular momentum, and cartridge-to-cartridge contacts at 120 Hz. The room uses 43 fixed collision volumes from the Blender scene. Decorative fine detail uses simplified collision geometry. Initial display poses sleep until touched or struck; the furniture remains stationary. The 580 g controller has compound shell, joystick, and button colliders. A 1.8 m cord constraint attaches its rear connector to the console: it stays slack nearby, pulls under tension, and applies torque at the connector. The mouse grip is limited to the available cord reach. The rendered cord sags and rests on the tabletop; it does not simulate knotting or wrapping around furniture.

A point constraint attaches the exact pickup point to a moving grip target. Release combines the body's motion with recent pointer velocity. Speeds and catch-up time are bounded to keep small, fast objects stable. Dormant bodies sleep; hidden tabs pause the simulation. The WebGL renderer redraws for movement and the idle CRT flicker; during play it can rest when nothing in the room moves. Outer collision walls and a continuous safety floor contain strong throws without teleporting cartridges home. Out-of-view loose cartridges return to free shelf slots after five seconds of rest, using an animated path in front of the furniture. Visibility samples account for the camera frustum and furniture occlusion.

The CRT uses a transparent, depth-writing mesh aperture, with the native Ruffle player behind the WebGL canvas. Foreground cartridges and furniture can therefore occlude the running game correctly. Pointer input passes through to Ruffle only when the cursor is on unobstructed glass. No copying of Ruffle's drawing buffer or experimental renderer is required.

- `scene/midnight-den-library.blend`: source scene, kept unchanged.
- `scene/scripts/detail_den.py`: widens the architecture, adds the reproducible material/detail pass, and tags reactive props.
- `scene/scripts/export_detailed_room.py`: exports room/prop geometry and colliders, then renders the wide lighting and clean background patch.
- `scene/scripts/finish_detailed_room.py`: composites the patch, compresses both lighting plates, and installs the browser assets.
- `scene/scripts/export_web.py`: exports cartridge geometry, camera, and screen/slot coordinates.
- `web/assets/room.glb`: static room surfaces, separate CRT aperture, and three reactive props.
- `web/assets/room-lighting.webp`: clean background lighting projection.
- `web/assets/room-props.webp`: cropped resting-lighting atlas for the reactive props (avoids a second full-size GPU texture).
- `web/prop-reactions.js`: bounded damped springs and independent prop personalities.
- `web/surface-patina.js`: shared procedural material grain and deterministic paper aging.
- `web/controller-detail.js`: controller fasteners, scuffs, and underside label.
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

To rebuild the detailed assets, open the original `scene/midnight-den-library.blend` in background Blender, run `scene/scripts/detail_den.py`, then `scene/scripts/export_detailed_room.py`. After both renders finish, run `python3 scene/scripts/finish_detailed_room.py` (requires Pillow). The original source is preserved; the detail pass saves `scene/midnight-den-detailed.blend`. The finalizer checks Cloudflare’s per-file asset limit. Blender source and raw PNGs are not needed in the deployed site. Three.js, Cannon ES, and Ruffle are pinned in the package files; vendored browser builds and upstream licenses live under `web/vendor/`.

## Verification and limits

`npm test` runs 42 checks, including prop spring stability, repeated nudges, reduced motion, rest-pose lighting coordinates and cropped-atlas alignment, plus the model-to-game mapping, camera/slot alignment, URLs, local entry pages, payload selection, tabletop landing, throws and tumbling, spring grip and release, cartridge and controller collisions, cord slack and maximum reach under throws and dragging, docking, cancellation, and resetting. Browser checks cover room loading, physical dragging and throwing, dropping Effing Meteors into the slot and starting it, Uber Breakout loading through the CRT, native game input, cartridge extraction, and shelf recovery. Responsive checks cover portrait (390 × 844), landscape (844 × 390), and desktop (1440 × 900), upper-rack insertion, extraction, and shelf relocation. `/tests/fixtures/keyboard.html` is a local-only diagnostic movie: the SWF itself reports Space and arrow down/up events through Ruffle’s trace observer. Both buttons and all four directions were verified there. The detailed room was also checked at 1920 × 800, 2560 × 720 (32:9), 1440 × 900, and 390 × 844, including mug/plant/lamp nudges, cartridge insertion, Ruffle mouse input and mobile quit. The gameplay suite also validates all 24 profiles, close CRT framing, virtual pointer bounds/letterboxing and held-input release. `/tests/fixtures/input-probe.html` verifies mouse coordinates, mouse buttons, and mapped keys inside an original diagnostic SWF; these were checked in the browser. `/tests/fixtures/game-review.html` loads each archive entry in a fresh page for manual review. Actual phone hardware/multitouch and full-game completion remain separate checks.

Not every archived game is guaranteed compatible with Ruffle. Platform Racing 3 uses its validated standalone main SWF. Platform Racing 2 retains its loader because its downloaded main payload is not a standard SWF. Multiplayer/server-dependent games can still require external services and available servers. A successful player load does not prove every feature works.

## Game URLs

Cloudflare Workers Builds uses `npm run build` as the build command and `npx wrangler deploy` as the deploy command. The checked-in `wrangler.jsonc` deploys only `dist/` to the `jiggmin-com` Worker as static assets; no Worker script is needed. Do not set the asset directory to the repository root, which also contains development dependencies and source files. The generated game directories support direct game links with the default trailing-slash handling.

Open `/effing-meteors`, `/uber-breakout`, or any other ID from `data/games.json` to automatically insert that cartridge and load its game when the scene is ready. Inserting another cartridge updates the URL; completing a drag out of the console returns it to `/`. Back/Forward restores the corresponding game or empty console. Cancelling a drag keeps the same URL. Query strings and hashes are preserved. Browser autoplay policy may still require a click to enable sound.

`npm run build` assembles the deployable site in `dist/`, including the 24 static `<slug>/index.html` entry pages, web assets, game catalog, and local game files. Run it after changing `index.html` or adding a game. `npm start` serves both `/slug` and `/slug/` directly. Ordinary static directory hosts may redirect `/slug` to `/slug/`; both work. Deploy the contents of `dist/` at the domain root. No server-side game runtime is needed. Unknown routes return the static host's 404; if the host rewrites them to `index.html`, the app shows a game-not-found message.

Bubble Racing (`/bubble-racing`) is a touch-mode HTML5 cartridge loaded in an iframe from https://bubbleracing.com/. It requires an internet connection and uses the live game, not the local Ruffle archive. Its cartridge is created from the shared runtime mold; its icon is stored under `web/assets/bubble-racing/`. Eject removes the iframe and stops the embedded game.
