"""One seated workshop camera and a tall wooden chair. No lighting bake."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
SPEC=json.loads((ROOT/'scene/workshop-seating.json').read_text())
native=lambda p:Vector((p[0],-p[2],p[1]))

def apply_workshop_seating(scene):
 view=SPEC['view']
 for obj in scene.objects:
  if obj.get('view_id')=='workshop':
   obj.location=native(view['position']);obj.rotation_euler=(native(view['target'])-obj.location).to_track_quat('-Z','Y').to_euler()
   obj.data.sensor_fit='VERTICAL';obj.data.sensor_height=24;obj.data.lens=12/math.tan(math.radians(view['fov']/2));obj['preview_fov']=view['fov']
  if obj.get('route_id')=='workshop':
   spline=obj.data.splines[0];spline.points[-1].co=(*native(view['position']),1)
 for obj in list(scene.objects):
  if obj.get('workshop_chair'):bpy.data.objects.remove(obj,do_unlink=True)
 collection=bpy.data.collections.get('01 shell') or scene.collection
 # Use the original house timber palette; illustrations are retained at export.
 material=bpy.data.materials.get('Workshop chair / wood') or bpy.data.materials.new('Workshop chair / wood')
 material.use_nodes=True;material.diffuse_color=(.067,.029,.013,1)
 p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=material.diffuse_color;p.inputs['Roughness'].default_value=.9
 c=SPEC['chair'];x,z=c['center_xz'];seat=c['seat_y'];floor=c['floor_y']
 placement=Matrix.Translation(native((x,0,z)))@Matrix.Rotation(-c['yaw'],4,'Z')
 def box(label,position,size,bevel=.008):
  bpy.ops.mesh.primitive_cube_add(size=1)
  obj=bpy.context.object;obj.name='Workshop tall chair / '+label
  obj.location=native(position);obj.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  if bevel:
   mod=obj.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
  obj.matrix_world=placement@obj.matrix_world
  for old in list(obj.users_collection):old.objects.unlink(obj)
  collection.objects.link(obj);obj.data.materials.append(material);obj['workshop_chair']=True;obj['preview_kind']='contents';obj['release_room']='structure';obj['bake_connection']=True
  return obj
 def beam(label,a,b,width=.045):
  mid=(Vector(a)+Vector(b))/2;direction=Vector(b)-Vector(a)
  obj=box(label,mid,(width,direction.length,width),.005)
  obj.matrix_world=placement@Matrix.Translation(native(mid))@native(direction).to_track_quat('Z','Y').to_matrix().to_4x4()
  return obj
 box('seat',(0,seat,0),(.56,.07,.52),.022)
 for side in [-1,1]:
  for end in [-1,1]:beam(f'leg {side} {end}',(side*.29,floor+.025,end*.28),(side*.22,seat-.045,end*.20),.05)
  beam(f'side stretcher {side}',(side*.265,.22,-.26),(side*.265,.22,.26),.035)
  beam(f'back upright {side}',(side*.22,seat,.22),(side*.22,1.25,.26),.038)
 beam('front footrest',(-.265,.24,-.26),(.265,.24,-.26),.04)
 beam('rear stretcher',(-.265,.22,.26),(.265,.22,.26),.035)
 box('backrest',(0,1.22,.26),(.52,.13,.06),.018)
 bpy.context.view_layer.update()
