"""Sync the physical den opening and camera route in both saved house sources.
No render or lighting bake. Original den .blend and exports remain untouched.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from house_preview_spec import build_spec
convert=Matrix.Rotation(-math.pi/2,4,'X')
for filename in ['house-release.blend']:
 path=ROOT/'scene'/filename
 bpy.ops.wm.open_mainfile(filepath=str(path))
 scene=bpy.context.scene
 if scene.get('den_passage_refit'):continue
 delta=-.566
 for obj in list(scene.objects):
  if obj.type!='MESH':continue
  points=[convert@obj.matrix_world@Vector(p) for p in obj.bound_box]
  lo=Vector(tuple(min(p[k] for p in points) for k in range(3)))
  hi=Vector(tuple(max(p[k] for p in points) for k in range(3)))
  move=None
  if obj.get('door_id')=='den' or obj.name.startswith(('Finish / den casing','Finish / den head','Finish / den threshold')):
   move=Matrix.Translation((0,0,delta))
  elif lo.x>=4.69 and hi.x<=4.91:
   if abs(hi.z-9.2)<.01:
    move=Matrix.Translation((0,0,lo.z))@Matrix.Diagonal((1,1,(hi.z-lo.z+delta)/(hi.z-lo.z),1))@Matrix.Translation((0,0,-lo.z))
   elif abs(lo.z-10.6)<.01:
    move=Matrix.Translation((0,0,hi.z))@Matrix.Diagonal((1,1,(hi.z-lo.z-delta)/(hi.z-lo.z),1))@Matrix.Translation((0,0,-hi.z))
   elif abs(lo.z-9.2)<.01 and abs(hi.z-10.6)<.01:
    move=Matrix.Translation((0,0,delta))
  if move is not None:obj.matrix_world=convert.inverted()@move@convert@obj.matrix_world
 route=scene.objects.get('Route / den')
 if route:
  route.data.splines.clear();points=build_spec()['routes']['den']
  spline=route.data.splines.new('POLY');spline.points.add(len(points)-1)
  for point,coords in zip(spline.points,points):point.co=(coords[0],-coords[2],coords[1],1)
 scene['den_passage_refit']=True
 bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 print('DEN PASSAGE SYNCED',filename,flush=True)
