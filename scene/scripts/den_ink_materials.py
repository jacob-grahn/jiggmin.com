"""Authored material treatment guided by docs/art-direction/den/midnight-ink-target.png.
Node-based colors and ink marks follow real surfaces and retain their camera mapping.
"""
import bpy, random

def decorate():
 for m in list(bpy.data.materials):
  if not m.use_nodes:continue
  n=m.node_tree.nodes;l=m.node_tree.links
  p=next((x for x in n if x.type=='BSDF_PRINCIPLED'),None)
  if m.name.startswith('Rainy garden'):
   tx=next((v for v in n if v.type=='TEX_IMAGE'),None);em=next((v for v in n if v.type=='EMISSION'),None)
   if tx and em:
    em.inputs['Strength'].default_value=1.8
    bw=n.new('ShaderNodeRGBToBW');ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
    values=[(0,(.001,.003,.010,1)),(.015,(.009,.021,.050,1)),(.050,(.021,.055,.11,1)),(.13,(.045,.10,.18,1))]
    for e,(t,c) in zip(ramp.color_ramp.elements,values[:2]):e.position=t;e.color=c
    for t,c in values[2:]:ramp.color_ramp.elements.new(t).color=c
    l.new(tx.outputs['Color'],bw.inputs[0]);l.new(bw.outputs[0],ramp.inputs[0]);l.new(ramp.outputs[0],em.inputs['Color'])
  if not p:continue
  def math(op,a,b):
   node=n.new('ShaderNodeMath');node.operation=op
   for i,v in enumerate([a,b]):
    if isinstance(v,(int,float)):node.inputs[i].default_value=v
    else:l.new(v,node.inputs[i])
   return node.outputs[0]
  def mix(a,b,f):
   node=n.new('ShaderNodeMixRGB')
   for i,v in enumerate([f,a,b]):
    if isinstance(v,(tuple,list)):node.inputs[i].default_value=v
    elif isinstance(v,(int,float)):node.inputs[i].default_value=v
    else:l.new(v,node.inputs[i])
   return node.outputs[0]
  def color_input():
   socket=p.inputs['Base Color']
   return socket.links[0].from_socket if socket.is_linked else tuple(socket.default_value)
  if m.name=='Phosphor idle screen':
   # The CRT is the brightest focal point, with no specular hotspot.
   p.inputs['Roughness'].default_value=1;p.inputs['Coat Weight'].default_value=0
   p.inputs['Specular IOR Level'].default_value=0
   p.inputs['Emission Strength'].default_value=5.2
   continue
  if m.name=='Lamp glow':p.inputs['Emission Strength'].default_value=.65
  if p.inputs['Emission Strength'].default_value>0:continue
  pos=n.new('ShaderNodeNewGeometry').outputs['Position']
  xyz=n.new('ShaderNodeSeparateXYZ');l.new(pos,xyz.inputs[0])
  x,y,z=[xyz.outputs[k] for k in ['X','Y','Z']]
  base=color_input()
  if m.name=='Plaster':
   # A continuous cool-to-warm wash, without the concept's hard polygon masks.
   def fade(value,start,end):
    node=n.new('ShaderNodeMapRange');node.interpolation_type='SMOOTHERSTEP';node.clamp=True
    l.new(value,node.inputs['Value']);node.inputs['From Min'].default_value=start;node.inputs['From Max'].default_value=end
    return node.outputs['Result']
   base=mix((.045,.065,.14,1),(.48,.16,.055,1),fade(x,-1.8,3.2))
   # Painted masonry across the wall: faint, softened joints inherit the paint
   # color rather than exposing contrasting brick and mortar colors.
   uv=n.new('ShaderNodeCombineXYZ');l.new(x,uv.inputs['X']);l.new(z,uv.inputs['Y'])
   brick=n.new('ShaderNodeTexBrick');l.new(uv.outputs[0],brick.inputs['Vector'])
   brick.inputs['Scale'].default_value=1
   brick.inputs['Brick Width'].default_value=.66;brick.inputs['Row Height'].default_value=.27
   brick.inputs['Mortar Size'].default_value=.009;brick.inputs['Mortar Smooth'].default_value=.007
   brick.inputs['Color1'].default_value=(.97,.97,.97,1);brick.inputs['Color2'].default_value=(1,1,1,1)
   brick.inputs['Mortar'].default_value=(.74,.74,.74,1)
   noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=2
   l.new(pos,noise.inputs['Vector'])
   coverage=math('ADD',.35,math('MULTIPLY',noise.outputs['Fac'],.5))
   painted=mix((1,1,1,1),brick.outputs['Color'],coverage)
   tint=n.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
   l.new(base,tint.inputs[1]);l.new(painted,tint.inputs[2]);base=tint.outputs[0]
  elif m.name in {'Walnut','Floor oak'}:
   # Three broad wood values, with narrow dark grain instead of reflective stripes.
   noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.4;noise.inputs['Detail'].default_value=2
   scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1.3,36,9)
   l.new(pos,scale.inputs[0]);l.new(scale.outputs[0],noise.inputs['Vector'])
   ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
   values=[(.0,(.035,.012,.011,1)),(.20,(.23,.069,.025,1)),(.63,(.30,.105,.037,1)),(.79,(.37,.14,.044,1))]
   for e in list(ramp.color_ramp.elements)[2:]:ramp.color_ramp.elements.remove(e)
   for e,(t,c) in zip(ramp.color_ramp.elements,values[:2]):e.position=t;e.color=c
   for t,c in values[2:]:ramp.color_ramp.elements.new(t).color=c
   l.new(noise.outputs['Fac'],ramp.inputs[0]);base=ramp.outputs[0]
  elif m.name=='Indigo upholstery':base=(.040,.055,.10,1)
  elif m.name=='Heavy olive curtain':base=(.035,.049,.087,1)
  elif m.name=='Amber linen':base=(.76,.40,.13,1)
  elif m.name=='Coffee glaze':base=(.12,.12,.19,1)
  elif m.name=='Leaf':base=(.065,.13,.07,1)
  elif m.name=='Warm grey ABS':base=(.34,.36,.33,1)
  # Patches of thin diagonal ink on broad surfaces. This is surface-space art,
  # not a screen overlay: it remains attached during the prop reactions.
  if m.name in {'Graphite ABS','Warm grey ABS','Indigo upholstery','Heavy olive curtain','Terracotta','Coffee glaze'}:
   noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4.6;noise.inputs['Detail'].default_value=2
   l.new(pos,noise.inputs['Vector']);patch=math('GREATER_THAN',noise.outputs['Fac'],.64)
   wave=n.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL'
   wave.inputs['Scale'].default_value=34;wave.inputs['Distortion'].default_value=.9;wave.inputs['Detail Scale'].default_value=1.7
   l.new(pos,wave.inputs['Vector']);lines=math('GREATER_THAN',wave.outputs['Fac'],.91)
   ink=math('MULTIPLY',patch,lines)
   base=mix(base,(.001,.0006,.002,1),math('MULTIPLY',ink,.88))
  if not isinstance(base,tuple):l.new(base,p.inputs['Base Color'])
  else:
   for link in list(p.inputs['Base Color'].links):l.remove(link)
   p.inputs['Base Color'].default_value=base

 # A small number of deliberately placed, tapered pen strokes. Random noise was
 # too even: these marks cluster at furniture wear and shadow boundaries.
 ink=bpy.data.materials.new('Illustrated drawn ink');ink.use_nodes=True
 nodes=ink.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(.0003,.0002,.0005,1)
 out=nodes.new('ShaderNodeOutputMaterial');ink.node_tree.links.new(em.outputs[0],out.inputs[0])
 for o in list(bpy.context.scene.objects):
  if o.type!='CURVE' or not o.name.startswith(('Patina • table hairline','Patina • cabinet scratch','Patina • CRT scuff')):continue
  o.data.materials.clear();o.data.materials.append(ink);o.data.bevel_depth*=2.8
  for sp in o.data.splines:
   if sp.type!='BEZIER':continue
   first=sp.bezier_points[0].co.copy();limit=2.20 if 'table' in o.name else (1.95 if 'cabinet' in o.name else 1.18)
   for bp in sp.bezier_points:
    bp.co.x=min(limit,first.x+(bp.co.x-first.x)*3)
    bp.radius=.35 if bp==sp.bezier_points[-1] else 1
 random.seed(610)
 for cx,cz in [(-4.0,3.5),(-3.9,1.2),(-1.20,3.85),(-.85,3.6),(.75,4.0),(1.25,3.5),(3.5,3.5),(3.35,2.6),(3.3,1.7),(2.4,.85)]:
  for j in range(random.randint(3,6)):
   x=cx+j*.026;z=cz+j*.008;length=random.uniform(.06,.19)
   cu=bpy.data.curves.new('Drawn wall hatch','CURVE');cu.dimensions='3D';cu.bevel_depth=.0025;cu.bevel_resolution=0
   sp=cu.splines.new('POLY');sp.points.add(2)
   for pt,co,r in zip(sp.points,[(x,1.876,z),(x+length*.3,1.875,z+length*.55),(x+length*.6,1.876,z+length)],[.15,1,.05]):pt.co=(*co,1);pt.radius=r
   ob=bpy.data.objects.new('INK • wall hatch',cu);bpy.context.scene.collection.objects.link(ob);cu.materials.append(ink)
