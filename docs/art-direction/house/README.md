# Illustrated house

The approved Den guides the hallway, workshop, attic, and basement: ink silhouettes,
simplified light/shadow bands, indigo shadows, warm practical lamps, and sparse
surface hatching. Masonry carries subtle painted-over brick joints. Timber framing,
original artwork, geometry, and room-specific light placement stay intact.

These rooms are live 3D scenes, so `web/house-illustration.js` applies the treatment
at load time rather than using camera-projected room images. The existing GLBs and
texture maps remain the source assets. Lamp illumination follows movable fixtures.
The room style is applied after prop grouping and door setup, so ink contours are
not mistaken for interactive objects or physics geometry. Outlines cannot be picked,
inherit room lighting layers and wall clipping, and are released with each room.

The accompanying CSS gives journal and paper panels dark ink borders, warm paper,
and simple offset shadows. Printed art and game views retain their original colors.

Browser review:

- [Hallway](hallway-after.png)
- [Workshop](workshop-after.png)
- [Attic](attic-after.png)
- [Basement](basement-after.png)
- [Paper panel](paper-after.png)

Validation: all 88 automated tests pass. Browser checks include room transitions, shader compilation,
and a movable prop/paper interaction. The house remains desktop-only, matching its
existing navigation constraints; the Den and journal remain available on phones.
