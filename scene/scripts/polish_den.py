import bpy,math,random,runpy
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[1];S=bpy.context.scene
ns=runpy.run_path(str(R/'scripts/build_den.py'));g=ns['box'].__globals__;g['S']=S;g['M']={m.name:m for m in bpy.data.materials};g['C']=bpy.data.collections['01 • Room and rain'];M=g['M'];random.seed(3)
for o in list(S.objects):
 if o.name.startswith(('Rainy pine silhouette','Fine window rain')):bpy.data.objects.remove(o,do_unlink=True)
# An image texture for the distant exterior; all interactive objects remain modeled.
m=bpy.data.materials.new('Rainy garden • generated exterior');m.use_nodes=True;n=m.node_tree.nodes;n.clear();tx=n.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(R/'textures/rainy-garden.png'));em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1.2;out=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(tx.outputs['Color'],em.inputs['Color']);m.node_tree.links.new(em.outputs[0],out.inputs['Surface']);ob=bpy.data.objects['Blue night beyond window'];ob.data.materials.clear();ob.data.materials.append(m)
# Hanging fabric panels with sewn hems and naturally irregular pleats.
curtain=ns['material']('Heavy olive curtain',(.054,.068,.055),.94,noise=.28,scale=160)
for center,width in [(-3.48,.42),(-1.53,.29)]:
 vs=[];fs=[]
 for j in range(41):
  v=j/40;z=3.96-3.12*v
  for i in range(25):
   u=i/24;x=center+(u-.5)*width*(1+.15*v);y=1.40+.055*math.cos(u*math.tau*4)+.018*math.sin(v*7+u*9)
   vs.append((x,y,z+.012*math.cos(u*30)*v))
 for j in range(40):
  for i in range(24):a=j*25+i;fs.append((a,a+1,a+26,a+25))
 me=bpy.data.meshes.new('Curtain pleats');me.from_pydata(vs,[],fs);ob=bpy.data.objects.new('Soft hanging curtain',me);g['C'].objects.link(ob);me.materials.append(curtain)
 for p in me.polygons:p.use_smooth=True
ns['line']('Curtain rod',[(-3.76,1.42,4.02),(-1.27,1.42,4.02)],.019,M['Brass'])
# Tilt one cartridge flat, another slightly askew; leave the dock plainly visible.
car=bpy.data.objects['CARTRIDGE_03 • Archive placeholder'];car.location=(.36,-2.18,.79);car.rotation_euler=(-math.pi/2,0,-.18)
car=bpy.data.objects['CARTRIDGE_01 • Archive placeholder'];car.rotation_euler=(0,-.09,-.20);car.location.z=.729
car=bpy.data.objects['CARTRIDGE_05 • Archive placeholder'];car.rotation_euler=(0,.10,.29);car.location.z=.730
# Fill only the interactive foreground, with specular disabled to avoid screen reflections.
g['C']=bpy.data.collections['07 • Cinematography']
li=ns['light']('Soft phosphor on hands',(0,-.69,1.75),(.27,.70,.82),24,1.8,(0,-1.7,.65));li.data.specular_factor=0
bpy.data.objects['Soft camera fill'].data.energy=21
# Faint airborne dust close to practical, kept away from the display.
g['C']=bpy.data.collections['06 • Late-night belongings']
dust=ns['material']('Quiet dust',(.34,.28,.20),.9)
for i in range(32):
 x=random.uniform(1.3,2.8);y=random.uniform(-.1,1.2);z=random.uniform(1.6,2.7)
 ns['ball']('Dust mote',(x,y,z),(.0015,.0015,.0015),dust)
# Slightly more intimate framing, full-size final beauty render.
S.cycles.samples=96;S.render.resolution_percentage=100;S.render.resolution_x=1600;S.render.resolution_y=1000
S.camera.data.dof.aperture_fstop=8
S.render.filepath=str(R/'renders/midnight-den.png')
for a in (bpy.context.screen.areas if bpy.context.screen else []):
 if a.type=='VIEW_3D':
  allowed=[v.identifier for v in a.spaces.active.shading.bl_rna.properties['type'].enum_items]
  if 'SOLID' in allowed:a.spaces.active.shading.type='SOLID'
for im in bpy.data.images:
 if im.source=='FILE' and im.filepath:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den.blend'))
bpy.ops.render.render(write_still=True)
