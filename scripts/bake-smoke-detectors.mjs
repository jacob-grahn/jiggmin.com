// Rebuild only the three fixed detectors; preserve the completed room atlases.
import {spawnSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {includeFixedFixtures} from './house-fixed-fixtures.mjs';
const blender=process.env.BLENDER??'/Applications/Blender.app/Contents/MacOS/Blender';
const result=spawnSync(blender,['-b','scene/house-release.blend','--threads','4','--python-exit-code','1','--python','scene/scripts/bake_smoke_detectors.py'],{stdio:'inherit'});
if(result.status!==0)throw Error('Smoke detector bake failed');
copyFileSync('scene/exports/house-release/smoke-detectors/baked.glb','web/assets/house/release/smoke-detectors.glb');
copyFileSync('scene/exports/house-release/smoke-detectors/bake-report.json','docs/house-plan/smoke-detector-bake-report.json');
const path='web/assets/house/release/layout.json';
writeFileSync(path,JSON.stringify(includeFixedFixtures(JSON.parse(readFileSync(path))),null,2)+'\n');
