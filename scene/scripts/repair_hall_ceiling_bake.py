"""Targeted higher-sample ceiling bake using the completed bake's exact scene/UVs.
Does not overwrite source scenes, bake inputs, or the existing completed atlas.
"""
import bpy,sys,json,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
source=ROOT/'scene/scripts/bake_house_release.py'
# Share the exact original scene/material setup, stopping before atlas packing.
setup=source.read_text().split('lighting=configure(S);')[0]
exec(compile(setup,str(source),'exec'),globals())
def world_shape(obj):
 return tuple(sorted({tuple(round(c*10000) for c in obj.matrix_world@v.co) for v in obj.data.vertices}))
# The source snapshot records the completed bake; remove only the explicitly
# reviewed coincident copies when computing new ceiling shadows.
repairs=json.loads((ROOT/'scene/exports/house-release/trim-source-repair/duplicates.json').read_text())
by_id={o.get('house_bake_id'):o for o in objects}
for pair in repairs:
 obj=by_id[pair['id']];keep=by_id[pair['retained']]
 if world_shape(obj)!=world_shape(keep):raise RuntimeError('Repair geometry mismatch')
 obj.hide_render=True
# Read the already-packed Lighting UVs, avoiding any repack of existing atlases.
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'scene/exports/house-release/final/structure-lighting.glb'))
patches=list(set(bpy.data.objects)-before);bpy.context.view_layer.update()
receivers=[o for o in patches if o.type=='MESH' and (o.get('house_bake_source','').startswith('Attic floor / hall ceiling') or 'ceiling moulding' in o.get('house_bake_source','')) and o.get('release_baked')=='structure-hall' and o.get('house_bake_id') not in {pair['id'] for pair in repairs}]
vertices=[];faces=[];uvs=[];ids=[]
for o in receivers:
 ids.append(o['house_bake_id']);offset=len(vertices);vertices.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices)
 uv=o.data.uv_layers.active
 for p in o.data.polygons:
  faces.append(tuple(offset+i for i in p.vertices));uvs.extend(tuple(uv.data[i].uv) for i in p.loop_indices)
 by_id[o['house_bake_id']].hide_render=True
for o in patches:bpy.data.objects.remove(o,do_unlink=True)
if len(receivers)<6:raise RuntimeError('Missing hallway ceiling receivers')
mesh=bpy.data.meshes.new('Hall ceiling bake receiver');mesh.from_pydata(vertices,[],faces);mesh.update();layer=mesh.uv_layers.new(name='Lighting UV')
for entry,co in zip(layer.data,uvs):entry.uv=co
mesh.materials.append(cream.copy());helper=bpy.data.objects.new('Hall ceiling bake receiver',mesh);S.collection.objects.link(helper)
lighting=configure(S);samples=int(sys.argv[sys.argv.index('--samples')+1]) if '--samples' in sys.argv else 256
resolution=int(sys.argv[sys.argv.index('--resolution')+1]) if '--resolution' in sys.argv else 4096
S.cycles.samples=samples;S.cycles.use_denoising=False;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=12
image=bpy.data.images.new('Hall ceiling higher sample lighting',resolution,resolution,alpha=False,float_buffer=True)
material=mesh.materials[0];tx=material.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;material.node_tree.nodes.active=tx
bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
out=ROOT/'scene/exports/house-release/ceiling-repair';out.mkdir(parents=True,exist_ok=True)
recipe=Path(__file__).read_bytes();report=json.loads((ROOT/'scene/exports/house-release/final/bake-report.json').read_text())
paths=[ROOT/'scene/house-release.blend',INPUT/'structure.glb',INPUT/'basement.glb',source,ROOT/'scene/scripts/house_bake_lighting.py']
if hashlib.sha256(b''.join(p.read_bytes() for p in paths)).hexdigest()!=report['sourceKey']:raise RuntimeError('Completed bake no longer matches these source snapshots')
recipe_name='bake-recipe-'+hashlib.sha256(recipe).hexdigest()[:12]+'.py'
(out/recipe_name).write_bytes(recipe)
(out/f'ceiling-{samples}-{resolution}-source.json').write_text(json.dumps({'baseSourceKey':report['sourceKey'],'recipeHash':hashlib.sha256(recipe).hexdigest(),'recipeSnapshot':str((out/recipe_name).relative_to(ROOT)),'samples':samples,'resolution':resolution},indent=2)+'\n')
print('CEILING_BAKE',samples,resolution,ids,flush=True);start=time.monotonic();bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(out/f'ceiling-{samples}-{resolution}.exr');image.file_format='OPEN_EXR';image.save()
# Same grading as the completed house bake.
clean=bpy.data.scenes.new('Ceiling bake denoise');clean.render.engine='CYCLES';clean.cycles.samples=1
cam=bpy.data.objects.new('Ceiling filter camera',bpy.data.cameras.new('Ceiling filter camera'));clean.collection.objects.link(cam);clean.camera=cam;clean.use_nodes=True
nodes=clean.node_tree.nodes;nodes.clear();src=nodes.new('CompositorNodeImage');src.image=image;denoise=nodes.new('CompositorNodeDenoise');grade=nodes.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2;sink=nodes.new('CompositorNodeComposite')
clean.node_tree.links.new(src.outputs['Image'],denoise.inputs['Image']);clean.node_tree.links.new(denoise.outputs['Image'],grade.inputs['Image']);clean.node_tree.links.new(grade.outputs['Image'],sink.inputs['Image'])
clean.view_settings.view_transform='AgX';clean.view_settings.exposure=-1.3;clean.render.resolution_x=resolution;clean.render.resolution_y=resolution;clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB';clean.render.filepath=str(out/f'ceiling-{samples}-{resolution}.png');bpy.ops.render.render(scene=clean.name,write_still=True)
(out/f'ceiling-{samples}-{resolution}.json').write_text(json.dumps({'samples':samples,'resolution':resolution,'receivers':ids,'duplicatesExcluded':[pair['id'] for pair in repairs],'lighting':lighting,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
print('CEILING_BAKE_COMPLETE',round(time.monotonic()-start,2),flush=True)
