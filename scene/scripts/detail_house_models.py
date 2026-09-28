"""Deterministic, glTF-safe surface finishing for the four exploration rooms.
Textures use UVs and travel with props. Added details are joined to their owner,
so grabbing a clock, book, or tool never leaves its fasteners behind.
"""
import bpy, math, hashlib, re
import numpy as np
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
TEX=ROOT/'scene/house-textures/surface-finish';TEX.mkdir(parents=True,exist_ok=True)

def seed(name):return int(hashlib.sha256(name.encode()).hexdigest()[:8],16)
def family(name):
 n=name.lower()
 if any(s in n for s in ['wood','oak','pale']):return 'timber'
 if any(s in n for s in ['cotton','canvas','cloth','pink']):return 'weave'
 if 'leather' in n:return 'leather'
 if 'paper' in n:return 'paper'
 if 'clay' in n:return 'cardboard'
 if any(s in n for s in ['brass','metal']):return 'metal'
 if any(s in n for s in ['concrete','wall','ceiling','paint']):return 'plaster'
 if any(s in n for s in ['rubber','plastic','ink']):return 'rubber'
 return 'enamel'

def fields(kind):
 rng=np.random.default_rng(seed(kind));n=256;y,x=np.mgrid[0:n,0:n]/n
 fine=rng.random((n,n));cloud=(np.sin(x*19+np.sin(y*15))*np.cos(y*23-x*7)+np.sin(x*41+y*29)*.3)/2
 if kind=='timber':
  warp=x+np.sin(y*7)*.018+np.sin(y*23)*.004
  grain=np.sin(warp*440+np.sin(warp*80)*2)*.16+np.sin(warp*109)*.10
  knot=np.exp(-(((x-.38)/.17)**2+((y-.63)/.055)**2))
  height=.5+grain+fine*.08-knot*.25; variation=(height-.5)*.45+cloud*.08
 elif kind=='weave':
  a=np.sin(x*math.tau*64);b=np.sin(y*math.tau*64)
  height=.5+.18*a+.18*b+.06*a*b+fine*.06;variation=(height-.5)*.23+cloud*.10
 elif kind=='paper':
  height=.45+fine*.15+.05*np.sin(y*800+x*21);variation=cloud*.06+(fine-.5)*.035
 elif kind=='cardboard':
  height=.45+.06*np.sin(x*420)+fine*.15;variation=cloud*.10+(fine-.5)*.07
 elif kind=='metal':
  scratch=np.maximum(0,np.sin(x*1730+y*7))**32
  height=.5+fine*.03-scratch*.12;variation=cloud*.08-scratch*.08
 elif kind=='plaster':
  pores=(fine>.965).astype(float);height=.5+cloud*.12+fine*.16-pores*.27;variation=cloud*.11-pores*.06
 elif kind=='leather':
  height=.5+fine*.10+.07*np.sin(x*350+np.sin(y*84)*3)*np.sin(y*320);variation=cloud*.12+(height-.5)*.2
 else:
  height=.5+fine*.055+cloud*.035;variation=cloud*.10+(fine-.5)*.03
 # Sparse rubbed streaks and tiny abrasions, distinct from the substrate grain.
 scars=np.zeros((n,n))
 for i in range(16 if kind in ['metal','enamel','rubber','leather'] else 5):
  px,py=rng.integers(4,n-35,2);length=int(rng.integers(4,30));scars[py:py+1,px:px+length]=rng.uniform(.2,.7)
 variation+=scars*.11;height-=scars*.06
 return height,variation,cloud,scars
FIELDS={k:fields(k) for k in ['timber','weave','paper','cardboard','metal','plaster','leather','rubber','enamel']}

def image(name,rgb,noncolor=False):
 path=TEX/(name+'.png');h,w=rgb.shape[:2];rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=rgb
 im=bpy.data.images.new(name,width=w,height=h,alpha=False);im.colorspace_settings.name='Non-Color' if noncolor else 'sRGB';im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(path);im.file_format='PNG';im.save();im.pack();return im

