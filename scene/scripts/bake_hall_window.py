"""Bake all six hallway window members with a minimum texel width per face."""
import bpy, sys, json, time
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
source=R/'scene/scripts/bake_house_release.py'
exec(compile(source.read_text().split('# Validate every selected receiver')[0],str(source),'exec'),globals())
out=R/'scene/exports/house-release/hall-window';out.mkdir(parents=True,exist_ok=True)
# Native source finishes replace the already lit runtime frame.
targets=[o for o in objects if o.get('house_bake_source','').startswith('Finish / hall-right') and o.get('house_window_receiver') and 'glass' not in o.get('house_bake_source','')]
if len(targets)!=6:raise RuntimeError('Missing hallway frame receivers')
validate_objects(targets,uv_provenance)
targets.sort(key=lambda o:o['house_bake_id'])
# Old crown boards are also absent from the editable scene. Stale bake inputs
# must not cast their shadows in this dedicated bake.
for o in objects:
 if o.get('house_bake_source','').startswith('Finish / ceiling moulding'):o.hide_render=True
verts=[];faces=[];slots=[];materials=[];offsets={}
for o in targets:
 start=len(faces);base=len(verts);verts.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices)
 local=[]
 for m in o.data.materials:
  if m not in materials:materials.append(m)
  local.append(materials.index(m))
 for p in o.data.polygons:
  faces.append(tuple(base+i for i in p.vertices));slots.append(local[p.material_index])
 offsets[o]=(start,len(faces));o.hide_render=True
mesh=bpy.data.meshes.new('Hall window lighting receiver');mesh.from_pydata(verts,[],faces);mesh.update()
for m in materials:mesh.materials.append(m.copy())
for face,slot in zip(mesh.polygons,slots):face.material_index=slot
helper=bpy.data.objects.new('Hall window lighting receiver',mesh);S.collection.objects.link(helper)
uv=mesh.uv_layers.new(name='Lighting UV')
# A separate padded cell for every planar face. Long thin frame faces need a
# minimum width, rather than area-proportional packing into a shared room atlas.
size=1024
from hall_window_finish import pack_window_uv
pack_window_uv(mesh,uv,size)
texcoords=[tuple(entry.uv) for entry in uv.data]
lighting=configure(S);S.cycles.samples=64;S.cycles.use_denoising=False
S.render.use_freestyle=False;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=12
image=bpy.data.images.new('Hall window lighting',size,size,alpha=False,float_buffer=True)
for m in mesh.materials:
 tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;m.node_tree.nodes.active=tx
bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
print('HALL_WINDOW_BAKE',len(targets),len(faces),flush=True);started=time.monotonic();bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(out/'lighting.exr');image.file_format='OPEN_EXR';image.save()
clean=bpy.data.scenes.new('Window denoise and grade');clean.render.engine='CYCLES';clean.cycles.samples=1;clean.use_nodes=True
cam=bpy.data.objects.new('Window filter camera',bpy.data.cameras.new('Window filter camera'));clean.collection.objects.link(cam);clean.camera=cam
n=clean.node_tree.nodes;l=clean.node_tree.links;n.clear();src=n.new('CompositorNodeImage');src.image=image;denoise=n.new('CompositorNodeDenoise');grade=n.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=n.new('CompositorNodeComposite')
l.new(src.outputs['Image'],denoise.inputs['Image']);l.new(denoise.outputs['Image'],grade.inputs['Image']);l.new(grade.outputs['Image'],sink.inputs['Image'])
clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3;clean.render.resolution_x=size;clean.render.resolution_y=size;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(out/'lighting.png')
bpy.ops.render.render(scene=clean.name,write_still=True)
baked=bpy.data.materials.new('Baked / smooth-hall-window');baked.use_nodes=True;n=baked.node_tree.nodes;n.clear();tx=n.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(out/'lighting.png'));em=n.new('ShaderNodeEmission');sink=n.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],sink.inputs[0])
patches=[]
for o,(start,end) in offsets.items():
 coordinates=[];polygons=[];coords=[]
 for face in list(mesh.polygons)[start:end]:
  base=len(coordinates)
  for li in face.loop_indices:
   coordinates.append(tuple(mesh.vertices[mesh.loops[li].vertex_index].co));coords.append(texcoords[li])
  polygons.append(tuple(range(base,len(coordinates))))
 data=bpy.data.meshes.new(o.name+' smooth');data.from_pydata(coordinates,[],polygons);data.update();data.materials.append(baked);layer=data.uv_layers.new(name='Lighting UV')
 for loop,co in zip(layer.data,coords):loop.uv=co
 patch=bpy.data.objects.new(o.name+' smooth',data);S.collection.objects.link(patch);patch['house_bake_id']=o['house_bake_id'];patches.append(patch)
bpy.ops.object.select_all(action='DESELECT')
for o in patches:o.select_set(True)
bpy.context.view_layer.objects.active=patches[0]
bpy.ops.export_scene.gltf(filepath=str(out/'baked.glb'),use_selection=True,export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_animations=False)
report={'samples':64,'resolution':size,'minimumFaceWidth':minimum,'objects':len(patches),'seconds':round(time.monotonic()-started,2),'lighting':lighting,'denoised':True,'finish':'smooth original palette'}
(out/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('HALL_WINDOW_COMPLETE',report,flush=True)
