from pathlib import Path

path = Path('src/components/evidara/paper-assignment-center.tsx')
text = path.read_text()
old = '''        {mode === 'filters' ? <div className="space-y-4 rounded-xl border border-[var(--line)] p-4">
          <div className="grid gap-4 md:grid-cols-2">'''
new = '''        {mode === 'filters' ? <div className="space-y-4 rounded-xl border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--canvas)] px-3 py-2">
            <div><strong className="text-sm">Audience presets</strong><p className="text-xs text-[var(--muted-foreground)]">Start broad, then narrow by grade, section or programme.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => { setAcademicYear('all'); setGrades([]); setSectionIds([]); setTracks([]); }}>All Students</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">'''
if text.count(old) != 1:
    raise SystemExit(f'expected one filters panel anchor, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
