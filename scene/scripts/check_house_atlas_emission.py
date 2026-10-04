import bpy
from pathlib import Path
S=bpy.context.scene;S.render.engine='CYCLES';S.cycles.samples=1
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mesh=bpy.data.meshes.new('fixture');mesh.from_pydata([(0,0,0),(1,0,0),(1,1,0),(0,1,0),(2,0,0),(2,1,0)],[],[(0,1,2,3),(1,4,5,2)]);mesh.update()
obj=bpy.data.objects.new('fixture',mesh);S.collection.objects.link(obj);obj.select_set(True);bpy.context.view_layer.objects.active=obj
uv=mesh.uv_layers.new(name='Lighting UV')
for p in mesh.polygons:
 for li in p.loop_indices:
  v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/2,v.y)
materials=[];active=[];size=32;key='fixture';OUT=Path(__file__).resolve().parents[1]/'renders/atlas-emission-check';OUT.mkdir(exist_ok=True)
albedo=bpy.data.images.new('albedo',size,size,alpha=False,float_buffer=True)
for i in range(2):
 m=bpy.data.materials.new('principled' if i==0 else 'emission');m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial')
 shader=n.new('ShaderNodeBsdfPrincipled' if i==0 else 'ShaderNodeEmission')
 if i==0:shader.inputs['Base Color'].default_value=(.4,0,0,1)
 else:shader.inputs['Color'].default_value=(0,0,.8,1);shader.inputs['Strength'].default_value=.5

 if i==0:m.node_tree.links.new(shader.outputs[0],out.inputs['Surface'])
 else:
  mix=n.new('ShaderNodeMixShader');path=n.new('ShaderNodeLightPath');transparent=n.new('ShaderNodeBsdfTransparent')
  m.node_tree.links.new(path.outputs['Is Camera Ray'],mix.inputs[0]);m.node_tree.links.new(transparent.outputs[0],mix.inputs[1]);m.node_tree.links.new(shader.outputs[0],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],out.inputs['Surface'])
 tx=n.new('ShaderNodeTexImage');tx.image=albedo;n.active=tx
 materials.append(m);active.append(tx);mesh.materials.append(m)
mesh.polygons[1].material_index=1;S.render.bake.margin=0
source=Path(__file__).with_name('bake_house_atlases.py').read_text()
block=source.split(' # Bake albedo separately')[1].split(' clean=bpy.data.scenes.new')[0]
import textwrap
exec(textwrap.dedent(' # Bake albedo separately'+block))
a=list(albedo.pixels);e=list(emission.pixels)
assert max(a[0::4])>.3 and max(a[2::4])<1e-6
assert max(e[2::4])>.3 and max(e[0::4])<1e-6
assert all(out.inputs['Surface'].links[0].from_socket==socket for m,out,socket in saved)
print('ATLAS_EMISSION_PRESERVATION_OK',flush=True)
