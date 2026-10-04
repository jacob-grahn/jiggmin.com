"""Authored reflectance coordinates and normal bases, shared by all house bakes."""
import math
from house_bake_uv_guard import material_uses_uv, validate_objects


def face_uv_valid(face, layer):
    if layer is None:
        return False
    points = [tuple(layer.data[i].uv) for i in face.loop_indices]
    return (all(math.isfinite(c) for p in points for c in p) and
            abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))) > 1e-12)


def author_source_uv(obj):
    """Preserve valid authored islands; give missing/collapsed faces metre UVs."""
    from house_wall_uv import is_painted_wall,restore_wall_uv
    paint_changes=restore_wall_uv(obj) if is_painted_wall(obj) else 0
    mesh = obj.data
    slots = {i for i,m in enumerate(mesh.materials) if material_uses_uv(m)}
    faces = [p for p in mesh.polygons if p.material_index in slots and p.area > 1e-8]
    if not faces:
        return 0
    layer = mesh.uv_layers.active
    if layer and 'lighting' in layer.name.lower():
        raise RuntimeError('Native reflectance uses lighting UVs: '+obj.name)
    if layer is None:
        layer = mesh.uv_layers.new(name='Source UV')
    mesh.calc_loop_triangles()
    bad_faces=set()
    for triangle in mesh.loop_triangles:
        if triangle.material_index not in slots or triangle.area<=1e-8:continue
        points=[tuple(layer.data[i].uv)for i in triangle.loops]
        area=abs(sum(a[0]*b[1]-b[0]*a[1]for a,b in zip(points,points[1:]+points[:1])))
        if not all(math.isfinite(c)for p in points for c in p) or area<=1e-12:bad_faces.add(triangle.polygon_index)
    repaired = paint_changes
    transform = obj.matrix_world.to_3x3().inverted().transposed()
    for face in faces:
        if face.index not in bad_faces and face_uv_valid(face, layer):
            continue
        normal = transform @ face.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in face.loop_indices:
            point = obj.matrix_world @ mesh.vertices[mesh.loops[li].vertex_index].co
            layer.data[li].uv = (point[axes[0]], point[axes[1]])
        repaired += 1
    obj['source_reflectance_uv'] = 'authored UVs; repaired faces in world metres'
    projected=True
    for face in faces:
        normal=transform@face.normal;axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3)if i!=axis]
        for li in face.loop_indices:
            point=obj.matrix_world@mesh.vertices[mesh.loops[li].vertex_index].co
            if any(abs(layer.data[li].uv[k]-point[a])>1e-5 for k,a in enumerate(axes)):projected=False;break
        if not projected:break
    obj['source_uv_world_projection']=projected
    validate_objects([obj], {obj:'authored'})
    return repaired


def bind_source_uv(material):
    """Keep both image coordinates and tangent-space normal bases off the atlas."""
    if not material or not material.use_nodes:
        return
    nodes, links = material.node_tree.nodes, material.node_tree.links
    for node in list(nodes):
        if node.type == 'UVMAP':
            node.uv_map = 'Source UV'
        elif node.type == 'NORMAL_MAP' and node.space == 'TANGENT':
            node.uv_map = 'Source UV'
        elif node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
            mapping = nodes.new('ShaderNodeUVMap');mapping.uv_map='Source UV'
            links.new(mapping.outputs['UV'],node.inputs['Vector'])
        elif node.type == 'TEX_COORD':
            destinations=[link.to_socket for link in list(node.outputs['UV'].links)]
            if destinations:
                mapping=nodes.new('ShaderNodeUVMap');mapping.uv_map='Source UV'
                for socket in destinations:links.new(mapping.outputs['UV'],socket)


