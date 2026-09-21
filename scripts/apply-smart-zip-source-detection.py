from pathlib import Path

core = Path('src/components/evidara/question-bulk-import-dialog-core.tsx')
source = core.read_text()
old = r'''        const candidates = entries.filter((entry) => /\.(tex|csv|xlsx|xls|json|docx|pdf|txt)$/i.test(entry.name) && !/(^|\/)readme\.txt$/i.test(entry.name));
        const preferred = candidates.filter((entry) => !/\.txt$/i.test(entry.name));
        const sourceCandidates = preferred.length ? preferred : candidates;
        if (!sourceCandidates.length) throw new Error('This ZIP has no supported question source. Add exactly one TEX, XLSX, XLS, CSV, JSON, DOCX, text PDF or TXT question file.');
        if (sourceCandidates.length > 1) throw new Error(`This ZIP contains multiple question sources (${sourceCandidates.map((entry) => entry.name).join(', ')}). Keep exactly one source file so Evidara cannot choose the wrong paper.`);
        const sourceEntry = sourceCandidates[0];
        const sourceName = sourceEntry.name.split('/').pop() || 'questions.tex';
        sourceFile = new File([sourceEntry.blob], sourceName);
'''
new = r'''        const candidates = entries.filter((entry) => /\.(tex|csv|xlsx|xls|json|docx|pdf|txt)$/i.test(entry.name));
        if (!candidates.length) throw new Error('I could not find a question paper inside this ZIP. Upload a ZIP containing a question paper plus any images or supporting reports.');

        const supportFilePattern = /(^|\/)(?:readme|preflight(?:[_ -]?report)?|conversion(?:[_ -]?report)?|taxonomy[_ -]?(?:audit|report|summary|mapping|map)|validation[_ -]?(?:report|summary)|image[_ -]?(?:manifest|report)|manifest|metadata|notes?|summary|audit[_ -]?report)\.(?:csv|txt|json|xlsx?|xls)$/i;
        const normaliseHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

        const inspected = await Promise.all(candidates.map(async (entry) => {
          const extension = entry.name.split('.').pop()?.toLowerCase() || '';
          const shortName = entry.name.split('/').pop() || entry.name;
          const base = shortName.replace(/\.[^.]+$/, '').toLowerCase();
          const supportByName = supportFilePattern.test(entry.name);
          let score = supportByName ? -2500 : 0;
          let confidence: 'strong' | 'possible' | 'support' = supportByName ? 'support' : 'possible';

          if (/question|paper|exam|test|quiz/.test(base)) score += 120;

          if (extension === 'tex') {
            const text = await entry.text();
            const blocks = text.match(/\\begin\{question\}/gi)?.length || 0;
            if (blocks > 0) {
              score += 3000 + Math.min(blocks, 500);
              confidence = 'strong';
            } else if (/\\question\s*\{|\\option\s*\[/i.test(text)) {
              score += 1200;
            } else {
              score -= 500;
            }
          } else if (extension === 'csv') {
            const text = await entry.text();
            const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
            const headers = firstLine.split(',').map((value) => normaliseHeader(value.replace(/^"|"$/g, '')));
            const hasQuestionText = headers.some((header) => ['question', 'question_text', 'stem', 'stem_text'].includes(header));
            const optionCount = headers.filter((header) => /^option_[a-h](?:_text)?$/.test(header)).length;
            const hasAnswer = headers.some((header) => ['answer', 'correct_answer', 'correct_option', 'correct_options'].includes(header));
            const classificationHeaders = ['grade', 'subject', 'chapter', 'topic', 'difficulty'].filter((header) => headers.includes(header)).length;

            if (hasQuestionText && (optionCount >= 2 || hasAnswer)) {
              score += 2300;
              confidence = 'strong';
            } else if (hasQuestionText && classificationHeaders >= 4 && !hasAnswer && optionCount === 0) {
              score -= 1800;
              confidence = 'support';
            } else {
              score += 350;
            }
          } else if (extension === 'json') {
            const text = (await entry.text()).slice(0, 20000);
            const hasQuestion = /"(?:question|question_text|stem|stem_text)"\s*:/i.test(text);
            const hasOptions = /"(?:options|option_a|option_b)"\s*:/i.test(text);
            const hasAnswer = /"(?:answer|correct_answer|correct_option)"\s*:/i.test(text);
            if (hasQuestion && (hasOptions || hasAnswer)) {
              score += 2200;
              confidence = 'strong';
            } else {
              score += 300;
            }
          } else if (extension === 'txt') {
            const text = (await entry.text()).slice(0, 50000);
            if (/\\begin\{question\}/i.test(text) || (/question\s*\d*\s*[:.-]/i.test(text) && /option\s*[a-d]\s*[:.)-]/i.test(text))) {
              score += 1400;
              confidence = 'strong';
            } else {
              score += 100;
            }
          } else if (extension === 'xlsx' || extension === 'xls') {
            score += 900;
          } else if (extension === 'docx' || extension === 'pdf') {
            score += 800;
          }

          return { entry, score, confidence, supportByName };
        }));

        const ranked = inspected.filter((item) => item.score > 0 && item.confidence !== 'support').sort((a, b) => b.score - a.score);
        if (!ranked.length) throw new Error('I found supporting files in this ZIP, but no usable question paper. Upload the original question paper or a complete Evidara question ZIP.');

        const sourceChoice = ranked[0];
        const secondChoice = ranked[1];
        if (secondChoice && sourceChoice.confidence === 'strong' && secondChoice.confidence === 'strong' && sourceChoice.score - secondChoice.score < 150) {
          throw new Error(`I found more than one complete question paper in this ZIP (${sourceChoice.entry.name}, ${secondChoice.entry.name}). Please choose the paper you want to import.`);
        }
        if (secondChoice && sourceChoice.confidence !== 'strong' && sourceChoice.score - secondChoice.score < 100) {
          throw new Error(`I found more than one possible question paper in this ZIP (${sourceChoice.entry.name}, ${secondChoice.entry.name}). Please choose the paper you want to import.`);
        }

        const sourceEntry = sourceChoice.entry;
        const sourceName = sourceEntry.name.split('/').pop() || 'questions.tex';
        const ignoredSupportFiles = inspected.filter((item) => item.entry.name !== sourceEntry.name && (item.confidence === 'support' || item.supportByName));
        sourceFile = new File([sourceEntry.blob], sourceName);
'''
if old not in source:
    raise SystemExit('Expected ZIP source detection block not found')
