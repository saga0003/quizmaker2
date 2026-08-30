import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';

function failure(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  const status = value.status || (value.code === '42501' ? 403 : value.code === '22023' ? 400 : 500);
  return NextResponse.json({ error: value.message || 'Unexpected PYQ import error.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function superAdminContext(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error } = await auth.admin.from('profiles').select('id,role').eq('id', auth.user.id).single();
  if (error || !profile || normalizeEvidaraRole(profile.role) !== 'super_admin') {
    throw Object.assign(new Error('Only Super Admin can import or promote platform PYQ archives.'), { status: 403 });
  }
  return { ...auth, profile };
}

export async function GET(request: Request) {
  try {
    const ctx = await superAdminContext(request);
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize') || 50)));
    const year = params.get('year');
    const subject = params.get('subject');
    const flagged = params.get('flagged');
    const offset = (page - 1) * pageSize;

    let query = ctx.admin
      .from('question_staging')
      .select('id,batch_id,source_record_id,source_question_number,source_subject,source_chapter,source_topic,official_unit,answer_evidence,mapping_confidence,chapter_id,topic_id,official_syllabus_code,source_exam_label,source_year,source_flag,working_stem_latex,source_answer_text,working_solution_latex,answer_status,mapping_status,workflow_status,review_priority,promoted_question_id,created_at', { count: 'exact' })
      .like('source_key', 'neet_pyq_%')
      .order('source_year', { ascending: false })
      .order('source_question_number', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (year && year !== 'all') query = query.eq('source_year', Number(year));
    if (subject && subject !== 'all') query = query.eq('source_subject', subject);
    if (flagged === 'yes') query = query.not('source_flag', 'is', null);
    if (flagged === 'no') query = query.is('source_flag', null);

    const [{ data: rows, error, count }, { data: batches, error: batchError }] = await Promise.all([
      query,
      ctx.admin.from('question_staging_batches')
        .select('id,external_batch_id,source_file_name,status,total_rows,imported_rows,failed_rows,created_at,completed_at,metadata')
        .like('source_key', 'neet_pyq_%')
        .order('created_at', { ascending: false }),
    ]);
    if (error || batchError) throw new Error(error?.message || batchError?.message || 'Unable to load PYQ review queue.');

    const { count: totalStaged } = await ctx.admin.from('question_staging').select('id', { count: 'exact', head: true }).like('source_key', 'neet_pyq_%');
    const { count: promoted } = await ctx.admin.from('question_staging').select('id', { count: 'exact', head: true }).like('source_key', 'neet_pyq_%').not('promoted_question_id', 'is', null);
    const { count: flaggedCount } = await ctx.admin.from('question_staging').select('id', { count: 'exact', head: true }).like('source_key', 'neet_pyq_%').not('source_flag', 'is', null);
    const { count: taxonomyMapped } = await ctx.admin.from('question_staging').select('id', { count: 'exact', head: true }).like('source_key', 'neet_pyq_%').not('chapter_id', 'is', null);
    const { count: taxonomyReview } = await ctx.admin.from('question_staging').select('id', { count: 'exact', head: true }).like('source_key', 'neet_pyq_%').is('chapter_id', null);

    return NextResponse.json({
      rows: rows || [],
      batches: batches || [],
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      summary: { staged: totalStaged || 0, promoted: promoted || 0, flagged: flaggedCount || 0, taxonomyMapped: taxonomyMapped || 0, taxonomyReview: taxonomyReview || 0 },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}


function cleanSourceKey(value: unknown) {
  const text = String(value || 'NEET_PYQ_V19').toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return (text || 'NEET_PYQ_V19').slice(0, 128);
}

function normalizedName(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function arrayStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function renderWithUrls(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const render = value as Record<string, unknown>;
  const prompt = Array.isArray(render.prompt_segments) ? render.prompt_segments as Array<Record<string, unknown>> : [];
  const solution = Array.isArray(render.solution_segments) ? render.solution_segments as Array<Record<string, unknown>> : [];
  const valid = (segment: Record<string, unknown>) => Boolean(String(segment.url || '').trim()) && Array.isArray(segment.viewBox) && segment.viewBox.length === 4;
  if (!prompt.length || prompt.some((segment) => !valid(segment))) return null;
  if (!solution.length || solution.some((segment) => !valid(segment))) return null;
  return { ...render, prompt_segments: prompt, solution_segments: solution };
}

export async function POST(request: Request) {
  try {
    const ctx = await superAdminContext(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || 'importChunk');

    if (action === 'importChunk') {
      const batchInput = body.batch && typeof body.batch === 'object' ? body.batch as Record<string, unknown> : null;
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!batchInput || !rows.length || rows.length > 50) {
        throw Object.assign(new Error('Each import chunk must contain a batch definition and 1–50 questions.'), { status: 400 });
      }
      const batch = { ...batchInput, created_by: ctx.user.id };
      const sourcePaper = batchInput.source_paper && typeof batchInput.source_paper === 'object'
        ? batchInput.source_paper as Record<string, unknown>
        : {
            exam_type: 'NEET',
            year: batchInput.year,
            variant: 'Main',
            source_key: batchInput.source_key,
            display_name: batchInput.external_batch_id,
            expected_question_count: batchInput.total_rows,
          };
      const { error: sourcePaperError } = await ctx.admin.rpc('upsert_pyq_source_paper_service_v18', {
        p_source: { ...sourcePaper, source_key: sourcePaper.source_key || batchInput.source_key, expected_question_count: sourcePaper.expected_question_count || batchInput.total_rows },
        p_actor: ctx.user.id,
      });
      if (sourcePaperError) throw Object.assign(new Error(sourcePaperError.message), { code: sourcePaperError.code });
      const { data, error } = await ctx.admin.rpc('import_neet_pyq_staging_batch_v16', { p_batch: batch, p_rows: rows });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      const { data: taxonomy, error: taxonomyError } = await ctx.admin.rpc('enrich_neet_pyq_taxonomy_v17', { p_rows: rows, p_actor: ctx.user.id });
      if (taxonomyError) throw Object.assign(new Error(taxonomyError.message), { code: taxonomyError.code });
      return NextResponse.json({ result: data, taxonomy }, { headers: { 'Cache-Control': 'no-store' } });
    }


    if (action === 'importV19Direct') {
      const batchInput = body.batch && typeof body.batch === 'object' ? body.batch as Record<string, unknown> : null;
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      if (!batchInput || !rows.length || rows.length > 50) {
        throw Object.assign(new Error('Each V19 direct-import chunk must contain a batch definition and 1–50 questions.'), { status: 400 });
      }
      if (String(batchInput.package_version || '') !== 'v19.0') {
        throw Object.assign(new Error('This direct importer accepts only the Evidara V19 asset-aware PYQ package.'), { status: 400 });
      }

      const sourcePaper = batchInput.source_paper && typeof batchInput.source_paper === 'object'
        ? batchInput.source_paper as Record<string, unknown>
        : null;
      if (!sourcePaper?.source_key) throw Object.assign(new Error('V19 paper identity is missing.'), { status: 400 });
      const originalSourceKey = String(sourcePaper.source_key);
      const dbSourceKey = cleanSourceKey(originalSourceKey);
      const sourceDisplay = String(sourcePaper.display_name || batchInput.external_batch_id || 'NEET PYQ');

      const { error: sourcePaperError } = await ctx.admin.rpc('upsert_pyq_source_paper_service_v18', {
        p_source: { ...sourcePaper, source_key: originalSourceKey, expected_question_count: sourcePaper.expected_question_count || batchInput.total_rows },
        p_actor: ctx.user.id,
      });
      if (sourcePaperError) throw Object.assign(new Error(sourcePaperError.message), { code: sourcePaperError.code });
      const { data: paperRow, error: paperError } = await ctx.admin.from('pyq_source_papers').select('id,display_name,variant,paper_code,paper_key').eq('source_key', originalSourceKey).single();
      if (paperError || !paperRow) throw new Error(paperError?.message || 'Unable to resolve the V19 source paper.');

      const { error: sourceError } = await ctx.admin.from('question_sources').upsert({
        source_key: dbSourceKey,
        display_name: sourceDisplay,
        source_version: 'V19',
        attribution_text: sourceDisplay,
        rights_status: 'restricted_review_only',
        is_active: true,
        metadata: { import_source: 'evidara_pyq_v19', original_source_key: originalSourceKey, paper_key: sourcePaper.paper_key || null },
        created_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'source_key' });
      if (sourceError) throw new Error(sourceError.message);

      const [{ data: chapters, error: chapterError }, { data: topics, error: topicError }] = await Promise.all([
        ctx.admin.from('chapters').select('id,name,subject_id').is('organization_id', null),
        ctx.admin.from('topics').select('id,name,chapter_id').is('organization_id', null),
      ]);
      if (chapterError || topicError) throw new Error(chapterError?.message || topicError?.message || 'Unable to load question taxonomy.');
      const chapterRows = chapters || [];
      const topicRows = topics || [];

      const rowIds = rows.map((row) => String(row.id || '')).filter(Boolean);
      const duplicateHashes = rows.map((row) => String(row.duplicate_hash || '')).filter(Boolean);
      const [{ data: existingById }, { data: existingByHash }] = await Promise.all([
        rowIds.length ? ctx.admin.from('questions').select('id,duplicate_hash').in('id', rowIds) : Promise.resolve({ data: [] as Array<{ id: string; duplicate_hash: string | null }> }),
        duplicateHashes.length ? ctx.admin.from('questions').select('id,duplicate_hash').in('duplicate_hash', duplicateHashes) : Promise.resolve({ data: [] as Array<{ id: string; duplicate_hash: string | null }> }),
      ]);
      const idMap = new Map<string, string>();
      for (const item of existingById || []) idMap.set(String(item.id), String(item.id));
      const hashMap = new Map<string, string>();
      for (const item of existingByHash || []) if (item.duplicate_hash && !hashMap.has(String(item.duplicate_hash))) hashMap.set(String(item.duplicate_hash), String(item.id));

      const inserts: Array<Record<string, unknown>> = [];
      const prepared: Array<{ row: Record<string, unknown>; questionId: string; reused: boolean; chapterId: string | null; topicId: string | null; render: Record<string, unknown> }> = [];
      for (const row of rows) {
        const id = String(row.id || '');
        if (!id) throw Object.assign(new Error('One V19 question is missing its deterministic ID.'), { status: 400 });
        const render = renderWithUrls(row.v19_render);
        if (!render) throw Object.assign(new Error(`V19 visual assets are incomplete for ${row.source_record_id || id}. Upload the complete V19 folder.`), { status: 400 });
        const subjectId = String(row.subject_id || '') || null;
        const chapterName = normalizedName(row.source_chapter || row.taxonomy_candidate_chapter);
        const chapter = chapterName ? chapterRows.find((item) => (!subjectId || String(item.subject_id) === subjectId) && normalizedName(item.name) === chapterName) : null;
        const chapterId = chapter ? String(chapter.id) : null;
        const topicName = normalizedName(row.source_topic || row.taxonomy_candidate_topic);
        const topic = chapterId && topicName ? topicRows.find((item) => String(item.chapter_id) === chapterId && normalizedName(item.name) === topicName) : null;
        const topicId = topic ? String(topic.id) : null;
        const hash = String(row.duplicate_hash || '');
        const existingId = idMap.get(id) || (hash ? hashMap.get(hash) : undefined);
        const questionId = existingId || id;
        const reused = Boolean(existingId);
        prepared.push({ row, questionId, reused, chapterId, topicId, render });
        if (reused) continue;

        const year = Number(row.pyq_year || row.source_year || sourcePaper.year || 0) || null;
        const answer = arrayStrings(row.working_answer);
        const difficultyRaw = String(row.difficulty_estimate || 'moderate');
        const difficulty = ['very_easy','easy','moderate','difficult','very_difficult'].includes(difficultyRaw) ? difficultyRaw : 'moderate';
        const stemText = String(row.working_stem_text || row.working_stem_latex || '').trim() || `${sourceDisplay} Question ${row.source_question_number || ''}`.trim();
        const solutionText = String(row.working_solution_text || row.working_solution_latex || '').trim() || null;
        const stemLatex = String(row.working_stem_latex_v19 || '').trim() || null;
        const solutionLatex = String(row.working_solution_latex_v19 || '').trim() || null;
        const requiresTaxonomyReview = !chapterId || Boolean((row.v19_quality as Record<string, unknown> | undefined)?.taxonomy_review_required);
        inserts.push({
          id: questionId,
          organization_id: null,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
          question_type: 'single_correct',
          status: 'in_review',
          difficulty,
          stem_text: stemText,
          stem_latex: stemLatex,
          question_image_url: null,
          solution_text: solutionText,
          solution_latex: solutionLatex,
          marks: 4,
          negative_marks: 1,
          correct_answer: answer,
          exam_types: ['NEET'],
          class_level: '11-12',
          source: sourceDisplay,
          source_year: year,
          language: 'English',
          tags: ['NEET','PYQ',year ? String(year) : '',String(row.pyq_variant || sourcePaper.variant || '')].filter(Boolean),
          metadata: {
            import_source: 'evidara_pyq_v19',
            source_fidelity: true,
            v19_render: render,
            v19_quality: row.v19_quality || {},
            source_exam_label: row.source_exam_label || sourceDisplay,
            source_question_number: row.source_question_number || null,
            pyq_exam_type: row.pyq_exam_type || sourcePaper.exam_type || 'NEET',
            pyq_year: year,
            pyq_variant: row.pyq_variant || sourcePaper.variant || 'Main',
            pyq_paper_code: row.pyq_paper_code || sourcePaper.paper_code || null,
            pyq_paper_key: row.pyq_paper_key || sourcePaper.paper_key || null,
            biology_division: row.biology_division || null,
            source_chapter: row.source_chapter || null,
            source_topic: row.source_topic || null,
            mapping_confidence: row.mapping_confidence || 0,
            requires_taxonomy_review: requiresTaxonomyReview,
            source_out_of_syllabus: Boolean(row.source_out_of_syllabus_flag),
            original_source_key: originalSourceKey,
          },
          duplicate_hash: hash || null,
          source_key: dbSourceKey,
          source_record_id: row.source_record_id || null,
          source_attribution: sourceDisplay,
          source_rights_status: 'restricted_review_only',
          review_requested_at: new Date().toISOString(),
          seo_status: 'draft',
        });
      }

      if (inserts.length) {
        const { error: insertError } = await ctx.admin.from('questions').insert(inserts);
        if (insertError) throw new Error(insertError.message);
        const optionRows: Array<Record<string, unknown>> = [];
        for (const item of prepared.filter((item) => !item.reused)) {
          const answer = arrayStrings(item.row.working_answer);
          const options = Array.isArray(item.row.options) ? item.row.options as Array<Record<string, unknown>> : [];
          for (const option of options) optionRows.push({
            question_id: item.questionId,
            option_key: String(option.option_key || ''),
            content_text: String(option.content_text_v19 || option.source_content_latex || ''),
            content_latex: String(option.content_latex_v19 || '').trim() || null,
            image_url: null,
            is_correct: answer.includes(String(option.option_key || '')),
            display_order: Number(option.display_order || 0),
          });
        }
        if (optionRows.length) {
          const { error: optionsError } = await ctx.admin.from('question_options').insert(optionRows);
          if (optionsError) throw new Error(optionsError.message);
        }
      }

      const occurrenceRows = prepared.map((item) => ({
        question_id: item.questionId,
        source_paper_id: paperRow.id,
        source_question_number: Number(item.row.source_question_number || item.row.pyq_question_number || 0) || null,
        subject_label: String(item.row.source_subject || ''),
        metadata: { import_source: 'evidara_pyq_v19', source_exam_label: item.row.source_exam_label || sourceDisplay, source_fidelity: true },
        created_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      }));
      if (occurrenceRows.length) {
        const { error: occurrenceError } = await ctx.admin.from('question_pyq_occurrences').upsert(occurrenceRows, { onConflict: 'source_paper_id,source_question_number' });
        if (occurrenceError) throw new Error(occurrenceError.message);
      }

      const stagingIds = prepared.map((item) => String(item.row.id || '')).filter(Boolean);
      if (stagingIds.length) {
        // V19 deliberately removes the old double-review staging copy after the
        // question exists safely in the main Question Bank as In Review.
        const { error: stagingDeleteError } = await ctx.admin.from('question_staging').delete().in('id', stagingIds);
        if (stagingDeleteError) throw new Error(stagingDeleteError.message);
      }

      return NextResponse.json({
        ok: true,
        inserted: prepared.filter((item) => !item.reused).length,
        reused: prepared.filter((item) => item.reused).length,
        inReview: prepared.length,
        sourcePaper: sourceDisplay,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'promote') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
      if (!ids.length) throw Object.assign(new Error('Choose at least one staged question.'), { status: 400 });
      const results: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        try {
          const { data: staged, error: stagedError } = await ctx.admin.from('question_staging').select('*').eq('id', id).single();
          if (stagedError || !staged) throw new Error(stagedError?.message || 'Staged question not found.');
          if (staged.promoted_question_id) {
            const { data: sourcePaper } = await ctx.admin.from('pyq_source_papers').select('id').eq('source_key', staged.source_key).maybeSingle();
            if (sourcePaper?.id) {
              await ctx.admin.from('question_pyq_occurrences').upsert({
                question_id: staged.promoted_question_id,
                source_paper_id: sourcePaper.id,
                source_question_number: staged.source_question_number,
                subject_label: staged.source_subject,
                metadata: { import_source: 'neet_pyq_v18' },
                created_by: ctx.user.id,
              }, { onConflict: 'source_paper_id,source_question_number' });
            }
            results.push({ id, status: 'existing', questionId: staged.promoted_question_id }); continue;
          }
          const answer = Array.isArray(staged.working_answer) ? staged.working_answer.map(String) : [];
          const stem = String(staged.working_stem_latex || '').trim();
          const solution = String(staged.working_solution_latex || '').trim();
          if (!stem || !answer.length || !solution || !staged.subject_id) throw new Error('Question, answer, solution and subject are required before promotion.');
          const { data: options, error: optionError } = await ctx.admin.from('question_staging_options').select('*').eq('question_id', id).order('display_order');
          if (optionError) throw new Error(optionError.message);
          if (!options || options.length < 2 || options.some((option) => !String(option.working_content_latex || '').trim())) throw new Error('Complete answer options are required before promotion.');

          const { data: sourceExisting } = await ctx.admin.from('questions').select('id').eq('source_key', staged.source_key).eq('source_record_id', staged.source_record_id).limit(1).maybeSingle();
          let questionId = sourceExisting?.id as string | undefined;
          let reusedExactDuplicate = false;
          if (!questionId && staged.duplicate_hash) {
            const { data: duplicateExisting } = await ctx.admin.from('questions').select('id').eq('duplicate_hash', staged.duplicate_hash).order('updated_at', { ascending: false }).limit(1).maybeSingle();
            questionId = duplicateExisting?.id as string | undefined;
            reusedExactDuplicate = Boolean(questionId);
          }
          if (!questionId) {
            const { data: inserted, error: insertError } = await ctx.admin.from('questions').insert({
              organization_id: null,
              created_by: ctx.user.id,
              updated_by: ctx.user.id,
              subject_id: staged.subject_id,
              chapter_id: staged.chapter_id || null,
              topic_id: staged.topic_id || null,
              question_type: staged.mapped_question_type || 'single_correct',
              status: 'in_review',
              difficulty: staged.difficulty_estimate || 'moderate',
              stem_text: stem,
              stem_latex: stem,
              solution_text: solution,
              solution_latex: solution,
              marks: 4,
              negative_marks: 1,
              correct_answer: answer,
              exam_types: ['NEET'],
              class_level: '11-12',
              source: 'NEET Previous Year Question',
              source_year: staged.source_year,
              language: 'English',
              tags: ['NEET', 'PYQ', String(staged.source_year || '')].filter(Boolean),
              metadata: {
                import_source: 'neet_pyq_v17_taxonomy',
                staging_id: staged.id,
                source_exam_label: staged.source_exam_label,
                source_question_number: staged.source_question_number,
                source_flag: staged.source_flag,
                requires_taxonomy_review: !staged.chapter_id,
                source_chapter: staged.source_chapter,
                source_topic: staged.source_topic,
                mapping_confidence: staged.mapping_confidence,
                source_out_of_syllabus: staged.source_out_of_syllabus_flag,
              },
              duplicate_hash: staged.duplicate_hash,
              source_key: staged.source_key,
              source_record_id: staged.source_record_id,
              source_attribution: staged.source_exam_label,
              source_rights_status: staged.rights_status,
              review_requested_at: new Date().toISOString(),
            }).select('id').single();
            if (insertError || !inserted) throw new Error(insertError?.message || 'Unable to create question.');
            questionId = inserted.id;
            const optionRows = options.map((option) => ({
              question_id: questionId,
              option_key: option.option_key,
              content_text: String(option.working_content_latex || ''),
              content_latex: String(option.working_content_latex || ''),
              is_correct: answer.includes(String(option.option_key)),
              display_order: option.display_order,
            }));
            const { error: insertOptionsError } = await ctx.admin.from('question_options').insert(optionRows);
            if (insertOptionsError) {
              await ctx.admin.from('questions').delete().eq('id', questionId);
              throw new Error(insertOptionsError.message);
            }
          }
          const { data: sourcePaper } = await ctx.admin.from('pyq_source_papers').select('id,display_name,variant,paper_code,paper_key').eq('source_key', staged.source_key).maybeSingle();
          if (sourcePaper?.id) {
            const { error: occurrenceError } = await ctx.admin.from('question_pyq_occurrences').upsert({
              question_id: questionId,
              source_paper_id: sourcePaper.id,
              source_question_number: staged.source_question_number,
              subject_label: staged.source_subject,
              metadata: { import_source: 'neet_pyq_v18', source_exam_label: staged.source_exam_label },
              created_by: ctx.user.id,
            }, { onConflict: 'source_paper_id,source_question_number' });
            if (occurrenceError) throw new Error(occurrenceError.message);
          }
          const { error: updateError } = await ctx.admin.from('question_staging').update({ promoted_question_id: questionId, promoted_at: new Date().toISOString(), workflow_status: 'promoted', updated_by: ctx.user.id }).eq('id', id);
          if (updateError) throw new Error(updateError.message);
          results.push({ id, status: reusedExactDuplicate ? 'reused_duplicate' : 'promoted', questionId });
        } catch (error) {
          results.push({ id, status: 'failed', error: error instanceof Error ? error.message : 'Promotion failed.' });
        }
      }
      return NextResponse.json({ results, promoted: results.filter((item) => item.status === 'promoted' || item.status === 'reused_duplicate').length, reusedDuplicates: results.filter((item) => item.status === 'reused_duplicate').length, failed: results.filter((item) => item.status === 'failed').length }, { headers: { 'Cache-Control': 'no-store' } });
    }

    throw Object.assign(new Error('Unsupported PYQ import action.'), { status: 400 });
  } catch (error) { return failure(error); }
}