def finish_materials(objects):
 used={m for o in objects if o.type=='MESH' for m in o.data.materials if m};shared={};finished={}
 for m in used:
  if not m.use_nodes:continue
  p=m.node_tree.nodes.get('Principled BSDF')
  if not p:continue
  n=m.name;kind=family(n);height,var,cloud,scars=FIELDS[kind];nodes=m.node_tree.nodes;links=m.node_tree.links
  # Keep artwork, the real plate photograph, glass, and light sources intact.
  if any(t in n.lower() for t in ['rain','garden','night','glow','glints']):continue
  base=p.inputs['Base Color'];art=base.is_linked and base.links[0].from_node.type=='TEX_IMAGE'
  if not art:
   col=np.array(m.diffuse_color[:3]);linear=np.clip(col[None,None,:]*(1+var[:,:,None]),0,1)
   if kind=='metal':linear=linear*(1-np.maximum(0,cloud[:,:,None])*.22)
   rgb=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
   tx=nodes.new('ShaderNodeTexImage');tx.image=image('finish-'+re.sub(r'[^a-z0-9]+','-',n.lower()),rgb)
   for l in list(base.links):links.remove(l)
   links.new(tx.outputs['Color'],base)
  else:kind='paper';height,var,cloud,scars=FIELDS[kind]
  if kind not in shared:
   dx=np.roll(height,-1,1)-np.roll(height,1,1);dy=np.roll(height,-1,0)-np.roll(height,1,0)
   normal=np.stack((-dx*1.7,-dy*1.7,np.ones_like(dx)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
   shared[kind]=image('finish-'+kind+'-normal',normal*.5+.5,True)
  normaltex=nodes.new('ShaderNodeTexImage');normaltex.image=shared[kind]
  normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.20 if art else {'plaster':.24,'paper':.25,'rubber':.35,'enamel':.4,'metal':.4}.get(kind,.6)
  for l in list(p.inputs['Normal'].links):links.remove(l)
  links.new(normaltex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
  rough=float(p.inputs['Roughness'].default_value);roughmap=np.clip(rough+cloud*.16+scars*.2,.15,1)
  rt=nodes.new('ShaderNodeTexImage');rt.image=image('finish-'+re.sub(r'[^a-z0-9]+','-',n.lower())+'-rough',np.repeat(roughmap[:,:,None],3,axis=2),True)
  links.new(rt.outputs['Color'],p.inputs['Roughness']);m['surface_finish']=kind;finished[m]=kind
 return finished

def detail_mesh(o,finished):
 mats=[m for m in o.data.materials if m];kinds={finished.get(m) for m in mats};kinds.discard(None)
 if not kinds:return
 n=o.name.lower();rng=np.random.default_rng(seed(o.name));mesh=o.data
 art=any(m.use_nodes and any(t.type=='TEX_IMAGE' and t.image and not t.image.name.startswith('finish-') for t in m.node_tree.nodes) for m in mats)
 # Do not replace the existing print UVs. All other faces receive a coherent
 # local grain direction, including pipes converted from curves.
 if not art:
  coords=np.array([v.co[:] for v in mesh.vertices]);lo=coords.min(axis=0);span=np.maximum(coords.max(axis=0)-lo,.00001)
  uv=mesh.uv_layers.active or mesh.uv_layers.new(name='Surface grain');longest=int(np.argmax(span));offset=rng.random(2)*.4
  for poly in mesh.polygons:
   axes=[i for i in range(3) if i!=max(range(3),key=lambda i:abs(poly.normal[i]))]
   if 'timber' in kinds and longest in axes:axes=[i for i in axes if i!=longest]+[longest]
   for li in poly.loop_indices:
    co=mesh.vertices[mesh.loops[li].vertex_index].co
    density=(1.5,1.5) if o.get('painted_wall') else (.24,2.0) if 'timber' in kinds else tuple(span[a] for a in axes)
    uv.data[li].uv=tuple((co[a]-lo[a])/density[j]+offset[j] for j,a in enumerate(axes))
 # Small, deterministic asymmetry: crushed carton corners, paper folds and
 # battered metal. Structural walls and artwork planes keep their alignment.
 if not art and len(mesh.vertices)<5000:
  coords=[v.co.copy() for v in mesh.vertices];lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)));extent=hi-lo
  if any(t in n for t in ['carton','cardboard','storage box','notebook','loose paper','paper study','draft','letter','cloth','blanket']):
   thin=min(range(3),key=lambda i:extent[i]);long=max(range(3),key=lambda i:extent[i]);amp=min(.007,max(extent)*.012)
   for v in mesh.vertices:
    phase=(v.co[long]-lo[long])/max(extent[long],.0001)
    v.co[thin]+=amp*(phase-.5)**2*math.sin(phase*5+seed(o.name)%9)
   if 'carton' in n:
    corner=mesh.vertices[int(rng.integers(len(mesh.vertices)))];corner.co+=(lo+hi-2*corner.co)*.018
  elif any(t in n for t in ['utility can','metal case','furnace','shade','stool','hammer steel']):
   for v in mesh.vertices:
    v.co.x+=math.sin(v.co.z*23+v.co.y*17)*min(.003,max(extent)*.003)
 o['surface_finish']=' / '.join(sorted(kinds));o['detail_revision']=1

