"""Rigid placements and edited geometry replace provisional room fitting scales."""
import json,re,math
from pathlib import Path
from mathutils import Matrix,Vector
from basement_model_refit import import_source,center
SPEC=json.loads((Path(__file__).resolve().parents[1]/'room-refit.json').read_text())
def refit_object(obj,source,sources,room):
 spec=SPEC[room];name=source.get('source_object',source.name);original=source.matrix_world.copy()
 placement=Matrix.Translation(Vector(spec['translation']))@Matrix.Rotation(spec['yaw'],4,'Z')
 world=placement@original;kind='rigid';edit=None
 if obj.get('preview_fitted_runner') or re.search(r'runner|fringe',name,re.I):
  edit=original.inverted()@Matrix.Diagonal((*spec['runner_scale'],1))@original;kind='tailored-runner'
 elif spec.get('architecture') and re.search(spec['architecture'],name):
  edit=original.inverted()@Matrix.Diagonal((*spec['architecture_scale'],1))@original;kind='framing'
 elif room=='hallway':
  p=center(source);station=next((a for a in spec['assemblies'] if re.search(a['names'],name)),None)
  references=[(a,next((o for o in sources if o.get('source_object',o.name)==a['reference']),None)) for a in spec['assemblies']]
  references=[(a,o) for a,o in references if o]
  if station is None:
   nearest=min(references,key=lambda pair:(center(pair[1])-p).length)
   if (center(nearest[1])-p).length<.65:station=nearest[0]
  reference=next((o for a,o in references if a is station),None);anchor=center(reference) if reference else p
  delta=Vector((anchor.x*(spec['old_scale'][0]-1),anchor.y*(spec['old_scale'][1]-1),0))
  delta=Matrix.Rotation(spec['yaw'],3,'Z')@delta
  if station and station.get('offset'):
   delta+=Vector(station['offset']);obj['preview_hall_refit']=True
  world=Matrix.Translation(delta)@world
 elif room=='workshop' and re.search(r'^(Garage offcuts box|Ordinary rumpled cloth)',name):world=Matrix.Translation((-.4,0,0))@world
 if room=='workshop':
  station=next((a for a in spec.get('assemblies',[]) if re.search(a['names'],name)),None)
  if station:
   world=Matrix.Translation(Vector(station['offset']))@world;obj['workshop_display_offset']=station['offset']
 # Retain the current source materials, while taking owned original geometry.
 materials=list(obj.data.materials);obj.data=source.data.copy();obj.data.materials.clear()
 for m in materials:obj.data.materials.append(m)
 if edit:obj.data.transform(edit);obj.data.update()
 obj.parent=None;obj.matrix_world=world;obj['model_refit']=room;obj['refit_kind']=kind;obj['refit_source']=name
 obj['source_object']=name
 return obj

def relocate_workshop_displays(scene):
 """Apply new assembly offsets to saved scenes without accumulating movement."""
 for obj in scene.objects:
  if obj.get('source_room')!='workshop' or obj.type!='MESH':continue
  name=obj.get('refit_source',obj.get('source_object',obj.name))
  station=next((a for a in SPEC['workshop']['assemblies'] if re.search(a['names'],name)),None)
  if not station:continue
  delta=Vector(station['offset'])-Vector(obj.get('workshop_display_offset',[0,0,0]))
  obj.matrix_world=Matrix.Translation(delta)@obj.matrix_world
  obj['workshop_display_offset']=station['offset']

def refit_room(objects,room):
 objects=[o for o in objects if o.type=='MESH']
 sources=[o.copy() for o in objects]
 for obj,source in zip(objects,sources):refit_object(obj,source,sources,room)
 return objects
