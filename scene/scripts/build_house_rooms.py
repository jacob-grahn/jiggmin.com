"""Four quiet rooms. Rebuild: Blender -b --python this_file.py -- [room ...].
Original procedural models, Cycles lighting. Plate uses the supplied real photograph.
"""
import bpy, math, random, json, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
R=Path(__file__).resolve().parents[2]
OUT=R/'web/assets/house'; OUT.mkdir(parents=True,exist_ok=True)
M={}; anchors={}; allhot={}; random.seed(1998)

def mat(name,col,rough=.6,metal=0,noise=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if noise:
  n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=45
  b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=noise;b.inputs['Distance'].default_value=.025
  m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
 M[name]=m;return m

def wood(name,c1,c2):
 m=mat(name,c1,.52,noise=.12);ns=m.node_tree.nodes;lk=m.node_tree.links
 tex=ns.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=3;tex.inputs['Detail'].default_value=4
 co=ns.new('ShaderNodeTexCoord');mul=ns.new('ShaderNodeVectorMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=(3,65,5)
 ramp=ns.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*c1,1);ramp.color_ramp.elements[1].color=(*c2,1)
 lk.new(co.outputs['Generated'],mul.inputs[0]);lk.new(mul.outputs[0],tex.inputs['Vector']);lk.new(tex.outputs['Fac'],ramp.inputs[0]);lk.new(ramp.outputs[0],ns.get('Principled BSDF').inputs['Base Color']);return m

def emit(name,c,power=2):
 m=mat(name,c);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=power;return m

def box(n,loc,dims,m='wood',bev=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[m])
 if bev:
  b=o.modifiers.new('Rounded edges','BEVEL');b.width=bev;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def cyl(n,loc,r,depth,m='brass',rot=(0,0,0),verts=48):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot);o=bpy.context.object;o.name=n;o.data.materials.append(M[m]);b=o.modifiers.new('Edge bevel','BEVEL');b.width=.008;b.segments=2
 for f in o.data.polygons:f.use_smooth=True
 return o

def sphere(n,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(M[m]);
 for f in o.data.polygons:f.use_smooth=True
 return o

def pipe(n,points,r,m):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);cu.materials.append(M[m]);return o

def text(body,loc,size=.1,m='ink',rot=(math.pi/2,0,0)):
 cu=bpy.data.curves.new(body,'FONT');cu.body=body;cu.align_x='CENTER';cu.size=size;cu.extrude=.0003;o=bpy.data.objects.new(body,cu);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;cu.materials.append(M[m]);return o

def anchor(id,*objs): anchors[id]=list(objs)
def area(n,loc,power,col,size,target):
 d=bpy.data.lights.new(n,'AREA');d.energy=power;d.color=col;d.shape='DISK';d.size=size;o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.visible_camera=False

