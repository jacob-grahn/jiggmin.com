"""Finish the cellar flight opening and uniform den text conversion. No bake."""
import bpy,sys,json
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from house_preview_spec import build_spec
for filename in ['house-plan-preview.blend','house-release.blend']:
 path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
 for obj in list(scene.objects):
  if 'stair side enclosure' in obj.name and not obj.get('open_lower_stair'):
   m=obj.matrix_world.copy();obj.data=obj.data.copy();obj.data.transform(m.inverted()@Matrix.Diagonal((1,1,.35,1))@m);obj['open_lower_stair']=True
 text_objects=[o for o in scene.objects if o.get('source_room')=='den' and o.type in {'FONT','CURVE'} and o.get('model_refit')]
 if text_objects:
  bpy.ops.object.select_all(action='DESELECT')
  for obj in text_objects:obj.hide_set(False);obj.select_set(True)
  bpy.context.view_layer.objects.active=text_objects[0];bpy.ops.object.convert(target='MESH')
  for obj in text_objects:obj.data.transform(Matrix.Scale(.55,4));obj['den_geometry_units']=True
 route=scene.objects.get('Route / basement');points=build_spec()['routes']['basement']
 if route:
  route.data.splines.clear();sp=route.data.splines.new('POLY');sp.points.add(len(points)-1)
  for point,p in zip(sp.points,points):point.co=(p[0],-p[2],p[1],1)
 bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 if filename=='house-release.blend':
  for room in ['structure','den']:
   bpy.ops.object.select_all(action='DESELECT')
   for obj in scene.objects:
    if obj.get('release_room')==room and obj.type=='MESH':obj.hide_set(False);obj.select_set(True)
   bpy.ops.export_scene.gltf(filepath=str(ROOT/f'scene/exports/house-release/{room}.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
 print('ROOM REFIT FINALIZED',filename,flush=True)
