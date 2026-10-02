"""Rebuild all released static surfaces from source reflectance; preserve live props.
Use house-release.blend. --prepare-only audits; --smoke validates tiny atlases.
"""
import bpy,json,sys,math,re,time
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
sys.path.insert(0,str(Path(__file__).parent))
from house_bake_lighting import configure
from house_bake_groups import structural_group
from basement_model_refit import import_source,refit
R=Path(__file__).resolve().parents[2];smoke='--smoke' in sys.argv
OUT=R/'scene/renders/house-atlases';OUT.mkdir(parents=True,exist_ok=True)
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
exports={};groups={};targets=[];audit=[];material_cache={}
for asset in ['structure','hallway','workshop','basement','attic']:
 before=set(S.objects);bpy.ops.import_scene.gltf(filepath=str(R/f'web/assets/house/release/{asset}.glb'));bpy.context.view_layer.update()
 exports[asset]=list(set(S.objects)-before)
 for o in exports[asset]:
  if o.type!='MESH':o.hide_render=True;continue
  name=o.get('house_bake_source',o.get('source_object',o.name)).replace('_',' ')
  group=o.get('release_baked');o.hide_render=True
  if not group:continue # live/throwable props must not cast permanent shadows
  points=[o.matrix_world@v.co for v in o.data.vertices]
  if asset=='structure':group=structural_group(name,o.get('preview_kind'),points)
  if name.startswith('Finish / ceiling moulding') and group in {'structure-hall','structure-den'}:continue
  if o.get('preview_kind')=='ladder' or (o.get('preview_kind')=='window' and 'glass' in name.lower()):continue
  identity=asset+':'+str(o.get('house_bake_id',o.get('source_object',name)))
  source=authored.get(identity) or (basement.get(canonical('Deep sill' if o.get('house_window_reveal') else name)) if asset=='basement' else None) or sources.get(canonical(name))
  if not source:raise RuntimeError('Missing source reflectance: '+identity+' '+name)
  o.data=o.data.copy();o.data.materials.clear()
  reflectance=[bpy.data.materials['Light cream ceiling']] if asset=='basement' and o.get('ceiling_paint') else source.data.materials
  for m in reflectance:
   if m not in material_cache:
    c=m.copy();material_cache[m]=c
    for tx in list(c.node_tree.nodes):
     if tx.type=='UVMAP':tx.uv_map='Source UV'
     if tx.type=='TEX_IMAGE' and not tx.inputs['Vector'].is_linked:
      uv=c.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Source UV';c.node_tree.links.new(uv.outputs[0],tx.inputs['Vector'])
   o.data.materials.append(material_cache[m])
  if not o.data.materials:raise RuntimeError('Missing material: '+name)
  source.data.calc_loop_triangles();triangles=list(source.data.loop_triangles)
  source_points=[source.matrix_world@v.co for v in source.data.vertices]
  tree=BVHTree.FromPolygons(source_points,[t.vertices for t in triangles],all_triangles=True)
  uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Source UV');uv.name='Source UV'
  source_uv=source.data.uv_layers.active
  # Repaired reveals have new dimensions and no meaningful correspondence.
  planar=source_uv is None or bool(o.get('house_window_reveal'))
  lookup={}
  if source_uv:
   transform=source.matrix_world.to_3x3().inverted().transposed()
   for face in source.data.polygons:
    normal=(transform@face.normal).normalized()
    for li in face.loop_indices:
     world=source_points[source.data.loops[li].vertex_index]
     lookup[tuple(round(v,4) for v in world)+tuple(round(v,3) for v in normal)]=tuple(source_uv.data[li].uv)
  max_distance=0
  for poly in o.data.polygons:
   center=o.matrix_world@poly.center
   point,normal,index,distance=tree.find_nearest(center)
   poly.material_index=min(triangles[index].material_index,len(o.data.materials)-1)
   normal=(o.matrix_world.to_3x3().inverted().transposed()@poly.normal).normalized()
   axis=max(range(3),key=lambda i:abs(normal[i]));axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
   for li in poly.loop_indices:
    world=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
    if planar:uv.data[li].uv=(world[axes[0]]/1.5,world[axes[1]]/1.5)
    elif tuple(round(v,4) for v in world)+tuple(round(v,3) for v in normal) in lookup:
     uv.data[li].uv=lookup[tuple(round(v,4) for v in world)+tuple(round(v,3) for v in normal)]
    else:
     point,_,index,distance=tree.find_nearest(world);max_distance=max(max_distance,distance);t=triangles[index]
     coords=[Vector((*source_uv.data[i].uv,0)) for i in t.loops]
     uv.data[li].uv=barycentric_transform(point,*[source_points[i] for i in t.vertices],*coords).xy
  if max_distance>.01:raise RuntimeError('Source geometry mismatch: '+name+' distance '+str(max_distance))
  o['atlas_source_id']=identity;o['release_baked']=group;o.hide_render=False;targets.append(o)
  # Separate large architectural surfaces from fine trim/room furnishings.
  if asset=='structure':
   category='floor' if o.get('preview_kind')=='floor' else 'ceiling' if o.get('preview_kind')=='ceiling' or 'ceiling' in name.lower() else 'walls' if name.startswith(('Proposed wall','Garage exterior')) else 'trim'
   key=group+'-'+category
  else:key=asset+('-overhead' if re.search('ceiling|roof|rafter',name,re.I) else '-surfaces')
  o['atlas_group']=key;groups.setdefault(key,[]).append(o)
  audit.append({'id':identity,'name':name,'source':source.name,'mapping':'planar-metres' if planar else 'source-uv','maxSourceDistance':round(max_distance,6),'corners':len(o.data.loops)})
