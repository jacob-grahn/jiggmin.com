"""Rebake smooth hallway ceiling paint on the released geometry, in its own atlas."""
import bpy, sys, json, time, hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
# Reuse the production reflectance/occluder assembly, without its full bake.
source=R/'scene/scripts/bake_house_release.py'
exec(compile(source.read_text().split('# Validate every selected receiver')[0],str(source),'exec'),globals())
for obj in objects:
 if obj.get('house_bake_source','').startswith('Finish / ceiling moulding') and canonical(obj.get('house_bake_source')) not in native_by_name:obj.hide_render=True
out=R/'scene/exports/house-release/hall-ceiling';out.mkdir(parents=True,exist_ok=True)
spec=json.loads((R/'scene/house-finishes.json').read_text())['ceiling']
paint=bpy.data.materials.new('Smooth hallway ceiling paint');paint.use_nodes=True
p=paint.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*spec['linear_rgb'],1);p.inputs['Roughness'].default_value=spec['roughness']
# No colour texture, normal map, bump, or roughness variation.
before=set(S.objects)
bpy.ops.import_scene.gltf(filepath=str(R/'web/assets/house/release/structure/hallway.glb'))
imported=list(set(S.objects)-before);targets=[]
for o in imported:
 o.hide_render=True
 if o.type!='MESH' or o.get('preview_kind')!='ceiling' or not o.name.startswith('Attic floor'):continue
 targets.append(o)
 identity=o.get('house_bake_id')
 for old in objects:
  if old.get('house_bake_id')==identity:old.hide_render=True
 o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(paint);o.hide_render=False
 for poly in o.data.polygons:poly.material_index=0
if not targets:raise RuntimeError('Missing released hallway ceilings')
validate_objects(targets,uv_provenance)
targets.sort(key=lambda o:o['house_bake_id'])
# Bake only the underside. Leave floor/top faces intact when installing the patch.
verts=[];faces=[];offsets={}
for o in targets:
 start=len(faces);base=len(verts);verts.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices)
 normal=o.matrix_world.to_3x3().inverted().transposed()
 for poly in o.data.polygons:
  if (normal@poly.normal).normalized().z<-.9:faces.append(tuple(base+i for i in poly.vertices))
 offsets[o]=(start,len(faces))
mesh=bpy.data.meshes.new('Hall ceiling underside bake');mesh.from_pydata(verts,[],faces);mesh.update();mesh.materials.append(paint.copy())
helper=bpy.data.objects.new('Hall ceiling underside bake',mesh);S.collection.objects.link(helper)
# The helper replaces underside geometry while baking; don't double the slab.
for o in targets:o.hide_render=True
bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
uv=mesh.uv_layers.new(name='Lighting UV')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
from hall_ceiling_uv import pack_ceiling_uv
pack_ceiling_uv(mesh,mesh.uv_layers['Lighting UV'])
# Operators can replace the UV layer's storage; keep plain coordinates rather
# than an RNA layer reference across bake/compositor operations.
texcoords_snapshot=[tuple(entry.uv) for entry in mesh.uv_layers['Lighting UV'].data]
cache_sources=[source,Path(__file__),R/'scene/scripts/house_bake_uv_guard.py',R/'scene/scripts/house_source_uv.py',R/'scene/scripts/hall_ceiling_uv.py',R/'scene/house-release.blend',R/'scene/scripts/house_bake_lighting.py',*[INPUT/f'{room}.glb' for room in ['structure','basement','attic']]]
geometry_key=hashlib.sha256(json.dumps([verts,faces,[o['house_bake_id'] for o in targets],spec]).encode()+b''.join(path.read_bytes() for path in cache_sources)).hexdigest()
reuse='--reuse-lighting' in sys.argv
if reuse:
 cached=json.loads((out/'uv-layout.json').read_text())
 if cached.get('geometryKey')!=geometry_key:raise RuntimeError('Cached ceiling UVs do not match this geometry; run a new bake')
 texcoords_snapshot=[tuple(co) for face in cached['faces'] for co in face]
