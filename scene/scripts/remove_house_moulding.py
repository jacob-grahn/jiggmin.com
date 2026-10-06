"""Remove obsolete crown boards from the editable house models.

Run once with Blender --background --python scene/scripts/remove_house_moulding.py.
The finishing author already creates plain wall-to-ceiling joins. This migrates
saved models made before that change, without filtering geometry during export.
"""
import shutil
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
for filename in ('house-release.blend',):
    path = ROOT / 'scene' / filename
    bpy.ops.wm.open_mainfile(filepath=str(path))
    objects = [o for o in bpy.data.objects
               if o.name.startswith('Finish / ceiling moulding')]
    if not objects:
        print('NO_MOULDING', filename, flush=True)
        continue
    backup = path.with_name(path.stem + '-before-moulding-removal.blend')
    if not backup.exists():
        shutil.copy2(path, backup)
    removed = [o.name for o in objects]
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    assert not any(o.name.startswith('Finish / ceiling moulding')
                   for o in bpy.data.objects)
    print('MODEL_MOULDING_REMOVED', filename, len(removed), removed, flush=True)
