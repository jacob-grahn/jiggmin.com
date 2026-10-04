"""Fail before baking when reflectance could sample a previous lighting atlas."""
import math


def material_uses_uv(material):
    """Inspect only shader nodes reachable from a material output."""
    if not material or not material.use_nodes:
        return False
    visited = set()

    def coordinates_need_uv(node):
        if node.type == 'UVMAP':
            return True
        for socket in node.inputs:
            for link in socket.links:
                if link.from_node.type == 'TEX_COORD':
                    if link.from_socket.name == 'UV':
                        return True
                elif coordinates_need_uv(link.from_node):
                    return True
        return False

    def visit(node):
        if node in visited:
            return False
        visited.add(node)
        if node.type == 'UVMAP':
            return True
        if any(link.from_node.type == 'TEX_COORD' and link.from_socket.name == 'UV'
               for socket in node.inputs for link in socket.links):
            return True
        if node.type == 'TEX_IMAGE':
            vector = node.inputs['Vector']
            if not vector.is_linked or coordinates_need_uv(node):
                return True
        return any(visit(link.from_node) for socket in node.inputs for link in socket.links)

    return any(visit(node) for node in material.node_tree.nodes if node.type == 'OUTPUT_MATERIAL')


def validate_receivers(records):
    """Pure validation shared by Blender preflight and small regression fixtures."""
    errors = []
    for record in records:
        if not record['uses_uv']:
            continue
        name = record['name']
        if record['provenance'] not in ('restored', 'authored'):
            errors.append(f'{name}: material UVs were not restored or explicitly authored (may be old lighting UVs)')
        faces = record['faces']
        if not faces:
            errors.append(f'{name}: missing material UV layer')
            continue
        for index, face in enumerate(faces):
            if not all(math.isfinite(value) for uv in face for value in uv):
                errors.append(f'{name}: non-finite material UVs on face {index}')
                break
            area = abs(sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(face, face[1:]+face[:1])))
            if area <= 1e-12:
                errors.append(f'{name}: collapsed material UVs on face {index}')
                break
    if errors:
        raise RuntimeError('Unsafe bake material coordinates:\n' + '\n'.join(errors))


def validate_objects(objects, provenance):
    records = []
    for obj in objects:
        mesh = obj.data
        layer = mesh.uv_layers.active
        uv_slots = {i for i, material in enumerate(mesh.materials) if material_uses_uv(material)}
        # Validate tessellated faces: a quad can have nonzero total UV area
        # while one of its rendered triangles is collapsed.
        mesh.calc_loop_triangles()
        triangles = [t for t in mesh.loop_triangles if t.material_index in uv_slots and t.area > 1e-8]
        faces = [list(tuple(layer.data[i].uv) for i in triangle.loops)
                 for triangle in triangles] if layer else []
        records.append(dict(name=obj.get('house_bake_source', obj.name), uses_uv=bool(triangles),
                            provenance=provenance.get(obj), faces=faces))
    validate_receivers(records)
