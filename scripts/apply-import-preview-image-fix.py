from pathlib import Path

core = Path('src/components/evidara/question-bulk-import-dialog-core.tsx')
source = core.read_text()

state_marker = "  const [zipNames, setZipNames] = useState<Set<string> | null>(null);\n"
state_addition = state_marker + "  const [previewImageUrls, setPreviewImageUrls] = useState<Map<string, string>>(new Map());\n"
if state_marker not in source:
    raise SystemExit('zipNames state marker not found')
source = source.replace(state_marker, state_addition, 1)

effect_marker = "  useEffect(() => { setCreatePaper(false); }, [kind, embeddedPaperMode, open]);\n"
effect_addition = effect_marker + r'''
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    setPreviewImageUrls(new Map());

    if (!imageZip) return () => undefined;

    void (async () => {
      try {
        const zip = await readZip(await imageZip.arrayBuffer());
        const entries = [...zip.values()].filter((entry) => !entry.name.endsWith('/'));
        const nameCounts = new Map<string, number>();
        for (const entry of entries) {
          const name = baseName(entry.name);
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }

        const next = new Map<string, string>();
        for (const entry of entries) {
          const name = baseName(entry.name);
          let blob: Blob;
          try {
            ({ blob } = normalizeImageBytes(entry.bytes, name, 4 * 1024 * 1024));
          } catch {
            continue;
          }
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          next.set(archivePath(entry.name), url);
          if ((nameCounts.get(name) || 0) === 1) next.set(name, url);
        }

        if (cancelled) {
          objectUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        setPreviewImageUrls(next);
      } catch {
        if (!cancelled) setPreviewImageUrls(new Map());
      }
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageZip]);
'''
if effect_marker not in source:
    raise SystemExit('effect marker not found')
source = source.replace(effect_marker, effect_addition, 1)

preview_marker = "  const previewOptions = currentPayload?.options || [];\n"
preview_replacement = r'''  function previewImageUrl(value?: string) {
    const clean = String(value || '').trim();
    if (!clean) return '';
    if (isRemoteUrl(clean)) return clean;
    return previewImageUrls.get(archivePath(clean)) || previewImageUrls.get(baseName(clean)) || '';
  }

  const previewOptions = (currentPayload?.options || []).map((option) => ({
    ...option,
    image_url: previewImageUrl(option.image_url),
  }));
'''
if preview_marker not in source:
    raise SystemExit('preview options marker not found')
source = source.replace(preview_marker, preview_replacement, 1)

question_image_old = "imageUrl: isRemoteUrl(currentPayload.question_image_url || '') ? currentPayload.question_image_url : ''"
question_image_new = "imageUrl: previewImageUrl(currentPayload.question_image_url || '')"
if question_image_old not in source:
    raise SystemExit('question preview image expression not found')
source = source.replace(question_image_old, question_image_new, 1)

core.write_text(source)

smoke = Path('scripts/v19-1-latex-paper-import-smoke.mjs')
source = smoke.read_text()
marker = "console.log(`\\nEvidara V19.1 LaTeX Paper Import: ${passed} passed, ${failed} failed`);"
if marker not in source:
    raise SystemExit('smoke marker not found')
addition = r'''const bulkPreview=read('src/components/evidara/question-bulk-import-dialog-core.tsx');
check('bundled local images preview before import',bulkPreview.includes('previewImageUrls')&&bulkPreview.includes('URL.createObjectURL')&&bulkPreview.includes('image_url: previewImageUrl(option.image_url)')&&bulkPreview.includes("imageUrl: previewImageUrl(currentPayload.question_image_url || '')"));
'''
smoke.write_text(source.replace(marker, addition + '\n' + marker, 1))

print('Applied import preview local-image fix.')