def init(room):
 global S,anchors;anchors={};bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 S=bpy.context.scene;S.name='House — '+room;S.render.engine='CYCLES';S.cycles.samples=32;S.cycles.device='CPU';S.cycles.max_bounces=5;S.cycles.diffuse_bounces=3;S.cycles.glossy_bounces=3;S.cycles.use_denoising=True
 S.render.resolution_x=1280;S.render.resolution_y=800;S.render.resolution_percentage=100;S.render.image_settings.file_format='PNG'
 S.world=bpy.data.worlds.new('Night');S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.12,.19,1);S.world.node_tree.nodes['Background'].inputs[1].default_value=.18
 S.view_settings.view_transform='AgX';S.view_settings.exposure=-.6
 M.clear();wood('wood',(.036,.018,.009),(.24,.13,.055));wood('oak',(.09,.055,.025),(.32,.22,.10));wood('pale',(.14,.085,.035),(.42,.29,.14))
 for n,c,r,met,noise in [('wall',(.16,.22,.20),.9,0,.2),('cream',(.55,.48,.34),.9,0,.1),('ink',(.024,.032,.035),.7,0,0),('paper',(.61,.55,.40),.9,0,.04),('brass',(.44,.28,.10),.32,.7,.04),('metal',(.21,.25,.26),.4,.75,.1),('rubber',(.017,.019,.020),.7,0,.1),('red',(.35,.055,.033),.36,.35,.05),('blue',(.045,.095,.16),.8,0,.15),('pink',(.33,.23,.19),1,0,.7),('concrete',(.20,.23,.22),.95,0,.7),('clay',(.31,.12,.055),.8,0,.2),('green',(.075,.18,.095),.7,0,.2)]:mat(n,c,r,met,noise)
 emit('glow',(1,.57,.22),3);emit('night',(.045,.13,.28),.9)
 bpy.ops.object.camera_add(location=(3.6,-9,3.35));cam=bpy.context.object;cam.name='Room camera';cam.rotation_euler=(Vector((0,1.0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=34;S.camera=cam
 area('Soft blue night',(0,-4,6),180,(.36,.55,1),6,(0,1,1));area('Warm room bounce',(-3,-1,4),110,(1,.76,.55),4,(0,1,0))

def floor(w=10,d=7):
 box('Floor into the foreground',(0,-6,-.08),(w,6,.15),'oak',.005)
 for y in range(17):
  for x in range(5):box('Oak plank',(-w/2+x*w/5+w/10+(y%2)*.12,-3+y*d/17,-.07),(w/5-.012,d/17-.012,.14),'oak',.005)

def walls(w=10,h=3.8,m='wall'):
 box('Rear plaster',(0,3.4,3),(w,.16,6),m);box('Left plaster',(-w/2,-3.2,3),(.16,13.4,6),m);box('Right plaster',(w/2,-3.2,3),(.16,13.4,6),m);box('Ceiling',(0,-3.2,4.1),(w,13.4,.12),m)
 box('Rear skirting',(0,3.23,.14),(w,.10,.28));box('Side skirting',(-w/2+.1,-.1,.14),(.10,7,.28))

def lamp(x,y,z=2.6):
 cyl('Brass shade',(x,y,z),.25,.12);sphere('Opal lamp',(x,y,z-.1),(.12,.12,.08),'glow');pipe('Lamp stem',[(x,y,z+.05),(x,y,z+.65)],.018,'brass');area('Warm pool',(x,y,z-.15),120,(1,.72,.44),.7,(x,y-.3,0))

def window(x,y,z=2.4,w=1.6,h=1.7):
 outside_view('Garden beyond window',(x,y-.025,z),w,h,'rainy-treetops' if S.name.endswith('attic') else 'rainy-garden')
 for dx in [-w/2,w/2]:box('Window jamb',(x+dx,y-.08,z),(.12,.17,h+.2))
 for dz in [-h/2,h/2]:box('Window rail',(x,y-.08,z+dz),(w+.2,.17,.12))
 box('Window cross',(x,y-.1,z),(.055,.07,h));box('Window transom',(x,y-.1,z),(w,.07,.055));box('Deep sill',(x,y-.22,z-h/2),(w+.35,.45,.10))
 area('Night window',(x,y-.4,z),65,(.25,.45,1),1.5,(x,-1,0))

def table(x,y,w=3,d=1,h=1):
 top=box('Work surface',(x,y,h),(w,d,.15),'wood',.045)
 for dx in [-w/2+.15,w/2-.15]:
  for dy in [-d/2+.1,d/2-.1]:box('Table leg',(x+dx,y+dy,h/2),(.10,.10,h),'wood')
 return top

def book(n,x,y,z,w=.45,h=.65,m='blue'):
 o=box(n,(x,y,z),(w,.17,h),m);box('Book pages',(x,y-.092,z),(w*.86,.016,h*.9),'paper',.002);return o

def frame(n,body,x,y,z,w=1,h=.8):
 o=box(n,(x,y,z),(w,.065,h),'wood');box('Frame artwork',(x,y-.04,z),(w-.10,.015,h-.10),'paper',.003);text(body,(x,y-.055,z),min(.10,w/12),'ink');return o

def door(id,label,x,locked=False):
 o=box('Door '+label,(x,3.22,1.45),(1.15,.15,2.9),'wood')
 for dx in [-.64,.64]:box('Door surround',(x+dx,3.1,1.50),(.12,.22,3.08),'pale')
 box('Door lintel',(x,3.1,3),(1.4,.22,.12),'pale')
 for z in [.7,1.9]:box('Recessed door panel',(x,3.12,z),(.88,.018,.95),'oak',.012)
 cyl('Brass latch',(x+.4,3.07,1.25),.06,.08,'brass',(math.pi/2,0,0));box('Door sign',(x,3.085,2.52),(.76,.023,.22),'brass');text(label,(x,3.065,2.47),.078,'ink')
 if locked:
  pipe('Closed door chain',[(x-.35,3.0,1.5),(x,2.93,1.42),(x+.35,3.0,1.5)],.017,'metal');box('Future lock',(x,2.92,1.4),(.12,.065,.16),'brass')
 anchor(id,o)

def hallway():
 # A human-height view down a narrow corridor, not a bank of doors.
 from mathutils import Matrix
 init('hallway')
 for ob in list(bpy.data.objects):
  if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
 mat('Corridor paint',(.075,.135,.145),.92,noise=.20)
 mat('Quiet ceiling',(.24,.28,.26),.94,noise=.12)
 S.camera.location=(0,-7.4,1.7);S.camera.rotation_euler=(Vector((0,5.8,1.63))-S.camera.location).to_track_quat('-Z','Y').to_euler();S.camera.data.lens=22
 # Actual openings are built into the wall; casing seats across the reveal.
 half=1.30;outer=1.39;ceiling=3.10
 for ix in range(11):
  for iy in range(8):
   ob=box('Lengthwise oak floorboard',(-1.25+ix*.25,-7.0+iy*2.0+(ix%2)*.65,-.055),(1.985,.243,.11),'oak',.004);ob.rotation_euler.z=math.pi/2
 def wall_part(side,y0,y1,z0=0,z1=3.10):
  if y1<=y0:return
  box('Integrated corridor wall',(side*outer,(y0+y1)/2,(z0+z1)/2),(.18,y1-y0,z1-z0),'Corridor paint',.002)
  if z0==0:box('Oak skirting between openings',(side*1.275,(y0+y1)/2,.12),(.07,y1-y0,.24),'wood',.006)
 for side,cuts in [(-1,[(-5.9,.59,0,2.48),(3.2,.59,0,2.48)]),(1,[(-3.70,.96,1.12,2.58),(-1.8,.59,0,2.48)])]:
  start=-7.5
  for y,r,bottom,top in cuts:
   wall_part(side,start,y-r);wall_part(side,y-r,y+r,top,ceiling)
   if bottom:wall_part(side,y-r,y+r,0,bottom)
   start=y+r
  wall_part(side,start,5.9)
  box('Fine cornice',(side*1.27,-.8,2.97),(.075,13.4,.11),'pale')
 for x in [-.98,.98]:box('Far wall beside recessed doorway',(x,5.90,1.55),(.80,.18,3.1),'Corridor paint',.002)
 box('Far wall above doorway',(0,5.90,2.79),(1.18,.18,.62),'Corridor paint',.002)
 box('Corridor ceiling',(0,-.8,3.08),(2.78,13.4,.12),'Quiet ceiling')
 # Doors have recessed leaves, deep jamb returns, flush casing, hinges, no plaques.
 def mount(objects,loc,angle,scale=(1,1,1),origin=(0,0,0)):
  bpy.context.view_layer.update()
  tr=Matrix.Translation(Vector(loc))@Matrix.Rotation(angle,4,'Z')@Matrix.Diagonal((*scale,1))@Matrix.Translation(-Vector(origin))
  for ob in objects:ob.matrix_world=tr@ob.matrix_world
 def integrated_door(id,loc,angle,locked=False):
  before=set(bpy.data.objects)
  leaf=box('Recessed unmarked door leaf',(0,.025,1.165),(1.04,.085,2.33),'wood',.008)
  for x in [-.565,.565]:
   box('Full-depth door jamb',(x,.018,1.20),(.055,.235,2.40),'oak',.004)
   box('Door casing seated against plaster',(x,-.070,1.225),(.115,.125,2.45),'pale',.008)
  box('Full-depth door head jamb',(0,.018,2.385),(1.185,.235,.065),'oak',.004)
  box('Door head casing joined to wall',(0,-.070,2.44),(1.30,.125,.115),'pale',.008)
  box('Worn threshold',(0,-.015,.011),(1.19,.27,.024),'oak',.005)
  for z in [.57,1.60]:box('Recessed door panel',(0,-.023,z),(.81,.014,.77),'oak',.008)
  cyl('Unmarked door brass knob',(.37,-.073,1.03),.046,.085,'brass',(math.pi/2,0,0))
  for z in [.40,1.88]:cyl('Door jamb hinge',(-.516,-.024,z),.016,.095,'brass')
  if locked:
   pipe('Closed door chain',[(-.30,-.088,1.23),(0,-.16,1.15),(.30,-.088,1.23)],.012,'metal');box('Small future lock',(0,-.165,1.14),(.095,.055,.12),'brass')
  anchor(id,leaf)
  mount([ob for ob in bpy.data.objects if ob not in before],loc,angle)
 integrated_door('door-den',(-1.36,-5.9,0),math.pi/2)
 integrated_door('door-workshop',(1.36,-1.8,0),-math.pi/2)
 integrated_door('door-basement',(-1.36,3.2,0),math.pi/2)
 integrated_door('locked-door-2',(0,5.92,0),0,True)
 # Recessed rainy-night window on the right, with actual drops and runnels.
 before=set(bpy.data.objects)
 mat('Rainy dark glass',(.023,.055,.085),.12,metal=.12)
 glass=M['Rainy dark glass'].node_tree.nodes.get('Principled BSDF');glass.inputs['Transmission Weight'].default_value=0;glass.inputs['Roughness'].default_value=.45;glass.inputs['Metallic'].default_value=0;glass.inputs['IOR'].default_value=1.46
 emit('Outside rainy darkness',(.010,.030,.064),.28)
 mat('Rain water glints',(.38,.60,.80),.14,metal=.25)
 rain_shader=M['Rain water glints'].node_tree.nodes.get('Principled BSDF');rain_shader.inputs['Emission Color'].default_value=(.22,.43,.70,1);rain_shader.inputs['Emission Strength'].default_value=.40
 box('Dark outside the rainy window',(0,.31,1.85),(1.81,.025,1.40),'Outside rainy darkness',.001)
 box('Wet window glass',(0,.095,1.85),(1.78,.024,1.35),'Rainy dark glass',.003)
 for x in [-.93,.93]:box('Window jamb joined into plaster',(x,0,1.85),(.095,.23,1.55),'pale',.006)
 for z in [1.12,2.58]:box('Window head and sill jamb',(0,0,z),(1.95,.23,.095),'pale',.006)
 box('Window central mullion',(0,.022,1.85),(.055,.13,1.40),'wood',.004)
 box('Window crossbar',(0,.022,1.93),(1.84,.12,.045),'wood',.004)
 box('Deep worn window sill',(0,-.17,1.10),(2.04,.45,.085),'oak',.015)
 rain=random.Random(842)
 for i in range(100):
  x=rain.uniform(-.85,.85);z=rain.uniform(1.20,2.49);length=rain.uniform(.025,.27)
  sphere('Rain drop on glass',(x,.073,z),(rain.uniform(.004,.010),.004,rain.uniform(.008,.022)),'Rain water glints')
  if i%3==0:pipe('Uneven rain runnel',[(x,.073,z),(x+.006,.072,z-length*.45),(x-.003,.073,max(1.19,z-length))],rain.uniform(.0017,.0032),'Rain water glints')
 for i,x in enumerate([-.78,-.61,-.39,-.18,.13,.29,.46,.64,.79]):
  top=2.45-(i%3)*.075;bottom=1.23+(i%4)*.12
  pipe('Long rain rivulet catching night light',[(x,.066,top),(x+.012,.065,top-.22),(x+.004,.066,(top+bottom)/2),(x-.008,.066,bottom)],.007,'Rain water glints')
 mount([ob for ob in bpy.data.objects if ob not in before],(1.30,-3.70,0),-math.pi/2)
 area('Rainy window blue illumination',(1.12,-3.70,1.90),125,(.18,.40,1),1.45,(-1.25,-2.5,.75))
 S.world.node_tree.nodes['Background'].inputs[1].default_value=.09
 # A long, narrow runner and three separate pools of warm ceiling light.
 box('Long woven corridor runner',(0,-.25,.012),(1.16,11.10,.025),'blue',.018)
 for x in [-.55,.55]:box('Runner lengthwise stitched border',(x,-.25,.029),(.027,10.96,.007),'paper',.002)
 for y in [-5.78,5.28]:
  for i in range(27):pipe('Runner fine fringe',[(-.52+i*.04,y,.021),(-.52+i*.04,y+(.065 if y>0 else -.065),.021)],.002,'paper')
 for y in [-4.3,1.2,4.65]:lamp(0,y,2.71)
 for ob in bpy.data.objects:
  if ob.type=='LIGHT' and ob.name.startswith('Warm pool'):ob.data.energy=52
 # Plain ceiling attic hatch with a dangling pull cord, clear of the end door.
 hatch_outline=box('Attic hatch recessed outline',(0,-1.60,3.002),(1.00,1.43,.021),'ink',.008)
 hatch=box('Plain plywood attic hatch',(0,-1.60,2.984),(.93,1.35,.025),'wood',.007)
 for x in [-.28,.28]:box('Attic hatch hinge',(x,-.97,2.967),(.095,.11,.009),'metal',.003)
 pipe('Hatch pull handle',[(.02,-2.10,2.969),(.02,-2.10,2.915),(.13,-2.10,2.915),(.13,-2.10,2.969)],.007,'brass')
 mat('Cotton pull cord',(.68,.65,.55),.88)
 cord=pipe('Attic pull-down string',[(.075,-2.10,2.918),(.080,-2.13,2.56),(.105,-2.155,2.21)],.006,'Cotton pull cord')
 pull=sphere('Small attic cord pull',(.105,-2.155,2.178),(.026,.026,.039),'wood')
 anchor('door-attic',hatch_outline,hatch,cord,pull)
 area('Cool entrance fill',(0,-6.1,2.55),22,(.36,.60,1),2.3,(0,1,1.4))
 area('Cool depth',(0,5.65,2.85),12,(.35,.58,1),1.2,(0,1.4,1.4))
 # A real plate on a slim wall shelf between the first two left-hand doors.
 box('Plate wall shelf',(-1.18,-1.65,1.045),(.25,.80,.06),'wood',.014)
 for y in [-1.9,-1.4]:pipe('Shelf brass bracket',[(-1.27,y,.89),(-1.08,y,1.015),(-1.27,y,1.015)],.009,'brass')
 before=set(bpy.data.objects)
 pmat=mat('Actual kindergarten artwork',(1,1,1));p=pmat.node_tree.nodes.get('Principled BSDF');tx=pmat.node_tree.nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(R/'scene/house-textures/plate-photo.jpg'));pmat.node_tree.links.new(tx.outputs['Color'],p.inputs['Base Color'])
 verts=[(0,-.008,0)];faces=[];uvs=[(.5,.5)]
 for i in range(128):
  a=2*math.pi*i/128;verts.append((.25*math.cos(a),0,.25*math.sin(a)));uvs.append((.5+.5*math.cos(a),.5+.5*math.sin(a)))
 for i in range(128):faces.append((0,i+1,(i+1)%128+1))
 me=bpy.data.meshes.new('Photo ceramic disk');me.from_pydata(verts,[],faces);me.uv_layers.new()
 for f in me.polygons:
  for li in f.loop_indices:me.uv_layers.active.data[li].uv=uvs[me.loops[li].vertex_index]
 ob=bpy.data.objects.new('Kindergarten plate',me);bpy.context.collection.objects.link(ob);ob.location=(0,0,1.34);me.materials.append(pmat);anchor('plate',ob)
 cyl('Ceramic plate back',(0,.025,1.34),.26,.03,'cream',(math.pi/2,0,0));pipe('Plate stand',[(-.21,-.05,1.085),(0,.08,1.10),(.21,-.05,1.085)],.009,'brass')
 mount([ob for ob in bpy.data.objects if ob not in before],(-1.13,-1.65,0),math.pi/2)
 area('Plate small warm pool',(-.62,-2.0,2.34),20,(1,.76,.51),.60,(-1.13,-1.65,1.35))
 # Pinned community notices between the two right-hand doors.
 before=set(bpy.data.objects)
 note=frame('Community contest notices','COMMUNITY\nCONTESTS',0,0,1.63,.72,.62);anchor('contests',note)
 for i in range(3):box('Small pinned contest card',(-.22+i*.22,-.055,1.43),(.16,.018,.10),'cream',.003)
 mount([ob for ob in bpy.data.objects if ob not in before],(1.19,-.20,0),-math.pi/2)
 area('Notice board pool',(.78,-.45,2.35),15,(1,.76,.51),.65,(1.19,-.2,1.6))


def workshop():
 init('workshop')
 for ob in list(bpy.data.objects):
  if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
 S.camera.location=(0,-1.65,2.12)
 S.camera.rotation_euler=(Vector((0,.80,1.05))-S.camera.location).to_track_quat('-Z','Y').to_euler();S.camera.data.lens=21
 # Unfinished garage envelope: slab, exposed framing, rough sheathing, conduit.
 box('Bare poured concrete slab',(0,-1,-.09),(7,8,.18),'concrete',.002)
 for x in [-2.5,0,2.5]:pipe('Concrete expansion joint',[(x,-5,.003),(x,3,.003)],.006,'ink')
 pipe('Hairline slab crack',[(-2.6,-.6,.006),(-2.1,-.8,.006),(-1.95,-1.15,.006),(-1.6,-1.30,.006)],.002,'ink')
 box('Garage raw rear sheathing',(0,1.68,1.7),(6,.06,3.4),'wood',.003)
 for x in [-2.88,-2.24,-1.60,-.96,-.32,.32,.96,1.60,2.24,2.88]:box('Exposed garage wall stud',(x,1.57,1.7),(.09,.17,3.4),'pale',.003)
 for z in [.06,3.32]:box('Garage framing plate',(0,1.57,z),(6,.17,.12),'pale',.003)
 for y in [-3,-1.5,0,1.5]:box('Open garage ceiling joist',(0,y,3.3),(6,.12,.22),'pale',.003)
 box('Unfinished side sheathing',(-3,-1,1.6),(.06,5.4,3.2),'wood')
 for y in [-3,-2.3,-1.6,-.9,-.2,.5,1.2]:box('Side exposed stud',(-2.9,y,1.6),(.17,.09,3.2),'pale',.003)
 pipe('Surface mounted conduit',[(-2.30,1.44,.3),(-2.30,1.44,2.60),(2.7,1.44,2.60)],.017,'metal')
 box('Workshop surface outlet',(-1.92,1.40,1.35),(.13,.075,.19),'metal',.009)
 for z in [1.31,1.39]:box('Outlet socket',(-1.92,1.356,z),(.048,.004,.030),'ink',.001)
 # One deep bench built into the wall, with a ledger, apron and construction-lumber legs.
 box('Wall-mounted workbench top',(0,.75,.95),(4.6,1.62,.09),'pale',.018)
 box('Workbench wall ledger',(0,1.43,.82),(4.6,.14,.18),'wood')
 box('Workbench front apron',(0,-.005,.80),(4.6,.11,.23),'wood')
 for x in [-2.13,2.13]:
  box('Workbench stout front leg',(x,.04,.43),(.14,.14,.86),'pale',.004)
  pipe('Workbench diagonal brace',[(x,.08,.40),(x,.66,.83)],.055,'pale')
 # Objects are within arm's reach rather than on separate display tables.
 tab=box('Old graphics tablet',(-.98,.30,1.025),(1.05,.62,.055),'ink',.04);anchor('tablet',tab)
 box('Tablet active surface',(-.98,.28,1.058),(.85,.47,.008),'blue',.008)
 pipe('Held stylus',[(-1.39,.04,1.075),(-.78,.31,1.075)],.012,'metal')
 box('Keyboard',(-.98,.92,1.024),(.94,.30,.045),'metal',.01)
 for i in range(10):
  for j in range(3):box('Keycap',(-1.37+i*.087,.83+j*.085,1.055),(.073,.067,.016),'cream',.003)
 pipe('Tablet cable',[(-1.48,.45,1.01),(-1.69,.57,1.01),(-1.68,.95,1.01),(-1.91,1.36,1.04)],.009,'rubber')
 clock=cyl('Working hours clock',(-1.62,1.42,2.04),.25,.07,'brass',(math.pi/2,0,0));anchor('working-hours',clock)
 cyl('Clock face',(-1.62,1.376,2.04),.224,.012,'paper',(math.pi/2,0,0))
 pipe('Clock hands',[(-1.76,1.365,2.11),(-1.62,1.365,2.04),(-1.62,1.365,2.21)],.009,'ink')
 greg=box('Thirty days with Greg',(-.60,1.43,1.69),(.62,.016,.44),'paper',.003);anchor('greg',greg)
 text('30 DAYS\n6 LITTLE GAMES',(-.60,1.416,1.75),.063,'ink');sphere('Bent note pin',(-.6,1.4,1.88),(.018,.012,.018),'red')
 crow=frame('Crowland study','CROWLAND',1.15,1.30,1.36,.54,.55);anchor('crowland',crow)
 sphere('Crow body',(1.12,1.24,1.40),(.105,.019,.065),'ink');sphere('Crow head',(1.23,1.235,1.46),(.045,.019,.04),'ink')
 pipe('Crow beak',[(1.26,1.23,1.46),(1.33,1.23,1.45)],.010,'ink');pipe('Crow branch',[(.92,1.23,1.27),(1.36,1.23,1.29)],.009,'wood')
 orb=sphere('Inkclipse spinning orb',(1.70,.77,1.23),(.19,.19,.19),'blue');anchor('inkclipse',orb)
 sphere('Ink on orb',(1.60,.62,1.31),(.085,.055,.075),'ink');cyl('Orb brass stand',(1.70,.77,1.023),.145,.06)
 zig=[]
 for i in range(5):zig.append(box('Zigzag puzzle piece',(-.13+i*.19,.97+(.12 if i%2 else 0),1.055),(.15,.15,.115),'red' if i%2 else 'cream',.009))
 anchor('zigzag',*zig)
 ship=box('Four crew ship prototype',(.50,.28,1.09),(.95,.35,.17),'metal',.065);anchor('destroyers',ship)
 box('Ship cabin',(.56,.30,1.23),(.41,.25,.15),'blue',.05)
 for x in [.13,.88]:cyl('Ship engine',(x,.29,1.10),.085,.36,'metal',(math.pi/2,0,0))
 for i in range(4):sphere('Crew seat marker',(.32+i*.12,.105,1.20),(.022,.017,.030),'red')
 # Pegboard and an ordinary task light over the work surface.
 box('Small practical pegboard',(.40,1.43,2.02),(.90,.04,.53),'oak',.006)
 for ix in range(8):
  for iz in range(4):cyl('Peg hole',(.02+ix*.11,1.404,1.81+iz*.12),.009,.007,'ink',(math.pi/2,0,0),12)
 for x in [.17,.45,.70]:
  pipe('Hanging hand tool',[(x,1.37,2.19),(x,1.37,1.91)],.015,'metal');box('Tool handle',(x,1.37,1.90),(.055,.035,.12),'red',.005)
 pipe('Task lamp arm',[(-2.0,1.0,1.0),(-2,1.0,1.6),(-1.75,.76,1.90)],.018,'metal')
 sphere('Task lamp shade',(-1.75,.76,1.90),(.15,.13,.06),'green');sphere('Task lamp bulb',(-1.75,.76,1.865),(.055,.055,.020),'glow')
 area('Close warm work light',(-1.72,.72,1.81),65,(1,.73,.46),.55,(-.55,.45,.98))
 area('Garage blue night from left',(-2.8,-.4,2.15),75,(.29,.49,1),1.9,(0,.8,.9))
 area('Dim garage ambient',(1,-1,2.9),35,(.48,.61,1),3,(0,1,1))


def attic():
 from mathutils import Matrix
 init('attic')
 for ob in list(bpy.data.objects):
  if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
 S.camera.location=(.10,-3.65,1.48);S.camera.rotation_euler=(Vector((0,1.5,.50))-S.camera.location).to_track_quat('-Z','Y').to_euler();S.camera.data.lens=24
 def timber(name,a,b,w=.12):
  a=Vector(a);b=Vector(b);ob=box(name,(a+b)/2,(w,w,(b-a).length),'pale',.005);ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return ob
 # Nothing is floored: open joists, uneven insulation and one leftover plywood sheet.
 box('Dark unfinished floor cavity',(0,.0,-.25),(8.2,9.2,.08),'ink')
 for i in range(17):
  x=-4+i*.5;box('Exposed rough floor joist',(x,0,.04),(.10,9.2,.32),'pale',.006)
  if i<16:
   for j in range(7):box('Uneven fiberglass insulation',(x+.25,-4.0+j*1.30,-.05),(.375,1.20,.14+random.uniform(-.025,.025)),'pink',.045)
 box('The one leftover plywood sheet',(0,-2.40,.22),(1.22,2.44,.04),'pale',.004)
 for x in [-.57,.57]:
  for y in [-3.56,-1.24]:cyl('Plywood old screw',(x,y,.244),.009,.002,'metal',verts=12)
 # Low pitched roof; dense rafters and knee braces force a duck-under route.
 mesh=bpy.data.meshes.new('Rough attic gable');mesh.from_pydata([(-4,4.4,.2),(4,4.4,.2),(4,4.4,.72),(0,4.4,3.1),(-4,4.4,.72)],[],[(0,1,2,3,4)]);ob=bpy.data.objects.new('Unfinished gable sheathing',mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(M['wood'])
 for side in [-1,1]:
  me=bpy.data.meshes.new('Raw roof sheathing');me.from_pydata([(0,-4.7,3.18),(side*4.1,-4.7,.75),(side*4.1,4.5,.75),(0,4.5,3.18)],[],[(0,1,2,3)]);ob=bpy.data.objects.new('Pitched unfinished roof',me);bpy.context.collection.objects.link(ob);me.materials.append(M['wood'])
  for y in [-4.2,-2.7,-1.2,.3,1.8,3.3,4.35]:timber('Exposed roof rafter',(side*3.98,y,.72),(0,y,3.1),.13)
  timber('Low side purlin',(side*2.50,-4.4,1.58),(side*2.50,4.4,1.58),.15)
  for y in [-.45,2.2]:
   timber('Rough roof support post',(side*1.9,y,.20),(side*1.9,y,1.91),.13)
   timber('Diagonal head-height knee brace',(side*1.9,y,1.02),(side*.82,y,1.91),.13)
 timber('Low foreground collar tie',(-1.92,-.45,1.78),(1.92,-.45,1.78),.14)
 timber('Second awkward collar tie',(-1.9,2.2,1.92),(1.9,2.2,1.92),.13)
 timber('Unfinished ridge beam',(0,-4.5,3.03),(0,4.5,3.03),.17)
 # A small utilitarian gable opening; restrained warm light from a bare work bulb.
 window(0,4.31,1.98,.65,.64)
 pipe('Bare bulb hanging wire',[(-.30,1.2,2.86),(-.30,1.2,2.24)],.009,'rubber');sphere('Attic bare work bulb',(-.30,1.2,2.22),(.055,.055,.085),'glow')
 area('Bare work bulb pool',(-.30,1.2,2.16),105,(1,.70,.42),.55,(0,.4,.25))
 area('Cool crawl access',(.1,-3.2,1.5),35,(.35,.55,1),1.7,(0,.8,.4))
 area('Plywood work light',(.6,-1.2,1.45),24,(1,.75,.48),.70,(0,-1.5,.23))
 # The red tricycle and opened black bag remain among the joists.
 before=set(bpy.data.objects)
 # Model in a consistent local frame: forward is +X, every axle runs along Y.
 # One large driven front wheel and two small rear wheels share a ground plane.
 def wheel(x,y,r):
  bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=12,major_radius=r-.038,minor_radius=.038,location=(x,y,r),rotation=(math.pi/2,0,0))
  tire=bpy.context.object;tire.name='Tricycle tire';tire.data.materials.append(M['rubber'])
  for face in tire.data.polygons:face.use_smooth=True
  cyl('Tricycle cream rim',(x,y,r),r-.065,.052,'cream',(math.pi/2,0,0))
  for side in [-1,1]:
   yy=y+side*.03
   cyl('Tricycle red hub',(x,yy,r),.055,.025,'red',(math.pi/2,0,0))
   for i in range(10):
    a=i*math.tau/10
    pipe('Tricycle wheel spoke',[(x+.055*math.cos(a),yy+side*.015,r+.055*math.sin(a)),(x+(r-.08)*math.cos(a),yy+side*.015,r+(r-.08)*math.sin(a))],.008,'metal')
  return tire
 wheel(.55,0,.33)
 for y in [-.39,.39]:wheel(-.48,y,.22)
 pipe('Tricycle rear axle',[(-.48,-.45,.22),(-.48,.45,.22)],.028,'metal')
 box('Tricycle rear standing step',(-.48,0,.29),(.26,.64,.045),'red',.018)
 for y in [-.23,-.12,0,.12,.23]:box('Tricycle step tread',(-.48,y,.315),(.18,.012,.004),'rubber',.002)
 # Swept low frame connects the rear axle to the steering head.
 pipe('Tricycle curved frame',[(-.48,0,.25),(-.31,0,.30),(-.14,0,.39),(.03,0,.48),(.20,0,.62),(.36,0,.79)],.039,'red')
 pipe('Tricycle saddle post',[(-.22,0,.35),(-.22,0,.67)],.025,'metal')
 sphere('Tricycle black saddle',(-.20,0,.69),(.18,.135,.045),'rubber')
 pipe('Tricycle head tube',[(.40,0,.66),(.32,0,.90)],.043,'red')
 # Two fork legs straddle the front wheel and meet its actual hub.
 for y in [-.077,.077]:
  pipe('Tricycle front fork',[(.35,0,.83),(.39,y,.74),(.48,y,.54),(.55,y,.33)],.023,'red')
 pipe('Tricycle steering stem',[(.32,0,.87),(.28,0,1.01)],.023,'metal')
 pipe('Tricycle swept handlebar',[(.18,-.28,1.00),(.26,-.17,1.03),(.28,0,1.03),(.26,.17,1.03),(.18,.28,1.00)],.019,'metal')
 for side in [-1,1]:
  pipe('Tricycle handlebar grip',[(.20,side*.23,1.01),(.15,side*.36,.98)],.029,'rubber')
  # Opposed cranks and broad rubber pedals, directly driven by the front axle.
  pipe('Tricycle pedal crank',[(.55,side*.06,.33),(.55,side*.14,.33),(.55+side*.12,side*.14,.33+side*.065)],.013,'metal')
  box('Tricycle rubber pedal',(.55+side*.12,side*.19,.33+side*.065),(.095,.12,.04),'rubber',.009)
 tric=[ob for ob in bpy.data.objects if ob not in before]
 anchor('tricycle',*tric)
 bpy.context.view_layer.update()
 # Park ahead of the stored print so its frame and all three wheels can be read.
 pose=Matrix.Translation((-1.8,.45,.24))@Matrix.Rotation(-.50,4,'Z')
 for ob in tric:ob.matrix_world=pose@ob.matrix_world

 mat('Black bag plastic',(.013,.016,.018),.30,noise=.18)
 verts=[];faces=[];n=32
 for ring in range(4):
  for i in range(n):
   a=i*math.tau/n;r=[.26,.37,.40,.34][ring]+random.uniform(-.025,.025);z=[.22,.32,.45,.67][ring]+random.uniform(-.025,.025)
   if ring==3:z-=.24*max(0,-math.sin(a))
   verts.append((-2.90+r*math.cos(a),.55+r*.74*math.sin(a),z))
 for j in range(3):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 me=bpy.data.meshes.new('Open wrinkled plastic bag');me.from_pydata(verts,[],faces);ob=bpy.data.objects.new('Opened black trash bag',me);bpy.context.collection.objects.link(ob);me.materials.append(M['Black bag plastic'])
 ob.modifiers.new('Thin folded plastic','SOLIDIFY').thickness=.004
 for f in me.polygons:f.use_smooth=True
 cyl('Empty bag bottom',(-2.90,.55,.225),.255,.007,'ink')
 pipe('Folded bag mouth',[verts[3*n+i%n] for i in range(n+1)],.012,'Black bag plastic')
 # Old furnace, bare ductwork and haphazard visible cabling, all static props.
 furnace=box('Old attic furnace',(-2.52,2.60,.82),(1.02,.78,1.24),'metal',.035)
 box('Furnace service panel',(-2.52,2.19,.81),(.85,.035,.93),'concrete',.014)
 for i in range(8):box('Furnace grille opening',(-2.52,2.163,.48+i*.058),(.63,.008,.023),'ink',.003)
 cyl('Furnace flue',(-2.52,2.58,1.72),.14,.70,'metal');pipe('Bent furnace duct',[(-2.52,2.58,2.00),(-2.18,2.58,2.20),(-1.80,2.58,2.10)],.135,'metal')
 box('Loose electrical junction box',(1.93,-.45,1.12),(.21,.14,.24),'metal',.008)
 box('Misaligned junction cover',(1.94,-.54,1.10),(.16,.015,.20),'metal',.005).rotation_euler.y=.17
 pipe('Loose hanging wire',[(1.95,-.48,1.26),(1.72,-.40,1.54),(1.1,-.46,1.68),(.60,-.48,1.55),(.1,-.46,1.65),(-.6,-.43,1.69),(-1.55,-.45,1.65)],.012,'rubber')
 pipe('Unmatched red wire',[(1.94,-.45,1.30),(1.80,.0,1.47),(1.98,.48,1.73),(1.90,1.1,1.42),(1.88,2.15,1.68)],.008,'red')
 pipe('Furnace supply cable',[(-2.9,2.4,.21),(-2.8,1.7,.24),(-2.0,1.50,.22),(-1.8,.7,.26),(-1.6,.3,.22)],.011,'rubber')
 # Unframed drafts and notebooks, not decorated furniture.
 chart=box('Loose Longtide paper study',(.15,3.10,.76),(1.08,.025,.72),'paper',.002);anchor('longtide',chart)
 text('L O N G T I D E',(.15,3.078,.88),.075,'ink')
 for k in range(3):pipe('Pencilled universe orbit',[(.15+.12*(k+1)*math.cos(i*math.tau/40),3.075,.69+.07*(k+1)*math.sin(i*math.tau/40)) for i in range(41)],.002,'ink')
 for i in range(12):sphere('Chart pencil star',(-.29+random.random()*.9,3.07,.50+random.random()*.43),(.006,.002,.006),'ink')
 box('Bent carton behind drawing',(.1,3.22,.39),(.78,.46,.36),'clay',.009)
 q=box('Worn questions notebook',(-.22,-1.27,.292),(.35,.43,.075),'blue',.009);anchor('questions',q)
 box('Questions notebook pages',(-.22,-1.27,.316),(.32,.40,.035),'paper',.003);text('?',(-.22,-1.26,.337),.18,'ink',(0,0,0))
 pipe('Loose graphite pencil',[(-.43,-1.56,.256),(-.22,-1.74,.256)],.009,'wood')
 d=box('Unframed Derron character draft',(1.10,1.55,.66),(.47,.028,.61),'paper',.002);anchor('derron',d)
 text('DERRON',(1.10,1.525,.87),.052,'ink');cyl('Drawn character head',(1.10,1.527,.77),.045,.003,'ink',(math.pi/2,0,0))
 pipe('Character pencil torso',[(1.10,1.524,.72),(1.10,1.524,.53)],.008,'ink')
 for side in [-1,1]:
  pipe('Character pencil limb',[(1.10,1.524,.66),(1.10+side*.073,1.524,.57)],.006,'ink');pipe('Character pencil leg',[(1.10,1.524,.53),(1.10+side*.053,1.524,.42)],.007,'ink')
 box('Paper draft support carton',(1.12,1.70,.35),(.55,.38,.27),'clay',.008)
 box('Rough farm model carton',(1.98,.47,.39),(.87,.67,.36),'clay',.009)
 farm=box('Cardboard farm dream model',(1.98,.47,.594),(.86,.61,.034),'green',.004);anchor('farm',farm)
 for i in range(4):pipe('Model potato row',[(1.63+i*.13,.23,.625),(1.63+i*.13,.72,.625)],.011,'clay')
 box('Rough model farm robot',(2.19,.50,.69),(.20,.16,.11),'cream',.006);solar=box('Tiny robot solar panel',(2.19,.50,.77),(.32,.24,.019),'blue',.004);solar.rotation_euler.y=.14
 for x in [2.09,2.29]:
  for y in [.39,.61]:cyl('Model robot wheel',(x,y,.64),.038,.032,'rubber',(math.pi/2,0,0),24)
 secret=box('Folded private story letter',(.30,-1.30,.261),(.26,.34,.015),'paper',.003);anchor('secret',secret);cyl('Plain red letter seal',(.30,-1.30,.272),.028,.005,'red')


def basement():
 init('basement');S.camera.location=(3.6,-9,3.35);S.camera.rotation_euler=(Vector((0,1.0,1.25))-S.camera.location).to_track_quat('-Z','Y').to_euler()
 box('Concrete slab',(0,-3.2,-.10),(10,13.8,.2),'concrete');box('Basement ceiling',(0,-3.2,3.86),(10,13.8,.10),'concrete')
 box('Masonry backing',(0,3.6,2),(10,.10,4),'concrete')
 # Individual masonry courses and mortar form the full rear and side wall.
 for row in range(10):
  for col in range(11):box('Old concrete block',(-4.8+col*.96+(row%2)*.46,3.40,.18+row*.35),(.93,.25,.32),'concrete',.012)
  for col in range(16):
   for side in [-1,1]:box('Side masonry',(side*5,-9.7+col*.85,.18+row*.35),(.25,.82,.32),'concrete',.012)
 for x in [-4.6,-1,2.6]:pipe('Basement ceiling joist',[(x,-3,3.7),(x,3.5,3.7)],.09,'wood')
 pipe('Copper water pipe',[(-4.4,3.07,.15),(-4.4,3.07,3.3),(4.5,3.07,3.3)],.04,'brass');window(-2.2,3.22,2.95,1.8,.65)
 lamp(.8,1.0,2.7);area('Quiet warm cellar',(-3,-2,3),180,(1,.64,.36),3,(0,1,0))
 # Long low archive shelves, sparse boxes and an empty place.
 for z in [.30,1.15,2.00]:box('Archive shelf',(2.65,2.30,z),(4.2,.9,.10),'wood')
 for x in [.65,4.65]:box('Shelf upright',(x,2.30,1.12),(.12,.85,2.3),'wood')
 for x in [1.3,3.7]:
  box('Archive carton',(x,2.30,1.5),(.78,.65,.6),'clay');box('Carton label',(x,1.966,1.5),(.42,.012,.19),'paper');text('ARCHIVE',(x,1.95,1.47),.065)
 table(-2.7,1.25,2.7,1.20,.92)
 com=box('Community history box',(-2.85,1.17,1.17),(1.10,.7,.39),'wood');anchor('community',com)
 box('Open box shadow',(-2.85,1.17,1.38),(.93,.57,.015),'ink')
 for i in range(6):
  card=box('Community card',(-3.20+i*.14,1.14,1.47),(.09,.29,.38),'paper');card.rotation_euler[1]=random.uniform(-.2,.2)
 text('COMMUNITY',(-2.85,.804,1.14),.085,'paper')
 # Unfinished film/game folders laid across a low table.
 table(.3,-1.5,2.8,1.35,.72);folders=[]
 for x,body in [(-.55,'II'),(.32,'III')]:
  o=box('Neverending Light folder',(x,-1.50,.84),(.70,.80,.055),'blue');text(body,(x,-1.5,.876),.23,'paper',(0,0,0));folders.append(o)
 anchor('neverending',*folders)
 # A studio reel recorder, microphone and cable for the cave sprite memories.
 table(3.25,-.4,1.7,1,.90);rec=box('Voice tape recorder',(3.28,-.4,1.06),(1.12,.70,.20),'metal',.065);anchor('voices',rec)
 for x in [2.98,3.58]:
  cyl('Tape reel',(x,-.4,1.21),.22,.035,'rubber');cyl('Reel hub',(x,-.4,1.23),.06,.02,'brass')
 for i in range(5):box('Recorder key',(2.9+i*.17,-.69,1.19),(.13,.07,.027),'cream',.005)
 pipe('Mic stand',[(4,-.5,.95),(4,-.5,1.6)],.014,'metal');sphere('Microphone',(4,-.5,1.64),(.055,.055,.14),'metal');pipe('Coiled audio cable',[(3.9+.24*math.cos(i*.25),-.7+.16*math.sin(i*.25),.96) for i in range(80)],.007,'rubber')
 # D notebook on a stool, intentionally separate.
 cyl('Old stool',(-3.5,-1.65,.55),.47,.14,'wood')
 for x in [-3.77,-3.23]:box('Stool foot',(x,-1.65,.24),(.065,.065,.50),'wood')
 d=box('D notebook',(-3.5,-1.65,.66),(.56,.66,.08),'red');text('D',(-3.5,-1.65,.706),.28,'paper',(0,0,0));anchor('d-note',d)
 # Empty chair remains welcoming, and a folded blanket gives warmth.
 box('Chair seat',(-1.2,.05,.53),(.65,.65,.11),'wood');box('Chair back',(-1.2,.34,1.0),(.66,.12,.93),'wood')
 for x in [-1.47,-.93]:
  for y in [-.22,.29]:box('Chair leg',(x,y,.26),(.055,.055,.52),'wood')
 box('Folded wool blanket',(-1.2,.02,.62),(.61,.51,.06),'blue',.03)


def ordinary_clutter(room):
 # Mundane modeled belongings compete visually with discoveries. No new anchors/text.
 mat('Scuffed leather',(.075,.041,.023),.66,noise=.20)
 mat('Dusty canvas',(.22,.24,.20),.91,noise=.30)
 mat('Worn cloth',(.095,.135,.17),.96,noise=.28)
 def ring(n,loc,r=.17,t=.018,m='rubber',rot=(0,0,0)):
  bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=loc,major_radius=r,minor_radius=t,rotation=rot);ob=bpy.context.object;ob.name=n;ob.data.materials.append(M[m]);return ob
 def carton(n,x,y,z,w=.6,d=.5,h=.4):
  ob=box(n,(x,y,z+h/2),(w,d,h),'clay',.009);ob.rotation_euler.z=random.uniform(-.13,.13)
  box('Carton packing tape',(x,y,z+h+.002),(.06,d*.94,.005),'paper',.002)
  pipe('Carton top seam',[(x-w*.43,y,z+h+.004),(x+w*.43,y,z+h+.004)],.002,'ink');return ob
 def can(x,y,z,r=.085,h=.18,m='metal'):
  cyl('Unlabeled utility can',(x,y,z+h/2),r,h,m);cyl('Can lid',(x,y,z+h+.003),r*.98,.013,'metal');return None
 def jar(x,y,z,r=.07,h=.23):
  cyl('Plain jar',(x,y,z+h/2),r,h,'cream');cyl('Jar screw lid',(x,y,z+h),r*1.03,.028,'metal')
 def coil(x,y,z,r=.23,m='rubber'):
  for i in range(3):ring('Coiled spare cable',(x,y,z+i*.012),r-i*.027,.014,m)
  pipe('Trailing cable',[(x+r,y,z),(x+r+.15,y-.1,z),(x+r+.29,y-.23,z),(x+r+.38,y-.20,z)],.012,m)
 def rag(x,y,z,w=.5,d=.4,m='Worn cloth',drop=0):
  verts=[];faces=[];N=7
  for j in range(N):
   for i in range(N):
    zz=z+.025*math.sin(i*1.45+j*.90)+.014*math.sin(j*2.2);zz-=drop*max(0,1-j/2)
    verts.append((x-w/2+i*w/(N-1),y-d/2+j*d/(N-1),zz))
  for j in range(N-1):
   for i in range(N-1):a=j*N+i;faces.append((a,a+1,a+N+1,a+N))
  me=bpy.data.meshes.new('Rumpled fabric');me.from_pydata(verts,[],faces);ob=bpy.data.objects.new('Ordinary rumpled cloth',me);bpy.context.collection.objects.link(ob);me.materials.append(M[m]);ob.modifiers.new('Fabric thickness','SOLIDIFY').thickness=.004
  for f in me.polygons:f.use_smooth=True
 def shoe(x,y,boot=False):
  sphere('Ordinary shoe',(x,y,.095),(.115,.23,.083),'Scuffed leather');box('Shoe sole',(x,y,.035),(.24,.45,.035),'rubber',.05)
  if boot:cyl('Boot ankle',(x,y+.09,.22),.098,.28,'Scuffed leather')
  for j in range(3):pipe('Loose shoe lace',[(x-.060,y+.035-j*.04,.16),(x+.065,y-.005-j*.04,.16)],.003,'paper')
 def paper(x,y,z,w=.32,d=.24):
  for i in range(4):ob=box('Blank loose paper',(x+random.uniform(-.03,.03),y+random.uniform(-.025,.025),z+i*.006),(w,d,.004),'paper',.001);ob.rotation_euler.z=random.uniform(-.14,.14)
 def hammer(x,y,z):
  pipe('Hammer wooden handle',[(x,y,z),(x+.16,y+.09,z+.02)],.017,'wood');box('Hammer steel head',(x+.17,y+.09,z+.03),(.055,.17,.055),'metal',.009)
 def bolts(x,y,z,count=7):
  for i in range(count):
   xx=x+random.uniform(-.17,.17);yy=y+random.uniform(-.12,.12);cyl('Loose hardware',(xx,yy,z+.01),.018,.02,'metal',verts=6)
 if room=='hallway':
  for x,y,boot in [(1.04,-.55,True),(1.30,-.38,True),(1.09,.28,False),(1.32,.44,False),(-1.14,-.82,False),(-.94,-.69,False)]:shoe(x,y,boot)
  box('Coat hook rail',(1.49,1.55,1.91),(.07,2.10,.12),'wood')
  for i,y in enumerate([.75,1.55,2.35]):
   pipe('Brass coat hook',[(1.45,y,1.90),(1.28,y,1.89),(1.25,y,1.96)],.011,'brass')
   if i<2:
    m='Worn cloth' if i==0 else 'green';sphere('Hanging ordinary jacket',(1.34,y,1.31),(.11,.23,.37),m)
    for side in [-1,1]:pipe('Jacket loose sleeve',[(1.34,y+side*.17,1.62),(1.27,y+side*.29,1.32),(1.30,y+side*.32,1.10)],.065,m)
    sphere('Jacket folded collar',(1.33,y,1.69),(.12,.14,.047),m)
  box('Tote bag',(1.10,-.60,.25),(.40,.22,.42),'Dusty canvas',.085);pipe('Tote handle',[(1.10,-.68,.46),(1.10,-.60,.67),(1.10,-.52,.46)],.016,'Scuffed leather')
  sphere('Closed umbrella canopy',(1.36,3.05,.51),(.073,.073,.40),'blue');pipe('Umbrella shaft and hook',[(1.36,3.05,.11),(1.36,3.05,1.07),(1.30,3.05,1.15),(1.24,3.05,1.10)],.012,'metal')
  carton('Parcel by the wall',-1.10,1.11,.03,.64,.55,.37);carton('Smaller parcel leaning nearby',-1.06,1.15,.40,.43,.42,.23);carton('Low ordinary parcel',-1.12,2.15,.03,.48,.61,.25)
  jar(-1.42,-1.245,1.078,.034,.11);paper(-1.43,-1.975,1.087,.12,.095)
  ring('Ordinary key ring',(-1.39,-1.99,1.113),.023,.004,'brass')
  for i in range(3):pipe('Unmarked household key',[(-1.39,-1.99,1.11),(-1.42+i*.015,-1.93,1.11)],.003,'brass')
  rag(.15,-4.3,.040,.48,.23,'Dusty canvas')
  for i in range(18):
   y=random.uniform(-4.6,.3);x=random.choice([-.54,.54]);pipe('Pulled runner thread',[(x,y,.034),(x+random.uniform(-.045,.045),y+.05,.035),(x+.035,y+.09,.033)],.002,'paper')
 elif room=='workshop':
  for x,y,r,h in [(-2.06,1.20,.09,.20),(-1.82,1.11,.065,.15),(1.94,1.29,.09,.23)]:can(x,y,.997,r,h)
  jar(-1.82,.72,.997,.065,.16);jar(.05,1.32,.997,.055,.13)
  coil(-1.85,.27,1.005,.14);hammer(-.29,.36,1.004);bolts(-.24,.64,1.004,9)
  paper(.25,1.28,1.004,.30,.17);paper(.85,.64,1.004,.24,.16)
  rag(1.12,.70,1.008,.29,.23,'Worn cloth')
  for i in range(5):
   ob=box('Unfinished small component',(-.12+i*.14,.06,1.027),(.065,.07,.045),'metal',.004);ob.rotation_euler.z=random.uniform(-.6,.6)
  pipe('Loose red bench lead',[(-.43,1.20,1.005),(-.31,1.13,1.008),(-.30,.75,1.008),(-.10,.68,1.008)],.006,'red')
  carton('Tools beneath built-in bench',-1.15,.88,.025,.81,.63,.44);carton('Garage offcuts box',2.58,.55,.025,.44,.58,.38)
  for i in range(6):
   ob=box('Leaning scrap timber',(-2.55+i*.055,1.15,.70),(.045,.075,1.4),'pale',.003);ob.rotation_euler.y=-.13+i*.028
  coil(-2.45,-.55,.035,.26);rag(2.35,-.30,.035,.43,.31,'Dusty canvas')
 elif room=='attic':
  # Storage is tucked around structural members, never laid as another floor.
  carton('Attic storage carton',-3.24,3.26,.22,.64,.75,.42);carton('Unsorted carton beside it',-3.08,3.13,.64,.49,.54,.27)
  carton('Attic utility carton',2.62,2.38,.22,.82,.69,.47);carton('Shifted smaller carton',2.79,2.37,.69,.52,.50,.32)
  carton('Low dusty storage box',2.98,1.18,.22,.59,.73,.39);carton('Old box beyond braces',-.88,3.33,.22,.78,.64,.40)
  ob=box('Plain loose cardboard panel',(-.87,3.00,.77),(.67,.025,.65),'clay',.003);ob.rotation_euler.x=-.16
  for x,y in [(-3.11,1.45),(-3.20,2.11)]:
   cyl('Dusty rolled insulation',(x,y,.40),.15,.78,'pink',(math.pi/2,0,.06));ring('Roll retaining strap',(x,y,.40),.155,.007,'paper',(math.pi/2,0,0))
  for i in range(3):cyl('Unmarked rolled paper',(.62+i*.14,2.76,.33),.055,.56,'paper',(math.pi/2,0,0))
  coil(-.78,-1.41,.24,.20);coil(2.79,.12,.25,.25);ring('Used masking tape',(-.45,-1.10,.283),.060,.023,'paper')
  rag(-1.06,2.18,.225,.48,.41,'Dusty canvas');rag(2.58,1.72,.225,.54,.39,'Worn cloth')
  for i in range(8):
   x=random.choice([-1.06,2.62])+random.uniform(-.17,.17);y=random.uniform(1.05,2.70);ob=box('Short attic offcut',(x,y,.25),(.055,.34,.04),'pale',.003);ob.rotation_euler.z=random.uniform(-.55,.55)
  cyl('Stored short duct',(3.03,.38,.43),.17,.92,'metal',(math.pi/2,0,.07));cyl('Dusty spare duct',(-3.39,2.65,.36),.11,.66,'metal',(math.pi/2,0,-.08))
  carton('Small unmarked hardware box',.71,2.37,.22,.34,.29,.22);bolts(-.78,-1.2,.24,6)
  # Plain packing materials make the two paper studies part of stored clutter.
  ob=box('Spare cardboard sheet',(1.63,1.80,.65),(.34,.018,.59),'clay',.002);ob.rotation_euler.x=.13
  paper(.60,2.56,.255,.33,.23);can(2.38,.91,.22,.075,.14)
 elif room=='basement':
  carton('Upper shelf storage',2.26,2.34,2.06,.80,.63,.55);carton('Upper shelf small box',4.02,2.28,2.06,.59,.57,.46)
  for x,y in [(2.27,2.22),(2.60,2.35),(4.12,2.26)]:can(x,y,1.21,.10,.29)
  jar(2.83,2.12,1.21,.085,.25);rag(3.21,2.38,2.067,.64,.57,'Worn cloth',.24)
  for x in [1.37,2.47,3.58]:carton('Lower shelf household box',x,2.28,.36,.73,.67,.47)
  carton('Box under community table',-3.36,1.31,.025,.78,.69,.61);carton('Stored carton by left wall',-4.26,.44,.025,.88,.72,.66);carton('Stacked household carton',-4.25,.45,.70,.65,.63,.48)
  paper(-1.83,1.36,1.01,.39,.27);can(-1.76,1.11,1.00,.095,.18);rag(-3.72,1.09,1.00,.47,.32,'Dusty canvas')
  carton('Small floor box beside stool',-4.16,-1.55,.03,.64,.62,.43);rag(-3.57,-1.23,.646,.36,.26,'Dusty canvas')
  paper(.94,-1.06,.802,.45,.36);ring('Ordinary tape roll',(-.83,-.98,.85),.080,.027,'paper');rag(-.60,-2.02,.80,.66,.41,'Worn cloth',.31)
  for i in range(3):box('Unmarked cassette case',(2.74,-.12,1.015+i*.042),(.25,.17,.039),'blue',.008)
  jar(3.87,-.16,.995,.074,.20);coil(3.48,-.10,1.013,.15);carton('Recorder table storage box',3.21,-.46,.03,.61,.54,.43)
  coil(.85,.58,.055,.39);coil(1.01,.51,.068,.25);rag(-4.10,-.10,.08,.82,.71,'Dusty canvas')
  # A real open laundry basket with woven sides and a loose heap of cloth.
  bx=4.03;by=-1.16
  box('Laundry basket base',(bx,by,.065),(.77,.61,.07),'Dusty canvas',.10)
  for z in [.15,.23,.31,.39,.47,.55]:
   pipe('Basket woven rim',[(bx-.38,by-.30,z),(bx+.38,by-.30,z),(bx+.38,by+.30,z),(bx-.38,by+.30,z),(bx-.38,by-.30,z)],.010,'paper')
  for i in range(9):
   x=bx-.34+i*.085
   for y in [by-.30,by+.30]:pipe('Basket upright weave',[(x,y,.12),(x,y,.55)],.008,'paper')
  for i in range(6):
   y=by-.25+i*.10
   for x in [bx-.38,bx+.38]:pipe('Basket upright weave',[(x,y,.12),(x,y,.55)],.008,'paper')
  for i in range(4):rag(bx+random.uniform(-.15,.15),by+random.uniform(-.10,.10),.48+i*.035,.42,.36,'Worn cloth' if i%2 else 'Dusty canvas')
  pipe('Stored flexible hose',[(4.65,2.83,.25),(4.65,2.84,1.03),(4.22,2.83,1.17),(3.85,2.83,.96)],.04,'rubber')
 # Mix ordinary objects directly among discoveries, not just at room edges.
 def blank_book(x,y,z,w=.30,d=.34,m='blue',angle=.0):
  ob=box('Unlabeled ordinary notebook',(x,y,z+.037),(w,d,.066),m,.006);ob.rotation_euler.z=angle
  ob=box('Notebook plain page edge',(x,y-d/2-.003,z+.037),(w*.90,.009,.029),'paper',.002);ob.rotation_euler.z=angle
 if room=='workshop':
  blank_book(1.90,.27,1.00,.22,.30,'green',.15)
 elif room=='attic':
  ob=box('Plain paper leaning study',(-.67,2.94,.67),(.48,.022,.58),'paper',.002);ob.rotation_euler.x=-.08
  ob=box('Unmarked cardboard leaning study',(.86,3.47,.84),(.56,.023,.64),'clay',.002);ob.rotation_euler.x=.10
  ob=box('Plain spare study near character',(.58,1.83,.57),(.38,.019,.55),'paper',.002);ob.rotation_euler.x=.12
  ob=box('Unmarked dark packing board',(1.66,1.99,.67),(.39,.024,.55),'blue',.002);ob.rotation_euler.x=-.10
  blank_book(-.04,-1.68,.247,.18,.23,'green',-.13);blank_book(-.80,-.94,.245,.30,.34,'blue',.12)
  paper(.34,-1.73,.247,.23,.21);paper(.048,-1.27,.248,.13,.18);paper(-.52,2.58,.251,.28,.24)
  blank_book(.60,2.49,.250,.24,.32,'blue',-.13);ring('Small ordinary tape roll',(.71,2.59,.33),.042,.018,'paper')
  for i in range(3):ob=box('Small plain packing slip',(-.22+i*.14,2.88,.265),(.13,.21,.006),'paper',.001);ob.rotation_euler.z=random.uniform(-.32,.32)
 elif room=='basement':
  blank_book(1.26,-1.77,.800,.32,.37,'green',.20);blank_book(1.12,-1.24,.800,.36,.30,'blue',-.16);blank_book(-.78,-1.02,.801,.27,.33,'blue',.16)
  paper(-.85,-1.86,.801,.34,.20);paper(.82,-1.94,.801,.28,.24);paper(.43,-.94,.801,.29,.20)
  ob=box('Stack of unmarked old folders',(.96,-1.54,.862),(.32,.35,.075),'blue',.005);ob.rotation_euler.z=.16
  pipe('Pencil on ordinary paper',[(.99,-1.95,.827),(1.24,-1.92,.827)],.008,'wood');can(-1.01,-1.35,.799,.070,.14)
  can(2.51,-.74,.975,.080,.23);can(3.99,-.03,.976,.068,.20);coil(2.55,-.39,.983,.13);coil(3.68,.016,.984,.11,'red')
  paper(3.89,-.78,.977,.22,.15);bolts(2.52,-.17,.984,9)
  for i in range(3):ob=box('Unmarked small recorder-table case',(2.54+i*.095,-.05,1.015),(.075,.16,.046),'metal',.004);ob.rotation_euler.z=random.uniform(-.15,.15)

def printed_material(path):
 key='Print '+Path(path).stem
 if key in M:return key
 m=mat(key,(.8,.8,.8),.85);nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
 tx=nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(R/path),check_existing=True)
 links.new(tx.outputs['Color'],p.inputs['Base Color']);links.new(tx.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.06
 return key

def print_plane(n,path,loc,w,h):
 me=bpy.data.meshes.new(n);me.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(0,1,2,3)]);me.uv_layers.new()
 for li,uv in zip(me.polygons[0].loop_indices,[(0,0),(1,0),(1,1),(0,1)]):me.uv_layers.active.data[li].uv=uv
 ob=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(ob);ob.location=loc;me.materials.append(M[printed_material(path)]);return ob

