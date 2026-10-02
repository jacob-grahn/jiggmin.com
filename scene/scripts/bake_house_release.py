"""Bake reviewed connective surfaces with the original window-lighting pipeline.
Original den and room atlases stay intact. Never overwrite an editable .blend.
"""
import bpy,json,sys,time,hashlib,re
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from basement_model_refit import import_source,refit
from house_bake_lighting import configure
from house_bake_groups import structural_group
ROOT=Path(__file__).resolve().parents[2];test='--test' in sys.argv
INPUT=ROOT/'scene/exports/house-release/bake-input';OUT=ROOT/('scene/exports/house-release/test' if test else 'scene/exports/house-release/final');OUT.mkdir(parents=True,exist_ok=True)
S=bpy.context.scene;start=time.monotonic();native=list(S.objects)
classification=json.loads((ROOT/'scene/exports/house-release/classification.json').read_text())
canonical=lambda s:''.join(c.lower() for c in s if c.isalnum())
native_by_name={canonical(o.name):o for o in native if o.type=='MESH'}
cream=bpy.data.materials['Light cream ceiling']
for o in native:
 if o.type=='MESH':
  room=o.get('release_room');movable=canonical(o.name) in {canonical(n) for n in classification.get(room,{}).get('movable',[])}
  o.hide_render=room=='structure' or movable or bool(o.get('release_dynamic'))
 # Native ceilings are replaced by the exact reviewed ceiling meshes below.
 if o.type=='MESH' and o.get('release_room')=='basement' and o.get('ceiling_paint'):o.hide_render=True
# Restore cellar reflectance for its frame/reveal bake, plus real opaque wall
# occluders. Its original furnished-room lightmaps still remain untouched.
basement_sources=import_source(ROOT/'scene/exports/house/basement.glb');refit(basement_sources);bpy.context.view_layer.update()
basement_by_name={canonical(o.get('source_object',o.name)):o for o in basement_sources if o.type=='MESH'}
for o in basement_sources:
 o.hide_render=not(o.type=='MESH' and o.get('refit_assembly')=='envelope' and not o.get('source_object','').startswith('Basement ceiling'))
objects=[];static={}
review=json.loads((INPUT/'layout.json').read_text()).get('reviewPreparation',{})
removed={canonical(n) for names in review.get('removed',{}).values() for n in names}
for o in native:
 if o.type=='MESH' and (canonical(o.name) in removed or canonical(o.get('source_object',o.name)) in removed):o.hide_render=True
