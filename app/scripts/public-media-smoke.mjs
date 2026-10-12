import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import { auditMedia } from './public-media.mjs';
const temp = await mkdtemp(join(tmpdir(), 'cmt-privacy-test-'));
try {
  const jpeg = join(temp, 'private.jpeg');
  await sharp({create:{width:8,height:8,channels:3,background:'white'}}).withExif({IFD0:{Artist:'Synthetic private author'}}).jpeg().toFile(jpeg);
  await assert.rejects(auditMedia(temp), /Metadata in/u);
  await rm(jpeg);
  const video = join(temp,'private.mp4');
  const result = spawnSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=black:s=16x16:d=0.1','-metadata','location=+00.0000+000.0000/','-c:v','libx264',video]);
  assert.equal(result.status,0);
  await assert.rejects(auditMedia(temp), /Unapproved video metadata/u);
} finally { await rm(temp,{recursive:true,force:true}); }
async function list(root) {
  const out=[];
  for(const e of await readdir(root,{withFileTypes:true})) {
    const p=join(root,e.name);if(e.isDirectory())out.push(...await list(p));else out.push(p);
  }
  return out.sort();
}
const source=resolve('public/media'),dest=resolve('dist/media');
assert.deepEqual((await list(source)).map(p=>relative(source,p)),(await list(dest)).map(p=>relative(dest,p)),'Every existing media URL must survive');
// Check the redactor's fingerprints independently of its in-process assertions.
const report=JSON.parse(await readFile('node_modules/.tmp/public-media-report.json','utf8'));
for(const row of report.records)assert.equal(createHash('sha256').update(await readFile(join(source,row.path))).digest('hex'),row.sourceSha256);
let videos = 0;
function streamHashes(path) {
  const result = spawnSync(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', path,
    '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-'], {encoding:'utf8'});
  assert.equal(result.status, 0, `Cannot fingerprint audiovisual streams: ${path}`);
  return result.stdout.trim();
}
for (const row of report.records) {
  const original = join(source, row.path), output = join(dest, row.path);
  assert.equal(createHash('sha256').update(await readFile(output)).digest('hex'), row.publicSha256);
  if (['.mp4', '.mov'].includes(extname(row.path).toLowerCase())) {
    assert.equal(streamHashes(output), streamHashes(original), `Audiovisual packets changed: ${row.path}`);
    videos++;
  }
  if (extname(row.path).toLowerCase() === '.webp') assert.equal(row.publicSha256, row.sourceSha256);
}
console.log(`PASS tagged image/video rejection, exact public path inventory, unchanged originals/WebP derivatives, and ${videos} identical audiovisual stream hashes`);
