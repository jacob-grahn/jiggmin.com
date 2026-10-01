# Fast house layout preview

This is a separate proposal assembly and development viewer. It does not replace the shipped house, overwrite the existing room scenes, run the production build, bake lighting, or rebuild surface textures.

## Start and iterate

```sh
npm run preview:house
```

Open http://127.0.0.1:8010/scene/preview/. The server binds to loopback only. It serves the source checkout, so keep it local. `-- --port 8011` selects another port.

The editable native scene is `scene/house-plan-preview.blend`. Open it in Blender, move/edit geometry or cameras, edit route control points, and **save**. Then:

```sh
npm run preview:house:export
```

The open browser automatically reloads a completed export. Export reads the saved file, not unsaved edits in a running Blender window. A typical measured export on this machine takes about 10 seconds, excluding Blender startup. GLB output is deliberately uncompressed; the den retains image artwork and simplified source materials to keep iteration quick; it is for local preview, not deployment.

For a native Workbench still from the saved active camera:

```sh
npm run preview:house:render
```

The initial 1280×800 still took approximately six seconds of render time. Output: `scene/renders/house-preview/hub-0001.png`. No Cycles bake is involved. You can also use Blender's solid viewport or F12 directly. The browser uses flat WebGL lighting, so shading differs from the Workbench still.

On another checkout, first generate the local assembly:

```sh
npm run preview:house:build
```

The builder refuses to overwrite an existing editable preview. To deliberately regenerate it from the proposal and discard preview edits (Blender normally leaves a `.blend1` backup):

```sh
npm run preview:house:build -- --force
```

`BLENDER_BINARY` can select a different Blender executable. On this Mac, Blender must run with access to the graphics device: sandboxed execution crashed during Metal initialization, even in background mode. Normal terminal execution works. Python script errors return failure using `--python-exit-code 1`.

## What is assembled

- Proposed main-floor shell, true door/window openings, attic floor/hatch, pitched roofs, and basement under the house.
- A U-shaped basement stair, pull-down attic ladder and independently classified door leaves.
- Current workshop, basement, attic and hallway contents imported from `scene/exports/house/*.glb`. These exports are newer than the individual saved room `.blend` files. The pool table is included.
- Den contents appended from the latest `scene/midnight-den-illustrated.blend` because its objects remain individually editable there.
- Simple placeholders for future rooms; road, drive, porch, yard and trees for window/view context.
- Named cameras, editable route curves and visibility-target empties.

Old room envelopes, windows and exterior picture planes are filtered out. Existing props are staged into the proposed envelopes; **this is not a final art refit**. The builder records source counts and staging scales in the scene and generated metadata. In particular the den and basement use nonuniform staging scales. The den now faces the west exterior wall, retaining its original screen-left window trim and the TV/lamp/seating arrangement. Its depth is compressed to fit the camera inside the room; the preview does not reproduce the source lighting or materials. Wall-mounted art, shelf placement, roof supports, fixture heights and contents that previously depended on the old shells still need visual review. The current scene retains the proposed room boundaries rather than silently expanding them around the old art.

## Blender organization

- `01 …`: new shell, floors, ceilings, roofs, stair, doors, ladder, future-room proxies, site.
- `02 Existing contents / …`: existing objects grouped by source room, retaining source names and `source_room` / `source_object` properties.
- `03 Cameras`: `View / hub`, room views, future hall and overview. The browser preserves the hub lens during travel, as production does. Edit the **hub** camera lens to change that shared lens.
- `04 Editable camera routes`: POLY control-point curves. Edit points in Blender Edit Mode; do not bevel these curves. Browser travel applies the same continuous-curvature `createRoute`, eased heading, and speed-limited `travelPose` / `travelDuration` functions used by production.
- `05 Visibility targets`: target points for the mudroom door, basement door and attic hatch.

Coordinates in planning JSON and browser are X/Y-up/Z. Blender stores the same positions as `(X, -Z, Y)`. Export converts them back. The native cameras and exported route points are read from the actual saved Blender file, so editing them does not require changing Python.

Objects with `preview_kind` participate in fast export. Duplicate a classified wall to add another wall; for a new object, set that custom property to `shell`, `contents`, `floor`, `ceiling`, `roof`, `door`, `stair`, `ladder`, `proxy` or `site`. Door leaves also use `door_id`. Unclassified objects and diagnostic curves are not exported. Meshes are merged by category/material/source-room for fast browser drawing while remaining separate in the native scene. Materials and modifier details are simplified in the initial staging assembly.