for room in ['structure','basement','attic']:
 loaded=sorted(import_source(INPUT/f'{room}.glb'),key=lambda o:o.get('house_bake_id',o.name));bpy.context.view_layer.update()
 for o in loaded:
  if o.type!='MESH':continue
  objects.append(o);name=o.get('house_bake_source',o.name);o['release_room']=room
  window_receiver=bool(o.get('house_window_receiver')) or (room=='basement' and bool(re.match(r'^(Window (jamb|rail|cross|transom)|Deep sill)',name)))
  if window_receiver:o['house_window_receiver']=True
  fixed=(room=='structure' and not o.get('release_dynamic') and o.get('preview_kind') not in ['door','ladder'] and (o.get('preview_kind')!='window' or window_receiver)) or (room=='basement' and (bool(o.get('ceiling_paint')) or window_receiver or bool(o.get('house_fixed_receiver')))) or (room=='attic' and bool(o.get('review_fixed_fixture')))
  if not fixed:
   o.hide_render=True;continue
  o.data=o.data.copy()
  original=(basement_by_name.get(canonical('Deep sill' if o.get('house_window_reveal') else name)) if room=='basement' else native_by_name.get(canonical(name)))
  if o.get('review_fixed_fixture'):
   for previous in [original,native_by_name.get(canonical(name)),basement_by_name.get(canonical(name))]:
    if previous:previous.hide_render=True
  # Use original reflectance, never feed an already lit atlas into another bake.
  for i,material in enumerate(list(o.data.materials)):
   if o.get('house_authored_reflectance'):replacement=material
   elif o.get('ceiling_paint') and room=='basement' or material and material.name.startswith('Light cream ceiling'):replacement=cream
   elif original:
    replacement=next((m for m in original.data.materials if m and re.sub(r'\.\d{3}$','',m.name)==re.sub(r'\.\d{3}$','',material.name)),original.data.materials[min(i,len(original.data.materials)-1)])
   else:raise RuntimeError('No original material for '+name)
   o.data.materials[i]=replacement
  # Imported emission UVs are not source UVs. Restore plywood/frame wood UVs
  # from the native mesh at the same world-space corner when available.
  if original and (o.get('workshop_plywood') or o.get('workshop_window_frame') or window_receiver and not o.get('house_window_reveal')) and original.data.uv_layers.active:
   uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Source UV');lookup={}
   for p in original.data.polygons:
    for li in p.loop_indices:
     v=original.matrix_world@original.data.vertices[original.data.loops[li].vertex_index].co
     lookup[tuple(round(c,4) for c in v)]=tuple(original.data.uv_layers.active.data[li].uv)
   for li,loop in enumerate(o.data.loops):
    v=o.matrix_world@o.data.vertices[loop.vertex_index].co;key=tuple(round(c,4) for c in v)
    if key in lookup:uv.data[li].uv=lookup[key]
  # A copied mesh's evaluated bound_box can be stale until the dependency graph
  # updates. Use its owned vertices so each room gets its own texel budget.
  points=[o.matrix_world@v.co for v in o.data.vertices]
  center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
  group='attic-fixtures' if room=='attic' else ('basement-windows' if window_receiver else 'basement-details' if o.get('house_fixed_receiver') else 'basement-ceiling') if room=='basement' else structural_group(name,o.get('preview_kind'),points)
  static.setdefault(group,[]).append(o)
