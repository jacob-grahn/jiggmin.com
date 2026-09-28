// srcdoc cannot push game URLs into browser history. Keep preview navigation local.
import {resolveRoute as resolveOriginal} from '/web/routes.js?compression-original';
export const resolveRoute=(pathname,games)=>resolveOriginal(pathname==='srcdoc'?'/':pathname,games);
export function writeGameUrl(){}
