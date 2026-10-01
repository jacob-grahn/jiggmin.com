"""Restore original surface materials in the editable production scene.
Run against house-release.blend; the approved layout and camera paths are unchanged.
The browser retains original lightmaps and uses the live den directly.
"""
import bpy,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
originals=list(bpy.context.scene.objects);palette={}
for room,wanted in [('hallway',{'Corridor paint':['plaster','wall'],'wood':['wood','door','trim','roof'],'oak':['oak','floor'],'Quiet ceiling':['cream']}),('basement',{'Cellar painted plaster':['masonry'],'concrete':['concrete']})]:
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'scene/exports/house/{room}.glb'))
 imported=list(set(bpy.data.objects)-before)
 for o in imported:
  for m in getattr(o.data,'materials',[]):
   if not m:continue
   key=re.sub(r'\.\d{3}$','',m.name)
   for kind in wanted.get(key,[]):palette[kind]=m
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
with bpy.data.libraries.load(str(ROOT/'scene/midnight-den-illustrated.blend'),link=False) as (src,dst):
 names=list(src.materials);dst.materials=names.copy()
native=dict(zip(names,dst.materials));restored=0
for o in originals:
 if not hasattr(o.data,'materials') or o.get('workshop_plywood'):continue
 for i,m in enumerate(o.data.materials):
  if not m:continue
  kind=m.name.split(' / ')[-1]
  if o.get('release_room')=='structure' and kind in palette:o.data.materials[i]=palette[kind];restored+=1
  elif o.get('source_room')=='den':
   name=m.name.removeprefix('Preview PBR / ')
   source=native.get(name) or native.get(re.sub(r'\.\d{3}$','',name))
   if source:o.data.materials[i]=source;restored+=1
# The approved original rooms have their practical lights switched off.
for o in originals:
 if o.type=='LIGHT' and o.get('preview_light'):o.data.energy=0
from house_finishes import apply_house_finishes
apply_house_finishes(bpy.context.scene)
bpy.context.scene['house_style']='original'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene/house-release.blend'),compress=True)
print('ORIGINAL_STYLE_RESTORED',restored,flush=True)
