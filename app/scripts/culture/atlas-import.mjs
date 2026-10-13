/** Offline, deterministic adapter for the supplied Markdown draft. No network or database calls. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const BATCH_IDS=[11,12,13,18,17,111,42,43,36,33,48,51,55,52,65,72,70,62,89,90,92,93,106,114].map(n=>`PAR-${String(n).padStart(3,'0')}`);
export function parseDraft(raw){
 let medium='';const rows=[];
 for(const line of raw.split(/\r?\n/)){
  const heading=line.match(/^## (Book|Film|Television|Music|Podcast|Essay \/ long-form) \(/);if(heading)medium=heading[1];
  if(!/^\| PAR-/.test(line))continue;
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());
  if(cells.length!==7||!/^PAR-\d{3}$/.test(cells[0])||cells.some(s=>!s)||!medium)throw Error('Malformed draft row');
  const [seedId,title,creator,year,priority,themes,connection]=cells;
  if(!['Feature','Supporting','Lower','Heritage','Context','Review'].includes(priority))throw Error('Unknown priority');
  rows.push({seedId,medium,title,creator,year,priority,themes,connection});
 }
 const counts={'Book':25,'Film':25,'Television':10,'Music':25,'Podcast':20,'Essay / long-form':15};
 if(rows.length!==120||new Set(rows.map(r=>r.seedId)).size!==120||rows.some((r,i)=>r.seedId!==`PAR-${String(i+1).padStart(3,'0')}`))throw Error('Expected 120 unique sequential draft IDs');
 for(const [kind,count] of Object.entries(counts))if(rows.filter(r=>r.medium===kind).length!==count)throw Error('Draft count mismatch');
 return rows;
}
export function reconcile(raw,manifest,decisions,existing,earlier){
 if(createHash('sha256').update(raw).digest('hex')!==manifest.sha256)throw Error('Draft checksum mismatch');
 const rows=parseDraft(raw.toString());
 if(decisions.schemaVersion!==1||decisions.records.length!==120||new Set(decisions.records.map(r=>r.seedId)).size!==120)throw Error('Invalid decision inventory');
 const publicIds=new Set(existing.works.map(w=>w.id)),oldIds=new Set(earlier.candidates.map(c=>c.id));
 const works=new Map(decisions.approvedWorks.map(w=>[w.id,w]));if(works.size!==decisions.approvedWorks.length)throw Error('Duplicate approved work');
 const sourceIds=new Set(decisions.sources.map(s=>s.id));if(sourceIds.size!==decisions.sources.length)throw Error('Duplicate source');
 for(const s of decisions.sources){const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password||s.policy!=='citation-and-facts-only')throw Error('Unsafe evidence');}
 const used=new Set(),matched=new Set();
 const candidates=rows.map(original=>{
  const d=decisions.records.find(r=>r.seedId===original.seedId);if(!d)throw Error('Missing decision');
  if(d.firstBatch!==BATCH_IDS.includes(d.seedId))throw Error('First batch changed');
  if(d.existingWorkId){if(!publicIds.has(d.existingWorkId)||matched.has(d.existingWorkId))throw Error('Invalid or duplicate current match');matched.add(d.existingWorkId);}
  if(d.earlierCandidateId&&!oldIds.has(d.earlierCandidateId))throw Error('Invalid earlier match');
  if(!['pending','existing-source-attributed','verified-facts','insufficient'].includes(d.evidenceReview))throw Error('Invalid evidence review');
  if(d.publicationEligible){
   if(!d.firstBatch||d.evidenceReview!=='verified-facts'||d.publicationAction!=='include-local'||d.existingWorkId||!d.note||!d.workId||!works.has(d.workId)||publicIds.has(d.workId)||used.has(d.workId))throw Error('Ineligible publication');
   const w=works.get(d.workId);if(!w.sourceIds?.length||w.sourceIds.some(id=>!sourceIds.has(id))||!w.geography||!w.identifiers?.length)throw Error('Unsubstantiated work');used.add(d.workId);
  }else if(d.publicationAction==='include-local'||d.workId)throw Error('Unapproved publication');
  return {id:`paris-atlas-120:${original.seedId}`,original,...d};
 });
 if(used.size!==works.size)throw Error('Unreferenced public work');
 return {schemaVersion:1,bundleId:'paris-atlas-120',sourceSha256:manifest.sha256,counts:{candidates:120,existing:matched.size,firstBatch:BATCH_IDS.length,accepted:used.size,pendingFirstBatch:24-used.size},candidates};
}
const escape=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function report(queue){return `# Paris atlas: 120-entry reconciliation\n\nSource SHA-256: ${queue.sourceSha256}\n\n${queue.counts.existing} existing identities retained; ${queue.counts.accepted}/24 first-batch additions accepted for local source-attributed display. No claim of full reading, viewing or listening review. Priorities are independent of evidence review. See decisions.json for approved facts, source URLs and individual decisions.\n\n| Seed | Supplied title | Priority | Current / earlier identity | Review | Action and notes |\n|---|---|---|---|---|---|\n`+queue.candidates.map(c=>`| ${c.seedId} | ${escape(c.original.title)} | ${c.original.priority} | ${escape([c.existingWorkId,c.earlierCandidateId].filter(Boolean).join(' / '))} | ${c.evidenceReview} | ${escape([c.publicationAction,c.correction,c.note].filter(Boolean).join(' · '))} |`).join('\n')+'\n';}
export function run(check=false){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),dir=path.join(root,'editorial/paris-atlas-120');
 const read=p=>JSON.parse(readFileSync(p,'utf8'));
 const decisions=read(path.join(dir,'decisions.json'));
 const queue=reconcile(readFileSync(path.join(dir,'source/catalog.md')),read(path.join(dir,'source/manifest.json')),decisions,read(path.join(dir,'existing-catalog.json')),read(path.join(root,'editorial/paris-verification-pass-1/generated/review-queue.json')));
 const outputs=[['generated/review-queue.json',JSON.stringify(queue,null,2)+'\n'],['generated/review-report.md',report(queue)]];
 for(const [name,content] of outputs){const p=path.join(dir,name);if(check){if(readFileSync(p,'utf8')!==content)throw Error(`Stale ${name}`);}else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,content);}}
 return queue;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){console.log(JSON.stringify(run(process.argv.includes('--check')).counts));}