def displayed_print(n,path,loc,w,h,framed=False,angle=0,lean=0,frame_mat='wood',standing=False):
 from mathutils import Matrix
 before=set(bpy.data.objects)
 box(n+' backing',(0,.012,0),(w+.025,.024,h+.025),'paper',.002)
 print_plane(n+' image',path,(0,-.005,0),w,h)
 if framed:
  for x in [-w/2-.018,w/2+.018]:box(n+' side frame',(x,-.005,0),(.045,.055,h+.09),frame_mat,.008)
  for z in [-h/2-.018,h/2+.018]:box(n+' frame rail',(0,-.005,z),(w+.09,.055,.045),frame_mat,.008)
 if standing:pipe(n+' kickstand',[(0,.03,h*.22),(0,.22,-h/2)],.015,'wood')
 bpy.context.view_layer.update()
 transform=Matrix.Translation(Vector(loc))@Matrix.Rotation(angle,4,'Z')@Matrix.Rotation(lean,4,'X')
 for ob in bpy.data.objects:
  if ob not in before:ob.matrix_world=transform@ob.matrix_world

def printed_tshirt(path):
 from mathutils.geometry import tessellate_polygon
 mat('Old cotton shirt',(.53,.55,.49),.98,noise=.15)
 cx,cy,base=-.05,1.10,1.195
 outline=[(-.28,-.65),(.28,-.65),(.28,.22),(.55,.04),(.70,.25),(.39,.52),(.17,.56),(.10,.47),(-.10,.47),(-.17,.56),(-.39,.52),(-.70,.25),(-.55,.04),(-.28,.22)]
 def height(x,y):return base-max(0,1.0-(cy+y))*1.25-max(0,abs(x)-.52)*.20+.010*math.sin(x*17+y*13)
 verts=[Vector((cx+x,cy+y,height(x,y))) for x,y in outline];tri=tessellate_polygon([verts]);faces=[[v if isinstance(v,int) else verts.index(v) for v in t] for t in tri]
 me=bpy.data.meshes.new('Cotton T-shirt sleeves and neckline');me.from_pydata(verts,[],faces)
 import bmesh
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=5,use_grid_fill=True);bm.to_mesh(me);bm.free()
 for v in me.vertices:v.co.z=height(v.co.x-cx,v.co.y-cy)
 me.materials.append(M['Old cotton shirt']);ob=bpy.data.objects.new('Printed worn T-shirt draped across workbench',me);bpy.context.collection.objects.link(ob)
 solid=ob.modifiers.new('Cotton thickness','SOLIDIFY');solid.thickness=.008
 pipe('T-shirt collar seam',[(cx+x,cy+y,height(x,y)+.007) for x,y in [(-.17,.56),(-.13,.51),(-.10,.47),(0,.455),(.10,.47),(.13,.51),(.17,.56)]],.010,'Old cotton shirt')
 # The actual cartridge print is UV mapped onto a slightly rippled chest panel.
 verts=[];faces=[];uv=[];N=7
 for j in range(N):
  for i in range(N):
   x=-.235+i*.47/(N-1);y=-.50+j*.40/(N-1);verts.append((cx+x,cy+y,height(x,y)+.011));uv.append((i/(N-1),j/(N-1)))
 for j in range(N-1):
  for i in range(N-1):a=j*N+i;faces.append((a,a+1,a+N+1,a+N))
 me=bpy.data.meshes.new('Chest screenprint UV cloth');me.from_pydata(verts,[],faces);me.uv_layers.new()
 for f in me.polygons:
  for li in f.loop_indices:me.uv_layers.active.data[li].uv=uv[me.loops[li].vertex_index]
 ob=bpy.data.objects.new('PR2 cartridge screenprint on T-shirt chest',me);bpy.context.collection.objects.link(ob);me.materials.append(M[printed_material(path)])

