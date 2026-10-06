"""Export the canonical house-release.blend to lossless per-room GLBs.
The saved source is never overwritten by this export.
"""
import bpy,sys,json,math,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from export_house_preview import runtime
from house_trim import assert_unique_trim
S=bpy.context.scene
bpy.context.view_layer.update();assert_unique_trim(S.objects)
OUT=Path(os.environ.get('HOUSE_RELEASE_EXPORT_DIR',str(ROOT/'scene/exports/house-release')));OUT.mkdir(parents=True,exist_ok=True)
# The saved production house is the editable source of truth. Export its
# authored geometry and materials without reconstructing them from room seeds.
originals=list(S.objects)
# Assign shared architecture independently of props; every piece remains in the
# assembled scene for occlusion while per-room contents can be loaded on demand.
meshes=[]
for o in originals:
 if not o.get('preview_kind') or o.type not in {'MESH','CURVE','FONT'}:continue
 o.hide_set(False);o.hide_render=False
 o['release_room']=o.get('release_room',o.get('source_room','structure'))
 if not o.get('source_room') and not o.get('workshop_plywood'):o['bake_connection']=True
 if o.get('preview_kind')=='window' and 'glass' not in o.name.lower():
  o['house_window_receiver']=True;o['release_dynamic']=False
 elif o.get('preview_kind') in ['fixture','site']:
  o['house_fixed_receiver']=True;o['release_dynamic']=False
 elif o.get('preview_kind') in ['door','ladder','window']:o['release_dynamic']=True
 # Preserve individual names/ownership rather than merging interactive meshes.
 meshes.append(o)
print('Exporting canonical house; converting',len(meshes),flush=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')
print('CONVERTED',flush=True)
metadata=ROOT/'scene/preview/generated/preview.json'
meta=json.loads(metadata.read_text()) if metadata.exists() else {'views':{},'routes':{},'hub_targets':{},'fov':50,'aspect':1.6}
meta['version']=2;meta['materials_restored']=json.loads(S.get('release_materials_restored','{}'))
# Derive camera edits and routes from the saved source, not stale preview JSON.
meta.update(views={},routes={},hub_targets={})
for o in S.objects:
 if 'view_id' in o:
  m=o.matrix_world;meta['views'][o['view_id']]={'position':runtime(m.translation),'target':runtime(m.translation+m.to_quaternion()@Vector((0,0,-5))),'fov':math.degrees(o.data.angle_y)}
 if 'route_id' in o:
  sp=o.data.splines[0];points=sp.bezier_points if sp.type=='BEZIER' else sp.points
  meta['routes'][o['route_id']]=[runtime(o.matrix_world@Vector(p.co[:3])) for p in points]
 if 'target_id' in o:meta['hub_targets'][o['target_id']]=runtime(o.matrix_world.translation)
meta['assets']={room:f'/web/assets/house/release/{room}.glb' for room in ['structure','den','hallway','workshop','basement','attic']}
meta.pop('export',None)
(OUT/'layout.json').write_text(json.dumps(meta,indent=2)+'\n')
for room in meta['assets']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:
  if o['release_room']==room:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{room}.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
print('HOUSE_RELEASE_PREPARED',len(meshes),'objects',flush=True)