lighting=configure(S);S.cycles.samples=1 if smoke else 128;S.cycles.use_denoising=False
S.render.use_freestyle=False;S.view_settings.view_transform='AgX';S.view_settings.exposure=-1.3
cam=bpy.data.objects.new('Atlas filter camera',bpy.data.cameras.new('Atlas filter camera'));S.collection.objects.link(cam);S.camera=cam
records={};pending=[]
for key,parts in groups.items():
 area=sum(p.area for o in parts for p in o.data.polygons) # meshes may carry scale; use world area below
 area=0
 for o in parts:
  o.data.calc_loop_triangles()
  for t in o.data.loop_triangles:
   a,b,c=[o.matrix_world@o.data.vertices[i].co for i in t.vertices];area+=(b-a).cross(c-a).length/2
 # About 128 texels/metre before packing. Fine parts don't each demand 4K.
 desired=math.sqrt(area*128**2/.65)
 size=64 if smoke else min(2048 if key.startswith('structure-exterior') else 4096,max(512,2**math.ceil(math.log2(max(desired,1)))))
 records[key]={'resolution':[size,size],'objects':len(parts),'worldArea':round(area,2)}
print('ATLAS_PLAN',json.dumps(records),flush=True)
(OUT/'source-audit.json').write_text(json.dumps(audit,indent=2))
(OUT/'atlas-plan.json').write_text(json.dumps(records,indent=2))
if '--prepare-only' in sys.argv:sys.exit(0)
for key,parts in groups.items():
 started=time.monotonic();vertices=[];faces=[];uvs=[];slots=[];smooth=[];materials=[];offsets={}
 for o in parts:
  offset=len(vertices);start=len(uvs);vertices.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices);local=[]
  for m in o.data.materials:
   if m not in materials:materials.append(m)
   local.append(materials.index(m))
  for p in o.data.polygons:
   faces.append(tuple(offset+i for i in p.vertices));slots.append(local[p.material_index]);smooth.append(p.use_smooth);uvs.extend(tuple(o.data.uv_layers['Source UV'].data[i].uv) for i in p.loop_indices)
  offsets[o]=(start,len(uvs));o.hide_render=True
 mesh=bpy.data.meshes.new('Atlas '+key);mesh.from_pydata(vertices,[],faces);mesh.update()
 # Each group owns its materials so the bake target cannot leak into other groups.
 materials=[m.copy() for m in materials]
 for m in materials:mesh.materials.append(m)
 for p,i,s in zip(mesh.polygons,slots,smooth):p.material_index=i;p.use_smooth=s
 source_uv=mesh.uv_layers.new(name='Source UV')
 for loop,co in zip(source_uv.data,uvs):loop.uv=co
 atlas_uv=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=1;atlas_uv.active_render=True
 helper=bpy.data.objects.new('Bake '+key,mesh);S.collection.objects.link(helper)
 bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.003);bpy.ops.object.mode_set(mode='OBJECT')
 size=records[key]['resolution'][0]
 light=bpy.data.images.new(key+' irradiance',size,size,alpha=False,float_buffer=True)
 albedo=bpy.data.images.new(key+' albedo',size,size,alpha=False,float_buffer=True)
 active=[]
 for m in materials:
  tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=light;m.node_tree.nodes.active=tx;active.append(tx)
 S.render.bake.margin=12;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=False
 print('BAKE_IRRADIANCE',key,size,flush=True);bpy.ops.object.bake(type='DIFFUSE')
 light.filepath_raw=str(OUT/(key+'.exr'));light.file_format='OPEN_EXR';light.save()
 # Bake albedo separately without tracing light, and never denoise its detail.
 saved=[]
 for m,tx in zip(materials,active):
  n=m.node_tree.nodes;l=m.node_tree.links;tx.image=albedo;n.active=tx
  p=next((v for v in n if v.type=='BSDF_PRINCIPLED'),None);out=next(v for v in n if v.type=='OUTPUT_MATERIAL')
  if not p:raise RuntimeError('Expected source Principled reflectance: '+m.name)
  saved.append((m,out,out.inputs['Surface'].links[0].from_socket))
  em=n.new('ShaderNodeEmission');color=p.inputs['Base Color']
  if color.is_linked:l.new(color.links[0].from_socket,em.inputs[0])
  else:em.inputs[0].default_value=color.default_value
  l.new(em.outputs[0],out.inputs['Surface'])
 bpy.ops.object.bake(type='EMIT')
 for m,out,socket in saved:m.node_tree.links.new(socket,out.inputs['Surface'])
 albedo.filepath_raw=str(OUT/(key+'-albedo.exr'));albedo.file_format='OPEN_EXR';albedo.save()
 clean=bpy.data.scenes.new('Filter');clean.render.engine='CYCLES';clean.cycles.samples=1;clean.collection.objects.link(cam);clean.camera=cam;clean.use_nodes=True
 n=clean.node_tree.nodes;l=clean.node_tree.links;n.clear();src=n.new('CompositorNodeImage');src.image=light;col=n.new('CompositorNodeImage');col.image=albedo;denoise=n.new('CompositorNodeDenoise');mul=n.new('CompositorNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;grade=n.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=n.new('CompositorNodeComposite')
 l.new(src.outputs['Image'],denoise.inputs['Image']);l.new(denoise.outputs['Image'],mul.inputs[1]);l.new(col.outputs['Image'],mul.inputs[2]);l.new(mul.outputs[0],grade.inputs['Image']);l.new(grade.outputs[0],sink.inputs[0])
 clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-.7 if 'attic' in key else -1.3
 clean.render.resolution_x=size;clean.render.resolution_y=size;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(OUT/(key+'.png'));bpy.ops.render.render(scene=clean.name,write_still=True);bpy.data.scenes.remove(clean)
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
for o in targets:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'house-atlases.glb'),use_selection=True,export_format='GLB',export_extras=True,export_image_format='AUTO')
(OUT/'report.json').write_text(json.dumps({'atlases':records,'lighting':lighting,'samples':S.cycles.samples,'objects':len(targets),'losslessBake':True,'denoise':'irradiance-only','sourceAudit':'source-audit.json','projectedDenPreserved':True},indent=2)+'\n')
print('HOUSE_ATLASES_COMPLETE',flush=True)
