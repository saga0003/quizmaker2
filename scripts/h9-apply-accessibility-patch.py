from pathlib import Path

p = Path('src/components/institution-analytics/institution-analytics-workspace.tsx')
s = p.read_text()
repls = [
    (
        '<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} />',
        '<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} aria-label={placeholder} />',
        'search input accessible name',
    ),
    (
        '<select value={filter} onChange={(event) => setFilter(event.target.value)}>',
        '<select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label={filterLabel}>',
        'filter accessible name',
    ),
    (
        '<Checkbox checked={selected.has(row.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); checked ? next.add(row.id) : next.delete(row.id); return next; })} />',
        '<Checkbox checked={selected.has(row.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); checked ? next.add(row.id) : next.delete(row.id); return next; })} aria-label={`Select ${row.name}`} />',
        'student checkbox accessible name',
    ),
]
for old, new, label in repls:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    s = s.replace(old, new, 1)
p.write_text(s)
print('H9 accessibility source patch applied.')
