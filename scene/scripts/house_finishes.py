"""Light-cream ceiling paint and unobstructed garage window framing. No bake."""
import bpy,json,re
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
SPEC=json.loads((ROOT/'scene/house-finishes.json').read_text())
native=lambda v:Vector((v[0],-v[2],v[1]))
def apply_house_finishes(scene):
 from workshop_seating import apply_workshop_seating
 apply_workshop_seating(scene)
 from room_model_refit import relocate_workshop_displays
 relocate_workshop_displays(scene)
 from garage_plywood import PANELS,cut
 from basement_model_refit import import_source
 frame=SPEC['workshop_window_framing'];gap=frame['opening_clearance']
 bpy.context.view_layer.update()
 for o in list(scene.objects):
  name=o.get('refit_source',o.get('source_object',o.name))
  # Original rear studs own the wall; two are replaced by window king/jacks.
  if o.get('workshop_window_frame') or re.match(r'^Finish / garage rear stud(?:\.\d+)?$',name) or name in SPEC['superseded_workshop_studs']:bpy.data.objects.remove(o,do_unlink=True)
  elif o.type=='MESH' and re.match(r'^(Exposed garage wall stud|Side exposed stud|Finish / garage (side|rear) stud)',o.get('source_object',o.name)):
   points=[o.matrix_world@Vector(v) for v in o.bound_box]
   lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
   for _,_,_,_,hole,size in PANELS:
    # Expand in the wall plane to keep regular studs clear of the aperture.
    expanded=list(size)
    if size[0]>.7:expanded[0]+=2*gap
    else:expanded[2]+=2*gap
    expanded[1]+=2*gap
    c=native(hole);extent=Vector((expanded[0],expanded[2],expanded[1]))/2
    if all(hi[i]>c[i]-extent[i] and lo[i]<c[i]+extent[i] for i in range(3)):
     print('CLEAR_STUD',o.name,flush=True);cut(o,hole,expanded)
   o['workshop_opening_cut']=True
 imported=import_source(ROOT/'scene/exports/house/workshop.glb');bpy.context.view_layer.update()
 print('STUD_OPENINGS_CLEAR',flush=True)
 source=next(o for o in imported if o.get('source_object')=='Exposed garage wall stud');collection=bpy.data.collections.get('01 shell') or scene.collection
 pts=[source.matrix_world@Vector(v) for v in source.bound_box];lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
 for suffix,_,_,_,hole,size in PANELS:
  if suffix=='left':continue
  side=suffix=='right';p=list(hole);p[0 if side else 2]+=-.10 if side else .23
  width=size[2] if side else size[0];half=width/2+gap;low=hole[1]-size[1]/2-gap;high=hole[1]+size[1]/2+gap
  w=frame['stud_width'];members=[]
  for sign in [-1,1]:
   members.append((f'king {sign}',sign*(half+1.5*w),(frame['floor_y']+frame['top_y'])/2,w,frame['top_y']-frame['floor_y']))
   members.append((f'jack {sign}',sign*(half+.5*w),(frame['floor_y']+high)/2,w,high-frame['floor_y']))
  members.extend([('header',0,high+frame['header_height']/2,(half+w)*2,frame['header_height']),('sill',0,low-w/2,half*2,w)])
  for name,u,y,width,height in members:
   center=list(p);center[2 if side else 0]+=u;center[1]=y;dims=[frame['depth'],height,width] if side else [width,height,frame['depth']]
   ratio=Vector((dims[0],dims[2],dims[1]));ratio=Vector(tuple(ratio[i]/(hi[i]-lo[i]) for i in range(3)))
   mesh=source.data.copy();mesh.transform(Matrix.Translation(native(center))@Matrix.Diagonal((*ratio,1))@Matrix.Translation(-(lo+hi)/2)@source.matrix_world)
   obj=bpy.data.objects.new(f'Workshop plywood {suffix} window {name}',mesh);collection.objects.link(obj);obj['workshop_window_frame']=True;obj['window']='Workshop plywood '+suffix;obj['release_room']='structure';obj['preview_kind']='shell'
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 material=bpy.data.materials.get(SPEC['ceiling']['name']) or bpy.data.materials.new(SPEC['ceiling']['name']);material.use_nodes=True
 color=(*SPEC['ceiling']['linear_rgb'],1);material.diffuse_color=color;p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=SPEC['ceiling']['roughness']
 painted=0
 for o in scene.objects:
  name=o.get('source_object',o.name)
  if o.type!='MESH' or not re.search(r'ceiling|Main pitched roof|Garage pitched roof|^Attic hatch$',name,re.I) or re.search(r'light|lamp|canopy|fixture|stem',name,re.I):continue
  o.data=o.data.copy();index=next((i for i,m in enumerate(o.data.materials) if m==material),None)
  if index is None:index=len(o.data.materials);o.data.materials.append(material)
  split=bool(re.search(r'floor / hall ceiling|pitched roof',name,re.I));normal=o.matrix_world.to_3x3().inverted().transposed()
  for poly in o.data.polygons:
   if not split or (normal@poly.normal).normalized().z<-.5:poly.material_index=index;painted+=1
  o['ceiling_paint']='light cream'
 scene['ceiling_paint']='light cream';bpy.context.view_layer.update()
 print('HOUSE_FINISHES',painted,'cream faces; 12 window-framing pieces',flush=True)
