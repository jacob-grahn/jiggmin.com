"""Persist white hallway door/hatch frame paint in the editable model sources."""
import bpy,sys,shutil,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from house_finishes import paint_door_frames
R=Path(__file__).resolve().parents[2];backup=R/'scene/renders/white-door-frames/source-backup';backup.mkdir(parents=True,exist_ok=True)
report=[]
for name in ['house-plan-preview','house-release']:
 path=R/'scene'/(name+'.blend')
 if not (backup/path.name).exists():shutil.copy2(path,backup/path.name)
 bpy.ops.wm.open_mainfile(filepath=str(path));painted=paint_door_frames(bpy.context.scene)
 assert painted,'No hallway door frames found'
 bpy.ops.wm.save_as_mainfile(filepath=str(path));report.append({'model':name,'frames':painted})
(R/'scene/renders/white-door-frames/source-report.json').write_text(json.dumps(report,indent=2)+'\n');print('WHITE_DOOR_FRAMES',[(r['model'],len(r['frames']))for r in report],flush=True)
