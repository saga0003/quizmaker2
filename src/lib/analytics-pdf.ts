import type { StudentAnalyticsPayload } from '@/types/analytics';
import type { SchoolAnalyticsPayload, StudentTestReview } from '@/types/analytics-phase3';

type PdfColor = [number, number, number];
type PdfPage = string[];

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const TEAL: PdfColor = [0.055, 0.353, 0.353];
const INK: PdfColor = [0.078, 0.137, 0.169];
const MUTED: PdfColor = [0.42, 0.475, 0.502];
const BORDER: PdfColor = [0.906, 0.925, 0.922];
const AMBER: PdfColor = [0.949, 0.722, 0.294];
const SUCCESS: PdfColor = [0.137, 0.478, 0.341];
const ERROR: PdfColor = [0.71, 0.278, 0.278];

function safeText(value: unknown) {
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

function wrap(value: unknown, maxChars: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

class PdfComposer {
  pages: PdfPage[] = [[]];
  pageIndex = 0;
  cursor = PAGE_HEIGHT - MARGIN;

  get page() { return this.pages[this.pageIndex]; }

  addPage(title?: string) {
    this.pages.push([]);
    this.pageIndex += 1;
    this.cursor = PAGE_HEIGHT - MARGIN;
    if (title) this.heading(title, 17);
  }

  ensure(height: number, title?: string) {
    if (this.cursor - height < MARGIN) this.addPage(title);
  }

  text(value: unknown, x: number, y: number, size = 10, color: PdfColor = INK, bold = false) {
    this.page.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${y} Tm (${safeText(value)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = BORDER, width = 1) {
    this.page.push(`${width} w ${rgb(color)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  rect(x: number, y: number, width: number, height: number, fill: PdfColor, stroke?: PdfColor) {
    const command = `${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG ` : ''}${x} ${y} ${width} ${height} re ${stroke ? 'B' : 'f'}`;
    this.page.push(command);
  }

  heading(value: string, size = 20) {
    this.ensure(size + 20);
    this.text(value, MARGIN, this.cursor, size, INK, true);
    this.cursor -= size + 12;
  }

  paragraph(value: unknown, maxChars = 92, size = 9, color: PdfColor = MUTED) {
    const lines = wrap(value, maxChars);
    this.ensure(lines.length * (size + 4) + 4);
    lines.forEach((line) => {
      this.text(line, MARGIN, this.cursor, size, color);
      this.cursor -= size + 4;
    });
    this.cursor -= 3;
  }

  header(title: string, subtitle: string) {
    this.rect(0, PAGE_HEIGHT - 92, PAGE_WIDTH, 92, TEAL);
    this.text('EVIDARA', MARGIN, PAGE_HEIGHT - 39, 12, [1, 1, 1], true);
    this.text(title, MARGIN, PAGE_HEIGHT - 62, 20, [1, 1, 1], true);
    this.text(subtitle, MARGIN, PAGE_HEIGHT - 79, 9, [0.9, 0.96, 0.95]);
    this.cursor = PAGE_HEIGHT - 118;
  }

  metricGrid(items: Array<{ label: string; value: string; note?: string }>) {
    const gap = 8;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
    this.ensure(88);
    items.slice(0, 4).forEach((item, index) => {
      const x = MARGIN + index * (width + gap);
      this.rect(x, this.cursor - 70, width, 70, [0.97, 0.985, 0.98], BORDER);
      this.text(item.label, x + 9, this.cursor - 18, 8, MUTED, true);
      this.text(item.value, x + 9, this.cursor - 40, 17, TEAL, true);
      if (item.note) this.text(item.note.slice(0, 26), x + 9, this.cursor - 57, 7, MUTED);
    });
    this.cursor -= 84;
  }

  table(headers: string[], rows: string[][], widths: number[], options?: { fontSize?: number; repeatTitle?: string }) {
    const size = options?.fontSize ?? 7;
    const rowHeight = 18;
    const drawHeader = () => {
      this.rect(MARGIN, this.cursor - rowHeight + 4, widths.reduce((sum, value) => sum + value, 0), rowHeight, [0.91, 0.955, 0.95]);
      let x = MARGIN;
      headers.forEach((header, index) => {
        this.text(header, x + 4, this.cursor - 8, size, INK, true);
        x += widths[index];
      });
      this.cursor -= rowHeight;
    };
    this.ensure(rowHeight * 2, options?.repeatTitle);
    drawHeader();
    rows.forEach((row) => {
      if (this.cursor - rowHeight < MARGIN) {
        this.addPage(options?.repeatTitle || 'Continued');
        drawHeader();
      }
      let x = MARGIN;
      row.forEach((cell, index) => {
        const maxChars = Math.max(4, Math.floor(widths[index] / (size * 0.52)));
        this.text(safeText(cell).slice(0, maxChars), x + 4, this.cursor - 8, size, index === 0 ? INK : MUTED, index === 0);
        x += widths[index];
      });
      this.line(MARGIN, this.cursor - rowHeight + 4, MARGIN + widths.reduce((sum, value) => sum + value, 0), this.cursor - rowHeight + 4, BORDER, 0.5);
      this.cursor -= rowHeight;
    });
    this.cursor -= 8;
  }

  bar(label: string, value: number, max = 100, color: PdfColor = TEAL) {
    this.ensure(24);
    this.text(label, MARGIN, this.cursor, 8, MUTED, true);
    const x = MARGIN + 120;
    const width = PAGE_WIDTH - MARGIN * 2 - 150;
    this.rect(x, this.cursor - 3, width, 8, [0.91, 0.925, 0.922]);
    this.rect(x, this.cursor - 3, Math.max(0, Math.min(width, width * value / max)), 8, color);
    this.text(`${value.toFixed(1)}${max === 10 ? '/10' : '%'}`, x + width + 8, this.cursor - 1, 8, INK, true);
    this.cursor -= 20;
  }
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const firstPageObject = 5;
  pages.forEach((_page, index) => {
    pageObjectIds.push(firstPageObject + index * 2);
    contentObjectIds.push(firstPageObject + index * 2 + 1);
  });

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pages.forEach((commands, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  let output = '%PDF-1.4\n% Evidara analytics report\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: 'application/pdf' });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function filenamePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'analytics';
}

export function exportStudentAnalyticsPdf(payload: StudentAnalyticsPayload, productName: string, review?: StudentTestReview | null) {
  const pdf = new PdfComposer();
  const student = payload.student;
  const summary = payload.summary;
  pdf.header('Student Analytics Report', `${student?.full_name || 'Student'} | ${productName}`);
  pdf.paragraph(`${student?.organization_name || 'Evidara'} | Grade ${student?.grade || '-'} | Section ${student?.section_name || 'Unassigned'} | Generated ${new Date().toLocaleString('en-IN')}`);
  pdf.metricGrid([
    { label: 'Average percentage', value: summary.average_percentage == null ? '-' : `${summary.average_percentage}%`, note: `${summary.completed_tests} tests` },
    { label: 'Average percentile', value: summary.percentile_available && summary.average_percentile != null ? String(summary.average_percentile) : 'Locked', note: summary.percentile_available ? `${summary.cohort_size || 0} compared` : 'Complete series' },
    { label: 'Overall accuracy', value: summary.accuracy == null ? '-' : `${summary.accuracy}%`, note: `${summary.correct} right` },
    { label: 'Time management', value: summary.time_score == null ? '-' : `${summary.time_score}/10`, note: `${summary.unanswered} unanswered` },
  ]);

  pdf.heading('Answer distribution', 14);
  const total = Math.max(1, summary.correct + summary.incorrect + summary.unanswered);
  pdf.bar('Correct answers', summary.correct / total * 100, 100, SUCCESS);
  pdf.bar('Wrong answers', summary.incorrect / total * 100, 100, ERROR);
  pdf.bar('Unanswered', summary.unanswered / total * 100, 100, AMBER);

  pdf.heading('Subject performance', 14);
  payload.subjects.forEach((subject) => pdf.bar(subject.subject_name, subject.student_percentage || 0));
  pdf.table(
    ['Subject', 'Marks', 'Percentage', 'Accuracy', 'Time', 'Average', 'Top 10%', 'Top 5%', 'Highest'],
    payload.subjects.map((subject) => [
      subject.subject_name,
      `${Number(subject.student_marks || 0).toFixed(1)}/${Number(subject.maximum_marks || 0).toFixed(1)}`,
      `${Number(subject.student_percentage || 0).toFixed(1)}%`,
      subject.student_accuracy == null ? '-' : `${subject.student_accuracy.toFixed(1)}%`,
      subject.student_time_score == null ? '-' : `${subject.student_time_score.toFixed(1)}/10`,
      subject.average_percentage == null ? '-' : `${subject.average_percentage.toFixed(1)}%`,
      subject.top10_threshold == null ? '-' : `${subject.top10_threshold.toFixed(1)}%`,
      subject.top5_threshold == null ? '-' : `${subject.top5_threshold.toFixed(1)}%`,
      subject.highest_percentage == null ? '-' : `${subject.highest_percentage.toFixed(1)}%`,
    ]),
    [72, 58, 54, 50, 44, 52, 52, 48, 48],
    { fontSize: 6.5, repeatTitle: 'Subject performance continued' },
  );

  pdf.heading('Test results and benchmarks', 14);
  pdf.table(
    ['Test', 'Date', 'Score', '%', 'Percentile', 'Average', 'Top 10%', 'Top 5%', 'Highest'],
    payload.trends.map((test) => [
      test.paper_title,
      new Date(test.submitted_at).toLocaleDateString('en-IN'),
      `${Number(test.score || 0).toFixed(1)}/${Number(test.maximum_marks || 0).toFixed(1)}`,
      `${Number(test.percentage || 0).toFixed(1)}%`,
      test.student_percentile == null ? '-' : test.student_percentile.toFixed(1),
      test.percentage_average == null ? '-' : `${test.percentage_average.toFixed(1)}%`,
      test.percentage_top10 == null ? '-' : `${test.percentage_top10.toFixed(1)}%`,
      test.percentage_top5 == null ? '-' : `${test.percentage_top5.toFixed(1)}%`,
      test.percentage_highest == null ? '-' : `${test.percentage_highest.toFixed(1)}%`,
    ]),
    [112, 55, 62, 38, 50, 50, 50, 46, 46],
    { fontSize: 6.5, repeatTitle: 'Test results continued' },
  );

  if (review) {
    pdf.addPage('Selected test answer review');
    pdf.paragraph(`${review.paper_title} | ${review.product_name || 'Assessment'} | ${review.test_takers} students wrote this test | Position ${review.rank_position || '-'} | Percentile ${review.student_percentile ?? '-'}`);
    pdf.metricGrid([
      { label: 'Student percentage', value: review.student.percentage == null ? '-' : `${review.student.percentage}%` },
      { label: 'Average', value: review.percentage.average == null ? '-' : `${review.percentage.average}%` },
      { label: 'Top 5%', value: review.percentage.top5 == null ? '-' : `${review.percentage.top5}%` },
      { label: 'Highest', value: review.percentage.highest == null ? '-' : `${review.percentage.highest}%` },
    ]);
    pdf.table(
      ['Q', 'Subject', 'Status', 'Selected answer', 'Correct answer', 'Marks', 'Time'],
      review.questions.map((question) => [
        String(question.question_number),
        question.subject_name,
        question.status,
        question.selected_answer,
        question.correct_answer,
        `${Number(question.marks_awarded || 0).toFixed(2)}/${Number(question.maximum_marks || 0).toFixed(2)}`,
        `${question.time_spent_seconds || 0}s`,
      ]),
      [28, 70, 52, 130, 130, 58, 42],
      { fontSize: 6.2, repeatTitle: 'Question review continued' },
    );
  }

  download(buildPdf(pdf.pages), `${filenamePart(student?.full_name || 'student')}-${filenamePart(productName)}-analytics.pdf`);
}

export function exportSchoolAnalyticsPdf(payload: SchoolAnalyticsPayload) {
  const pdf = new PdfComposer();
  const summary = payload.summary;
  pdf.header('School Analytics Report', `${payload.organization?.name || 'School'} | Evidara Phase 3`);
  pdf.paragraph(`Generated ${new Date().toLocaleString('en-IN')} | Academic year ${payload.filters.academic_year || 'All'} | Grade ${payload.filters.grade || 'All'} | Selected students ${summary.total_students}`);
  pdf.metricGrid([
    { label: 'Students', value: String(summary.total_students), note: `${summary.active_students} active` },
    { label: 'Average percentage', value: summary.average_percentage == null ? '-' : `${summary.average_percentage}%` },
    { label: 'Overall accuracy', value: summary.accuracy == null ? '-' : `${summary.accuracy}%` },
    { label: 'Participation', value: summary.participation == null ? '-' : `${summary.participation}%` },
  ]);
  pdf.heading('Grade comparison', 14);
  payload.grades.forEach((row) => pdf.bar(`Grade ${row.grade}`, row.average_percentage || 0));
  pdf.heading('Section comparison', 14);
  payload.sections.forEach((row) => pdf.bar(`Grade ${row.grade} - ${row.section_name}`, row.average_percentage || 0));
  pdf.heading('Subject summary', 14);
  pdf.table(
    ['Subject', 'Students', 'Percentage', 'Accuracy', 'Time', 'Right', 'Wrong', 'Unanswered'],
    payload.subjects.map((row) => [row.subject_name,String(row.students),`${row.average_percentage ?? 0}%`,`${row.accuracy ?? 0}%`,row.time_score == null ? '-' : `${row.time_score}/10`,String(row.correct_count),String(row.incorrect_count),String(row.unanswered_count)]),
    [92, 52, 64, 60, 48, 52, 52, 70],
    { fontSize: 7, repeatTitle: 'Subject summary continued' },
  );
  pdf.heading('Student surface report', 14);
  pdf.table(
    ['Student', 'Grade', 'Section', 'Tests', 'Marks', '%', 'Accuracy', 'Status'],
    payload.students.map((row) => [row.full_name,String(row.grade),row.section_name,String(row.completed_tests),`${Number(row.total_marks || 0).toFixed(1)}/${Number(row.maximum_marks || 0).toFixed(1)}`,row.percentage == null ? '-' : `${row.percentage}%`,row.accuracy == null ? '-' : `${row.accuracy}%`,row.status.replace('_',' ')]),
    [120, 38, 74, 40, 72, 44, 56, 72],
    { fontSize: 6.5, repeatTitle: 'Student surface report continued' },
  );
  download(buildPdf(pdf.pages), `${filenamePart(payload.organization?.name || 'school')}-analytics-report.pdf`);
}
