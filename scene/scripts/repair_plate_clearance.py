"""Complete the previously partial plate/shelf refit in both saved house files.
Uses existing geometry and materials; no render or bake.
"""
import bpy,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
pattern=re.compile(r'^(?:Kindergarten plate|Ceramic plate back|Plate stand|Plate wall shelf|Shelf brass bracket(?:\.001)?|Plain jar\.002|Jar screw lid\.002)$')
for filename in ['house-plan-preview.blend','house-release.blend']:
 path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path))
 moved=[]
 for obj in bpy.context.scene.objects:
  if obj.get('source_room')!='hallway' or obj.get('preview_hall_refit'):continue
  if pattern.fullmatch(obj.get('source_object',obj.name)):
   matrix=obj.matrix_world.copy();matrix.translation.x-=1;obj.matrix_world=matrix
   obj['preview_hall_refit']=True;obj['plate_door_clearance']=True;moved.append(obj.name)
 if moved:bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('PLATE CLEARANCE',filename,moved,flush=True)
