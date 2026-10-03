"""Additive fixture bake with the original house's occluders and window rig.
Existing room geometry and lighting atlases are preserved.
"""
import bpy,sys,json,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from house_smoke_detectors import create_smoke_detectors,PLACEMENTS
source=ROOT/'scene/scripts/bake_house_release.py'
exec(compile(source.read_text().split('lighting=configure(S);')[0],str(source),'exec'),globals())
out=ROOT/'scene/exports/house-release/smoke-detectors';out.mkdir(parents=True,exist_ok=True)
detectors=create_smoke_detectors(S);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in detectors:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'source.glb'),use_selection=True,export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_animations=False)
lighting=configure(S);S.cycles.samples=64;S.cycles.use_denoising=True
# The original cellar window cones illuminate below this ceiling. Approximate
# their soft reflected floor light for this fixture's bake only; never export it.
from mathutils import Vector
fill=bpy.data.lights.new('Cellar reflected window fill','AREA');fill.energy=4;fill.color=(.24,.48,1);fill.shape='DISK';fill.size=2
lamp=bpy.data.objects.new('Cellar reflected window fill',fill);S.collection.objects.link(lamp);lamp.location=(3.36,-2.4,-1.25)
lamp.rotation_euler=(Vector((3.36,-2.4,-.243))-lamp.location).to_track_quat('-Z','Y').to_euler()
lighting={**lighting,'fixtureBounceFill':{'room':'basement','watts':4,'bakedOnly':True}}
S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=8
# Smart-project each detector into one third of a shared 1024 atlas.
for i,o in enumerate(detectors):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.04);bpy.ops.object.mode_set(mode='OBJECT')
 for entry in o.data.uv_layers.active.data:entry.uv.x=(entry.uv.x*.94+.03+i)/3;entry.uv.y=entry.uv.y*.94+.03
image=bpy.data.images.new('Smoke detector lighting',1024,1024,alpha=False,float_buffer=True)
for o in detectors:
 for i,original in enumerate(list(o.data.materials)):
  m=original.copy();o.data.materials[i]=m;tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;m.node_tree.nodes.active=tx
bpy.ops.object.select_all(action='DESELECT')
for o in detectors:o.select_set(True)
bpy.context.view_layer.objects.active=detectors[0];print('SMOKE_DETECTOR_BAKE',flush=True);start=time.monotonic();bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(out/'lighting.exr');image.file_format='OPEN_EXR';image.save()
clean=bpy.data.scenes.new('Smoke detector grading');clean.render.engine='CYCLES';clean.cycles.samples=1
cam=bpy.data.objects.new('Smoke bake camera',bpy.data.cameras.new('Smoke bake camera'));clean.collection.objects.link(cam);clean.camera=cam;clean.use_nodes=True
nodes=clean.node_tree.nodes;nodes.clear();src=nodes.new('CompositorNodeImage');src.image=image;denoise=nodes.new('CompositorNodeDenoise');grade=nodes.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=nodes.new('CompositorNodeComposite')
clean.node_tree.links.new(src.outputs['Image'],denoise.inputs['Image']);clean.node_tree.links.new(denoise.outputs['Image'],grade.inputs['Image']);clean.node_tree.links.new(grade.outputs['Image'],sink.inputs['Image'])
clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3;clean.render.resolution_x=1024;clean.render.resolution_y=1024;clean.render.resolution_percentage=100
clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(out/'lighting.png');bpy.ops.render.render(scene=clean.name,write_still=True)
baked_image=bpy.data.images.load(str(out/'lighting.png'));baked=bpy.data.materials.new('Baked / smoke-detectors');baked.use_nodes=True
nodes=baked.node_tree.nodes;nodes.clear();tx=nodes.new('ShaderNodeTexImage');tx.image=baked_image;em=nodes.new('ShaderNodeEmission');sink=nodes.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],sink.inputs[0])
for o in detectors:
 o.data.materials.clear();o.data.materials.append(baked)
 for p in o.data.polygons:p.material_index=0
 o['release_baked']='smoke-detectors';o['house_window_bake']=True
bpy.ops.object.select_all(action='DESELECT')
for o in detectors:o.select_set(True)
bpy.context.view_layer.objects.active=detectors[0]
bpy.ops.export_scene.gltf(filepath=str(out/'baked.glb'),use_selection=True,export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_animations=False)
occluder_sources=[ROOT/'scene/house-release.blend',*[INPUT/f'{room}.glb' for room in ['structure','basement','attic']],source,ROOT/'scene/scripts/house_bake_lighting.py',ROOT/'scene/scripts/house_bake_groups.py']
report={'samples':64,'resolution':1024,'lighting':lighting,'placements':PLACEMENTS,'seconds':round(time.monotonic()-start,2),'houseSourceKey':hashlib.sha256(b''.join(p.read_bytes() for p in occluder_sources)).hexdigest(),'recipeHash':hashlib.sha256(Path(__file__).read_bytes()+(ROOT/'scene/scripts/house_smoke_detectors.py').read_bytes()).hexdigest(),'sourceGLBHash':hashlib.sha256((out/'source.glb').read_bytes()).hexdigest(),'bakedGLBHash':hashlib.sha256((out/'baked.glb').read_bytes()).hexdigest()}
(out/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n');print('SMOKE_DETECTOR_BAKE_COMPLETE',report,flush=True)
