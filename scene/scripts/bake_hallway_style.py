"""Moonlit illustrated hallway experiment; leaves native/release sources intact.
Run on house-release.blend with --preview or --prepare-only before the full bake.
"""
import bpy,json,sys,re,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
sys.path.insert(0,str(Path(__file__).parent))
from house_bake_lighting import configure
R=Path(__file__).resolve().parents[2];smoke='--smoke' in sys.argv;OUT=R/('scene/renders/hallway-style-smoke' if smoke else 'scene/renders/hallway-style');OUT.mkdir(parents=True,exist_ok=True)
S=bpy.context.scene;native=list(S.objects)
canonical=lambda s:''.join(c.lower() for c in s if c.isalnum())
sources={canonical(o.name):o for o in native if o.type=='MESH'}
for o in native:o.hide_render=True
exports={};groups={};records={};missing=[]
for asset in ['structure','hallway']:
 before=set(S.objects);bpy.ops.import_scene.gltf(filepath=str(R/f'web/assets/house/release/{asset}.glb'))
 exports[asset]=list(set(S.objects)-before)
 bpy.context.view_layer.update()
 for o in exports[asset]:
  if o.type!='MESH':continue
  name=o.get('house_bake_source',o.get('source_object',o.name)).replace('_',' ')
  hidden=(name.startswith('Finish / ceiling moulding') and o.get('release_baked') in {'structure-hall','structure-den'}) or o.get('preview_kind')=='ladder' or (o.get('preview_kind')=='window' and 'glass' in name.lower())
  o.hide_render=hidden
  if o.get('release_baked') not in {'structure-hall','original-hallway'} or hidden:continue
  source=sources.get(canonical(name))
  if not source:missing.append(name);continue
  o['hallway_style_source_id']=asset+':'+str(o.get('house_bake_id',o.get('source_object',name)))
  # Restore original reflectance; never light an already-lit atlas a second time.
  o.data=o.data.copy();o.data.materials.clear()
  for m in source.data.materials:o.data.materials.append(m.copy())
  for p in o.data.polygons:p.material_index=min(p.material_index,len(o.data.materials)-1)
  uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Source UV');uv.name='Source UV'
  lookup={}
  if source.data.uv_layers.active:
   for poly in source.data.polygons:
    for li in poly.loop_indices:
     world=source.matrix_world@source.data.vertices[source.data.loops[li].vertex_index].co
     normal=source.matrix_world.to_3x3().inverted().transposed()@poly.normal
     lookup[tuple(round(c,4) for c in world)+tuple(round(c,3) for c in normal.normalized())]=tuple(source.data.uv_layers.active.data[li].uv)
  # Interpolate original UVs across source triangles when release repairs or
  # triangulation changed corner positions. Never retain old lightmap UVs.
  source.data.calc_loop_triangles();source_triangles=list(source.data.loop_triangles)
  source_points=[source.matrix_world@v.co for v in source.data.vertices]
  source_tree=BVHTree.FromPolygons(source_points,[t.vertices for t in source_triangles],all_triangles=True)
  loop_normals={li:poly.normal for poly in o.data.polygons for li in poly.loop_indices}
  matched=0
  for li,loop in enumerate(o.data.loops):
   world=o.matrix_world@o.data.vertices[loop.vertex_index].co;normal=o.matrix_world.to_3x3().inverted().transposed()@loop_normals[li]
   key=tuple(round(c,4) for c in world)+tuple(round(c,3) for c in normal.normalized())
   if key in lookup:uv.data[li].uv=lookup[key];matched+=1
   elif lookup:
    point,normal,index,distance=source_tree.find_nearest(world);triangle=source_triangles[index]
    positions=[source_points[i] for i in triangle.vertices]
    coordinates=[Vector((*source.data.uv_layers.active.data[i].uv,0)) for i in triangle.loops]
    mapped=barycentric_transform(point,*positions,*coordinates);uv.data[li].uv=mapped.xy;matched+=1
   else:
    # Native structural primitives without authored UVs receive metre-scale
    # planar finish coordinates, never coordinates from the previous bake.
    axis=max(range(3),key=lambda i:abs(normal[i]))
    axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
    uv.data[li].uv=(world[axes[0]],world[axes[1]]);matched+=1
  o['hallway_source_uv_matched']=matched;o['hallway_source_uv_corners']=len(o.data.loops)
  for m in o.data.materials:
   n=m.node_tree.nodes;l=m.node_tree.links
   for tx in list(n):
    if tx.type=='UVMAP':tx.uv_map='Source UV'
    if tx.type=='TEX_IMAGE' and not tx.inputs['Vector'].is_linked:
     mapping=n.new('ShaderNodeUVMap');mapping.uv_map='Source UV';l.new(mapping.outputs[0],tx.inputs['Vector'])
   p=next((x for x in n if x.type=='BSDF_PRINCIPLED'),None);sink=next((x for x in n if x.type=='OUTPUT_MATERIAL'),None)
   if not p or not sink:raise RuntimeError('Expected source reflectance: '+m.name)
   color=p.inputs['Base Color'];base=color.links[0].from_socket if color.is_linked else None
   if base is None:
    rgb=n.new('ShaderNodeRGB');rgb.outputs[0].default_value=color.default_value;base=rgb.outputs[0]
   # Sparse surface-space ink: broad patches, narrow diagonal strokes. No
   # normal-map glitter or glossy response; the blue window rig is unchanged.
   pos=n.new('ShaderNodeNewGeometry').outputs['Position']
   noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.7;noise.inputs['Detail'].default_value=2;l.new(pos,noise.inputs['Vector'])
   patch=n.new('ShaderNodeMath');patch.operation='GREATER_THAN';patch.inputs[1].default_value=.67;l.new(noise.outputs['Fac'],patch.inputs[0])
   wave=n.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL';wave.inputs['Scale'].default_value=48;wave.inputs['Distortion'].default_value=.6;l.new(pos,wave.inputs['Vector'])
   line=n.new('ShaderNodeMath');line.operation='GREATER_THAN';line.inputs[1].default_value=.94;l.new(wave.outputs['Fac'],line.inputs[0])
   coverage=n.new('ShaderNodeMath');coverage.operation='MULTIPLY';l.new(patch.outputs[0],coverage.inputs[0]);l.new(line.outputs[0],coverage.inputs[1])
   mix=n.new('ShaderNodeMixRGB');l.new(coverage.outputs[0],mix.inputs[0]);l.new(base,mix.inputs[1]);mix.inputs[2].default_value=(.008,.012,.022,1)
   toon=n.new('ShaderNodeBsdfToon');toon.component='DIFFUSE';toon.inputs['Size'].default_value=.58;toon.inputs['Smooth'].default_value=.035;l.new(mix.outputs[0],toon.inputs['Color'])
   ambient=n.new('ShaderNodeEmission');ambient.inputs['Strength'].default_value=.30
   tint=n.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.30,.37,.55,1);l.new(mix.outputs[0],tint.inputs[1]);l.new(tint.outputs[0],ambient.inputs[0])
   add=n.new('ShaderNodeAddShader');l.new(toon.outputs[0],add.inputs[0]);l.new(ambient.outputs[0],add.inputs[1]);l.new(add.outputs[0],sink.inputs['Surface'])
  pts=[o.matrix_world@v.co for v in o.data.vertices];center=sum(pts,Vector())/len(pts)
  if o.get('release_baked')=='original-hallway':key='runner' if re.search('runner|fringe|thread',name,re.I) else 'furnishings'
  elif o.get('preview_kind')=='ceiling':key='ceiling'
  elif o.get('preview_kind')=='floor':key='floor'
  elif name.startswith('Proposed wall'):key='wallsnorth' if center.y> -6.5 else 'wallssouth'
  else:key='trim'
  o['hallway_style_group']=key;groups.setdefault(key,[]).append(o)
