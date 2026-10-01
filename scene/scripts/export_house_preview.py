"""Fast export of the saved preview .blend. Merged meshes, optional retained den materials, and no lighting bake.
blender -b scene/house-plan-preview.blend --python scene/scripts/export_house_preview.py
"""
import bpy,json,time,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'scene/preview/generated'
def runtime(v):return [v.x,v.z,-v.y]
def preview_material(source):
 # The illustrated source routes shading through emission/mix nodes that glTF
 # cannot represent. Keep its base colors and image artwork in a PBR material.
 m=bpy.data.materials.new('Preview PBR / '+source.name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 shader=next((n for n in source.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if source.use_nodes else None
 if shader:
  for key in ['Base Color','Roughness','Metallic','Alpha']:
   p.inputs[key].default_value=shader.inputs[key].default_value
 else:p.inputs['Base Color'].default_value=source.diffuse_color
 texture=next((n for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None) if source.use_nodes else None
 if texture:
  node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=texture.image;m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
  if 'Phosphor' in source.name:m.node_tree.links.new(node.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.8
 if source.name.startswith(('Lamp glow','Amber LED')):p.inputs['Emission Color'].default_value=p.inputs['Base Color'].default_value;p.inputs['Emission Strength'].default_value=1
 m.diffuse_color=p.inputs['Base Color'].default_value
 return m

def export_preview():
 start=time.monotonic();OUT.mkdir(parents=True,exist_ok=True);original=bpy.context.scene
 meta={'views':{},'routes':{},'hub_targets':{},'revision':original.get('preview_revision',2),'source_report':json.loads(original.get('preview_source_report','{}')),'fov':50,'aspect':1.6,'lights':[]}
 for o in original.objects:
  if o.get('preview_light') and o.type=='LIGHT':meta['lights'].append({'position':runtime(o.matrix_world.translation),'color':list(o.data.color),'intensity':o.data.energy*.006})
  if 'view_id'in o:
   m=o.matrix_world;meta['views'][o['view_id']]={'position':runtime(m.translation),'target':runtime(m.translation+m.to_quaternion()@Vector((0,0,-5))),'fov':math.degrees(o.data.angle_y)}
  if 'route_id'in o:
   sp=o.data.splines[0];points=sp.bezier_points if sp.type=='BEZIER'else sp.points
   meta['routes'][o['route_id']]=[runtime(o.matrix_world@Vector(p.co[:3]))for p in points]
  if 'target_id'in o:meta['hub_targets'][o['target_id']]=runtime(o.matrix_world.translation)
 # Merge clay meshes by category/color; keep doors separate for automatic travel opening.
 deps=bpy.context.evaluated_depsgraph_get();buckets={};triangles=0
 for o in original.objects:
  kind=o.get('preview_kind')
  if not kind or o.type not in {'MESH','CURVE','FONT'}:continue
  evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
  if not mesh:continue
  color=tuple(o.data.materials[0].diffuse_color)if len(o.data.materials)else(.5,.5,.5,1)
  source_material=o.data.materials[0] if o.get('preview_preserve_material') and len(o.data.materials) else None
  key=(kind,o.get('door_id',''),o.get('source_room',''),color,source_material.name if source_material else '',o.get('ladder_section',-1))
  bucket=buckets.setdefault(key,{'v':[],'f':[],'uv':[]});offset=len(bucket['v']);m=o.matrix_world
  bucket['v'].extend([tuple(m@v.co)for v in mesh.vertices]);bucket['f'].extend([tuple(offset+i for i in f.vertices)for f in mesh.polygons]);triangles+=sum(max(0,len(f.vertices)-2)for f in mesh.polygons)
  uv=mesh.uv_layers.active
  bucket['uv'].extend([tuple(uv.data[i].uv) if uv else (0,0) for f in mesh.polygons for i in f.loop_indices]);evaluated.to_mesh_clear()
 export_scene=bpy.data.scenes.new('Temporary fast export');objects=[];retained={}
 for (kind,door,room,color,source_material,section),b in buckets.items():
  mesh=bpy.data.meshes.new('preview mesh');mesh.from_pydata(b['v'],[],b['f']);mesh.update();o=bpy.data.objects.new(f'{kind} {door or room}',mesh);export_scene.collection.objects.link(o);o['preview_kind']=kind
  if door:o['door_id']=door
  if room:o['source_room']=room
  if section>=0:o['ladder_section']=section
  if source_material:
   uv=mesh.uv_layers.new(name='UVMap')
   for entry,co in zip(uv.data,b['uv']):entry.uv=co
  mat=bpy.data.materials.new('Flat preview');mat.diffuse_color=color;mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=color[3];
  if kind=='fixture':mat.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=color;mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.65
  if source_material and source_material not in retained:retained[source_material]=preview_material(bpy.data.materials[source_material])
  mesh.materials.append(retained[source_material] if source_material else mat);objects.append(o)
 try:
  bpy.context.window.scene=export_scene
  bpy.ops.export_scene.gltf(filepath=str(OUT/'house-pending.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True,export_apply=False,export_materials='EXPORT',export_animations=False,use_active_scene=True)
 finally:
  bpy.context.window.scene=original
  for o in objects:bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.scenes.remove(export_scene)
 (OUT/'house-pending.glb').replace(OUT/'house.glb')
 meta['export']={'seconds':round(time.monotonic()-start,2),'triangles':triangles,'mesh_batches':len(buckets),'bytes':(OUT/'house.glb').stat().st_size}
 (OUT/'preview-pending.json').write_text(json.dumps(meta,indent=2)+'\n');(OUT/'preview-pending.json').replace(OUT/'preview.json');print('FAST PREVIEW',meta['export'],flush=True)
if __name__=='__main__':export_preview()
