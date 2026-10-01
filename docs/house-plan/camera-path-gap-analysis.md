# Camera-path completion audit

**Historical audit:** the seven implementation passes are now recorded in [the completion report](camera-path-completion.md). The findings below describe the pre-finishing snapshot.

Reviewed the saved `scene/house-plan-preview.blend` after the attic-hatch shift and den reorientation. The main requirement is to finish the circulation spaces and refit the existing rooms to their new shells. We do not need to furnish the whole two-bedroom house before these routes can work.

## Evidence and scope

Rendered 40 diagnostic frames: 0%, 15%, 30%, 45%, 60%, 75%, 90% and 100% of each of the workbench, basement, attic, den and future rear-hall paths. Sampling uses the browser's actual rounded routes, easing and interpolated camera rotation, at the shared 50° vertical lens and 16:10 aspect. Door leaves are hidden and the attic ladder shown using the preview's current travel rules. Return travel retraces these poses.

These are Workbench clay renders. Flat surfaces, dark ceilings and blank artwork are not proof of missing geometry or missing production textures. The audit identifies what must be fitted and finished in this assembly; existing room art can be reused. It does not change the scene.

The matching exported-mesh check reports no camera-centre crossings through structure or contents on any route. That does not establish body/head clearance, working door swings, one-sided material correctness, or visual continuity. The 40 frames are samples, not an exhaustive every-frame review. Free move can expose much more than the authored paths and is outside this completion scope. Narrow-screen interiors need a further pass before release; the existing target-frustum checks alone only establish that the three hall targets remain in frame.

## What needs finishing

| Priority | Space / surfaces | Camera evidence | Minimum complete version |
| --- | --- | --- | --- |
| 1 | Cross hall: both long walls, end window wall, floor and ceiling | Every route, especially 0–30%; large wall areas remain close throughout departure | Finish wall surfaces, floor continuity, ceiling seams, baseboards, door casings/jambs/thresholds, window frame/glass/sill, hatch frame and pull cord. Rehang imported pictures and the small shelf/mirror so they fit the new walls and door clearances. |
| 1 | Entry: front-door wall, nearby window, cross-hall corner and den doorway | Den 30–60% reveals the entry, front door and a close blank wall | Complete this as a modest entrance area: finished wall returns, front door and hardware, window and sill, floor/ceiling continuity and limited coat/entry dressing. This area cannot be left as an unseen connector. |
| 1 | Mudroom and garage passage | Workbench 45–60% exposes the garage opening and its surrounding walls at close range | Finish the visible passage walls, floor, ceiling, both door frames and threshold/level transition. Add enough laundry/storage detail to read as a mudroom; a fully interactive laundry room is unnecessary. Both door leaves need real opening behavior. |
| 1 | Basement stair bay, landing and basement arrival | Basement 30–60% moves past the stair entrance and into a broad view of the lower room | Finish the doorway and stairwell wall returns/underside, stair edges, risers/stringers as appropriate, landing, railing/handrail and lighting. Resolve how the open stair bay meets the basement ceiling. Validate headroom and the turn between flights with a body-sized clearance check. |
| 1 | Attic hatch and landing | Attic 15–60% puts the ladder, ceiling aperture and roof slope directly beside the camera | Detail the hatch thickness, liner and ceiling trim, hinges, folded/deployed ladder and its top attachment. Provide a believable landing/walking strip and sufficient clearance under the sloped roof. The raised camera path clearing the roof is not a finished physical ladder transition. |
| 2 | Garage: workbench wall, right side/window wall, visible left edge, floor and ceiling | Workbench 60–100% shows substantially more than the tabletop | Refit the old studs, tool panels and bench to the new rear wall and window opening; finish window reveals, side-wall coverage, floor and ceiling. Keep the bench composition. The front vehicle-door wall is lower priority for this exact route, but its shell/door should still close the space. |
| 2 | Basement: walls behind pool table/storage, visible corner, ceiling and floor | Basement 60–100% shows a wide unfinished room | Make the unfinished treatment intentional: masonry/concrete, slab detail, exposed joists/services as appropriate, framed high windows/window wells, consistent lighting and attached shelves/art. Refit wall-mounted props to the new perimeter rather than retaining their old floating placements. |
| 2 | Attic: roof undersides, gable/window wall, eaves, visible floor strip | Attic 60–100% reveals the side slope before the final clutter composition | Rebuild rafters/sheathing/joists/insulation around the new roof, detail the gable window, fit pipes/wires to the roof, and settle clutter onto the floor. Preserve the established discoveries and objects. “Unfinished attic” still needs continuous, believable construction. |
| 2 | Den: west TV/window wall, visible side-wall returns, doorway, floor and ceiling | Den 75–100% reveals the room from an angle before settling on the familiar composition | Keep the approved TV-left-window/right-lamp arrangement. Finish the new window reveal, frame-to-wall junction, adjacent walls and entry edge; adapt the existing den materials and lighting. Check imported props from the approach angle as well as the final view. No den redesign is needed. |
| 2 | Exterior glimpses through windows | Hall at departure; entry during den travel; den, garage, attic and basement on arrival | Provide coherent local window views: side woods at the den, drive/yard beyond the cross hall, garage-side/rear context, gable woods and basement wells. Add glass/frame depth and avoid exposed placeholder silhouettes or abrupt backdrop edges. Complete the visible porch/yard glimpse before detailing the distant road or whole property. |
| Later | Rear/private hall | Optional private-hall 60–100% reveals a long corridor with several closed doors and an end window | Before enabling this navigation, finish both corridor walls, floor/ceiling, room-side door faces/casings and end window. Bedrooms/bath/kitchen can remain closed behind those doors. |

