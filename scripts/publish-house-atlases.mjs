// Publish the validated atlas staging directory locally; never deploy.
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='scene/exports/house-release/atlas-refresh',out='web/assets/house/release';
const layout=JSON.parse(await readFile(`${dir}/layout.json`));
assert.ok(layout.atlasRefresh?.losslessBake);
assert.ok(Object.values(layout.atlasRefresh.atlases).every(a=>a.resolution[0]>=512),'Refuse smoke-test assets');
const manifest=JSON.parse(await readFile(`${layout.atlasRefresh.resultDirectory}/../input-manifest.json`));
for(const path of ['scene/house-release.blend','scene/scripts/bake_house_atlases.py','scene/scripts/house_bake_groups.py','scene/scripts/house_frame_geometry.py','scene/scripts/house_slab_ownership.py','scene/scripts/house_finishes.py','scene/scripts/house_bake_lighting.py','scene/scripts/house_source_uv.py','scene/scripts/house_wall_uv.py','scene/scripts/house_bake_uv_guard.py','scene/scripts/house_lightmap_filter.py','scene/scripts/house_atlas_composite.py','scene/scripts/hall_ceiling_uv.py','scene/scripts/hall_window_finish.py',...['structure','hallway','workshop','basement','attic'].map(n=>`${out}/${n}.glb`)]){
 const hash=createHash('sha256').update(await readFile(path)).digest('hex');assert.equal(hash,manifest[path],`Source changed since baking: ${path}`);
}
execFileSync(process.execPath,['--test','tests/house-frame-clearance.test.mjs','tests/house-ceiling-finish.test.mjs','tests/house-atlas-ownership.test.mjs'],{stdio:'inherit',env:{...process.env,ATLAS_REFRESH_DIR:dir}});
for(const room of ['structure','hallway','workshop','basement','attic']){
 await copyFile(`${dir}/${room}.glb`,`${out}/${room}.glb`);layout.assets[room]=layout.assets[room].replace('/'+dir+'/', '/'+out+'/');
}
for(const key of ['denFloorReference','fixedFixtures'])if(layout[key]){
 const name=layout[key].split('?')[0].split('/').pop();await copyFile(`${dir}/${name}`,`${out}/${name}`);layout[key]=layout[key].replace('/'+dir+'/', '/'+out+'/');
}
// Rebuild streamed URLs for the canonical directory, including byte-identical
// rebakes whose staged shell hashes could otherwise satisfy the cache.
delete layout.structureStreaming;delete layout.structureAssets;
await writeFile(`${out}/layout.json`,JSON.stringify(layout,null,2)+'\n');
console.log('Published atlas refresh locally; original den projection and live props retained.');

await (await import('./split-house-structure.mjs')).splitHouseStructure();
