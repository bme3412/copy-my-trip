import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

// Preserve imports instead of bundling them away, matching deployed Node ESM.
const outdir = 'node_modules/.tmp/api-runtime';
await mkdir(outdir, { recursive: true });
await writeFile(`${outdir}/package.json`, '{"type":"module"}');
const names = ['catalog','trips','account','notifications','companion-tick','narrate-day','extract-preferences'];
const entries = [...names.map(n=>`api/${n}.ts`),'api/companion-events.ts'];
const graph = await build({entryPoints:entries,bundle:true,write:false,outdir,metafile:true,packages:'external',platform:'node',logLevel:'error'});
const inputs=Object.keys(graph.metafile.inputs);
await build({entryPoints:inputs.filter(p=>!p.endsWith('.json')),outbase:'.',outdir,bundle:false,format:'esm',platform:'node',logLevel:'error'});
// Node's native JSON imports must retain their filename and bytes in the ESM fixture.
for(const file of inputs.filter(p=>p.endsWith('.json'))){const target=resolve(outdir,file);await mkdir(dirname(target),{recursive:true});await copyFile(file,target);}
for (const name of names) {
  const { default: handler } = await import(pathToFileURL(resolve(outdir, `api/${name}.js`)));
  let status;
  await handler({ method: 'PATCH', headers: {} }, { setHeader() {}, status(code) { status = code; return { json() {}, send() {} }; } });
  assert.equal(status, 405);
}
const {default:webhook}=await import(pathToFileURL(resolve(outdir,'api/companion-events.js')));
assert.equal((await webhook.fetch(new Request('https://example.invalid',{method:'GET'}))).status,405);
console.log('PASS all API handlers load and execute as unbundled Node ESM');
