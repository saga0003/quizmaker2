#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { once } from 'node:events';

const STUDENT_COUNT = 2_000;
const QUESTION_COUNT = 50_000;
const PAPER_COUNT = 1_000;
const DEFAULT_SEED = 19_102_026;

const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const chapters = Array.from({ length: 12 }, (_, i) => `Chapter ${String(i + 1).padStart(2, '0')}`);
const topics = Array.from({ length: 8 }, (_, i) => `Topic ${String(i + 1).padStart(2, '0')}`);
const difficulties = ['easy', 'medium', 'hard'];
const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function parseArgs(argv) {
  const args = { out: 'tmp/phase1-load-fixtures', seed: DEFAULT_SEED };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--seed') args.seed = Number(argv[++i]);
    else if (argv[i] === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!Number.isSafeInteger(args.seed) || args.seed <= 0) {
    throw new Error('--seed must be a positive safe integer');
  }
  return args;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(path, header, rowCount, makeRow) {
  const out = createWriteStream(path, { encoding: 'utf8' });
  const digest = createHash('sha256');
  const emit = async (line) => {
    digest.update(line);
    if (!out.write(line)) await once(out, 'drain');
  };

  await emit(`${header.map(csv).join(',')}\n`);
  for (let i = 0; i < rowCount; i += 1) {
    const row = makeRow(i);
    if (row.length !== header.length) throw new Error(`Row ${i} has ${row.length} cells; expected ${header.length}`);
    await emit(`${row.map(csv).join(',')}\n`);
  }
  out.end();
  await once(out, 'finish');
  return { rows: rowCount, sha256: digest.digest('hex'), bytes: statSync(path).size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/phase1-generate-load-fixtures.mjs [--out PATH] [--seed INTEGER]');
    console.log('Generates synthetic, non-PII L1-L3 scale fixtures only. It never connects to Evidara or Supabase.');
    return;
  }

  const outDir = resolve(process.cwd(), args.out);
  mkdirSync(outDir, { recursive: true });
  const random = seededRandom(args.seed);

  const studentsPath = join(outDir, 'students-2000.csv');
  const questionsPath = join(outDir, 'questions-50000.csv');
  const papersPath = join(outDir, 'papers-1000.csv');

  const students = await writeCsv(
    studentsPath,
    ['external_id', 'display_name', 'grade', 'section', 'programme', 'academic_year', 'synthetic'],
    STUDENT_COUNT,
    (i) => {
      const n = i + 1;
      const grade = n % 2 === 0 ? '11' : '12';
      const section = sections[i % sections.length];
      const programme = n % 3 === 0 ? 'JEE' : n % 3 === 1 ? 'NEET' : 'Board';
      return [
        `LOAD-STUDENT-${String(n).padStart(4, '0')}`,
        `Synthetic Student ${String(n).padStart(4, '0')}`,
        grade,
        section,
        programme,
        '2026-27',
        'true',
      ];
    },
  );

  const questions = await writeCsv(
    questionsPath,
    [
      'external_id', 'subject', 'chapter', 'topic', 'difficulty', 'question_type', 'content',
      'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'marks', 'negative_marks', 'synthetic',
    ],
    QUESTION_COUNT,
    (i) => {
      const n = i + 1;
      const subject = subjects[i % subjects.length];
      const chapter = chapters[Math.floor(i / subjects.length) % chapters.length];
      const topic = topics[Math.floor(i / (subjects.length * chapters.length)) % topics.length];
      const difficulty = difficulties[Math.floor(random() * difficulties.length)];
      const answerIndex = Math.floor(random() * 4);
      const answer = ['A', 'B', 'C', 'D'][answerIndex];
      return [
        `LOAD-Q-${String(n).padStart(5, '0')}`,
        subject,
        chapter,
        topic,
        difficulty,
        'single_choice',
        `[LOAD-FIXTURE ${String(n).padStart(5, '0')}] ${subject} synthetic scale question`,
        `Option A ${n}`,
        `Option B ${n}`,
        `Option C ${n}`,
        `Option D ${n}`,
        answer,
        '4',
        '1',
        'true',
      ];
    },
  );

  const papers = await writeCsv(
    papersPath,
    ['external_id', 'title', 'subject', 'grade', 'section', 'question_window_start', 'question_count', 'status', 'synthetic'],
    PAPER_COUNT,
    (i) => {
      const n = i + 1;
      const subject = subjects[i % subjects.length];
      const questionCount = 50;
      const start = (i * questionCount) % QUESTION_COUNT;
      return [
        `LOAD-PAPER-${String(n).padStart(4, '0')}`,
        `[LOAD] ${subject} Scale Paper ${String(n).padStart(4, '0')}`,
        subject,
        n % 2 === 0 ? '11' : '12',
        sections[i % sections.length],
        start + 1,
        questionCount,
        i % 5 === 0 ? 'published' : 'draft',
        'true',
      ];
    },
  );

  const manifest = {
    schemaVersion: 1,
    purpose: 'Evidara Phase 1 non-production load acceptance L1-L3',
    syntheticOnly: true,
    containsPersonalData: false,
    seed: args.seed,
    generatedAt: new Date().toISOString(),
    counts: { students: STUDENT_COUNT, questions: QUESTION_COUNT, papers: PAPER_COUNT },
    files: {
      'students-2000.csv': students,
      'questions-50000.csv': questions,
      'papers-1000.csv': papers,
    },
  };

  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    outDir,
    seed: args.seed,
    counts: manifest.counts,
    hashes: Object.fromEntries(Object.entries(manifest.files).map(([name, meta]) => [name, meta.sha256])),
  }, null, 2));
}

main().catch((error) => {
  console.error(`Phase 1 load fixture generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
