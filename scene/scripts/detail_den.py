"""A reproducible patina pass; run on midnight-den-library.blend, never overwrite it."""
import bpy, math, random, runpy
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]; S=bpy.context.scene
ns=runpy.run_path(str(R/'scripts/build_den.py')); g=ns['box'].__globals__
g.update(S=S,M={m.name:m for m in bpy.data.materials},C=bpy.data.collections['06 • Late-night belongings'])
M=g['M']; random.seed(901)
box,line,ball,cyl,text,material=[ns[k] for k in ['box','line','ball','cyl','text','material']]
# Extend actual architecture, including the floor, rather than stretching a photograph.
bpy.data.objects['Back wall'].dimensions=(20,.14,9)
bpy.data.objects['Back wall'].location.z=4.4
bpy.data.objects['Left wall'].location.x=-7.8
bpy.data.objects['Left wall'].dimensions=(.13,14,9)
bpy.data.objects['Baseboard'].dimensions.x=19.8
for j in range(24):
 for k in [-3,-2,-1,4,5,6]:
  box('Extended oak floorboard',(-4.5+k*2.6+(j%2)*.5,-3.6+j*.43,-.055),(2.59,.423,.10),M['Floor oak'],.006)
box('Floor beyond foreground',(0,-7,-.09),(24,7,.12),M['Floor oak'],.01)
# Uneven material response survives the high quality bake. Existing image/wood nodes stay intact.
for name in ['Graphite ABS','Warm grey ABS','Brushed pewter','Brass','Walnut','Floor oak','Plaster','Terracotta','Coffee glaze','Indigo upholstery','Heavy olive curtain','Faded rust blanket','Amber linen','Book cloth blue','Book cloth red','Book cloth olive','Old paper','Leaf']:
 m=M.get(name)
 if not m or not m.use_nodes:continue
 n=m.node_tree.nodes; links=m.node_tree.links;p=next((x for x in n if x.type=='BSDF_PRINCIPLED'),None)
 if not p:continue
 noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=35 if name in ['Walnut','Floor oak'] else 105;noise.inputs['Detail'].default_value=3
 ramp=n.new('ShaderNodeValToRGB');base=p.inputs['Roughness'].default_value
 ramp.color_ramp.elements[0].color=(max(.12,base-.12),)*3+(1,);ramp.color_ramp.elements[1].color=(min(1,base+.12),)*3+(1,)
 links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],p.inputs['Roughness'])
 if name in ['Graphite ABS','Warm grey ABS','Brushed pewter','Terracotta','Plaster']:
  mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.22
  if p.inputs['Base Color'].is_linked:links.new(p.inputs['Base Color'].links[0].from_socket,mix.inputs[1])
  else:mix.inputs[1].default_value=p.inputs['Base Color'].default_value
  links.new(noise.outputs['Fac'],mix.inputs[2]);links.new(mix.outputs[0],p.inputs['Base Color'])
wear=material('Patina • exposed walnut',(.12,.063,.026),.78)
scuff=material('Patina • rubbed graphite',(.07,.08,.074),.6)
chalk=material('Patina • aged ceramic',(.32,.31,.24),.84)
ink=material('Patina • faded pencil',(.055,.046,.034),.95)
soil=material('Patina • potting grit',(.09,.067,.035),1,noise=.3,scale=120)
leafvein=material('Patina • leaf veins',(.07,.13,.045),.62)
# Scratches follow each surface, clustered near exposed edges rather than uniform noise.
for i in range(110):
 x=random.uniform(-2.20,2.20);y=random.choice([random.uniform(-2.37,-2.23),random.uniform(-.92,-.75),random.uniform(-2.2,-.9)])
 line('Patina • table hairline',[(x,y,.697),(x+random.uniform(.008,.10),y+random.uniform(-.004,.004),.697)],random.uniform(.00035,.0008),wear)
for i in range(40):
 x=random.uniform(-1.92,1.92);y=random.uniform(-.10,1.25)
 line('Patina • cabinet scratch',[(x,y,1.108),(x+random.uniform(.015,.065),y,1.108)],.00055,wear)
for z in [.12,.64,1.16,1.72]:
 for i in range(7):
  x=random.uniform(-3.3,-2.25);line('Patina • library edge chip',[(x,-.316,z),(x+.025,-.316,z+.002)],.0014,wear)
# Two faint coffee rings, each incomplete and irregular.
for center,radius,z in [((1.73,-1.70),.13,.697),((1.69,-.04),.151,1.108)]:
 for start,end in [(0,2.4),(2.7,5.7)]:
  line('Patina • old coaster mark',[(center[0]+radius*math.cos(a),center[1]+radius*math.sin(a),z) for a in [start+(end-start)*i/40 for i in range(41)]],.0011,ink)
# TV bezel and console: molded seams, exposed screw heads, rubbed edges and fine scratches.
for i in range(36):
 x=random.uniform(-1.16,1.16);z=random.choice([random.uniform(1.21,1.25),random.uniform(3.015,3.035)])
 line('Patina • CRT scuff',[(x,-.272,z),(x+random.uniform(.009,.04),-.273,z+.002)],.0008,scuff)
for x in [-.62,.62]:
 for y in [-1.53,-.98]:
  cyl('Patina • console screw recess',(x,y,.998),.013,.002,M['Rubber'],20)
  cyl('Patina • console screw',(x,y,1.000),.008,.002,M['Brushed pewter'],20)
  box('Patina • screw slot',(x,y,1.002),(.010,.002,.001),M['Rubber'],.0004)
for i in range(32):
 x=random.uniform(-.6,.6);y=random.uniform(-1.54,-1.47)
 line('Patina • brushed lid abrasion',[(x,y,.997),(x+random.uniform(.006,.028),y+.001,.997)],.00045,scuff)
