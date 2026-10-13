import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyPersonal, PARIS_KEY, parsePersonal, writePersonal, type PersonalData } from '../../lib/culture/paris-personal';
const Context=createContext<{data:PersonalData;error:string;message:string;busy:boolean;edit(fn:(d:PersonalData)=>PersonalData):Promise<void>;reload():void}|null>(null);
export function ParisPersonalProvider({children}:{children:ReactNode}) {
  const [data,setData]=useState(emptyPersonal),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),running=useRef(false);
  const reload=()=>{try{setData(parsePersonal(localStorage.getItem(PARIS_KEY)));setError('');}catch{setData(emptyPersonal());setError('Your atlas could not be read. Its original data is preserved. Export it in Backup & recovery before resetting.');}};
  useEffect(()=>{reload();const handler=(e:StorageEvent)=>{if(e.key===PARIS_KEY||e.key===null)reload();};window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);},[]);
  const edit=async(fn:(d:PersonalData)=>PersonalData)=>{if(running.current)return;running.current=true;setBusy(true);try{const write=()=>writePersonal(localStorage,fn);const next=navigator.locks?await navigator.locks.request('elsewhere-paris-write',write):write();setData(next);setError('');setMessage('Atlas updated on this device.');}catch{setError('Could not update your atlas. Existing data was kept. Check storage or use Backup & recovery.');}finally{running.current=false;setBusy(false);}};
  return <Context.Provider value={{data,error,message,busy,edit,reload}}>{children}</Context.Provider>;
}
export function useParisPersonal(){const value=useContext(Context);if(!value)throw Error('Paris personal provider missing');return value;}
