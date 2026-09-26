"""Replace the placeholder pad with one original mobile-ready J/01 controller."""
import bpy,math,runpy
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[1];S=bpy.context.scene
ns=runpy.run_path(str(R/'scripts/build_den.py'));g=ns['box'].__globals__;g['S']=S;g['M']={m.name:m for m in bpy.data.materials}
# Replace only the earlier controller assembly; keep console ports.
for o in list(S.objects):
 if o.name.startswith(('Original two-button gamepad','Directional horizontal','Directional vertical','Controller button','Controller cable')):
  bpy.data.objects.remove(o,do_unlink=True)
if '08 • J01 controller' in bpy.data.collections:
 for o in list(bpy.data.collections['08 • J01 controller'].objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.collections.remove(bpy.data.collections['08 • J01 controller'])
C=ns['group']('08 • J01 controller');M=g['M'];box=ns['box'];cyl=ns['cyl'];ball=ns['ball'];line=ns['line'];text=ns['text']
root=bpy.data.objects.new('CONTROLLER • J01 mobile dock',None);C.objects.link(root)
root['role']='mobile_controller';root['controls']='joystick,A,B,quit';root['mobile_behavior']='lift from tabletop, dock below game, activate HTML touch targets';root['input_profile']='per-game; optional';root['quit_action']='release all held input and return to room'
parts=[]
def part(o,role=None):
 o.parent=root
 if role:o['role']=role
 parts.append(o);return o
# Broad rounded shell, original design with no distinctive third-party controller silhouette.
part(box('Pad • lower graphite shell',(0,0,.065),(1.0,.54,.13),M['Graphite ABS'],.085))
part(box('Pad • rubber seam',(0,0,.133),(.975,.519,.014),M['Rubber'],.065))
part(box('Pad • upper warm grey face',(0,0,.156),(.982,.522,.050),M['Warm grey ABS'],.065))
for x in [-.345,.345]:part(box('Pad • underside grip',(x,.012,.027),(.23,.39,.045),M['Rubber'],.034))
# Thumbstick with recessed socket, boot, visible stem and rubber rim.
part(cyl('Joystick • recessed well',(-.278,0,.183),.143,.009,M['Rubber']))
part(cyl('Joystick • socket rim',(-.278,0,.188),.123,.015,M['Brushed pewter']))
part(ball('Joystick • flexible boot',(-.278,0,.202),(.10,.10,.047),M['Rubber']))
stick=bpy.data.objects.new('JOYSTICK • pivot',None);C.objects.link(stick);stick.parent=root;stick.location=(-.278,0,.206);stick['role']='joystick';stick['mapping']='per-game digital directions or pointer velocity'
o=cyl('Joystick • shaft',(0,0,.041),.029,.083,M['Brushed pewter']);o.parent=stick
cap=ball('Joystick • thumb cap',(0,0,.098),(.103,.103,.029),M['Graphite ABS']);cap.parent=stick
# A thin toroidal rubber lip gives the thumb cap an unmistakable joystick profile.
bpy.ops.mesh.primitive_torus_add(major_radius=.080,minor_radius=.009,major_segments=48,minor_segments=12,location=(0,0,.114));o=ns['own'](bpy.context.object,'Joystick • thumb rim',M['Rubber']);o.parent=stick
for p in o.data.polygons:p.use_smooth=True
for i in range(4):
 a=i*math.pi/2;xx=-.278+math.cos(a)*.164;yy=math.sin(a)*.164
 part(box('Joystick • direction mark',(xx,yy,.185),(.021 if i%2 else .012,.012 if i%2 else .021,.002),M['Ivory ink'],.002))
# Different colors and permanently labeled physical buttons.
matA=ns['material']('Button A • muted jade',(.075,.23,.20),.30,noise=.07,scale=130)
matB=ns['material']('Button B • burnt amber',(.45,.17,.052),.34,noise=.07,scale=130)
for name,x,y,m in [('A',.225,-.073,matA),('B',.365,.068,matB)]:
 part(cyl('Button '+name+' • surround',(x,y,.185),.085,.012,M['Rubber']))
 key=part(cyl('BUTTON_'+name,(x,y,.203),.068,.034,m),'button_'+name.lower())
 label=text('Button '+name+' • legend',name,(x,y-.025,.224),.064,M['Ivory ink'],(0,0,0));part(label)
 key['mapping']='assigned by cartridge control profile'
# Small protected quit button, separated from action buttons.
part(box('Quit • recessed surround',(.03,.147,.184),(.156,.079,.008),M['Rubber'],.023))
quit=part(box('BUTTON_QUIT',(.03,.147,.194),(.134,.057,.017),M['Graphite ABS'],.019),'quit');quit['action']='release inputs, pause/unload game, return to den'
part(text('Quit • legend','QUIT',(.03,.136,.204),.026,M['Ivory ink'],(0,0,0)))
part(text('Pad • wordmark','J / 0 1',(.045,-.119,.184),.029,M['Graphite ABS'],(0,0,0)))
part(ball('Pad • status lamp',(.035,.036,.184),(.008,.008,.003),M['Amber LED']))
# Short grip grooves along the front edge.
for x in [-.435,-.406,-.377,.377,.406,.435]:
 part(box('Pad • grip notch',(x,-.247,.105),(.008,.006,.036),M['Rubber'],.002))
root.location=(-1.34,-2.02,.706);root.rotation_euler=(0,0,-.13)
# Move two cartridges back just enough to give the controller a clear resting place.
bpy.data.objects['CARTRIDGE_01 • Archive placeholder'].location=(-1.84,-1.18,.729)
bpy.data.objects['CARTRIDGE_02 • Archive placeholder'].location=(-1.04,-1.15,.704)
# Cable stays a separate prop so it can fade when the controller rises on mobile.
# Connector at rear of the pad and an easy coil to its left.
cable=line('Controller • detachable cable',[(-1.31,-1.75,.81),(-1.47,-1.62,.71),(-1.86,-1.79,.706),(-1.94,-1.97,.706),(-1.67,-1.86,.706),(-.86,-1.74,.707),(-.44,-1.68,.85)],.009,M['Rubber']);cable['role']='controller_cable';cable['mobile_behavior']='fade during lift'
S['controller_design']='One original J01 controller: joystick, A, B, small QUIT; web inputs not implemented.'
S.render.filepath=str(R/'renders/midnight-den-controller.png');S.cycles.samples=64
bpy.ops.wm.save_as_mainfile(filepath=str(R/'midnight-den-controller.blend'))
print('CONTROLLER_SAVED',len(parts),'parts',flush=True)
bpy.ops.render.render(write_still=True)
# Close-up render for clearly reviewing the requested controls; do not save this camera change.
cam=S.camera;cam.location=(-.84,-3.55,2.25);target=Vector((-1.32,-1.96,.85));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=62;cam.data.dof.focus_distance=(target-cam.location).length;cam.data.dof.aperture_fstop=8
S.render.resolution_x=1200;S.render.resolution_y=850;S.cycles.samples=64;S.render.filepath=str(R/'renders/controller-detail.png')
bpy.ops.render.render(write_still=True)
