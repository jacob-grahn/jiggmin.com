// Rebuild the hallway through the production pipeline at 64 samples.
import {spawnSync} from 'node:child_process';
const preflight=process.argv.includes('--preflight');
const blender=process.env.BLENDER??'/Applications/Blender.app/Contents/MacOS/Blender';
const result=spawnSync(blender,['-b','scene/house-release.blend','--threads',process.env.HOUSE_BAKE_THREADS??'6','--python-exit-code','1','--python','scene/scripts/bake_house_release.py','--',process.argv.includes('--hall-window-wall')?'--hall-window-wall':'--hallway',...(preflight?['--preflight']:[])],{stdio:'inherit'});
if(result.status!==0)throw Error('Hallway bake failed');
if(!preflight)await import('./install-hallway-bake.mjs');
