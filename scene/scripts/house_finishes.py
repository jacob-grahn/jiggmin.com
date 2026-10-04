"""Light-cream ceiling paint and unobstructed garage window framing. No bake."""
import bpy,json,re
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
SPEC=json.loads((ROOT/'scene/house-finishes.json').read_text())
native=lambda v:Vector((v[0],-v[2],v[1]))
def apply_house_finishes(scene):
 from house_frame_geometry import repair_frame_geometry
 repair_frame_geometry(scene)
 from house_wall_uv import apply_wall_uv
 apply_wall_uv(scene)
 from hall_window_finish import smooth_hall_window
 smooth_hall_window(scene)
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
 paint_door_frames(scene)
 painted=paint_ceiling_undersides(scene)
 from house_slab_ownership import split_slab_surfaces
 split_slab_surfaces(scene)
 from house_source_uv import apply_source_uv
 apply_source_uv(scene)
 scene['ceiling_paint']='light cream';bpy.context.view_layer.update()
 print('HOUSE_FINISHES',painted,'cream faces; 12 window-framing pieces',flush=True)

def paint_ceiling_undersides(scene):
 """Paint the authored ceilings; keep the cellar's timber slab undersides."""
 restore_cellar_slab_finish(scene)
 material=bpy.data.materials.get(SPEC['ceiling']['name']) or bpy.data.materials.new(SPEC['ceiling']['name']);material.use_nodes=True
 color=(*SPEC['ceiling']['linear_rgb'],1);material.diffuse_color=color;p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=SPEC['ceiling']['roughness']
 painted=0
 for o in scene.objects:
  name=o.get('source_object',o.name)
  if name.startswith(('Cellar slab underside / ','Attic slab upper / ')):continue
  if o.type!='MESH' or not re.search(r'ceiling|Main pitched roof|Garage pitched roof|^Attic hatch$',name,re.I) or re.search(r'light|lamp|canopy|fixture|stem',name,re.I):continue
  o.data=o.data.copy();index=next((i for i,m in enumerate(o.data.materials) if m==material),None)
  if index is None:index=len(o.data.materials);o.data.materials.append(material)
  split=bool(re.search(r'floor / hall ceiling|pitched roof',name,re.I));normal=o.matrix_world.to_3x3().inverted().transposed()
  for poly in o.data.polygons:
   if not split or (normal@poly.normal).normalized().z<-.5:poly.material_index=index;painted+=1
  o['ceiling_paint']='light cream'
 return painted

def restore_cellar_slab_finish(scene):
 """Undo the accidental cream repaint using the retained original oak slot."""
 restored=[]
 for obj in scene.objects:
  if obj.type!='MESH' or not re.match(r'^Main floor(?:\.|$)',obj.get('source_object',obj.name)):continue
  oak=next((i for i,m in enumerate(obj.data.materials) if m and not m.name.startswith(SPEC['ceiling']['name'])),None)
  if oak is None:raise RuntimeError('Missing original cellar slab oak: '+obj.name)
  if not any(p.material_index!=oak for p in obj.data.polygons):continue
  obj.data=obj.data.copy()
  for poly in obj.data.polygons:poly.material_index=oak
  if 'ceiling_paint' in obj:del obj['ceiling_paint']
  restored.append(obj.name)
 return restored


def paint_door_frames(scene):
 """White paint on hallway doorway/hatch frames; preserve the timber normal."""
 spec=SPEC['door_frames'];names='|'.join(re.escape(n) for n in spec['openings'])
 pattern=re.compile(r'^Finish / ('+names+r') (casing|head|jamb|liner)(?:\.\d+)?$')
 cache={};painted=[]
 for obj in scene.objects:
  if obj.type!='MESH' or not pattern.match(obj.get('source_object',obj.name)):continue
  obj.data=obj.data.copy()
  for i,source in enumerate(obj.data.materials):
   if source not in cache:
    material=source if source.get('white_door_frame') else source.copy()
    material.name=spec['name']+' / '+source.name if not source.get('white_door_frame') else material.name
    material['white_door_frame']=True;material.use_nodes=True
    shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for socket,value in [('Base Color',(*spec['linear_rgb'],1)),('Roughness',spec['roughness']),('Metallic',0)]:
     for link in list(shader.inputs[socket].links):material.node_tree.links.remove(link)
     shader.inputs[socket].default_value=value
    material.diffuse_color=(*spec['linear_rgb'],1);cache[source]=material
   obj.data.materials[i]=cache[source]
  obj['door_frame_finish']='white painted timber';painted.append(obj.name)
 return painted
