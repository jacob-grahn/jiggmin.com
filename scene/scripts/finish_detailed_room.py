"""Assemble the clean background plate and install the matching browser assets."""
import json, shutil, struct, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
R=Path(__file__).resolve().parents[2];source=R/('scene/renders/illustrated-export' if '--illustrated' in sys.argv else 'scene/renders/detailed-export');target=R/'web/assets'
full=Image.open(source/'room-props.png').convert('RGB');patch=Image.open(source/'room-clean-patch.png').convert('RGB')
assert full.size==patch.size
w,h=full.size;x0,y0,x1,y1=json.loads((source/'border.json').read_text())
# Feather only the outside of the padded patch to avoid a denoising seam.
mask=Image.new('L',full.size,0);d=ImageDraw.Draw(mask)
d.rectangle((int(x0*w)+8,h-int(y1*h)+8,int(x1*w)-8,h-int(y0*h)-8),fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(3))
clean=Image.composite(patch,full,mask)
clean.save(target/'room-lighting.webp',quality=93,method=6)
# The three props occupy only a small part of the full plate. Crop their atlas to
# avoid uploading another mostly redundant 32 MiB texture on phones.
left,right=int(x0*w),int(x1*w);bottom,top=int(y0*h),int(y1*h)
full.crop((left,h-top,right,h-bottom)).save(target/'room-props.webp',quality=93,method=6)
b=(source/'room.glb').read_bytes();length=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+length])
room=next(n for n in g['nodes'] if n.get('extras',{}).get('role')=='room_geometry')
room['extras']['propBakeRect']=[left/w,bottom/h,(right-left)/w,(top-bottom)/h]
encoded=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*(-len(encoded)%4)
rest=b[20+length:];out=struct.pack('<III',0x46546c67,2,20+len(encoded)+len(rest))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest
(target/'room.glb').write_bytes(out);shutil.copy2(source/'colliders.json',target/'colliders.json')
for name in ['room.glb','room-lighting.webp','room-props.webp']:
 size=(target/name).stat().st_size
 assert size<25*1024*1024,(name,size,'exceeds the hosting asset limit')
 print(name,round(size/1024),'KiB')

if '--illustrated' in sys.argv:
 # Recover the original camera crop from the final wide plate, keeping the
 # loading image in sync even when only the full bake was rebuilt.
 cw,ch=w/2.3,h/1.15
 full.crop((round((w-cw)/2),round((h-ch)/2),round((w+cw)/2),round((h+ch)/2))).resize((1600,1000),Image.Resampling.LANCZOS).save(target/'den.webp',quality=93,method=6)
