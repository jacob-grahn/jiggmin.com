"""Export real room geometry with a fixed-camera Cycles lighting projection.
The browser uses the mesh depth for occlusion and the recorded solid volumes for physics.
The original Blender file is never modified.
"""
import bpy,json,re
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];S=bpy.context.scene
exec(compile((R/'scene/scripts/export_controller.py').read_text(),'export_controller.py','exec'))
roots=[o for o in S.objects if o.get('role') in {'draggable_cartridge','mobile_controller','controller_cable'}]
dynamic={o for root in roots for o in [root,*root.children_recursive]}
for o in dynamic:o.hide_render=True
# Solid collision proxies retain object orientation; small decorative detail is omitted.
colliders=[]
patterns=r'^(Back wall|Left wall|Baseboard|Window sill|Credenza|Cabinet|Coffee table|Lamp side table|Lamp table leg|Tapered cabinet foot|CRT deep rear|CRT rounded front|CRT foot|Console main case|Console bottom plinth|Console upper lid|Library • (walnut side|dark back|shelf)|Pad • (lower graphite shell|upper warm grey face)|.*[Cc]hair.*|.*[Cc]ushion.*)'
for o in S.objects:
 if o in dynamic or o.hide_render or o.type!='MESH' or not re.search(patterns,o.name):continue
 lo=Vector(tuple(min(v[i] for v in o.bound_box) for i in range(3)));hi=Vector(tuple(max(v[i] for v in o.bound_box) for i in range(3)))
 center=o.matrix_world@((lo+hi)/2);q=o.matrix_world.to_quaternion();size=(hi-lo);scale=o.matrix_world.to_scale()
 # Convert Blender Z-up to glTF Y-up using conjugation by a -90deg X rotation.
 from mathutils import Quaternion
 import math
 convert=Quaternion((1,0,0),-math.pi/2);qr=convert@q@convert.conjugated()
 colliders.append({'name':o.name,'center':[center.x,center.z,-center.y],'halfExtents':[abs(size.x*scale.x)/2,abs(size.z*scale.z)/2,abs(size.y*scale.y)/2],'quaternion':[qr.x,qr.y,qr.z,qr.w]})
colliders.append({'name':'Continuous floor','center':[0,-.08,0],'halfExtents':[5,.08,5],'quaternion':[0,0,0,1]})
(R/'web/assets/colliders.json').write_text(json.dumps(colliders,indent=2))
# Freeze evaluated static surfaces (including bevels, curves and lettering) into one mesh.
deps=bpy.context.evaluated_depsgraph_get();static=[];screen=None
mat=bpy.data.materials.new('Web • projected Cycles lighting');mat.diffuse_color=(.4,.4,.4,1)
for o in list(S.objects):
 if o in dynamic or o.hide_render or o.type not in {'MESH','CURVE','FONT','SURFACE'}:continue
 evaluated=o.evaluated_get(deps)
 mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=False,depsgraph=deps)
 if not mesh.polygons:continue
 obj=bpy.data.objects.new('WEB • '+o.name,mesh);S.collection.objects.link(obj);obj.matrix_world=o.matrix_world.copy()
 mesh.materials.clear();mesh.materials.append(mat)
 for poly in mesh.polygons:poly.material_index=0
 # UV data is unnecessary: lighting is projected per fragment, not interpolated UVs.
 for uv in list(mesh.uv_layers):mesh.uv_layers.remove(uv)
 if o.get('role')=='ruffle_screen':screen=obj;obj['role']='crt_depth_surface'
 else:static.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for o in static:o.select_set(True)
bpy.context.view_layer.objects.active=static[0];bpy.ops.object.join();room=bpy.context.object;room.name='ROOM • real geometry with baked lighting';room['role']='room_geometry'
bpy.ops.object.select_all(action='DESELECT');room.select_set(True);screen.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'web/assets/room.glb'),use_selection=True,export_format='GLB',export_extras=True,export_yup=True)
print('ROOM_EXPORTED',len(room.data.polygons),'polygons;',len(colliders),'solid colliders',flush=True)
# Export copies must not double the scene when rendering the lighting plate.
room.hide_render=True;screen.hide_render=True
S.render.resolution_x=3200;S.render.resolution_y=2000;S.render.resolution_percentage=100
S.camera.data.dof.use_dof=False;S.cycles.samples=64
S.render.filepath=str(R/'scene/renders/room-lighting.png')
bpy.ops.render.render(write_still=True)
print('LIGHTING_RENDERED',flush=True)
