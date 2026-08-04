import type { QuestionRow } from '@/types/questions';
import { createZipBlob, downloadBlob, type ZipEntryInput } from '@/lib/simpleZip';

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const cleanFile = (value: string) => value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'file';

function extension(url: string, contentType: string | null) {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  if (contentType && byType[contentType.split(';')[0].toLowerCase()]) return byType[contentType.split(';')[0].toLowerCase()];
  const candidate = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  return candidate && /^[a-z0-9]{2,5}$/.test(candidate) ? candidate : 'img';
}

function questionRecord(question: QuestionRow, index: number) {
  const options = [...(question.question_options || [])].sort((a, b) => a.display_order - b.display_order);
  const correct = Array.isArray(question.correct_answer) ? question.correct_answer.join('|') : String(question.correct_answer ?? '');
  return {
    serial: index + 1,
    id: question.id,
    subject: question.subjects?.name || '',
    chapter: question.chapters?.name || '',
    topic: question.topics?.name || '',
    grade: question.class_level || '',
    exam_types: (question.exam_types || []).join('|'),
    question_type: question.question_type,
    difficulty: question.difficulty,
    status: question.status,
    biology_division: question.metadata?.biology_division || '',
    question: question.stem_text,
    question_latex: question.stem_latex || '',
    question_image: question.question_image_url || '',
    passage: question.passage_text || '',
    option_a: options.find((option) => option.option_key === 'A')?.content_text || '',
    option_a_latex: options.find((option) => option.option_key === 'A')?.content_latex || '',
    option_a_image: options.find((option) => option.option_key === 'A')?.image_url || '',
    option_b: options.find((option) => option.option_key === 'B')?.content_text || '',
    option_b_latex: options.find((option) => option.option_key === 'B')?.content_latex || '',
    option_b_image: options.find((option) => option.option_key === 'B')?.image_url || '',
    option_c: options.find((option) => option.option_key === 'C')?.content_text || '',
    option_c_latex: options.find((option) => option.option_key === 'C')?.content_latex || '',
    option_c_image: options.find((option) => option.option_key === 'C')?.image_url || '',
    option_d: options.find((option) => option.option_key === 'D')?.content_text || '',
    option_d_latex: options.find((option) => option.option_key === 'D')?.content_latex || '',
    option_d_image: options.find((option) => option.option_key === 'D')?.image_url || '',
    correct_answer: correct,
    solution: question.solution_text || '',
    solution_latex: question.solution_latex || '',
    marks: question.marks,
    negative_marks: question.negative_marks,
    estimated_seconds: question.estimated_seconds || '',
    language: question.language,
    source: question.source || '',
    source_year: question.source_year || '',
    tags: (question.tags || []).join('|'),
    created_at: question.created_at,
    updated_at: question.updated_at,
    published_at: String(question.metadata?.published_at || ''),
  };
}

export async function exportSchoolQuestionBank({
  questions,
  schoolName,
  onProgress,
}: {
  questions: QuestionRow[];
  schoolName: string;
  onProgress?: (message: string) => void;
}) {
  if (!questions.length) throw new Error('There are no school-created questions in the current view to export.');
  if (questions.some((question) => !question.organization_id)) throw new Error('Evidara master questions cannot be exported. Select only school-created questions.');

  const records = questions.map(questionRecord);
  const headers = Object.keys(records[0]);
  const csvText = `${headers.map(csv).join(',')}\n${records.map((record) => headers.map((header) => csv(record[header as keyof typeof record])).join(',')).join('\n')}\n`;
  const entries: ZipEntryInput[] = [
    { name: 'questions.csv', data: csvText },
    { name: 'questions.json', data: JSON.stringify({ school: schoolName, exported_at: new Date().toISOString(), questions: records }, null, 2) },
  ];

  const imageItems: Array<{ questionId: string; label: string; url: string; packagePath: string; status: string }> = [];
  questions.forEach((question, questionIndex) => {
    const refs: Array<[string, string | undefined]> = [
      ['question', question.question_image_url || undefined],
      ...(question.question_options || []).map((option) => [`option-${option.option_key}`, option.image_url] as [string, string | undefined]),
    ];
    refs.filter((item): item is [string, string] => Boolean(item[1])).forEach(([label, url]) => {
      imageItems.push({ questionId: question.id, label, url, packagePath: `images/q${questionIndex + 1}-${cleanFile(label)}`, status: 'link-only' });
    });
  });

  for (let index = 0; index < imageItems.length; index += 1) {
    const item = imageItems[index];
    onProgress?.(`Packaging image ${index + 1} of ${imageItems.length}…`);
    try {
      const response = await fetch(item.url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const path = `${item.packagePath}.${extension(item.url, blob.type)}`;
      entries.push({ name: path, data: blob });
      item.packagePath = path;
      item.status = 'included';
    } catch {
      item.packagePath = '';
      item.status = 'link-preserved; browser could not package the remote file';
    }
  }

  const imageManifestHeaders = ['question_id', 'placement', 'source_url', 'packaged_path', 'status'];
  const manifest = `${imageManifestHeaders.map(csv).join(',')}\n${imageItems.map((item) => [item.questionId, item.label, item.url, item.packagePath, item.status].map(csv).join(',')).join('\n')}\n`;
  entries.push({ name: 'image-links.csv', data: manifest });
  entries.push({
    name: 'README.txt',
    data: [
      `EVIDARA SCHOOL QUESTION BANK EXPORT — ${schoolName}`,
      '',
      `Questions exported: ${questions.length}`,
      `Images referenced: ${imageItems.length}`,
      '',
      'questions.csv contains question text, options, answers, solutions, classifications and every original image URL.',
      'questions.json contains the same information in structured JSON.',
      'image-links.csv maps every original URL to its packaged file when browser permissions allowed download.',
      'Remote servers can block browser-side image downloading through CORS. In that case the original public link remains preserved in both question files and image-links.csv.',
      '',
      'Evidara master-bank questions are intentionally excluded from exports.',
    ].join('\n'),
  });

  onProgress?.('Creating export ZIP…');
  const blob = await createZipBlob(entries);
  downloadBlob(blob, `${cleanFile(schoolName.toLowerCase())}-evidara-question-bank.zip`);
}
