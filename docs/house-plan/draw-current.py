"""Draw the surveyed current layout, not a proposed redesign. See README.md."""
from pathlib import Path
from html import escape
out=Path(__file__).parent
s=['''<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1320" viewBox="0 0 1400 1320"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#203e57" stroke-width=".5"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9L9 0" stroke="#eead76" stroke-width="1"/></pattern></defs><rect width="1400" height="1320" fill="#10283d"/><style>text{font-family:Arial,sans-serif;fill:#e0edf4;font-size:18px} .small{font-size:15px;fill:#b1c8d7}.title{font-size:32px;font-weight:bold}.heading{font-size:23px}.wall{stroke:#d6e7f1;stroke-width:4;fill:none}.window{stroke:#73d5ee;stroke-width:3;fill:none}.edge{stroke:#a8bdcb;stroke-width:2;stroke-dasharray:7 5;fill:none}.ghost{stroke:#5d7d94;stroke-width:1.4;stroke-dasharray:5 5;fill:none}.route{stroke:#a3b59a;stroke-width:2;fill:none}.issue{stroke:#eead76;stroke-width:2;fill:none}</style>''']
def text(x,y,t,c='',anchor='start'):
 s.append(f'<text x="{x}" y="{y}" class="{c}" text-anchor="{anchor}">{escape(t)}</text>')
def line(x1,y1,x2,y2,c='wall'):
 s.append(f'<path d="M{x1} {y1}L{x2} {y2}" class="{c}"/>')
def rect(x,y,w,h,c='edge',fill='none'):
 s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="{c}" fill="{fill}"/>')
class Plan:
 def __init__(self,x,y,xmin,zmin):self.x=x;self.y=y;self.xmin=xmin;self.zmin=zmin
 def p(self,x,z):return self.x+(x-self.xmin)*32,self.y+(z-self.zmin)*32
 def line(self,x,z,X,Z,c='wall'):line(*self.p(x,z),*self.p(X,Z),c)
 def box(self,x,z,X,Z,c='edge',fill='none'):rect(*self.p(x,z),(X-x)*32,(Z-z)*32,c,fill)
 def label(self,x,z,t,c='',a='middle'):text(*self.p(x,z),t,c,a)
 def window(self,x,z,X,Z):
  self.line(x,z,X,Z,'window');dx=.10 if x==X else 0;dz=.10 if z==Z else 0;self.line(x+dx,z+dz,X+dx,Z+dz,'window')
 def marker(self,x,z,n):
  X,Y=self.p(x,z);s.append(f'<circle cx="{X}" cy="{Y}" r="13" fill="#eead76"/>');s.append(f'<text x="{X}" y="{Y+6}" text-anchor="middle" style="fill:#10283d;font-weight:bold">{n}</text>')
