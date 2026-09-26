"""Export wide lighting plates and separately reactive, rest-projected props."""
import bpy,json,re,math
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[2]; S=bpy.context.scene
OUT=R/'scene/renders/detailed-export';OUT.mkdir(parents=True,exist_ok=True)
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
(OUT/'colliders.json').write_text(json.dumps(colliders,indent=2))

deps=bpy.context.evaluated_depsgraph_get();static=[];screen=None;props={};sources=[]
mat=bpy.data.materials.new('Web • projected Cycles lighting');mat.diffuse_color=(.4,.4,.4,1)
for o in list(S.objects):
 if o in dynamic or o.hide_render or o.type not in {'MESH','CURVE','FONT','SURFACE'}:continue
 evaluated=o.evaluated_get(deps)
 mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=False,depsgraph=deps)
 if not mesh.polygons:continue
 obj=bpy.data.objects.new('WEB • '+o.name,mesh);S.collection.objects.link(obj);obj.matrix_world=o.matrix_world.copy()
 mesh.materials.clear();mesh.materials.append(mat)
 for poly in mesh.polygons:poly.material_index=0
 for uv in list(mesh.uv_layers):mesh.uv_layers.remove(uv)
 if o.get('role')=='ruffle_screen':screen=obj;obj['role']='crt_depth_surface'
 elif o.get('reactive'):
  props.setdefault(o['reactive'],[]).append(obj);sources.append(o)
 else:static.append(obj)
def join(objects,name,role,pivot=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=name;obj['role']=role
 if pivot:
  world=obj.matrix_world.copy();obj.data.transform(Matrix.Translation(-Vector(pivot))@world);obj.matrix_world=Matrix.Translation(Vector(pivot))
 return obj
room=join(static,'ROOM • expanded detailed den','room_geometry');room['bakeScale']=[1/2.3,1/1.15]
exports=[room,screen]
for key,pieces in props.items():
 pivot={'mug':(1.66,-.03,1.119),'plant':(-1.67,.52,1.111),'lamp':(2.72,.67,1.202)}[key]
 obj=join(pieces,'REACTIVE • '+key,'reactive_prop',pivot);obj['prop']=key;exports.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'room.glb'),use_selection=True,export_format='GLB',export_extras=True,export_yup=True)
for o in exports:o.hide_render=True
# Widen in both axes while leaving the runtime camera and screen anchors unchanged.
S.camera.data.lens/=2.3;S.camera.data.sensor_fit='HORIZONTAL';S.camera.data.dof.use_dof=False
S.render.resolution_x=5120;S.render.resolution_y=1600;S.render.resolution_percentage=100
S.render.engine='CYCLES';S.cycles.samples=24;S.cycles.use_denoising=True
S.render.filepath=str(OUT/'room-props.png')
bpy.ops.render.render(write_still=True)
print('WIDE_PLATE_RENDERED',flush=True)
# Only rerender the area containing the small props. Camera-invisible props keep their
# indirect light and contact shadows, and reveal real furniture behind each silhouette.
from bpy_extras.object_utils import world_to_camera_view
points=[world_to_camera_view(S,S.camera,o.matrix_world@Vector(v)) for o in sources for v in o.bound_box]
S.render.use_border=True;S.render.use_crop_to_border=False
S.render.border_min_x=max(0,min(p.x for p in points)-.025);S.render.border_max_x=min(1,max(p.x for p in points)+.025)
S.render.border_min_y=max(0,min(p.y for p in points)-.025);S.render.border_max_y=min(1,max(p.y for p in points)+.025)
for o in sources:o.visible_camera=False
S.render.filepath=str(OUT/'room-clean-patch.png');bpy.ops.render.render(write_still=True)
(OUT/'border.json').write_text(json.dumps([S.render.border_min_x,S.render.border_min_y,S.render.border_max_x,S.render.border_max_y]))
print('DETAILED_EXPORT_COMPLETE',flush=True)