source = source.replace(old, new, 1)
old_notice = """        setNotice(`ZIP bundle opened: ${sourceName} plus ${Math.max(0, entries.length - 1)} bundled asset${entries.length - 1 === 1 ? '' : 's'}. Evidara will match local image references automatically.`);"""
new_notice = """        setNotice(`ZIP ready. Evidara automatically chose ${sourceName} as the question paper${ignoredSupportFiles.length ? ` and ignored ${ignoredSupportFiles.length} supporting report file${ignoredSupportFiles.length === 1 ? '' : 's'}` : ''}. Bundled images will be matched automatically.`);"""
if old_notice not in source:
    raise SystemExit('Expected ZIP notice not found')
source = source.replace(old_notice, new_notice, 1)
core.write_text(source)

smoke = Path('scripts/v19-1-latex-paper-import-smoke.mjs')
smoke_source = smoke.read_text()
marker = "console.log(`\\nEvidara V19.1 LaTeX Paper Import: ${passed} passed, ${failed} failed`);"
if marker not in smoke_source:
    raise SystemExit('Expected smoke marker not found')
checks = r'''const smartZipImport=read('src/components/evidara/question-bulk-import-dialog-core.tsx');
check('ZIP import auto-detects the real question source',smartZipImport.includes('supportFilePattern')&&smartZipImport.includes('sourceChoice'));
check('taxonomy audit CSV is treated as support, not a paper',smartZipImport.includes("classificationHeaders >= 4")&&smartZipImport.includes("confidence = 'support'"));
check('structured Evidara TEX is preferred automatically',smartZipImport.includes("3000 + Math.min(blocks, 500)")&&smartZipImport.includes("confidence = 'strong'"));
check('ZIP success notice is teacher-friendly',smartZipImport.includes('ZIP ready. Evidara automatically chose'));
'''
smoke.write_text(smoke_source.replace(marker, checks + '\n' + marker, 1))
print('Applied smart ZIP source detection.')
