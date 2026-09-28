"""Shared house layout and low-detail circulation geometry.
python3 scene/scripts/build_connected_house.py writes the browser layout.
Blender -b --python scene/scripts/build_connected_house.py also saves house-connected.blend.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
rooms={
 'hallway':{'position':[0,0,0],'yaw':0,'viewPosition':[0,1.7,9.3],'viewTarget':[0,1.63,-5.8]},
 'workshop':{'position':[6,0,1.8],'yaw':-math.pi/2,'front':3.25},
 'basement':{'position':[-17,-4,.4],'yaw':math.pi/2,'front':9.6,'eyeHeight':1.7},
 'attic':{'position':[0,3.2,-6],'yaw':0,'front':3.2},
 'den':{'position':[-5.89,0,1.9],'yaw':0,'right':4.5,'back':-2.02},
}
# Paths run from the hallway's seated view to each room's authored view.
# The renderer adds the precise start/end cameras; these are physical waypoints.
routes={
 'workshop':[[0,1.7,1.8],[.75,1.7,1.8],[2.65,1.8,1.8]],
 'basement':[[0,1.7,-3.2],[-.75,1.7,-3.2],[-1.4,1.7,-3.2],[-7.4,-2.3,-3.2]],
 'attic':[[0,1.7,3],[0,1.7,2.3],[0,3.1,1.85],[0,4.68,1.15],[0,4.68,-1.8],[0,4.68,-3.2]],
 'den':[[-1.39,1.7,5.9]],
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
corridor_x('Workshop passage',1.38,2.75,1.8)
front('Workshop','workshop',6,3.3)
# Basement stairwell: continuous enclosure with finished treads and wall details.
slope=math.atan2(4,6);run=math.hypot(6,4)
for i in range(20):
 x=-1.4-(i+.5)*.30;top=-(i+1)*.20
 box('Basement stair tread',[x,top-.10,-3.2],[.30,.20,1.3],'wood')
 box('Basement stair nosing',[x+.14,top+.006,-3.2],[.045,.035,1.3],'rail')
# Sloped slabs have vertical depth sufficient to enclose the flight.
for side in [-1,1]:
 box('Basement stairwell wall',[-4.4,-.55,-3.2+side*.72],[run,3.50,.14],slope=slope)
 box('Basement stair skirt',[-4.4,-1.92,-3.2+side*.635],[run,.19,.045],'wood',slope=slope)
 box('Basement stair handrail',[-4.4,-1.05,-3.2+side*.57],[run-.25,.065,.065],'wood',slope=slope)
 for t in [.10,.36,.64,.90]:
  x=-1.4-6*t;y=-4*t+.95
  box('Basement stair rail bracket',[x,y-.07,-3.2+side*.625],[.055,.13,.12],'rail')
box('Basement stairwell ceiling',[-4.4,.9,-3.2],[run+.1,.14,1.58],slope=slope)
# Dark inset housings and opal faces: deliberately non-emissive, switched off.
for t in [.28,.72]:
 x=-1.4-6*t;y=2.9-4*t
 box('Basement stair recessed trim',[x,y-.085,-3.2],[.30,.03,.30],'rail',slope=slope)
 box('Basement stair recessed shadow',[x,y-.105,-3.2],[.235,.035,.235],'dark',slope=slope)
 box('Basement stair recessed opal off',[x,y-.11,-3.2],[.17,.018,.17],'cream',slope=slope)
# Small paired compositions, positioned at eye level along the right wall.
for j,t in enumerate([.34,.70]):
 x=-1.4-6*t;y=-4*t+1.65;z=-3.2-.637
 box('Basement stair art frame',[x,y,z],[.70,.86,.055],'wood')
 box('Basement stair art paper',[x,y,z+.034],[.63,.79,.012],'cream')
 box('Basement stair art ochre block',[x-.12,y-.13,z+.045],[.23,.36,.012],'ochre')
 box('Basement stair art blue block',[x+.13,y+.13,z+.047],[.21,.37,.013],'blue')
 box('Basement stair art charcoal line',[x,y-.29,z+.049],[.46,.025,.014],'dark')
 box('Basement stair art rust mark',[x-.13,y+.23,z+.05],[.18,.10,.014],'rust')
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
# Den and hallway share the wall at x=-1.39 and one doorway at z=5.9.
# The hallway model supplies the opening, door leaf, jamb and threshold.
# Continue the shared wall only beyond the hallway's south end.
box('Den shared wall extension',[-1.39,1.55,9.95],[.18,3.10,4.90])
box('Den front wall',[-7.54,1.55,12.4],[12.3,3.10,.12])
# Extend the near end so the landing can frame the den doorway on the left.
box('Hall landing floor',[0,-.08,8.95],[2.78,.16,2.9],'wood')
box('Hall landing ceiling',[0,3.08,8.95],[2.78,.12,2.9])
box('Hall landing right wall',[1.39,1.55,8.95],[.18,3.10,2.9])
layout={'rooms':rooms,'routes':routes,'denCurve':{'departureZ':4.2,'arrivalZ':4.2},'geometry':parts}
(ROOT/'web/assets/house/layout.json').write_text(json.dumps(layout,indent=2)+'\n')
try:import bpy
except ImportError:raise SystemExit(0)
from mathutils import Matrix,Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for name,color in {'plaster':(.09,.14,.15,1),'wood':(.10,.055,.025,1),'rail':(.20,.18,.13,1),'dark':(.018,.022,.025,1),'cream':(.75,.68,.53,1),'ochre':(.54,.27,.04,1),'blue':(.035,.15,.27,1),'rust':(.38,.075,.035,1)}.items():
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
   planes=[((r['right'],0,0),(1,0,0)),((0,-r['back'],0),(0,1,0))] if name=='den' else [((0,-r['front'],0),(0,-1,0))]
   for plane,normal in planes:
    point=local_to_room.inverted()@Vector(plane);normal=local_to_room.to_3x3().transposed()@Vector(normal)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=point,plane_no=normal,clear_outer=True,dist=.0001)
   bm.to_mesh(o.data);bm.free()
for p in parts:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p['position'][0],-p['position'][2],p['position'][1]))
 o=bpy.context.object;o.name=p['name'];o.dimensions=(p['size'][0],p['size'][2],p['size'][1]);o.rotation_euler.z=p.get('rotation',0);o.rotation_euler.y=-p.get('slope',0);o.data.materials.append(materials[p['material']]);o['connector']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scene/house-connected.blend'),compress=True)
print('Saved connected house master.',flush=True)
