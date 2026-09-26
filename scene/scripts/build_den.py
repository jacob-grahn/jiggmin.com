"""Midnight Den — original, editable Blender scene. Run stages via Blender MCP.
All dimensions in meters. Camera faces +Y; hero faces point toward -Y.
"""
import bpy, math, random
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[1]
random.seed(28)
M={}; C=None

def enum(obj,key,wanted):
    allowed=[v.identifier for v in obj.bl_rna.properties[key].enum_items]
    if wanted not in allowed: raise ValueError((key,wanted,allowed))
    setattr(obj,key,wanted)

def group(name):
    global C
    C=bpy.data.collections.new(name); S.collection.children.link(C)
    return C

def own(o,name,mat=None):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    C.objects.link(o)
    if mat:o.data.materials.append(mat)
    return o

def material(name,color,rough=.5,metal=0,noise=0,scale=80):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    m.diffuse_color=(*color,1)
    if noise:
        n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=3
        b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=noise;b.inputs['Distance'].default_value=.025
        m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
    M[name]=m;return m

def wood(name,dark,light):
    m=material(name,dark,.43,noise=.18,scale=30);n=m.node_tree.nodes;l=m.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
    tex=n.new('ShaderNodeTexCoord');v=n.new('ShaderNodeVectorMath');enum(v,'operation','MULTIPLY');v.inputs[1].default_value=(2,42,6)
    no=n.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=3;no.inputs['Detail'].default_value=4;no.inputs['Roughness'].default_value=.72
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[0].color=(*dark,1);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=(*light,1)
    l.new(tex.outputs['Generated'],v.inputs[0]);l.new(v.outputs[0],no.inputs['Vector']);l.new(no.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
    return m

def emissive(name,color,power):
    m=material(name,color,.35);p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=power;return m

def picture(name,file,emit=0):
    m=material(name,(1,1,1),.6);p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(R/'textures'/file),check_existing=True)
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    if emit:m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=emit
    return m

