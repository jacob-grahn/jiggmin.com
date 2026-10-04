"""Small ceiling-mounted detectors, in house coordinates. No lights or dynamics."""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PLACEMENTS = [('hallway', (10.3, 2.6, 7.55)), ('garage', (14.8, 2.6, 1.5)), ('basement', (3.36, -.2, 2.4))]

def create_smoke_detectors(scene):
 def material(name, color):
  m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
  p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.85
  return m
 plastic=material('Smoke detector warm white plastic',(.72,.69,.62))
 dark=material('Smoke detector recessed vents',(.018,.021,.024))
 green=material('Smoke detector status lens',(.025,.15,.035))
 # Mount to the actual visible underside, including small authored floor slopes.
 # Hidden native duplicates must not override the prepared source geometry.
 bpy.context.view_layer.update()
 ceilings=[]
 for surface in scene.objects:
  if surface.type!='MESH' or surface.hide_render or not surface.name.startswith(('Attic floor / hall ceiling','Garage ceiling','Main floor','Basement ceiling','Cellar slab underside / ')):continue
  ceilings.append(BVHTree.FromPolygons([surface.matrix_world@v.co for v in surface.data.vertices],[list(p.vertices) for p in surface.data.polygons]))
 result=[]
 for room,position in PLACEMENTS:
  vertices=[];faces=[];slots=[]
  # The flange meets the ceiling. A shallow beveled housing faces downward.
  profile=[(0,0),(.078,0),(.083,-.004),(.083,-.010),(.075,-.015),(.073,-.035),(.065,-.043),(0,-.043)]
  segments=40
  for r,z in profile:
   vertices.extend((r*math.cos(i*2*math.pi/segments),r*math.sin(i*2*math.pi/segments),z) for i in range(segments))
  for j in range(len(profile)-1):
   for i in range(segments):
    k=(i+1)%segments;faces.append(((j+1)*segments+i,(j+1)*segments+k,j*segments+k,j*segments+i));slots.append(0)
  # Radial intake slots are inset-colored strips on the underside, baked once.
  for i in range(16):
   a=i*2*math.pi/16;radial=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0));center=radial*.052+Vector((0,0,-.0433))
   offset=len(vertices)
   vertices.extend(tuple(center+radial*u+side*v) for u,v in [(-.008,-.0015),(-.008,.0015),(.008,.0015),(.008,-.0015)])
   faces.append(tuple(offset+j for j in range(4)));slots.append(1)
  for cx,cy,r,slot in [(0,0,.011,0),(.025,0,.002,2)]:
   offset=len(vertices);vertices.extend((cx+r*math.cos(-i*2*math.pi/24),cy+r*math.sin(-i*2*math.pi/24),-.044) for i in range(24))
   faces.append(tuple(offset+i for i in range(24)));slots.append(slot)
  mesh=bpy.data.meshes.new('Smoke detector '+room);mesh.from_pydata(vertices,[],faces);mesh.update()
  for m in [plastic,dark,green]:mesh.materials.append(m)
  for p,slot in zip(mesh.polygons,slots):p.material_index=slot
  obj=bpy.data.objects.new('Smoke detector / '+room,mesh);scene.collection.objects.link(obj)
  origin=Vector((position[0],-position[2],position[1]-.4))
  hits=[hit for tree in ceilings if (hit:=tree.ray_cast(origin,Vector((0,0,1)),.8))[0] is not None]
  if not hits:raise RuntimeError('Missing ceiling above smoke detector: '+room)
  point,normal,_,_=min(hits,key=lambda hit:hit[3])
  if normal.z>0:normal.negate()
  obj.location=point;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=(-normal).to_track_quat('Z','Y')
  obj['preview_kind']='fixture';obj['release_room']='structure';obj['bake_connection']=True;obj['release_dynamic']=False
  obj['house_smoke_detector']=room;obj['house_authored_reflectance']=True;obj['house_fixed_receiver']=True;obj['houseOutlined']=True
  obj['house_bake_source']=obj.name;obj['house_bake_id']='smoke-detector:'+room;obj['style_source']='original-room-palette'
  result.append(obj)
 return result
