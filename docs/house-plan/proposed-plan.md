# Proposed house and grounds — revision 3

This proposal follows the requested ordinary two-bedroom house, unfinished basement, attached garage/workroom, secluded woods, and a two-lane road and driveway in front. It does not change the running scene. The original survey remains in `current-layout.svg` and `README.md`.

## Files and conventions

- `proposed-layout.svg` / `.png`: main floor, basement and attic.
- `proposed-site.svg` / `.png`: grounds, driveway and road.
- `proposed-navigation.svg` / `.png`: shared cross-hall camera, visible entrances and future navigation.
- `proposed-layout.json`: stable room IDs, nominal bounds, openings, floor elevations, and site coordinates for future implementation.
- `draw-proposed.py`: editable source that regenerates those files.

This is a game-world spatial plan. Dimensions are nominal planning envelopes, not clear finished sizes or construction specifications. The origin is the rear-left corner of the house. X increases right; Z increases toward the road. Geographic north is undecided. This new planning frame is deliberately separate from the existing runtime coordinates.

## House character and size

An unpretentious single-story house with a simple gabled roof, a covered front porch, an unfinished attic and full unfinished basement. Main footprint: 12 × 12 m, about 144 m² / 1,550 ft² gross before walls. The attached single-car garage is 5 × 7 m, large enough to reserve a rear workbench and side storage. It is set back from the front of the house, with a lower roof. Neither a second occupied story nor a basement under the garage is proposed.

This retains the existing den, hallway, workbench, attic clutter and basement activities, but resizes and relocates their enclosing spaces. The old den's enormous scenic envelope is not retained.

## Room arrangement and circulation

Two bedrooms sit at the back, looking toward the woods. Both have closets and individual doors off a 1.5 m-wide hall. A shared bathroom is directly off the hall. Kitchen/dining is on the left, with a door to the side yard and a broad opening into the den/living room. The front door leads through a covered porch into an entry with coat storage; it connects directly to the den and hall.

A short cross hall leads right to the mudroom/laundry and basement stair. Garage access passes through the mudroom. It never requires passing through a bedroom or bathroom. The kitchen and garage remain close enough for an ordinary groceries route: garage → mudroom → cross hall → kitchen. The entry is deliberately generous at this first pass; it can shrink in a compact revision.

The stairs occupy a dedicated U-shaped bay at the front-right, aligned on both levels. The basement floor stays at the original −4 m so the room retains its 4 m ceiling and original proportions. Two twelve-step flights meet at a halfway landing; headroom and door swings are checked in the 3D paths. The attic hatch is in the cross hall, ahead of the shared camera, and opens directly into the attic at about +2.8 m, removing the existing elevated connecting corridor. Reserve a small plywood landing at the hatch and a narrow access path amid exposed joists and insulation. Keep the tricycle, bags and other attic discoveries.

## Shared exploration camera

Revision 2 adopts the user's shared-view navigation: stand at the left end of the cross hall and look toward the exterior window, in +X. This keeps all existing exploration destinations accessible from one composition while the other rooms wait for later expansion.

| Interaction from the shared view | Destination | Timing |
| --- | --- | --- |
| Mudroom door on the camera's left wall | Move through the mudroom and garage doorway to the existing workbench view | Initial |
| Stair door on the camera's right wall | Descend the U-shaped stair to the basement | Initial |
| Ceiling hatch / pull cord ahead | Open ladder and enter attic directly | Initial |
| “Go right down the hallway” edge control | Turn toward the front entry and return to the den | Initial |
| “Look left up the hallway” edge control | Later rear-facing hall view serving kitchen, bathroom and bedrooms | Future |

Camera-relative left is toward the rear of the house (−Z); right is toward the front (+Z). These are not the left/right directions of the top-down drawing. The den doorway itself need not be visible from the shared camera. Nor do the workbench or basement interior: their visible doorways are the entry targets. The mudroom is traversed during the workbench transition, with no mandatory separate stop or new navigation choice.

The planning camera is X=6.55, Y=1.65, Z=7.55, aimed at (11.7, 1.9, 7.55). A provisional 50° vertical field of view at 16:10 is reserved for blockout evaluation, not a change to the live renderer. The new hatch spans X=8.7–9.95, Z=7.05–8.05. Reserve a ceiling near Y=2.6, attic floor near Y=2.8, a small plywood landing above, and the retractable ladder's deployment space along the cross hall. Keep the pull cord within the forward composition and clear of door hotspots. The hatch extends toward the lower roof slope; the ascent turns toward the ridge before reaching the standing camera height. Ladder landing and headroom still need an art/geometry pass. The old central-hall hatch is removed from both main-floor and attic diagrams.

The door entrances have clear top-down sightlines through the cross hall, and both door portals plus the hatch corners fit the provisional camera frustum. This is a geometric planning check, not proof of final visual quality. Side-wall doors are foreshortened; verify their visible leaf/jamb area and hit-target separation in the 3D graybox, including open door leaves, deployed ladder, ceiling thickness, the actual camera lens, and supported aspect ratios. If needed, adjust camera placement or door positions within their reserved rooms before finishing art. Preserve one coherent house and continuous travel through the mudroom.

## Windows that have somewhere to look

The hallway's two exterior views are deliberately re-established:

