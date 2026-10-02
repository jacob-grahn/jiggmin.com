"""Cloud-only entry point: require an NVIDIA GPU, then run the existing recipe."""
import json
import os
import runpy
import time
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
preferences = bpy.context.preferences.addons['cycles'].preferences
preferences.compute_device_type = 'OPTIX'
preferences.get_devices()
devices = []
for device in preferences.devices:
    device.use = device.type == 'OPTIX'
    if device.use:
        devices.append(device.name)
if not devices:
    raise RuntimeError('No OptiX GPU found; refusing a silent CPU fallback')
for scene in bpy.data.scenes:
    scene.cycles.device = 'GPU'

# Packed textures are portable. Relocate any unpacked project-relative images.
missing = []
for image in bpy.data.images:
    if image.source != 'FILE' or image.packed_file:
        continue
    original = bpy.path.abspath(image.filepath)
    if '/scene/' in original:
        image.filepath = str(root / 'scene' / original.split('/scene/', 1)[1])
    if image.filepath and not Path(bpy.path.abspath(image.filepath)).exists():
        missing.append(image.name)
if missing:
    raise RuntimeError('Missing unpacked textures: ' + ', '.join(missing))

print('CLOUD_GPU', json.dumps(devices), flush=True)
started = time.monotonic()
target = os.environ.get('BAKE_TARGET', 'house')
recipe = 'bake_den.py' if target == 'den' else 'bake_house_release.py'
if target == 'hallway-style': recipe = 'bake_hallway_style.py'
if target == 'house-atlases': recipe = 'bake_house_atlases.py'
runpy.run_path(str(root / 'scene/scripts' / recipe), run_name='__main__')
quality = os.environ.get('BAKE_QUALITY', 'test')
out = root / 'scene/renders/den-uv-bake' if target == 'den' else root / 'scene/exports/house-release' / quality
if target == 'hallway-style': out = root / 'scene/renders/hallway-style'
if target == 'house-atlases': out = root / 'scene/renders/house-atlases'
(out / 'cloud-report.json').write_text(json.dumps({
    'blender': bpy.app.version_string,
    'backend': 'OPTIX',
    'devices': devices,
    'seconds': round(time.monotonic() - started, 2),
}, indent=2) + '\n')
