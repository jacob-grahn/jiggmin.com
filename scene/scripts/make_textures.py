from PIL import Image, ImageDraw, ImageFont
import math, random
from pathlib import Path
random.seed(17)
ROOT=Path(__file__).resolve().parents[1]/'textures'
ROOT.mkdir(exist_ok=True)
def font(n):
 return ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',n)
# Phosphor screen: restrained scanlines and quiet boot typography.
w,h=1200,900
im=Image.new('RGB',(w,h)); p=im.load()
for y in range(h):
 for x in range(w):
  d=((x-w/2)/(w*.7))**2+((y-h/2)/(h*.7))**2
  v=max(.1,1-d*.65)*(0.93 if y%3==0 else 1)+random.uniform(-.015,.015)
  p[x,y]=(int(12*v),int(86*v),int(96*v))
d=ImageDraw.Draw(im)
d.text((600,335),'J I G G M I N',font=font(39),fill=(124,208,200),anchor='mm')
d.text((600,465),'INSERT CARTRIDGE',font=font(22),fill=(99,175,171),anchor='mm')
d.line((505,405,695,405),fill=(37,112,118),width=2)
d.text((600,807),'A FEW GOOD HOURS',font=font(12),fill=(39,114,119),anchor='mm')
im.save(ROOT/'crt-idle.png')
# Original placeholder label art, not licensed game covers.
palettes=[((15,30,43),(43,95,100),(213,170,100)),((32,23,54),(98,56,95),(235,140,95)),((26,43,46),(71,116,98),(231,210,145)),((23,30,55),(43,62,115),(161,194,215)),((52,30,32),(131,65,53),(229,180,117))]
for i,(bg,land,accent) in enumerate(palettes):
 im=Image.new('RGB',(640,680),bg); d=ImageDraw.Draw(im)
 for y in range(500):
  t=y/500; d.line((0,y,640,y),fill=tuple(int(c*(1-t*.4)) for c in bg))
 d.ellipse((375,80,525,230),fill=accent)
 for k in range(3):
  pts=[(0,500)]+[(x,280+k*70+int(60*math.sin(x/95+k*2))+random.randrange(-14,14)) for x in range(0,681,40)]+[(640,500)]
  d.polygon(pts,fill=tuple(int(c*(1-.2*k)) for c in land))
 for _ in range(35):
  x,y=random.randrange(640),random.randrange(30,245); d.ellipse((x,y,x+2,y+2),fill=accent)
 d.rectangle((0,510,640,680),fill=(213,205,181))
 d.text((30,535),'JIGGMIN / ARCHIVE',font=font(25),fill=bg)
 d.text((30,594),f'VOL. 0{i+1}',font=font(42),fill=bg)
 d.rectangle((540,535,606,645),outline=bg,width=3)
 for y in range(545,635,7):d.line((551,y,594,y),fill=bg,width=random.choice([1,2,3]))
 im.save(ROOT/f'cartridge-{i+1}.png')
# Woven rug, geometric medallions, distressed thread texture.
w,h=1600,1100; im=Image.new('RGB',(w,h),(54,35,32));d=ImageDraw.Draw(im)
for off,col,th in [(22,(114,67,48),8),(40,(179,139,85),7),(59,(37,58,62),26),(89,(162,99,65),5),(111,(192,154,98),4),(130,(32,55,59),20),(152,(146,76,50),4)]:
 d.rectangle((off,off,w-off,h-off),outline=col,width=th)
for x in range(190,w-160,120):
 for y in range(190,h-160,130):
  d.polygon([(x,y-38),(x+28,y),(x,y+38),(x-28,y)],fill=(123,70,47),outline=(172,126,78),width=3)
for size,col in [(330,(175,126,79)),(308,(37,59,61)),(273,(127,67,44)),(238,(174,124,76)),(203,(33,52,55)),(138,(145,78,48)),(95,(187,144,85)),(56,(37,58,60))]:
 d.polygon([(800,550-size),(800+size*1.6,550),(800,550+size),(800-size*1.6,550)],fill=col)
p=im.load()
for y in range(h):
 for x in range(w):
  v=random.uniform(.75,1.1)*(0.84 if y%3==0 else 1)
  p[x,y]=tuple(int(c*v) for c in p[x,y])
im.save(ROOT/'woven-rug.jpg',quality=92)
# Personal studio poster.
im=Image.new('RGB',(700,1000),(20,32,42));d=ImageDraw.Draw(im)
d.ellipse((270,250,590,570),fill=(173,159,125))
for k in range(4):
 pts=[(0,1000)]+[(x,590+k*90+70*math.sin(x/110+k)) for x in range(0,751,35)]+[(700,1000)]
 d.polygon(pts,fill=(22+k*5,40+k*5,46+k*5))
d.text((65,67),'AFTER',font=font(83),fill=(208,193,155));d.text((65,162),'HOURS',font=font(83),fill=(208,193,155))
d.text((65,920),'INDEPENDENT GAMES',font=font(22),fill=(188,172,136))
im.save(ROOT/'after-hours.png')
print('Created 8 original scene textures')
