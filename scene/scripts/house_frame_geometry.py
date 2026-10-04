"""Authored joinery clearance: avoid visible coincident faces at openings."""
import re
from mathutils import Vector

REVISION=1
CLEARANCE=.01
HALLWAY_OPENINGS=('den','front','mudroom','stairs','bedroom-1','bedroom-2','kitchen','bath')

def bounds(obj):
 points=[obj.matrix_world@v.co for v in obj.data.vertices]
 return tuple(min(p[i] for p in points) for i in range(3)),tuple(max(p[i] for p in points) for i in range(3))

def reshape(obj,axis,low=None,high=None):
 """Change one box extent in world space, retaining its authored UVs."""
 obj.data=obj.data.copy();old_low,old_high=bounds(obj);inverse=obj.matrix_world.inverted()
 for vertex in obj.data.vertices:
  p=obj.matrix_world@vertex.co
  if low is not None and abs(p[axis]-old_low[axis])<1e-5:p[axis]=low
  if high is not None and abs(p[axis]-old_high[axis])<1e-5:p[axis]=high
  vertex.co=inverse@p
 obj.data.update();obj['frame_clearance_revision']=REVISION

def repair_frame_geometry(scene):
 objects={o.name:o for o in scene.objects if o.type=='MESH'};changed=[]
 for opening in HALLWAY_OPENINGS:
  head=objects.get('Finish / '+opening+' head')
  if not head or head.get('frame_clearance_revision')==REVISION:continue
  low,_=bounds(head);underside=low[2]-CLEARANCE
  reshape(head,2,low=underside);changed.append(head.name)
  for name,obj in objects.items():
   if re.fullmatch(r'Finish / '+opening+r' casing(?:\.\d+)?',name):
    reshape(obj,2,high=underside);changed.append(name)
 # The liners used to share their inside faces with the ceiling opening.
 liners=[objects.get('Finish / hatch liner'+suffix) for suffix in ['', '.001','.002','.003']]
 if all(liners):
  for index,obj in enumerate(liners):
   if obj.get('frame_clearance_revision')==REVISION:continue
   low,high=bounds(obj)
   if index==0:reshape(obj,0,high=high[0]+CLEARANCE)
   elif index==1:reshape(obj,0,low=low[0]-CLEARANCE)
   elif index==2:reshape(obj,1,low=low[1]-CLEARANCE)
   else:reshape(obj,1,high=high[1]+CLEARANCE)
   changed.append(obj.name)
  # Give the moving leaf clearance inside the newly proud liner faces.
  hatch=objects.get('Attic hatch')
  if hatch and hatch.get('frame_clearance_revision')!=REVISION:
   low,high=bounds(hatch)
   for axis in [0,1]:reshape(hatch,axis,low=low[axis]+.015,high=high[axis]-.015)
   changed.append(hatch.name)
 # Butt the horizontal casing into the vertical pieces instead of overlapping
 # their visible undersides at all four corners.
 left=objects.get('Finish / hatch casing');right=objects.get('Finish / hatch casing.001')
 if left and right:
  inner_left=bounds(left)[1][0];inner_right=bounds(right)[0][0]
  for suffix in ['.002','.003']:
   obj=objects.get('Finish / hatch casing'+suffix)
   if obj and obj.get('frame_clearance_revision')!=REVISION:
    reshape(obj,0,low=inner_left,high=inner_right);changed.append(obj.name)
 return changed

def restore_authored_frame_geometry(receiver,source):
 """The editable source owns repaired topology, not an older release GLB."""
 if source.get('frame_clearance_revision')!=REVISION:return False
 receiver.data=source.data.copy()
 receiver.data.transform(receiver.matrix_world.inverted()@source.matrix_world)
 receiver.data.update();receiver['frame_clearance_revision']=REVISION
 return True
