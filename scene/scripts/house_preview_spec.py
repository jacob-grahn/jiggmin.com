"""Fast, deterministic proposal blockout. Runtime coordinates are X/Y-up/Z."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def build_spec():
 plan=json.loads((ROOT/'docs/house-plan/proposed-layout.json').read_text());parts=[]
 def box(name,center,size,kind='shell',material='wall',**extra):
  parts.append(dict(name=name,center=center,size=size,kind=kind,material=material,**extra))
 def slab(name,b,y,kind='floor',holes=()):
  x,z,X,Z=b
  xs=sorted({x,X,*[v for h in holes for v in (h[0],h[2])]});zs=sorted({z,Z,*[v for h in holes for v in (h[1],h[3])]})
  for a,A in zip(xs,xs[1:]):
   for b,B in zip(zs,zs[1:]):
    if any(h[0]<(a+A)/2<h[2] and h[1]<(b+B)/2<h[3] for h in holes):continue
    box(name,[(a+A)/2,y-.10,(b+B)/2],[A-a,.20,B-b],kind,'floor')
 def wall(name,b,y=0,h=2.6,openings=None,material='wall'):
  x,z,X,Z=b;along_x=z==Z;start,end=(x,X)if along_x else(z,Z);fixed=z if along_x else x
  cuts=[]
  for o in openings or []:
   u,v,U,V,lo,hi=o
   if (along_x and v==V==z)or(not along_x and u==U==x):
    a,A=(u,U)if along_x else(v,V)
    if max(a,start)<min(A,end):cuts.append((max(a,start),min(A,end),lo,hi))
  edges=sorted({start,end,*[v for c in cuts for v in c[:2]]})
  for a,A in zip(edges,edges[1:]):
   removed=sorted([(lo,hi)for u,U,lo,hi in cuts if u<=(a+A)/2<=U]);intervals=[];cursor=0
   for lo,hi in removed:
    if lo>cursor:intervals.append((cursor,lo))
    cursor=max(cursor,hi)
   if cursor<h:intervals.append((cursor,h))
   for lo,hi in intervals:
    c=[(a+A)/2,y+(lo+hi)/2,fixed]if along_x else[fixed,y+(lo+hi)/2,(a+A)/2]
    size=[A-a,hi-lo,.14]if along_x else[.14,hi-lo,A-a]
    box(name,c,size,'shell',material)
 openings=[[*d['segment_xz'],0,2.15 if d['id']!='vehicle' else 2.4]for d in plan['doors']]
 openings += [[*w['segment_xz'],w.get('sill_y',1),w.get('head_y',2.25)]for w in plan['windows']]
 mainwalls=[(0,0,12,0),(0,0,0,12),(0,12,12,12),(12,0,12,12),(4.8,0,4.8,12),(6.3,0,6.3,6.8),(0,3.8,4.8,3.8),(6.3,3.8,12,3.8),(9.1,3.8,9.1,6.8),(0,6.8,4.8,6.8),(6.3,6.8,12,6.8),(6.3,8.3,12,8.3),(9.1,8.3,9.1,12)]
 for n,b in enumerate(mainwalls):wall(f'Proposed wall {n:02}',b,openings=openings)
 for b in [(12,-.2,17,-.2),(17,-.2,17,6.8),(12,6.8,17,6.8),(12,-.2,12,0)]:wall('Garage exterior',b,-.15,2.75,openings)
 hatch=plan['vertical_connections']['attic_hatch']['bounds_xz'];hatch_dx=hatch[0]-7.7;stair=[9.25,9.05,11.85,11.85]
 slab('Main floor',[0,0,12,12],0,holes=[stair]);slab('Attic floor / hall ceiling',[0,0,12,12],2.8,'ceiling',holes=[hatch]);slab('Garage slab',[12,-.2,17,6.8],-.15);slab('Garage ceiling',[12,-.2,17,6.8],2.8,'roof');slab('Basement slab',[0,0,12,12],-4)
 cellar_windows=[(0,2,0,3.5,3.1,3.7),(0,8,0,9.5,3.1,3.7),(8,0,9.5,0,3.1,3.7)]
 for b in mainwalls[:4]:wall('Basement masonry',b,-4,3.8,cellar_windows,material='masonry')
 wall('Cellar front closure',(0,12,12,12),-4,3.8,material='masonry')
 # Main roof pitches up to central ridge; workbench roof is lower and separate.
 for left in [True,False]:
  angle=math.atan2(4.5,6)*(1 if left else -1)
  box('Main pitched roof',[3 if left else 9,5.05,6],[math.hypot(6,4.5),.16,12.4],'roof','roof',slope=angle)
 for left in [True,False]:
  box('Garage pitched roof',[13.25 if left else 15.75,3.4,3.3],[math.hypot(2.5,1.2),.14,7.4],'roof','roof',slope=math.atan2(1.2,2.5)*(1 if left else -1))
 for z in [0,12]:
  # Triangular gable mesh is created by the Blender builder, avoiding solid window infill.
  pass
 for x in [2,10]:
  for z in [2,5,9]:box('Attic roof support',[x,3.4,z],[.12,1.2,.12],'shell','wood')
 # Preserve the original four-metre basement height with two twelve-step flights.
 for i in range(12):
  top=-(i+1)/6;box('Stair descending flight',[9.9,top-.09,9.2+(i+.5)*.13],[1.1,.18,.13],'stair','wood')
  top=-2-(i+1)/6;box('Stair return flight',[11.15,top-.09,10.8-(i+.5)*.13],[1.1,.18,.13],'stair','wood')
 slab('Half landing',[9.3,10.8,11.7,11.8],-2,'stair')
 # Ladder stays retracted except during attic travel. Upper end clears near hatch rim.
 for i in range(11):box('Pull-down ladder tread',[6.6+hatch_dx+(i+1)*1.9/11,(i+1)*2.8/11,7.55],[.18,.07,.75],'ladder','wood')
 for z in [7.15,7.95]:box('Ladder rail',[7.55+hatch_dx,1.4,z],[math.hypot(1.9,2.8),.07,.06],'ladder','wood',slope=math.atan2(2.8,1.9))
 # Closed leaves are independently toggleable; travel opens only the involved doors.
 for d in plan['doors']:
  x,z,X,Z=d['segment_xz'];height=2.17 if d['id']=='front' else 2.08;overlap=.03 if d['id']=='front' else 0
  box('Door / '+d['id'],[(x+X)/2,height/2,(z+Z)/2],[max(X-x+overlap,.055),height,max(Z-z+overlap,.055)],'door','door',door_id=d['id'])
 x,z,X,Z=hatch;box('Attic hatch',[(x+X)/2,2.61,(z+Z)/2],[X-x,.06,Z-z],'door','door',door_id='attic')
 box('Attic pull cord',[8+hatch_dx,2.12,7.55],[.018,.9,.018],'door','wood',door_id='attic')
 # Future rooms get modest proxies so the house reads as a complete reserved plan.
 for name,c,size in [('Bed 1',[2.4,.3,1.7],[1.6,.6,2]),('Bed 2',[8.6,.3,1.7],[1.6,.6,2]),('Kitchen counter',[2,.45,4.2],[3.5,.9,.65]),('Dining table',[2.5,.72,5.8],[1.7,.12,.85]),('Bathtub',[7.35,.3,4.4],[1.7,.6,.8]),('Laundry',[10.2,.45,4.3],[1.4,.9,.7])]:box(name,c,size,'proxy','proxy')
 slab('Yard',[-20,-25,40,55],-.45,'site',holes=[[0,0,12,12],[12,-.2,17,6.8],[-1,1.7,0,3.8],[-1,7.7,0,9.8],[7.7,-1,9.8,0]])
 # Keep actual air wells around cellar windows rather than ground covering them.
 # Yard is a low context plane, outside room windows only; house ground skirt is omitted.
 for name,b,y in [('Road',[-22,40,38,46],-.52),('Drive',[12.8,6.8,16.6,40],-.48),('Turnaround',[16.6,15,22,20],-.48),('Garage apron',[12,6.8,18,13],-.42),('Porch',[4.8,12,9.1,14],0)]:slab(name,b,y,'site')
 import random
 rng=random.Random(31)
 for n in range(55):
  x=rng.uniform(-15,32);z=rng.uniform(-20,32)
  if not(z<-8 or x<-10 or x>26):continue
  box('Tree trunk',[x,2,z],[.32,5,.32],'site','wood');box('Tree canopy',[x,5,z],[2.8,4,2.8],'site','trees')
 hub=plan['navigation_hub'];views={
 'hub':{'position':hub['position_xyz'],'target':hub['target_xyz']},
 'workshop':json.loads((ROOT/'scene/workshop-seating.json').read_text())['view'],
 'basement':{'position':[8.7,-2.35,10.5],'target':[5.6,-3.05,3]},
 'attic':{'position':[6.5,4.25,7.55],'target':[6,3.25,4]},
 'den':{'position':[4.137,1.65,9.334],'target':[-.1255,.968,9.4207]},
 'private-hall':{'position':[5.55,1.65,6.7],'target':[5.55,1.65,.4]},
 'overview':{'position':[24,23,28],'target':[7,0,7]}}
 start=views['hub']['position'];routes={
 'workshop':[start,[9.95,1.65,7.55],[10.45,1.65,7.05],[10.45,1.65,5.6],[12.5,1.5,5.6],views['workshop']['position']],
 'basement':[start,[10.45,1.65,7.55],[10.45,1.65,8.65],[9.9,1.65,9.1],[9.9,-.35,10.95],[11.15,-.35,11.2],[11.15,-.35,10.8],[11.15,-1.65,9.1],[8.7,-2.35,10.5]],
 'attic':[start,[6.6+hatch_dx,1.65,7.55],[8.03+hatch_dx,2.4,7.55],[8.1+hatch_dx,3.25,7.55],[8.1+hatch_dx,4.4,7.55],[8.2,4.4,7.55],views['attic']['position']],
 'den':[start,[5.55,1.65,7.55],[5.55,1.65,views['den']['position'][2]],views['den']['position']],
 'private-hall':[start,views['private-hall']['position']]}
 return {'revision':plan['revision'],'parts':parts,'views':views,'routes':routes,'hub_targets':{'workshop':[10.45,1.1,6.8],'basement':[10.5,1.1,8.3],'attic':[8.2+hatch_dx,2.58,7.55]},'fov':50,'aspect':1.6}
if __name__=='__main__':print(json.dumps(build_spec(),indent=2))
