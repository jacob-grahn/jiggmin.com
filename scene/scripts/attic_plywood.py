"""Unfinished plywood on the attic roof undersides, with metre-scale sheets."""
import bpy
from house_finishes import SPEC

def apply_attic_plywood(scene):
 spec=SPEC['attic_ceiling']
 material=bpy.data.materials.get(spec['name']) or bpy.data.materials.new(spec['name'])
 material.use_nodes=True;material.diffuse_color=(*spec['linear_rgb'],1)
 nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
 def node(kind):return nodes.new(kind)
 def math(op,a,b):
  n=node('ShaderNodeMath');n.operation=op
  for i,v in enumerate([a,b]):
   if isinstance(v,(float,int)):n.inputs[i].default_value=v
   else:links.new(v,n.inputs[i])
  return n.outputs[0]
 output=node('ShaderNodeOutputMaterial');shader=node('ShaderNodeBsdfPrincipled')
 shader.inputs['Roughness'].default_value=spec['roughness'];links.new(shader.outputs[0],output.inputs['Surface'])
 position=node('ShaderNodeNewGeometry');axes=node('ShaderNodeSeparateXYZ');links.new(position.outputs['Position'],axes.inputs[0])
 stretch=node('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(3,.35,1);links.new(position.outputs['Position'],stretch.inputs[0])
 noise=node('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.65;links.new(stretch.outputs[0],noise.inputs['Vector'])
 ramp=node('ShaderNodeValToRGB');links.new(noise.outputs['Fac'],ramp.inputs[0])
 for element,factor in zip(ramp.color_ramp.elements,[.72,1.12]):element.color=(*(c*factor for c in spec['linear_rgb']),1)
 # 1.22 x 2.44 m sheets; the 3:4 roof pitch gives a 1.25 slope factor.
 across=math('MULTIPLY',axes.outputs['X'],1.25)
 seams=[]
 for axis,size in [(across,1.22),(axes.outputs['Y'],2.44)]:
  fraction=math('FRACT',math('DIVIDE',axis,size),0)
  seams.append(math('LESS_THAN',fraction,.003/size))
 seam=math('MAXIMUM',*seams)
 mix=node('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[2].default_value=(.32,.28,.23,1);links.new(seam,mix.inputs[0]);links.new(ramp.outputs['Color'],mix.inputs[1]);links.new(mix.outputs[0],shader.inputs['Base Color'])
 changed=[]
 for obj in scene.objects:
  name=obj.get('source_object',obj.name)
  if obj.type!='MESH' or not name.startswith('Main pitched roof'):continue
  obj.data=obj.data.copy();index=next((i for i,m in enumerate(obj.data.materials) if m==material),None)
  if index is None:index=len(obj.data.materials);obj.data.materials.append(material)
  normal=obj.matrix_world.to_3x3().inverted().transposed()
  for face in obj.data.polygons:
   if (normal@face.normal).normalized().z<-.5:face.material_index=index
  if 'ceiling_paint' in obj:del obj['ceiling_paint']
  obj['ceiling_finish']='unfinished plywood';changed.append(obj.name)
 return changed
