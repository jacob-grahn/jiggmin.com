"""Complete the wide-view den before applying its illustrated material pass.

The doorway matches the shared hallway opening (den-local Blender y=-4).
The closed leaf exports separately so travel can use the hallway's moving door.
"""
import bpy, runpy, math
from pathlib import Path

def complete():
    if bpy.context.scene.get('den_completed'): return
    helpers=runpy.run_path(str(Path(__file__).with_name('build_den.py')))
    g=helpers['box'].__globals__
    collection=bpy.data.collections.new('Den wide-view completion')
    bpy.context.scene.collection.children.link(collection)
    g['C']=collection
    box,ball,line=helpers['box'],helpers['ball'],helpers['line']
    cloth=bpy.data.materials['Indigo upholstery']
    wood=bpy.data.materials['Walnut'];plaster=bpy.data.materials['Plaster']
    box('Armchair far arm',(4.05,-.95,.87),(.26,1.5,.35),cloth,.11)
    box('Armchair upholstered base',(3.52,-.88,.32),(1.27,1.43,.25),cloth,.07)
    box('Armchair seat cushion',(3.52,-.96,.68),(.91,1.23,.19),cloth,.075)
    for x in [3.02,4.02]:
        for y in [-1.45,-.32]:
            box('Armchair walnut foot',(x,y,.13),(.13,.14,.26),wood,.025)
    for x in [2.88,4.16]:
        line('Armchair arm piping',[(x,-1.60,.92),(x,-1.57,1.015),(x,-.28,1.015),(x,-.23,.94)],.004,cloth)
    line('Armchair cushion piping',[(3.10,-.37,.72),(3.10,-1.51,.72),(3.94,-1.51,.72),(3.94,-.37,.72)],.004,cloth)
    # Continue the rear wall to the side wall, closing the previously open corner.
    box('Back wall right return',(4.22,1.95,2.4),(.56,.14,4.8),plaster)
    box('Baseboard rear return',(4.17,1.84,.16),(.65,.09,.28),wood)
    # Full-height wall with a genuine 1.18 m opening and a 2.42 m head.
    for lo,hi in [(-6.5,-4.59),(-3.41,1.95)]:
        box('Right wall beside doorway',(4.5,(lo+hi)/2,2.4),(.14,hi-lo,4.8),plaster)
        box('Baseboard right wall',(4.39,(lo+hi)/2,.16),(.09,hi-lo,.28),wood)
    box('Right wall above doorway',(4.5,-4,3.61),(.14,1.18,2.38),plaster)
    for y in [-4.565,-3.435]:
        box('Den doorway jamb',(4.48,y,1.2),(.235,.055,2.4),wood,.004)
        box('Den doorway casing',(4.375,y,1.225),(.125,.115,2.45),wood,.008)
    box('Den doorway head jamb',(4.48,-4,2.385),(.235,1.185,.065),wood,.004)
    box('Den doorway head casing',(4.375,-4,2.44),(.125,1.30,.115),wood,.008)
    box('Den doorway threshold',(4.48,-4,.011),(.27,1.19,.024),wood,.005)
    before=set(bpy.data.objects)
    box('Den closed door leaf',(4.505,-4,1.165),(.085,1.04,2.33),wood,.008)
    for z in [.57,1.60]:
        box('Den recessed door panel',(4.456,-4,z),(.014,.81,.77),wood,.008)
    ball('Den door brass knob',(4.395,-3.63,1.03),(.06,.046,.046),bpy.data.materials['Brass'])
    for o in set(bpy.data.objects)-before:o['role']='den_door'
    # Continue the existing floorboard rhythm beneath the foreground doorway.
    for j in range(7):
        for k in range(4):
            box('Den foreground oak floorboard',(-4.5+k*2.6+((j+1)%2)*.5,-4.03-j*.43,-.055),(2.59,.423,.10),bpy.data.materials['Floor oak'],.006)
    bpy.context.scene['den_completed']=True
