"""Compose cartridge labels from the mirrored game thumbnails."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,textwrap
R=Path(__file__).resolve().parents[2]
font='/System/Library/Fonts/Menlo.ttc'
f=lambda n:ImageFont.truetype(font,n)
for i,g in enumerate(json.loads((R/'data/games.json').read_text())['games'],1):
 im=Image.new('RGB',(600,520),'#d3c6a6');d=ImageDraw.Draw(im)
 d.rectangle((0,0,600,58),fill='#263e40');d.text((22,14),'JIGGMIN  /  GAME LIBRARY',font=f(24),fill='#ece2c5')
 thumb=Image.open(R/g['thumbnail']['file']).convert('RGB').resize((560,280),Image.Resampling.LANCZOS);im.paste(thumb,(20,76))
 for j,line in enumerate(textwrap.wrap(g['title'].upper(),25)):d.text((22,375+j*31),line,font=f(27),fill='#263333')
 d.text((22,478),f'J / 01                          {i:02d}',font=f(19),fill='#465455')
 im.save(R/f'scene/textures/game-{i:02d}.png')
 # Horizontal spine artwork is rotated upright on the narrow cartridge edge.
 sp=Image.new('RGB',(760,180),'#cbbf9e');sd=ImageDraw.Draw(sp)
 sd.rectangle((0,0,70,180),fill='#38575b');sd.text((12,72),f'{i:02d}',font=f(29),fill='#eee4c9')
 size=min(33,int(1040/max(1,len(g['title']))));sd.text((90,70),g['title'].upper(),font=f(size),fill='#263333')
 sp.rotate(90,expand=True).save(R/f'scene/textures/spine-{i:02d}.png')
