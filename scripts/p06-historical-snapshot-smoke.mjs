import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831012000_phase1_historical_analytics_snapshots.sql', 'utf8');
const route = fs.readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');

const checks = [
  ['paper taxonomy freeze trigger exists', /phase1_freeze_paper_question_taxonomy_v20/.test(migration)],
  ['snapshot freezes subject identity and name', /subject_id/.test(migration) && /subject_name/.test(migration)],
  ['snapshot freezes chapter identity and name', /chapter_id/.test(migration) && /chapter_name/.test(migration)],
  ['snapshot freezes topic identity and name', /topic_id/.test(migration) && /topic_name/.test(migration)],
  ['snapshot is versioned', /taxonomy_snapshot_version/.test(migration)],
  ['student analytics prefers frozen subject', /question_snapshot->>''subject_id''/.test(migration) && /question_snapshot->>''subject_name''/.test(migration)],
  ['student analytics prefers frozen chapter', /question_snapshot->>''chapter_id''/.test(migration) && /question_snapshot->>''chapter_name''/.test(migration)],
  ['student analytics prefers frozen topic', /question_snapshot->>''topic_id''/.test(migration) && /question_snapshot->>''topic_name''/.test(migration)],
  ['topic reflection uses frozen topic', /coalesce\(nullif\(pq\.question_snapshot->>''topic_id''/.test(migration)],
  ['institution evidence fetches question_snapshot', /paper_questions\(marks,question_snapshot,questions/.test(route)],
  ['institution taxonomy prefers frozen subject', /frozenTaxonomy\('subject_id', 'subject_name'/.test(route)],
  ['institution taxonomy prefers frozen chapter', /frozenTaxonomy\('chapter_id', 'chapter_name'/.test(route)],
  ['institution taxonomy prefers frozen topic', /frozenTaxonomy\('topic_id', 'topic_name'/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
console.log(`\n${checks.length - failed.length}/${checks.length} P0.6 historical-snapshot checks passed.`);
if (failed.length) process.exit(1);
