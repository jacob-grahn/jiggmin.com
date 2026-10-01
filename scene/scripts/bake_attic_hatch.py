"""Bake the moving hatch's closed-pose surface; never bake its moving shadow."""
import bpy,sys,json,hashlib,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
recipe=ROOT/'scene/scripts/bake_house_release.py'
exec(compile(recipe.read_text().split('lighting=configure(S);')[0],str(recipe),'exec'),globals())
out=ROOT/'scene/exports/house-release/attic-hatch';out.mkdir(parents=True,exist_ok=True)
hatch=next(o for o in objects if o.get('house_bake_source')=='Attic hatch')
hatch.hide_render=False;hatch.hide_set(False)
lighting=configure(S);S.cycles.samples=64;S.cycles.use_denoising=True
S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=8
bpy.ops.object.select_all(action='DESELECT');hatch.select_set(True);bpy.context.view_layer.objects.active=hatch
# Keep the wood's source UVs while packing a separate lighting chart.
mesh=hatch.data;source_uv=mesh.uv_layers.active
if source_uv is None:
 source_uv=mesh.uv_layers.new(name='Source UV');mesh.update()
 low=[min(v.co[i] for v in mesh.vertices) for i in range(3)];high=[max(v.co[i] for v in mesh.vertices) for i in range(3)]
 for p in mesh.polygons:
  axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
  for li in p.loop_indices:
   point=mesh.vertices[mesh.loops[li].vertex_index].co
   source_uv.data[li].uv=tuple((point[i]-low[i])/max(high[i]-low[i],1e-6) for i in axes)
source_uv.name='Source UV'
for i,old in enumerate(list(mesh.materials)):
 m=old.copy();m.use_nodes=True;mesh.materials[i]=m
 for n in m.node_tree.nodes:
  if n.type=='UVMAP':n.uv_map='Source UV'
  if n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked:
   uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Source UV';m.node_tree.links.new(uv.outputs['UV'],n.inputs['Vector'])
atlas=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=len(mesh.uv_layers)-1;atlas.active_render=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('Attic hatch closed lighting',512,512,alpha=False,float_buffer=True)
for m in mesh.materials:
 n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
start=time.monotonic();print('HATCH_BAKE',flush=True);bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(out/'lighting.exr');image.file_format='OPEN_EXR';image.save()
clean=bpy.data.scenes.new('Hatch grading');clean.render.engine='CYCLES';clean.cycles.samples=1
cam=bpy.data.objects.new('Hatch grading camera',bpy.data.cameras.new('Hatch grading camera'));clean.collection.objects.link(cam);clean.camera=cam
clean.use_nodes=True;nodes=clean.node_tree.nodes;nodes.clear();src=nodes.new('CompositorNodeImage');src.image=image;denoise=nodes.new('CompositorNodeDenoise');grade=nodes.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=nodes.new('CompositorNodeComposite')
clean.node_tree.links.new(src.outputs['Image'],denoise.inputs['Image']);clean.node_tree.links.new(denoise.outputs['Image'],grade.inputs['Image']);clean.node_tree.links.new(grade.outputs['Image'],sink.inputs['Image'])
clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3;clean.render.resolution_x=512;clean.render.resolution_y=512;clean.render.resolution_percentage=100
clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(out/'lighting.png');bpy.ops.render.render(scene=clean.name,write_still=True)
mat=bpy.data.materials.new('Baked / attic hatch closed');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();tx=nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(out/'lighting.png'));em=nodes.new('ShaderNodeEmission');sink=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);mat.node_tree.links.new(em.outputs[0],sink.inputs[0])
mesh.materials.clear();mesh.materials.append(mat)
for p in mesh.polygons:p.material_index=0
for uv in list(mesh.uv_layers):
 if uv.name!='Lighting UV':mesh.uv_layers.remove(uv)
hatch['release_baked']='attic-hatch-closed';hatch['hatch_reference_baked']=True
bpy.ops.object.select_all(action='DESELECT');hatch.select_set(True);bpy.context.view_layer.objects.active=hatch
bpy.ops.export_scene.gltf(filepath=str(out/'baked.glb'),use_selection=True,export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_animations=False)
paths=[ROOT/'scene/house-release.blend',*[INPUT/f'{room}.glb' for room in ['structure','basement','attic']],recipe,ROOT/'scene/scripts/house_bake_lighting.py']
report={'samples':64,'resolution':512,'lighting':lighting,'houseSourceKey':hashlib.sha256(b''.join(p.read_bytes() for p in paths)).hexdigest(),'recipeHash':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'seconds':round(time.monotonic()-start,2),'bakedGLBHash':hashlib.sha256((out/'baked.glb').read_bytes()).hexdigest()}
(out/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('HATCH_BAKE_COMPLETE',report,flush=True)
