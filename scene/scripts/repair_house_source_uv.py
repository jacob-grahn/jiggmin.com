"""Repair source coordinates in saved models; retain geometry, materials and layout."""
import bpy,json,sys,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from house_source_uv import apply_source_uv
report={}
for name in ['house-release.blend','midnight-den-illustrated.blend','house-hallway.blend','house-workshop.blend','house-basement.blend','house-attic.blend']:
 path=R/'scene'/name;bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.view_layer.update()
 changed=apply_source_uv(bpy.context.scene);report[name]=changed
 if changed:
  backup=path.with_name(path.stem+'-before-source-uv.blend')
  if not backup.exists():shutil.copy2(path,backup)
  bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('SOURCE_UV_REPAIRS',name,len(changed),sum(x['faces'] for x in changed),flush=True)
(R/'scene/renders/house-release/source-uv-repairs.json').write_text(json.dumps(report,indent=2)+'\n')
