"""Apply finish edits to both saved assemblies and export without a lighting bake."""
import bpy,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from house_finishes import apply_house_finishes
from workshop_seating import SPEC as WORKSHOP_SEATING
for filename in ['house-plan-preview.blend','house-release.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'scene'/filename));scene=bpy.context.scene
 apply_house_finishes(scene);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene'/filename),compress=True)
 if filename=='house-release.blend':
  for room in ['structure','workshop','basement']:
   bpy.ops.object.select_all(action='DESELECT')
   for o in scene.objects:
    if o.get('release_room')==room and o.type=='MESH':o.hide_set(False);o.select_set(True)
   bpy.ops.export_scene.gltf(filepath=str(ROOT/f'scene/exports/house-release/{room}.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
  layout_path=ROOT/'scene/exports/house-release/layout.json'
  layout=json.loads(layout_path.read_text());layout['views']['workshop']=WORKSHOP_SEATING['view'];layout['routes']['workshop'][-1]=WORKSHOP_SEATING['view']['position'];layout_path.write_text(json.dumps(layout,indent=2)+'\n')
 print('SAVED_HOUSE_FINISHES',filename,flush=True)
