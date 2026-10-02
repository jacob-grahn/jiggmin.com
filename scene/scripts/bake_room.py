"""Bake camera-independent diffuse lighting onto the room's static surfaces.
Use the room-specific preparation and bake entry points. Original assets are untouched.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[2]
EXPORTS=R/'scene/exports/house';EXPORTS.mkdir(parents=True,exist_ok=True)
room=globals().get('ROOM','hallway')
if room not in {'hallway','basement','attic','workshop'}:raise ValueError('Unsupported bake room')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/{room}-bake-input.glb')
S=bpy.context.scene;originals=list(S.objects)
ceiling_lights_on='--ceiling-lights-on' in sys.argv
# The browser removes the old ceiling and builds these connecting surfaces instead.
for o in list(originals) if room=='hallway' else []:
 if 'Corridor ceiling' in o.name.replace('_',' ') or o.name.replace('_',' ') in {'Brass shade','Opal lamp','Lamp stem'}:
  originals.remove(o);bpy.data.objects.remove(o,do_unlink=True)
layout=json.loads((R/'web/assets/house/layout.json').read_text())
connection_names=[]
for i,part in enumerate(layout['geometry'] if room in {'hallway','basement'} else []):
 name=part['name']
 if room=='hallway' and not name.startswith(('Hall ceiling','Hall landing','Den shared wall extension')):continue
 if room=='basement' and not name.startswith('Basement stair'):continue
 bpy.ops.mesh.primitive_cube_add(size=1)
 o=bpy.context.object;o.name=name+' UV';x,y,z=part['position'];sx,sy,sz=part['size'];o.location=(x,-z,y);o.dimensions=(sx,sz,sy);o.rotation_euler.z=part.get('rotation',0);o.rotation_euler.y=-part.get('slope',0)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 color={'plaster':(.061,.1,.093,1),'wood':(.067,.029,.013,1),'rail':(.22,.20,.13,1),'dark':(.018,.022,.025,1),'cream':(.75,.68,.53,1),'ochre':(.54,.27,.04,1),'blue':(.035,.15,.27,1),'rust':(.38,.075,.035,1)}[part['material']]
 if 'ceiling' in name.lower():color=(.82,.76,.63,1)
 mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
 mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95
 o.data.materials.append(mat)
 if room=='basement':
  spec=layout['rooms'][room];x,y,z=spec['position']
  transform=Matrix.Translation((x,-z,y))@Matrix.Rotation(spec['yaw'],4,'Z')
  bpy.context.view_layer.update();o.matrix_world=transform.inverted()@o.matrix_world
  bevel=o.modifiers.new('Soft finished edges','BEVEL');bevel.width=.008;bevel.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
 o['bake_static']=True;o['bake_connection']=True;originals.append(o);connection_names.append(name)
# Respect the runtime classification even for glTF multi-material child meshes.
def fixed(o):
 p=o
 while p:
  if 'bake_static' in p:return bool(p['bake_static'])
  p=p.parent
 return False
static=[];fixtures=[]
for o in originals:
 if o.type!='MESH':continue
 mats=[m for m in o.data.materials if m]
 glow=any(m.name.lower().startswith('glow') for m in mats)
 exterior=any('exterior' in m.name.lower() for m in mats)
 if glow:fixtures.append(o)
 if o.get('hotspot')=='door-attic':o['bake_static']=False
 if fixed(o) and not glow and not exterior and not any(m.surface_render_method=='BLENDED' for m in mats):static.append(o)
print('STATIC',len(static),'FIXTURES',len(fixtures),flush=True)
# Unlit opal bulbs retain their geometry but must not trigger the browser's
# glow-material practical lights or emission boost.
for o in fixtures:
 o['ceiling_fixture']=True
 if not ceiling_lights_on:
  off=bpy.data.materials.new('Opal ceiling light switched off');off.use_nodes=True
  bsdf=off.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.65,.62,.56,1);bsdf.inputs['Roughness'].default_value=.65
  o.data.materials.clear();o.data.materials.append(off)
  for poly in o.data.polygons:poly.material_index=0
# Sloped attic roof surfaces need their own atlas just as flat ceilings do.
def ceiling_surface(o):
 name=o.name.lower().replace('_',' ')
 return 'ceiling' in name or (room=='attic' and ('pitched unfinished roof' in name or 'exposed roof rafter' in name))
# Preserve the source UV coordinates used by base colors and normal maps.
bake_materials={}
for o in static:
 for i,m in enumerate(o.data.materials):
  key=(m,ceiling_surface(o))
  if key not in bake_materials:bake_materials[key]=m.copy()
  o.data.materials[i]=bake_materials[key]
 if not o.data.uv_layers:o.data.uv_layers.new(name='Source UV')
 o.data.uv_layers.active.name='Source UV'
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  for node in list(m.node_tree.nodes):
   if node.type=='UVMAP':node.uv_map='Source UV'
   if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:
    uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Source UV';m.node_tree.links.new(uv.outputs['UV'],node.inputs['Vector'])
# Combine only a temporary bake mesh, preserving original objects for picking and physics.
bpy.context.view_layer.update();vertices=[];faces=[];uvs=[];material_indices=[];smooth=[];materials=[];offsets={}
for o in static:
 mesh=o.data;start=len(uvs);vertex_offset=len(vertices)
 vertices.extend(tuple(o.matrix_world@v.co) for v in mesh.vertices)
 slots=[]
 for m in mesh.materials:
  if m not in materials:materials.append(m)
  slots.append(materials.index(m))
 for p in mesh.polygons:
  smooth.append(p.use_smooth);faces.append(tuple(vertex_offset+v for v in p.vertices));material_indices.append(slots[p.material_index])
  uvs.extend(tuple(mesh.uv_layers.active.data[li].uv) for li in p.loop_indices)
 offsets[o]=(start,len(uvs))
mesh=bpy.data.meshes.new('Room bake atlas');mesh.from_pydata(vertices,[],faces);mesh.update()
for m in materials:mesh.materials.append(m)
for poly,index in zip(mesh.polygons,material_indices):poly.material_index=index
for poly,value in zip(mesh.polygons,smooth):poly.use_smooth=value
source_uv=mesh.uv_layers.new(name='Source UV')
for loop,uv in zip(source_uv.data,uvs):loop.uv=uv
atlas_uv=mesh.uv_layers.new(name='Lighting UV');mesh.uv_layers.active_index=1;atlas_uv.active_render=True
helper=bpy.data.objects.new('Temporary bake mesh',mesh);S.collection.objects.link(helper)
bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
# Give the ceiling its own atlas rather than sharing texels with hundreds of props.
ceiling_materials={m for o in static if ceiling_surface(o) for m in o.data.materials}
ceiling_indices={i for i,m in enumerate(materials) if m in ceiling_materials}
for ceiling in [False,True]:
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_mode(type='FACE');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
 for poly in mesh.polygons:poly.select=(poly.material_index in ceiling_indices)==ceiling
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.003);bpy.ops.object.mode_set(mode='OBJECT')
atlas_uv=mesh.uv_layers['Lighting UV']
print('ATLAS_UV',[(v.name,tuple(v.data[0].uv)) for v in mesh.uv_layers],flush=True)
for o in originals:
 if o.type=='MESH':o.hide_render=True
# Use physically rendered window spill and warm practicals, with diffuse bounce.
for o in list(S.objects):
 if o.type=='LIGHT':o.hide_render=True
world=bpy.data.worlds.new('Room soft night');world.use_nodes=True;S.world=world
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.24,.22,.19,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.10
bake_lights=[]
def area(name,location,target,power,color,size):
 light=bpy.data.lights.new(name,'AREA');light.energy=power;light.color=color;light.shape='DISK';light.size=size
 o=bpy.data.objects.new(name,light);S.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();bake_lights.append(o)
if room=='hallway':
 area('Near window spill',(1.12,-3.7,1.9),(-1,-1.5,.8),180,(.13,.34,1),1.5)
 area('Far window spill',(1.1,2.55,1.92),(-1,3,.8),145,(.13,.34,1),1.5)
elif room=='basement':
 area('Cellar left window spill',(-2.2,3.0,2.95),(-1,0,.8),180,(.24,.48,1),1.3)
 area('Cellar right window spill',(2.2,3.0,2.95),(1,0,.8),145,(.24,.48,1),1.3)
 area('Cellar side window spill',(-4.6,-1.1,2.95),(-1,-1,.8),150,(.24,.48,1),1.3)
 # Hallway moonlight enters from behind the descending viewer.
 spec=layout['rooms'][room];x,y,z=spec['position']
 inverse=(Matrix.Translation((x,-z,y))@Matrix.Rotation(spec['yaw'],4,'Z')).inverted()
 area('Hallway blue stair spill',inverse@Vector((-1.50,3.2,2.15)),inverse@Vector((-5.2,3.2,-1.3)),320,(.14,.36,1),1.0)
elif room=='workshop':
 area('Bench window spill',(-.6,1.18,2.65),(-.3,-.8,1.0),155,(.24,.48,1),1.1)
 area('Side window spill',(-2.55,.2,2.05),(0,.1,1.0),190,(.24,.48,1),1.1)
 if ceiling_lights_on:area('Warm task lamp',(-1.72,.72,1.81),(-.55,.45,.98),65,(1,.38,.12),.55)
else:
 area('Gable moonlight spill',(0,4.04,2.02),(-.4,.3,.65),260,(.24,.48,1),1.0)
 if ceiling_lights_on:area('Warm floor lamp',(.47,1.45,.90),(-.1,2,.25),12,(1,.53,.24),.28)
for i,o in enumerate(fixtures if ceiling_lights_on and room in {'hallway','basement'} else []):
 center=o.matrix_world@(sum((Vector(v) for v in o.bound_box),Vector())/8)
 area('Warm ceiling practical '+str(i),tuple(center-Vector((0,0,.08))),tuple(center-Vector((0,0,2))),140,(1,.27,.055),.50)
 # Modest upward spill gives the ceiling some bounced warmth too.
 area('Practical ceiling bounce '+str(i),tuple(center+Vector((0,0,.34))),tuple(center+Vector((0,0,2))),32,(1,.38,.12),.65)
images={False:bpy.data.images.new('Room UV baked diffuse',4096,4096,alpha=False,float_buffer=True),True:bpy.data.images.new('Room cream ceiling',2048,2048,alpha=False,float_buffer=True)}
for m in materials:
 if not m.use_nodes:continue
 node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=images[m in ceiling_materials];m.node_tree.nodes.active=node
samples=64 if room in {'attic','workshop'} else 128
exposure=-.7 if room=='attic' else -1.3
S.render.engine='CYCLES';S.cycles.samples=samples;S.cycles.use_denoising=True;S.cycles.max_bounces=8;S.cycles.diffuse_bounces=6
S.render.bake.use_pass_direct=True;S.render.bake.use_pass_indirect=True;S.render.bake.use_pass_color=True;S.render.bake.margin=12
output=R/'scene/renders'/(f'{room}-uv-bake' if ceiling_lights_on else f'{room}-uv-bake-lights-off');output.mkdir(parents=True,exist_ok=True)
if '--reuse-lighting' not in sys.argv:
 bpy.ops.object.bake(type='DIFFUSE')
 for ceiling,image in images.items():
  name='ceiling' if ceiling else 'diffuse'
  image.filepath_raw=str(output/(name+'.exr'));image.file_format='OPEN_EXR';image.save()
# Cycles' render denoising flag does not denoise texture bakes. Filter the HDR
# atlases explicitly before the display transform, so soft painted surfaces stay clean.
if '--reuse-lighting' not in sys.argv or '--denoise-lighting' in sys.argv:
 clean=bpy.data.scenes.new('Denoise hallway atlases');clean.render.engine='CYCLES';clean.cycles.samples=1
 camera=bpy.data.objects.new('Bake filter camera',bpy.data.cameras.new('Bake filter camera'));clean.collection.objects.link(camera);clean.camera=camera
 clean.use_nodes=True;nodes=clean.node_tree.nodes;nodes.clear()
 source=nodes.new('CompositorNodeImage');denoise=nodes.new('CompositorNodeDenoise');sink=nodes.new('CompositorNodeComposite')
 grade=nodes.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2
 clean.node_tree.links.new(source.outputs['Image'],denoise.inputs['Image']);clean.node_tree.links.new(denoise.outputs['Image'],grade.inputs['Image']);clean.node_tree.links.new(grade.outputs['Image'],sink.inputs['Image'])
 clean.view_settings.view_transform='AgX';clean.view_settings.exposure=exposure;clean.render.image_settings.file_format='PNG';clean.render.image_settings.color_mode='RGB'
 for ceiling in [False,True]:
  name='ceiling' if ceiling else 'diffuse';source.image=bpy.data.images.load(str(output/(name+'.exr')))
  source.image.colorspace_settings.name=images[ceiling].colorspace_settings.name
  clean.render.resolution_x=source.image.size[0];clean.render.resolution_y=source.image.size[1];clean.render.resolution_percentage=100
  clean.render.filepath=str(output/(name+'.png'));bpy.ops.render.render(scene=clean.name,write_still=True)
 bpy.data.scenes.remove(clean)
# All surfaces have unique UVs within their atlas, independent of the viewing camera.
baked_materials={}
for ceiling in [False,True]:
 name='ceiling' if ceiling else 'diffuse';image=bpy.data.images.load(str(output/(name+'.png')))
 baked=bpy.data.materials.new('Room baked '+name);baked.use_nodes=True
 nodes=baked.node_tree.nodes;nodes.clear();tx=nodes.new('ShaderNodeTexImage');tx.image=image
 em=nodes.new('ShaderNodeEmission');out=nodes.new('ShaderNodeOutputMaterial');baked.node_tree.links.new(tx.outputs['Color'],em.inputs[0]);baked.node_tree.links.new(em.outputs[0],out.inputs[0]);baked_materials[ceiling]=baked
for o in static:
 lo,hi=offsets[o]
 for uv in list(o.data.uv_layers):o.data.uv_layers.remove(uv)
 uv=o.data.uv_layers.new(name='Lighting UV')
 for loop,value in zip(uv.data,atlas_uv.data[lo:hi]):loop.uv=value.uv
 o.data.materials.clear();o.data.materials.append(baked_materials[ceiling_surface(o)])
 for poly in o.data.polygons:poly.material_index=0
 o[room+'_baked']=True
bpy.data.objects.remove(helper,do_unlink=True)
# Runtime lights and movable objects retain the original export materials and transforms.
bpy.ops.object.select_all(action='DESELECT')
for o in originals:o.hide_render=False;o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/f'web/assets/house/{room}-baked.glb'),use_selection=True,export_format='GLB',export_cameras=True,export_lights=True,export_extras=True,export_image_format='AUTO')
(EXPORTS/f'{room}-bake.json').write_text(json.dumps({'staticMeshes':len(static),'connections':connection_names,'samples':samples,'denoised':True,'exposure':exposure,'saturation':1.2,'resolution':4096,'ceilingResolution':2048,'ceilingPaint':'light cream' if room=='hallway' else 'original concrete' if room=='basement' else 'original timber','ceilingLightsOn':ceiling_lights_on and room in {'hallway','basement'},'practicalLightsOn':ceiling_lights_on,'lighting':'blue windows and warm practicals' if ceiling_lights_on else 'blue windows only','excludedMovableShadows':True},indent=2)+'\n')
print(room.upper()+'_BAKE_COMPLETE',flush=True)
