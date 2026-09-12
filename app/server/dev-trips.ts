import notifications from '../api/notifications';
import tick from '../api/companion-tick';
import events from '../api/companion-events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleTrips } from '../api/trips';
import { handleAccount } from '../api/account';
import { MAX_CLOUD_BYTES } from '../src/lib/cloud/schema';
import { getWeather } from './conditions/weather';
import { WEATHER_SCOPES, type WeatherCity } from '../src/lib/conditions/weather';
import { isDate } from '../src/lib/trips/schema';

// Vite development adapter; production continues to use api/trips.ts directly.
export async function devTrips(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/weather-preview') {
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const city=url.searchParams.get('city')||'', date=url.searchParams.get('date')||'';
    if(req.method!=='GET' || !Object.hasOwn(WEATHER_SCOPES,city) || !isDate(date) || [...url.searchParams.keys()].length!==2){res.statusCode=400;res.end(JSON.stringify({error:'Choose a supported city and date'}));return;}
    try{res.end(JSON.stringify(await getWeather(city as WeatherCity,date)));}catch{res.statusCode=503;res.end(JSON.stringify({error:'Weather unavailable'}));}return;
  }
  if (url.pathname === '/api/companion-events') {
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if(bytes>65536){res.statusCode=413;res.end();return;}chunks.push(Buffer.from(chunk)); }
    const response = await events.fetch(new Request(url.href,{method:req.method,headers:req.headers as Record<string,string>,body:req.method==='POST'?Buffer.concat(chunks):undefined}));
    res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());return;
  }
  if (!['/api/trips', '/api/account','/api/notifications','/api/companion-tick'].includes(url.pathname)) { next(); return; }
  const limit = url.pathname === '/api/trips' ? MAX_CLOUD_BYTES : 4096;
  const json = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(JSON.stringify(body));
  };
  try {
    let body: unknown;
    if (req.method === 'POST') {
      if (Number(req.headers['content-length'] ?? 0) > limit) { json(413, { error: 'Request exceeds the cloud size limit.' }); req.resume(); return; }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > limit) { json(413, { error: 'Request exceeds the cloud size limit.' }); return; }
        chunks.push(buffer);
      }
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { json(400, { error: 'Invalid JSON request.' }); return; }
    }
    const ids = url.searchParams.getAll('id');
    const handler = url.pathname === '/api/account' ? handleAccount : url.pathname==='/api/notifications' ? notifications : url.pathname==='/api/companion-tick' ? tick : handleTrips;
    await handler({ method: req.method, headers: req.headers, query: { ...Object.fromEntries(url.searchParams), ...(ids.length ? {id:ids.length===1?ids[0]:ids} : {}) }, body }, {
      setHeader: (key, value) => res.setHeader(key, value),
      status: code => ({ json: body => json(code, body) }),
    });
  } catch {
    if (!res.writableEnded) json(503, { error: 'Cloud service unavailable. Your local copy has been kept.' });
  }
}
