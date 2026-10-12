import { cultureCatalog } from '../src/lib/culture/seed.js';
import { queryCatalog } from '../src/lib/culture/schema.js';
export default function handler(req: {method?:string;query?:Record<string,unknown>},res:{setHeader(k:string,v:string):void;status(code:number):{json(body:unknown):void}}) {
  res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({error:'GET only'});return;}
  const q=req.query??{};
  if(Object.keys(q).some(k=>!['id','q','destination','kind'].includes(k))||Object.values(q).some(v=>typeof v!=='string'||v.length>120)||q.destination&&!cultureCatalog.destinations.some(d=>d.id===q.destination)||q.kind&&!['book','film'].includes(String(q.kind))){res.status(400).json({error:'Choose a supported catalog filter.'});return;}
  if(q.id){const work=cultureCatalog.works.find(w=>w.id===q.id);if(!work){res.status(404).json({error:'Work not found'});return;}res.status(200).json({...cultureCatalog,works:[work]});return;}
  res.status(200).json({...cultureCatalog,works:queryCatalog(cultureCatalog,q)});
}
