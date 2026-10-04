"""Author separate surfaces where a slab belongs to rooms on different floors."""
import bpy,bmesh

def split_slab_surfaces(scene):
    changed=[]
    for obj in list(scene.objects):
        if obj.type!='MESH':continue
        name=obj.get('source_object',obj.name)
        cellar=name.startswith('Main floor')
        attic=name.startswith('Attic floor / hall ceiling')
        if not (cellar or attic):continue
        normal=obj.matrix_world.to_3x3().inverted().transposed()
        selected={p.index for p in obj.data.polygons if (normal@p.normal).normalized().z*(-1 if cellar else 1)>.9}
        if not selected:continue
        prefix='Cellar slab underside / ' if cellar else 'Attic slab upper / '
        group='basement-slab-ceilings' if cellar else 'attic-floor'
        source=obj.data
        def subset(keep,label):
            mesh=source.copy();mesh.name=label;bm=bmesh.new();bm.from_mesh(mesh);bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.index not in keep],context='FACES')
            bm.to_mesh(mesh);bm.free();mesh.update();return mesh
        part=obj.copy();part.data=subset(selected,prefix+name);part.name=prefix+name
        part['source_object']=part.name;part['source_slab_object']=part.name
        part['atlas_group']=group;part['release_baked']=group
        part['source_shell_room']='basement' if cellar else 'attic';part['preview_kind']='ceiling' if cellar else 'floor'
        for collection in obj.users_collection:collection.objects.link(part)
        obj.data=subset(set(range(len(source.polygons)))-selected,name)
        changed.append(part.name)
    return changed