- Rear hall window, centered at X≈5.55, Z=0: back yard and trees.
- Right cross-hall window, X=12, Z=7.05–8.05: driveway and side woods. The garage ends at Z=6.8, so a ray directly outward in +X clears it. Oblique views toward the rear may naturally include the garage corner.

The garage shares walls with the house along the bedroom/mudroom side; no outside-view windows are placed on that shared wall. Its rear workbench window and right-side window face actual outdoor space. Bedrooms face rear trees; the den has side-woods and front-lawn views. Kitchen faces the side yard. Bath and laundry have no exterior wall, so use an ordinary ventilation assumption rather than fake outdoor windows. Attic has a rear gable window and low eaves at each side. Basement window locations avoid the garage slab and need modeled window wells.

Window scenery should eventually be generated from the shared site, including visible house/garage walls, rather than independent garden pictures that ignore adjacent rooms.

## Basement and attic

The basement occupies exactly the main 12 × 12 m footprint. Keep it unfinished: concrete, exposed joists/services, open storage, archive shelves and pool table. A dashed pool-play clearance is reserved in the drawing. A utility zone sits under the bathroom/laundry area. No basement bedroom or additional finished room is implied. Structural beams/posts and service routing remain to be laid out around circulation and the pool area when the shell is modeled.

The attic roof also belongs to the main footprint. The ridge runs front-to-back near X=6, with a central usable strip and lower eaves on both sides. Dashed strip edges indicate approximate headroom zones, not walls. Garage roof is separate and lower; there is no planned route into a garage attic.

## Outside

House front is at Z=12. The near road edge is at Z=40: approximately 28 m / 92 ft of front setback to the wall, or 26 m to the porch edge. A six-metre-wide two-lane local road runs across the front with narrow shoulders. There is a mailbox near the driveway mouth. Keep that mouth open; trees should frame the approach rather than obscure it.

A roughly 3.8 m-wide driveway runs from the road to the garage's front-facing overhead door. Widen it at the garage apron and add a side turnaround so a car need not reverse the whole way into the road. A short walkway branches to the porch. A small landing serves the kitchen's side door. The diagram reserves the geometry; vehicle turning paths and grade transitions should be checked at blockout scale.

The front lawn is mostly open, with trees along the sides. The back tree line begins roughly 8 m behind the house; dense woods continue beyond it. Side woods begin about 10 m left of the house and 9 m right of the garage. These are visual composition targets, not property lines. Nearby neighbors can exist beyond the woods without appearing in the principal window views. That gives seclusion without suggesting an inaccessible cabin deep in wilderness.

Main floor sits approximately 0.45 m above nearby yard grade. Garage floor is provisionally 0.15 m below the house, with a short transition at the mudroom and an apron graded up from the drive. Porch and kitchen landings need steps to the yard. Exact terrain, drainage, roof pitch, porch steps and exterior materials remain open design choices.

## Implementation sequence after the plan settles

| Step | Work | Preserve / verify |
| --- | --- | --- |
| 1 | Gray-box the entire footprint, road, drive and tree masses | First validate the shared cross-hall composition and its three visible entry targets. Then walk all routes; test car apron/turnaround, door clearances, stair headroom and window views. |
| 2 | Refit den, hall and garage into their new envelopes | Keep familiar objects, discoveries and the workbench composition; update cameras and travel routes together. |
| 3 | Align basement, stair and attic roof/hatch | Keep basement activities and attic discoveries; remove old floating connectors; resolve structural/service layout. |
| 4 | Add entry/porch and mudroom/laundry | Establish front arrival, garage entry and outdoor transitions. |
| 5 | Add kitchen, bathroom and the two bedrooms | Follow the reserved dimensions/openings; unfinished content can stay behind closed doors. |
| 6 | Finish the grounds and exterior views | Consistent tree locations, window wells, driveway, mailbox and distant road in all views. |

Every room in this proposal has a reserved location now. A room can remain unbuilt, but its volume and openings should already exist in the blockout. Do not add new rooms by shifting existing walls without revising this plan.

## Verification

The nominal rooms plus hall sections tile the main 144 m² footprint without overlap or unassigned area. Both bedrooms, bathroom, kitchen, den, mudroom, garage and stair have connecting door openings; front and side doors reach the yard. Basement and attic bounds match the main footprint. The right hall window lies wholly in front of the garage's Z extent. The house, site and focused navigation sheets were rendered and visually inspected. Revision 2 moves the hatch on both floors and reserves camera-relative navigation in the JSON; final perspective readability remains a blockout check. No runtime code or assets were changed.

## Editable blockout and fast preview

The proposed layout now has a separate editable assembly at `scene/house-plan-preview.blend` and a local browser layout lab. See `scene/preview/README.md` for the export/render loop, camera and route editing, visibility checks, staging limitations, and regeneration commands. Production rooms remain unchanged.

## Den composition

The original TV, console, coffee table, library, lamp and seating turn together toward the west exterior wall (X=0). The original framed window stays to the left of the TV in the camera view, looking toward the side woods. Its opening is Z=10.23–11.31, Y=0.588–2.412. The additional proposed front window is removed. The den camera is (4.137, 1.8, 9.334), looking toward (0.882, 1.056, 9.4). Preview staging scales the original scene by (0.55, 0.42, 0.6) before rotating it 90° in Blender; the shallower depth keeps the camera inside the planned room. Original materials, lighting and production scene are retained in the source; the fast preview remains clay shaded.