## Browser controls

- **Travel / Pause / Return**, destination selector and a scrub slider; ½×, 1× and 2× speed.
- Door/hatch target buttons plus left/right hallway navigation. The future hall is enabled in this diagnostic viewer only.
- **Orbit overview** for rotating/panning/zooming around the complete assembly.
- 16:10, 16:9, 4:3, portrait and fit-window presets. Presets fit the available panel; the actual displayed CSS dimensions are reported.
- Production lens resizing (preserve horizontal coverage on narrower screens) or fixed vertical FOV. Portrait is a stress test: production currently limits house exploration to wide desktop screens.
- Contents, ceilings/roof, closed-door, shell-highlight and path switches.
- Screenshot download and automatic reload after export.

Door leaves now swing on their hinges and the three-section attic ladder folds and unfolds reversibly with travel. Prop interactions remain outside this diagnostic viewer. This keeps clearance/path testing separate from final animation polish. Roof hiding also removes the attic floor for an overview; it is a diagnostic cutaway, not a physical state.

Visibility reports sample the target aperture against actual visible meshes and the current camera. A visible sample does not guarantee a comfortable click target. Revision 3 moves the hatch 1 m along +X and the hub camera 1.2 m along +X to (6.55, 1.65, 7.55). The basement door remains oblique but now clears 2/3 visibility samples instead of 1/3; portrait preserves the targets at the cost of a wide vertical field of view. The attic camera path turns inward toward the ridge to clear the sloped roof. The camera-near-geometry warning samples six directions within 18 cm; it is a useful warning, not full-body collision detection.

## Checks

```sh
node --test tests/house-preview.test.mjs tests/house-layout.test.mjs tests/house-camera.test.mjs
npm run preview:house:check
```

The source tests check rounded camera routes against proposed structural geometry and verify the real door/hatch holes. The second command checks the **actual exported mesh**, including Blender edits, and writes `generated/check-report.json`: camera-centre crossings against structure and contents, animated-door/ladder crossings, sampled body/head clearance, and target projection at four aspect ratios. Structural crossings fail the command; content crossings are reported for review. It also probes a 44 cm wide envelope at three heights and 16 cm above the camera; these discrete checks are not a continuous physics simulation.

The preview was exercised in the browser with animated basement travel, workbench/basement arrivals, scrubbing, and 4:3/portrait presets. Finish reviewing all transitions visually before replacing production geometry or routes.

## Sources and generated output

- `docs/house-plan/proposed-layout.json`: approved-direction planning data.
- `scene/scripts/house_preview_spec.py`: structural blockout and initial camera paths.
- `scene/scripts/build_house_preview.py`: one-time editable Blender assembly.
- `scene/scripts/export_house_preview.py`: fast export from saved edits.
- `scene/preview/generated/`: ignored, regenerable GLB/metadata/check report.

The native `.blend` and stills remain local under the repository's existing ignore rules. No preview entry point or output is copied into the production `dist` tree.

### Free camera

Click **Free move** to fly from the current viewpoint. WASD moves relative to your view, Q/E moves down/up, Shift moves faster, and dragging or arrow keys turns the camera. Escape stops free movement; Hall view returns to the hub. Click the canvas after using toolbar controls to resume keyboard movement. The overlay shows scene XYZ in meters, pitch/yaw/roll in degrees (YXZ), and converted Blender XYZ. Movement passes through geometry for inspection. Export reloads preserve the free camera pose.

## Completed finishing passes

See `docs/house-plan/camera-path-completion.md` for the seven-step completion record. The saved native file contains the finished preview. Main roof rise is now 4.5 m (ridge Y=7.3) to give the shifted attic access usable clearance.

Repeat an individual geometry/material pass with `npm run preview:house:finish -- --stage N`, where N is 2 through 7. Each pass owns a “06 Finish N” collection and saves a before-pass backup if one does not already exist. Camera behavior is in `travel-camera.js`; access mechanics are in `access-animation.js`. Rebuilding the initial assembly still requires `--force` and replaces the finished native file. To reconstruct the finish after a deliberate rebuild, run finishing stages 2–7 in order.

`npm run preview:house:sample` writes current camera/animation samples; `scene/scripts/render_house_audit.py` renders those samples inside Blender. The exporter translates unsupported illustrated den shaders to source-colour PBR materials while keeping their image artwork. This preserves composition and palette without a lighting bake; it does not reproduce the original Cycles/Freestyle appearance exactly.