if missing:raise RuntimeError('Missing native reflectance: '+str(missing))
lighting=configure(S)
# Other-room lightmaps are camera references only and must not emit into the
# new bake. Neutral diffuse blockers keep the unchanged house envelope opaque.
targets={o for parts in groups.values() for o in parts}
blocker=bpy.data.materials.new('Neutral distant room occluder');blocker.use_nodes=True;blocker.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.12,.15,.19,1)
for parts in exports.values():
 for o in parts:
  if o.type=='MESH' and o not in targets and o.get('release_baked') and not o.hide_render:
   o.data.materials.clear();o.data.materials.append(blocker)
S.cycles.samples=1 if smoke else 64;S.cycles.use_denoising=True
S.view_settings.view_transform='AgX';S.view_settings.exposure=-1.3
layout=json.loads((R/'web/assets/house/release/layout.json').read_text());v=layout['views']['hub'];convert=lambda p:Vector((p[0],-p[2],p[1]))
cam=bpy.data.objects.new('Hallway style camera',bpy.data.cameras.new('Hallway style camera'));S.collection.objects.link(cam);cam.location=convert(v['position']);cam.rotation_euler=(convert(v['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=24;cam.data.lens=12/math.tan(math.radians(v['fov'])/2);S.camera=cam
S.render.resolution_x=1600;S.render.resolution_y=1000;S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG';S.render.image_settings.color_mode='RGB';S.render.use_freestyle=False
if '--preview' in sys.argv:
 S.cycles.samples=16;S.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True);sys.exit(0)
# Allocate independent surface budgets. Source artwork is not included in these
# groups and keeps its original materials, UVs and full-size image textures.
pending=[]
for key,parts in groups.items():
 size=64 if smoke else 2048 if key=='furnishings' else 4096
 records[key]={'resolution':[size,size],'objects':len(parts)}
print('HALLWAY_STYLE_GROUPS',json.dumps(records),flush=True)
print('SOURCE_UV_MATCH',sum(o['hallway_source_uv_matched'] for o in targets),sum(o['hallway_source_uv_corners'] for o in targets),flush=True)
if '--prepare-only' in sys.argv:sys.exit(0)
for key,parts in groups.items():
 vertices=[];faces=[];uvs=[];slots=[];smooth=[];materials=[];offsets={}
 for o in parts:
  offset=len(vertices);start=len(uvs);vertices.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices);local=[]
  for m in o.data.materials:local.append(len(materials));materials.append(m)
  for p in o.data.polygons:
   faces.append(tuple(offset+i for i in p.vertices));slots.append(local[p.material_index]);smooth.append(p.use_smooth);uvs.extend(tuple(o.data.uv_layers['Source UV'].data[i].uv) for i in p.loop_indices)
  offsets[o]=(start,len(uvs));o.hide_render=True
 mesh=bpy.data.meshes.new('Hallway '+key);mesh.from_pydata(vertices,[],faces);mesh.update()
 for m in materials:mesh.materials.append(m)
 for p,i,s in zip(mesh.polygons,slots,smooth):p.material_index=i;p.use_smooth=s
 source=mesh.uv_layers.new(name='Source UV')
 for loop,co in zip(source.data,uvs):loop.uv=co
 atlas=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=1;atlas.active_render=True
 helper=bpy.data.objects.new('Bake '+key,mesh);S.collection.objects.link(helper)
 bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004);bpy.ops.object.mode_set(mode='OBJECT')
 size=records[key]['resolution'][0];image=bpy.data.images.new(key,size,size,alpha=False,float_buffer=True)
 for m in materials:tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;m.node_tree.nodes.active=tx
 S.render.bake.margin=12;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.use_pass_glossy=False;S.render.bake.use_pass_transmission=False
 print('BAKING_HALLWAY_STYLE',key,flush=True);bpy.ops.object.bake(type='COMBINED')
 image.filepath_raw=str(OUT/(key+'.exr'));image.file_format='OPEN_EXR';image.save()
 # Denoise only illumination/color. Fine ink is added after filtering locally.
 clean=bpy.data.scenes.new('Filter');clean.render.engine='CYCLES';clean.cycles.samples=1;clean.collection.objects.link(cam);clean.camera=cam;clean.use_nodes=True
 n=clean.node_tree.nodes;n.clear();src=n.new('CompositorNodeImage');src.image=image;denoise=n.new('CompositorNodeDenoise');sink=n.new('CompositorNodeComposite');clean.node_tree.links.new(src.outputs['Image'],denoise.inputs[0]);clean.node_tree.links.new(denoise.outputs[0],sink.inputs[0]);clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3
 clean.render.resolution_x=size;clean.render.resolution_y=size;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(OUT/(key+'.png'));bpy.ops.render.render(scene=clean.name,write_still=True);bpy.data.scenes.remove(clean)
 baked=bpy.data.materials.new('Hallway style '+key);baked.use_nodes=True;n=baked.node_tree.nodes;n.clear();tx=n.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(OUT/(key+'.png')));em=n.new('ShaderNodeEmission');sink=n.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs[0],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],sink.inputs[0])
 for o,(start,end) in offsets.items():
  pending.append((o,baked,[tuple(co.uv) for co in list(mesh.uv_layers['Lighting UV'].data)[start:end]]));o.hide_render=False
 bpy.data.objects.remove(helper,do_unlink=True)
