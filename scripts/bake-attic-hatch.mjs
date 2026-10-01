// Bake only the moving hatch's reference surface, then retain it on publication.
import {spawnSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {includeFixedFixtures} from './house-fixed-fixtures.mjs';
if(!process.argv.includes('--use-completed')){
 const blender=process.env.BLENDER??'/Applications/Blender.app/Contents/MacOS/Blender';
 const result=spawnSync(blender,['-b','scene/house-release.blend','--threads','4','--python-exit-code','1','--python','scene/scripts/bake_attic_hatch.py'],{stdio:'inherit'});
 if(result.status!==0)throw Error('Attic hatch lighting bake failed');
}
copyFileSync('scene/exports/house-release/attic-hatch/baked.glb','web/assets/house/release/attic-hatch-lighting.glb');
copyFileSync('scene/exports/house-release/attic-hatch/bake-report.json','docs/house-plan/attic-hatch-bake-report.json');
const path='web/assets/house/release/layout.json';writeFileSync(path,JSON.stringify(includeFixedFixtures(JSON.parse(readFileSync(path))),null,2)+'\n');
