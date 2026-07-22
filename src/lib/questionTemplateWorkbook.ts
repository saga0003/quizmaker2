import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from '@/types/questions';
import { bulkQuestionTemplateHeaders } from '@/lib/questionImport';
import { createZipBlob, downloadBlob } from '@/lib/simpleZip';

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

function columnName(index: number) {
  let value = index + 1;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function textCell(reference: string, value: unknown, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number, style = 0) {
  return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
}

function rowXml(row: number, values: unknown[], style = 0) {
  const cells = values.map((value, index) => typeof value === 'number'
    ? numberCell(`${columnName(index)}${row}`, value, style)
    : textCell(`${columnName(index)}${row}`, value, style));
  return `<row r="${row}">${cells.join('')}</row>`;
}

const fixedLists = {
  difficulty: ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'],
  question_type: ['single_correct', 'multiple_correct', 'numerical', 'integer', 'assertion_reason', 'passage', 'image_based'],
  language: ['English', 'Kannada', 'Hindi', 'Bilingual'],
  status: ['draft', 'in_review', 'approved'],
  correct_answer: ['A', 'B', 'C', 'D', 'A|B', 'A|C', 'B|C', 'A|B|C'],
};

const sample: Record<string, string | number> = {
  exam_types: 'NEET',
  class_level: 'Class 11',
  subject: 'Physics',
  chapter: 'Units and Measurements',
  topic: 'Dimensions',
  question_type: 'single_correct',
  difficulty: 'moderate',
  question: 'Which quantity is dimensionless?',
  question_latex: '',
  question_image: '',
  option_a: 'Velocity',
  option_a_latex: '',
  option_a_image: '',
  option_b: 'Strain',
  option_b_latex: '',
  option_b_image: '',
  option_c: 'Force',
  option_c_latex: '',
  option_c_image: '',
  option_d: 'Energy',
  option_d_latex: '',
  option_d_image: '',
  correct_answer: 'B',
  solution: 'Strain is a ratio and therefore dimensionless.',
  solution_latex: '',
  marks: 4,
  negative_marks: 1,
  estimated_seconds: 60,
  language: 'English',
  source: 'NCERT',
  source_year: 2026,
  tags: 'units,dimensions',
  status: 'draft',
};

const guideRows: Array<[string, string, string, string]> = [
  ['subject', 'Required', 'Choose an existing subject from the dropdown.', 'Only Super Admin adds universal subjects.'],
  ['chapter', 'Recommended', 'Choose the chapter belonging to the selected subject.', 'A missing chapter can be added inside Evidara before import.'],
  ['topic', 'Optional', 'Choose the topic belonging to the selected chapter.', 'Recommended for analytics and dynamic topic-wise serial numbers.'],
  ['question_type', 'Required', 'Use a dropdown value exactly as provided.', 'Match the Following remains available in the manual editor, not this simple template.'],
  ['difficulty', 'Required', 'Use very_easy, easy, moderate, difficult or very_difficult.', 'Dropdown validation prevents spelling errors.'],
  ['question', 'Required', 'Plain learner-facing question text.', 'Keep answers and internal notes out of this field.'],
  ['question_latex', 'Optional', 'Paste only the mathematical or scientific LaTeX code.', 'The import review shows a live rendered preview.'],
  ['question_image', 'Optional', 'Public HTTPS URL or exact filename included in the image ZIP.', 'Example: physics-q1.png'],
  ['option_a to option_d', 'Required for MCQ', 'Enter option text; use the adjacent LaTeX/image columns when needed.', 'At least two options are required.'],
  ['correct_answer', 'Required', 'A, B, C or D. Multiple-correct values use A|B.', 'Numerical/integer questions use the exact numeric answer.'],
  ['status', 'Required', 'Draft, in_review or approved.', 'Teacher imports are always limited to draft/review by backend permissions.'],
  ['exam_types', 'Recommended', 'Use NEET or multiple values separated by |.', 'Example: JEE Main|KCET'],
  ['tags', 'Optional', 'Comma- or pipe-separated search keywords.', 'These improve search and automatic paper selection.'],
  ['test classification', 'Not part of questions', 'Choose full length, part, chapter, topic or custom while creating the test series or paper.', 'A question can be reused across multiple test types.'],
];

function listRange(columnIndex: number, count: number) {
  const column = columnName(columnIndex);
  return `'Lists'!$${column}$2:$${column}$${Math.max(2, count + 1)}`;
}

function validation(type: 'list' | 'decimal' | 'whole', column: string, formula: string, prompt: string) {
  return `<dataValidation type="${type}" allowBlank="1" showErrorMessage="1" showInputMessage="1" errorStyle="stop" errorTitle="Invalid value" error="Choose or enter a supported value." promptTitle="Evidara template" prompt="${escapeXml(prompt)}" sqref="${column}2:${column}500"><formula1>${escapeXml(formula)}</formula1></dataValidation>`;
}

export async function buildQuestionTemplateWorkbook({
  subjects,
  chapters,
  topics,
}: {
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
}) {
  const orderedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.name);
  const orderedChapters = [...chapters].sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.name);
  const orderedTopics = [...topics].sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.name);
  const listColumns: string[][] = [
    orderedSubjects,
    orderedChapters,
    orderedTopics,
    fixedLists.difficulty,
    fixedLists.question_type,
    fixedLists.language,
    fixedLists.status,
    fixedLists.correct_answer,
  ];
  const maxListRows = Math.max(1, ...listColumns.map((column) => column.length));
  const listHeaders = ['Subjects', 'Chapters', 'Topics', 'Difficulty', 'Question Types', 'Languages', 'Statuses', 'Common Answers'];
  const listRows = Array.from({ length: maxListRows }, (_unused, index) => listColumns.map((column) => column[index] || ''));

  const headerRow = rowXml(1, bulkQuestionTemplateHeaders, 1);
  const sampleRow = rowXml(2, bulkQuestionTemplateHeaders.map((header) => sample[header] ?? ''), 0);
  const lastColumn = columnName(bulkQuestionTemplateHeaders.length - 1);
  const widths = bulkQuestionTemplateHeaders.map((header, index) => {
    const wide = ['question', 'solution'].includes(header) ? 42 : header.includes('image') || header.includes('latex') ? 28 : index < 10 ? 20 : 16;
    return `<col min="${index + 1}" max="${index + 1}" width="${wide}" customWidth="1"/>`;
  }).join('');

  const byHeader = new Map(bulkQuestionTemplateHeaders.map((header, index) => [header, columnName(index)]));
  const validations = [
    validation('list', byHeader.get('subject')!, listRange(0, orderedSubjects.length), 'Search or choose an existing subject.'),
    validation('list', byHeader.get('chapter')!, listRange(1, orderedChapters.length), 'Choose a chapter already available in Evidara.'),
    validation('list', byHeader.get('topic')!, listRange(2, orderedTopics.length), 'Choose an optional existing topic.'),
    validation('list', byHeader.get('difficulty')!, listRange(3, fixedLists.difficulty.length), 'Choose the exact supported difficulty.'),
    validation('list', byHeader.get('question_type')!, listRange(4, fixedLists.question_type.length), 'Choose a supported simple question type.'),
    validation('list', byHeader.get('language')!, listRange(5, fixedLists.language.length), 'Choose the learner-facing language.'),
    validation('list', byHeader.get('status')!, listRange(6, fixedLists.status.length), 'Choose draft, in_review or approved.'),
    validation('list', byHeader.get('correct_answer')!, listRange(7, fixedLists.correct_answer.length), 'Choose a common MCQ answer or type the exact numerical answer.'),
    validation('decimal', byHeader.get('marks')!, '0', 'Enter zero or a positive mark.'),
    validation('decimal', byHeader.get('negative_marks')!, '0', 'Enter zero or a positive deduction.'),
    validation('whole', byHeader.get('estimated_seconds')!, '1', 'Enter expected solving time in seconds.'),
  ].join('');

  const questionSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${widths}</cols>
  <sheetData>${headerRow}${sampleRow}</sheetData>
  <autoFilter ref="A1:${lastColumn}500"/>
  <dataValidations count="11">${validations}</dataValidations>
