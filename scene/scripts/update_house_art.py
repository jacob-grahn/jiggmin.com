"""Synchronize supplied picture textures into existing editable room assemblies."""
import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[2]
placements=json.loads((R/'scene/house-textures/influences/placements.json').read_text())
lookup={p['node']:(R/'scene/house-textures/influences'/p['texture'],p['title']) for p in placements}
lookup['Bitey painting image']=(R/'scene/house-textures/bitey/bitey-credited.png','Bitey — Adam Phillips')
for file in ['house-attic.blend','house-hallway.blend','house-workshop.blend','house-basement.blend','house-connected.blend','house-release.blend']:
 path=R/'scene'/file
 if not path.exists():continue
 bpy.ops.wm.open_mainfile(filepath=str(path));changed=0
 for ob in list(bpy.data.objects):
  name=ob.get('source_object',ob.name)
  if name=='Bitey painting artist credit' or ob.name.endswith('Bitey painting artist credit'):
   bpy.data.objects.remove(ob,do_unlink=True);changed+=1;continue
  match=next((key for key in lookup if name==key or ob.name.endswith(key)),None)
  if not match or ob.type!='MESH':continue
  texture,title=lookup[match];image=bpy.data.images.load(str(texture),check_existing=True);image.pack()
  m=bpy.data.materials.new('Print '+title);m.use_nodes=True
  p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.85
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image
  m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.06
  ob.data=ob.data.copy();ob.data.materials.clear();ob.data.materials.append(m);ob['artwork_title']=title;changed+=1
 if changed:bpy.ops.wm.save_as_mainfile(filepath=str(path))
 print('ART_UPDATED',file,changed,flush=True)
