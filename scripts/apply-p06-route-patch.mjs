import fs from 'node:fs';

const path = 'src/app/api/institution-analytics/route.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceExactly(label, before, after) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one source fragment, found ${matches}`);
  }
  source = source.replace(before, after);
}

replaceExactly(
  'response evidence must fetch frozen taxonomy snapshot',
  ".select('attempt_id,is_correct,marks_awarded,time_spent_seconds,paper_questions(marks,questions(id,subject_id,chapter_id,topic_id,subjects(id,name),chapters(id,name),topics(id,name)))')",
  ".select('attempt_id,is_correct,marks_awarded,time_spent_seconds,paper_questions(marks,question_snapshot,questions(id,subject_id,chapter_id,topic_id,subjects(id,name),chapters(id,name),topics(id,name)))')",
);

replaceExactly(
  'taxonomyObject must prefer paper snapshot',
  `function taxonomyObject(response: Record<string, unknown>) {\n  const paperQuestionRaw = response.paper_questions;\n  const paperQuestion = Array.isArray(paperQuestionRaw) ? paperQuestionRaw[0] : paperQuestionRaw as Record<string, unknown> | null;\n  const questionRaw = paperQuestion?.questions;\n  const question = Array.isArray(questionRaw) ? questionRaw[0] : questionRaw as Record<string, unknown> | null;\n  const object = (value: unknown) => Array.isArray(value) ? value[0] as Record<string, unknown> : value as Record<string, unknown> | null;\n  return {\n    paperQuestion,\n    question,\n    subject: object(question?.subjects),\n    chapter: object(question?.chapters),\n    topic: object(question?.topics),\n  };\n}`,
  `function taxonomyObject(response: Record<string, unknown>) {\n  const paperQuestionRaw = response.paper_questions;\n  const paperQuestion = Array.isArray(paperQuestionRaw) ? paperQuestionRaw[0] : paperQuestionRaw as Record<string, unknown> | null;\n  const questionRaw = paperQuestion?.questions;\n  const question = Array.isArray(questionRaw) ? questionRaw[0] : questionRaw as Record<string, unknown> | null;\n  const snapshotRaw = paperQuestion?.question_snapshot;\n  const snapshot = snapshotRaw && typeof snapshotRaw === 'object' && !Array.isArray(snapshotRaw)\n    ? snapshotRaw as Record<string, unknown>\n    : null;\n  const object = (value: unknown) => Array.isArray(value) ? value[0] as Record<string, unknown> : value as Record<string, unknown> | null;\n  const frozenTaxonomy = (idKey: string, nameKey: string, fallback: Record<string, unknown> | null) => {\n    const id = snapshot?.[idKey];\n    const name = snapshot?.[nameKey];\n    if (typeof id === 'string' && id && typeof name === 'string' && name) return { id, name };\n    if (typeof id === 'string' && id) return { id, name: typeof name === 'string' && name ? name : String(fallback?.name || id) };\n    return fallback;\n  };\n  return {\n    paperQuestion,\n    question,\n    subject: frozenTaxonomy('subject_id', 'subject_name', object(question?.subjects)),\n    chapter: frozenTaxonomy('chapter_id', 'chapter_name', object(question?.chapters)),\n    topic: frozenTaxonomy('topic_id', 'topic_name', object(question?.topics)),\n  };\n}`,
);

fs.writeFileSync(path, source);
console.log('P0.6 institution analytics route patched to prefer frozen paper taxonomy snapshots.');
