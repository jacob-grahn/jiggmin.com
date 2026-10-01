"""Editable proposed house and site, revision 3. Coordinates in scene metres."""
from pathlib import Path
from html import escape
import json
OUT=Path(__file__).parent
rooms=[
 ('bedroom-1','BEDROOM 1',(0,0,4.8,3.8),'4.8 × 3.8 m'),
 ('bedroom-2','BEDROOM 2',(6.3,0,12,3.8),'5.7 × 3.8 m incl. closet'),
 ('kitchen','KITCHEN / DINING',(0,3.8,4.8,6.8),'4.8 × 3 m'),
 ('bath','BATH',(6.3,3.8,9.1,6.8),'2.8 × 3 m'),
 ('mudroom','MUD / LAUNDRY',(9.1,3.8,12,6.8),'2.9 × 3 m'),
 ('den','DEN / LIVING',(0,6.8,4.8,12),'4.8 × 5.2 m'),
 ('entry','ENTRY',(4.8,8.3,9.1,12),'Front door / coats'),
 ('stairs','BASEMENT STAIRS',(9.1,8.3,12,12),'U-shaped flight'),
 ('garage','GARAGE / WORKROOM',(12,-.2,17,6.8),'5 × 7 m · one car + bench')]
doors=[('bedroom-1',(4.8,2.2,4.8,3.1)),('bedroom-2',(6.3,2.2,6.3,3.1)),('kitchen',(4.8,5.1,4.8,6.2)),('bath',(6.3,5.3,6.3,6.2)),('mudroom',(10,6.8,10.9,6.8)),('garage',(12,5.1,12,6.1)),('den',(4.8,9.2,4.8,10.6)),('kitchen-den',(2.5,6.8,3.9,6.8)),('stairs',(10,8.3,11,8.3)),('front',(6,12,7.1,12)),('kitchen-outside',(0,5.2,0,6.1)),('vehicle',(13,6.8,16,6.8))]
windows=[('bedroom-1',(1.4,0,3.2,0),'Rear woods'),('bedroom-2',(8.3,0,10.5,0),'Rear woods'),('hall-rear',(5.05,0,6.05,0),'Rear woods'),('kitchen',(0,4.05,0,4.85),'Side yard'),('den-west',(0,10.23,0,11.31),'Side woods; original window left of TV'),('hall-right',(12,7.05,12,8.05),'Driveway / side woods; clears garage'),('entry',(8,12,8.8,12),'Front porch'),('garage-rear',(13.3,-.2,15.6,-.2),'Rear woods'),('garage-side',(17,2,17,3.6),'Side woods')]
spec={'revision':3,'status':'proposal; not implemented','units':'scene metres','axes':'X right; Z toward front road; Y up','main_footprint':[0,0,12,12],'garage_footprint':[12,-.2,17,6.8],'elevations':{'main':0,'basement':-4,'attic':2.8,'garage':-.15,'yard_near_house':-.45},'rooms':[{'id':i,'name':n,'bounds_xz':b,'dimension_label':d}for i,n,b,d in rooms], 'doors':[{'id':i,'segment_xz':b}for i,b in doors],'windows':[{'id':i,'segment_xz':b,'view':v}for i,b,v in windows], 'site':{'road_bounds_xz':[-22,40,38,46],'driveway_bounds_xz':[12.8,6.8,16.6,40],'turnaround_bounds_xz':[16.6,15,22,20],'porch_bounds_xz':[4.8,12,9.1,14],'rear_woodland_starts_z':-8,'side_woodland_approx_x':[-10,26]}}
spec['circulation']=[{'id':'hall','bounds_xz':[4.8,0,6.3,8.3]},{'id':'cross-hall','bounds_xz':[6.3,6.8,12,8.3]}]
spec['levels']={'basement':{'bounds_xz':[0,0,12,12],'status':'existing contents, relocate shell'},'attic':{'bounds_xz':[0,0,12,12],'status':'existing contents, rebuild roof shell'}}
spec['vertical_connections']={'basement_stairs':{'bounds_xz':[9.1,8.3,12,12],'levels':['main','basement']},'attic_hatch':{'bounds_xz':[8.7,7.05,9.95,8.05],'levels':['main','attic']}}
spec['navigation_hub']={
 'id':'cross-hall-view','position_xyz':[6.55,1.65,7.55], 'target_xyz':[11.7,1.9,7.55],
 'vertical_fov_degrees':50,'aspect_ratio':1.6,'status':'planning camera; final framing needs 3D blockout',
 'ceiling_height':2.6,
 'destinations':[
  {'id':'workshop','trigger':'mudroom door','status':'initial','waypoints_xyz':[[6.55,1.65,7.55],[10.45,1.65,7.55],[10.45,1.65,5.6],[12.4,1.5,5.6]],'arrival':'existing workbench view; travel through mudroom without a required stop'},
  {'id':'basement','trigger':'stair door','status':'initial','waypoints_xyz':[[6.55,1.65,7.55],[10.5,1.65,7.55],[10.5,1.65,8.7]],'arrival':'descend modeled U stair to basement view'},
  {'id':'attic','trigger':'ceiling hatch / pull cord','status':'initial','arrival':'pull-down ladder in cross hall; direct attic landing'},
  {'id':'den','trigger':'screen-right hallway navigation','status':'initial','waypoints_xyz':[[6.55,1.65,7.55],[5.55,1.65,9.9],[4.2,1.65,9.9]],'arrival':'den via entry'},
  {'id':'private-hall','trigger':'screen-left look up hallway','status':'future','waypoints_xyz':[[6.55,1.65,7.55],[5.55,1.65,6.7]],'arrival':'later camera facing rear hall, opening bedrooms / bath / kitchen'}],
 'framing_notes':['Mudroom door on screen left, basement door on screen right, attic hatch overhead, outside window ahead.', 'Keep landing uncluttered and pull cord readable; den and private hall use edge controls, not visible destination doors.', 'Only the entrance targets need visibility, not the workbench, basement interior or den itself.']}
