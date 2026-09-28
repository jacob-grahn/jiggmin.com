import {readJournal} from './house-state.js';

export const BONUS_KEY='jiggmin.house.cartridges.v1';
export const BONUS_NOTES={inkclipse:'inkclipse',crowland:'a-murder-in-crowland'};
export const BONUS_IDS=Object.values(BONUS_NOTES);
export function createBonusCollection(storage){
 let saved;try{saved=JSON.parse(storage?.getItem(BONUS_KEY)??'null');}catch{}
 const valid=values=>Array.isArray(values)?values.filter(id=>BONUS_IDS.includes(id)):[];
 const found=new Set(saved?.version===1?valid(saved.found):[]);
 const delivered=new Set(saved?.version===1?valid(saved.delivered).filter(id=>found.has(id)):[]);
 // Existing journal discoveries become physical cartridges on the next den visit.
 for(const note of readJournal(storage,Object.keys(BONUS_NOTES)))found.add(BONUS_NOTES[note]);
 const save=()=>{try{storage?.setItem(BONUS_KEY,JSON.stringify({version:1,found:[...found],delivered:[...delivered]}));}catch{}};
 return {
  get found(){return [...found];},
  pending(id){return found.has(id)&&!delivered.has(id);},
  collect(id){if(!BONUS_IDS.includes(id)||found.has(id))return false;found.add(id);save();return true;},
  delivered(id){if(found.has(id)){delivered.add(id);save();}},
 };
}

export function normalizeBonusGame(game){
 if(!BONUS_IDS.includes(game?.id)||!/^games\/bonus\/[a-z0-9-]+\/game\.swf$/.test(game.file))throw Error('This bonus cartridge is unavailable.');
 return {...game,thumbnail:{file:game.thumbnail},playerType:'swf',gameplay:{mode:'touch',controller:{stick:'arrows',a:[],b:[]}}};
}
let catalog;
export async function getBonusGame(id){
 catalog??=fetch('/data/bonus-games.json').then(response=>{if(!response.ok)throw Error('The bonus cartridges could not load.');return response.json();}).then(data=>data.games.map(normalizeBonusGame)).catch(error=>{catalog=null;throw error;});
 const game=(await catalog).find(game=>game.id===id);if(!game)throw Error('This bonus cartridge is unavailable.');return game;
}
