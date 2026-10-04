"""Re-filter local saved trim bake passes, validate and publish locally."""
import subprocess,os,sys,json,datetime,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];source=Path(sys.argv[1]).resolve();run=R/'scene/renders/local-atlases'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-refilter');out=run/'output';out.mkdir(parents=True)
inputs=[R/'scene/house-release.blend',*sorted((R/'scene/scripts').glob('*.py')),*[R/f'web/assets/house/release/{n}.glb'for n in ['structure','hallway','workshop','basement','attic']]]
(run/'input-manifest.json').write_text(json.dumps({str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest()for p in inputs},indent=2)+'\n')
subprocess.run([os.environ.get('BLENDER','/Applications/Blender.app/Contents/MacOS/Blender'),'-b','--threads','4','--python-exit-code','1','--python','scene/scripts/reprocess_house_trim.py','--',str(source),str(out)],cwd=R,check=True)
subprocess.run(['node','scripts/assemble-house-atlases.mjs',str(out)],cwd=R,check=True)
subprocess.run(['node','scripts/publish-house-atlases.mjs'],cwd=R,check=True)
print('LOCAL_REPROCESS_COMPLETE',out)