lighting=configure(S);S.cycles.samples=8 if test else 64;S.cycles.use_denoising=True
S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=4 if test else 12
S.view_settings.view_transform='AgX';S.view_settings.exposure=-1.3
source_key=hashlib.sha256((ROOT/'scene/house-release.blend').read_bytes()+b''.join((INPUT/f'{r}.glb').read_bytes() for r in ['structure','basement','attic'])+Path(__file__).read_bytes()+(Path(__file__).parent/'house_bake_lighting.py').read_bytes()+(Path(__file__).parent/'house_bake_groups.py').read_bytes()).hexdigest()
cache_key=hashlib.sha256((source_key+str(test)).encode()).hexdigest()
cache_path=OUT/'atlas-cache.json';cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}
if cache.get('key')!=cache_key:cache={'key':cache_key,'complete':[]}
report={'quality':'test' if test else 'release','samples':S.cycles.samples,'atlases':{},'movableShadowsExcluded':True,'denoised':True,'lighting':lighting,'preservedOriginalRooms':['den','hallway','workshop','basement furnishings','attic furnishings'],'sourceKey':source_key,'inputKey':cache_key,'reviewPreparation':review}
for group,parts in static.items():
 print('BAKE_GROUP',group,len(parts),flush=True)
 vertices=[];faces=[];uvs=[];slots=[];smooth=[];materials=[];offsets={}
 for o in parts:
  mesh=o.data;lo=len(uvs);offset=len(vertices);vertices.extend(tuple(o.matrix_world@v.co) for v in mesh.vertices)
  local=[]
  for m in mesh.materials:
   if m not in materials:materials.append(m)
   local.append(materials.index(m))
  source=mesh.uv_layers.active
  for p in mesh.polygons:
   faces.append(tuple(offset+i for i in p.vertices));slots.append(local[p.material_index]);smooth.append(p.use_smooth);uvs.extend(tuple(source.data[i].uv) if source else (0,0) for i in p.loop_indices)
  offsets[o]=(lo,len(uvs));o.hide_render=True
 mesh=bpy.data.meshes.new('Bake '+group);mesh.from_pydata(vertices,[],faces);mesh.update();copies=[]
 for source in materials:
  m=source.copy();m.use_nodes=True;mesh.materials.append(m);copies.append(m)
  for node in list(m.node_tree.nodes):
   if node.type=='UVMAP':node.uv_map='Source UV'
   if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:
    uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Source UV';m.node_tree.links.new(uv.outputs['UV'],node.inputs['Vector'])
 for p,i,s in zip(mesh.polygons,slots,smooth):p.material_index=i;p.use_smooth=s
 uv=mesh.uv_layers.new(name='Source UV')
 for d,v in zip(uv.data,uvs):d.uv=v
 atlas=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=1;atlas.active_render=True
 helper=bpy.data.objects.new('Bake '+group,mesh);S.collection.objects.link(helper)
 bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.006 if test else .003);bpy.ops.object.mode_set(mode='OBJECT')
 size=512 if test else (4096 if group=='structure-hall' else 2048)
 image=bpy.data.images.new(group+' lighting',size,size,alpha=False,float_buffer=True)
 for m in copies:
  node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.nodes.active=node
 if group not in cache['complete'] or not (OUT/f'{group}.png').exists():
  bpy.ops.object.bake(type='DIFFUSE')
  image.filepath_raw=str(OUT/f'{group}.exr');image.file_format='OPEN_EXR';image.save()
  # The original room compositor denoises HDR before AgX and saturation.
  clean=bpy.data.scenes.new('Filter '+group);clean.render.engine='CYCLES';clean.cycles.samples=1
  cam=bpy.data.objects.new('Filter camera',bpy.data.cameras.new('Filter camera'));clean.collection.objects.link(cam);clean.camera=cam
  clean.use_nodes=True;nodes=clean.node_tree.nodes;nodes.clear();source=nodes.new('CompositorNodeImage');source.image=image;denoise=nodes.new('CompositorNodeDenoise');grade=nodes.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=nodes.new('CompositorNodeComposite')
  clean.node_tree.links.new(source.outputs['Image'],denoise.inputs['Image']);clean.node_tree.links.new(denoise.outputs['Image'],grade.inputs['Image']);clean.node_tree.links.new(grade.outputs['Image'],sink.inputs['Image'])
  clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-.7 if group=='structure-attic' else -1.3;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB'
  clean.render.resolution_x=size;clean.render.resolution_y=size;clean.render.resolution_percentage=100;clean.render.filepath=str(OUT/f'{group}.png');bpy.ops.render.render(scene=clean.name,write_still=True)
  bpy.data.scenes.remove(clean);bpy.data.objects.remove(cam,do_unlink=True)
  cache['complete'].append(group);cache_path.write_text(json.dumps(cache,indent=2)+'\n')
 else:print('REUSED_ATLAS',group,flush=True)
 baked_image=bpy.data.images.load(str(OUT/f'{group}.png'));baked=bpy.data.materials.new('Baked / '+group);baked.use_nodes=True
 nodes=baked.node_tree.nodes;nodes.clear();tx=nodes.new('ShaderNodeTexImage');tx.image=baked_image;em=nodes.new('ShaderNodeEmission');out=nodes.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],out.inputs[0])
 for o in parts:
  lo,hi=offsets[o];o['release_baked']=group;o['pending_baked_material']=baked.name
  coords=[tuple(x.uv) for x in mesh.uv_layers['Lighting UV'].data[lo:hi]]
  uv=o.data.uv_layers.get('Lighting UV') or o.data.uv_layers.new(name='Lighting UV')
  for d,v in zip(uv.data,coords):d.uv=v
  o.hide_render=False
 bpy.data.objects.remove(helper,do_unlink=True)
 report['atlases'][group]={'objects':len(parts),'resolution':size}
for o in objects:
 if not o.get('pending_baked_material'):continue
 o.data.materials.clear();o.data.materials.append(bpy.data.materials[o['pending_baked_material']]);del o['pending_baked_material']
 for p in o.data.polygons:p.material_index=0
 for uv in list(o.data.uv_layers):
  if uv.name!='Lighting UV':o.data.uv_layers.remove(uv)
 o.hide_render=False;o.hide_set(False)
for room in ['structure','basement','attic']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:
  if o['release_room']==room and o.get('release_baked') in static:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{room}-lighting.glb'),use_selection=True,export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
report['seconds']=round(time.monotonic()-start,1);(OUT/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('HOUSE_BAKE_COMPLETE',report,flush=True)