spec['roof']={'eaves_y':2.8,'ridge_y':7.3,'rise':4.5,'reason':'Headroom at shifted attic hatch; 9:12 main roof pitch'}
spec['den_arrangement']={'tv_wall':'west exterior wall (X=0)','window':'Original window remains screen-left of TV; lamp and seating remain screen-right','source_scale':[.55,.42,.6],'source_translation_blender':[.819,-9.4,0],'source_rotation_z_degrees':90}
for w in spec['windows']:
 if w['id']=='den-west':w.update(sill_y=.588,head_y=2.412)
(OUT/'proposed-layout.json').write_text(json.dumps(spec,indent=2)+'\n')
class Sheet:
 def __init__(self,w,h,title,sub):
  self.s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#10283d"/><style>text{{font-family:Arial,sans-serif;fill:#e0edf4;font-size:18px}}.small{{font-size:15px;fill:#b5cbd9}}.heading{{font-size:23px}}.title{{font-size:32px;font-weight:bold}}.wall{{stroke:#d6e7f1;stroke-width:4;fill:none}}.window{{stroke:#73d5ee;stroke-width:4;fill:none}}.detail{{stroke:#7895a8;stroke-width:1.5;fill:none}}.ghost{{stroke:#7895a8;stroke-width:1.5;stroke-dasharray:7 5;fill:none}}.route{{stroke:#b5c59b;stroke-width:2;fill:none}}</style>'];self.text(40,48,title,'title');self.text(40,80,sub,'small')
 def text(self,x,y,t,c='',anchor='start'):self.s.append(f'<text x="{x}" y="{y}" class="{c}" text-anchor="{anchor}">{escape(t)}</text>')
 def line(self,x,y,X,Y,c='wall'):self.s.append(f'<path d="M{x} {y}L{X} {Y}" class="{c}"/>')
 def box(self,x,y,w,h,c='detail',fill='none'):self.s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="{c}" style="fill:{fill}"/>')
 def save(self,name):(OUT/f'{name}.svg').write_text('\n'.join(self.s+['</svg>']))
class Plan:
 def __init__(self,s,x,y,scale):self.s=s;self.x=x;self.y=y;self.scale=scale
 def p(self,x,z):return self.x+x*self.scale,self.y+z*self.scale
 def line(self,x,z,X,Z,c='wall'):self.s.line(*self.p(x,z),*self.p(X,Z),c)
 def box(self,x,z,X,Z,c='detail',fill='none'):self.s.box(*self.p(x,z),(X-x)*self.scale,(Z-z)*self.scale,c,fill)
 def text(self,x,z,t,c='',anchor='middle'):self.s.text(*self.p(x,z),t,c,anchor)
 def door(self,b,vehicle=False):
  x,z,X,Z=b;xx,yy=self.p(x,z);XX,YY=self.p(X,Z)
  self.s.s.append(f'<path d="M{xx} {yy}L{XX} {YY}" stroke="#10283d" stroke-width="7"/>')
  if vehicle:self.line(x,z,X,Z,'ghost')
  elif x==X:self.line(x,z,x+.6,z,'route')
  else:self.line(x,z,x,z-.6,'route')
 def window(self,b):
  x,z,X,Z=b;self.line(x,z,X,Z,'window');self.line(x+(.10 if x==X else 0),z+(.10 if z==Z else 0),X+(.10 if x==X else 0),Z+(.10 if z==Z else 0),'window')
 def stairs(self):
  self.box(9.35,9.25,11.75,11.75,'detail');self.line(10.55,9.25,10.55,10.75,'detail');self.line(9.35,10.75,11.75,10.75,'detail')
  for i in range(7):
   z=9.25+i*.25;self.line(9.35,z,10.45,z,'detail');self.line(10.65,z,11.75,z,'detail')
