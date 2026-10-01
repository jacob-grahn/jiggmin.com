import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from export_house_preview import preview_material
s=bpy.context.scene
materials={}
for o in s.objects:
 if o.get('preview_preserve_material'):
  for slot in o.material_slots:
   m=slot.material
   if m.name not in materials:materials[m.name]=preview_material(m)
   slot.material=materials[m.name]
s.display.shading.color_type='TEXTURE'
root=Path(__file__).resolve().parents[1]/'renders/house-preview/finished';frames=json.loads((Path(__file__).resolve().parents[1]/'preview/generated/audit-frames.json').read_text())
camera=s.camera.copy();camera.data=s.camera.data.copy();s.collection.objects.link(camera);s.camera=camera
s.render.resolution_x=640;s.render.resolution_y=400;s.render.resolution_percentage=100;s.display.render_aa='8';rot=Quaternion((1,0,0),math.pi/2);basis=rot.to_matrix().to_4x4();rest={o:o.matrix_world.copy() for o in s.objects if o.get('preview_kind') in ['door','ladder']}
for f in frames:
 if '--quick' in __import__('sys').argv and not ((f['id']=='den' and f['progress'] in [.45,.6]) or (f['id'] in ['basement','attic'] and f['progress']==.6)):continue
 x,y,z=f['position'];camera.location=(x,-z,y);qx,qy,qz,qw=f['quaternion'];camera.rotation_mode='QUATERNION';camera.rotation_quaternion=rot@Quaternion((qw,qx,qy,qz));camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=24;camera.data.lens=12/math.tan(math.radians(f['fov']/2))
 opens=({'workshop':['mudroom','garage'],'basement':['stairs'],'attic':['attic'],'den':['den'],'private-hall':[]}[f['id']] if f['progress']>0 else [])
 for o in s.objects:
  if o in rest:
   values=f['doors'].get(o.get('door_id'),None) if o.get('preview_kind')=='door' else f['ladder'][o.get('ladder_section',2)]
   if values:o.matrix_world=basis@Matrix([[values[c*4+r] for c in range(4)] for r in range(4)])@basis.inverted()@rest[o]
  if o.get('preview_kind')=='door':o.hide_render=False
  if o.get('preview_kind')=='ladder':o.hide_render=not(f['id']=='attic' and f['progress']>.06)
 s.render.filepath=str(root/f"{f['id']}-{round(f['progress']*100):03}.png");bpy.ops.render.render(write_still=True)
print('AUDIT COMPLETE',len(frames),flush=True)