def house_art(room):
 # Reused cartridge screenprints and original odd prints are ordinary, noninteractive belongings.
 art_dir=R/'scene/house-textures/art'
 weird=sorted(p for p in art_dir.glob('*') if p.suffix.lower() in ('.webp','.png','.jpg','.jpeg'))
 if len(weird)<3:raise RuntimeError('Original odd art textures are not ready')
 def odd(i):return str(weird[i%len(weird)].relative_to(R))
 label=lambda n:'web/assets/labels/'+n+'-screenprint.webp'
 if room=='hallway':
  displayed_print('Odd entrance picture',odd(0),(1.575,1.65,1.85),.62,.70,True,-math.pi/2,frame_mat='pale')
  displayed_print('Mismatched corridor picture',odd(1),(-1.575,1.55,1.65),.52,.65,True,math.pi/2,frame_mat='wood')
 elif room=='workshop':
  displayed_print('Red Earth garage poster',label('red-earth'),(1.75,1.43,2.03),.57,.46)
  displayed_print('Odd picture among bench tools',odd(2),(-1.30,1.31,1.29),.25,.27,True,lean=-.10,frame_mat='blue',standing=True)
  from mathutils import Matrix
  before=set(bpy.data.objects);printed_tshirt('web/assets/labels/platform-racing-2-screenprint-v3.webp');bpy.context.view_layer.update()
  transform=Matrix.Translation((1.60,-.58,.28))@Matrix.Scale(.60,4)
  for ob in bpy.data.objects:
   if ob not in before:ob.matrix_world=transform@ob.matrix_world
 elif room=='attic':
  print_plane('Stored odd paper study',odd(1),(-.67,2.921,.67),.44,.54)
  print_plane('Odd stored packing-board print',odd(2),(1.66,1.925,.67),.35,.49)
  displayed_print('Cooties unframed stored print',label('cooties'),(-.94,.55,.64),.69,.552,lean=.13)
  box('Plain carton supporting stored cartridge art',(-.94,.82,.40),(.61,.38,.54),'clay',.01)
 elif room=='basement':
  displayed_print('Odd cellar wall picture',odd(2),(-4.855,.35,1.83),.77,.87,True,math.pi/2,frame_mat='wood')
  displayed_print('Small shelf picture',odd(0),(1.77,1.813,1.45),.35,.40,True,lean=-.08,frame_mat='pale',standing=True)
  displayed_print('Neverending Light leaning print',label('neverending-light'),(.03,2.965,.55),.97,.777,lean=.15)