text(40,49,'THE HOUSE SO FAR','title')
text(40,80,'Current 3D layout • 29 September 2026 • top-down survey, before redesign','small')
text(40,108,'1 grid square = 1 scene metre. Up = far end of hallway (−Z); geographic north is not defined.','small')
# Main plan
text(40,153,'01 / MAIN FLOOR  ·  y = 0','heading')
rect(35,172,810,655,'', 'url(#grid)')
p=Plan(40,180,-14.5,-6.8)
# Den room extent: source side/back walls + connector front wall; no invented closure
p.box(-13.69,-.12,-1.39,12.4,'edge')
p.line(-13.69,-.05,-1.39,-.05)
p.line(-13.69,-.12,-13.69,8.3)
p.line(-13.69,12.4,-1.39,12.4)
# Hall sidewalls including shared den wall
for a,b in [(-5.9,-3.79),(-2.61,5.31),(6.49,12.4)]:p.line(-1.39,a,-1.39,b)
for a,b in [(-5.9,-3.4),(-1.7,1.21),(2.39,2.795),(4.605,10.4)]:p.line(1.39,a,1.39,b)
p.line(-1.39,-5.9,-.59,-5.9);p.line(.59,-5.9,1.39,-5.9)
p.line(-.59,-5.9,.59,-5.9,'issue')
p.line(-1.39,10.4,1.39,10.4,'edge')
# Room doors represented as openings and leaves, no guessed swing
for x,z in [(-1.39,-3.2),(-1.39,5.9),(1.39,1.8)]:p.line(x,z-.52,x+.52,z-.52,'route')
p.window(1.39,2.795,1.39,4.605);p.window(1.39,-3.4,1.39,-1.7)
p.window(-9.245,-.05,-7.495,-.05)
# workshop envelope and slab overrun
p.box(2.75,-1.7,9,5.3,'ghost')
p.line(2.75,-1.2,7.68,-1.2);p.line(7.68,-1.2,7.68,4.8)
p.line(2.75,-1.2,2.75,1.15);p.line(2.75,2.45,2.75,4.8)
p.line(2.75,4.8,7.68,4.8,'edge')
p.line(1.39,1.15,2.75,1.15);p.line(1.39,2.45,2.75,2.45)
p.window(5.38,-1.2,7.03,-1.2);p.window(7.68,.54,7.68,1.86)
# obstruction band
p.box(1.48,2.8,2.69,4.6,'issue','url(#hatch)');p.marker(2.05,3.7,'A')
# stair flight
p.box(-7.4,-3.85,-1.4,-2.55,'edge')
for i in range(21):p.line(-1.4-i*.3,-3.85,-1.4-i*.3,-2.55,'ghost')
p.line(-1.7,-3.2,-7.1,-3.2,'route');p.line(-7.1,-3.2,-6.7,-3.45,'route');p.line(-7.1,-3.2,-6.7,-2.95,'route')
p.label(-4.5,-4.25,'DOWN  ·  20 steps','small')
# hatch
p.box(-.54,1.15,.54,2.275,'route');p.label(-.1,3.1,'H','small')
p.label(-7.6,5.4,'DEN');p.label(-7.6,6.2,'≈ 12.3 × 12.5 m','small')
p.label(-7.6,7.05,'Large scenic envelope','small')
p.label(-7.6,7.85,'Floor and walls do not fully match','small')
p.label(5.25,2.55,'WORKSHOP');p.label(5.25,3.3,'≈ 4.9 × 6 m','small')
p.label(5.4,6.25,'Open model edge','small')
p.label(-.1,7.2,'HALL');p.label(-.1,8,'2.6 m','small')
p.label(-.1,8.7,'wide','small')
p.label(-.1,-6.28,'LOCKED → unbuilt','small')
p.label(3.5,-3,'Clear window','small', 'start')
p.label(2.1,10.55,'Open end','small','start')
p.label(-7.6,11.4,'No modeled exterior entrance','small')
# Attic panel
text(900,153,'02 / ATTIC  ·  y ≈ +3.2','heading')
rect(882,172,475,495,'','url(#grid)')
a=Plan(915,190,-5.5,-11)
# limited main floor below under attic for intelligible registration
for x,z,X,Z in [(-1.39,-5.9,1.39,3),(-5.2,-.12,-1.39,3),(2.75,-1.2,7.68,3)]:a.box(x,z,X,Z,'ghost')
a.line(-4,-10.4,4,-10.4);a.line(-4,-10.4,-4,-2.8);a.line(4,-10.4,4,-2.8)
a.line(-4,-2.8,-.65,-2.8);a.line(.65,-2.8,4,-2.8)
a.window(-.68,-10.4,.68,-10.4)
a.line(-.65,-2.8,-.65,1.15);a.line(.65,-2.8,.65,1.15)
a.box(-.54,1.15,.54,2.275,'route')
a.line(0,-10.1,0,-3.1,'ghost')
a.label(0,-7.5,'ATTIC');a.label(0,-6.7,'≈ 8 × 7.6 m','small')
a.label(0,-5.8,'Low pitched roof','small');a.marker(3.4,-9.6,'B')
a.label(1,-.7,'Landing','small','start');a.label(1,2.2,'Hatch ↓','small','start')
text(900,695,'B  Roof footprint is mostly outside','small');text(922,717,'the main-floor rooms below.','small')
text(900,751,'Dashed muted outlines: floor below','small')
# Basement separate panel
text(40,882,'03 / BASEMENT  ·  y = −4.0','heading')
rect(35,901,945,370,'','url(#grid)')
b=Plan(45,924,-21.5,-5.5)
# main floor reference clipped at panel bottom
b.box(-13.69,-.12,-1.39,4.9,'ghost');b.box(-1.39,-5.9,1.39,4.9,'ghost')
b.box(-20.4,-4.6,-7.4,5.4,'wall')
# overdraw doorway hole then marks
X,Y=b.p(-7.4,-3.85);s.append(f'<path d="M{X} {Y}v{1.3*32}" stroke="#10283d" stroke-width="6"/>')
b.box(-7.4,-3.85,-1.4,-2.55,'edge')
for i in range(21):b.line(-1.4-i*.3,-3.85,-1.4-i*.3,-2.55,'ghost')
b.window(-20.4,1.7,-20.4,3.5);b.window(-20.4,-2.7,-20.4,-.9);b.window(-16.8,5.4,-15,5.4)
b.label(-14.4,-1.55,'BASEMENT');b.label(-14.4,-.75,'≈ 13 × 10 m','small');b.label(-14.4,.1,'Pool table / archives','small')
b.label(-10.4,3.6,'Den above →','small');b.marker(-18,3.5,'C');b.label(-4.4,-4.3,'UP to hallway','small')
b.line(-7.1,-3.2,-1.8,-3.2,'route');b.line(-1.8,-3.2,-2.2,-3.45,'route');b.line(-1.8,-3.2,-2.2,-2.95,'route')
# notes/legend right bottom
text(1005,858,'READING THE PLAN','heading')
line(1005,894,1044,894);text(1057,900,'Modeled wall','small')
line(1005,928,1044,928,'window');text(1057,934,'Window','small')
line(1005,962,1044,962,'edge');text(1057,968,'Open / inferred edge','small')
line(1005,996,1044,996,'ghost');text(1057,1002,'Other floor / slab edge','small')
text(1005,1048,'A  Hall view hits workshop.','small')
text(1005,1080,'B  Attic needs a house below it.','small')
text(1005,1112,'C  Basement extends west of den.','small')
text(1005,1163,'Missing from the current house:','small')
text(1005,1187,'Kitchen, bath, bedrooms, a front','small')
text(1005,1211,'entrance and a garage vehicle door.','small')
text(40,1300,'Dimensions are approximate scene units, not construction measurements. Solid lines follow authored wall runs; dashed edges do not invent missing walls.','small')
s.append('</svg>');(out/'current-layout.svg').write_text('\n'.join(s))
