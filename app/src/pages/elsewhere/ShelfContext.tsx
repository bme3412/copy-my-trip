import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { parseShelf, SHELF_KEY, writeBookmark } from '../../lib/culture/shelf';
const Context=createContext<{ids:string[];error:string;message:string;busy:boolean;save(id:string,saved:boolean):Promise<void>;exportData():void;reset():Promise<void>}|null>(null);
export function ShelfProvider({children}:{children:ReactNode}) {
  const [ids,setIds]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const reload=()=>{try{setIds(parseShelf(localStorage.getItem(SHELF_KEY)).workIds);setError('');}catch{setError('Your saved list is unavailable. Existing data has been kept; export it before resetting.');}};
  useEffect(()=>{reload();const update=(e:StorageEvent)=>{if(e.key===SHELF_KEY||e.key===null)reload();};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);},[]);
  const save=async(id:string,saved:boolean)=>{
    if(busy)return;setBusy(true);setMessage('');
    try {
      const write=()=>writeBookmark(localStorage,id,saved);
      const next=navigator.locks?await navigator.locks.request('elsewhere-shelf-write',write):write();
      setIds(next.workIds);setError('');setMessage(saved?'Saved on this device.':'Removed from your saved list.');
    }catch{setError('Could not save this change. Your existing list has been kept. Check browser storage or export your list.');}finally{setBusy(false);}
  };
  const exportData=()=>{try{const raw=localStorage.getItem(SHELF_KEY)??JSON.stringify(parseShelf(null));const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='elsewhere-saved.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError('Browser storage is unavailable; an export could not be created.');}};
  const reset=async()=>{if(busy)return;setBusy(true);try{const remove=()=>localStorage.removeItem(SHELF_KEY);if(navigator.locks)await navigator.locks.request('elsewhere-shelf-write',remove);else remove();reload();setMessage('Saved list reset on this device.');}catch{setError('Browser storage is unavailable; nothing was reset.');}finally{setBusy(false);}};
  return <Context.Provider value={{ids,error,message,busy,save,exportData,reset}}>{children}</Context.Provider>;
}
export function useShelf(){const value=useContext(Context);if(!value)throw Error('Shelf provider missing');return value;}
export function SaveWork({id,title}:{id:string;title:string}){const shelf=useShelf();const saved=shelf.ids.includes(id);return <button className={`ew-save ${saved?'is-saved':''}`} disabled={shelf.busy} aria-pressed={saved} aria-label={`${saved?'Remove':'Save'} ${title}${saved?' from saved list':''}`} onClick={()=>void shelf.save(id,!saved)}><span aria-hidden="true">{saved?'✓':'+'}</span> {saved?'Saved':'Save'}</button>;}
