import type { InstitutionClassRow, InstitutionStudentRow, InstitutionSubjectRow } from '@/types/institution-analytics';

type PdfColor = [number, number, number];
type ReportClassBatch = {
  classRow: InstitutionClassRow;
  students: InstitutionStudentRow[];
  subjects: InstitutionSubjectRow[];
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const TEAL: PdfColor = [0.055, 0.353, 0.353];
const INK: PdfColor = [0.078, 0.137, 0.169];
const MUTED: PdfColor = [0.42, 0.475, 0.502];
const BORDER: PdfColor = [0.86, 0.91, 0.90];

function safe(value: unknown) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function rgb(color: PdfColor) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

class PdfPage {
  commands: string[] = [];

  text(value: unknown, x: number, y: number, size = 10, color: PdfColor = INK, bold = false) {
    this.commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${y} Tm (${safe(value)}) Tj ET`);
  }

  rect(x: number, y: number, width: number, height: number, fill: PdfColor, stroke?: PdfColor) {
    this.commands.push(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG ` : ''}${x} ${y} ${width} ${height} re ${stroke ? 'B' : 'f'}`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = BORDER) {
    this.commands.push(`0.7 w ${rgb(color)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  const contentIds = pages.map((_, index) => 6 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pages.forEach((page, index) => {
    const stream = page.commands.join('\n');
    objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objects[contentIds[index]] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  let output = '%PDF-1.4\n% Evidara institutional report cards\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: 'application/pdf' });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'class';
}

function metricValue(metric: number | null | undefined, suffix = '%') {
  return metric == null ? '-' : `${Math.round(metric * 10) / 10}${suffix}`;
}

function createReportPages(schoolName: string, batches: ReportClassBatch[]) {
  return batches.flatMap(({ classRow, students, subjects }) => students.map((student) => {
    const page = new PdfPage();
    page.rect(0, PAGE_HEIGHT - 96, PAGE_WIDTH, 96, TEAL);
    page.text('EVIDARA', MARGIN, PAGE_HEIGHT - 35, 12, [1, 1, 1], true);
    page.text('Student Performance Report Card', MARGIN, PAGE_HEIGHT - 60, 20, [1, 1, 1], true);
    page.text(`${schoolName} | ${classRow.name} | ${classRow.academicYear}`, MARGIN, PAGE_HEIGHT - 79, 9, [0.9, 0.96, 0.95]);

    let y = PAGE_HEIGHT - 128;
    page.text(student.name, MARGIN, y, 19, INK, true);
    page.text(`Rank ${student.rank} | ${student.completedTests} completed tests | Last test ${student.lastTestAt ? new Date(student.lastTestAt).toLocaleDateString('en-IN') : '-'}`, MARGIN, y - 19, 9, MUTED);
    y -= 52;

    const cards = [
      ['Average', metricValue(student.averagePercentage)],
      ['Accuracy', metricValue(student.accuracy)],
      ['Highest', metricValue(student.highestPercentage)],
      ['Lowest', metricValue(student.lowestPercentage)],
    ];
    const gap = 8;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
    cards.forEach(([label, cardValue], index) => {
      const x = MARGIN + index * (width + gap);
      page.rect(x, y - 70, width, 70, [0.97, 0.985, 0.98], BORDER);
      page.text(label, x + 10, y - 20, 8, MUTED, true);
      page.text(cardValue, x + 10, y - 47, 17, TEAL, true);
    });
    y -= 100;

    page.text('Class subject comparison', MARGIN, y, 14, INK, true);
    y -= 22;
    page.rect(MARGIN, y - 22, PAGE_WIDTH - MARGIN * 2, 22, [0.91, 0.955, 0.95]);
    page.text('Subject', MARGIN + 8, y - 15, 8, INK, true);
    page.text('Class average', MARGIN + 250, y - 15, 8, INK, true);
    page.text('Highest', MARGIN + 350, y - 15, 8, INK, true);
    page.text('Lowest', MARGIN + 430, y - 15, 8, INK, true);
    y -= 22;

    subjects.slice(0, 12).forEach((subject) => {
      page.text(subject.name, MARGIN + 8, y - 14, 8, INK, true);
      page.text(metricValue(subject.averagePercentage), MARGIN + 250, y - 14, 8, MUTED);
      page.text(metricValue(subject.highestPercentage), MARGIN + 350, y - 14, 8, MUTED);
      page.text(metricValue(subject.lowestPercentage), MARGIN + 430, y - 14, 8, MUTED);
      page.line(MARGIN, y - 22, PAGE_WIDTH - MARGIN, y - 22);
      y -= 24;
    });

    y -= 18;
    page.rect(MARGIN, y - 94, PAGE_WIDTH - MARGIN * 2, 94, [1, 0.985, 0.93], [0.95, 0.75, 0.29]);
    page.text('Interpretation note', MARGIN + 12, y - 20, 10, [0.42, 0.29, 0], true);
    page.text('This report uses submitted Evidara assessments available for the selected class and filters.', MARGIN + 12, y - 41, 8, MUTED);
    page.text('Subject values are class benchmarks. Open the student analytics page for individual topic evidence.', MARGIN + 12, y - 56, 8, MUTED);
    page.text(`Generated ${new Date().toLocaleString('en-IN')}`, MARGIN + 12, y - 76, 8, MUTED);
    page.text('Evidara | Evidence-led academic intelligence', MARGIN, 34, 8, TEAL, true);
    return page;
  }));
}

function csvRows(schoolName: string, batches: ReportClassBatch[]) {
  return [
    ['School', 'Class', 'Academic year', 'Rank', 'Student', 'Tests', 'Average %', 'Accuracy %', 'Highest %', 'Lowest %', 'Last test'],
    ...batches.flatMap(({ classRow, students }) => students.map((student) => [
      schoolName,
      classRow.name,
      classRow.academicYear,
      student.rank,
      student.name,
      student.completedTests,
      student.averagePercentage ?? '',
      student.accuracy ?? '',
      student.highestPercentage ?? '',
      student.lowestPercentage ?? '',
      student.lastTestAt ? new Date(student.lastTestAt).toLocaleDateString('en-IN') : '',
    ])),
  ];
}

function downloadCsv(rows: Array<Array<string | number>>, name: string) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), name);
}

export function exportInstitutionReportCards(input: {
  schoolName: string;
  classRow: InstitutionClassRow;
  students: InstitutionStudentRow[];
  subjects: InstitutionSubjectRow[];
}) {
  const pages = createReportPages(input.schoolName, [{ classRow: input.classRow, students: input.students, subjects: input.subjects }]);
  if (!pages.length) return;
  download(buildPdf(pages), `${filePart(input.schoolName)}-${filePart(input.classRow.name)}-report-cards.pdf`);
}

export function exportInstitutionSchoolReportCards(input: {
  schoolName: string;
  classes: ReportClassBatch[];
}) {
  const pages = createReportPages(input.schoolName, input.classes);
  if (!pages.length) return;
  download(buildPdf(pages), `${filePart(input.schoolName)}-filtered-report-cards.pdf`);
}

export function exportInstitutionResultsCsv(input: {
  schoolName: string;
  classRow: InstitutionClassRow;
  students: InstitutionStudentRow[];
}) {
  downloadCsv(
    csvRows(input.schoolName, [{ classRow: input.classRow, students: input.students, subjects: [] }]),
    `${filePart(input.schoolName)}-${filePart(input.classRow.name)}-results.csv`,
  );
}

export function exportInstitutionSchoolResultsCsv(input: {
  schoolName: string;
  classes: ReportClassBatch[];
}) {
  downloadCsv(csvRows(input.schoolName, input.classes), `${filePart(input.schoolName)}-filtered-results.csv`);
}
