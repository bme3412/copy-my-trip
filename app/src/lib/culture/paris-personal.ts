import { parseShelf, SHELF_KEY, type ShelfStorage } from './shelf';
export const PARIS_KEY = 'elsewhere-paris-personal-v1';
export type ActivityStatus = 'read' | 'watched' | 'listened' | 'visited';
export type PersonalData = {schemaVersion:1;saved:{id:string;at:string}[];activities:{id:string;status:ActivityStatus;at:string}[];trails:{id:string;title:string;path:string[];at:string}[]};
export const emptyPersonal = (): PersonalData => ({schemaVersion:1,saved:[],activities:[],trails:[]});
const idOK = (v:unknown) => typeof v === 'string' && /^(work|place|person|theme|story|collection):[a-z0-9-]{1,80}$/.test(v);
const atOK = (v:unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
function keys(v:object, list:string[]) { return Object.keys(v).every(k => list.includes(k)); }
export function parsePersonal(raw:string|null):PersonalData {
  if(raw === null) return emptyPersonal();
  if(raw.length > 250000) throw Error('Backup exceeds the local atlas limit.');
  const v = JSON.parse(raw);
  if(!v || v.schemaVersion !== 1 || !keys(v,['schemaVersion','saved','activities','trails'])) throw Error('Unknown atlas format.');
  for(const name of ['saved','activities','trails']) if(!Array.isArray(v[name]) || v[name].length>500 || new Set(v[name].map((r:{id:string}) => r?.id)).size !== v[name].length) throw Error('Invalid atlas records.');
  for(const r of v.saved) if(!r || !keys(r,['id','at']) || !idOK(r.id) || !atOK(r.at)) throw Error('Invalid saved item.');
  for(const r of v.activities) if(!r || !keys(r,['id','status','at']) || !idOK(r.id) || !atOK(r.at) || !['read','watched','listened','visited'].includes(r.status) || !(r.id.startsWith('work:') || (r.id.startsWith('place:')&&r.status==='visited') || (r.id.startsWith('story:')&&r.status==='read'))) throw Error('Invalid activity.');
  for(const r of v.trails) if(!r || !keys(r,['id','title','path','at']) || typeof r.id!=='string' || !/^[a-z0-9-]{1,80}$/.test(r.id) || typeof r.title!=='string' || !r.title.trim() || r.title.length>120 || !atOK(r.at) || !Array.isArray(r.path) || r.path.length<1 || r.path.length>24 || !r.path.every(idOK)) throw Error('Invalid trail.');
  return v;
}
export function writePersonal(storage:ShelfStorage, edit:(data:PersonalData)=>PersonalData):PersonalData {
  const raw = storage.getItem(PARIS_KEY);
  const next = parsePersonal(JSON.stringify(edit(parsePersonal(raw))));
  if(storage.getItem(PARIS_KEY) !== raw) throw Error('The atlas changed in another tab. Try again.');
  storage.setItem(PARIS_KEY,JSON.stringify(next));
  return next;
}
export function exportBackup(storage:Pick<ShelfStorage,'getItem'>) {
  // Raw strings preserve unreadable data too; exporting never requires successful parsing.
  return JSON.stringify({format:'elsewhere-paris-backup',version:1,personal:storage.getItem(PARIS_KEY),shelf:storage.getItem(SHELF_KEY)},null,2);
}
export function parseBackup(raw:string):{personal:string|null;shelf:string|null} {
  if(raw.length>300000) throw Error('Backup file is too large.');
  const v=JSON.parse(raw);
  if(!v || v.format!=='elsewhere-paris-backup' || v.version!==1 || !keys(v,['format','version','personal','shelf']) || !(v.personal===null || typeof v.personal==='string') || !(v.shelf===null || typeof v.shelf==='string')) throw Error('Choose an Elsewhere Paris backup.');
  parsePersonal(v.personal);parseShelf(v.shelf);return v;
}
export function restoreBackup(storage:ShelfStorage & {removeItem(k:string):void}, raw:string) {
  const next=parseBackup(raw),oldPersonal=storage.getItem(PARIS_KEY),oldShelf=storage.getItem(SHELF_KEY);
  const put=(key:string,value:string|null)=>value===null?storage.removeItem(key):storage.setItem(key,value);
  try { put(PARIS_KEY,next.personal);put(SHELF_KEY,next.shelf); }
  catch(error) { try{put(PARIS_KEY,oldPersonal);put(SHELF_KEY,oldShelf);}catch{throw Error('Storage failed during recovery. Keep your exported backup and retry when storage is available.');}throw error; }
}
