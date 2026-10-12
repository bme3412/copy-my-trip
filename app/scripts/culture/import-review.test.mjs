import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bundleRoot, parseCsv, normalizeBundle, loadBundle, renderReport, run } from './import-review.mjs';
const files={};
for(const name of ['priority_40_verification.csv','source_backed_claims.csv','verified_place_edges.csv','verification_report.json']) files[name]=await readFile(join(bundleRoot,'source',name),'utf8');
function edit(name,fn) {
  const copy={...files}; const header=copy[name].replace(/^\uFEFF/u,'').split(/\r?\n/u)[0];
  const rows=parseCsv(copy[name],header); fn(rows);
  const quote=v=>'"'+v.replace(/"/gu,'""')+'"';
  copy[name]=header+'\n'+rows.map(r=>header.split(',').map(k=>quote(r[k])).join(',')).join('\n')+'\n';return copy;
}
test('CSV supports BOM, CRLF, quoted commas, multiline cells and escaped quotes',()=>{
 assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x,y","a""b\nnext"\r\n','a,b'),[{a:'x,y',b:'a"b\nnext'}]);
 for(const input of ['a,b\na', 'a,b\n"bad,b','a,b\n"x"z,y','a,a\nx,y'])assert.throws(()=>parseCsv(input,'a,b'));
});
test('all original records retained with stable IDs and no publication or planner authorization',async()=>{
 const b=await loadBundle();assert.equal(b.candidates.length,40);assert.equal(b.claims.length,12);assert.equal(b.edges.length,9);
 assert.equal(b.candidates.filter(r=>r.queue==='book-film-review').length,20);
 assert.equal(b.publicationAllowed,false);assert.equal(b.sourceClaimsIndependentlyRechecked,false);
 assert.ok(b.candidates.every(r=>r.publicationEligible===false && r.reviewStatus==='pending'));
 assert.ok(b.edges.every(r=>r.plannerPlaceId===null && r.plannerEligible===false));
 assert.deepEqual(b.candidates.find(r=>r.seedId==='PAR-0045').proposedCatalogMatch,{catalogId:'cleo-from-5-to-7',status:'pending_identity_review',mergeAllowed:false});
 assert.ok(b.candidates.find(r=>r.seedId==='PAR-0004').original.proposed_correction.includes('alias'));
 assert.equal(b.edges.filter(r=>r.relation==='filmed_at_historical').length,2);
 assert.deepEqual(normalizeBundle(files),normalizeBundle(files));
});
test('reject duplicate IDs, unsupported media and any publication promotion',()=>{
 for(const mutate of [r=>r.push({...r[0]}),r=>{r[1].work_id=r[0].work_id;},r=>{r[0].publication_eligible='YES';},r=>{r[0].medium='unknown';}])
  assert.throws(()=>normalizeBundle(edit('priority_40_verification.csv',mutate)));
});
test('reject orphan, duplicate, mismatched, unsafe or invalid-date claims',()=>{
 for(const mutate of [r=>{r[0].seed_id='PAR-9999';},r=>r.push({...r[0]}),r=>{r[0].work_id='999';},r=>{r[0].title='Wrong work';},r=>{r[0].source_url='javascript:alert(1)';},r=>{r[0].source_url='https://user:password@example.com';},r=>{r[0].reviewed_on='2026-02-30';},r=>{r[0].review_status='approved';},r=>{r[0].scope='stronger_claim';}])
  assert.throws(()=>normalizeBundle(edit('source_backed_claims.csv',mutate)));
});
test('reject title ambiguity, dangling edge sources, missing caveats and duplicate edges',()=>{
 for(const mutate of [r=>{r[0].title='Unknown title';},r=>{r[0].source_url='https://example.com/unrelated';},r=>{r[0].caveat='';},r=>r.push({...r[0]}),r=>{r[0].relation='recommended_stop';}])
  assert.throws(()=>normalizeBundle(edit('verified_place_edges.csv',mutate)));
});
test('reject inconsistent summary counts and partial-check status without evidence',()=>{
 const f={...files,'verification_report.json':JSON.stringify({...JSON.parse(files['verification_report.json']),production_approved:1})};
 assert.throws(()=>normalizeBundle(f));
 assert.throws(()=>normalizeBundle(edit('source_backed_claims.csv',r=>r.shift())));
});
test('checksummed inputs and generated artifacts detect tampering and stale reports',async()=>{
 const root=await mkdtemp(join(tmpdir(),'culture-import-test-'));
 try {
  await cp(bundleRoot,root,{recursive:true}); await run(true,root);
  await writeFile(join(root,'generated/review-report.md'),'stale');await assert.rejects(run(true,root),/Stale review artifact/u);
  await run(false,root);await run(true,root);
  await writeFile(join(root,'source/README.md'),'changed source');await assert.rejects(loadBundle(root),/checksum mismatch/u);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('report renders review text as data and retains explicit limitations',()=>{
 const b=normalizeBundle(files); b.candidates[0].original.title='<script>x</script>|\nheading';
 const report=renderReport(b);assert.ok(!report.includes('<script>'));assert.ok(report.includes('&#124;'));
 assert.ok(report.includes('not** been independently rechecked'));assert.ok(report.includes('no merge'));
});