</worksheet>`;

  const guideSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="54" customWidth="1"/><col min="4" max="4" width="54" customWidth="1"/></cols>
  <sheetData>${rowXml(1, ['Column', 'Requirement', 'How to fill it', 'Important note'], 1)}${guideRows.map((row, index) => rowXml(index + 2, row)).join('')}</sheetData>
</worksheet>`;

  const listsSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml(1, listHeaders, 1)}${listRows.map((row, index) => rowXml(index + 2, row)).join('')}</sheetData>
</worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Questions" sheetId="1" r:id="rId1"/><sheet name="Guide" sheetId="2" r:id="rId2"/><sheet name="Lists" sheetId="3" state="hidden" r:id="rId3"/></sheets>
</workbook>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E5A5A"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`;

  return createZipBlob([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: questionSheet },
    { name: 'xl/worksheets/sheet2.xml', data: guideSheet },
    { name: 'xl/worksheets/sheet3.xml', data: listsSheet },
  ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function downloadQuestionTemplateWorkbook(input: {
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
}) {
  downloadBlob(await buildQuestionTemplateWorkbook(input), 'evidara-question-import-template.xlsx');
}

export async function downloadQuestionImageZipTemplate() {
  const guide = [
    'EVIDARA QUESTION IMAGE ZIP TEMPLATE',
    '',
    '1. Put every question and option image inside this ZIP.',
    '2. Use simple unique names such as physics-q001.png, physics-q001-a.png and physics-q001-b.png.',
    '3. Enter the exact filename in the Excel question_image or option image column.',
    '4. Evidara will upload the files and replace filenames with public URLs during import.',
    '5. Supported browser upload image types depend on the Evidara image normalizer.',
  ].join('\n');
  downloadBlob(await createZipBlob([
    { name: 'README.txt', data: guide },
    { name: 'images/PLACE_IMAGES_HERE.txt', data: 'Replace this file with the images referenced by your Excel or CSV template.' },
  ]), 'evidara-question-images-template.zip');
}

export function downloadQuestionImportGuide() {
  const guide = guideRows.map(([column, requirement, how, note]) => `${column}\nRequirement: ${requirement}\nHow: ${how}\nNote: ${note}\n`).join('\n');
  downloadBlob(new Blob([`EVIDARA BULK QUESTION IMPORT GUIDE\n\n${guide}`], { type: 'text/plain;charset=utf-8' }), 'evidara-question-import-guide.txt');
}
