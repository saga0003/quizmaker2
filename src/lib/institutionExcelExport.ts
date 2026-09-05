import type { AnalyticsTaxonomyRow, AnalyticsV12Payload } from '@/types/analytics-v12';
import type { InstitutionClassRow, InstitutionStudentRow } from '@/types/institution-analytics';

type WorkbookInput = {
  schoolName: string;
  classRow: InstitutionClassRow;
  students: InstitutionStudentRow[];
  analytics: AnalyticsV12Payload[];
};

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'evidara';
}

function styleSheet(sheet: import('exceljs').Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (sheet.columnCount > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  for (const column of sheet.columns) {
    let width = Math.max(12, String(column.header || '').length + 2);
    column.eachCell?.({ includeEmpty: false }, (cell) => { width = Math.min(42, Math.max(width, String(cell.value ?? '').length + 2)); });
    column.width = width;
  }
}

function taxonomyRows(payload: AnalyticsV12Payload, rows: AnalyticsTaxonomyRow[], level: 'Subject' | 'Chapter' | 'Topic') {
  return rows.map((row) => ({
    Student: payload.student.full_name,
    'Student ID': payload.student.id,
    Grade: payload.student.grade,
    Section: payload.student.section_name,
    Level: level,
    Name: row.name,
    Parent: row.parent_name || '',
    Exposure: row.questions,
    Attempted: row.correct + row.incorrect,
    Correct: row.correct,
    Incorrect: row.incorrect,
    Unanswered: row.unanswered,
    'Accuracy %': row.correct + row.incorrect > 0 ? row.accuracy : null,
    'Score %': row.questions > 0 ? row.average_percentage ?? null : null,
    'Avg Time (sec)': row.average_seconds,
    'Trend Δ': row.trend_delta,
    'Evidence Count': row.attempts,
  }));
}

function addObjectSheet(workbook: import('exceljs').Workbook, name: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const sheet = workbook.addWorksheet(name);
  const headers = rows.length ? Object.keys(rows[0]) : ['No evidence'];
  sheet.columns = headers.map((header) => ({ header, key: header }));
  if (rows.length) sheet.addRows(rows);
  styleSheet(sheet);
  return sheet;
}

export async function exportInstitutionAnalyticsWorkbook(input: WorkbookInput) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Evidara';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  addObjectSheet(workbook, 'Results', input.students.map((row) => ({
    Rank: row.rank,
    Student: row.name,
    'Student ID': row.id,
    Grade: row.grade,
    Section: row.sectionName,
    'Academic Year': row.academicYear,
    'Tests Taken': row.completedTests,
    'Average %': row.averagePercentage,
    'Accuracy %': row.accuracy,
    'Highest %': row.highestPercentage,
    'Lowest %': row.lowestPercentage,
    'Last Test': row.lastTestAt,
  })));

  addObjectSheet(workbook, 'Test Results', input.analytics.flatMap((payload) => payload.history.map((row) => ({
    Student: payload.student.full_name,
    'Student ID': payload.student.id,
    Test: row.paper_title,
    'Test ID': row.paper_id,
    Submitted: row.submitted_at,
    Score: row.score,
    'Maximum Marks': row.maximum_marks,
    'Percentage %': row.percentage,
    'Accuracy %': row.accuracy,
    'Duration (min)': row.duration_minutes,
    Correct: row.correct,
    Incorrect: row.incorrect,
    Unanswered: row.unanswered,
    'Result Mode': row.result_mode,
  }))));

  addObjectSheet(workbook, 'Subject Analytics', input.analytics.flatMap((payload) => taxonomyRows(payload, payload.subjects, 'Subject')));
  addObjectSheet(workbook, 'Chapter Analytics', input.analytics.flatMap((payload) => taxonomyRows(payload, payload.chapters, 'Chapter')));
  addObjectSheet(workbook, 'Topic Analytics', input.analytics.flatMap((payload) => taxonomyRows(payload, payload.topics, 'Topic')));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilePart(input.schoolName)}-${safeFilePart(input.classRow.name)}-analytics.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
