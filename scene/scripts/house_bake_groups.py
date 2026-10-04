"""Room allocation for structural bakes, in Blender world coordinates."""
import re

def room_atlas_group(group,name):
    if name.startswith('Cellar slab underside / '):return 'basement-slab-ceilings'
    if name.startswith('Attic slab upper / '):return 'attic-floor'
    if name=='Garage slab':return 'structure-garage'
    group=hallway_atlas_group(group,name)
    if group=='structure-hall' and re.search(r'\b(stair|flight|landing|stringer)\b',name,re.I):return 'structure-stairs'
    return group

def hallway_atlas_group(group, name):
    """Reserve a separate atlas for small hallway joinery, away from walls/floors."""
    if group in {'structure-hall', 'hall-trim'} and name.startswith('Finish / '):
        if any(word in name.lower() for word in (' casing', ' head', ' threshold', 'skirting', ' jamb', ' rail', ' sill', ' mullion', 'hatch liner')):
            return 'hall-trim'
    return group

def structural_group(name, kind, points):
    if name.startswith('Cellar slab underside / '):return 'basement-slab-ceilings'
    if name.startswith('Attic slab upper / '):return 'attic-floor'
    if name=='Garage slab':return 'structure-garage'
    lo = tuple(min(p[i] for p in points) for i in range(3))
    hi = tuple(max(p[i] for p in points) for i in range(3))
    center = tuple((a + b) / 2 for a, b in zip(lo, hi))
    if kind == 'site':
        return 'structure-exterior'
    if center[2] > 2.75:
        return 'structure-attic'
    if re.match(r'^Finish / [Ss]tair(?: |$)',name):return 'structure-stairs'
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
