"""Bake the den using separate surface atlases and native-resolution artwork.
Run Blender -b scene/midnight-den-illustrated.blend --python scene/scripts/bake_den.py.
The original scene and projected plates are never overwritten.
"""
import bpy,json,re,sys
from pathlib import Path
from mathutils import Matrix,Vector
R=Path(__file__).resolve().parents[2];S=bpy.context.scene
out=R/'scene/renders/den-uv-bake';out.mkdir(parents=True,exist_ok=True)
roots=[o for o in S.objects if o.get('role') in {'draggable_cartridge','mobile_controller','controller_cable'}]
dynamic={o for root in roots for o in [root,*root.children_recursive]}
deps=bpy.context.evaluated_depsgraph_get();groups={};originals=list(S.objects);artwork={}
art_names={'rainy-garden.png':'window','woven-rug.jpg':'rug','crt-idle.png':'screen','after-hours.png':'poster'}
for o in originals:
 if o in dynamic or o.hide_render or o.type not in {'MESH','CURVE','FONT','SURFACE'}:continue
 mesh=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
 if not mesh.polygons:continue
 images={n.image for m in mesh.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
 image=next(iter(images),None)
 if len(images)>1:raise RuntimeError('Multiple source images need explicit allocation: '+o.name)
 if image:
  key=art_names[image.name];artwork[key]={'image':image.name,'resolution':list(image.size)}
 elif o.get('role')=='den_door':key='door'
 elif o.get('reactive'):key=o['reactive']
 else:key='architecture' if re.search(r'wall|floor|baseboard|window|curtain|ceiling|doorway',o.name,re.I) else 'furniture'
 obj=bpy.data.objects.new('UV '+o.name,mesh);S.collection.objects.link(obj);obj.matrix_world=o.matrix_world.copy();groups.setdefault(key,[]).append(obj)
 if not mesh.uv_layers:mesh.uv_layers.new(name='Source UV')
 mesh.uv_layers.active.name='Source UV'
 for mat in mesh.materials:
  if not mat or not mat.use_nodes:continue
  for node in list(mat.node_tree.nodes):
   if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:
    uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Source UV';mat.node_tree.links.new(uv.outputs['UV'],node.inputs['Vector'])
for o in originals:
 if o.type not in {'LIGHT','CAMERA'}:o.hide_render=True
exports={};images={};records={}
for key,pieces in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in pieces:o.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0]
 if len(pieces)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name='DEN UV '+key
 o['role']='crt_depth_surface' if key=='screen' else 'den_door' if key=='door' else 'reactive_prop' if key in {'mug','plant','lamp'} else 'room_geometry'
 o['den_baked']=True;o['den_atlas']=key
 if key in {'mug','plant','lamp'}:
  o['prop']=key;pivot={'mug':(1.66,-.03,1.119),'plant':(-1.67,.52,1.111),'lamp':(2.72,.67,1.202)}[key]
  o.data.transform(Matrix.Translation(-Vector(pivot))@o.matrix_world);o.matrix_world=Matrix.Translation(Vector(pivot))
 original_uv=[tuple(loop.uv) for loop in o.data.uv_layers.active.data]
 lighting=o.data.uv_layers.new(name='Lighting UV');o.data.uv_layers.active_index=len(o.data.uv_layers)-1;lighting.active_render=True
 if key in artwork:
  for loop,uv in zip(lighting.data,original_uv):loop.uv=uv
  resolution=artwork[key]['resolution'];o['den_native_artwork']=True
 else:
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004);bpy.ops.object.mode_set(mode='OBJECT')
  resolution=[4096,4096] if key in {'architecture','furniture'} else [2048,2048] if key in {'plant','lamp'} else [1024,1024]
 image=bpy.data.images.new('Den '+key+' lighting',*resolution,alpha=False,float_buffer=True);images[key]=image
 # Separate material instances prevent a shared material targeting another atlas.
 copies={}
 for i,mat in enumerate(o.data.materials):
  if mat not in copies:
   copy=mat.copy();copy.use_nodes=True;node=copy.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;copy.node_tree.nodes.active=node;copies[mat]=copy
  o.data.materials[i]=copies[mat]
 exports[key]=o;records[key]={'resolution':resolution,'sourceImage':artwork.get(key,{}).get('image'),'originalUVs':key in artwork,'denoised':key not in artwork}
S.render.engine='CYCLES';S.cycles.samples=64;S.cycles.max_bounces=8;S.cycles.diffuse_bounces=6;S.render.use_freestyle=False
S.render.bake.margin=12;S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True
S.render.bake.use_pass_glossy=False;S.render.bake.use_pass_transmission=False
bpy.ops.object.select_all(action='DESELECT')
for o in exports.values():o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(exports.values()))
print('DEN_ATLASES',json.dumps(records),flush=True)
if '--prepare-only' in sys.argv:
 print('DEN_PREPARE_COMPLETE',flush=True);sys.exit(0)
bpy.ops.object.bake(type='COMBINED')
# Denoise only surface atlases. Artwork bypasses the filter, preserving lettering
# and image details at their authored pixel dimensions and texture coordinates.
clean=bpy.data.scenes.new('Filter den atlases');clean.render.engine='CYCLES';clean.cycles.samples=1
camera=bpy.data.objects.new('Atlas camera',bpy.data.cameras.new('Atlas camera'));clean.collection.objects.link(camera);clean.camera=camera
clean.use_nodes=True;nodes=clean.node_tree.nodes;nodes.clear()
source=nodes.new('CompositorNodeImage');denoise=nodes.new('CompositorNodeDenoise');sink=nodes.new('CompositorNodeComposite')
clean.node_tree.links.new(source.outputs['Image'],denoise.inputs['Image'])
clean.view_settings.view_transform=S.view_settings.view_transform;clean.view_settings.look=S.view_settings.look;clean.view_settings.exposure=S.view_settings.exposure
clean.render.resolution_percentage=100;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB'
for key,image in images.items():
 image.filepath_raw=str(out/(key+'.exr'));image.file_format='OPEN_EXR';image.save()
 source.image=image
 clean.node_tree.links.new((source if key in artwork else denoise).outputs['Image'],sink.inputs['Image'])
 clean.render.resolution_x,clean.render.resolution_y=records[key]['resolution'];clean.render.filepath=str(out/(key+'.png'))
 bpy.ops.render.render(scene=clean.name,write_still=True)
bpy.data.scenes.remove(clean)
for key,o in exports.items():
 baked=bpy.data.materials.new('Den baked '+key);baked.use_nodes=True
 nodes=baked.node_tree.nodes;nodes.clear();tx=nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(out/(key+'.png')))
 em=nodes.new('ShaderNodeEmission');sink=nodes.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],sink.inputs[0])
 for uv in list(o.data.uv_layers):
  if uv.name!='Lighting UV':o.data.uv_layers.remove(uv)
 o.data.materials.clear();o.data.materials.append(baked)
 for p in o.data.polygons:p.material_index=0
for scene in bpy.data.scenes:
 for layer in scene.view_layers:
  for o in layer.objects:o.select_set(False,view_layer=layer)
for o in exports.values():o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'den-baked.glb'),use_selection=True,export_format='GLB',export_extras=True,export_image_format='AUTO')
(out/'report.json').write_text(json.dumps({'samples':64,'atlases':records,'cameraIndependent':True,'source':'midnight-den-illustrated.blend','freestyle':False},indent=2)+'\n')
print('DEN_BAKE_COMPLETE',flush=True)