# Mug glaze chips, a fine crack, uneven rim, a coffee meniscus. Details move with the mug.
line('Mug • glazed rim',[(1.66+.112*math.cos(i*math.tau/96),-.03+.112*math.sin(i*math.tau/96),1.364) for i in range(97)],.007,M['Coffee glaze'])
line('Mug • rim chip',[(1.66+.113*math.cos(a),-.03+.113*math.sin(a),1.366) for a in [3.8+i*.018 for i in range(10)]],.0035,chalk)
line('Mug • hairline glaze crack',[(1.64,-.149,1.35),(1.635,-.15,1.328),(1.64,-.15,1.31),(1.633,-.149,1.298)],.00065,ink)
line('Mug • coffee meniscus',[(1.66+.098*math.cos(i*math.tau/72),-.03+.098*math.sin(i*math.tau/72),1.366) for i in range(73)],.0014,wear)
# Ceramic pot mineral bloom and scattered, nonuniform grit.
for i in range(32):
 a=random.random()*math.tau;r=random.uniform(.02,.16)
 ball('Plant • soil granule',(-1.67+math.cos(a)*r,.52+math.sin(a)*r,1.402),(random.uniform(.004,.011),.007,.004),soil)
for i in range(11):
 a=3.3+i*.19
 line('Plant • mineral rim', [(-1.67+.192*math.cos(t),.52+.192*math.sin(t),1.365+random.uniform(-.003,.003)) for t in [a,a+.055,a+.10]],.0016,chalk)
# Follow the existing curved leaf mesh, with veins and an occasional darkened tip.
for leaf in [o for o in S.objects if o.name.startswith('Pothos leaf')]:
 verts=leaf.data.vertices
 if len(verts)!=65:continue
 mid=[leaf.matrix_world@verts[k*5+2].co for k in range(13)]
 line('Plant • central leaf vein',[v+Vector((0,0,.001)) for v in mid],.00075,leafvein)
 for k in [3,6,8]:
  for side in [0,4]:
   line('Plant • branching leaf vein',[mid[k]+Vector((0,0,.001)),leaf.matrix_world@verts[(k+2)*5+side].co+Vector((0,0,.001))],.00035,leafvein)
# Shade stitching, tarnish flecks, a slightly dented brass base.
for i in range(80):
 a=i*math.tau/80
 line('Shade • hand sewn hem',[(2.72+.414*math.cos(a),.67+.414*math.sin(a),1.727),(2.72+.410*math.cos(a+.009),.67+.410*math.sin(a+.009),1.739)],.00085,M['Old paper'])
for i in range(18):
 a=random.random()*math.tau;r=random.uniform(.11,.20)
 ball('Lamp • tarnish',(2.72+r*math.cos(a),.67+r*math.sin(a),1.270),(.006,.009,.0005),ink)
# Small stories: worn pages, tape labels, dog-eared notes with actual sketch marks.
for j in range(3):
 for i in range(12):
  z=.455+j*.095+i*.0035
  line('Patina • album page edge',[(1.07,-.218,z),(1.67,-.218,z+random.uniform(-.001,.001))],.0005,wear)
for j in range(5):
 box('Patina • tape paper label',(-.56+j*.245,.111,.52),(.153,.002,.052),M['Old paper'],.001)
 text('Patina • tape handwriting',['WORLDS','TEST 04','JUMP','SAVE','1999'][j],(-.56+j*.245,.108,.514),.014,ink)
for i in range(13):
 x=1.29+random.random()*.22;y=-.60+random.random()*.14
 line('Patina • game design doodle',[(x,y,1.122),(x+.026,y+.006,1.122),(x+.045,y-.012,1.122)],.0007,ink)
# Hand-stitched chair piping and blanket threads.
line('Patina • armchair piping',[(2.875,-1.60,.90),(2.866,-1.58,.99),(2.865,-.27,.99),(2.89,-.21,.91)],.003,M['Book cloth blue'])
for i in range(36):
 y=-1.5+i*.039
 line('Patina • blanket fringe',[(2.856,y,.50),(2.843,y+.004,.476),(2.851,y+.009,.462)],.0015,M['Book cloth red'])
# A wall socket and trim make the expanded room feel built, not an empty backdrop.
box('Patina • wall outlet',(-4.4,1.86,.47),(.17,.024,.27),M['Warm grey ABS'],.015)
for z in [.41,.53]:
 for x in [-4.428,-4.372]:box('Patina • outlet slot',(x,1.844,z),(.01,.005,.04),M['Rubber'],.001)
box('Patina • baseboard upper bead',(0,1.78,.30),(19.8,.03,.025),M['Walnut'],.009)
# Tag the three little reactive assemblies. Their surfaces will carry rest-pose baked UVs.
for o in S.objects:
 if o.name.startswith(('Mug','Dark coffee')):o['reactive']='mug'
 elif o.name.startswith(('Plant','Pot dark soil','Pothos','Arching pothos')):o['reactive']='plant'
 elif o.name.startswith(('Lamp base','Lamp stem','Lamp pleated','Shade','Warm lamp bulb','Lamp •')):o['reactive']='lamp'
# Tiny accent curves need few segments; keep browser geometry proportional to their size.
for o in S.objects:
 if o.type=='CURVE' and o.name.startswith(('Patina •','Mug •','Plant •','Shade •')):
  o.data.resolution_u=2;o.data.bevel_resolution=1
S['detail_pass']='901: expanded architecture, patina, reactive mug/plant/lamp'
bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den-detailed.blend'))
print('DETAIL_PASS_COMPLETE',len(S.objects),flush=True)
