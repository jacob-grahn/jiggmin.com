"""Read source models and exercise the finish pass in memory, without saving."""
import bpy,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scene/scripts'))
from house_finishes import paint_ceiling_undersides
from house_slab_ownership import split_slab_surfaces
for name in ['house-release']:
    bpy.ops.wm.open_mainfile(filepath=str(R/'scene'/(name+'.blend')))
    scene=bpy.context.scene;floors=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('Main floor')]
    assert len(floors)==8
    def signature(obj):
        return ([tuple(v.co)for v in obj.data.vertices],[[tuple(v.uv)for v in uv.data]for uv in obj.data.uv_layers],[obj.data.materials[p.material_index].name for p in obj.data.polygons])
    parts=[o for o in scene.objects if o.type=='MESH' and o.name.startswith(('Cellar slab underside / ','Attic slab upper / '))]
    assert len(parts)==16
    assert not split_slab_surfaces(scene),'Split must be idempotent'
    before={o.name:signature(o)for o in [*floors,*parts]}
    for obj in floors:
        assert all(not m.startswith('Light cream ceiling')for m in before[obj.name][2]),obj.name
    roofs=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('Main pitched roof')]
    roof_geometry={o.name:signature(o)[:2] for o in roofs}
    paint_ceiling_undersides(scene)
    assert len(roofs)==2
    for obj in roofs:
        assert signature(obj)[:2]==roof_geometry[obj.name]
        normal=obj.matrix_world.to_3x3().inverted().transposed()
        for face in obj.data.polygons:
            if (normal@face.normal).normalized().z<-.5:
                assert obj.data.materials[face.material_index].name=='Attic ceiling plywood'
        assert obj.get('ceiling_finish')=='unfinished plywood'
        assert not obj.get('ceiling_paint')
    for obj in [*floors,*parts]:assert signature(obj)==before[obj.name],obj.name
print('CELLAR_FINISH_REGRESSION_PASS',flush=True)
