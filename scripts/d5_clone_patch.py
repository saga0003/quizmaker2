from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

path = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
text = path.read_text()
text = replace_once(text, "CircleStop,\nClock3,", "CircleStop,\nClock3,\nCopyPlus,", 'copy icon import')
text = replace_once(text, "const [saving, setSaving] = useState(false);\nconst [error, setError] = useState('');", "const [saving, setSaving] = useState(false);\nconst [cloningPaperId, setCloningPaperId] = useState('');\nconst [error, setError] = useState('');", 'clone busy state')
needle = "async function confirmDelete() {"
clone_fn = "async function cloneAsNewVersion(paper: PaperListRow) {\nif (!supabase) return;\nsetCloningPaperId(paper.id);\nsetError('');\nsetMessage('');\nconst { data, error: cloneError } = await supabase.rpc('clone_paper_as_new_version_v1', {\np_source_paper_id: paper.id,\np_title: null,\n});\nsetCloningPaperId('');\nif (cloneError) {\nsetError(cloneError.message);\nreturn;\n}\nconst clone = data as { title?: string; version_number?: number } | null;\nsetMessage(`Created ${clone?.title || 'a new draft version'}. Audience and publication state were reset.`);\nawait load();\n}\n"
text = replace_once(text, needle, clone_fn + needle, 'clone function')
needle2 = "<div className=\"flex justify-end gap-1\">\n<Button variant=\"ghost\" size=\"icon\" title=\"Edit paper\""
replacement2 = "<div className=\"flex justify-end gap-1\">\n<Button variant=\"ghost\" size=\"icon\" title=\"Clone as new version\" disabled={cloningPaperId === paper.id} onClick={() => void cloneAsNewVersion(paper)} className=\"h-9 w-9 text-[#44545C] hover:bg-[var(--line)]\">{cloningPaperId === paper.id ? <LoaderCircle className=\"h-4 w-4 animate-spin\" /> : <CopyPlus className=\"h-4 w-4\" />}</Button>\n<Button variant=\"ghost\" size=\"icon\" title=\"Edit paper\""
text = replace_once(text, needle2, replacement2, 'clone action button')
path.write_text(text)
