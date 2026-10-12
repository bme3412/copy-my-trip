/** Build-time privacy boundary. Source archive bytes are never modified. */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir, rename, copyFile } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(app, 'public/media');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const videoExtensions = new Set(['.mov', '.mp4']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(root) {
  const result = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, item.name);
    if (item.isSymbolicLink()) throw Error('Media symlinks are not publishable');
    if (item.isDirectory()) result.push(...await files(path));
    else if (item.isFile()) result.push(path);
  }
  return result.sort();
}
function videoTags(path) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', path], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  // FFmpeg intentionally exits 1 without an output; inspect all stream metadata.
  assert.match(result.stderr ?? '', /Input #0,/u, `Cannot inspect ${relative(app, path)}`);
  let indent = -1;
  const tags = [];
  for (const line of result.stderr.split('\n')) {
    if (/^\s+Metadata:\s*$/u.test(line)) { indent = line.search(/\S/u); continue; }
    if (indent < 0) continue;
    if (line.trim() && line.search(/\S/u) <= indent) { indent = -1; continue; }
    const match = line.match(/^\s+([^:]+?)\s*:\s*(.*)$/u);
    if (match) tags.push([match[1].trim(), match[2].trim()]);
  }
  return tags;
}
export async function auditMedia(root) {
  const allowed = new Set(['major_brand', 'minor_version', 'compatible_brands', 'encoder', 'handler_name', 'vendor_id', 'language']);
  const result = { images: 0, videos: 0, documents: 0 };
  for (const path of await files(root)) {
    const ext = extname(path).toLowerCase();
    if (imageExtensions.has(ext)) {
      const meta = await sharp(path).metadata();
      assert.ok(!meta.exif && !meta.xmp && !meta.iptc && !meta.icc, `Metadata in ${relative(root, path)}`);
      result.images++;
    } else if (videoExtensions.has(ext)) {
      for (const [key, value] of videoTags(path)) {
        assert.ok(allowed.has(key), `Unapproved video metadata field: ${key} in ${relative(root, path)}`);
        if (key === 'handler_name') assert.ok(['VideoHandler', 'SoundHandler'].includes(value));
        if (key === 'encoder') assert.match(value, /^Lav[fc][0-9.]+$/u);
        if (key === 'language') assert.equal(value, 'und');
      }
      result.videos++;
    } else if (ext === '.md') result.documents++;
    else throw Error(`Unreviewed media format: ${relative(root, path)}`);
  }
  return result;
}
export async function preparePublicMedia(root, existingOnly = false) {
  root = resolve(root);
  // Only generated build/staging outputs may be replaced. Never point at source.
  const allowed = [resolve(app, 'dist/media'), resolve(app, 'node_modules/.tmp/media-publish/media')];
  assert.ok(allowed.includes(root), 'Redaction target must be the build or publication stage');
  const records = [];
  for (const path of await files(source)) {
    const rel = relative(source, path), target = resolve(root, rel), ext = extname(path).toLowerCase();
    if (existingOnly && !existsSync(target)) continue;
    const before = hash(await readFile(path));
    await mkdir(dirname(target), { recursive: true });
    if (imageExtensions.has(ext)) {
      const meta = await sharp(path).metadata();
      if (!meta.exif && !meta.xmp && !meta.iptc && !meta.icc) await copyFile(path, target);
      else {
        let pipeline = sharp(path).rotate().toColourspace('srgb');
        if (ext === '.jpg' || ext === '.jpeg') pipeline = pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' });
        else if (ext === '.webp') pipeline = pipeline.webp({ lossless: true });
        else pipeline = pipeline.png();
        await pipeline.toFile(target);
      }
      const actual = await sharp(target).metadata();
      const expected = meta.autoOrient ?? { width: meta.width, height: meta.height };
      assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
    } else if (videoExtensions.has(ext)) {
      const temp = target + '.redacting' + ext;
      const result = spawnSync(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', path,
        '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-map_metadata', '-1', '-map_metadata:s', '-1', '-map_chapters', '-1',
        '-metadata:s:v', 'handler_name=VideoHandler', '-metadata:s:a', 'handler_name=SoundHandler',
        '-metadata:s', 'language=und', '-movflags', '+faststart', temp], { encoding: 'utf8' });
      assert.equal(result.status, 0, `Video redaction failed: ${rel}`);
      await rename(temp, target);
    } else if (ext === '.md') await copyFile(path, target);
    else throw Error(`Unreviewed media format: ${rel}`);
    assert.equal(hash(await readFile(path)), before, `Original changed: ${rel}`);
    records.push({ path: rel, sourceSha256: before, publicSha256: hash(await readFile(target)) });
  }
  const result = await auditMedia(root);
  // Audit evidence stays outside public output and contains hashes, never EXIF.
  await mkdir(resolve(app, 'node_modules/.tmp'), { recursive: true });
  await writeFile(resolve(app, 'node_modules/.tmp/public-media-report.json'), JSON.stringify({ result, records }, null, 2));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stage = process.argv.includes('--stage');
  const root = resolve(app, stage ? 'node_modules/.tmp/media-publish/media' : 'dist/media');
  console.log(JSON.stringify(process.argv.includes('--check') ? await auditMedia(root) : await preparePublicMedia(root, stage)));
}
