import bpy,math

def polish_preview_fixtures():
 vertices=[(0,0,.5),(0,0,-.5)];faces=[]
 for ring in range(1,8):
  theta=math.pi*ring/8
  for j in range(16):vertices.append((.5*math.sin(theta)*math.cos(j*math.tau/16),.5*math.sin(theta)*math.sin(j*math.tau/16),.5*math.cos(theta)))
 for j in range(16):faces.append((0,2+j,2+(j+1)%16));faces.append((1,2+6*16+(j+1)%16,2+6*16+j))
 for r in range(6):
  for j in range(16):a=2+r*16+j;b=2+r*16+(j+1)%16;faces.append((a,a+16,b+16,b))
 mesh=bpy.data.meshes.new('Opal globe');mesh.from_pydata(vertices,[],faces);mesh.update()
 for f in mesh.polygons:f.use_smooth=True
 for o in list(bpy.context.scene.objects):
  if o.get('preview_kind')!='fixture':continue
  material=o.data.materials[0];o.data=mesh.copy();o.data.materials.append(material);o.scale=(.24,.24,.20)
  # Mount the globe directly below the appropriate ceiling, keeping lower cellar lights low.
  if 2.3<o.location.z<2.8:o.location.z=2.49
  if 'Attic access light' in o.name:o.location.z=4.0
  p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=material.diffuse_color;p.inputs['Emission Strength'].default_value=.65
