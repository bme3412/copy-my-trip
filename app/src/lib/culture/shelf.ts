/** Device-local bookmarks; never reads or writes trip/account storage. */
export const SHELF_KEY = 'elsewhere-shelf-v1';
export interface Shelf { schemaVersion: 1; workIds: string[] }
export interface ShelfStorage { getItem(k:string):string|null; setItem(k:string,v:string):void }
export function parseShelf(raw: string | null): Shelf {
  if(raw===null)return {schemaVersion:1,workIds:[]};
  if(raw.length>16000)throw Error('Your saved list is too large. Export it before resetting.');
  const v=JSON.parse(raw);
  if(!v||v.schemaVersion!==1||Object.keys(v).some(k=>!['schemaVersion','workIds'].includes(k))||!Array.isArray(v.workIds)||v.workIds.length>100||!v.workIds.every((id:unknown)=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/.test(id))||new Set(v.workIds).size!==v.workIds.length)throw Error('Your saved list could not be read. Its original data has been kept.');
  return v;
}
export function writeBookmark(storage:ShelfStorage,id:string,saved:boolean):Shelf {
  if(!/^[a-z0-9-]{1,80}$/.test(id))throw Error('Invalid work');
  const raw=storage.getItem(SHELF_KEY), current=parseShelf(raw);
  const workIds=current.workIds.filter(x=>x!==id);
  if(saved)workIds.push(id);
  const next=parseShelf(JSON.stringify({schemaVersion:1,workIds}));
  // Re-read under the caller's Web Lock; never replace unreadable storage.
  if(storage.getItem(SHELF_KEY)!==raw)throw Error('Your saved list changed in another tab. Please try again.');
  storage.setItem(SHELF_KEY,JSON.stringify(next));
  return next;
}