# Main floor large and legible
s=Sheet(1400,1510,'A HOUSE TO GROW INTO','PROPOSED / REVISION 3 · Two bedrooms · one bathroom · unfinished basement · attached garage workshop')
s.text(40,127,'01 / MAIN FLOOR','heading');s.text(40,155,'Rear woods ↑     Front yard and road ↓     Room sizes are nominal, before wall thickness.','small')
p=Plan(s,80,208,61)
p.box(0,0,12,12,'wall');p.box(12,-.2,17,6.8,'wall')
for b in [(4.8,0,4.8,12),(6.3,0,6.3,6.8),(0,3.8,4.8,3.8),(6.3,3.8,12,3.8),(9.1,3.8,9.1,6.8),(0,6.8,4.8,6.8),(6.3,6.8,12,6.8),(6.3,8.3,12,8.3),(9.1,8.3,9.1,12)]:p.line(*b)
# No enclosing line where hall opens into foyer.
for i,b in doors:p.door(b,i=='vehicle')
for i,b,v in windows:p.window(b)
for i,n,b,d in rooms:
 x,z,X,Z=b;cx=(x+X)/2;cz=(z+Z)/2
 if i=='stairs':p.text(cx,8.75,'STAIRS');continue
 if i=='garage':cz=3.8
 if i=='entry':cz=10.2
 p.text(cx,cz,n);p.text(cx,cz+.4,d,'small')
