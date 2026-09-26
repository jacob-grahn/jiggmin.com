"""Export the controller with evaluated bevels and its original materials."""
import bpy
from pathlib import Path
R=Path(__file__).resolve().parents[2];S=bpy.context.scene
controllers=[o for o in S.objects if o.get('role')=='mobile_controller']
assert len(controllers)==1, 'Expected one controller'
bpy.ops.object.select_all(action='DESELECT')
for o in [controllers[0],*controllers[0].children_recursive]:o.select_set(True)
bpy.context.view_layer.objects.active=controllers[0]
bpy.ops.export_scene.gltf(filepath=str(R/'web/assets/controller.glb'),use_selection=True,export_format='GLB',export_extras=True,export_yup=True,export_apply=True)
print('CONTROLLER_EXPORTED', len(controllers[0].children_recursive), 'parts',flush=True)
