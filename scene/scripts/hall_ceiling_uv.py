"""Keep the coplanar ceiling underside continuous across slab/triangle seams."""

def pack_ceiling_uv(mesh, layer, size=2048):
    pack_planar_uv(mesh, layer, size, 2)

def pack_planar_uv(mesh, layer, size=2048, axis=2):
    underside = [p for p in mesh.polygons if p.normal[axis] < -.9]
    if not underside:
        raise RuntimeError('Missing horizontal ceiling underside')
    points = [mesh.vertices[mesh.loops[i].vertex_index].co
              for p in underside for i in p.loop_indices]
    if max(p[axis] for p in points) - min(p[axis] for p in points) > .0001:
        raise RuntimeError('Surface receivers must share a plane')
    axes = [i for i in range(3) if i != axis]
    lo = [min(p[a] for p in points) for a in axes]
    extent = [max(p[a] for p in points) - lo[i] for i, a in enumerate(axes)]
    padding = 32 / size
    other = [p for p in mesh.polygons if p.normal[axis] >= -.9]
    height = .8 - 2 * padding if other else 1 - 2 * padding
    scale = min((1 - 2 * padding) / extent[0], height / extent[1])
    for p in underside:
        for i in p.loop_indices:
            point = mesh.vertices[mesh.loops[i].vertex_index].co
            layer.data[i].uv = tuple(padding + (point[a] - lo[k]) * scale
                                     for k, a in enumerate(axes))
    # The production helper also contains slab tops/sides. Retain their existing
    # packed islands in a separate strip, safely clear of the underside.
    for p in other:
        for i in p.loop_indices:
            u, v = layer.data[i].uv
            layer.data[i].uv = (padding + u * (1 - 2 * padding),
                                .82 + v * (.18 - padding))
