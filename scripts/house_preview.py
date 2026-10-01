"""Local-only house preview commands; does not run the production build."""
import argparse,os,shutil,subprocess,sys
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['build','export','serve','render','finish']);p.add_argument('--port',type=int,default=8010);p.add_argument('--force',action='store_true',help='Replace an existing editable preview scene when rebuilding');p.add_argument('--stage',type=int,choices=range(2,10),help='Finishing pass 2–9');a=p.parse_args()
blend=ROOT/'scene/house-plan-preview.blend'
if a.action=='serve':
 if not(ROOT/'scene/preview/generated/preview.json').exists():p.error('Run npm run preview:house:build first')
 class Handler(SimpleHTTPRequestHandler):
  def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
  def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 print(f'House preview: http://127.0.0.1:{a.port}/scene/preview/',flush=True);ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
else:
 blender=os.environ.get('BLENDER_BINARY')or shutil.which('blender')or'/Applications/Blender.app/Contents/MacOS/Blender'
 if not Path(blender).exists():p.error('Set BLENDER_BINARY to your Blender executable')
 if a.action=='build'and blend.exists()and not a.force:p.error('Preview scene already exists. Export saved edits, or use --force to regenerate it from the plan.')
 if a.action!='build'and not blend.exists():p.error('Build the preview scene first')
 cmd=[blender,'-b','--threads','2','--python-exit-code','1']
 if a.action=='build':cmd+=['--factory-startup','--python',str(ROOT/'scene/scripts/build_house_preview.py')]
 else:
  cmd+=[str(blend)]
  if a.action=='finish':
   if a.stage is None:p.error('finish requires --stage 2..9')
   cmd+=['--python',str(ROOT/'scene/scripts/finish_house_preview.py'),'--','--stage',str(a.stage)]
  elif a.action=='export':cmd+=['--python',str(ROOT/'scene/scripts/export_house_preview.py')]
  else:
   output=ROOT/'scene/renders/house-preview';output.mkdir(parents=True,exist_ok=True)
   cmd+=['-o',str(output/'hub-'),'--render-frame','1']
 sys.exit(subprocess.run(cmd,cwd=ROOT).returncode)