def join_details(owner,parts):
 if not parts:return
 bpy.ops.object.select_all(action='DESELECT');owner.select_set(True)
 for p in parts:
  p.select_set(True)
  if p.type!='MESH':bpy.context.view_layer.objects.active=p;bpy.ops.object.convert(target='MESH')
 bpy.context.view_layer.objects.active=owner;bpy.ops.object.join()

def small_details(objects):
 # Surface-attached construction details share the original mesh and transform.
 metal=bpy.data.materials.get('metal');ink=bpy.data.materials.get('ink');paper=bpy.data.materials.get('paper')
 for o in objects:
  n=o.name;parts=[]
  if n.startswith('Clock face'):
   for i in range(60):
    a=i*math.tau/60;r=.204
    bpy.ops.mesh.primitive_cube_add(size=1,location=o.location+Vector((math.sin(a)*r,-.010,math.cos(a)*r)))
    p=bpy.context.object;p.dimensions=(.007 if i%5 else .011,.002,.012 if i%5 else .024);p.rotation_euler.y=a;p.data.materials.append(ink);parts.append(p)
  if n.startswith('Keycap'):
   index=int(re.search(r'(\d+)$',n).group(1)) if re.search(r'(\d+)$',n) else 0
   cu=bpy.data.curves.new('Faded key legend','FONT');cu.body='QWERTYUIOPASDFGHJKLZXCVBNM123456'[index%30];cu.size=.022;cu.align_x='CENTER';p=bpy.data.objects.new('Key legend',cu);bpy.context.collection.objects.link(p);p.location=o.location+Vector((0,-.010,.009));cu.materials.append(ink);parts.append(p)
  if any(n.startswith(t) for t in ['Furnace service panel','Workshop surface outlet','Misaligned junction cover','Small practical pegboard']):
   # These panels face Blender -Y.
   for sx in [-1,1]:
    for sz in [-1,1]:
     pos=o.location+Vector((sx*o.dimensions.x*.40,-o.dimensions.y/2-.002,sz*o.dimensions.z*.40))
     bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=pos);p=bpy.context.object;p.scale=(.012,.004,.012);p.data.materials.append(metal);parts.append(p)
  def attached_box(offset,size,material):
   bpy.ops.mesh.primitive_cube_add(size=1,location=o.matrix_world@Vector(offset));p=bpy.context.object;p.rotation_euler=o.matrix_world.to_euler();p.dimensions=size;p.data.materials.append(material);parts.append(p);return p
  # Thin page signatures, worn book spines and cloth stitching read at close range.
  if any(t in n.lower() for t in ['notebook','folder']) and o.dimensions.z<.15:
   for dz in [-.014,-.007,0,.007,.014]:attached_box((0,-o.dimensions.y*.501,dz),(o.dimensions.x*.85,.001,.0012),paper)
   attached_box((-o.dimensions.x*.43,0,o.dimensions.z*.502),(.002,o.dimensions.y*.92,.001),ink)
  if n.startswith('Ordinary shoe'):
   # Shoe meshes are ellipsoids with un-applied scale: local points follow them.
   for i in range(18):
    a=i*math.tau/18
    bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=3,radius=1,location=o.matrix_world@Vector((.89*math.cos(a),.89*math.sin(a),.40)))
    p=bpy.context.object;p.scale=(.004,.007,.0015);p.data.materials.append(paper);parts.append(p)
  if n.startswith('Tape reel'):
   for i in range(6):
    a=i*math.tau/6
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.042,depth=.002,location=o.location+Vector((.12*math.cos(a),.12*math.sin(a),.019)))
    p=bpy.context.object;p.data.materials.append(metal);parts.append(p)
   for radius in [.182,.194,.206]:
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=4,major_radius=radius,minor_radius=.0015,location=o.location+Vector((0,0,.019)))
    p=bpy.context.object;p.data.materials.append(metal);parts.append(p)
  if n.startswith('Voice tape recorder'):
   for dx in [-.20,.20]:
    attached_box((dx,-.18,.103),(.15,.08,.003),ink)
    attached_box((dx,-.18,.106),(.13,.062,.002),paper)
    needle=attached_box((dx,-.18,.109),(.002,.050,.001),ink);needle.rotation_euler.z=.3 if dx<0 else -.2
  if n.startswith('Cream wheel hub'):
   for i in range(8):
    a=i*math.tau/8;radius=o.dimensions.x*.37
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=o.location+Vector((radius*math.cos(a),-.015,radius*math.sin(a))))
    p=bpy.context.object;p.scale=(.012,.003,.012);p.data.materials.append(metal);parts.append(p)
  if n.startswith('Tricycle rubber wheel'):
   # Fine shallow tread cuts represented by dark inset strips on the sidewall.
   for i in range(36):
    a=i*math.tau/36;r=o.dimensions.x*.46
    bpy.ops.mesh.primitive_cube_add(size=1,location=o.location+Vector((r*math.sin(a),-.059,r*math.cos(a))))
    p=bpy.context.object;p.dimensions=(.004,.002,.021);p.rotation_euler.y=a;p.data.materials.append(ink);parts.append(p)
  join_details(o,parts)

