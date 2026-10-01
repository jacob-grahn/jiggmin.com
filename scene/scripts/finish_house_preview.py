"""Incremental, repeatable finishing passes on the saved proposal; --stage 2..9.
Each pass owns a collection and preserves other authored scene objects.
"""
import bpy,sys,math,json,random,shutil,re
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from house_trim import trim_walls_for_stage, assert_unique_trim
from house_preview_spec import build_spec
from export_house_preview import export_preview
stage=int(sys.argv[sys.argv.index('--stage')+1]);s=bpy.context.scene;spec=build_spec();plan=json.loads((ROOT/'docs/house-plan/proposed-layout.json').read_text())
backup=ROOT/f'scene/house-plan-preview-before-finish-{stage}.blend'
if not backup.exists():shutil.copy2(ROOT/'scene/house-plan-preview.blend',backup)
name=f'06 Finish {stage}';collection=bpy.data.collections.get(name)
if collection:
 for o in list(collection.objects):bpy.data.objects.remove(o,do_unlink=True)
else:collection=bpy.data.collections.new(name);s.collection.children.link(collection)
colors={'plaster':(.48,.43,.34,1),'cream':(.73,.68,.55,1),'trim':(.22,.16,.105,1),'oak':(.31,.19,.09,1),'tile':(.28,.32,.29,1),'metal':(.16,.19,.19,1),'brass':(.48,.31,.10,1),'glass':(.12,.24,.28,.22),'concrete':(.28,.29,.26,1),'masonry':(.38,.39,.34,1),'mortar':(.20,.21,.19,1),'wood':(.32,.22,.12,1),'insulation':(.47,.38,.26,1),'light':(.95,.72,.36,1),'leaves':(.065,.14,.085,1)}
mats={}
for n,c in colors.items():
 m=bpy.data.materials.get('Finish / '+n) or bpy.data.materials.new('Finish / '+n);m.diffuse_color=c;m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.85
 if n=='glass':p.inputs['Alpha'].default_value=.22
 mats[n]=m
native=lambda p:Vector((p[0],-p[2],p[1]))
def box(name,p,size,mat='trim',kind='shell',slope=0):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);mesh.update();o=bpy.data.objects.new('Finish / '+name,mesh);collection.objects.link(o);o.location=native(p);x,y,z=size;o.scale=(x,z,y);o.rotation_euler.y=-slope
 o.data.materials.append(mats[mat]);o['preview_kind']=kind;o['finish_stage']=stage
 return o
def beam(name,a,b,width=.04,mat='wood',kind='shell'):
 a,b=native(a),native(b);o=box(name,[0,0,0],[width,(b-a).length,width],mat,kind);o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def light(name,p,color=(1,.76,.48),power=110):
 d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=color;d.shadow_soft_size=.35;o=bpy.data.objects.new(name,d);collection.objects.link(o);o.location=native(p);o['preview_light']=True
 if not name.startswith('Den'):box(name+' globe',p,[.16,.1,.16],'light','fixture')
def doorframe(d):
 x,z,X,Z=d['segment_xz'];h=2.15 if d['id']!='vehicle' else 2.4
 if z==Z:
  for a in [x-.045,X+.045]:box(d['id']+' casing',[a,h/2,z],[.07,h,.20],'cream')
  box(d['id']+' head',[(x+X)/2,h+.035,z],[X-x+.16,.07,.20],'cream');box(d['id']+' threshold',[(x+X)/2,.008,z],[X-x,.016,.19],'oak','floor')
 else:
  for a in [z-.045,Z+.045]:box(d['id']+' casing',[x,h/2,a],[.20,h,.07],'cream')
  box(d['id']+' head',[x,h+.035,(z+Z)/2],[.20,.07,Z-z+.16],'cream');box(d['id']+' threshold',[x,.008,(z+Z)/2],[.19,.016,Z-z],'oak','floor')
