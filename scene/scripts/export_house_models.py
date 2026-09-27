"""Export authored house geometry, cameras, and world-space interaction anchors.
Run with Blender -b --python scene/scripts/export_house_models.py.
"""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'scene/scripts/build_house_rooms.py').read_text().split('\nargs=sys.argv')[0]
ns={'__file__':str(ROOT/'scene/scripts/build_house_rooms.py')}
exec(compile(source,'build_house_rooms.py','exec'),ns)
manifest={}
finish_report={}
sys.path.insert(0,str(ROOT/'scene/scripts'))
from detail_house_models import finish_house
for room in ['hallway','workshop','attic','basement']:
 # Recreate the same authored scene and keep the semantic anchors before export.
 sys.argv=['export','--','anchors',room]
 exec(compile('\nargs=sys.argv'+(ROOT/'scene/scripts/build_house_rooms.py').read_text().split('\nargs=sys.argv')[1],'build_house_rooms.py','exec'),ns)
 bpy.context.view_layer.update()
 anchors={}
 for key,objects in ns['anchors'].items():
  points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
  lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
  hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
  center=(lo+hi)/2
  anchors[key]={'position':[center.x,center.z,-center.y]}
  for o in objects:o['hotspot']=key
 # Area lights have no glTF representation: export a matching punctual fill.
 for o in list(bpy.data.objects):
  if o.type=='LIGHT' and o.data.type=='AREA':
   o.data.type='POINT';o.data.energy*=.045
 # glTF cannot represent Blender procedural wood; preserve its authored color.
 for material in bpy.data.materials:
  if not material.use_nodes:continue
  shader=material.node_tree.nodes.get('Principled BSDF')
  if not shader:continue
  base=shader.inputs['Base Color']
  if base.is_linked and base.links[0].from_node.type != 'TEX_IMAGE':
   material.node_tree.links.remove(base.links[0]);base.default_value=material.diffuse_color
 # Curves and lettering are real geometry too.
 for o in list(bpy.context.scene.objects):
  if o.type in {'CURVE','FONT'}:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.convert(target='MESH')
 finish_report[room]=finish_house(room)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/f'web/assets/house/{room}.glb'),export_format='GLB',export_cameras=True,export_lights=True,export_extras=True,export_apply=True,export_image_format='JPEG',export_jpeg_quality=85)
 manifest[room]=anchors
 print('EXPORTED',room,flush=True)
(ROOT/'web/assets/house/anchors.json').write_text(json.dumps(manifest,indent=2)+'\n')

(ROOT/'web/assets/house/surface-finish.json').write_text(json.dumps(finish_report,indent=2)+'\n')
