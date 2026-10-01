"""Resize the basement envelope as geometry and move original-size assemblies."""
import json,re,struct,tempfile
from pathlib import Path
from mathutils import Matrix,Vector
def import_source(path):
 import bpy
 # Preserve identities when other rooms already use the same Blender names.
 data=Path(path).read_bytes();length=struct.unpack_from('<I',data,12)[0]
 document=json.loads(data[20:20+length])
 for node in document.get('nodes',[]):node.setdefault('extras',{})['source_object']=node.get('name','')
 raw=json.dumps(document,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
 binary=data[20+length:];result=struct.pack('<III',0x46546c67,2,20+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+binary
 before=set(bpy.data.objects)
 with tempfile.TemporaryDirectory(prefix='basement-refit-') as directory:
  target=Path(directory)/'source.glb';target.write_bytes(result);bpy.ops.import_scene.gltf(filepath=str(target))
 return list(set(bpy.data.objects)-before)
SPEC=json.loads((Path(__file__).resolve().parents[1]/'basement-refit.json').read_text())
def center(obj):
 points=[obj.matrix_world@Vector(p) for p in obj.bound_box]
 return Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
def refit(objects,translation=True):
 objects=[o for o in objects if o.type=='MESH']
 centers={o:center(o) for o in objects};matrices={o:o.matrix_world.copy() for o in objects}
 windows=[centers[o] for o in objects if o.get('source_object',o.name).startswith('Garden beyond window')]
 envelope=Matrix.Diagonal((*SPEC['envelope'],1));placement=Matrix.Translation(Vector(SPEC['translation'])) if translation else Matrix.Identity(4)
 for obj in objects:
  name=obj.get('source_object',obj.name);p=centers[obj];original=matrices[obj]
  architectural=bool(re.match(SPEC['architecture'],name));anchor=None
  if re.match(r'^(Garden beyond window|Window (jamb|rail|cross|transom)|Deep sill)',name):anchor=min(windows,key=lambda w:(Vector(p[:2])-Vector(w[:2])).length)
  if anchor is None:
   station=next((a for a in SPEC['assemblies'] if re.search(a['names'],name)),None)
   if station is None:station=next((a for a in SPEC['assemblies'] if a.get('region') and all(a['region'][i*2]<=p[i]<=a['region'][i*2+1] for i in range(3))),None)
   anchor=station['anchor'] if station else p
  delta=Vector((anchor[0]*(SPEC['envelope'][0]-1),anchor[1]*(SPEC['envelope'][1]-1),0))
  world=Matrix.Translation(delta)@original
  if architectural:
   obj.data=obj.data.copy();obj.data.transform(world.inverted()@envelope@original);obj.data.update()
  obj.parent=None;obj.matrix_world=placement@world;obj['basement_model_refit']=True
  obj['refit_assembly']='envelope' if architectural else ','.join(str(v) for v in anchor[:2])
 # Keep actual openings in the editable envelope, too. Runtime publication
 # performs the same stair cut and derives window openings from these planes.
 import bpy
 def cut(obj,position,size):
  bpy.ops.mesh.primitive_cube_add(size=1,location=position);tool=bpy.context.object;tool.dimensions=size
  bpy.context.view_layer.update();modifier=obj.modifiers.new('Refit opening','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=tool
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(tool,do_unlink=True)
 for obj in objects:
  name=obj.get('source_object',obj.name)
  if name=='Basement ceiling':
   position=Vector((10.55,-10.45,-.2))
   if not translation:position-=Vector(SPEC['translation'])
   cut(obj,position,(2.6,2.8,5))
  elif name.startswith('Basement painted masonry'):
   for window in [o for o in objects if o.get('source_object',o.name).startswith('Garden beyond window')]:
    points=[window.matrix_world@Vector(v) for v in window.bound_box]
    size=Vector(tuple(max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)));position=center(window)
    normal=0 if size.x<size.y else 1
    if abs(center(obj)[normal]-position[normal])>.3:continue
    size[normal]=.7;size.z=max(.1,size.z-.015);cut(obj,position,size)
 return objects
