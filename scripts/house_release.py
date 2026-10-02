"""Repeatable original-style house pipeline. Publishes locally; never deploys."""
import argparse,json,os,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BLENDER=os.environ.get('BLENDER','/Applications/Blender.app/Contents/MacOS/Blender')
def run(args,**kwargs):subprocess.run(args,cwd=ROOT,check=True,**kwargs)
def blender(source,script,*args):
 logs=ROOT/'scene/renders/house-release';logs.mkdir(parents=True,exist_ok=True)
 log=logs/(Path(script).stem+('-test' if '--test' in args else '')+'.log')
 command=[BLENDER,'-b',str(ROOT/source),'--threads','4','--python-exit-code','1','--python',str(ROOT/script),'--',*args]
 print(f'Running {Path(script).name}; full log: {log}',flush=True)
 with log.open('w') as output:
  process=subprocess.Popen(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  for line in process.stdout:
   output.write(line);output.flush()
   if line.startswith(('BAKE_GROUP','REUSED_ATLAS','RESTORED','HOUSE_RELEASE_PREPARED','HOUSE_BAKE_COMPLETE')):print(line.strip(),flush=True)
  if process.wait():raise SystemExit(f'Blender failed. See {log}')
def check(quality):
 env={**os.environ,'HOUSE_RELEASE_DIR':f'scene/exports/house-release/{quality}'}
 run(['node','--test','tests/house-release.test.mjs','tests/house-bake.test.mjs','tests/house-fixture-refinements.test.mjs'],env=env)
 run(['node','scripts/check-house-release.mjs'],env=env)
def source_key():
 paths=['scene/house-release.blend','scene/exports/house-release/bake-input/structure.glb','scene/exports/house-release/bake-input/basement.glb','scene/exports/house-release/bake-input/attic.glb','scene/scripts/bake_house_release.py','scene/scripts/house_bake_lighting.py','scene/scripts/house_bake_groups.py']
 return hashlib.sha256(b''.join((ROOT/path).read_bytes() for path in paths)).hexdigest()
p=argparse.ArgumentParser(description=__doc__);p.add_argument('step',choices=['prepare','test','release','publish']);p.add_argument('--review',action='store_true',help='Stage the reviewed fixture shapes before the small bake');args=p.parse_args()
if args.step=='prepare':
 blender('scene/house-plan-preview.blend','scene/scripts/prepare_house_release.py')
 blender('scene/house-release.blend','scene/scripts/restore_house_style.py')
 run(['node','scripts/classify-house-release.mjs'])
elif args.step in ['test','release']:
 if args.step=='test':
  if args.review:
   out='scene/exports/house-release/review-reference';(ROOT/out).mkdir(parents=True,exist_ok=True);env={**os.environ,'HOUSE_REFERENCE_OUT':out}
   run(['node','scripts/restore-house-style.mjs'],env=env);run(['node','scripts/stage-house-review.mjs']);run(['node','scripts/prepare-house-bake-input.mjs'],env=env)
  else:run(['node','scripts/restore-house-style.mjs']);run(['node','scripts/prepare-house-bake-input.mjs'])
 else:
  report=json.loads((ROOT/'scene/exports/house-release/test/bake-report.json').read_text())
  if report.get('sourceKey')!=source_key():raise SystemExit('Run release:house:test for the current geometry and lighting before the expensive release bake.')
 quality='test' if args.step=='test' else 'final'
 blender('scene/house-release.blend','scene/scripts/bake_house_release.py','--'+args.step)
 run(['node','scripts/assemble-house-bake.mjs',quality]);check(quality)
else:
 run(['node','scripts/publish-house-release.mjs'])
 run(['node','--test','tests/house-release.test.mjs','tests/house-style.test.mjs','tests/house-bake.test.mjs'])
