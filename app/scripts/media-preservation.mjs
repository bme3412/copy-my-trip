import assert from 'node:assert/strict';
import { readFile, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const variants=JSON.parse(await readFile('src/media/variants.json','utf8'));
const files=['paris-eiffel-tower-quai.jpeg','paris-saint-germain-deux-magots.jpeg','paris-vert-gallant.jpeg'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const findings=[];
for(const file of files){
 const original=await readFile(`public/media/paris/${file}`),meta=await sharp(original).metadata();
 for(const v of variants[`paris/${file}`].variants){const m=await sharp(`public${v.path}`).metadata();assert.ok(!m.exif&&!m.xmp&&!m.iptc,`Private metadata in derivative ${v.path}`);}
 findings.push({file,sha256:hash(original),originalContainsExif:!!meta.exif,derivativesChecked:variants[`paris/${file}`].variants.length});
}
// A local copy/restore integrity exercise, explicitly NOT an independent backup.
const dir='node_modules/.tmp/elsewhere-restore';await mkdir(dir,{recursive:true});
const source=`public/media/paris/${files[0]}`;
await copyFile(source,`${dir}/backup.jpeg`);await copyFile(`${dir}/backup.jpeg`,`${dir}/restored.jpeg`);
assert.equal(hash(await readFile(source)),hash(await readFile(`${dir}/restored.jpeg`)));
await copyFile('src/cities/paris/data/slot-files.json',`${dir}/slot-files.json`);
assert.deepEqual(await readFile('src/cities/paris/data/slot-files.json'),await readFile(`${dir}/slot-files.json`));
await writeFile(`${dir}/report.json`,JSON.stringify({findings,localRestore:'pass',independentBackup:'not verified'},null,2));
console.log(JSON.stringify({derivatives:'9 metadata-free variants checked',originalsWithExif:findings.filter(f=>f.originalContainsExif).length,localRestore:'pass',independentBackup:'not verified'}));
