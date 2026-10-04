"""Metre-scale paint coordinates, independent of the lighting atlas layout."""

def is_painted_wall(obj):
    name=obj.get('source_object',obj.get('house_bake_source',obj.name))
    if name.startswith(('Proposed wall','Basement painted masonry')):return True
    return 'wall' in name.lower() and any(m and m.name.startswith(('Corridor paint','Cellar painted plaster')) for m in obj.data.materials)

def restore_wall_uv(obj):
    layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Source UV')
    changed=0
    normal = obj.matrix_world.to_3x3().inverted().transposed()
    for face in obj.data.polygons:
        direction = normal @ face.normal
        axis = max(range(3), key=lambda i: abs(direction[i]))
        axes = [i for i in range(3) if i != axis]
        face_changed=False
        for loop in face.loop_indices:
            point = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
            value=(point[axes[0]],point[axes[1]])
            face_changed=face_changed or any(abs(layer.data[loop].uv[i]-value[i])>1e-6 for i in range(2))
            layer.data[loop].uv=value
        changed+=int(face_changed)
    obj['source_reflectance_uv'] = 'world metres'
    obj['source_uv_world_projection']=True
    return changed

def apply_wall_uv(scene):
    for obj in scene.objects:
        if obj.type == 'MESH' and is_painted_wall(obj):
            obj.data = obj.data.copy()
            restore_wall_uv(obj)
