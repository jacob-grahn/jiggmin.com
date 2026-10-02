"""Room allocation for structural bakes, in Blender world coordinates."""

def structural_group(name, kind, points):
    lo = tuple(min(p[i] for p in points) for i in range(3))
    hi = tuple(max(p[i] for p in points) for i in range(3))
    center = tuple((a + b) / 2 for a, b in zip(lo, hi))
    if kind == 'site':
        return 'structure-exterior'
    if center[2] > 2.75:
        return 'structure-attic'
    if center[2] < -.2:
        return 'structure-stairs'
    # The hall's east window wall straddles x=12. Its center is on the
    # garage boundary, but the visible west face belongs to the hallway.
    # Include the shared wall segments and attached skirting/crown; don't
    # sweep in the perpendicular garage walls or nearby workshop plywood.
    hall_window = name.startswith('Finish / hall-right ')
    hall_boundary = (
        name.startswith(('Proposed wall', 'Finish / skirting', 'Finish / ceiling moulding'))
        and 11.8 <= lo[0] < 12 < hi[0] <= 12.2
        and lo[1] < -6.8 - .001 and hi[1] > -8.3 + .001
    )
    if hall_window or hall_boundary:
        return 'structure-hall'
    if center[0] >= 12:
        return 'structure-garage'
    if center[0] < 4.8 and center[1] < -6.5:
        return 'structure-den'
    return 'structure-hall'
