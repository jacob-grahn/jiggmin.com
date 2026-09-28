# Illustrated den

The den uses a source-authored ink-and-toon lighting bake plus live illustrated
materials for cartridges, the controller, the journal, and the responsive rack.
The hallway, workshop, attic, and basement now use a matching live shader treatment
through `web/house-illustration.js`; see [the house notes](art-direction/house/README.md).

## Reference target

Two built-in image-generator edits of fresh site screenshots are saved in
[the den art-direction folder](art-direction/den/). The selected target is
[Midnight ink](art-direction/den/midnight-ink-target.png): indigo/plum shadows,
warm/cool contrast, a teal screen, confident black contours,
and sparse drawn marks. The warmer alternative and [exact prompts](art-direction/den/prompts.md)
are retained for comparison. Generated lettering and incidental geometry changes
are not copied into the site.

## Static art

`scene/scripts/illustrate_den.py` runs on the original detailed Blender source.
The companion `scene/scripts/den_ink_materials.py` authors a gradual blue-to-orange plaster wall with subtle painted-over brick courses throughout,
broad wood colors, selective surface hatching, tapered wall
strokes, and simplified blue window tones. It preserves the actual furniture and
interaction geometry, then replaces non-emissive glossy surfaces
with narrow diffuse toon lobes and a violet ambient fill, rebalances the existing
lights with blue window spill and warm amber practical light. Freestyle renders black silhouette and
border strokes on substantial objects; small wear marks and material seams are
excluded to keep the image readable. The CRT artwork and emissive surfaces retain
their original material paths.

The original `.blend` is not overwritten. The illustrated source is saved as
`scene/midnight-den-illustrated.blend` (local and ignored like the other sources).
Run from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b scene/midnight-den-detailed.blend --python scene/scripts/illustrate_den.py -- --preview
/Applications/Blender.app/Contents/MacOS/Blender -b scene/midnight-den-detailed.blend --python scene/scripts/illustrate_den.py
python3 scene/scripts/finish_detailed_room.py --illustrated
```

The first command renders a composition preview. The second
exports the same interaction geometry and camera projection, a 5120 × 1600 room
plate, and the clean background patch. The finalizer installs compressed browser
assets and the cropped prop atlas, and derives the loading image from the final
wide plate so the artwork stays in sync. Props remain camera-invisible shadow casters
for the clean plate, and are removed from the Freestyle contour collection during
that pass. This retains lighting behind moving props without baking their ink
silhouettes onto the furniture.

## Moving objects

`web/den-illustration.js` extends the existing material shader, including patina.
It groups illumination into four bands, tints shadow and light, adds sparse
anti-aliased hatch marks to unprinted surfaces, and keeps each
label's original color map. Inverted back-face shells add dark contours to solid
forms. They share the original geometry, follow transforms, do not cast shadows,
and do not participate in picking. Flat labels and tiny parts receive no shell.
The controller’s HTML handoff panel uses matching hard color stops and ink borders,
including its pressed states and directional pad. No full-screen edge pass, extra
texture download, or game-screen filter is used.

The den's cloned materials preserve the shader hook when viewed during travel
through the adjoining hallway. The other rooms use their own matching material treatment.

The linework is baked for the den's existing projected-camera setup. Its limitations
for freely orbiting the room remain the same. Desktop and phone browser checks
are required after rebaking, especially prop edges and the CRT depth aperture.

Lighting revision: the wall blends gradually from blue on the window side to
orange on the lamp side. Faint, softened brick joints span the entire wall beneath the gradient paint,
and the lamp contributes stronger amber light. The generated concept's artificial
orange triangles remain removed.

The left shelf's bottom-right four positions are marked unavailable. Initial
placement, automatic returns, and responsive transitions all respect this rule;
the remaining 23 spaces can still hold the complete game collection.
