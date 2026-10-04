"""Small Blender integration checks for source-UV repairs and seam restoration."""
import bpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from house_source_uv import restore_source_uv,author_source_uv,bind_source_uv
from house_bake_uv_guard import validate_objects
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2)
source=bpy.context.object;source.name='Source cube'
material=bpy.data.materials.new('Textured paint');material.use_nodes=True
image=material.node_tree.nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.new('Fixture',2,2)
shader=material.node_tree.nodes.get('Principled BSDF');material.node_tree.links.new(image.outputs['Color'],shader.inputs['Base Color'])
normal=material.node_tree.nodes.new('ShaderNodeNormalMap');material.node_tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])
source.data.materials.append(material)
layer=source.data.uv_layers.active
expected={}
for face in source.data.polygons:
 for li in face.loop_indices:
  layer.data[li].uv.x+=face.index*2
  expected[(tuple(face.normal),tuple(source.data.vertices[source.data.loops[li].vertex_index].co))]=tuple(layer.data[li].uv)
source.data.calc_loop_triangles();vertices=[];faces=[]
for triangle in reversed(list(source.data.loop_triangles)):
 start=len(vertices);vertices.extend(tuple(source.data.vertices[v].co)for v in triangle.vertices);faces.append(tuple(range(start,start+3)))
mesh=bpy.data.meshes.new('Reordered triangles');mesh.from_pydata(vertices,[],faces);mesh.update();mesh.materials.append(material)
receiver=bpy.data.objects.new('Generic receiver',mesh);bpy.context.collection.objects.link(receiver)
restore_source_uv(receiver,source)
for face in receiver.data.polygons:
 for li in face.loop_indices:
  key=(tuple(face.normal),tuple(mesh.vertices[mesh.loops[li].vertex_index].co))
  actual=tuple(mesh.uv_layers.active.data[li].uv)
  assert max(abs(a-b)for a,b in zip(actual,expected[key]))<1e-5,(key,actual,expected[key])
bind_source_uv(material);assert normal.uv_map=='Source UV'
# A full-sized face with collapsed coordinates must fail, then be repaired.
for entry in receiver.data.uv_layers.active.data:entry.uv=(0,0)
try:validate_objects([receiver],{receiver:'restored'})
except RuntimeError:pass
else:raise AssertionError('Collapsed reflectance UVs were accepted')
assert author_source_uv(receiver)==len(mesh.polygons)
validate_objects([receiver],{receiver:'authored'})
print('HOUSE_SOURCE_UV_CHECKS_OK',flush=True)
# Coplanar triangles may have deliberate UV seams, including different UVs at
# the same corner. Restoration must choose an island by face, not by vertex.
verts=[(0,0,0),(1,0,0),(1,1,0),(0,1,0)]
mesh=bpy.data.meshes.new('Seamed source');mesh.from_pydata(verts,[],[(0,1,2),(0,2,3)]);mesh.update();mesh.materials.append(material)
seamed=bpy.data.objects.new('Seamed source',mesh);bpy.context.collection.objects.link(seamed)
uv=mesh.uv_layers.new(name='Source UV')
for face in mesh.polygons:
 for li,value in zip(face.loop_indices,[(0,0),(1,0),(1,1)]):uv.data[li].uv=value
copy=bpy.data.objects.new('Seamed receiver',mesh.copy());bpy.context.collection.objects.link(copy)
restore_source_uv(copy,seamed)
for a,b in zip(mesh.uv_layers.active.data,copy.data.uv_layers.active.data):assert (a.uv-b.uv).length<1e-5
print('HOUSE_COPLANAR_SEAM_CHECK_OK',flush=True)

# World-projected floors and painted undersides can share one source mesh.
# Coordinate repair must preserve the different materials on those faces.
cream=bpy.data.materials.new('Fixture ceiling paint');cream.use_nodes=True
source.data.materials.append(cream)
for face in source.data.polygons:
 face.material_index=1 if face.normal.z<-.9 else 0
for entry in source.data.uv_layers.active.data:entry.uv=(0,0)
author_source_uv(source);assert source['source_uv_world_projection']
receiver.data.materials.append(cream)
restore_source_uv(receiver,source,restore_slots=True)
for face in receiver.data.polygons:assert face.material_index==(1 if face.normal.z<-.9 else 0)
print('HOUSE_SOURCE_MATERIAL_CHECK_OK',flush=True)

# Ground-floor undersides are the visible cellar ceiling. The generator must
# paint them while retaining the authored finish on the upper floor faces.
from house_finishes import paint_ceiling_undersides
source.name='Main floor'
for face in source.data.polygons:face.material_index=0
paint_ceiling_undersides(bpy.context.scene)
for face in source.data.polygons:
 expected_paint=face.normal.z<-.5
 assert (source.data.materials[face.material_index].name=='Light cream ceiling')==expected_paint
receiver.data.materials.clear()
for material in source.data.materials:receiver.data.materials.append(material)
restore_source_uv(receiver,source,restore_slots=True)
for face in receiver.data.polygons:
 assert (receiver.data.materials[face.material_index].name=='Light cream ceiling')==(face.normal.z<-.5)
print('HOUSE_CELLAR_CEILING_FINISH_CHECK_OK',flush=True)
