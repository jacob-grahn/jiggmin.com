"""Bake selected production atlases locally, validate, assemble and publish.

No cloud services. Same bake and publisher as the GPU pipeline, 64 samples,
original timber normals. Every bake input is fingerprinted before starting.
"""
import argparse, datetime, hashlib, json, os, subprocess, shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('groups',nargs='+');p.add_argument('--threads',default='6');p.add_argument('--stage-only',action='store_true')
a=p.parse_args();run=R/'scene/renders/local-atlases'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S');out=run/'output';out.mkdir(parents=True)
inputs=[R/'scene/house-release.blend',R/'scene/basement-refit.json',R/'scene/exports/house/basement.glb',*sorted((R/'scene/scripts').glob('*.py')),*[(R/f'web/assets/house/release/{n}.glb') for n in ['structure','hallway','workshop','basement','attic']]]
for directory in ['scene/exports/house-release/bake-input','scene/house-textures','scene/textures']:
 inputs.extend(x for x in (R/directory).rglob('*') if x.is_file())
(run/'input-manifest.json').write_text(json.dumps({str(x.relative_to(R)):hashlib.sha256(x.read_bytes()).hexdigest() for x in inputs},indent=2)+'\n')
baseline=run/'input-baseline';baseline.mkdir()
for asset in ['structure','hallway','workshop','basement','attic']:
 shutil.copy2(R/f'web/assets/house/release/{asset}.glb',baseline/f'{asset}.glb')
env={**os.environ,'BAKE_OUTPUT_DIR':str(out),'BAKE_ATLAS_GROUPS':','.join(a.groups),'BAKE_TRIM_NORMAL_SCALE':'1'}
command=[os.environ.get('BLENDER','/Applications/Blender.app/Contents/MacOS/Blender'),'-b','scene/house-release.blend','--threads',a.threads,'--python-exit-code','1','--python','scene/scripts/bake_house_atlases.py']
print(f'Local production bake: {out}',flush=True)
with (run/'bake.log').open('w') as log:
 process=subprocess.Popen(command,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 for line in process.stdout:
  log.write(line);log.flush()
  if line.startswith(('ROOM_UV_','ATLAS_PLAN','BAKE_IRRADIANCE','ATLAS_COMPLETE','HOUSE_ATLASES','Traceback','RuntimeError')):print(line.strip(),flush=True)
 if process.wait():raise SystemExit(f'Local bake failed; inspect {run}/bake.log')
subprocess.run(['node','scripts/assemble-house-atlases.mjs',str(out)],cwd=R,check=True)
subprocess.run(['node','--test','tests/hall-ceiling.test.mjs','tests/hall-window-wall.test.mjs','tests/house-wall-collision.test.mjs','tests/house-frame-clearance.test.mjs','tests/house-ceiling-finish.test.mjs','tests/house-atlas-ownership.test.mjs'],cwd=R,env={**os.environ,'ATLAS_REFRESH_DIR':'scene/exports/house-release/atlas-refresh'},check=True)
if not a.stage_only:subprocess.run(['node','scripts/publish-house-atlases.mjs'],cwd=R,check=True)
print(f'LOCAL_ATLASES_COMPLETE {out}',flush=True)
