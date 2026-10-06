"""Build a separate editable Blender proposal. Never writes production assets.
blender -b --factory-startup --python scene/scripts/build_house_preview.py
"""
import bpy,sys,math,json,time,re
from pathlib import Path
from mathutils import Matrix,Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from house_preview_spec import build_spec,ROOT
started=time.monotonic();spec=build_spec();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
palette={'wall':(.43,.54,.58,1),'floor':(.26,.31,.32,1),'wood':(.36,.22,.12,1),'door':(.53,.32,.16,1),'roof':(.22,.30,.36,1),'ground':(.17,.26,.19,1),'trees':(.10,.21,.14,1),'proxy':(.48,.38,.25,1)}
materials={}
for n,c in palette.items():
 m=bpy.data.materials.new('Preview / '+n);m.diffuse_color=c;materials[n]=m
collections={}
def coll(name):
 if name not in collections:
  c=bpy.data.collections.new(name);scene.collection.children.link(c);collections[name]=c
 return collections[name]
def native(p):return Vector((p[0],-p[2],p[1]))
def cube(part):
 name=part['name'];mesh=bpy.data.meshes.new(name);mesh.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);mesh.update()
 o=bpy.data.objects.new(name,mesh);coll('01 '+part['kind']).objects.link(o);o.location=native(part['center']);x,y,z=part['size'];o.scale=(x,z,y);o.rotation_euler.y=-part.get('slope',0);o.data.materials.append(materials[part['material']]);o['preview_kind']=part['kind']
 if 'door_id'in part:o['door_id']=part['door_id']
 if part['kind']=='ladder':o.hide_render=True;o.hide_set(True)
 return o
for part in spec['parts']:cube(part)
# Rear/front triangular gables with genuine central window holes.
for z in [0,12]:
 def roof_y(x):return 7.3-abs(x-6)*4.5/6
 for x,X,lo,hi in [(0,5.3,2.8,None),(6.7,12,2.8,None),(5.3,6.7,2.8,3.6),(5.3,6,4.5,None),(6,6.7,4.5,None)]:
  yl=min(roof_y(x),hi)if hi else roof_y(x);yr=min(roof_y(X),hi)if hi else roof_y(X)
  if max(yl,yr)<=lo:continue
  vertices=[tuple(native(p))for p in [(x,lo,z),(X,lo,z),(X,yr,z),(x,yl,z)]]
  mesh=bpy.data.meshes.new('Gable infill');mesh.from_pydata(vertices,[],[(0,1,2,3)]);mesh.update();o=bpy.data.objects.new('Gable infill / window',mesh);coll('01 roof').objects.link(o);mesh.materials.append(materials['wall']);o['preview_kind']='roof'
