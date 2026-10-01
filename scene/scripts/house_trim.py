"""Each shared wall has one finishing-pass owner. Never repair duplicates on export."""
TRIM_WALLS_BY_STAGE = {
    2: ('Proposed wall 04', 'Proposed wall 10', 'Proposed wall 11', 'Proposed wall 02', 'Proposed wall 03'),
    3: ('Proposed wall 07', 'Proposed wall 09', 'Proposed wall 12'),
    6: ('Proposed wall 01', 'Proposed wall 08'),
    7: ('Proposed wall 05', 'Proposed wall 00'),
}

def trim_walls_for_stage(stage):
    names = [name for walls in TRIM_WALLS_BY_STAGE.values() for name in walls]
    if len(names) != len(set(names)):
        raise ValueError('A shared wall has multiple trim owners')
    return TRIM_WALLS_BY_STAGE.get(stage, ())

def trim_signature(obj):
    if obj.type != 'MESH' or not obj.name.startswith('Finish / '):
        return None
    if not any(label in obj.name for label in ('skirting', 'ceiling moulding')):
        return None
    vertices = {tuple(round(c * 10000) for c in obj.matrix_world @ v.co) for v in obj.data.vertices}
    triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return tuple(sorted(vertices)) if len(vertices) == 8 and triangles == 12 else None

def assert_unique_trim(objects):
    seen = {}
    for obj in objects:
        key = trim_signature(obj)
        if key is None:
            continue
        if key in seen:
            raise ValueError(f'Duplicate trim: {obj.name} overlaps {seen[key]}; fix the authoring scene')
        seen[key] = obj.name