def window(w):
 x,z,X,Z=w['segment_xz'];lo=w.get('sill_y',1);hi=w.get('head_y',2.25);cy=(lo+hi)/2
 along=z==Z;size=(X-x if along else Z-z)
 def part(label,u,y,width,height,depth,mat):
  return box(w['id']+' '+label,[u,y,z] if along else[x,y,u],[width,height,depth] if along else[depth,height,width],mat,'window')
 a,b=(x,X) if along else(z,Z)
 for u in [a,b]:part('jamb',u,cy,.07,hi-lo+.12,.22,'cream')
 for y in [lo,hi]:part('rail',(a+b)/2,y,size+.10,.07,.22,'cream')
 part('sill',(a+b)/2,lo-.055,size+.2,.06,.34,'trim');part('mullion',(a+b)/2,cy,.035,hi-lo,.10,'cream');part('glass',(a+b)/2,cy,size-.07,hi-lo-.07,.012,'glass')
def flooring(bounds,mat='oak',width=.22):
 x,z,X,Z=bounds;n=math.ceil((X-x)/width)
 for i in range(n):
  a=x+i*width;b=min(X,a+width);box('floor board',[(a+b)/2,.006,(z+Z)/2],[b-a-.008,.012,Z-z-.02],mat,'floor')
def trims(names):
 for p in spec['parts']:
  if p['name'] not in names:continue
  c=p['center'];sx,sy,sz=p['size'];bottom=c[1]-sy/2;top=c[1]+sy/2
  if abs(bottom)<.01:box('skirting',[c[0],.075,c[2]],[sx if sx>sz else .19,.15,sz if sz>sx else .19],'cream')
  # Plain wall-to-ceiling joins; this house has no crown moulding.
if stage==2:
 trims(trim_walls_for_stage(stage))
 for d in plan['doors']:
  if d['id'] in ['mudroom','stairs','den','front']:doorframe(d)
 for w in plan['windows']:
  if w['id'] in ['hall-right','entry']:window(w)
 flooring([4.9,6.85,11.9,8.25]);flooring([4.9,8.25,9.02,11.92])
 for x,z in [(7.3,7.55),(10.2,7.55),(6.9,10.6)]:light('Hall opal light',[x,2.48,z])
 box('entry bench',[8.65,.43,10.4],[.55,.10,1.5],'oak','contents')
 for z in [9.8,11]:box('bench leg',[8.65,.20,z],[.40,.4,.07],'trim','contents')
 box('coat rail',[8.96,1.75,10.4],[.06,.10,1.5],'oak','contents')
 for z in [9.9,10.2,10.5,10.8]:box('coat hook',[8.90,1.69,z],[.14,.12,.025],'brass','contents')
 # Pull the inherited shelf/mirror away from the basement door aperture.
 for o in s.objects:
  if o.get('source_room')=='hallway' and not o.get('preview_hall_refit') and not o.get('model_refit'):
   bounds=[o.matrix_world@Vector(v) for v in o.bound_box];c=sum(bounds,Vector())/8
   if 9.9<c.x<11.1 and -8.6<c.y<-8.0 and .4<c.z<2.3:o.location.x-=1;o['preview_hall_refit']=True
