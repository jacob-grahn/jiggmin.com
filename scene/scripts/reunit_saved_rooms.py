"""Apply approved prop refits to both saved scenes; export editable release assets.
No image render or lighting bake. The original den and room sources are untouched.
"""
import bpy,sys,json,math,re
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from room_model_refit import SPEC,refit_object,import_source,center
from house_preview_spec import build_spec
for filename in ['house-plan-preview.blend','house-release.blend']:
 path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
 if not scene.get('rooms_rigid_refit'):
  for room in ['hallway','workshop','attic']:
   originals=[o for o in scene.objects if o.get('source_room')==room and o.type=='MESH']
   loaded=import_source(ROOT/f'scene/exports/house/{room}.glb');bpy.context.view_layer.update()
   sources=[o for o in loaded if o.type=='MESH'];lookup={o['source_object']:o for o in sources}
   used=set();spec=SPEC[room]
   # Older imports used Blender collision suffixes as IDs. Recover the source
   # by family, unchanged mesh shape, and its previous authored world pose.
   for obj in originals:
    name=obj.get('source_object',obj.name);family=lambda n:re.sub(r'\.\d{3}$','',n).replace('_',' ')
    candidates=[o for o in sources if o not in used and family(o['source_object'])==family(name)]
    scale=spec['runner_scale'] if obj.get('preview_fitted_runner') else spec['old_scale']
    old=Matrix.Translation(Vector((14.5,-1.31,-.15) if room=='workshop' else spec['translation']))@Matrix.Rotation(spec['yaw'],4,'Z')@Matrix.Diagonal((*scale,1))
    target=center(obj)
    if obj.get('preview_hall_refit'):target.x+=1
    def score(o):
     shape=abs(len(obj.data.vertices)-len(o.data.vertices))+abs(len(obj.data.polygons)-len(o.data.polygons))
     return shape*100+(old@center(o)-target).length
    source=min(candidates,key=score) if candidates else None
    if source is None:raise RuntimeError(f'Missing source: {room}/{name}')
    used.add(source);refit_object(obj,source,sources,room)
   for obj in loaded:bpy.data.objects.remove(obj,do_unlink=True)
  # A uniform metric conversion preserves every den proportion and its camera.
  old=Matrix.Translation((.819,-9.4,0))@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Diagonal((.55,.42,.6,1))
  spec=SPEC['den'];units=spec['units_to_metres'];new=Matrix.Translation(Vector(spec['translation']))@Matrix.Rotation(spec['yaw'],4,'Z')
  poses={o:old.inverted()@o.matrix_world for o in scene.objects if o.get('source_room')=='den'}
  for obj,original in poses.items():
   if hasattr(obj.data,'transform'):obj.data=obj.data.copy();obj.data.transform(Matrix.Scale(units,4))
   original.translation*=units;obj.parent=None;obj.matrix_world=new@original
   obj['model_refit']='den';obj['refit_kind']='uniform-unit-conversion'
  scene['rooms_rigid_refit']=True
 report=json.loads(scene.get('preview_source_report','{}'))
 for room in ['den','hallway','workshop','attic']:
  report.setdefault(room,{})['staging_scale']=[1,1,1];report[room]['model_refit']='Geometry edits and rigid furniture placement' if room!='den' else 'Uniform studio-unit conversion applied to geometry; seated view preserved'
 scene['preview_source_report']=json.dumps(report)
 # Simplify the cellar's final leg; keep the authored view at original eye height.
 route=scene.objects.get('Route / basement');points=build_spec()['routes']['basement'][:8]+[[8.7,-2.35,10.5]]
 if route:
  route.data.splines.clear();sp=route.data.splines.new('POLY');sp.points.add(len(points)-1)
  for point,p in zip(sp.points,points):point.co=(p[0],-p[2],p[1],1)
 for obj in scene.objects:
  if obj.get('view_id')=='den':
   obj.location=(4.137,-9.334,1.65);obj.rotation_euler=(Vector((-.1255,-9.4207,.968))-obj.location).to_track_quat('-Z','Y').to_euler()
 bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 if filename=='house-release.blend':
  for room in ['hallway','workshop','attic','den']:
   bpy.ops.object.select_all(action='DESELECT')
   for obj in scene.objects:
    if obj.get('release_room',obj.get('source_room'))==room and obj.type=='MESH':obj.hide_set(False);obj.select_set(True)
   bpy.ops.export_scene.gltf(filepath=str(ROOT/f'scene/exports/house-release/{room}.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
 print('RIGID ROOM REFIT',filename,flush=True)