# Append existing editable contents, replacing the old disconnected envelopes.
# Furniture keeps its authored proportions; edit framing and use rigid room placements.
structural=re.compile(r'floorboard|floor cavity|poured concrete|concrete slab|basement ceiling|masonry|painted masonry|corridor wall|corridor ceiling|far wall|wall beside|wall above|back wall|left wall|right wall|front wall|ceiling|sheathing|roof|rafter|purlin|collar tie|ridge beam|rough support|knee brace|floor joist|fiberglass|window|outside|rain|cornice|skirting|baseboard|door|jamb|threshold|hatch|cord pull|conduit|expansion joint|slab crack|drawn wall hatch|deep sill|attic pull-down string|old concrete block',re.I)
sources=[('workshop','exports/house/workshop.glb',(14.5,-1.31,-.15),(1,1,1),0),('basement','exports/house/basement.glb',(6,-3.06,-4),(1,1,1),0),('attic','exports/house/attic.glb',(6,-6,2.8),(1,1,1),0),('den','midnight-den-illustrated.blend',(-.208,-9.4,0),(1,1,1),math.pi/2),('hallway','exports/house/hallway.glb',(8.9,-7.55,0),(1,1,1),math.pi/2)]
report={}
for room,filename,translation,scale,angle in sources:
 path=ROOT/'scene'/filename
 if path.suffix=='.glb':
  from basement_model_refit import import_source
  loaded=import_source(path)
 else:
  with bpy.data.libraries.load(str(path),link=False)as(src,dst):dst.objects=list(src.objects)
  loaded=[o for o in dst.objects if o]
 collection=coll('02 Existing contents / '+room)
 bpy.context.view_layer.update();keep=[];removed=[]
 # Link before evaluating matrices so parent hierarchies update correctly.
 for o in loaded:
  for old_collection in list(o.users_collection):old_collection.objects.unlink(o)
  collection.objects.link(o)
 bpy.context.view_layer.update()
 transform=Matrix.Translation(Vector(translation))@Matrix.Rotation(angle,4,'Z')@Matrix.Diagonal((*scale,1))
 if room in ['hallway','workshop','attic']:
  from room_model_refit import refit_room
  refit_room(loaded,room);transform=Matrix.Identity(4);bpy.context.view_layer.update()
 if room=='den':
  text_objects=[o for o in loaded if o.type in {'FONT','CURVE'}]
  if text_objects:
   bpy.ops.object.select_all(action='DESELECT')
   for o in text_objects:o.hide_set(False);o.select_set(True)
   bpy.context.view_layer.objects.active=text_objects[0];bpy.ops.object.convert(target='MESH')
  den_poses={o:o.matrix_world.copy() for o in loaded}
  for o in loaded:
   if hasattr(o.data,'transform'):o.data=o.data.copy();o.data.transform(Matrix.Scale(.55,4))
   m=den_poses[o];m.translation*=.55;o.parent=None;o.matrix_world=m;o['model_refit']='den';o['refit_kind']='uniform-unit-conversion';o['den_geometry_units']=True
 if room=='basement':
  from basement_model_refit import refit
  for o in loaded:o['source_object']=o.get('source_object',o.name)
  refit(loaded,translation=False);bpy.context.view_layer.update()
 poses={o:transform@o.matrix_world.copy()for o in loaded}
 names={}
 for o in loaded:
  chain=[];parent=o
  while parent is not None:chain.append(parent.name);parent=parent.parent
  names[o]=' '.join(chain).replace('_',' ')
 for o in loaded:
  den_window=room=='den' and o.name.startswith(('Window outer jamb','Window lintel','Window sill','Window mullion','Window transom'))
  if o.type not in {'MESH','CURVE','FONT'}or(structural.search(names[o]) and not den_window):removed.append(o.name);continue
  # Keep native room decoration; omit the old runner which crosses new junctions.
  if room=='hallway' and re.search(r'runner|shoe|umbrella|tote|parcel|coat|hanger|hook|boot|lamp|pendant|opal|canopy|bulb|light|brass shade|jacket|future lock',names[o],re.I):removed.append(o.name);continue
  if room=='workshop' and re.match(r'^(Printed worn T-shirt|PR2 cartridge screenprint|T-shirt collar)',o.name):removed.append(o.name);continue
  o.parent=None;o.matrix_world=poses[o];o['preview_kind']='contents';o['source_room']=room;o['source_object']=o.get('source_object',o.name)
  # Fast clay shading: no images, procedural graphs, or detail modifiers.
  original=o.data.materials[0]if o.data.materials else None
  color=original.diffuse_color if original else(.55,.48,.38,1)
  if original and original.use_nodes:
   shader=next((n for n in original.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
   if shader:color=shader.inputs['Base Color'].default_value
  key=tuple(round(float(v)*8)/8 for v in color[:3])
  name='Clay '+str(key)
  mat=bpy.data.materials.get(name)
  if mat is None:mat=bpy.data.materials.new(name);mat.diffuse_color=(*key,1)
  if hasattr(o.data,'materials'):o.data.materials.clear();o.data.materials.append(mat)
  for mod in list(o.modifiers):o.modifiers.remove(mod)
  keep.append(o)
 for o in loaded:
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
 report[room]={'source':filename,'objects':len(keep),'removed_envelope_objects':len(removed),'staging_scale':scale}
 print('CONTENTS',room,len(keep),flush=True)
from garage_plywood import add_plywood_and_den_infill
add_plywood_and_den_infill(scene)
scene['rooms_rigid_refit']=True
scene['original_basement_height_restored']=True
# Cameras and editable route polylines are exported from the saved Blender file.
for name,v in spec['views'].items():
 data=bpy.data.cameras.new(name);o=bpy.data.objects.new('View / '+name,data);coll('03 Cameras').objects.link(o);o.location=native(v['position']);o.rotation_euler=(native(v['target'])-o.location).to_track_quat('-Z','Y').to_euler();data.type='PERSP';data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=12/math.tan(math.radians(spec['fov']/2));o['view_id']=name;o['preview_fov']=spec['fov']
 if name=='hub':scene.camera=o
for name,points in spec['routes'].items():
 data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';sp=data.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*native(co),1)
 o=bpy.data.objects.new('Route / '+name,data);coll('04 Editable camera routes').objects.link(o);o['route_id']=name;o.hide_render=True
for name,point in spec['hub_targets'].items():
 o=bpy.data.objects.new('Target / '+name,None);coll('05 Visibility targets').objects.link(o);o.location=native(point);o.empty_display_size=.12;o.empty_display_type='SPHERE';o['target_id']=name
scene['preview_source_report']=json.dumps(report);scene['preview_revision']=spec['revision'];scene['preview_note']='Rigid room placements and edited architecture. Edit mesh, view cameras and route curves, save, then fast-export.'
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.2,.2,.2)
# Open the native assembly in the shared hub camera.
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='SOLID';area.spaces.active.shading.color_type='MATERIAL'
from house_finishes import apply_house_finishes
apply_house_finishes(bpy.context.scene)
path=ROOT/'scene/house-release.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
print(f'Saved {path} in {time.monotonic()-started:.1f}s',flush=True)
from export_house_preview import export_preview
export_preview()