elif stage==3:
 for d in plan['doors']:
  if d['id']=='garage':doorframe(d)
 flooring([9.2,3.9,11.9,6.72],'tile',.4)
 trims(trim_walls_for_stage(stage))
 light('Laundry light',[10.5,2.45,4.9]);light('Stair upper light',[10.9,2.4,9.1]);light('Stair landing light',[11.7,.75,11.2],power=70)
 for x in [9.65,10.35]:
  box('washer cabinet',[x,.47,4.4],[.62,.9,.68],'cream','contents');box('washer front',[x,.48,4.755],[.43,.45,.025],'metal','contents');box('washer controls',[x,.83,4.76],[.5,.06,.035],'brass','contents')
 box('laundry counter',[10.05,.96,4.4],[1.55,.06,.78],'oak','contents');box('laundry upper shelf',[10.1,1.8,4.1],[1.65,.045,.42],'oak','contents')
 for x in [9.6,9.9,10.2]:box('laundry basket',[x,1.96,4.13],[.24,.25,.27],'insulation','contents')
 for i in range(8):
  top=-(i+1)*.175;box('first flight riser',[9.9,top+.0875,9.2+i*.2],[1.1,.175,.035],'wood','stair')
  top=-1.4-(i+1)*.175;box('return flight riser',[11.15,top+.0875,10.8-i*.2],[1.1,.175,.035],'wood','stair')
 for x in [9.36,10.44]:beam('first stringer',[x,-.25,9.2],[x,-1.65,10.8],.12)
 for x in [10.61,11.69]:beam('return stringer',[x,-1.65,10.8],[x,-3.02,9.2],.12)
 beam('stair wall handrail',[9.24,.9,9.2],[9.24,-.5,10.8],.05,'oak');beam('return wall handrail',[11.85,-.5,10.8],[11.85,-1.9,9.2],.05,'oak')
 # Guard the open centre between the two flights, stopping before the turn.
 for i in range(7):
  z=9.3+i*.2;y=-(z-9.2)*.875
  beam('stair guard',[10.53,y,z],[10.53,y+.9,z],.035,'metal')
 beam('stair guard cap',[10.53,.81,9.3],[10.53,-.24,10.5],.055,'oak')
 # The lower stair has its own masonry side wall, below the main-floor partition.
 box('stair side enclosure',[9.17,-1.4,10.5],[.12,2.8,2.8],'masonry');box('stair opening liner',[9.2,-.11,10.45],[.10,.22,2.8],'trim')
elif stage==4:
 # Raise the roof pitch to create usable clearance at the shifted attic access.
 rise=4.5
 for o in s.objects:
  if o.name.startswith('Main pitched roof'):
   left=o.location.x<6;o.location.z=2.8+rise/2;o.scale.x=math.hypot(6,rise);o.rotation_euler.y=-math.atan2(rise,6)*(1 if left else -1)
 for o in list(s.objects):
  if o.name.startswith('Gable infill'):bpy.data.objects.remove(o,do_unlink=True)
 for z in [0,12]:
  for x,X,lo,hi in [(0,5.3,2.8,None),(6.7,12,2.8,None),(5.3,6.7,2.8,3.6),(5.3,6,4.5,None),(6,6.7,4.5,None)]:
   roof=lambda u:2.8+rise-abs(u-6)*rise/6
   yl=min(roof(x),hi) if hi else roof(x);yr=min(roof(X),hi) if hi else roof(X)
   mesh=bpy.data.meshes.new('Finished gable');mesh.from_pydata([native(v) for v in [(x,lo,z),(X,lo,z),(X,yr,z),(x,yl,z)]],[],[(0,1,2,3)]);mesh.update();o=bpy.data.objects.new('Finish / Gable',mesh);collection.objects.link(o);mesh.materials.append(mats['wood']);o['preview_kind']='roof'
 for x in [8.67,9.98]:box('hatch liner',[x,2.7,7.55],[.06,.22,1.06],'cream','ceiling')
 for z in [7.02,8.08]:box('hatch liner',[9.325,2.7,z],[1.37,.22,.06],'cream','ceiling')
 for x in [8.63,10.02]:box('hatch casing',[x,2.58,7.55],[.085,.045,1.18],'trim','ceiling')
 for z in [6.98,8.12]:box('hatch casing',[9.325,2.58,z],[1.47,.045,.085],'trim','ceiling')
 for o in list(s.objects):
  if o.get('preview_kind')=='ladder':bpy.data.objects.remove(o,do_unlink=True)
 start=Vector((7.92,0,7.55));end=Vector((9.82,2.8,7.55))
 for section in range(3):
  a=start.lerp(end,section/3);b=start.lerp(end,(section+1)/3)
  for dz in [-.39,.39]:
   o=beam('folding ladder rail',a+Vector((0,0,dz)),b+Vector((0,0,dz)),.065,'wood','ladder');o['ladder_section']=section
  for n in range(4):
   c=a.lerp(b,(n+.5)/4);o=box('ladder tread',c,[.17,.055,.74],'oak','ladder');o['ladder_section']=section
  for dz in [-.4,.4]:
   o=box('ladder hinge',b+Vector((0,0,dz)),[.10,.09,.025],'brass','ladder');o['ladder_section']=section
 for o in collection.objects:
  if o.get('preview_kind')=='ladder':o.hide_render=True;o.hide_set(True)
 for z in [7.03,8.07]:beam('attic landing rail',[8.1,3.65,z],[8.65,3.65,z],.06,'wood')
 for z in [7.03,8.07]:beam('attic landing post',[8.15,2.8,z],[8.15,3.65,z],.065,'wood')
 light('Attic access light',[8.2,4.0,8.5],power=90)
 s['attic_roof_rise']=rise