def restore_source_uv(obj, source, restore_slots=False):
    """Match surface normals at UV seams before barycentric interpolation."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    author_source_uv(source)
    source.data.calc_loop_triangles()
    triangles=list(source.data.loop_triangles)
    points=[source.matrix_world@v.co for v in source.data.vertices]
    transform=source.matrix_world.to_3x3().inverted().transposed()
    normals=[(transform@t.normal).normalized() for t in triangles]
    tree=BVHTree.FromPolygons(points,[t.vertices for t in triangles],all_triangles=True)
    source_uv=source.data.uv_layers.active
    layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Source UV')
    layer.name='Source UV'
    if obj.get('house_window_reveal') or source.get('source_uv_world_projection'):
        # Reveals are newly constructed surfaces with different dimensions;
        # they inherit the sill material, not its geometric UV correspondence.
        for entry in layer.data:entry.uv=(0,0)
        if restore_slots:
            for face in obj.data.polygons:
                _,_,index,_=tree.find_nearest(obj.matrix_world@face.center)
                face.material_index=min(triangles[index].material_index,len(obj.data.materials)-1)
        obj['source_uv_projected_faces']=author_source_uv(obj)
        obj['source_uv_mapping']='authored-window-reveal-metres' if obj.get('house_window_reveal') else 'authored-world-metres'
        validate_objects([obj],{obj:'authored'})
        return None
    transform=obj.matrix_world.to_3x3().inverted().transposed()
    def source_point(point):
        # den-opening.js lowers only the exported den floor by 25 mm.
        # Undo that known preparation edit for correspondence, not geometry.
        if obj.get('preview_kind')=='floor' and point.x<4.70 and -12.23<point.y<-6.52 and -.275<point.z<.025:
            point=point.copy();point.z+=.025
        return point
    max_distance=0;max_tangent=0;max_normal=0;distance_cache={}
    for face in obj.data.polygons:
        normal=(transform@face.normal).normalized()
        def nearest(world):
            point,_,index,distance=tree.find_nearest(world)
            if point is None:raise RuntimeError('Missing source surface: '+obj.name)
            # A box corner belongs to three faces. A nearest-only lookup can
            # choose the wrong island and collapse the receiver's UV triangle.
            candidates=tree.find_nearest_range(world,distance+.001)
            aligned=[c for c in candidates if normals[c[2]].dot(normal)>.8]
            if aligned:point,_,index,distance=min(aligned,key=lambda c:c[3])
            return point,index,distance
        _,face_index,_=nearest(source_point(obj.matrix_world@face.center))
        if restore_slots:
            face.material_index=min(triangles[face_index].material_index,len(obj.data.materials)-1)
        for li in face.loop_indices:
            world=source_point(obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co)
            key=tuple(round(c,6)for c in world)
            if key not in distance_cache:
                point,_,_,distance=tree.find_nearest(world);distance_cache[key]=(point,distance)
            point,distance=distance_cache[key];max_distance=max(max_distance,distance)
            delta=world-point;signed=delta.dot(normal)
            max_normal=max(max_normal,abs(signed));max_tangent=max(max_tangent,(delta-normal*signed).length)
            # Keep one source island for the entire receiver polygon. Choosing
            # each corner independently can cross a coplanar UV seam.
            triangle=triangles[face_index]
            if source_uv:
                coords=[Vector((*source_uv.data[i].uv,0)) for i in triangle.loops]
                layer.data[li].uv=barycentric_transform(world,*[points[i] for i in triangle.vertices],*coords).xy
            else:layer.data[li].uv=(0,0) # No UV-dependent material on this source.
    # UVs on planar finishes are unchanged by small normal offsets introduced
    # by wall refitting. Tangential mismatch still rejects the wrong surface.
    obj['source_uv_max_tangent_distance']=max_tangent;obj['source_uv_max_normal_offset']=max_normal
    if max_distance>.01:raise RuntimeError('Source geometry mismatch: '+obj.get('house_bake_source',obj.name)+' from '+source.name+' distance '+str(max_distance))
    # Edited bevel/cut faces can have no nondegenerate source island. Author
    # only those faces in metres; the normal source transfer remains intact.
    obj['source_uv_projected_faces']=author_source_uv(obj)
    validate_objects([obj],{obj:'restored'})
    return max_distance


def apply_source_uv(scene):
    changed=[]
    for obj in scene.objects:
        if obj.type=='MESH':
            count=author_source_uv(obj)
            if count:changed.append({'name':obj.name,'faces':count,'room':obj.get('source_room',obj.get('release_room'))})
    return changed
