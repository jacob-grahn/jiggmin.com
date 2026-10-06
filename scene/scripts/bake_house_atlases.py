"""Rebuild all released static surfaces from source reflectance; preserve live props.
Use house-release.blend. --prepare-only audits; --smoke validates tiny atlases.
"""
import bpy,json,sys,math,re,time,os
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
sys.path.insert(0,str(Path(__file__).parent))
from house_bake_lighting import configure
from house_bake_groups import structural_group,hallway_atlas_group,room_atlas_group
from house_source_uv import restore_source_uv,bind_source_uv
from house_bake_uv_guard import validate_objects
from house_frame_geometry import restore_authored_frame_geometry
from house_lightmap_filter import chart_masks,filter_irradiance
import numpy as np
from basement_model_refit import import_source,refit
R=Path(__file__).resolve().parents[2];smoke='--smoke' in sys.argv
OUT=Path(os.environ.get('BAKE_OUTPUT_DIR',str(R/'scene/renders/house-atlases')));OUT.mkdir(parents=True,exist_ok=True)
S=bpy.context.scene;canonical=lambda s:''.join(c.lower() for c in s if c.isalnum() or c=='-')
native=list(S.objects);sources={canonical(o.name):o for o in native if o.type=='MESH'}
# Basement window repairs use the original refitted envelope, not old lightmaps.
base=import_source(R/'scene/exports/house/basement.glb');refit(base);bpy.context.view_layer.update()
basement={canonical(o.get('source_object',o.name)):o for o in base if o.type=='MESH'}
authored={}
for asset in ['structure','basement','attic']:
 for o in import_source(R/f'scene/exports/house-release/bake-input/{asset}.glb'):
  if o.type=='MESH' and o.get('house_authored_reflectance'):authored[asset+':'+str(o.get('house_bake_id'))]=o