## Camera and transition issues to solve before final art

1. **Den turn, roughly 30–60%:** the camera sweeps across the entry and spends a sampled view nearly filling the frame with a close blank wall. Give this route intermediate look targets so it turns through the doorway toward the den at the right time. Do not add elaborate wall decoration just to compensate for the current turn.
2. **Horizon tilt during turns:** the sampled workbench, basement, attic and den transitions visibly roll, although their endpoint compositions are level. Direct quaternion interpolation can do this when heading and pitch change together. A world-up look direction or independently authored heading/pitch would keep the horizon level.
3. **Basement descent:** the view is already turning toward the final basement composition while traversing the stair. Review continuous playback around the landing so the movement reads as walking down the U stair, not sliding past it. Recheck the necessary surfaces after that adjustment.
4. **Attic climb:** large rungs and the ceiling edge dominate the middle of the climb, and the view then sweeps close to the low roof. Author the climb orientation and landing transition along with the actual folding ladder/headroom. Treat these as one task.
5. **Door/hatch visibility is currently a shortcut:** the preview removes involved doors for the whole journey and displays the ladder immediately. Real swings/deployment will reveal door backs, jambs, hinges and changing sightlines. Inspect those animations before declaring their surroundings complete.

## What can wait

- Full bedroom and bathroom interiors, furnishings and interactions.
- Full kitchen/dining fit-out while the hall and den connecting doors remain closed. If the den–kitchen opening is intended to be permanently open, its visible kitchen interior becomes a current requirement.
- Deep mudroom cabinetry outside the travel view; a small readable laundry/storage area is enough initially.
- Unseen garage storage and vehicle-door detail beyond a sound closed shell.
- Dense detail in hidden basement/attic corners; keep the shell continuous and prioritize visible surfaces.
- Most of the lot, the full road treatment and distant woods. Finish the actual window views first.

## Suggested build order

1. Lock the den turn, level horizon, basement descent and attic climb orientation.
2. Finish the cross hall and entry as a connected area.
3. Finish the mudroom/garage doorway and the basement stair connection.
4. Resolve attic hatch/ladder/landing construction and deployment.
5. Refit and finish garage, basement and attic shells around their existing content.
6. Restore den surface/lighting quality around its approved new orientation; complete the visible window exteriors.
7. Review animated outbound/return travel at desktop and narrow ratios, then enable the future rear hall when its corridor is ready.

## Frame sheets

Each sheet reads left-to-right, top-to-bottom. Percentages are the preview's travel slider values, not linear distance.

- [Workbench via mudroom](../../scene/renders/house-preview/audit/workshop-sheet.png)
- [Basement](../../scene/renders/house-preview/audit/basement-sheet.png)
- [Attic](../../scene/renders/house-preview/audit/attic-sheet.png)
- [Den via entry](../../scene/renders/house-preview/audit/den-sheet.png)
- [Future rear hall](../../scene/renders/house-preview/audit/private-hall-sheet.png)

Frame sheets are local diagnostic output under the repository's ignored render directory. Regenerating the Blender assembly does not turn this audit into a production-completion check.