(out/'uv-layout.json').write_text(json.dumps({'geometryKey':geometry_key,'faces':[[texcoords_snapshot[i] for i in face.loop_indices] for face in mesh.polygons],'objects':[o.get('house_bake_id') for o in targets]}))
lighting=configure(S);S.cycles.samples=64;S.cycles.use_denoising=False
S.render.use_freestyle=False;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=16
S.render.bake.margin_type='EXTEND'
image=bpy.data.images.new('Hall ceiling lighting',2048,2048,alpha=False,float_buffer=True)
m=mesh.materials[0];tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;m.node_tree.nodes.active=tx
print('HALL_CEILING_BAKE',len(targets),len(faces),flush=True);started=time.monotonic()
if not reuse:
 bpy.ops.object.bake(type='DIFFUSE')
 image.filepath_raw=str(out/'lighting.exr');image.file_format='OPEN_EXR';image.save()
clean=bpy.data.scenes.new('Ceiling denoise and grade');clean.render.engine='CYCLES';clean.cycles.samples=1;clean.use_nodes=True
cam=bpy.data.objects.new('Ceiling filter camera',bpy.data.cameras.new('Ceiling filter camera'));clean.collection.objects.link(cam);clean.camera=cam
n=clean.node_tree.nodes;l=clean.node_tree.links;n.clear();src=n.new('CompositorNodeImage');src.image=image;denoise=n.new('CompositorNodeDenoise');grade=n.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=n.new('CompositorNodeComposite')
l.new(src.outputs['Image'],denoise.inputs['Image']);l.new(denoise.outputs['Image'],grade.inputs['Image']);l.new(grade.outputs['Image'],sink.inputs['Image'])
clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3;clean.render.resolution_x=2048;clean.render.resolution_y=2048;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(out/'lighting.png')
if not reuse:bpy.ops.render.render(scene=clean.name,write_still=True)
baked=bpy.data.materials.new('Baked / smooth-hall-ceiling');baked.use_nodes=True;n=baked.node_tree.nodes;n.clear();tx=n.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(out/'lighting.png'));em=n.new('ShaderNodeEmission');sink=n.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],sink.inputs[0])
# Export one underside patch per original object, in world coordinates. Installer
# retains the untouched triangles and verifies each patch against the old surface.
patches=[]
for o,(start,end) in offsets.items():
 if start==end:continue
 faceset=list(mesh.polygons)[start:end];coordinates=[];polygons=[];texcoords=[]
 for face in faceset:
  base=len(coordinates)
  for li in face.loop_indices:
   coordinates.append(tuple(mesh.vertices[mesh.loops[li].vertex_index].co));texcoords.append(texcoords_snapshot[li])
  polygons.append(tuple(range(base,len(coordinates))))
 data=bpy.data.meshes.new(o.name+' smooth underside');data.from_pydata(coordinates,[],polygons);data.update();data.materials.append(baked);layer=data.uv_layers.new(name='Lighting UV')
 for loop,co in zip(layer.data,texcoords):loop.uv=co
 patch=bpy.data.objects.new(o.name+' smooth underside',data);S.collection.objects.link(patch);patch['house_bake_id']=o['house_bake_id'];patch['release_baked']='smooth-hall-ceiling';patches.append(patch)
bpy.ops.object.select_all(action='DESELECT')
for o in patches:o.select_set(True)
bpy.context.view_layer.objects.active=patches[0]
bpy.ops.export_scene.gltf(filepath=str(out/'baked.glb'),use_selection=True,export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_animations=False)
report={'samples':64,'resolution':2048,'objects':len(patches),'seconds':None if reuse else round(time.monotonic()-started,2),'recoveredLighting':reuse,'lighting':lighting,'material':spec,'normalMap':False,'colourTexture':False,'denoised':True}
(out/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('HALL_CEILING_COMPLETE',report,flush=True)