elif stage==5:
 # Refit the visible unfinished room envelopes with actual construction detail.
 for o in list(s.objects):
  if o.get('source_room')=='attic' and o.type in {'MESH','CURVE'}:
   bounds=[o.matrix_world@Vector(v) for v in o.bound_box]
   if min(v.z for v in bounds)>4.05 and max(max(v.x for v in bounds)-min(v.x for v in bounds),max(v.y for v in bounds)-min(v.y for v in bounds))>1.5:bpy.data.objects.remove(o,do_unlink=True)
 for z in [2,6,10]:beam('roof attached conduit',[6.18,7.0,z],[6.18,7.0,min(z+3.7,11.8)],.035,'metal','roof')
 for w in plan['windows']:
  if w['id'].startswith('garage'):window(w)
 for z in [.6,1.2,1.8,2.4,3,3.6,4.2,4.8,5.4,6]:
  box('garage ceiling joist',[14.5,2.62,z],[4.85,.20,.10],'wood','ceiling')
 # Side wall battens stay clear of window apertures.
 for z in [.2,.8,1.4,4.1,4.7,5.3,5.9,6.5]:box('garage side stud',[16.9,1.3,z],[.10,2.6,.08],'wood')
 # Rear and left framing comes with the original workshop; only add right studs.
 for x in [13,15.8]:light('Workshop overhead',[x,2.42,3.4],(.83,.9,1),130)
 # Cellar masonry joints and overhead joists; clear the stairwell footprint.
 for y in [-2.4,-2,-1.6,-1.2,-.8]:
  box('cellar mortar rear',[6,y,.08],[11.8,.012,.012],'mortar');box('cellar mortar side',[.08,y,6],[.012,.012,11.8],'mortar')
 for x in [i*.6+.3 for i in range(20)]:
  box('basement joist',[x,-.30,4.45],[.085,.20,8.8],'wood','ceiling')
  if x<9:box('basement joist',[x,-.30,10.5],[.085,.20,3],'wood','ceiling')
 for w in [{'id':'cellar side A','segment_xz':[0,2,0,3.5]},{'id':'cellar side B','segment_xz':[0,8,0,9.5]},{'id':'cellar rear','segment_xz':[8,0,9.5,0]}]:w.update(sill_y=-.9,head_y=-.3);window(w)
 for x,z in [(3,4),(7,8),(10,5)]:light('Basement utility light',[x,-.45,z],(.94,.85,.65),120)
 # Roof framing follows the new pitch rather than the old room envelope.
 for z in [.4+i*.65 for i in range(18)]:
  for x,X in [(.15,6),(6,11.85)]:
   ry=lambda u:7.3-abs(u-6)*.75
   beam('attic rafter',[x,ry(x)-.12,z],[X,ry(X)-.12,z],.10,'wood','roof')
 for x in [i*.6+.3 for i in range(20)]:
  for z,Z in [(0,6.8),(8.3,12)]:box('attic exposed joist',[x,2.86,(z+Z)/2],[.08,.12,Z-z],'wood','floor')
 for z in [3.7+i*.24 for i in range(18)]:box('attic walking board',[6.3,2.823,z],[1.8,.035,.23],'oak','floor')
 for z in [0,12]:window({'id':'attic gable','segment_xz':[5.3,z,6.7,z],'sill_y':3.6,'head_y':4.5})
 for o in s.objects:
  if o.get('preview_kind')=='shell' and o.name.startswith('Basement masonry'):o.data.materials.clear();o.data.materials.append(mats['masonry'])
  if o.get('preview_kind')=='floor' and o.name.startswith('Basement slab'):o.data.materials.clear();o.data.materials.append(mats['concrete'])
