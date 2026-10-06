"""Original workshop plywood backing and den infill, without a lighting bake."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from basement_model_refit import import_source
native=lambda v:Vector((v[0],-v[2],v[1]))
PANELS=[('rear','Garage raw rear sheathing',[14.5,1.225,-.13],[4.86,2.75,.06],[14.45,1.625,-.13],[2.3,1.25,.7]),('left','Unfinished side sheathing',[12.07,1.225,3.3],[.06,2.75,7],[12.07,1.075,5.6],[.7,2.15,1]),('right','Unfinished side sheathing',[16.93,1.225,3.3],[.06,2.75,7],[16.93,1.625,2.8],[.7,1.25,1.6])]
def cut(obj,p,size):
 bpy.ops.mesh.primitive_cube_add(size=1,location=native(p));tool=bpy.context.object;tool.dimensions=(size[0],size[2],size[1]);bpy.context.view_layer.update()
 mod=obj.modifiers.new('Plywood opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=tool;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(tool,do_unlink=True)
def add_plywood_and_den_infill(scene):
 for o in list(scene.objects):
  if o.get('workshop_plywood') or o.get('den_metric_infill'):bpy.data.objects.remove(o,do_unlink=True)
 imported=import_source(ROOT/'scene/exports/house/workshop.glb');bpy.context.view_layer.update();collection=bpy.data.collections.get('01 shell') or scene.collection
 for suffix,source_name,p,size,hole,hole_size in PANELS:
  source=next(o for o in imported if o.get('source_object')==source_name);mesh=source.data.copy()
  pts=[source.matrix_world@Vector(v) for v in source.bound_box];lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
  ratio=Vector((size[0],size[2],size[1]));ratio=Vector(tuple(ratio[i]/(hi[i]-lo[i]) for i in range(3)))
  transform=Matrix.Translation(native(p))@Matrix.Diagonal((*ratio,1))@Matrix.Translation(-(lo+hi)/2)@source.matrix_world;mesh.transform(transform)
  obj=bpy.data.objects.new('Workshop plywood '+suffix,mesh);collection.objects.link(obj);obj['preview_kind']='shell';obj['release_room']='structure';obj['workshop_plywood']=True
  cut(obj,hole,hole_size)
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 # The unstretched den is deeper. Extend its actual floor/ceiling into a small
 # west-side bay instead of squeezing the room to the earlier footprint.
 for name,p,size,kind,material_name in [('floor',[-.7,-.1,9.4],[1.4,.2,5.2],'floor','oak'),('ceiling',[-.7,2.7,9.4],[1.4,.2,5.2],'ceiling','Quiet ceiling')]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=native(p));o=bpy.context.object;o.name='Den metric '+name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  material=next((m for m in bpy.data.materials if m.name.split('.')[0]==material_name),None)
  if not material:material=next(m for m in bpy.data.materials if m.name in ['Finish / '+('oak' if kind=='floor' else 'cream'),'Preview / '+('floor' if kind=='floor' else 'wall')])
  o.data.materials.append(material);o['preview_kind']=kind;o['release_room']='structure';o['den_metric_infill']=True

 bpy.context.view_layer.update()

def main():
 for filename in ['house-release.blend']:
  path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
  add_plywood_and_den_infill(scene)
  bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
  if filename=='house-release.blend':
   bpy.ops.object.select_all(action='DESELECT')
   for o in scene.objects:
    if o.get('release_room')=='structure' and o.type=='MESH':o.hide_set(False);o.select_set(True)
   bpy.ops.export_scene.gltf(filepath=str(ROOT/'scene/exports/house-release/structure.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
  print('PLYWOOD AND DEN INFILL',filename,flush=True)

if __name__=='__main__':main()
