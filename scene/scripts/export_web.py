"""Export movable cartridge geometry and a matching fixed-camera den backdrop."""
import bpy,json,math
from pathlib import Path
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
R=Path(__file__).resolve().parents[2];S=bpy.context.scene
roots=[o for o in S.objects if o.get('role')=='draggable_cartridge']
selected=[]
for root in roots:selected += [root,*root.children_recursive]
bpy.ops.object.select_all(action='DESELECT')
for o in selected+[S.camera]:o.select_set(True)
bpy.context.view_layer.objects.active=S.camera
bpy.ops.export_scene.gltf(filepath=str(R/'web/assets/cartridges.glb'),use_selection=True,export_format='GLB',export_cameras=True,export_extras=True,export_yup=True)
# Exact screen projected corners for the live HTML player, inset to the CRT glass.
def project(p):
 v=world_to_camera_view(S,S.camera,Vector(p));return [v.x,1-v.y]
meta={'cameraAspect':S.render.resolution_x/S.render.resolution_y,'screen':[project(p) for p in [(-1.095,-.34,2.965),(1.095,-.34,2.965),(1.095,-.34,1.515),(-1.095,-.34,1.515)]],'slot':project((-.13,-1.17,1.04))}
(R/'web/assets/scene.json').write_text(json.dumps(meta,indent=2))
for o in selected:o.hide_render=True
S.cycles.samples=48;S.render.filepath=str(R/'scene/renders/den.png');bpy.ops.render.render(write_still=True)

# Convert den.png to den.webp with Pillow in the system Python after rendering.
