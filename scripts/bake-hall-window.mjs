// Rebuild and install the hallway window-frame lighting from its native materials.
import {spawnSync} from 'node:child_process';
const blender=process.env.BLENDER??'/Applications/Blender.app/Contents/MacOS/Blender';
const result=spawnSync(blender,['-b','scene/house-release.blend','--threads',process.env.HOUSE_BAKE_THREADS??'6','--python-exit-code','1','--python','scene/scripts/bake_hall_window.py'],{stdio:'inherit'});
if(result.status!==0)throw Error('Hall window bake failed');
await import('./install-hall-window-bake.mjs');
