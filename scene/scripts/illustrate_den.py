"""Ink-and-cel art direction. Run against midnight-den-detailed.blend.

--preview renders the original camera; otherwise export matching wide plates.
Original source files and the collision/interaction geometry are preserved.
"""
import bpy, sys, runpy
from pathlib import Path
R=Path(__file__).resolve().parents[2]
S=bpy.context.scene
runpy.run_path(str(R/'scene/scripts/complete_den.py'))['complete']()
S['illustrated_den']=True
S['art_direction_reference']='docs/art-direction/den/midnight-ink-target.png'
runpy.run_path(str(R/'scene/scripts/den_ink_materials.py'))['decorate']()
# Retain the original texture coordinates and artwork, but replace the glossy
# response with a narrow diffuse toon lobe and a little violet ambient ink.
for m in list(bpy.data.materials):
 if not m.use_nodes: continue
 n=m.node_tree.nodes; l=m.node_tree.links
 p=next((x for x in n if x.type=='BSDF_PRINCIPLED'),None)
 out=next((x for x in n if x.type=='OUTPUT_MATERIAL'),None)
 if not p or not out: continue
 if p.inputs['Emission Strength'].default_value>0: continue
 toon=n.new('ShaderNodeBsdfToon');toon.component='DIFFUSE'
 toon.inputs['Size'].default_value=.58;toon.inputs['Smooth'].default_value=.015
 color=p.inputs['Base Color']
 if color.is_linked:l.new(color.links[0].from_socket,toon.inputs['Color'])
 else:toon.inputs['Color'].default_value=color.default_value
 # A small colored fill keeps deep shadows legible without a glossy wash.
 ambient=n.new('ShaderNodeEmission');ambient.inputs['Strength'].default_value=.30
 tint=n.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
 tint.inputs[2].default_value=(.30,.23,.48,1)
 if color.is_linked:l.new(color.links[0].from_socket,tint.inputs[1])
 else:tint.inputs[1].default_value=color.default_value
 l.new(tint.outputs[0],ambient.inputs['Color'])
 add=n.new('ShaderNodeAddShader');l.new(toon.outputs[0],add.inputs[0]);l.new(ambient.outputs[0],add.inputs[1]);l.new(add.outputs[0],out.inputs['Surface'])
# Rebalance the existing practical lights for broad, readable colored shapes.
for name,power in [('Moon through rain',420),('Amber lamplight',90),('Warm ceiling bounce',45),('Soft camera fill',35),('Lamp practical bulb',30),('Soft phosphor on hands',38)]:
 if name in bpy.data.objects:bpy.data.objects[name].data.energy=power
# Small light sources yield composed, crisp cast shadows.
for o in S.objects:
 if o.type=='LIGHT':
  if o.data.type=='AREA':o.data.size=min(o.data.size,.22)
  if o.data.type=='POINT':o.data.shadow_soft_size=.035
# Ink silhouettes and structural creases, not every triangulation or material seam.
S.render.use_freestyle=True
S.render.line_thickness=1.0
fs=bpy.context.view_layer.freestyle_settings
fs.crease_angle=2.35
ls=fs.linesets[0] if fs.linesets else fs.linesets.new('Den ink')
ls.select_silhouette=True;ls.select_border=True;ls.select_crease=False
ink_collection=bpy.data.collections.new('Illustrated contour sources');S.collection.children.link(ink_collection)
for o in list(S.objects):
 if o.type not in {'MESH','CURVE'} or o.name.startswith(('INK •','Patina','Shade •','Plant •','Mug •','Lamp •')):continue
 if max(o.dimensions)<.09:continue
 ink_collection.objects.link(o)
ls.select_by_collection=True;ls.collection=ink_collection
ls.select_material_boundary=False;ls.select_edge_mark=False
ls.linestyle.color=(.0003,.0002,.0005);ls.linestyle.thickness=2.15
S.view_settings.view_transform='Standard';S.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.identifier for i in S.view_settings.bl_rna.properties['look'].enum_items] else 'None'
S.view_settings.exposure=0;S.view_settings.gamma=1
S.render.engine='CYCLES';S.cycles.samples=16;S.cycles.use_denoising=True
S.camera.data.dof.use_dof=False
outdir=R/'scene/renders/illustrated-export';outdir.mkdir(parents=True,exist_ok=True)
if '--preview' in sys.argv:
 for root in S.objects:
  if root.get('role') in {'draggable_cartridge','mobile_controller','controller_cable'}:
   for o in [root,*root.children_recursive]:o.hide_render=True
 S.render.resolution_x=1600;S.render.resolution_y=1000;S.render.resolution_percentage=100
 S.render.filepath=str(outdir/'preview.png');bpy.ops.render.render(write_still=True)
else:
 bpy.ops.wm.save_as_mainfile(filepath=str(R/'scene/midnight-den-illustrated.blend'))
 runpy.run_path(str(R/'scene/scripts/export_detailed_room.py'),run_name='__main__')