for o in list(S.objects):o.hide_render=True
exports={};groups={};targets=[];audit=[];material_cache={};sizes={}
uv_provenance={};removed=[];errors=[]
for asset in ['structure','hallway','workshop','basement','attic']:
 before=set(S.objects);bpy.ops.import_scene.gltf(filepath=str(R/f'web/assets/house/release/{asset}.glb'));bpy.context.view_layer.update()
 exports[asset]=sorted(set(S.objects)-before,key=lambda o:o.get('house_bake_source',o.get('source_object',o.name)))
 for o in exports[asset]:
  if o.type!='MESH':o.hide_render=True;continue
  name=o.get('house_bake_source',o.get('source_object',o.name)).replace('_',' ')
  group=o.get('release_baked');o.hide_render=True
  if not group:continue # live/throwable props must not cast permanent shadows
  points=[o.matrix_world@v.co for v in o.data.vertices]
  if asset=='structure' and group=='structure-hall' and o.get('preview_kind')=='ceiling' and name.startswith('Attic floor / hall ceiling'):group='hall-ceilings'
  group=room_atlas_group(group,name)
  if o.get('preview_kind')=='ladder' or (o.get('preview_kind')=='window' and 'glass' in name.lower()):continue
  identity=asset+':'+str(o.get('house_bake_id',o.get('source_object',name)))
  source=authored.get(identity) or (basement.get(canonical('Deep sill' if o.get('house_window_reveal') else name)) if asset=='basement' else None) or sources.get(canonical(o.get('source_slab_object',name)))
  if not source and name.startswith('Finish / ceiling moulding'):
   removed.append({'id':identity,'name':name,'reason':'absent from editable model'});continue
  if not source:errors.append('Missing source reflectance: '+identity+' '+name);continue
  resolution=max((max(tx.image.size) for m in o.data.materials if m and m.use_nodes for tx in m.node_tree.nodes if tx.type=='TEX_IMAGE' and tx.image),default=2048)
  sizes[group]=max(sizes.get(group,0),resolution)
  # Authored bake inputs can own reflectance (e.g. the hatch paint), while
  # the editable model owns the newer opening-clearance geometry.
  geometry_source=sources.get(canonical(name)) or source
  if not restore_authored_frame_geometry(o,geometry_source):o.data=o.data.copy()
  o.data.materials.clear()
  reflectance=[bpy.data.materials['Light cream ceiling']] if asset=='basement' and o.get('ceiling_paint') else source.data.materials
  for m in reflectance:
   if m not in material_cache:
    c=m.copy();material_cache[m]=c
    bind_source_uv(c)
   o.data.materials.append(material_cache[m])
  if not o.data.materials:raise RuntimeError('Missing material: '+name)
  for m in o.data.materials:
   outputs=[n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output]
   shader=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) or next((n for n in m.node_tree.nodes if n.type=='EMISSION'),None)
   if not outputs or not outputs[0].inputs['Surface'].is_linked or not shader:
    raise RuntimeError('Unsupported source surface shader: '+m.name+' '+str([(n.name,n.type)for n in m.node_tree.nodes]))
  try:max_distance=restore_source_uv(o,source,restore_slots=True)
  except RuntimeError as error:
   errors.append(str(error));print('UV_PREFLIGHT_ERROR',name,str(error),flush=True);o.hide_render=True;continue
  uv_provenance[o]='restored'
  o['atlas_source_id']=identity;o['release_baked']=group;o.hide_render=False;targets.append(o)
  key=group
  o['atlas_group']=key;groups.setdefault(key,[]).append(o)
  audit.append({'id':identity,'name':name,'source':source.name,'mapping':o.get('source_uv_mapping','verified-source-uv'),'maxSourceDistance':round(max_distance,6) if max_distance is not None else None,'corners':len(o.data.loops),'projectedNewFaces':o.get('source_uv_projected_faces',0),'maxTangentialDistance':o.get('source_uv_max_tangent_distance',0),'maxNormalOffset':o.get('source_uv_max_normal_offset',0)})
 print('ROOM_UV_PREFLIGHT',asset,len([o for o in targets if o['atlas_source_id'].startswith(asset+':')]),flush=True)
if errors:
 (OUT/'source-errors.json').write_text(json.dumps(errors,indent=2)+'\n')
 raise RuntimeError('Room UV preflight failed:\n'+'\n'.join(errors))
(OUT/'source-errors.json').unlink(missing_ok=True)
validate_objects(targets,uv_provenance)
lighting=configure(S);S.cycles.samples=1 if smoke else 64;S.cycles.use_denoising=False
S.render.use_freestyle=False;S.view_settings.view_transform='AgX';S.view_settings.exposure=-1.3
cam=bpy.data.objects.new('Atlas filter camera',bpy.data.cameras.new('Atlas filter camera'));S.collection.objects.link(cam);S.camera=cam
records={};pending=[]
atlas_profile=os.environ.get('BAKE_ATLAS_PROFILE','browser')
if atlas_profile not in {'browser','render'}:raise RuntimeError('BAKE_ATLAS_PROFILE must be browser or render')
atlas_overrides=json.loads(os.environ.get('BAKE_ATLAS_SIZES','{}'))
if any(not isinstance(v,int) or v not in {512,1024,2048,4096} for v in atlas_overrides.values()):raise RuntimeError('Bake atlas sizes must be 512, 1024, 2048 or 4096')
trim_normal_scale=float(os.environ.get('BAKE_TRIM_NORMAL_SCALE','1'))
if not math.isfinite(trim_normal_scale) or not 0<=trim_normal_scale<=1:raise RuntimeError('Trim normal scale must be between 0 and 1')
requested=set(filter(None,os.environ.get('BAKE_ATLAS_GROUPS','').split(',')))
if requested:
 missing=requested-set(groups)
 if missing:raise RuntimeError('Unknown atlas groups: '+', '.join(sorted(missing)))
 groups={key:parts for key,parts in groups.items() if key in requested}
