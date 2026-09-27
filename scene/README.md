# Midnight Den

An original Blender environment for Jiggmin's Flash-game archive, following the selected rainy midnight-den concept.

## Files

- `midnight-den.blend`: editable scene, with packed image textures.
- `renders/midnight-den.png`: final 1600 × 1000 Cycles camera render.
- `scripts/refine_den.py` and `scripts/polish_den.py`: subsequent art-direction passes.
- `scripts/build_den.py`: staged procedural scene builder.
- `scripts/make_textures.py`: original CRT boot screen, archive labels, rug, and poster textures.

The original starting scene is preserved. The environment lives in a separate scene named **Midnight Den**, with collections for architecture, furniture, CRT, console, cartridges, props, and lighting.

The console is the original **J/01** design. No Nintendo branding or N64 shell is used. The latest library revision uses actual mirrored game thumbnails on all 23 cartridges.

## Interaction anchors

- `CRT_SCREEN • game surface`: curved screen mesh tagged `role=ruffle_screen`.
- `CONSOLE • J/01`: console anchor tagged `role=cartridge_dock`.
- `DROP_TARGET`: hidden cartridge-slot target tagged `role=drop_target`.
- `CARTRIDGE_01` through `CARTRIDGE_23`: independent parents tagged `role=draggable_cartridge`, with real manifest game IDs and table/rack storage metadata.

## Scope

This is a scene/art-direction pass. Browser rendering, texture/light baking, optimized glTF export, drag-and-drop interaction, and Ruffle integration are subsequent work. The native procedural materials are designed for Blender and require baking/adaptation before web export.

## Rebuilding

Use Blender's Python environment to load `scripts/build_den.py`, then call `init()`, `room()`, `hero()`, `cartridges()`, `props()`, and `finish()` in order in the same namespace. Then run `refine_den.py` and `polish_den.py` once each against that saved file. These refinement passes are not idempotent. `init()` creates a new scene without deleting existing work. The texture generator uses Pillow and the macOS Menlo font. Paths currently target this local project.

## Texture provenance

The four house rooms use generated rainy garden and treetop views in `house-textures/windows/`. Their exact prompts are saved alongside the images. Rebuild them with `Blender -b --python scene/scripts/build_house_rooms.py -- hallway workshop attic basement`. The final lighting pass switches existing fixtures off, lights the rooms from their windows, and adds one low-output floor lamp in the attic. It also regenerates the browser hotspot coordinates from the room cameras.

The distant rainy-garden view uses an AI-generated background texture, made with the built-in image generation tool. See `textures/rainy-garden-prompt.txt` for its prompt. Cartridge labels use the game thumbnails mirrored from jiggmin2.com; other assets are modeled geometry or original procedural graphics. All texture files are included and packed into the Blender file.

## Controller revision

`midnight-den-controller.blend` is the controller revision with one original joystick/A/B/QUIT controller. Review `renders/midnight-den-controller.png` for placement and `renders/controller-detail.png` for the close-up. `scripts/add_controller.py` rebuilds the controller revision from the original scene. See [MOBILE-CONTROLS.md](MOBILE-CONTROLS.md) for the proposed per-game Ruffle input mapping and mobile behavior.

## Complete cartridge library

`midnight-den-library.blend` is the latest scene: five loose tabletop cartridges and eighteen in a three-shelf walnut rack beside the window. Every cartridge maps to a different downloaded game, with thumbnail cover art and a titled spine. Review `renders/midnight-den-library.png`. `cartridges.json` maps object names to game IDs. Run `scripts/label_library.py` with system Python, then `scripts/add_library.py` in Blender against the controller revision to reproduce this pass. Textures are packed into the blend file.

## Browser physics revision

The browser now exports actual static room geometry and 45 collision volumes using `scripts/export_physics_room.py`. `web/physics.js` adds rigid-body cartridges and a spring grip; `web/room-renderer.js` projects fixed-camera Cycles lighting onto the room mesh and adds dynamic shadows. See the root README for the current implementation and limitations. The editable source `.blend` is preserved.
