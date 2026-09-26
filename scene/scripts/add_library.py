"""Expand the five tabletop cartridges into a complete 23-game collection."""
import bpy,math,runpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];S=bpy.context.scene
ns=runpy.run_path(str(R/'scripts/build_den.py'));g=ns['box'].__globals__;g['S']=S;g['M']={m.name:m for m in bpy.data.materials}
M=g['M'];box=ns['box'];plane=ns['plane'];picture=ns['picture']
C=bpy.data.collections['05 • Pick-up cartridges'];g['C']=C
existing=sorted([o for o in S.objects if o.get('role')=='draggable_cartridge'],key=lambda o:o.name)
poses=[(o.location.copy(),o.rotation_euler.copy()) for o in existing]
for root in existing:
 for o in list(root.children):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(root,do_unlink=True)
games=json.loads((R.parent/'data/games.json').read_text())['games'];inventory=[]
for i,game in enumerate(games,1):
 root=bpy.data.objects.new(f'CARTRIDGE_{i:02d} • {game["title"]}',None);C.objects.link(root)
 root['role']='draggable_cartridge';root['game_id']=game['id'];root['placeholder']=False;root['storage']='table' if i<=5 else 'rack';root['title']=game['title']
 parts=[box('Cartridge • shell',(0,0,.23),(.51,.145,.46),M['Warm grey ABS'],.028),box('Cartridge • label well',(0,-.077,.249),(.411,.011,.36),M['Graphite ABS'],.015),plane('Cartridge • '+game['title'],(0,-.084,.249),.381,.331,picture(f'Game {i:02d} label',f'game-{i:02d}.png')),box('Cartridge • connector',(0,0,.015),(.32,.08,.03),M['Rubber'],.003)]
 for x in [-.227,.227]:
  for z in [.09,.14,.19,.24,.29,.34]:parts.append(box('Cartridge • grip',(x,-.078,z),(.02,.008,.006),M['Graphite ABS'],.002))
 sp=plane('Cartridge • spine '+game['title'],(-.257,0,.247),.112,.37,picture(f'Game {i:02d} spine',f'spine-{i:02d}.png'));sp.rotation_euler.z=-math.pi/2;parts.append(sp)
 for p in parts:p.parent=root
 if i<=5:root.location,root.rotation_euler=poses[i-1]
 else:
  row,col=divmod(i-6,6);root.location=(-2.74+(col-2.5)*.18,0,.12+row*.52);root.rotation_euler.z=math.pi/2
 inventory.append({'object':root.name,'gameId':game['id'],'storage':root['storage']})
C=ns['group']('09 • Cartridge library rack')
# Slim walnut rack, three shelves with six independently removable cartridges each.
for x in [-3.36,-2.12]:box('Library • walnut side',(x,.015,.875),(.055,.65,1.70),M['Walnut'],.018)
box('Library • dark back',(-2.74,.326,.875),(1.25,.028,1.70),M['Graphite ABS'],.007)
for z in [.095,.615,1.135,1.695]:
 box('Library • shelf',(-2.74,.01,z),(1.22,.64,.045),M['Walnut'],.01)
 if z<1.6:box('Library • brass shelf edge',(-2.74,-.314,z+.015),(1.17,.012,.025),M['Brass'],.004)
for x in [-3.23,-2.25]:box('Library • rubber foot',(x,.01,.034),(.13,.5,.05),M['Rubber'],.009)
ns['text']('Library • header','THE COLLECTION',(-2.74,-.319,1.62),.042,M['Ivory ink'])
S.camera.data.lens=39
S['art_direction']='Rainy midnight den; original J/01 console; 23 actual game cartridges: 5 tabletop, 18 rack.'
roots=[o for o in S.objects if o.get('role')=='draggable_cartridge'];assert len(roots)==23 and len({o['game_id'] for o in roots})==23
assert sum(o['storage']=='table' for o in roots)==5
(R/'cartridges.json').write_text(json.dumps(inventory,indent=2)+'\n')
bpy.ops.file.pack_all();S.render.filepath=str(R/'renders/midnight-den-library.png');S.cycles.samples=64
bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den-library.blend'))
print('VERIFIED: 23 unique games, 5 tabletop, 18 rack',flush=True)
bpy.ops.render.render(write_still=True)
