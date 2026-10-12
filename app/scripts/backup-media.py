"""Explicit local archive backup; never changes originals or uploads data.
Usage: python3 scripts/backup-media.py /absolute/non-iCloud/backup-directory
"""
import hashlib, json, os, pathlib, sys, tarfile, tempfile
from datetime import datetime, timezone

app = pathlib.Path(__file__).resolve().parent.parent
repo = app.parent
base = pathlib.Path(sys.argv[1]).expanduser().resolve()
if not base.is_absolute() or base == repo or repo in base.parents or 'com~apple~CloudDocs' in str(base):
    raise SystemExit('Choose a backup directory outside the repository and iCloud.')
base.mkdir(parents=True, exist_ok=True, mode=0o700)
out = base / ('phase0-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
out.mkdir(mode=0o700)  # Never overwrite a previous backup.
def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()
files = sorted(p for p in (app / 'public/media').rglob('*') if p.is_file())
files += sorted(p for p in (app / 'src/media').rglob('*') if p.is_file())
for city in (app / 'src/cities').iterdir():
    for p in (city / 'data').glob('*.json'):
        if 'media' in p.name or p.name == 'slot-files.json': files.append(p)
records = []
archive = out / 'media-and-manifests.tar'
with tarfile.open(archive, 'x') as tar:
    for p in files:
        if p.is_symlink(): raise ValueError('Symlinks are not allowed in the backup')
        relative = p.relative_to(app).as_posix()
        before = digest(p)
        tar.add(p, arcname=relative, recursive=False)
        records.append({'path': relative, 'bytes': p.stat().st_size, 'sha256': before})
# Restore every entry into an isolated temporary directory, then compare both
# the restored bytes and current originals to the pre-copy fingerprints.
with tempfile.TemporaryDirectory(prefix='restore-', dir=out) as temp:
    root = pathlib.Path(temp)
    with tarfile.open(archive, 'r') as tar:
        assert len(tar.getmembers()) == len(records)
        for entry, record in zip(tar.getmembers(), records):
            assert entry.isfile() and entry.name == record['path']
            target = root / entry.name
            assert root in target.resolve().parents
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(entry) as src, target.open('xb') as dst:
                import shutil
                shutil.copyfileobj(src, dst)
            assert digest(target) == record['sha256'], entry.name
            assert digest(app / entry.name) == record['sha256'], 'Source changed: ' + entry.name
manifest = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
            'scope': 'all public media and media manifests', 'archiveSha256': digest(archive),
            'files': records, 'restore': 'all entries restored and SHA-256 matched',
            'failureDomain': 'same Mac, outside iCloud; not off-device protection'}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
os.chmod(archive, 0o600)
os.chmod(out / 'manifest.json', 0o600)
print(json.dumps({'backup': str(out), 'files': len(records), 'bytes': sum(r['bytes'] for r in records), 'restore': 'pass'}))
