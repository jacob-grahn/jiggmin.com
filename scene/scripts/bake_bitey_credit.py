"""Render the native picture and text once into an unlit texture."""
import bpy, math
from pathlib import Path
R=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=1
s.render.resolution_x=1200;s.render.resolution_y=1200;s.render.resolution_percentage=100
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
s.render.image_settings.file_format='PNG'
def emission(name,color=None,image=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear()
 out=n.new('ShaderNodeOutputMaterial');e=n.new('ShaderNodeEmission');m.node_tree.links.new(e.outputs[0],out.inputs[0])
 if image:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(image));m.node_tree.links.new(t.outputs['Color'],e.inputs['Color'])
 else:e.inputs['Color'].default_value=(*color,1)
 return m
bpy.ops.mesh.primitive_plane_add(size=2)
bpy.context.object.data.materials.append(emission('Original Bitey',image=R/'scene/house-textures/bitey/bitey.jpeg'))
bpy.ops.object.text_add(location=(1-.022/.36,-1+.025/.36,.01))
t=bpy.context.object;t.data.body='Adam Phillips';t.data.align_x='RIGHT';t.data.size=.027/.36;t.data.extrude=0
t.data.materials.append(emission('Dark green credit',(.008023,.070360,.026241)))
bpy.ops.object.camera_add(location=(0,0,3));s.camera=bpy.context.object;s.camera.data.type='ORTHO';s.camera.data.ortho_scale=2
s.render.filepath=str(R/'scene/house-textures/bitey/bitey-credited.png')
bpy.ops.render.render(write_still=True)
