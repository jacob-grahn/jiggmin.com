"""Persist joinery clearance in the editable house model."""
import bpy,sys,json,shutil,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from house_frame_geometry import repair_frame_geometry
R=Path(__file__).resolve().parents[2];run=Path(os.environ.get('FRAME_REPAIR_OUTPUT',str(R/'scene/renders/frame-flicker')));out=run/'source-backup';out.mkdir(parents=True,exist_ok=True);report=[]
for name in ['house-release']:
 path=R/'scene'/(name+'.blend')
 if not (out/path.name).exists():shutil.copy2(path,out/path.name)
 bpy.ops.wm.open_mainfile(filepath=str(path));changed=repair_frame_geometry(bpy.context.scene)
 assert changed,'No frames repaired'
 assert not repair_frame_geometry(bpy.context.scene),'Repair must be idempotent'
 bpy.ops.wm.save_as_mainfile(filepath=str(path));report.append({'model':name,'changed':changed})
(run/'source-repair.json').write_text(json.dumps(report,indent=2)+'\n');print('FRAME_GEOMETRY_REPAIRED',[(r['model'],len(r['changed'])) for r in report],flush=True)
