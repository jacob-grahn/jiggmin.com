# Personal influences

Images supplied by the site owner. Originals are preserved alongside fitted PNG textures. `placements.json` records the eight replacements; `node scripts/update-house-art.mjs` fits each image without cropping or stretching and updates existing authoring/runtime GLBs. Existing object names stay stable for placement and prop grouping.

- Hallway entrance: The Legend of Zelda: The Wind Waker.
- Workshop bench: Total Annihilation.
- Basement landscape frame: FLCL.
- Basement portrait frame: Death.

- Attic paper study: Outer Wilds.
- Attic packing-board print: Muse — The 2nd Law.
- Basement cellar-wall frame: Journey.
- Basement shelf picture: My Neighbor Totoro.

All eight generated house prints have been replaced. The den still has a separate procedurally drawn “After Hours” poster.

The supplied Outer Wilds file was AVIF data with a .jpg extension; its unchanged source is stored as `outer-wilds.avif`.

The native room generator uses these fitted textures. Run `scene/scripts/update_house_art.py` with Blender to update saved room/connected/preview/release assemblies. This does not rebake room lighting.