elif stage==6:
 # Keep the den arrangement; restore source materials on its individual props.
 with bpy.data.libraries.load(str(ROOT/'scene/midnight-den-illustrated.blend'),link=False) as(src,dst):dst.objects=list(src.objects)
 originals={o.name:o for o in dst.objects if o}
 # Appended names may gain suffixes; use library source order for exact original IDs.
 for original_name,o in zip(src.objects,dst.objects):
  if o:originals[original_name]=o
 for o in list(s.objects):
  if o.get('source_room')!='den':continue
  source=originals.get(o.get('source_object',''))
  if not source or not hasattr(source.data,'materials'):continue
  o.data.materials.clear()
  for m in source.data.materials:o.data.materials.append(m)
  o['preview_preserve_material']=True
 for o in dst.objects:
  if o:bpy.data.objects.remove(o,do_unlink=True)
 flooring([.1,6.9,4.7,11.9]);trims(trim_walls_for_stage(stage))
 light('Den amber lamp',[.85,1.25,7.9],(1,.52,.19),65);light('Den window fill',[.3,1.8,10.7],(.32,.52,1),70)
 for o in s.objects:
  if o.name.startswith('Proposed wall') and o.type=='MESH':o.data.materials.clear();o.data.materials.append(mats['plaster'])
 # Layer a small grove outside each visible window; do not use flat picture walls.
 rng=random.Random(472)
 for x,z in [(-3,9),(-5,11),(-7,7),(19,8),(22,10),(20,4),(5,-4),(8,-6),(14,-5)]:
  box('window-view tree trunk',[x,1.8,z],[.18,4.5,.18],'wood','site')
  for y in [1.8,2.6,3.4,4.2]:
   bpy.ops.mesh.primitive_cone_add(vertices=9,radius1=(5-y)*.55,radius2=0,depth=1.8,location=native([x,y,z]));o=bpy.context.object;o.name='Finish / pine';
   for c in list(o.users_collection):c.objects.unlink(o)
   collection.objects.link(o);o.data.materials.append(mats['leaves']);o['preview_kind']='site'
 for x,z in [(-.55,2.75),(-.55,8.75),(8.75,-.55)]:
  box('window well gravel',[x,-2,z],[1.1,.12,1.7],'concrete','site')
 # Porch edge and driveway border provide a grounded exterior glimpse.
 for x in [5.0,8.9]:box('porch post',[x,1.3,13.7],[.12,2.6,.12],'cream','site')
 box('porch canopy',[6.95,2.67,13],[4.4,.12,2.3],'wood','site')
elif stage==7:
 # Door faces remain visible during opening, so supply hardware on both sides.
 for d in plan['doors']:
  if d['id']=='vehicle':continue
  x,z,X,Z=d['segment_xz'];along=z==Z
  for side in [-1,1]:
   u=(x+.13 if d['id']=='stairs' else X-.13) if along else(z+.13 if d['id'] in ['den','garage'] else Z-.13)
   p=[u,1.02,z+side*.055] if along else[x+side*.055,1.02,u]
   o=box(d['id']+' handle',p,[.12,.035,.035] if along else[.035,.035,.12],'brass','door');o['door_id']=d['id']
  for y in [.58,1.55]:
   o=box(d['id']+' raised panel',[(x+X)/2,y,(z+Z)/2],[max(X-x-.20,.075),.60,max(Z-z-.20,.075)],'oak','door');o['door_id']=d['id']
 for o in s.objects:
  if o.name.startswith('Attic pull cord'):o['preview_kind']='door';o['door_id']='attic'
 trims(trim_walls_for_stage(stage))
 for d in plan['doors']:
  if d['id'] in ['bedroom-1','bedroom-2','bath','kitchen','kitchen-den']:doorframe(d)
 window(next(w for w in plan['windows'] if w['id']=='hall-rear'));flooring([4.9,.1,6.2,6.85])
 for z in [1.5,4.5]:light('Rear hall opal light',[5.55,2.45,z])
 s['rear_hall_ready']=True
