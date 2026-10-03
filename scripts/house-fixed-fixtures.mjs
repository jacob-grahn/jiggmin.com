// Supplemental baked fixtures survive reference restoration and full publishing.
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function includeFixedFixtures(layout){
 const path='web/assets/house/release/smoke-detectors.glb';
 if(existsSync(path))layout.fixedFixtures=`/${path}?v=${createHash('sha256').update(readFileSync(path)).digest('hex').slice(0,12)}`;
 return layout;
}
