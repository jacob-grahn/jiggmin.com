# The quiet house rooms

Four independently modeled Blender interiors for the house archive: hallway, workshop, attic and basement. All use real geometry, procedural materials and Cycles lighting. They share warm wood and lamp pools with the den, with cool night fill and no animated scares.

The ordinary clutter pass adds only mundane modeled belongings: coats and shoes, utility tools and cables, packing material, storage boxes, laundry and unfinished scraps. The existing discoveries sit among these objects; no new written personal content, notes or hotspots are introduced. The attic keeps one plywood sheet and exposed joists, and the hallway keeps ceiling attic access.

The art pass places twelve noninteractive prints in mismatched frames, standing pictures, loose stored sheets and a worn cotton T-shirt draped across the workshop bench with modeled sleeves and a collar. Its chest reuses the active Platform Racing 2 v3 label. Red Earth, Cooties and Neverending Light labels are reused as room prints; original odd art textures are stored under `scene/house-textures/art/`. All print images use explicit UV coordinates and are packed into the editable Blender scenes.

Rebuild all four final images:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --threads 4 --python scene/scripts/build_house_rooms.py -- workshop attic basement hallway
```

The final runtime images live in `web/assets/house/{hallway,workshop,attic,basement}.webp`. They are 1280 × 800 (16:10), rendered at eight Cycles samples with denoising after review. The source script can increase resolution or samples for an export. Native editable scenes are saved as `scene/house-<room>.blend`, with packed image textures. Intermediate PNGs are saved under `scene/renders/house/`.

The script also supports `-- preview <room...>` for small composition renders and `-- anchors <room...>` for geometry-only manifest generation. `web/assets/house/hotspots.json` contains room-keyed arrays of `{id,x,y,width,height}`. `x` and `y` are the upper-left of a normalized rectangle in the rendered image. Bounds come from projecting the actual modeled object geometry through the render camera.

The hallway is 2.6 m wide, with real wall openings, recessed unmarked door leaves and casing seated against plaster. Its near-right rainy window uses modeled droplets and runnels over dark glass, with cool blue illumination and subdued warm lamp pools. The workshop door hotspot follows the visible portion beside the plate to keep controls disjoint.

The hallway plate uses the versioned square authoring texture at `scene/house-textures/plate-photo.jpg`, cropped from the supplied photograph and mapped onto ceramic geometry. The full original photograph remains local at `docs/references/kindergarten-plate.jpg` and is ignored by Git. Its uneven drawings and lettering are the original artwork, with no AI redraw or invented transcription. The den source and assets are not modified by this builder.

## Eclectic artwork

The art layer reuses selected cartridge label textures from `web/assets/labels/` on posters, stored prints, and a draped Platform Racing 2 T-shirt. Original surreal prints are editable SVGs with PNG texture exports in `scene/house-textures/art/`; its manifest documents provenance and dimensions. These are decorative objects with no additional hotspots. Artwork is baked into each lazy-loaded room image and packed into the native Blender sources.
