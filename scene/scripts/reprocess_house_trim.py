"""Reprocess existing irradiance locally, keeping its sampled geometry and UVs."""
import bpy,sys,json,shutil,hashlib,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from house_atlas_composite import compose_trim
from house_lightmap_filter import chart_masks,filter_irradiance
from house_atlas_composite import pixels
R=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index('--')+1:];D=Path(args[0]).resolve();OUT=Path(args[1]).resolve();OUT.mkdir(parents=True,exist_ok=True)
report=json.loads((D/'report.json').read_text());assert report['atlases']['hall-trim']['timberNormalScale']==1
manifest=json.loads((D.parent/'input-manifest.json').read_text())
# Ray-traced source data must still describe the current model, reflectance,
# lighting rig and source-UV transfer. Postprocessing code may change.
for name,value in manifest.items():
 if name.startswith('scene/') and name not in ['scene/scripts/bake_house_atlases.py','scene/scripts/house_lightmap_filter.py','scene/scripts/house_atlas_composite.py']:
  if hashlib.sha256((R/name).read_bytes()).hexdigest()!=value:raise RuntimeError('Source changed; rebake instead: '+name)
started=time.monotonic();bpy.ops.import_scene.gltf(filepath=str(D/'house-atlases.glb'))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('atlas_group')=='hall-trim'];assert len(parts)==report['atlases']['hall-trim']['objects']
vertices=[];faces=[];uvs=[]
for o in parts:
 start=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
 for p in o.data.polygons:faces.append(tuple(start+i for i in p.vertices));uvs.extend(tuple(o.data.uv_layers.active.data[i].uv)for i in p.loop_indices)
mesh=bpy.data.meshes.new('Saved trim charts');mesh.from_pydata(vertices,[],faces);mesh.update();uv=mesh.uv_layers.new(name='Lighting UV')
for loop,co in zip(uv.data,uvs):loop.uv=co
size=report['atlases']['hall-trim']['resolution'][0]
for f in ['hall-trim.exr','hall-trim-albedo.exr','source-audit.json']:
 shutil.copyfile(D/f,OUT/f)
light=bpy.data.images.load(str(OUT/'hall-trim.exr'));filtered,quality=filter_irradiance(pixels(light,size),list(chart_masks(mesh,uv,size)))
light=bpy.data.images.new('Reprocessed lighting',size,size,alpha=False,float_buffer=True);light.pixels.foreach_set(filtered.ravel());light.update();light.filepath_raw=str(OUT/'hall-trim-filtered.exr');light.file_format='OPEN_EXR';light.save()
(OUT/'hall-trim-quality.json').write_text(json.dumps({'threshold':.12,'sigmaTexels':4,'charts':quality},indent=2)+'\n')
cam=bpy.data.objects.new('Composite camera',bpy.data.cameras.new('Composite camera'));bpy.context.scene.collection.objects.link(cam)
error=compose_trim(OUT,size,cam)
image=bpy.data.images.load(str(OUT/'hall-trim.png'),check_existing=False)
for o in parts:
 for m in o.data.materials:
  for node in m.node_tree.nodes:
   if node.type=='TEX_IMAGE':node.image=image
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'house-atlases.glb'),use_selection=True,export_format='GLB',export_extras=True,export_image_format='AUTO')
record=report['atlases']['hall-trim'];record['compositionMaxError']=error;record['maxSpeckleScore']=max(r.get('filteredScore',0)for r in quality);record['postprocessSeconds']=round(time.monotonic()-started,2)
report['atlases']={'hall-trim':record};report['objects']=len(parts);report['selectedGroups']=['hall-trim'];report['postprocessOnly']=True;report['reprocessedFrom']=str(D)
report['sampledInputManifest']=str(D.parent/'input-manifest.json');report['sampledPassHashes']={f:hashlib.sha256((D/f).read_bytes()).hexdigest()for f in ['hall-trim.exr','hall-trim-albedo.exr','house-atlases.glb']}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('TRIM_REPROCESS_COMPLETE',error,record['maxSpeckleScore'])
