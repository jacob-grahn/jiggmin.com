"""Apply the attic ceiling finish to the editable house model."""
import bpy,sys
from pathlib import Path
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from attic_plywood import apply_attic_plywood
for name in ['house-release']:
 path=R/'scene'/(name+'.blend');bpy.ops.wm.open_mainfile(filepath=str(path))
 changed=apply_attic_plywood(bpy.context.scene)
 assert len(changed)==2,(name,changed)
 bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('ATTIC_PLYWOOD',name,changed,flush=True)