p.text(5.55,4.05,'HALL','small');p.text(5.55,4.48,'1.5 m','small')
p.text(8.4,8.02,'ATTIC HATCH','small')
# Functional hints at real scale: closets, sanitary fixtures, bench, car, kitchen counters.
p.box(.2,.2,1.05,1.8,'detail');p.text(.62,2,'closet','small')
p.box(10.65,.2,11.8,1.85,'detail');p.text(11.2,2.15,'closet','small')
p.box(6.5,4,8.2,4.8,'detail');p.text(7.35,4.55,'tub','small')
p.box(8.35,4.05,8.9,4.75,'detail');p.box(8.45,5.75,8.95,6.55,'detail')
p.box(9.3,4,10.8,4.7,'detail');p.text(10.05,4.43,'washer / dryer','small')
p.box(.2,4,3.7,4.6,'detail');p.box(.2,4.6,.8,5.1,'detail');p.box(1.5,5.35,3.3,6.2,'detail')
p.box(.1,8.25,.85,10.5,'detail');p.text(1.6,9.1,'TV / CONSOLE','small');p.text(1.5,11.6,'Original window','small')
p.box(5,11,5.75,11.8,'detail');p.text(5.4,10.82,'coats','small')
p.box(12.3,.05,16.7,.8,'detail');p.text(14.5,.55,'EXISTING WORKBENCH','small')
p.box(13.1,1.35,15.1,5.75,'ghost');p.text(14.1,2,'Car clearance','small')
p.text(16.05,5.3,'Storage','small')
p.stairs();p.text(10.55,11.45,'↶ DOWN','small')
p.box(8.7,7.05,9.95,8.05,'ghost')
p.box(6.4,7.38,6.7,7.72,'route');p.line(6.7,7.55,8,7.55,'route');p.line(8,7.55,7.7,7.4,'route');p.line(8,7.55,7.7,7.7,'route')
p.text(5.55,8.05,'CAM','small')
p.box(4.8,12,9.1,14,'ghost');p.text(6.95,13.1,'COVERED FRONT PORCH','small')
p.text(13.8,8.5,'Clear hall window → side woods','small');p.text(14.6,9,'Driveway below this view','small')
s.text(40,1112,'02 / UNFINISHED BASEMENT','heading');s.text(740,1112,'03 / ATTIC','heading')
b=Plan(s,55,1145,25);b.box(0,0,12,12,'wall');b.stairs()
for seg in [(0,2,0,3.5),(0,8,0,9.5),(8,0,9.5,0)]:b.window(seg)
b.box(1.7,4,7.1,8.1,'ghost');b.box(3.15,5.4,5.65,6.7,'detail');b.text(4.4,7.7,'pool / clear play area','small');b.text(3.1,1.7,'BASEMENT','small');b.text(3.1,2.5,'unfinished','small')
b.box(6.3,.2,11.8,3.6,'ghost');b.text(9,1.3,'utility zone','small');b.box(.3,10.8,7.8,11.5,'detail');b.text(4,10.45,'archive shelves','small')
s.text(390,1190,'Full cellar beneath the house.','small');s.text(390,1220,'Garage stays on its own slab.','small');s.text(390,1250,'Laundry / bath services above.','small');s.text(390,1280,'High windows with exterior wells.','small');s.text(390,1310,'Stairs align with main floor.','small');s.text(390,1360,'Floor: approximately −4 m.','small')
a=Plan(s,750,1145,25);a.box(0,0,12,12,'wall');a.line(6,0,6,12,'ghost');a.box(3,0,9,12,'ghost');a.box(8.7,7.05,9.95,8.05,'route');a.window((5.3,0,6.7,0));a.text(6,3,'UNFINISHED ATTIC','small');a.text(6,9.5,'joists / stored objects','small')
s.text(1080,1190,'Roof over the house footprint.','small');s.text(1080,1220,'Hatch above the cross hall.','small');s.text(1080,1250,'Rear gable window → woods.','small');s.text(1080,1280,'Low eaves along both sides.','small');s.text(1080,1310,'Separate lower garage roof.','small');s.text(1080,1360,'Attic floor: approximately +2.8 m.','small')
s.text(40,1480,'Cyan = windows · Green marks = door openings · Dashed = clearance / roof / porch · Concept for the game world; not a construction drawing.','small')
s.save('proposed-layout')
# Site drawing
s=Sheet(1300,1150,'A QUIET HOUSE, NEAR A ROAD','PROPOSED SITE / REVISION 3 · Wooded sides and rear · open front approach · dimensions are scene-planning targets')
p=Plan(s,290,435,13)
# woodland masses, no invented parcel line
p.box(-17,-22,31,-8,'detail','#1d3d3d');p.box(-17,-8,-10,36,'detail','#1d3d3d');p.box(26,-8,34,36,'detail','#1d3d3d')
import random
r=random.Random(24)
for x0,z0,x1,z1 in [(-16,-21,30,-9),(-16,-7,-11,34),(27,-7,33,34)]:
 for _ in range(int((x1-x0)*(z1-z0)/19)):
  x=r.uniform(x0,x1);z=r.uniform(z0,z1);X,Y=p.p(x,z);rad=r.uniform(10,19);s.s.append(f'<circle cx="{X}" cy="{Y}" r="{rad}" fill="none" stroke="#5f8374" stroke-width="1.5"/>')
