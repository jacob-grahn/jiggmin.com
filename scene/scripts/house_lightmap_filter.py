"""UV-aware irradiance filtering and a normalized high-frequency noise score.

Operate on linear lighting, before multiplying the separately baked albedo.
RGB texture detail is inherently ambiguous; use the lighting pass or divide by
known albedo, never reject a wood texture simply because it has grain.
Requires NumPy (included in Blender), no third-party denoising dependency.
"""
import numpy as np


def blur(image, passes=1):
    """Separable binomial low pass; each pass has a one-texel standard deviation."""
    result = np.asarray(image, dtype=np.float32)
    for _ in range(passes):
        for axis in (0, 1):
            pads = [(0, 0)] * result.ndim
            pads[axis] = (2, 2)
            padded = np.pad(result, pads, mode='edge')
            result = sum(weight * np.take(padded, range(offset, offset + result.shape[axis]), axis=axis)
                         for offset, weight in enumerate((1/16, 4/16, 6/16, 4/16, 1/16)))
    return result


def speckle_score(image, mask=None):
    """Return 0..1 relative high-frequency contrast (0 = solid/linear gradient).

    Full-strength alternating black/white pixels score 1; half-strength contrast
    scores about .5. Noise is relative to the patch brightness, with a .002
    linear-light floor to avoid rejecting invisible quantization in darkness.
    Two-texel UV borders are excluded. This is a noise indicator, not semantic
    image recognition: fine intentional patterns also score high without albedo.
    """
    rgb = np.asarray(image, dtype=np.float32)
    if rgb.ndim == 3:
        rgb = rgb[..., :3] @ np.array([.2126, .7152, .0722], dtype=np.float32)
    if rgb.ndim != 2 or not np.isfinite(rgb).all() or np.any(rgb < 0):
        raise ValueError('Expected finite nonnegative HxW lighting or HxWxRGB')
    valid = np.ones(rgb.shape, dtype=bool) if mask is None else np.asarray(mask, dtype=bool).copy()
    if valid.shape != rgb.shape:
        raise ValueError('Mask dimensions must match the image')
    for _ in range(2):
        padded = np.pad(valid, 1, constant_values=False)
        valid = np.logical_and.reduce([padded[y:y+rgb.shape[0], x:x+rgb.shape[1]]
                                       for y in range(3) for x in range(3)])
    if not valid.any():
        raise ValueError('Too few interior pixels to measure speckle')
    smooth = blur(rgb)
    residual = np.abs(rgb - smooth)
    # A straight shadow boundary is not speckle: suppress coherent gradients.
    gx = np.gradient(rgb, axis=1); gy = np.gradient(rgb, axis=0)
    coherent = np.hypot(blur(gx), blur(gy))
    residual = np.maximum(0, residual - coherent)
    denominator = max(float(np.mean(smooth[valid])), .002)
    return float(np.clip(np.mean(residual[valid]) / denominator, 0, 1))


def chart_masks(mesh, uv, size):
    """Rasterize connected, coplanar UV charts; never mix unrelated surfaces."""
    parent = list(range(len(mesh.polygons)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    edges = {}
    for p in mesh.polygons:
        loops = list(p.loop_indices)
        for a, b in zip(loops, loops[1:] + loops[:1]):
            key = tuple(sorted((tuple(round(float(v), 6) for v in uv.data[a].uv),
                                tuple(round(float(v), 6) for v in uv.data[b].uv))))
            if key in edges:
                q = edges[key]
                if p.normal.dot(mesh.polygons[q].normal) > .9999:
                    parent[root(p.index)] = root(q)
            else: edges[key] = p.index
    mesh.calc_loop_triangles(); charts = {}
    for t in mesh.loop_triangles:
        coords = np.array([uv.data[i].uv[:] for i in t.loops]) * size
        charts.setdefault(root(t.polygon_index), []).append(coords)
    for index, triangles in charts.items():
        xy = np.concatenate(triangles)
        lo = np.maximum(0, np.floor(xy.min(axis=0)).astype(int)); hi = np.minimum(size, np.ceil(xy.max(axis=0)).astype(int))
        x0,y0 = lo; x1,y1 = hi
        if x1 <= x0 or y1 <= y0: continue
        yy,xx = np.mgrid[y0:y1, x0:x1]; xx=xx+.5; yy=yy+.5
        mask = np.zeros(xx.shape, dtype=bool)
        for a,b,c in triangles:
            d = np.cross(b-a,c-a)
            if abs(d) < 1e-8: continue
            u = ((xx-a[0])*(c[1]-a[1])-(yy-a[1])*(c[0]-a[0]))/d
            v = ((b[0]-a[0])*(yy-a[1])-(b[1]-a[1])*(xx-a[0]))/d
            mask |= (u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)
        yield index, (int(x0),int(y0),int(x1),int(y1)), mask


def filter_irradiance(image, charts, sigma=4, threshold=.12):
    """Filter Monte Carlo irradiance within each planar UV chart, then validate.

    Normalize by coverage at the chart boundary. Empty texels, another side of a
    board, and adjacent packed objects cannot bias the result. Albedo and normal
    source textures are untouched. Save the raw pass for inspection/re-filtering.
    """
    source = np.asarray(image, dtype=np.float32)
    result = source.copy(); records = []; filled = np.zeros(source.shape[:2],dtype=bool)
    for index, (x0,y0,x1,y1), mask in charts:
        patch = source[y0:y1,x0:x1,:3]
        coverage = blur(mask.astype(np.float32), passes=round(sigma*sigma))
        filtered = blur(patch * mask[...,None], passes=round(sigma*sigma)) / np.maximum(coverage[...,None], 1e-8)
        result[y0:y1,x0:x1,:3][mask] = filtered[mask]
        filled[y0:y1,x0:x1] |= mask
        try:
            before = speckle_score(patch,mask); after = speckle_score(filtered,mask)
        except ValueError:
            records.append({'chart':index,'pixels':int(mask.sum()),'status':'too-small'}); continue
        records.append({'chart':index,'pixels':int(mask.sum()),'rawScore':before,'filteredScore':after})
        if after > threshold:
            raise RuntimeError(f'Lighting speckle guard: chart {index} scores {after:.3f} > {threshold:.3f}')
    # Rebuild the bake gutter from filtered texels, not the noisy raw border.
    for _ in range(12):
        values = np.zeros_like(result[...,:3]); counts = np.zeros(filled.shape,dtype=np.float32)
        for axis,delta in ((0,-1),(0,1),(1,-1),(1,1)):
            neighbor = np.roll(filled,delta,axis=axis)
            if axis==0: neighbor[0 if delta==1 else -1,:]=False
            else: neighbor[:,0 if delta==1 else -1]=False
            counts += neighbor
            values += np.roll(result[...,:3],delta,axis=axis)*neighbor[...,None]
        new = ~filled & (counts>0)
        result[...,:3][new] = values[new]/counts[new,None]
        filled |= new
    return result, records
