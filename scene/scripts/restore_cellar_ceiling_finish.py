"""Restore the original cellar slab finish in both editable source models."""
import bpy,json,sys,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from house_finishes import restore_cellar_slab_finish
R=Path(__file__).resolve().parents[2];out=R/'scene/renders/lighting-match/model-backup';out.mkdir(parents=True,exist_ok=True)
report=[]
for name in ['house-plan-preview','house-release']:
 path=R/'scene'/(name+'.blend')
 if not (out/path.name).exists():shutil.copy2(path,out/path.name)
 bpy.ops.wm.open_mainfile(filepath=str(path));changed=restore_cellar_slab_finish(bpy.context.scene)
 assert len(changed) in {0,8},(name,changed)
 assert not restore_cellar_slab_finish(bpy.context.scene),'Repair must be idempotent'
 bpy.ops.wm.save_as_mainfile(filepath=str(path));report.append({'model':name,'restoredOakSlabs':changed})
(out.parent/'model-repair.json').write_text(json.dumps(report,indent=2)+'\n')
print('CELLAR_SLAB_FINISH_RESTORED',json.dumps(report),flush=True)
