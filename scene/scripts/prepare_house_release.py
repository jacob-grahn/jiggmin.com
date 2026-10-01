"""Prepare the approved saved house for production without changing the preview.
Run with Blender opening house-plan-preview.blend. Outputs a separate native source
and lossless per-room GLBs; bake_house_release.py consumes the same native source.
"""
import bpy,sys,json,re,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from export_house_preview import preview_material,runtime
from house_finishes import apply_house_finishes
from house_trim import assert_unique_trim
S=bpy.context.scene
bpy.context.view_layer.update();assert_unique_trim(S.objects)
OUT=ROOT/'scene/exports/house-release';OUT.mkdir(parents=True,exist_ok=True)
originals=list(S.objects);restored={};failures=[]
# Restore original materials and inherited semantic tags on the staged contents.
for room in ['hallway','workshop','basement','attic']:
 from basement_model_refit import import_source
 loaded=import_source(ROOT/f'scene/exports/house/{room}.glb')
 # Importer suffixes are not identities: the preview already owns many of
 # these names. Match the unchanged mesh geometry at its authored staging pose.
 transforms={'workshop':((0,0,0),(1,1,1),0),'basement':((6,-3.06,-4),(1,1,1),0),'attic':((0,0,0),(1,1,1),0),'hallway':((0,0,0),(1,1,1),0)}
 t,scale,angle=transforms[room];transform=Matrix.Translation(Vector(t))@Matrix.Rotation(angle,4,'Z')@Matrix.Diagonal((*scale,1))
 bpy.context.view_layer.update()
 if room in ['hallway','workshop','attic']:
  from room_model_refit import refit_room
  refit_room(loaded,room);transform=Matrix.Identity(4);bpy.context.view_layer.update()
 if room=='basement':
  from basement_model_refit import refit
  for o in loaded:o['source_object']=o.get('source_object',o.name)
  refit(loaded,translation=False);bpy.context.view_layer.update()
 def bounds(o,m):
  pts=[m@Vector(v) for v in o.bound_box]
  lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
  return (lo+hi)/2,hi-lo
 def identity(o):
  # Same imported local mesh, before the preview's nonuniform staging transform.
  v=o.data.vertices;step=max(1,len(v)//32)
  return (len(v),len(o.data.polygons),tuple(round(c,5) for vertex in list(v)[::step] for c in vertex.co))
 def family(name):return re.sub(r'\.\d{3}$','',name).replace('_',' ')
 candidates=[(q,*bounds(q,transform@q.matrix_world),identity(q)) for q in loaded if q.type=='MESH'];used=set();count=0
 for o in originals:
  if o.get('source_room')!=room:continue
  if o.get('preview_fitted_runner'):
   count+=1;continue # Imported directly with its original weave and materials.
  center,size=bounds(o,o.matrix_world)
  if o.get('preview_hall_refit') and not o.get('model_refit'):center.x+=1
  fingerprint=identity(o)
  scores=[((center-c).length+(size-d).length,q) for q,c,d,f in candidates if q not in used and (f==fingerprint or (o.get('model_refit') and q.get('source_object')==o.get('source_object'))) and family(q.get('source_object',q.name))==family(o.get('source_object',o.name))]
  scores.sort(key=lambda pair:pair[0])
  if not scores or scores[0][0]>2.01:
   failures.append({'room':room,'object':o.name,'nearest':scores[0][0] if scores else None});continue
  source=scores[0][1];used.add(source)
  o.data.materials.clear()
  for m in source.data.materials:o.data.materials.append(m)
  if o.type=='MESH' and source.type=='MESH' and len(o.data.polygons)==len(source.data.polygons):
   for p,q in zip(o.data.polygons,source.data.polygons):p.material_index=q.material_index
  chain=[];p=source
  while p:chain.append(p);p=p.parent
  for p in reversed(chain):
   for key in ['hotspot','prop_assembly','prop_mode','physics_shape','surface_finish']:
    if key in p:o[key]=p[key]
  count+=1
 restored[room]=count
 for o in loaded:bpy.data.objects.remove(o,do_unlink=True)
if failures:raise RuntimeError('Missing original materials: '+json.dumps(failures))
# Keep source artwork; replace unsupported native illustrated graphs for glTF.
pbr={}
for o in originals:
 if o.get('source_room')=='den' and hasattr(o.data,'materials'):
  for i,m in enumerate(o.data.materials):
   if m.name not in pbr:pbr[m.name]=preview_material(m)
   o.data.materials[i]=pbr[m.name]
# Shell paint and timber are real materials; the preview palette is not an export material.
palette={'wall':(.061,.1,.093,1),'floor':(.067,.029,.013,1),'wood':(.067,.029,.013,1),'door':(.067,.029,.013,1),'roof':(.25,.18,.11,1),'ground':(.10,.16,.085,1),'trees':(.035,.09,.045,1),'proxy':(.32,.22,.12,1)}
for m in list(bpy.data.materials):
 if m.name.startswith('Preview / '):
  c=palette.get(m.name.split(' / ')[-1],tuple(m.diffuse_color));m.use_nodes=True
  p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.9;m.diffuse_color=c
apply_house_finishes(S)
originals=list(S.objects)
# Assign shared architecture independently of props; every piece remains in the
# assembled scene for occlusion while per-room contents can be loaded on demand.
meshes=[]
for o in originals:
 if not o.get('preview_kind') or o.type not in {'MESH','CURVE','FONT'}:continue
 o.hide_set(False);o.hide_render=False
 o['release_room']=o.get('source_room','structure')
 if not o.get('source_room') and not o.get('workshop_plywood'):o['bake_connection']=True
 if o.get('preview_kind')=='window' and 'glass' not in o.name.lower():
  o['house_window_receiver']=True;o['release_dynamic']=False
 elif o.get('preview_kind') in ['fixture','site']:
  o['house_fixed_receiver']=True;o['release_dynamic']=False
 elif o.get('preview_kind') in ['door','ladder','window']:o['release_dynamic']=True
 # Preserve individual names/ownership rather than merging interactive meshes.
 meshes.append(o)
print('RESTORED',restored,'Converting',len(meshes),flush=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')
print('CONVERTED',flush=True)
meta=json.loads((ROOT/'scene/preview/generated/preview.json').read_text());meta['version']=2;meta['materials_restored']=restored
meta['assets']={room:f'/web/assets/house/release/{room}.glb' for room in ['structure','den','hallway','workshop','basement','attic']}
meta.pop('export',None)
(OUT/'layout.json').write_text(json.dumps(meta,indent=2)+'\n')
for room in meta['assets']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:
  if o['release_room']==room:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{room}.glb'),use_selection=True,export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
S['release_materials_restored']=json.dumps(restored)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene/house-release.blend'),compress=True)
print('HOUSE_RELEASE_PREPARED',restored,flush=True)
