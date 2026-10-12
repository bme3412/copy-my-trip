/** Offline editorial evidence only. No catalog imports, database client or network calls. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../editorial/paris-verification-pass-1');
const hash = value => createHash('sha256').update(value).digest('hex');
const headers = {
  'priority_40_verification.csv': 'seed_id,work_id,medium,title,seed_creator,identity_review,verified_scope,verified_claim_summary,source_url,proposed_correction,publication_eligible,needs',
  'source_backed_claims.csv': 'work_id,seed_id,title,source_url,claim,scope,reviewed_on,review_status',
  'verified_place_edges.csv': 'title,place_label,relation,source_url,caveat',
};
// Explicit bundle-specific identity links; never fuzzy-match a place edge to a work.
const edgeSeeds = {
  'Cléo from 5 to 7': 'PAR-0045', 'The Other Paris': 'PAR-0004', 'A Waiter in Paris': 'PAR-0006',
  'Our farewell to Montmartre': 'PAR-0086',
  'The 18th arrondissement of Paris (with a local)': 'PAR-0084',
  'Montmartre: The old village of a thousand facelifts': 'PAR-0085',
  'How has daily life in Paris changed?': 'PAR-0087',
};
const media = new Set(['book','film','tv_series','tv_episode','podcast','podcast_episode','album','song','artist']);
const relations = new Set(['filmed_at_historical','filmed_at','about_city','memoir_lived_experience','about_neighborhood','about_arrondissement','recorded_in_neighborhood']);

export function parseCsv(input, expectedHeaders) {
  const text = input.replace(/^\uFEFF/u, '');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  function cell() { row.push(field); field = ''; closed = false; }
  function record() { cell(); rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === ',') cell();
    else if (c === '\n' || c === '\r') { if(c === '\r' && text[i+1] === '\n') i++; record(); }
    else if (c === '"' && !field && !closed) quoted = true;
    else { assert.ok(!closed && c !== '"', 'Malformed CSV quoting'); field += c; }
  }
  assert.ok(!quoted, 'Unclosed CSV quote');
  if (field || row.length || closed) record();
  assert.deepEqual(rows.shift(), expectedHeaders.split(','), 'Unexpected CSV headers');
  return rows.map((values, i) => {
    assert.equal(values.length, expectedHeaders.split(',').length, `CSV column count at row ${i+2}`);
    assert.ok(values.every(v => v.length <= 10000 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(v)), 'Invalid cell text');
    return Object.fromEntries(expectedHeaders.split(',').map((key,j) => [key,values[j]]));
  });
}
function url(value) {
  const u = new URL(value);
  assert.ok(u.protocol === 'https:' && !u.username && !u.password, 'Unsafe evidence URL');
}
function required(row, fields) { for (const key of fields) assert.ok(row[key]?.trim(), `Missing ${key}`); }
function unique(rows, key) { assert.equal(new Set(rows.map(r=>r[key])).size, rows.length, `Duplicate ${key}`); }

export function normalizeBundle(files) {
  const parse = name => parseCsv(files[name], headers[name]);
  const candidates = parse('priority_40_verification.csv');
  const claims = parse('source_backed_claims.csv');
  const edges = parse('verified_place_edges.csv');
  const supplied = JSON.parse(files['verification_report.json']);
  unique(candidates,'seed_id'); unique(candidates,'work_id');
  const bySeed = new Map(candidates.map(r=>[r.seed_id,r]));
  for (const r of candidates) {
    required(r,['title','seed_creator','needs']);
    assert.match(r.seed_id,/^PAR-\d{4}$/u); assert.match(r.work_id,/^[1-9]\d*$/u);
    assert.ok(media.has(r.medium), 'Unknown medium');
    assert.equal(r.publication_eligible,'NO','Publication approval must never enter this queue');
    assert.ok(['needs_external_verification','partial_source_checked'].includes(r.identity_review),'Unknown review status');
    if(r.source_url) url(r.source_url);
  }
  const claimKeys = new Set();
  for(const r of claims) {
    const candidate=bySeed.get(r.seed_id); assert.ok(candidate,'Orphan claim');
    assert.equal(r.work_id,candidate.work_id,'Mismatched external work ID'); assert.equal(r.title,candidate.title,'Mismatched claim title');
    required(r,['claim','scope']); url(r.source_url);
    assert.equal(r.review_status,'source_checked_specific_claim_only');
    assert.match(r.reviewed_on,/^\d{4}-\d{2}-\d{2}$/u);
    assert.equal(new Date(r.reviewed_on).toISOString().slice(0,10),r.reviewed_on,'Invalid review date');
    assert.equal(candidate.identity_review,'partial_source_checked');
    assert.equal(r.scope,candidate.verified_scope); assert.equal(r.claim,candidate.verified_claim_summary); assert.equal(r.source_url,candidate.source_url);
    const key=JSON.stringify([r.seed_id,r.scope,r.source_url,r.claim]); assert.ok(!claimKeys.has(key),'Duplicate claim'); claimKeys.add(key);
  }
  for(const r of candidates) {
    const hasClaim=claims.some(c=>c.seed_id===r.seed_id);
    assert.equal(hasClaim,r.identity_review==='partial_source_checked','Candidate/claim status mismatch');
    if(!hasClaim) assert.ok(!r.verified_scope && !r.verified_claim_summary && !r.source_url,'Unchecked candidate has checked evidence');
  }
  const normalizedEdges=edges.map(r=>{
    const seedId=edgeSeeds[r.title]; const candidate=bySeed.get(seedId);
    assert.ok(candidate && candidate.title===r.title,'Unmapped or ambiguous edge title');
    required(r,['place_label','caveat']); url(r.source_url); assert.ok(relations.has(r.relation),'Unknown place relation');
    assert.ok(claims.some(c=>c.seed_id===seedId && c.source_url===r.source_url),'Place edge has no corresponding source claim');
    return {id:`edge-${hash(JSON.stringify([seedId,r.place_label,r.relation,r.source_url])).slice(0,20)}`,seedId,...r,reviewStatus:'imported_source_claim_not_rechecked',plannerPlaceId:null,plannerEligible:false};
  });
  unique(normalizedEdges,'id');
  const counts={priority_records:candidates.length,with_at_least_one_source_checked_claim:new Set(claims.map(r=>r.seed_id)).size,requiring_further_review:candidates.length,production_approved:0,verified_geographic_links:edges.length};
  for(const [key,value] of Object.entries(counts)) assert.equal(supplied[key],value,`Report count mismatch: ${key}`);
  assert.equal(candidates.length,40,'This versioned bundle must retain all 40 records');
  return {schemaVersion:1,bundleId:'paris-verification-pass-1',publicationAllowed:false,sourceClaimsIndependentlyRechecked:false,counts,
    candidates:candidates.map(r=>({id:`paris-verification-pass-1:${r.seed_id}`,seedId:r.seed_id,externalWorkId:r.work_id,original:r,reviewStatus:'pending',publicationEligible:false,queue:['book','film'].includes(r.medium)?'book-film-review':'deferred-medium',proposedCatalogMatch:r.seed_id==='PAR-0045'?{catalogId:'cleo-from-5-to-7',status:'pending_identity_review',mergeAllowed:false}:null})),
    claims:claims.map(r=>({id:`claim-${hash(JSON.stringify(r)).slice(0,20)}`,seedId:r.seed_id,...r,reviewStatus:'imported_source_claim_not_rechecked'})),edges:normalizedEdges};
}
export async function loadBundle(root=bundleRoot) {
  const provenance=JSON.parse(await readFile(resolve(root,'provenance.json'),'utf8'));
  assert.equal(provenance.bundleId,'paris-verification-pass-1');
  assert.deepEqual(Object.keys(provenance.files).sort(),[...Object.keys(headers),'README.md','verification_report.json'].sort());
  const files={};
  for(const [name,expected] of Object.entries(provenance.files)) {
    const bytes=await readFile(resolve(root,'source',name)); assert.equal(hash(bytes),expected,`Source checksum mismatch: ${name}`); files[name]=bytes.toString('utf8');
  }
  return {...normalizeBundle(files),sourceHashes:provenance.files};
}
const md = value => String(value).replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/[\\`*_{}\[\]()!#]/gu, c=>'\\'+c).replace(/\|/gu,'&#124;').replace(/[\r\n]+/gu,' ');
export function renderReport(bundle) {
  const active=bundle.candidates.filter(r=>r.queue==='book-film-review').length;
  return `# Paris verification pass — offline review report\n\nGenerated deterministically from the preserved supplied bundle. Source assertions have **not** been independently rechecked by this importer. See the [independent book/film source review](../source-review.md) for the October 11, 2026 research findings: 18 candidates ready for scoped factual approval, two film holds, zero publication approvals. No records are approved, merged, published or sent to Supabase.\n\n- Candidates: ${bundle.counts.priority_records}; candidates with supplied source-checked claims: ${bundle.counts.with_at_least_one_source_checked_claim}.\n- Claims: ${bundle.claims.length}; geographic edges: ${bundle.edges.length}; publication-approved records: 0.\n- Book/film review queue: ${active}; deferred media: ${bundle.candidates.length-active}.\n- Cléo: proposed match to existing \`cleo-from-5-to-7\`, pending identity review; no merge.\n- Historical filming claims retain their caveats. No edge has a planner place ID or planner eligibility.\n- Creator corrections remain proposals in the original record; no existing creator is overwritten.\n\n## Review queue\n\n| Seed | Medium | Title | Supplied scope | Correction proposal | Remaining checks |\n|---|---|---|---|---|---|\n${bundle.candidates.map(({original:r})=>`| ${[r.seed_id,r.medium,r.title,r.verified_scope||'Unchecked',r.proposed_correction||'—',r.needs].map(md).join(' | ')} |`).join('\n')}\n\n## Supplied claims — not independently rechecked\n\n| Seed | Scope | Exact supplied claim | Supplied review date | Source |\n|---|---|---|---|---|\n${bundle.claims.map(r=>`| ${[r.seedId,r.scope,r.claim,r.reviewed_on,r.source_url].map(md).join(' | ')} |`).join('\n')}\n\n## Geographic evidence\n\n| Seed | Place | Relationship | Caveat | Source |\n|---|---|---|---|---|\n${bundle.edges.map(r=>`| ${[r.seedId,r.place_label,r.relation,r.caveat,r.source_url].map(md).join(' | ')} |`).join('\n')}\n\n## Next editorial gate\n\nIndependently check each cited source and its exact claim; resolve identity, dates, edition/parent IDs, rights and creator aliases; then obtain an explicit editorial decision. A supplied source-check status is not publication approval. Non-book/film media remain deferred. The bundle's reference to an earlier Supabase staging schema is source text, not an instruction executed by this importer.\n`;
}
export async function run(check=false,root=bundleRoot) {
  const bundle=await loadBundle(root);
  const artifacts={'review-queue.json':JSON.stringify(bundle,null,2)+'\n','review-report.md':renderReport(bundle)};
  if(!check) await mkdir(resolve(root,'generated'),{recursive:true});
  for(const [name,text] of Object.entries(artifacts)) {
    const path=resolve(root,'generated',name);
    if(check) assert.equal(await readFile(path,'utf8'),text,`Stale review artifact: ${name}`);
    else await writeFile(path,text);
  }
  console.log(`${check?'Verified':'Generated'} offline review: ${bundle.candidates.length} candidates, ${bundle.counts.with_at_least_one_source_checked_claim} claim-checked candidates, ${bundle.edges.length} edges; zero publication approvals`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(a=>a==='--check') && process.argv.length<=3,'Only --check is supported');
  await run(process.argv.includes('--check'));
}