elif stage==8:
 # Keep the original cellar's four-metre headroom. The first blockout had
 # squeezed it into a 2.8 m foundation and omitted the wall behind the stairs.
 if not s.get('original_basement_height_restored'):
  fit=Matrix.Translation((0,0,-4))@Matrix.Scale(1/.9,4,(0,0,1))@Matrix.Translation((0,0,2.8))
  for o in list(s.objects):
   if o.get('source_room')=='basement':o.matrix_world=fit@o.matrix_world
  s['original_basement_height_restored']=True
 remove=('Basement slab','Basement masonry','Stair descending flight','Stair return flight','Half landing')
 detail=('Finish / first flight riser','Finish / return flight riser','Finish / first stringer','Finish / return stringer','Finish / stair wall handrail','Finish / return wall handrail','Finish / stair guard','Finish / stair side enclosure','Finish / cellar mortar')
 for o in list(s.objects):
  if o.name.startswith(remove) or o.name.startswith(detail) or o.name.startswith('Finish / Cellar front closure'):
   bpy.data.objects.remove(o,do_unlink=True)
 for p in spec['parts']:
  if p['name'].startswith(('Basement slab','Basement masonry','Stair descending flight','Stair return flight','Half landing','Cellar front closure')):
   mat='masonry' if p['material']=='masonry' else 'concrete' if p['name'].startswith('Basement slab') else 'wood'
   box(p['name'],p['center'],p['size'],mat,p['kind'])
 for i in range(12):
  top=-(i+1)/6;box('first flight riser',[9.9,top+1/12,9.2+i*.13],[1.1,1/6,.035],'wood','stair')
  top=-2-(i+1)/6;box('return flight riser',[11.15,top+1/12,10.8-i*.13],[1.1,1/6,.035],'wood','stair')
 for x in [9.36,10.44]:beam('first stringer',[x,-.25,9.2],[x,-2.2,10.8],.12)
 for x in [10.61,11.69]:beam('return stringer',[x,-2.2,10.8],[x,-4.15,9.2],.12)
 beam('stair wall handrail',[9.24,.9,9.2],[9.24,-1.1,10.8],.05,'oak')
 beam('return wall handrail',[11.85,-1.1,10.8],[11.85,-3.1,9.2],.05,'oak')
 for i in range(11):
  z=9.3+i*.13;y=-(z-9.2)*2/1.56
  beam('stair guard',[10.53,y,z],[10.53,y+.9,z],.035,'metal')
 beam('stair guard cap',[10.53,.77,9.3],[10.53,-1.01,10.7],.055,'oak')
 box('stair side enclosure',[9.17,-2,10.5],[.12,4,2.8],'masonry')
 for y in [-3.6,-3.2,-2.8,-2.4,-2,-1.6,-1.2,-.8]:
  box('cellar mortar rear',[6,y,.08],[11.8,.012,.012],'mortar')
  box('cellar mortar side',[.08,y,6],[.012,.012,11.8],'mortar')
 for o in s.objects:
  if o.name.startswith('Door / front'):
   o.location.z=1.085;o.scale.x=1.13;o.scale.z=2.17
  if o.get('view_id')=='basement':
   view=spec['views']['basement'];o.location=native(view['position']);o.rotation_euler=(native(view['target'])-o.location).to_track_quat('-Z','Y').to_euler()
  if o.get('route_id')=='basement':
   for point,xyz in zip(o.data.splines[0].points,spec['routes']['basement']):point.co=(*native(xyz),1)
 # The old runner was excluded because its full length crossed several new
 # doors. Refit its actual weave and edging to the shorter cross hall.
 if not any(o.get('preview_fitted_runner') for o in s.objects):
  before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'scene/exports/house/hallway.glb'))
  added=list(set(s.objects)-before)
  transform=Matrix.Translation((8.9,-7.55,0))@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Diagonal((.9,.43,1,1))
  fitted=[(o,o.name,transform@o.matrix_world.copy()) for o in added if o.type=='MESH' and re.search(r'runner|fringe',o.name,re.I)]
  for o,name,pose in fitted:
   o.parent=None;o.matrix_world=pose
   for c in list(o.users_collection):c.objects.unlink(o)
   collection.objects.link(o)
   o['preview_kind']='contents';o['source_room']='hallway';o['source_object']=name;o['preview_fitted_runner']=True
  for o in added:
   if o not in [item[0] for item in fitted]:bpy.data.objects.remove(o,do_unlink=True)
 s['pre_bake_refit']=True