for key,parts in groups.items():
 area=sum(p.area for o in parts for p in o.data.polygons) # meshes may carry scale; use world area below
 area=0
 for o in parts:
  o.data.calc_loop_triangles()
  for t in o.data.loop_triangles:
   a,b,c=[o.matrix_world@o.data.vertices[i].co for i in t.vertices];area+=(b-a).cross(c-a).length/2
 # About 128 texels/metre before packing. Fine parts don't each demand 4K.
 desired=math.sqrt(area*128**2/.65)
 render_size=2048 if key in {'hall-ceilings','hall-trim','basement-slab-ceilings','attic-floor'} else 1024 if key=='hall-window-frames' else min(4096,max(1024,sizes[key]))
 size=64 if smoke else atlas_overrides.get(key,1024 if atlas_profile=='browser' else render_size)
 records[key]={'resolution':[size,size],'objects':len(parts),'worldArea':round(area,2)}
print('ATLAS_PLAN',json.dumps(records),flush=True)
(OUT/'source-audit.json').write_text(json.dumps(audit,indent=2))
(OUT/'atlas-plan.json').write_text(json.dumps(records,indent=2))
if '--prepare-only' in sys.argv:sys.exit(0)
for key,parts in groups.items():
 started=time.monotonic();vertices=[];faces=[];uvs=[];slots=[];smooth=[];materials=[];offsets={}
 for o in parts:
  start=len(uvs);lookup={};indices={}
  for vertex in o.data.vertices:
   point=tuple(o.matrix_world@vertex.co);key_point=tuple(round(c,6) for c in point)
   if key_point not in lookup:lookup[key_point]=len(vertices);vertices.append(point)
   indices[vertex.index]=lookup[key_point]
  local=[]
  for m in o.data.materials:
   if m not in materials:materials.append(m)
   local.append(materials.index(m))
  for p in o.data.polygons:
   faces.append(tuple(indices[i] for i in p.vertices));slots.append(local[p.material_index]);smooth.append(p.use_smooth);uvs.extend(tuple(o.data.uv_layers['Source UV'].data[i].uv) for i in p.loop_indices)
  offsets[o]=(start,len(uvs));o.hide_render=True
 mesh=bpy.data.meshes.new('Atlas '+key);mesh.from_pydata(vertices,[],faces);mesh.update()
 # Each group owns its materials so the bake target cannot leak into other groups.
 materials=[m.copy() for m in materials]
 if key=='hall-trim':
  for m in materials:
   for node in m.node_tree.nodes:
    if node.type=='NORMAL_MAP' and node.inputs['Color'].is_linked:
     texture=node.inputs['Color'].links[0].from_node
     if texture.type=='TEX_IMAGE' and texture.image and texture.image.name.startswith('finish-timber-normal'):
      node.inputs['Strength'].default_value*=trim_normal_scale
  records[key]['timberNormalScale']=trim_normal_scale
 for m in materials:mesh.materials.append(m)
 for p,i,s in zip(mesh.polygons,slots,smooth):p.material_index=i;p.use_smooth=s
 source_uv=mesh.uv_layers.new(name='Source UV')
 for loop,co in zip(source_uv.data,uvs):loop.uv=co
 atlas_uv=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=1;atlas_uv.active_render=True
 helper=bpy.data.objects.new('Bake '+key,mesh);S.collection.objects.link(helper)
 bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.003);bpy.ops.object.mode_set(mode='OBJECT')
 size=records[key]['resolution'][0]
 if not smoke and key=='hall-ceilings':
  from hall_ceiling_uv import pack_ceiling_uv
  pack_ceiling_uv(mesh,mesh.uv_layers['Lighting UV'],size)
 if not smoke and key=='hall-window-wall':
  from hall_ceiling_uv import pack_planar_uv
  pack_planar_uv(mesh,mesh.uv_layers['Lighting UV'],size,0)
 if not smoke and key=='hall-window-frames':
  from hall_window_finish import pack_window_uv
  pack_window_uv(mesh,mesh.uv_layers['Lighting UV'],size)
 S.render.bake.margin_type='EXTEND'
 light=bpy.data.images.new(key+' irradiance',size,size,alpha=False,float_buffer=True)
 albedo=bpy.data.images.new(key+' albedo',size,size,alpha=False,float_buffer=True)
 active=[]
 for m in materials:
  tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=light;m.node_tree.nodes.active=tx;active.append(tx)
 S.render.bake.margin=12;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=False
 print('BAKE_IRRADIANCE',key,size,flush=True);bpy.ops.object.bake(type='DIFFUSE')
 light.filepath_raw=str(OUT/(key+'.exr'));light.file_format='OPEN_EXR';light.save()
 # Atlas images are not photographs: denoise thin timber faces independently.
 if key=='hall-trim' and not smoke:
  raw=np.empty(size*size*4,dtype=np.float32);light.pixels.foreach_get(raw)
  filtered,quality=filter_irradiance(raw.reshape(size,size,4),list(chart_masks(mesh,mesh.uv_layers['Lighting UV'],size)))
  (OUT/(key+'-quality.json')).write_text(json.dumps({'threshold':.12,'sigmaTexels':4,'charts':quality},indent=2)+'\n')
  light=bpy.data.images.new(key+' filtered irradiance',size,size,alpha=False,float_buffer=True)
  light.pixels.foreach_set(filtered.ravel());light.update()
  light.filepath_raw=str(OUT/(key+'-filtered.exr'));light.file_format='OPEN_EXR';light.save()
  records[key]['irradianceFilter']='planar-UV-chart-binomial-sigma4'
  records[key]['speckleThreshold']=.12
  records[key]['maxSpeckleScore']=max((r.get('filteredScore',0)for r in quality),default=0)
 # Bake albedo separately without tracing light, and never denoise its detail.
 saved=[];emissive={}
 for m,tx in zip(materials,active):
  n=m.node_tree.nodes;l=m.node_tree.links;tx.image=albedo;n.active=tx
  out=next(v for v in n if v.type=='OUTPUT_MATERIAL' and v.is_active_output);socket=out.inputs['Surface'].links[0].from_socket
  p=next((v for v in n if v.type=='BSDF_PRINCIPLED'),None) or next(v for v in n if v.type=='EMISSION')
  saved.append((m,out,socket))
  em=n.new('ShaderNodeEmission')
  if p.type=='EMISSION':
   emissive[m]=p.outputs[0];em.inputs[0].default_value=(0,0,0,1)
  else:
   color=p.inputs['Base Color']
   if color.is_linked:l.new(color.links[0].from_socket,em.inputs[0])
   else:em.inputs[0].default_value=color.default_value
  l.new(em.outputs[0],out.inputs['Surface'])
 bpy.ops.object.bake(type='EMIT')
 for m,out,socket in saved:m.node_tree.links.new(socket,out.inputs['Surface'])
 albedo.filepath_raw=str(OUT/(key+'-albedo.exr'));albedo.file_format='OPEN_EXR';albedo.save()
 # Unlit authored surfaces contribute emission independently of irradiance.
 emission=None
 if emissive:
  emission=bpy.data.images.new(key+' source emission',size,size,alpha=False,float_buffer=True)
  for m,tx in zip(materials,active):
   tx.image=emission;m.node_tree.nodes.active=tx
   out=next(v for v in m.node_tree.nodes if v.type=='OUTPUT_MATERIAL' and v.is_active_output)
   if m in emissive:
    # glTF unlit imports wrap emission in a light-path mix; bake its color
    # directly, then restore the authored wrapper for subsequent lighting.
    m.node_tree.links.new(emissive[m],out.inputs['Surface'])
   else:
    black=m.node_tree.nodes.new('ShaderNodeEmission');black.inputs[0].default_value=(0,0,0,1);m.node_tree.links.new(black.outputs[0],out.inputs['Surface'])
  bpy.ops.object.bake(type='EMIT')
  for m,out,socket in saved:m.node_tree.links.new(socket,out.inputs['Surface'])
  emission.filepath_raw=str(OUT/(key+'-emission.exr'));emission.file_format='OPEN_EXR';emission.save()
 clean=bpy.data.scenes.new('Filter');clean.render.engine='CYCLES';clean.cycles.samples=1;clean.collection.objects.link(cam);clean.camera=cam;clean.use_nodes=True
 n=clean.node_tree.nodes;l=clean.node_tree.links;n.clear();src=n.new('CompositorNodeImage');src.image=light;col=n.new('CompositorNodeImage');col.image=albedo;denoise=n.new('CompositorNodeDenoise');mul=n.new('CompositorNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;grade=n.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=n.new('CompositorNodeComposite')
 l.new(src.outputs['Image'],denoise.inputs['Image']);l.new(src.outputs['Image'] if key=='hall-trim' and not smoke else denoise.outputs['Image'],mul.inputs[1]);l.new(col.outputs['Image'],mul.inputs[2]);final=mul.outputs[0]
 if emission:
  emit=n.new('CompositorNodeImage');emit.image=emission;add=n.new('CompositorNodeMixRGB');add.blend_type='ADD';add.inputs[0].default_value=1;l.new(final,add.inputs[1]);l.new(emit.outputs['Image'],add.inputs[2]);final=add.outputs[0]
 l.new(final,grade.inputs['Image']);l.new(grade.outputs[0],sink.inputs[0])
 clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3
 clean.render.resolution_x=size;clean.render.resolution_y=size;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(OUT/(key+'.png'))
 if key=='hall-trim' and not smoke:
  from house_atlas_composite import compose_trim
  records[key]['compositionMaxError']=compose_trim(OUT,size,cam)
 else:bpy.ops.render.render(scene=clean.name,write_still=True)
 bpy.data.scenes.remove(clean)
 baked=bpy.data.materials.new('Baked / '+key);baked.use_nodes=True;n=baked.node_tree.nodes;n.clear();tx=n.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(OUT/(key+'.png')));em=n.new('ShaderNodeEmission');out=n.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs[0],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],out.inputs[0])
 for o,(start,end) in offsets.items():pending.append((o,baked,[tuple(co.uv) for co in list(mesh.uv_layers['Lighting UV'].data)[start:end]]));o.hide_render=False
 bpy.data.objects.remove(helper,do_unlink=True)
 records[key]['seconds']=round(time.monotonic()-started,2);print('ATLAS_COMPLETE',key,records[key]['seconds'],flush=True)
# Replace materials only after all bakes, avoiding lightmap emission in GI.
for o,baked,coords in pending:
 for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
 layer=o.data.uv_layers.new(name='Lighting UV')
 for loop,co in zip(layer.data,coords):loop.uv=co
 o.data.materials.clear();o.data.materials.append(baked)
 for p in o.data.polygons:p.material_index=0
for o in S.objects:o.select_set(False)
for o,_,_ in pending:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'house-atlases.glb'),use_selection=True,export_format='GLB',export_extras=True,export_image_format='AUTO')
(OUT/'report.json').write_text(json.dumps({'atlases':records,'lighting':lighting,'samples':S.cycles.samples,'atlasProfile':atlas_profile,'objects':len(pending),'selectedGroups':sorted(requested),'exposure':-1.3,'losslessBake':True,'denoise':'irradiance-only','sourceAudit':'source-audit.json','projectedDenPreserved':True,'removedObjects':removed,'sourceUVGuard':True,'materialUV':'Source UV; normal bases explicitly bound'},indent=2)+'\n')
print('HOUSE_ATLASES_COMPLETE',flush=True)
