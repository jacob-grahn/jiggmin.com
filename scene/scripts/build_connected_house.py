"""Shared house layout and low-detail circulation geometry.
python3 scene/scripts/build_connected_house.py writes the browser layout.
Blender -b --python scene/scripts/build_connected_house.py also saves house-connected.blend.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
rooms={
 'hallway':{'position':[0,0,0],'yaw':0},
 'workshop':{'position':[-6,0,0],'yaw':math.pi/2,'front':3.25},
 'basement':{'position':[17,-4,-1.8],'yaw':-math.pi/2,'front':9.6,'eyeHeight':1.7},
 'attic':{'position':[0,3.2,-6],'yaw':0,'front':3.2},
 'den':{'position':[-12,0,8],'yaw':0},
}
# Paths run from the hallway's seated view to each room's authored view.
# The renderer adds the precise start/end cameras; these are physical waypoints.
routes={
 'workshop':[[0,1.7,1.3],[-.65,1.7,0],[-1.65,1.7,0],[-2.65,1.8,0]],
 'basement':[[0,1.7,3],[.65,1.7,1.8],[1.4,1.7,1.8],[2.2,1.1667,1.8],[4.6,-.4333,1.8],[7.1,-2.1,1.8]],
 'attic':[[0,1.7,3],[0,1.7,2.3],[0,3.1,1.85],[0,4.68,1.15],[0,4.68,-1.8],[0,4.68,-3.2]],
 'den':[[0,1.7,4.1],[-.65,1.7,3],[-2,1.7,3],[-2,1.7,12],[-7.8,1.7,12],[-9,2.1,13.5]],
}
parts=[]
def box(name,p,s,material='plaster',**extras):parts.append(dict(name=name,position=p,size=s,material=material,**extras))
def corridor_x(name,a,b,z,floor=0,height=3,width=1.3):
 box(name+' floor',[(a+b)/2,floor-.08,z],[abs(b-a),.16,width],'wood')
 box(name+' ceiling',[(a+b)/2,floor+height,z],[abs(b-a),.12,width])
 for side in [-1,1]:box(name+' wall',[(a+b)/2,floor+height/2,z+side*width/2],[abs(b-a),height,.10])
def corridor_z(name,a,b,x,floor=0,height=3,width=1.3):
 box(name+' floor',[x,floor-.08,(a+b)/2],[width,.16,abs(b-a)],'wood')
 box(name+' ceiling',[x,floor+height,(a+b)/2],[width,.12,abs(b-a)])
 for side in [-1,1]:box(name+' wall',[x+side*width/2,floor+height/2,(a+b)/2],[.10,height,abs(b-a)])
def front(name,room,width,height,floor=0,center=0,opening=1.3):
 # Room-local front wall, with an actual doorway instead of an occluding plane.
 r=rooms[room];yaw=r['yaw'];front=r['front']
 for lo,hi in [(-width/2,center-opening/2),(center+opening/2,width/2)]:
  if hi<=lo:continue
  x=(lo+hi)/2;z=front;p=[r['position'][0]+x*math.cos(yaw)+z*math.sin(yaw),r['position'][1]+floor+height/2,r['position'][2]-x*math.sin(yaw)+z*math.cos(yaw)]
  box(name+' front wall',p,[hi-lo,height,.12],rotation=yaw)
 x=center;z=front;p=[r['position'][0]+x*math.cos(yaw)+z*math.sin(yaw),r['position'][1]+floor+height-.3,r['position'][2]-x*math.sin(yaw)+z*math.cos(yaw)]
 box(name+' lintel',p,[opening,.6,.12],rotation=yaw)
corridor_x('Workshop passage',-2.75,-1.38,0)
front('Workshop','workshop',6,3.3)
# Basement: twenty treads descending four metres, with enclosed side walls.
for i in range(20):
 x=1.4+(i+.5)*.30;top=-(i+1)*.20
 box('Basement stair tread',[x,top-.10,1.8],[.30,.20,1.3],'wood')
 for side in [-1,1]:box('Basement stairwell wall',[x,top+1.45,1.8+side*.7],[.30,3.1,.12])
 box('Basement stairwell ceiling',[x,top+3,1.8],[.31,.12,1.5])
 # Handrails follow the stair slope; simple segments are sufficient in transit.
 for side in [-1,1]:box('Basement handrail',[x,top+1,1.8+side*.61],[.37,.045,.045],'rail')
front('Basement','basement',10,4,center=3.6)
# Ceiling opening in the hallway. Replace the original continuous ceiling.
for x,w in [(-.965,.85),(.965,.85)]:box('Hall ceiling beside hatch',[x,3.08,.8],[w,.12,13.4])
for z,d in [(-2.4875,6.825),(4.8875,5.225)]:box('Hall ceiling beyond hatch',[0,3.08,z],[1.08,.12,d])
# Pull-down ladder fits inside the hatch; it appears when the hatch opens.
for i in range(12):
 y=(i+1)*3.38/12;z=2.28-(i+1)*1.13/12
 box('Attic ladder tread',[0,y,z],[.78,.05,.18],'wood',ladder=True)
 for side in [-1,1]:box('Attic ladder stringer',[side*.43,y-.12,z+.045],[.05,.31,.06],'wood',ladder=True)
corridor_z('Attic landing',-2.8,1.15,0,3.38,2.2,1.3)
front('Attic','attic',8,2.7,floor=.18)
# The den sits south-west, leaving room for the workshop and its passage.
# Corner blocks form open elbows; the segments end before the turn.
# The threshold is the first elbow, open toward the hall and side passage.
corridor_z('Den side passage',3.65,11.35,-2)
corridor_x('Den approach',-7.5,-2.65,12)
for z in [3,12]:
 box('Den passage corner floor',[-2,-.08,z],[1.3,.16,1.3],'wood')
 box('Den passage corner ceiling',[-2,3,z],[1.3,.12,1.3])
box('Den elbow outer wall',[-2.65,1.5,3],[.1,3,1.3])
box('Den elbow outer wall',[-2,1.5,2.35],[1.3,3,.1])
box('Den elbow outer wall',[-1.35,1.5,12],[.1,3,1.3])
box('Den elbow outer wall',[-2,1.5,12.65],[1.3,3,.1])
# Clip the extended den shell at x=-7.5 and give it a doorway on that boundary.
for z,d in [(9,4.7),(15.3,5.3)]:box('Den right wall',[-7.5,1.7,z],[.12,3.4,d])
box('Den door lintel',[-7.5,2.9,12],[.12,1,1.3])
layout={'rooms':rooms,'routes':routes,'geometry':parts}
(ROOT/'web/assets/house/layout.json').write_text(json.dumps(layout,indent=2)+'\n')
try:import bpy
except ImportError:raise SystemExit(0)
from mathutils import Matrix,Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for name,color in {'plaster':(.09,.14,.15,1),'wood':(.10,.055,.025,1),'rail':(.20,.18,.13,1)}.items():
 m=bpy.data.materials.new(name);m.diffuse_color=color;materials[name]=m
for name,r in rooms.items():
 path=ROOT/('web/assets/room.glb' if name=='den' else f'web/assets/house/{name}.glb')
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before
 root=bpy.data.objects.new('House / '+name,None);bpy.context.collection.objects.link(root)
 for o in objects:
  if o.parent is None:o.parent=root
 root.location=(r['position'][0],-r['position'][2],r['position'][1]);root.rotation_euler.z=r['yaw']
 # Remove the solid ceiling over the authored hatch.
 if name=='hallway':
  for o in objects:
   if o.name.startswith(('Corridor ceiling','Corridor_ceiling')):bpy.data.objects.remove(o,do_unlink=True)
 # Cut oversized front geometry, matching browser clipping planes.
 import bmesh
 if 'front' in r or name=='den':
  for o in objects:
   if o.type!='MESH':continue
   # Imported glTF is Blender Z-up; the front plane is local Y=-front.
   local_to_room=o.matrix_local.copy()
   bm=bmesh.new();bm.from_mesh(o.data)
   plane=Vector((4.5,0,0)) if name=='den' else Vector((0,-r['front'],0))
   normal=Vector((1,0,0)) if name=='den' else Vector((0,-1,0))
   inv=local_to_room.inverted();point=inv@plane;normal=local_to_room.to_3x3().transposed()@normal
   bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=point,plane_no=normal,clear_outer=True,dist=.0001)
   bm.to_mesh(o.data);bm.free()
for p in parts:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p['position'][0],-p['position'][2],p['position'][1]))
 o=bpy.context.object;o.name=p['name'];o.dimensions=(p['size'][0],p['size'][2],p['size'][1]);o.rotation_euler.z=p.get('rotation',0);o.data.materials.append(materials[p['material']]);o['connector']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene/house-connected.blend'),compress=True)
print('Saved connected house master.',flush=True)