def tighten_attic_view():
 # Crawl halfway into the attic and look slightly left, keeping discoveries in view.
 from mathutils import Matrix
 S.camera.location=(.10,-.30,1.48)
 S.camera.rotation_euler=(Vector((-.65,3.8,.70))-S.camera.location).to_track_quat('-Z','Y').to_euler()
 groups=[
  (('Tricycle','Cream wheel hub','Steel axle','Rear tricycle axle','Pedal crank','Handlebar grip'),(.45,1.3,0)),
  (('Opened black trash bag','Empty bag bottom','Folded bag mouth'),(.9,1.5,0)),
  (('The one leftover plywood sheet','Plywood old screw','Worn questions notebook','Questions notebook pages','Loose graphite pencil','Folded private story letter','Plain red letter seal'),(0,3.2,0)),
  (('Unframed Derron character draft','Drawn character head','Character pencil','Paper draft support carton'),(-1.75,1.05,0)),
  (('Rough farm model carton','Cardboard farm dream model','Model potato row','Rough model farm robot','Tiny robot solar panel','Model robot wheel'),(-1,2.2,0)),
  (('Cooties unframed stored print','Plain carton supporting stored cartridge art'),(-.30,2.3,0)),
 ]
 bpy.context.view_layer.update()
 for ob in bpy.data.objects:
  for prefixes,offset in groups:
   if ob.name.startswith(prefixes):
    ob.matrix_world=Matrix.Translation(offset)@ob.matrix_world;break
  if ob.type=='FONT' and ob.data.body in ('?','DERRON'):
   offset=(0,3.2,0) if ob.data.body=='?' else (-1.75,1.05,0)
   ob.matrix_world=Matrix.Translation(offset)@ob.matrix_world

