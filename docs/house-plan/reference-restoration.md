# Visual reference restoration — September 29

The user's screenshots of the previous hallway, basement, workshop, and attic are the style reference. Keep the cool blue light entering through windows, dark unlit fixtures, illustrated surfaces, and the existing den composition. Room placement is not permission to replace the art direction.

The earlier restoration was incomplete: it recovered prop materials but discarded the original walls, windows, room lights, and the basement's runtime floor artwork. The approved assembly also used a different basement camera.

## Current correction

- Publication restores the original basement GLB as a room, including the original baked walls, floor, ceiling, window frames, lights, and furniture arrangement. The floor is now 4 m below the main level and contents are no longer vertically compressed. The basement still uses a 1.2× horizontal fit into the approved footprint. The original concrete-floor artwork, drain, and window-exterior handling run again. The camera now faces the original main composition, with a right turn for the recorder.
- The inherited basement ceiling has a real geometry cut for the approved stairs. The camera finishes its stair descent before crossing to the restored viewing position. Exterior air wells follow the restored windows.
- New connecting architecture uses the original wall, wood and ceiling materials. The experimental live window spotlights and shadow maps have been removed. The connective shell needs its own Blender/Cycles window-light bake before release; its current browser preview is underlit.
- Den travel uses quaternion rotation interpolation and positive scale, replacing interpolation of rotation-matrix entries. It preserves the live den lens, projection shift, zoom, and exposure at the endpoint. The inherited den scene owns the interior view until the camera approaches its doorway, keeping overlapping assembly geometry out of that view.
- Asset manifest requests revalidate; application/module revisions prevent the browser from mixing the previous assets with the new renderer.

The original `.blend` room files and original baked assets remain unchanged. These corrections are in the publication assembly and runtime; the editable layout preview remains the approved layout source. Do not use the older tan-bake screenshot as a style target.

## Verification

The full build, all 165 tests and both route audits pass after the return-camera adjustment. Browser inspection confirms the restored basement arrangement, height and baked floor details. The connecting hall still needs a bake. Tests establish camera stability and exact den endpoint projection; they do not establish pixel-identical artwork throughout a moving camera path.
