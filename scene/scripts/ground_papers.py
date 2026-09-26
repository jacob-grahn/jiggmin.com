"""Place loose sketches and their pencil fully on the credenza beside the mug."""
import bpy
from pathlib import Path
R=Path(__file__).resolve().parents[2]
for obj in bpy.context.scene.objects:
    if obj.name.startswith('Loose game sketches'):
        obj.location.x=1.18
        obj.location.y=.10
    elif obj.name.startswith('Pencil on cabinet'):
        obj.location.x=-.24
        obj.location.y=.64
bpy.ops.wm.save_as_mainfile(filepath=str(R/'scene/midnight-den-detailed.blend'))
exec(compile((R/'scene/scripts/export_detailed_room.py').read_text(),str(R/'scene/scripts/export_detailed_room.py'),'exec'))