def outside_view(name,loc,w,h,texture='rainy-garden'):
 # A UV-mapped exterior, with preserved photographic color and depth.
 path='scene/house-textures/windows/'+texture+'.png'
 ob=print_plane(name,path,loc,w,h)
 key='Exterior '+texture
 if key not in M:
  m=bpy.data.materials.new(key);m.use_nodes=True;M[key]=m
  nodes=m.node_tree.nodes;nodes.clear();links=m.node_tree.links
  tx=nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(R/path),check_existing=True)
  emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=.8
  output=nodes.new('ShaderNodeOutputMaterial');links.new(tx.outputs['Color'],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
 ob.data.materials.clear();ob.data.materials.append(M[key]);bpy.context.view_layer.update();return ob

def window_lighting(room):
 # All existing fixtures are switched off. Light originates at the windows.
 from mathutils import Matrix
 for ob in list(bpy.data.objects):
  if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
 p=M['glow'].node_tree.nodes.get('Principled BSDF')
 p.inputs['Emission Strength'].default_value=0;p.inputs['Base Color'].default_value=(.48,.45,.37,1)
 S.world.node_tree.nodes['Background'].inputs[1].default_value=.035
 S.view_settings.exposure=-.85
 def side_window(loc,w,h,angle):
  before=set(bpy.data.objects);window(0,0,loc[2],w,h);bpy.context.view_layer.update()
  tr=Matrix.Translation((loc[0],loc[1],0))@Matrix.Rotation(angle,4,'Z')
  for ob in [o for o in bpy.data.objects if o not in before]:
   if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
   else:ob.matrix_world=tr@ob.matrix_world
 if room=='hallway':
  for ob in list(bpy.data.objects):
   if ob.name.startswith(('Long rain rivulet','Uneven rain runnel')):bpy.data.objects.remove(ob,do_unlink=True)
  rain=M['Rain water glints'].node_tree.nodes.get('Principled BSDF');rain.inputs['Emission Strength'].default_value=0;rain.inputs['Base Color'].default_value=(.07,.11,.14,1)
  for name in ['Wet window glass','Dark outside the rainy window']:
   ob=bpy.data.objects.get(name)
   if ob:bpy.data.objects.remove(ob,do_unlink=True)
  ob=outside_view('Rainy garden through hallway',(0,.085,1.85),1.81,1.40)
  ob.matrix_world=Matrix.Translation((1.30,-3.70,0))@Matrix.Rotation(-math.pi/2,4,'Z')@ob.matrix_world
  side_window((1.265,2.55,1.92),1.7,1.35,-math.pi/2)
  area('Front window moonlight',(1.12,-3.7,1.9),230,(.56,.72,1),1.5,(-1,-1.5,.8))
  area('Far window moonlight',(1.10,2.55,1.92),185,(.56,.72,1),1.5,(-1,3,.8))
 elif room=='workshop':
  S.camera.location=(0,-2.25,2.22);S.camera.rotation_euler=(Vector((0,.8,1.60))-S.camera.location).to_track_quat('-Z','Y').to_euler();S.camera.data.lens=23
  window(-.60,1.39,2.65,1.32,.62)
  side_window((-2.78,.2,2.05),1.65,1.45,math.pi/2)
  area('Bench window moonlight',(-.6,1.18,2.65),160,(.60,.76,1),1.2,(0,.2,1))
  area('Side window moonlight',(-2.55,.2,2.05),210,(.56,.72,1),1.5,(0,.5,.95))
 elif room=='attic':
  # Enlarge the gable window without moving any discoveries.
  for ob in list(bpy.data.objects):
   if ob.name.startswith(('Garden beyond window','Window jamb','Window rail','Window cross','Window transom','Deep sill')):bpy.data.objects.remove(ob,do_unlink=True)
  window(0,4.27,2.02,1.36,1.05)
  area('Gable moonlight',(0,4.04,2.02),290,(.58,.74,1),1.2,(-.5,1,.25))
  # Small floor lamp on the existing plywood, beneath the low rafters.
  cyl('Small floor lamp foot',(.47,1.45,.29),.14,.035,'ink')
  pipe('Small floor lamp stem',[(.47,1.45,.30),(.47,1.45,.99)],.012,'metal')
  bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.18,radius2=.10,depth=.22,location=(.47,1.45,1.02))
  bpy.context.object.name='Small linen floor lamp shade';bpy.context.object.data.materials.append(M['cream'])
  area('Small floor lamp',(.47,1.45,.90),3,(1,.78,.53),.28,(-.1,2,.25))
 elif room=='basement':
  window(2.2,3.19,3.0,1.8,.62)
  side_window((-4.84,-1.1,2.85),2.0,.75,math.pi/2)
  area('Cellar left window',(-2.2,3.0,2.95),230,(.59,.75,1),1.7,(-2,0,.5))
  area('Cellar right window',(2.2,2.96,3),180,(.59,.75,1),1.7,(2,0,.6))
  area('Cellar side window',(-4.6,-1.1,2.85),190,(.59,.75,1),1.8,(0,-1,.4))
 # window() creates a default light; retain only the authored lighting above.
 for ob in list(bpy.data.objects):
  if ob.type=='LIGHT' and ob.name.startswith('Night window'):bpy.data.objects.remove(ob,do_unlink=True)