def box(name,loc,size,mat,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=own(bpy.context.object,name,mat);o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def cyl(name,loc,r,depth,mat,verts=48,rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=own(bpy.context.object,name,mat)
    if rot:o.rotation_euler=rot
    b=o.modifiers.new('Edge radius','BEVEL');b.width=min(.008,r*.12);b.segments=3
    for p in o.data.polygons:p.use_smooth=True
    return o

def ball(name,loc,size,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc);o=own(bpy.context.object,name,mat);o.scale=size
    for p in o.data.polygons:p.use_smooth=True
    return o

def line(name,points,r,mat):
    cu=bpy.data.curves.new(name,'CURVE');enum(cu,'dimensions','3D');cu.resolution_u=16;cu.bevel_depth=r;cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):p.co=co;enum(p,'handle_left_type','AUTO');enum(p,'handle_right_type','AUTO')
    o=bpy.data.objects.new(name,cu);C.objects.link(o);cu.materials.append(mat);return o

def text(name,body,loc,size,mat,rot=(math.pi/2,0,0),align='CENTER'):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;enum(cu,'align_x',align);cu.extrude=.00025
    o=bpy.data.objects.new(name,cu);C.objects.link(o);o.location=loc;o.rotation_euler=rot;cu.materials.append(mat);return o

def plane(name,loc,w,h,mat):
    verts=[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.uv_layers.new()
    for loop,uv in zip(mesh.uv_layers.active.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=uv
    o=bpy.data.objects.new(name,mesh);C.objects.link(o);o.location=loc;mesh.materials.append(mat);return o

def light(name,loc,color,power,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK' if 'DISK' in [i.identifier for i in data.bl_rna.properties['shape'].enum_items] else data.shape;data.size=size
    o=bpy.data.objects.new(name,data);C.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def init():
    global S
    # Preserve user's original scene; build in a separate scene.
    S=bpy.data.scenes.new('Midnight Den');bpy.context.window.scene=S
    S.render.engine='BLENDER_EEVEE_NEXT'
    S.render.resolution_x=1600;S.render.resolution_y=1000;S.render.resolution_percentage=70
    enum(S.render.image_settings,'file_format','PNG')
    S.world=bpy.data.worlds.new('Midnight exterior');S.world.use_nodes=True
    bg=next(n for n in S.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.07,.11,.2,1);bg.inputs['Strength'].default_value=.15
    S.view_settings.exposure=.4
    material('Graphite ABS',(.025,.031,.035),.36,noise=.14,scale=155)
    material('Warm grey ABS',(.24,.245,.22),.47,noise=.10,scale=170)
    material('Rubber',(.009,.012,.014),.7,noise=.08)
    material('Brushed pewter',(.17,.19,.20),.34,.72,noise=.06,scale=160)
    material('Brass',(.36,.22,.085),.3,.75)
    material('Ivory ink',(.58,.57,.47),.72)
    material('Plaster',(.14,.17,.17),.91,noise=.48,scale=48)
    material('Book cloth blue',(.028,.065,.079),.85,noise=.16)
    material('Book cloth red',(.16,.044,.027),.8,noise=.16)
    material('Book cloth olive',(.09,.095,.05),.8,noise=.16)
    material('Old paper',(.36,.30,.19),.9,noise=.11)
    material('Leaf',(.035,.085,.045),.46,noise=.18)
    material('Terracotta',(.17,.065,.033),.83,noise=.24)
    material('Coffee glaze',(.16,.22,.21),.21,noise=.06)
    wood('Walnut',(.025,.012,.008),(.18,.08,.032))
    wood('Floor oak',(.035,.024,.015),(.20,.115,.053))
    emissive('Amber LED',(1,.24,.025),4)
    emissive('Window blue',(.04,.12,.25),.6)
    emissive('Rain silver',(.16,.29,.4),.5)
    emissive('Lamp glow',(1,.34,.095),3)
    print('Scene and material palette ready')

def room():
    group('01 • Room and rain')
    for j in range(14):
        y=-3.6+j*.43
        for k in range(4):
            x=-4.5+k*2.6+(j%2)*.5
            box('Individual oak floorboard',(x,y,-.055),(2.59,.423,.10),M['Floor oak'],.006)
    box('Back wall',(0,1.95,2.4),(8,.14,4.8),M['Plaster'])
    box('Left wall',(-3.85,-.6,2.4),(.13,5.2,4.8),M['Plaster'])
    box('Baseboard',(0,1.84,.16),(7.8,.09,.28),M['Walnut'])
    # Window set forward of the wall, luminous night view framed by deep trim.
    plane('Blue night beyond window',(-2.48,1.82,2.5),1.75,2.7,M['Window blue'])
    for x in [-3.40,-1.56]:box('Window outer jamb',(x,1.67,2.5),(.13,.24,2.91),M['Walnut'])
    for z in [1.04,3.96]:box('Window lintel',(-2.48,1.67,z),(1.97,.24,.12),M['Walnut'])
    box('Window sill',(-2.48,1.48,1.0),(2.1,.64,.13),M['Walnut'])
    box('Window mullion',(-2.48,1.58,2.5),(.065,.13,2.82),M['Walnut'])
    box('Window transom',(-2.48,1.58,2.49),(1.82,.13,.065),M['Walnut'])
    # Exterior trees: silhouetted against the luminous glass.
    for t in range(7):
        x=-3.3+t*.26;z=1.15+random.random()*.3;hei=random.uniform(.7,1.8)
        for j in range(4):
            zz=z+hei*(.18+j*.18);ww=hei*(.30-j*.05)
            mesh=bpy.data.meshes.new('Pine silhouette');mesh.from_pydata([(x-ww,1.795,zz),(x+ww,1.795,zz),(x,1.795,zz+hei*.45)],[],[(0,1,2)]);o=bpy.data.objects.new('Distant pine',mesh);C.objects.link(o);mesh.materials.append(M['Rubber'])
    ball('Moon',(-2.99,1.77,3.51),(.17,.013,.17),M['Rain silver'])
    for i in range(100):
        x=random.uniform(-3.31,-1.65);z=random.uniform(1.15,3.85);le=random.uniform(.025,.20)
        line('Rain on glass',[(x,1.53,z),(x-.008,1.525,z-le*.55),(x+.006,1.53,z-le)],random.uniform(.0015,.0035),M['Rain silver'])
    # Rug
    rug=plane('Woven rug',(0,-.65,.012),5.8,3.5,picture('Faded woven rug','woven-rug.jpg'));rug.rotation_euler=(math.pi/2,0,0)
    for x in [-2.96,2.96]:
        for j in range(65):line('Rug fringe',[(x,-2.31+j*.052,.016),(x+(.10 if x>0 else -.10),-2.31+j*.052+random.uniform(-.014,.014),.013)],.0035,M['Old paper'])
    # TV credenza
    group('02 • Walnut furniture')
    for x in [-1.82,1.82]:
        for y in [.08,1.1]:cyl('Tapered cabinet foot',(x,y,.30),.055,.60,M['Walnut'])
    box('Credenza top',(0,.59,1.035),(4.15,1.46,.14),M['Walnut'],.035)
    box('Credenza base',(0,.59,.40),(4.06,1.36,.10),M['Walnut'])
    for x in [-1.98,1.98]:box('Cabinet side',(x,.59,.70),(.12,1.34,.59),M['Walnut'])
    box('Cabinet dark back',(0,1.23,.70),(3.94,.07,.58),M['Rubber'])
    for x in [-.85,.85]:box('Cabinet divider',(x,.58,.70),(.07,1.27,.55),M['Walnut'])
    # Low coffee table, bottom of shot.
    box('Coffee table top',(0,-1.55,.63),(4.6,1.72,.13),M['Walnut'],.045)
    for x in [-1.96,1.96]:
        for y in [-2.16,-.95]:box('Coffee table leg',(x,y,.30),(.1,.1,.60),M['Walnut'])
    # Small right side lamp table
    box('Lamp side table',(2.7,.75,1.15),(1.0,.92,.09),M['Walnut'])
    for x in [2.31,3.09]:
        for y in [.43,1.1]:box('Lamp table leg',(x,y,.57),(.07,.07,1.12),M['Walnut'])
    print('Room, window, rain and furniture built')

def hero():
    group('03 • CRT television')
    for x in [-.88,.88]:box('CRT foot',(x,.42,1.14),(.25,.65,.08),M['Rubber'])
    box('CRT deep rear cabinet',(0,.53,2.08),(2.34,1.02,1.65),M['Graphite ABS'],.18)
    box('CRT rounded front shell',(0,-.07,2.10),(2.62,.40,1.94),M['Graphite ABS'],.13)
    box('Glass gasket',(0,-.289,2.24),(2.30,.045,1.56),M['Rubber'],.12)
    # Curved screen: concentric superelliptical rings; UVs map to rounded face.
    verts=[(0,-.401,2.24)];uvs=[(.5,.5)];faces=[];rings=20;steps=128
    for j in range(1,rings+1):
        rr=j/rings
        for i in range(steps):
            a=2*math.pi*i/steps;co=math.cos(a);si=math.sin(a)
            x=1.098*math.copysign(abs(co)**.25,co)*rr;z=.727*math.copysign(abs(si)**.25,si)*rr
            verts.append((x,-.337-.064*(1-rr*rr),2.24+z));uvs.append((x/2.196+.5,z/1.454+.5))
    for i in range(steps):faces.append((0,1+i,1+(i+1)%steps))
    for j in range(rings-1):
        a=1+j*steps;b=a+steps
        for i in range(steps):k=(i+1)%steps;faces.append((a+i,b+i,b+k,a+k))
    me=bpy.data.meshes.new('Curved phosphor glass');me.from_pydata(verts,[],faces);me.uv_layers.new()
    for po in me.polygons:
        po.use_smooth=True
        for li in po.loop_indices:me.uv_layers.active.data[li].uv=uvs[me.loops[li].vertex_index]
    o=bpy.data.objects.new('CRT_SCREEN • game surface',me);C.objects.link(o);me.materials.append(picture('Phosphor idle screen','crt-idle.png',2.3));o['role']='ruffle_screen';o['screen_aspect']=4/3
    # Speaker slots and controls along bottom rail.
    for side in [-1,1]:
        for i in range(19):box('Speaker grille',(side*(.64+i*.025),-.277,1.34),(.009,.009,.10),M['Rubber'],.003)
    text('TV maker mark','J I G G M I N',(0,-.285,1.405),.034,M['Ivory ink'])
    for i in range(4):cyl('CRT front button',(-.14+i*.075,-.294,1.28),.018,.024,M['Brushed pewter'],24,(math.pi/2,0,0))
    ball('CRT standby LED',(.26,-.304,1.28),(.009,.006,.009),M['Amber LED'])
    for x in [-1.183,1.183]:
        for i in range(18):box('Rear cooling vents',(x,.23+i*.038,2.27),(.006,.017,.42),M['Rubber'],.002)
    group('04 • Original J/01 console')
    # Original squared capsule console, offset circular power dial, two small ports.
    root=bpy.data.objects.new('CONSOLE • J/01',None);C.objects.link(root);root['role']='cartridge_dock'
    box('Console bottom plinth',(0,-1.25,.766),(1.37,.72,.12),M['Rubber'],.055)
    box('Console main case',(0,-1.25,.865),(1.48,.80,.19),M['Graphite ABS'],.07)
    box('Console upper lid',(0,-1.24,.973),(1.40,.73,.042),M['Brushed pewter'],.04)
    box('Dock dark recess',(-.13,-1.17,.998),(.73,.19,.009),M['Rubber'],.025)
    for x in [-.51,.25]:box('Dock guide rail',(x,-1.17,1.012),(.025,.22,.045),M['Graphite ABS'],.009)
    for y in [-1.249,-1.091]:box('Cartridge slot lip',(-.13,y,1.006),(.71,.012,.020),M['Graphite ABS'],.005)
    slot=box('DROP_TARGET',(-.13,-1.17,1.03),(.67,.13,.03),M['Rubber'],.003);slot.hide_render=True;slot.hide_set(True);slot['role']='drop_target'
    cyl('Power dial',(.49,-1.39,1.011),.067,.025,M['Graphite ABS'])
    ball('Amber power indicator',(.49,-1.39,1.03),(.011,.011,.005),M['Amber LED'])
    for x in [-.44,-.19]:
        box('Recessed controller port',(x,-1.657,.864),(.145,.015,.048),M['Rubber'],.012)
        box('Port contact',(x,-1.668,.864),(.085,.01,.007),M['Brass'],.001)
    text('Console wordmark','J / 0 1',(.4,-1.655,.86),.052,M['Ivory ink'])
    for i in range(12):box('Console cooling slit',(-.57+i*.057,-.967,.998),(.024,.10,.005),M['Rubber'],.002)
    text('Console loading legend','CARTRIDGE SYSTEM',(-.12,-1.43,1.000),.022,M['Ivory ink'],(0,0,0))
    line('TV power cable',[(1,.6,1.12),(1.3,.9,.45),(1.4,1.0,.09),(2,1.5,.06)],.012,M['Rubber'])
    line('Console AV cable',[(.55,-.88,.8),(.84,-.67,.72),(1.04,-.4,.59),(.82,.2,.48)],.009,M['Rubber'])
    print('CRT and original console built')

def cartridges():
    group('05 • Pick-up cartridges')
    poses=[(-1.57,-1.50,.704,-.16),(-.90,-1.98,.704,.13),(.02,-2.00,.704,-.06),(.99,-1.90,.704,-.15),(1.64,-1.30,.704,.22)]
    for i,(x,y,z,ang) in enumerate(poses):
        root=bpy.data.objects.new(f'CARTRIDGE_{i+1:02d} • Archive placeholder',None);C.objects.link(root);root.location=(x,y,z);root.rotation_euler=(0,0,ang);root['role']='draggable_cartridge';root['game_id']=f'archive-{i+1:02d}';root['placeholder']=True
        objs=[]
        objs.append(box('Original cartridge shell',(0,0,.23),(.51,.145,.46),M['Warm grey ABS'],.028))
        objs.append(box('Recessed label well',(0,-.077,.249),(.411,.011,.36),M['Graphite ABS'],.015))
        objs.append(plane(f'Archive {i+1} cover',(0,-.084,.249),.381,.331,picture(f'Archive {i+1} paper',f'cartridge-{i+1}.png')))
        for xx in [-.227,.227]:
            for zz in [.09,.14,.19,.24,.29,.34]:objs.append(box('Cartridge side grip',(xx,-.078,zz),(.02,.008,.006),M['Graphite ABS'],.002))
        objs.append(box('Cartridge connector',(0,0,.015),(.32,.08,.03),M['Rubber'],.003))
        for ob in objs:ob.parent=root
    print('Five independently selectable cartridges built')

def props():
    group('06 • Late-night belongings')
    # Books tucked into shelves, stacks on tabletop.
    bookmats=[M['Book cloth blue'],M['Book cloth red'],M['Book cloth olive']]
    for i in range(13):
        x=-1.80+i*.063;h=random.uniform(.28,.43)
        box('Shelf journal',(x,.01,.45+h/2),(.057,.40,h),bookmats[i%3],.005)
        for z in [.49,.45+h-.04]:box('Spine gold rule',(x,-.194,z),(.043,.003,.004),M['Brass'],.001)
    for i in range(3):
        box('Stacked album',(1.37,.1,.48+i*.095),(.68,.62,.078),bookmats[i%3],.006)
        box('Album pages',(1.37,-.212,.48+i*.095),(.61,.008,.055),M['Old paper'],.001)
    # VHS / cassettes in central cubby.
    for i in range(5):box('Old video tape',(-.56+i*.245,.34,.52),(.22,.45,.105),M['Graphite ABS'],.009)
    # Coaster and mug beside TV.
    cyl('Cork coaster',(1.66,-.03,1.117),.17,.012,M['Old paper'])
    cyl('Mug',(1.66,-.03,1.24),.12,.24,M['Coffee glaze'])
    cyl('Dark coffee',(1.66,-.03,1.363),.103,.004,M['Rubber'])
    line('Mug handle',[(1.76,-.03,1.31),(1.87,-.03,1.31),(1.88,-.03,1.17),(1.77,-.03,1.17)],.021,M['Coffee glaze'])
    # Poster right of CRT.
    box('Poster walnut frame',(2.03,1.78,2.78),(1.1,.055,1.55),M['Walnut'],.016)
    plane('AFTER HOURS print',(2.03,1.746,2.78),1.0,1.43,picture('After Hours poster','after-hours.png'))
    # Pleated lamp.
    cyl('Lamp base',(2.72,.67,1.235),.225,.065,M['Brass'])
    cyl('Lamp stem',(2.72,.67,1.62),.025,.77,M['Brass'])
    fabric=material('Amber linen',(.56,.34,.14),.86,noise=.2,scale=95)
    p=next(n for n in fabric.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Emission Color'].default_value=(1,.36,.09,1);p.inputs['Emission Strength'].default_value=.32
    vs=[];fs=[];n=128
    for z,r in [(1.72,.42),(2.24,.25)]:
        for i in range(n):
            a=2*math.pi*i/n;rr=r+(.008 if i%2 else -.008);vs.append((2.72+rr*math.cos(a),.67+rr*math.sin(a),z))
    for i in range(n):fs.append((i,(i+1)%n,(i+1)%n+n,i+n))
    me=bpy.data.meshes.new('Pleated linen shade');me.from_pydata(vs,[],fs);ob=bpy.data.objects.new('Lamp pleated shade',me);C.objects.link(ob);me.materials.append(fabric)
    for zz,rr in [(1.72,.42),(2.24,.25)]:
        line('Shade binding',[(2.72+rr*math.cos(i*math.tau/48),.67+rr*math.sin(i*math.tau/48),zz) for i in range(49)],.007,M['Brass'])
    ball('Warm lamp bulb',(2.72,.67,1.91),(.075,.075,.10),M['Lamp glow'])
    # Potted plant at window, asymmetrical stems and heart-shaped leaves.
    cyl('Plant pot',(-1.67,.52,1.25),.19,.28,M['Terracotta'])
    cyl('Pot dark soil',(-1.67,.52,1.394),.17,.009,M['Rubber'])
    for i in range(9):
        a=i*2.4;end=(-1.67+math.cos(a)*random.uniform(.25,.44),.52+math.sin(a)*.24,1.65+random.random()*.43)
        line('Plant stem',[(-1.67,.52,1.38),(-1.67+math.cos(a)*.14,.52+math.sin(a)*.12,1.65),end],.004,M['Leaf'])
        leaf=ball('Waxed plant leaf',end,(.12,.038,.22),M['Leaf']);leaf.rotation_euler=(random.uniform(-.5,.5),random.uniform(-.8,.8),a)
    # Low upholstered seat edge on right.
    cloth=material('Indigo upholstery',(.025,.046,.069),.9,noise=.35,scale=120)
    box('Armchair seat',(3.5,-.9,.49),(1.24,1.46,.34),cloth,.14)
    box('Armchair back',(3.6,-.19,1.06),(1.30,.35,1.2),cloth,.15)
    box('Armchair near arm',(2.99,-.95,.87),(.26,1.5,.35),cloth,.11)
    for z in [.91,1.23]:ball('Tuft button',(3.43,-.383,z),(.023,.01,.023),M['Rubber'])
    # Controller: original small pad sitting left of console; cable coils.
    pad=box('Original two-button gamepad',(-1.60,-.74,.765),(.56,.26,.14),M['Graphite ABS'],.065)
    box('Directional horizontal',(-1.75,-.74,.844),(.12,.034,.014),M['Rubber'],.005)
    box('Directional vertical',(-1.75,-.74,.846),(.034,.12,.014),M['Rubber'],.005)
    for x,y in [(-1.44,-.73),(-1.50,-.79)]:cyl('Controller button',(x,y,.849),.027,.018,M['Brass'],24)
    line('Controller cable',[(-1.60,-.61,.77),(-1.75,-.48,.69),(-2,-.77,.70),(-1.64,-1.04,.704),(-.94,-.9,.70),(-.44,-1.68,.85)],.009,M['Rubber'])
    # Table evidence of age: subtle hairline scratches.
    scratch=material('Wood edge wear',(.19,.105,.046),.75)
    for i in range(26):
        x=random.uniform(-2.13,2.13);y=random.uniform(-2.25,-.85)
        line('Fine tabletop scratch',[(x,y,.697),(x+random.uniform(.02,.09),y+random.uniform(-.01,.01),.697)],.0007,scratch)
    print('Lamp, books, poster, mug, plant, chair and controller built')

def finish():
    group('07 • Cinematography')
    light('CRT spill',(0,-.52,2.2),(.21,.75,1),60,1.5,(0,-1.4,.6))
    light('Moon through rain',(-2.5,1.30,3.0),(.23,.45,1),190,1.4,(0,-1,1))
    light('Amber lamplight',(2.72,.60,1.88),(1,.48,.19),115,.60,(.4,-.9,.65))
    light('Warm ceiling bounce',(2.3,.7,2.7),(1,.49,.24),90,1.2,(0,0,1.5))
    light('Soft camera fill',(-1.0,-4.0,3.3),(.35,.49,.65),75,4,(0,0,1.3))
    camera=bpy.data.cameras.new('Den • seated view');o=bpy.data.objects.new('CAMERA • midnight den',camera);C.objects.link(o);o.location=(.12,-7.9,3.15);target=Vector((0,-.05,1.80));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();camera.lens=40;S.camera=o
    camera.dof.use_dof=True;camera.dof.focus_distance=(Vector((0,-.4,1.9))-o.location).length;camera.dof.aperture_fstop=7.1
    S.use_nodes=True;n=S.node_tree.nodes;n.clear();rl=n.new('CompositorNodeRLayers');gl=n.new('CompositorNodeGlare');enum(gl,'glare_type','FOG_GLOW');enum(gl,'quality','HIGH');gl.threshold=1.3;gl.size=8;gl.mix=-.90;out=n.new('CompositorNodeComposite');S.node_tree.links.new(rl.outputs['Image'],gl.inputs['Image']);S.node_tree.links.new(gl.outputs['Image'],out.inputs['Image'])
    for a in (bpy.context.screen.areas if bpy.context.screen else []):
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA';enum(a.spaces.active.shading,'type','MATERIAL')
    S.render.filepath=str(R/'renders'/'midnight-den-preview.png')
    S['art_direction']='Rainy midnight den; original J/01 console; cartridge art is placeholder.'
    S['next_stage']='Bake static lighting/materials and export optimized browser assets; Ruffle is not implemented yet.'
    for im in bpy.data.images:
        if im.source=='FILE' and im.filepath:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den.blend'))
    print('Saved',bpy.data.filepath,'objects',len(S.objects))
