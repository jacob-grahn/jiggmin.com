"""Render a hallway line plate using the den's Freestyle settings.
Uses current release geometry. No source .blend or published atlas is modified.
Run Blender -b --python scene/scripts/render_hallway_ink.py.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]
OUT=R/'scene/renders/hallway-ink';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
for name in ['structure','hallway']:
 bpy.ops.import_scene.gltf(filepath=str(R/f'web/assets/house/release/{name}.glb'))
ink=bpy.data.collections.new('Hallway contour sources');S.collection.children.link(ink)
targets=[]
for o in S.objects:
 if o.type!='MESH':continue
 name=o.get('house_bake_source',o.get('source_object',o.name)).replace('_',' ')
 # Match the runtime's hidden mouldings, folded ladder and clear window glass.
 if (name.startswith('Finish / ceiling moulding') and o.get('release_baked') in {'structure-hall','structure-den'}) or o.get('preview_kind')=='ladder' or (o.get('preview_kind')=='window' and 'glass' in name.lower()):
  o.hide_render=True;continue
 if o.get('release_baked') in {'structure-hall','original-hallway'} and max(o.dimensions)>=.09:
  ink.objects.link(o);targets.append(o.name)
 # White emission isolates line opacity, independent of the existing lightmaps.
white=bpy.data.materials.new('Ink-pass white');white.use_nodes=True
n=white.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(1,1,1,1)
out=n.new('ShaderNodeOutputMaterial');white.node_tree.links.new(em.outputs[0],out.inputs[0])
for o in S.objects:
 if o.type=='MESH':
  o.data.materials.clear();o.data.materials.append(white)
  for p in o.data.polygons:p.material_index=0
layout=json.loads((R/'web/assets/house/release/layout.json').read_text());v=layout['views']['hub']
convert=lambda p:Vector((p[0],-p[2],p[1]))
cam=bpy.data.objects.new('Hallway ink camera',bpy.data.cameras.new('Hallway ink camera'));S.collection.objects.link(cam)
cam.location=convert(v['position']);cam.rotation_euler=(convert(v['target'])-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=24;cam.data.lens=12/math.tan(math.radians(v['fov'])/2);cam.data.dof.use_dof=False;S.camera=cam
S.render.engine='CYCLES';S.cycles.samples=1;S.cycles.use_denoising=False
S.world=bpy.data.worlds.new('White ink-pass background');S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
S.render.resolution_x=2560;S.render.resolution_y=1600;S.render.resolution_percentage=100
S.view_settings.view_transform='Standard';S.view_settings.look='None';S.view_settings.exposure=0;S.view_settings.gamma=1
S.render.use_freestyle=True;S.render.line_thickness=1.4
fs=bpy.context.view_layer.freestyle_settings;fs.crease_angle=2.35
ls=fs.linesets[0] if fs.linesets else fs.linesets.new('Den-style hallway ink')
if not ls.linestyle:ls.linestyle=bpy.data.linestyles.new('Den ink')
ls.select_silhouette=True;ls.select_border=True;ls.select_crease=False;ls.select_material_boundary=False;ls.select_edge_mark=False
ls.select_by_collection=True;ls.collection=ink;ls.linestyle.color=(.0003,.0002,.0005);ls.linestyle.thickness=2.15
S.render.image_settings.file_format='PNG';S.render.image_settings.color_mode='RGB';S.render.filepath=str(OUT/'lines.png')
(OUT/'camera.json').write_text(json.dumps({'view':v,'aspect':layout['aspect'],'resolution':[2560,1600],'targets':targets,'lineThickness':1.4,'styleThickness':2.15,'silhouette':True,'border':True,'crease':False},indent=2)+'\n')
bpy.ops.render.render(write_still=True)
print('HALLWAY_INK_RENDER_COMPLETE',flush=True)