def project(room):
 bpy.context.view_layer.update();hot=[]
 for id,objs in anchors.items():
  pts=[]
  for o in objs:
   for corner in o.bound_box:
    co=world_to_camera_view(S,S.camera,o.matrix_world@Vector(corner));pts.append((co.x,1-co.y))
  xs=[p[0] for p in pts];ys=[p[1] for p in pts];padx=0 if room in ('hallway','workshop') else .008;left=max(0,min(xs)-padx);top=max(0,min(ys)-.008);right=min(1,max(xs)+padx);bottom=min(1,max(ys)+.008)
  hot.append(dict(id=id,x=round(left,5),y=round(top,5),width=round(right-left,5),height=round(bottom-top,5)))
 if room=='attic':
  # Keep the broad three-wheel target clear of the nearby character sketch.
  by_id={r['id']:r for r in hot};tric=by_id['tricycle'];draft=by_id['derron']
  tric['width']=round(min(tric['width'],draft['x']-.004-tric['x']),5)
 allhot[room]=hot
 existing={}
 if (OUT/'hotspots.json').exists():existing=json.loads((OUT/'hotspots.json').read_text())
 existing.update(allhot);(OUT/'hotspots.json').write_text(json.dumps(existing,indent=2)+'\n')

def save(room):
 project(room)
 for image in bpy.data.images:
  if image.filepath: image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(R/'scene'/('house-'+room+'.blend')))
 (R/'scene/renders/house').mkdir(parents=True,exist_ok=True)
 S.render.filepath=str(R/'scene/renders/house'/(room+'.png'));bpy.ops.render.render(write_still=True)
 # Blender has native WebP support; save the final color-managed render.
 S.render.image_settings.file_format='WEBP';S.render.image_settings.quality=88;bpy.data.images['Render Result'].save_render(str(OUT/(room+'.webp')),scene=S)
 existing={}
 if (OUT/'hotspots.json').exists():existing=json.loads((OUT/'hotspots.json').read_text())
 existing.update(allhot);(OUT/'hotspots.json').write_text(json.dumps(existing,indent=2)+'\n')
 print('ROOM_COMPLETE',room,flush=True)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hallway','workshop','attic','basement']
preview=bool(args and args[0]=='preview');anchors_only=bool(args and args[0]=='anchors')
if preview or anchors_only:args=args[1:]
for room in args:
 globals()[room]()
 before_decor=set(bpy.data.objects)
 ordinary_clutter(room)
 house_art(room)
 if room=='attic':tighten_attic_view()
 if room=='hallway':
  bpy.context.view_layer.update()
  for ob in bpy.data.objects:
   if ob in before_decor:continue
   center=sum((ob.matrix_world@Vector(c) for c in ob.bound_box),Vector())/8
   if abs(center.x)>.60:ob.location.x+=-.30 if center.x>0 else .30
   if ob.name.startswith(('Coat hook rail','Brass coat hook','Hanging ordinary jacket','Jacket loose sleeve','Jacket folded collar')):ob.location.y+=2.70
 window_lighting(room)
 if anchors_only:project(room)
 elif preview:
  S.render.resolution_percentage=40;S.cycles.samples=4;S.render.filepath=str(R/'scene/renders/house'/(room+'-preview.png'));bpy.ops.render.render(write_still=True)
 else:save(room)