# All groups see original toon reflectance while baking; only now replace it
# with unlit images, so completed lightmaps never become emissive bounce sources.
for o,baked,coordinates in pending:
 for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
 layer=o.data.uv_layers.new(name='Lighting UV')
 for loop,co in zip(layer.data,coordinates):loop.uv=co
 o.data.materials.clear();o.data.materials.append(baked)
 for p in o.data.polygons:p.material_index=0
 o['texture_pixel_exact']=True
# Export only receiver meshes. NodeIO merges their new lightmaps/UVs into the
# unchanged runtime models, preserving every interactive prop and hierarchy.
for scene in bpy.data.scenes:
 for layer in scene.view_layers:
  for o in layer.objects:o.select_set(False,view_layer=layer)
for o in targets:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'hallway-style.glb'),use_selection=True,export_format='GLB',export_extras=True,export_image_format='AUTO')
(OUT/'report.json').write_text(json.dumps({'atlases':records,'lighting':lighting,'samples':1 if smoke else 64,'moonlightOnly':True,'toon':{'size':.58,'smooth':.035,'coolFillStrength':.30,'coolFillTint':[.30,.37,.55]},'sourceUVCorners':sum(o['hallway_source_uv_corners'] for o in targets),'mappedUVCorners':sum(o['hallway_source_uv_matched'] for o in targets)},indent=2)+'\n')
print('HALLWAY_STYLE_COMPLETE',flush=True)