p.text(7,-14,'WOODS CONTINUE BEHIND THE HOUSE');p.text(7,-11.5,'No visible neighbors in the main window views','small')
p.box(-5,-6,23,34,'detail','#213b41')
p.text(6,-4.1,'SMALL BACK YARD / TREE LINE','small')
# driveway and turnaround
p.box(12.8,6.8,16.6,40,'detail','#52616b');p.box(16.6,15,22,20,'detail','#52616b');p.text(21.5,22,'Turnaround','small')
p.box(12,6.8,18,13,'detail','#52616b')
# front path, back service path
p.box(6.5,14,7.5,17,'detail','#87948f');p.box(7.5,16,12.8,17,'detail','#87948f');p.box(-2,4.8,0,6.6,'detail','#87948f')
# house and roof
p.box(0,0,12,12,'wall','#10283d');p.box(12,-.2,17,6.8,'wall','#10283d');p.box(4.8,12,9.1,14,'detail','#314d5f');p.line(6,0,6,12,'detail');p.text(6,5.4,'HOUSE');p.text(6,7.3,'2 bedrooms','small');p.text(14.5,2.9,'GARAGE','small')
p.line(13,6.8,16,6.8,'window');p.line(12,7.05,12,8.05,'window');p.line(5.05,0,6.05,0,'window')
p.text(4,25,'FRONT LAWN');p.text(4,27,'Mostly open toward the road','small');p.text(4,29,'Trees frame the house at the sides','small')
# two lanes and shoulders
p.box(-21,40,37,46,'detail','#384c5d');p.line(-21,43,37,43,'ghost');p.line(-21,39.5,37,39.5,'detail');p.line(-21,46.5,37,46.5,'detail');p.text(6,45,'TWO-LANE LOCAL ROAD','small')
p.text(18,38,'Mailbox','small')
# dimension annotation
p.line(-7,12,-7,40,'ghost');p.line(-7.5,12,-6.5,12,'detail');p.line(-7.5,40,-6.5,40,'detail');p.text(-7.8,22,'28 m','small','end');p.text(-7.8,24,'front wall','small','end');p.text(-7.8,26,'to road','small','end')
s.text(825,350,'THE FEEL','heading')
for y,t in [(388,'An ordinary small house in a clearing.'),(418,'Dense woods at the back and sides.'),(448,'A visible road, mailbox and driveway.'),(478,'Space to turn before driving onto the road.'),(536,'WINDOW VIEWS'),(574,'Bedrooms + rear hall → trees / back yard.'),(604,'Den window → side woods, left of TV.'),(634,'Right hall → drive, then side woods.'),(664,'Workshop → rear and side trees.'),(722,'GROUND + ROOF'),(760,'Main floor slightly above the yard.'),(790,'Basement windows sit in shallow wells.'),(820,'Simple gable over the house.'),(850,'Lower gable over the attached garage.')]:s.text(825,y,t,'heading' if t in ['WINDOW VIEWS','GROUND + ROOF'] else 'small')
s.text(40,1085,'Site scale: 13 px per metre · Building plans use a larger scale · Front is down the sheet; geographic north is still undecided.','small')
s.text(40,1115,'Woodland boundaries are visual targets, not parcel boundaries. Keep the driveway mouth and the front approach open.','small');s.save('proposed-site')

# Dedicated navigation plan: same geometry, enlarged; directions are camera-relative.
s=Sheet(1200,790,'ONE HALL VIEW, FOUR DESTINATIONS','REVISION 3 · Planning view faces right across the blueprint (+X) · Camera left = rear hall; camera right = den')
p=Plan(s,-140,-350,80)
# Crop to the shared junction, not a new footprint.
for seg in [(4.8,6.55,4.8,9.9),(6.3,6.55,6.3,6.8),(6.3,6.8,12,6.8),(6.3,8.3,12,8.3),(12,6.8,12,8.3),(9.1,6.55,9.1,6.8),(9.1,8.3,9.1,9.9)]:p.line(*seg)
for seg in [(10,6.8,10.9,6.8),(10,8.3,11,8.3)]:p.door(seg)
p.window((12,7.05,12,8.05));p.box(8.7,7.05,9.95,8.05,'ghost')
p.text(9.325,7.42,'ATTIC','small');p.text(9.325,7.7,'ceiling hatch','small')
p.text(10.45,6.0,'MUDROOM → WORKBENCH')
p.text(10.5,8.8,'STAIRS → BASEMENT')
p.text(5.55,6.5,'FUTURE: LOOK LEFT','small');p.text(6.3,9.55,'GO RIGHT → DEN','small')
p.text(8.1,9.75,'Through entry','small')
p.line(6.55,7.55,10.45,6.8,'ghost');p.line(6.55,7.55,10.5,8.3,'ghost')
p.box(6.4,7.4,6.7,7.7,'route');p.line(6.7,7.55,7.7,7.55,'route');p.line(7.7,7.55,7.4,7.4,'route');p.line(7.7,7.55,7.4,7.7,'route')
p.text(6.9,8.03,'CAMERA','small');p.text(12.1,8.75,'Window','small')
p.line(5.55,7.25,5.55,6.8,'route');p.line(5.55,6.8,5.4,6.98,'route');p.line(5.55,6.8,5.7,6.98,'route')
p.line(5.55,8.25,5.55,9.05,'route');p.line(5.55,9.05,5.4,8.87,'route');p.line(5.55,9.05,5.7,8.87,'route')
s.text(45,470,'INITIAL NAVIGATION','heading')
for y,t in [(510,'Mudroom door → travel through mudroom → workbench view'),(543,'Stair door → descend U-shaped stairs → basement view'),(576,'Ceiling hatch / pull cord → ladder → attic view'),(609,'Right edge control → turn toward front entry → den')]:s.text(45,y,t)
s.text(45,666,'LATER EXPANSION','heading');s.text(45,703,'Left edge control → look up the rear hall → kitchen, bath and bedrooms')
s.text(45,752,'Dashed rays show unobstructed plan sightlines, not a tested final camera composition. Runtime views and controls are unchanged.','small')
s.save('proposed-navigation')
