// Publish a verified bake locally, or restore the original reference assembly.
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {includeFixedFixtures} from './house-fixed-fixtures.mjs';
const index=process.argv.indexOf('--bake');
let quality=index<0?null:process.argv[index+1];
if(!quality&&!process.argv.includes('--reference')&&existsSync('scene/exports/house-release/final/layout.json')){
 const final=JSON.parse(readFileSync('scene/exports/house-release/final/layout.json'));
 if(final.lightingBake?.source==='original-window-rig')quality='final';
}
if(!quality){await import('./restore-house-style.mjs');console.log('Published original-style reference assets locally. No deployment performed.');}
else{
 if(!['test','final'].includes(quality))throw Error('Expected --bake test or final');
 const dir=`scene/exports/house-release/${quality}`,out='web/assets/house/release',layout=JSON.parse(readFileSync(`${dir}/layout.json`));
 if(layout.lightingBake?.source!=='original-window-rig')throw Error('Missing approved window bake');
 const sources=['scene/house-release.blend','scene/exports/house-release/bake-input/structure.glb','scene/exports/house-release/bake-input/basement.glb','scene/exports/house-release/bake-input/attic.glb','scene/scripts/bake_house_release.py','scene/scripts/house_bake_lighting.py','scene/scripts/house_bake_groups.py','scene/scripts/hall_window_finish.py','scene/scripts/hall_ceiling_uv.py','scene/scripts/house_wall_uv.py','scene/scripts/house_bake_uv_guard.py','scene/scripts/house_source_uv.py'];
 const fingerprint=createHash('sha256');for(const source of sources)fingerprint.update(readFileSync(source));
 if(layout.lightingBake.report.sourceKey!==fingerprint.digest('hex'))throw Error('Bake no longer matches the current source; run the test and full bake before publishing.');
 for(const room of ['structure','hallway','workshop','basement','attic']){
  const bytes=readFileSync(`${dir}/${room}.glb`);copyFileSync(`${dir}/${room}.glb`,`${out}/${room}.glb`);
  layout.assets[room]=`/${out}/${room}.glb?v=${createHash('sha256').update(bytes).digest('hex').slice(0,12)}`;
 }
 copyFileSync(`${dir}/den-floor-reference.glb`,`${out}/den-floor-reference.glb`);
 layout.denFloorReference=`/${out}/den-floor-reference.glb`;
 writeFileSync(`${out}/layout.json`,JSON.stringify(includeFixedFixtures(layout),null,2)+'\n');
 copyFileSync(`${dir}/bake-report.json`,'docs/house-plan/release-bake-report.json');
 console.log(`Published ${quality} original-window bake locally. No deployment performed.`);
}

await (await import('./split-house-structure.mjs')).splitHouseStructure();
