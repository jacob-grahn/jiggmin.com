"""Smooth painted hallway window members, retaining their original mean colour."""
import bpy

def pack_window_uv(mesh, layer, size=1024):
    """Reserve padded cells with at least 32 texels across each planar face."""
    cell, padding, minimum = 96, 12, 32
    maximum, columns = cell - 2 * padding, size // cell
    if len(mesh.polygons) > columns * columns:
        raise ValueError('Window atlas has too many faces')
    for number, face in enumerate(mesh.polygons):
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = [i for i in range(3) if i != axis]
        points = [mesh.vertices[v].co for v in face.vertices]
        low = [min(p[a] for p in points) for a in axes]
        high = [max(p[a] for p in points) for a in axes]
        span = [high[i] - low[i] for i in range(2)]
        extent = [max(minimum, maximum * s / max(span)) for s in span]
        col, row = number % columns, number // columns
        for li in face.loop_indices:
            point = mesh.vertices[mesh.loops[li].vertex_index].co
            layer.data[li].uv = tuple((origin * cell + padding +
                                      (point[a] - low[i]) / span[i] * extent[i]) / size
                                     for i, (a, origin) in enumerate(zip(axes, [col, row])))

def smooth_hall_window(scene):
    count = 0
    for obj in scene.objects:
        if obj.type != 'MESH' or not obj.name.startswith('Finish / hall-right') or 'glass' in obj.name:
            continue
        obj.data = obj.data.copy()
        for index, source in enumerate(list(obj.data.materials)):
            material = source.copy()
            material.name = 'Smooth hall window / ' + source.name
            material.use_nodes = True
            shader = material.node_tree.nodes.get('Principled BSDF')
            color = tuple(shader.inputs['Base Color'].default_value)
            links = shader.inputs['Base Color'].links
            if links and links[0].from_node.type == 'TEX_IMAGE':
                image = links[0].from_node.image
                pixels = image.pixels[:]
                step = max(1, len(pixels) // (4 * 4096))
                samples = range(0, len(pixels) // 4, step)
                # Blender exposes the stored byte-image samples in sRGB; the
                # Principled colour socket expects scene-linear reflectance.
                convert = (lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4) if image.colorspace_settings.name == 'sRGB' else (lambda c: c)
                color = tuple(sum(convert(pixels[i * 4 + channel]) for i in samples) / len(samples)
                              for channel in range(3)) + (1,)
            for socket in ('Base Color', 'Normal', 'Roughness'):
                for link in list(shader.inputs[socket].links):
                    material.node_tree.links.remove(link)
            shader.inputs['Base Color'].default_value = color
            shader.inputs['Roughness'].default_value = .94
            material.diffuse_color = color
            obj.data.materials[index] = material
        obj['hall_window_finish'] = 'smooth original palette'
        count += 1
    print('SMOOTH_HALL_WINDOW', count, flush=True)
    return count

if __name__ == '__main__':
    import shutil
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    for name in ('house-release.blend',):
        path = root / 'scene' / name
        bpy.ops.wm.open_mainfile(filepath=str(path))
        backup = path.with_name(path.stem + '-before-window-finish.blend')
        if not backup.exists():
            shutil.copy2(path, backup)
        assert smooth_hall_window(bpy.context.scene) == 6
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
