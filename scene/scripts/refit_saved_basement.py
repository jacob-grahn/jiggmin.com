"""Synchronize both native scenes with the basement model refit, without a bake."""
import bpy,re,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from basement_model_refit import refit,import_source,SPEC
old_shell=re.compile(r'^(?:Finish / )?(Basement masonry|Basement slab|basement joist|cellar mortar|cellar side|cellar rear|Basement utility light)',re.I)
for filename in ['house-plan-preview.blend','house-release.blend']:
 path=ROOT/'scene'/filename;bpy.ops.wm.open_mainfile(filepath=str(path))
 for obj in list(bpy.context.scene.objects):
  if obj.get('source_room')=='basement' or old_shell.match(obj.name):bpy.data.objects.remove(obj,do_unlink=True)
 loaded=import_source(ROOT/'scene/exports/house/basement.glb');bpy.context.view_layer.update();keep=[]
 collection=bpy.data.collections.get('02 Existing contents / basement')
 if collection is None:
  collection=bpy.data.collections.new('02 Existing contents / basement');bpy.context.scene.collection.children.link(collection)
 for obj in loaded:
  # Omit the old room's disconnected stairs; keep the approved connected stair.
  if obj.type!='MESH' or obj.get('bake_connection'):continue
  obj['source_object']=obj.get('source_object',obj.name);obj['source_room']='basement';obj['release_room']='basement'
  if obj['source_object'].startswith('Basement ceiling'):kind='ceiling'
  elif obj['source_object'].startswith('Concrete slab'):kind='floor'
  elif re.match(SPEC['architecture'],obj['source_object']) or re.match(r'^(Garden beyond window|Window (jamb|rail|cross|transom)|Deep sill)',obj['source_object']):kind='shell'
  else:kind='contents'
  obj['preview_kind']=kind
  for c in list(obj.users_collection):c.objects.unlink(obj)
  collection.objects.link(obj);keep.append(obj)
 # Capture imported matrices before detaching original hierarchy objects.
 bpy.context.view_layer.update();refit(keep)
 for obj in loaded:
  if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
 report=json.loads(bpy.context.scene.get('preview_source_report','{}'));report.setdefault('basement',{})['staging_scale']=[1,1,1];report['basement']['model_refit']='Envelope geometry resized; furnishings moved as rigid assemblies'
 bpy.context.scene['preview_source_report']=json.dumps(report)
 bpy.context.scene['basement_staging_scale']=[1,1,1]
 bpy.context.scene['basement_model_refit']='Geometry envelope resized; furnishings moved as rigid assemblies'
 bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('BASEMENT MODEL REFIT',filename,len(keep),flush=True)