elif stage==9:
 # Reuse the modeled hallway door language on the visited openings. Keep each
 # leaf piece separate so the existing hinge animation opens the whole assembly.
 visible={'mudroom':-math.pi/2,'garage':0,'den':0,'stairs':math.pi/2,'front':-math.pi/2}
 for o in list(s.objects):
  if any(o.name.startswith(('Door / '+id,'Finish / '+id+' handle','Finish / '+id+' raised panel')) for id in visible):
   bpy.data.objects.remove(o,do_unlink=True)
 before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'scene/exports/house/hallway.glb'))
 added=list(set(s.objects)-before)
 wanted={'Recessed unmarked door leaf','Recessed door panel','Recessed door panel.001','Unmarked door brass knob','Door jamb hinge','Door jamb hinge.001'}
 source={o.name:o for o in added if o.type=='MESH' and o.name in wanted}
 if set(source)!=wanted:raise RuntimeError('Original hallway door assembly is incomplete: '+str(wanted-set(source)))
 for d in plan['doors']:
  if d['id'] not in visible:continue
  x,z,X,Z=d['segment_xz'];along=z==Z;width=(X-x if along else Z-z)+(.03 if d['id']=='front' else 0)
  height=2.17 if d['id']=='front' else 2.14
  target=Matrix.Translation(((x+X)/2,-(z+Z)/2,0))@Matrix.Rotation(visible[d['id']],4,'Z')@Matrix.Diagonal((1,width/1.04,height/2.33,1))@Matrix.Translation((1.385,5.9,0))
  for name,original in source.items():
   copy=original.copy();copy.data=original.data.copy();collection.objects.link(copy);copy.parent=None;copy.matrix_world=target@original.matrix_world
   copy.name='Original door / '+d['id']+' / '+name;copy['preview_kind']='door';copy['door_id']=d['id'];copy['source_object']=name
 oak=source['Recessed door panel'].data.materials[0]
 for o in s.objects:
  if o.type=='MESH' and any(o.name.startswith(('Finish / '+id+' casing','Finish / '+id+' head')) for id in visible):
   o.data.materials.clear();o.data.materials.append(oak)
 for o in added:bpy.data.objects.remove(o,do_unlink=True)
 s['original_doors_refitted']=True
else:
 raise RuntimeError('Unknown stage')
# Keep the lower cellar flight open for the direct arrival route.
for o in s.objects:
 if 'stair side enclosure' in o.name and not o.get('open_lower_stair'):
  m=o.matrix_world.copy();o.data=o.data.copy();o.data.transform(m.inverted()@Matrix.Diagonal((1,1,.35,1))@m);o['open_lower_stair']=True
from room_model_refit import refit_room
new_runners=[o for o in s.objects if o.get('preview_fitted_runner') and not o.get('model_refit')]
if new_runners:
 from basement_model_refit import import_source
 from room_model_refit import refit_object
 sources=import_source(ROOT/'scene/exports/house/hallway.glb');bpy.context.view_layer.update()
 for o in new_runners:
  original=next(q for q in sources if q.get('source_object')==o.get('source_object'))
  refit_object(o,original,sources,'hallway')
 for o in sources:bpy.data.objects.remove(o,do_unlink=True)
from house_preview_fixtures import polish_preview_fixtures
polish_preview_fixtures()
from house_finishes import apply_house_finishes
apply_house_finishes(bpy.context.scene)
bpy.context.view_layer.update();assert_unique_trim(s.objects)
s['finish_stage']=max(stage,s.get('finish_stage',0));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene/house-plan-preview.blend'),compress=True);export_preview()
print('FINISHED STAGE',stage,flush=True)
