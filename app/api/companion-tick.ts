import { timingSafeEqual } from 'node:crypto';
import { mailConfigured, tick, workerRpc } from '../server/companion/jobs.js';
export const maxDuration = 120;
export default async function handler(req: {method?:string;headers:Record<string,string|string[]|undefined>;query?:Record<string,string|string[]|undefined>},res:{setHeader(k:string,v:string):void;status(code:number):{json(body:unknown):void}}) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET') {res.status(405).json({error:'GET only'});return;}
  const expected=process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  const actual=typeof req.headers.authorization==='string'?req.headers.authorization:'';
  if(!expected || Buffer.byteLength(actual)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual),Buffer.from(expected))) {res.status(401).json({error:'Unauthorized'});return;}
  try {
    if(req.query?.ops==='1') {res.status(200).json(await workerRpc('ops'));return;}
    if(!mailConfigured()) {res.status(200).json({paused:true});return;}
    res.status(200).json(await tick());
  } catch {res.status(503).json({error:'Worker unavailable'});}
}
