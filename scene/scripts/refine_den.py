import bpy, math, random, runpy
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[1]
S=bpy.context.scene
ns=runpy.run_path(str(R/'scripts/build_den.py'))
g=ns['box'].__globals__;g['S']=S;g['M']={m.name:m for m in bpy.data.materials};g['C']=bpy.data.collections['06 • Late-night belongings']
M=g['M'];random.seed(47)
box=ns['box'];line=ns['line'];ball=ns['ball'];text=ns['text'];cyl=ns['cyl'];light=ns['light']
# Remove stylized placeholder leaves and pine triangles, replacing with organic meshes.
for o in list(S.objects):
 if o.name == 'Moon' or o.name.startswith(('Waxed plant leaf','Plant stem','Distant pine','Rain on glass')):bpy.data.objects.remove(o,do_unlink=True)
# Arching plant with dozens of thin curved leaves.
for i in range(12):
 a=i*2.399; length=random.uniform(.38,.62);out=Vector((math.cos(a),math.sin(a),0))
 base=Vector((-1.67,.52,1.38));top=base+out*length*.55+Vector((0,0,length))
 line('Arching pothos stem',[base,base+Vector((0,0,length*.65)),top],.0025,M['Leaf'])
 for j in [0,1,2]:
  t=.48+j*.23;stem=base.lerp(top,t);direction=Vector((math.cos(a+j*1.6),math.sin(a+j*1.6),.25))
  side=Vector((-direction.y,direction.x,0));le=random.uniform(.17,.28);verts=[];faces=[]
  for k in range(13):
   u=k/12;wid=math.sin(math.pi*u)**.75*.080*(1-.3*u)
   center=stem+direction*le*u+Vector((0,0,.07*math.sin(math.pi*u)-.11*u*u))
   for q in range(5):
    v=(q-2)/2;co=center+side*wid*v+Vector((0,0,-abs(v)*.018*math.sin(math.pi*u)));verts.append(co)
  for k in range(12):
   for q in range(4):n=k*5+q;faces.append((n,n+1,n+6,n+5))
  mesh=bpy.data.meshes.new('Curved heart leaf');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Pothos leaf',mesh);g['C'].objects.link(o);mesh.materials.append(M['Leaf'])
  for p in mesh.polygons:p.use_smooth=True
# Exterior pine boughs using many jagged branch silhouettes.
g['C']=bpy.data.collections['01 • Room and rain']
for i in range(9):
 x=-3.35+i*.21;z=1.09;hei=random.uniform(.7,2.35);verts=[];faces=[]
 for j in range(22):
  frac=j/22;zz=z+hei*frac;span=hei*.20*(1-frac);lean=random.uniform(-.025,.025)
  for side in [-1,1]:
   n=len(verts);verts += [(x,1.797,zz+.13),(x+side*span,1.797,zz-.07),(x+side*span*.55,1.797,zz+.01),(x+lean,1.797,zz+.22)];faces.append((n,n+1,n+2,n+3))
 mesh=bpy.data.meshes.new('Pine branches');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Rainy pine silhouette',mesh);g['C'].objects.link(o);mesh.materials.append(M['Rubber'])
# Fine droplets, not broad white streaks.
for i in range(210):
 x=random.uniform(-3.30,-1.66);z=random.uniform(1.15,3.83);le=random.uniform(.01,.105)
 line('Fine window rain',[(x,1.545,z),(x+.002,1.544,z-le*.7),(x+.001,1.545,z-le)],random.uniform(.0006,.0014),M['Rain silver'])
# Subtle reflection-free midnight background, quieter wall texture.
p=next(n for n in M['Window blue'].node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Emission Strength'].default_value=.22
for name in ['Plaster','Graphite ABS','Warm grey ABS']:
 m=M[name]
 for node in m.node_tree.nodes:
  if node.type=='BUMP':node.inputs['Distance'].default_value=.007
# Let the screen itself emit light, avoiding an obvious area-light reflection.
bpy.data.objects.remove(bpy.data.objects['CRT spill'],do_unlink=True)
m=M['Phosphor idle screen'];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.24;p.inputs['Emission Strength'].default_value=1.7;p.inputs['Coat Weight'].default_value=.18;p.inputs['Coat Roughness'].default_value=.21
# Restrained illumination, a warm practical + cold rainy window.
for name,power in [('Moon through rain',75),('Amber lamplight',22),('Warm ceiling bounce',9),('Soft camera fill',14)]:bpy.data.objects[name].data.energy=power
# Real glowing bulb produces diffuse shadows rather than directional light patches.
g['C']=bpy.data.collections['07 • Cinematography']
ld=bpy.data.lights.new('Lamp practical bulb','POINT');ld.energy=33;ld.color=(1,.39,.12);ld.shadow_soft_size=.07;ob=bpy.data.objects.new('Lamp practical bulb',ld);g['C'].objects.link(ob);ob.location=(2.72,.67,1.82)
next(n for n in S.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Strength'].default_value=.045
# A small pile of handwritten notes and a pencil, partly in shadow.
g['C']=bpy.data.collections['06 • Late-night belongings']
for i in range(3):
 o=box('Loose game sketches',(1.42,-.54,1.112+i*.003),(.36,.27,.002),M['Old paper'],.001);o.rotation_euler.z=.08+i*.05
line('Pencil on cabinet',[(1.20,-.56,1.13),(1.58,-.45,1.13)],.008,M['Brass'])
# Light fabric blanket draped across chair: continuous curved mesh with irregular folds.
verts=[];faces=[]
for j in range(29):
 v=j/28;y=-1.55+v*1.5
 for i in range(25):
  u=i/24;x=2.85+u*.70
  z=.98-.50*max(0,(.22-u)/.22)+.028*math.sin(u*55+v*8)+.012*math.sin(v*35)
  verts.append((x,y,z))
for j in range(28):
 for i in range(24):n=j*25+i;faces.append((n,n+1,n+26,n+25))
me=bpy.data.meshes.new('Soft throw folds');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Blanket over armrest',me);g['C'].objects.link(o);me.materials.append(ns['material']('Faded rust blanket',(.16,.074,.040),.98,noise=.25,scale=150))
for p in me.polygons:p.use_smooth=True
# Tiny readable typesetting on book spines.
for i,label in enumerate(['SKETCHES','WORLDS','IDEAS']):
 text('Book spine title',label,(-1.69+i*.25,-.202,.64),.019,M['Old paper'],(math.pi/2,0,math.pi/2))
S.camera.data.lens=43;S.camera.location=(.12,-7.9,3.0);S.camera.rotation_euler=(Vector((0,-.15,1.76))-S.camera.location).to_track_quat('-Z','Y').to_euler()
try:S.render.engine='CYCLES'
except TypeError as e:print(e);raise
S.cycles.samples=32;S.cycles.use_denoising=True;S.cycles.max_bounces=6
S.render.resolution_percentage=70;S.view_settings.exposure=.8
S.render.filepath=str(R/'renders/midnight-den-preview.png')
for im in bpy.data.images:
 if im.source=='FILE' and im.filepath:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den.blend'))
bpy.ops.render.render(write_still=True)