def carton_surface(o):
 # Bake tape into the top face, with UVs in box-local coordinates so it turns
 # and tumbles with the carton. No extra pickable mesh or collision shape.
 base=o.data.materials[0];material=base.copy();material.name=o.name+' taped cardboard'
 height,var,cloud,scars=FIELDS['cardboard'];n=var.shape[0];y,x=np.mgrid[0:n,0:n]/n
 col=np.array(base.diffuse_color[:3]);linear=np.clip(col[None,None,:]*(1+var[:,:,None]),0,1)
 seam=(np.abs(y-.5)<.004)&(np.abs(x-.5)<.43)
 linear[seam]*=.35
 width=.06/o.dimensions.x
 tape=(np.abs(x-.5)<width/2)&(y>.03)&(y<.97)
 linear[tape]=np.array([.58,.48,.30])*(1+var[tape,None]*.4)
 rgb=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
 p=material.node_tree.nodes.get('Principled BSDF');basecolor=p.inputs['Base Color']
 for link in list(basecolor.links):material.node_tree.links.remove(link)
 tx=material.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image('carton-'+re.sub(r'[^a-z0-9]+','-',o.name.lower()),rgb)
 material.node_tree.links.new(tx.outputs['Color'],basecolor)
 index=len(o.data.materials);o.data.materials.append(material)
 coords=np.array([v.co[:] for v in o.data.vertices]);lo=coords.min(axis=0);span=coords.max(axis=0)-lo
 uv=o.data.uv_layers.active
 for poly in o.data.polygons:
  if poly.normal.z<.9:continue
  poly.material_index=index
  for li in poly.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co
   uv.data[li].uv=((co.x-lo[0])/span[0],(co.y-lo[1])/span[1])

def finish_house(room):
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Shared palette colors also appear on different substrates. Give cloth its
 # own material before finishing rather than treating a blue rug like enamel.
 cloth={}
 for o in objects:
  if any(t in o.name.lower() for t in ['runner','jacket','cloth','shirt','blanket','linen','canvas','insulation']):
   for i,m in enumerate(o.data.materials):
    if not m or (m.use_nodes and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes)):continue
    if m not in cloth:
     copy=m.copy();copy.name='Woven cotton '+m.name;cloth[m]=copy
    o.data.materials[i]=cloth[m]
 finished=finish_materials(objects)
 for o in objects:
  detail_mesh(o,finished)
  if o.get('packing_tape'):carton_surface(o)
 small_details(objects)
 counts={}
 for o in objects:
  key=o.get('surface_finish','Preserved artwork / light / glass');counts[key]=counts.get(key,0)+1
 bpy.context.scene['detail_revision']=1
 return counts
