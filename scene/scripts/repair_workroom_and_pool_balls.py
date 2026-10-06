"""Remove the PR2 shirt in both saved house scenes.
Basement refitting lives in refit_saved_basement.py. Existing textures and lighting remain; this runs no render or bake.
"""
import bpy,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
shirt=re.compile(r'^(Printed worn T-shirt|PR2 cartridge screenprint|T-shirt collar)')
for filename in ['house-release.blend']:
 path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path))
 removed=[]
 for obj in list(bpy.context.scene.objects):
  room=obj.get('source_room');name=obj.get('source_object',obj.name)
  if room=='workshop' and shirt.match(name):
   removed.append(name);bpy.data.objects.remove(obj,do_unlink=True)
 bpy.context.view_layer.update()
 if removed:bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('WORKROOM SHIRT REMOVAL',filename,removed,flush=True)
