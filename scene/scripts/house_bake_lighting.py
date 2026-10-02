"""Original UV-bake window rig, placed at the assembled house's actual apertures."""
import bpy,math
from mathutils import Vector

def configure(scene):
 for obj in scene.objects:
  if obj.type=='LIGHT':obj.hide_render=True
 world=bpy.data.worlds.new('Original room soft night');world.use_nodes=True;scene.world=world
 world.node_tree.nodes['Background'].inputs['Color'].default_value=(.24,.22,.19,1)
 world.node_tree.nodes['Background'].inputs['Strength'].default_value=.10
 def area(name,location,target,power,color,size,height=None,spread=125):
  light=bpy.data.lights.new(name,'AREA');light.energy=power;light.color=color;light.shape='RECTANGLE' if height else 'DISK';light.size=size
  if height:light.size_y=height;light.spread=math.radians(spread)
  obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=location
  obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
 # Native Z-up. Match the aperture height/width and place each emitter outside
 # the opening: sills and inner jamb faces now actually receive its light.
 # Cellar windows use opaque backdrop art on uncut masonry. Their incoming
 # moonlight must start just inside the sill instead of behind that masonry.
 # A lower centre and wider source soften the former bright ceiling bands.
 area('Hall right window spill',(12.18,-7.55,1.35),(8.5,-7.1,.25),140,(.13,.34,1),.93,.72,50)
 area('Entry window spill',(8.4,-12.18,1.35),(7.3,-9,.25),110,(.13,.34,1),.73,.72,50)
 area('Rear hall window spill',(5.55,.18,1.35),(5.55,-3,.25),110,(.13,.34,1),.93,.72,50)
 area('Bench window spill',(14.45,.38,1.625),(14.2,-3.4,.85),155,(.24,.48,1),2.23,1.18)
 area('Side window spill',(17.18,-2.8,1.625),(14.5,-3,.85),190,(.24,.48,1),1.53,1.18)
 area('Cellar left window spill',(3.36,-.58,-1.05),(3.6,-3,-3.2),180,(.24,.48,1),1.70,.57)
 area('Cellar right window spill',(8.64,-.58,-1.05),(8.3,-3,-3.2),145,(.24,.48,1),1.70,.57)
 area('Cellar side window spill',(.61,-4.05,-1.05),(3,-4.05,-3.2),150,(.24,.48,1),1.70,.57)
 area('Gable front moonlight spill',(6,.18,4.05),(6,-3,3.3),260,(.24,.48,1),1.33,.83)
 area('Gable rear moonlight spill',(6,-12.18,4.05),(6,-8.5,3.3),260,(.24,.48,1),1.33,.83)
 # The existing den's original illumination is retained in the runtime. This
 # low window spill illuminates only its newly exposed doorway surround.
 area('Den window spill',(-.96,-10.764,1.5),(2,-9.4,.9),70,(.24,.48,1),1.0)
 # Distant backlight touches occasional forest edges while their room-facing
 # sides remain almost black. This source is baked; never exported as a light.
 area('Exterior moon backlight',(45,-5.7,4),(10,-7.55,1.65),3500,(.20,.36,.65),8)
 scene.render.engine='CYCLES';scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=6
 return {'source':'scene/scripts/bake_room.py','worldStrength':.10,'viewTransform':'AgX','exposure':-1.3,'atticExposure':-.7,'saturation':1.2,'lighting':'blue windows and exterior moon backlight','windowRevision':4,'cellarEmitters':'room side of opaque window backdrops','apertureEmitters':'outside, rectangular, lowered hall sources','liveWindowLights':False}
