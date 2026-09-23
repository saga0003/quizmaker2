from pathlib import Path
import base64
import io
import zipfile

parts_dir = Path('scripts/v19-reviewed')
parts = sorted(parts_dir.glob('part*.txt'))
if len(parts) != 4:
    raise SystemExit(f'Expected 4 reviewed payload parts, found {len(parts)}')

payload = ''.join(path.read_text().strip() for path in parts)
archive = base64.b64decode(payload, validate=True)

with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    bad = bundle.testzip()
    if bad:
        raise SystemExit(f'Corrupt reviewed patch entry: {bad}')
    names = bundle.namelist()
    if len(names) != 21:
        raise SystemExit(f'Expected 21 reviewed files, found {len(names)}')
    for name in names:
        target = Path(name)
        if target.is_absolute() or '..' in target.parts:
            raise SystemExit(f'Unsafe patch path: {name}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(bundle.read(name))

print(f'Applied reviewed V19.2 safe subset: {len(names)} files.')
