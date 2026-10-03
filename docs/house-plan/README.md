# House plan — current state

Surveyed 2026-09-29. This is the baseline for a future whole-house plan, not a proposed layout. No runtime room geometry or placement was changed.

Open `current-layout.svg` for a scalable blueprint or `current-layout.png` for the rendered sheet. `draw-current.py` holds the editable drawing. All three floor sections use the same scale: 32 drawing pixels per scene metre. They have different crop origins; compare the dashed reference outlines to see vertical alignment. Top of the sheet is world −Z, the far end of the hallway, not geographic north.

## Evidence and limits

The survey combines `web/assets/house/layout.json`, `scene/scripts/build_connected_house.py`, the room construction functions and `window_lighting()` in `scene/scripts/build_house_rooms.py`, runtime baked GLB mesh bounds, den collision geometry in `web/assets/colliders.json`, and the clipping rules in `scripts/house-source/den-opening.js` and `web/house-boundaries.js`. Blender coordinates are converted to runtime coordinates before applying each room's translation and yaw. Authoring notes alone are insufficient because some describe older versions.

This is a schematic of the authored envelopes and circulation, not a horizontal mesh slice or construction drawing. Window symbols project openings at different heights onto the plan. Doors are shown as openings with short leaf marks; swing directions are not surveyed. Furniture, decorative trim and small mesh overhangs are omitted. Dimensions are approximate scene metres. The den in particular is a scenic set with oversized walls and a floor that does not consistently close against them. Solid boundaries represent wall runs or, in the attic, the roof envelope; dashed boundaries indicate missing/inferred closure. Muted outlines show the other floor or excess slab. The basement's dashed den/hall references are cropped to that panel and are not complete room footprints.

## Current envelope coordinates

Runtime axes: X across the sheet, Y elevation, Z down the sheet.

| Space | X limits | Z limits | Floor elevation | Notes |
| --- | --- | --- | --- | --- |
| Den | −13.69 to −1.39 | about −0.12 to 12.40 | 0 | Left wall ends near Z=8.3; near wall is connector geometry; envelope ≈12.3 ×12.5. |
| Hall | wall centres −1.39 to 1.39 | −5.90 to 10.40 | 0 | Interior width 2.60; last 2.90 of length is an added landing; near end is open. |
| Workshop | 2.75 to 7.68 | −1.20 to 4.80 | 0 | About 4.93 ×6; south edge has no enclosing wall. Clipped slab extends to X=9 and Z=−1.7 / 5.3. |
| Workshop passage | 1.38 to 2.75 | 1.15 to 2.45 | 0 | About 1.37 long, 1.30 wide. |
| Basement stair | −7.40 to −1.40 | −3.85 to −2.55 | 0 down to −4 | 20 steps, 0.30 run and 0.20 rise per step. |
| Basement | −20.40 to −7.40 | −4.60 to 5.40 | −4 | About 13 ×10; slab and wall thickness project beyond nominal envelope. |
| Attic | −4 to 4 | −10.40 to −2.80 | origin +3.20 | Roof envelope ≈8 ×7.6 after front clipping; individual joists/deck surfaces vary in height. |
| Attic landing | −0.65 to 0.65 | −2.80 to 1.15 | +3.38 | Hall ceiling hatch extends approximately Z=1.15–2.275. |

## Confirmed planning issues

**A — Near hallway window.** Its runtime glass spans approximately Z=2.80–4.60 at X=1.385, Y=1.15–2.55. Looking outward in +X reaches the workshop entrance wall at X=2.75, approximately 1.37 m away. The wall segment spans Z=2.45–4.80 and reaches Y=3.3, so it obstructs the straight outward view across the entire window. The spaces do not overlap: this is a narrow exterior slot with an obstructed view. The existing garden scenery does not account for the neighboring room. The far hallway window spans Z=−3.40–−1.70 and clears the workshop's wall footprint, which starts at Z=−1.20.

**B — Attic support and roof.** Most of the attic footprint is beyond the far end of the hall or to its sides. Only a small strip lies over the modeled hall, and it lies over neither the den nor the workshop. A whole-house roof and supporting rooms have not been modeled. The landing connects the hatch to the attic as a separate narrow upper corridor.

**C — Basement placement.** The basement extends considerably to the left of the den and partly beyond its far wall. Only about 35 m² of its nominal 130 m² footprint falls below the nominal den envelope. It therefore reads more like a partly detached cellar reached by a long stair than a basement matching the house above. The windows sit about 1.05 m below the main-floor datum at their centres; a future exterior plan should account for grade or window wells.

**Incomplete shell and household program.** The den has an unclosed left/near corner, the hall has an open near end, and the workshop lacks a full perimeter. No exterior entrance, kitchen, bathroom, bedroom, or vehicle-sized garage entrance is currently modeled. The far locked door has no room behind it. These gaps are shown as gaps, not filled in with invented rooms.

**Scale mismatch.** The den's nominal scenic envelope is roughly 153 m² and the hall is about 16.3 m long. These come from the scene, but should not automatically become the dimensions of the planned house. Preserve the familiar views and important objects while reconsidering the enclosing shell.

## Next iteration

Keep this survey unchanged as the “before” reference. Create a separate proposed plan once room program and house character are decided. Start with the exterior footprint and stacked floors, establish a real entrance and everyday circulation, place the kitchen/bath/bedrooms, and reserve exposed exterior walls for windows. Then fit the existing den, workshop, cellar and attic views into that structure. Give future rooms stable names, dimensions, door/window positions and implementation status so additions follow the plan.

Re-render this baseline after editing the drawing:

```sh
python3 docs/house-plan/draw-current.py
node --input-type=module -e "import sharp from 'sharp'; await sharp('docs/house-plan/current-layout.svg').png().toFile('docs/house-plan/current-layout.png')"
```
