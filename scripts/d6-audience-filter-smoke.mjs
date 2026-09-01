import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/components/evidara/paper-assignment-center.tsx', 'utf8');
const preview = fs.readFileSync('supabase/migrations/20260901062500_phase1_assignment_preview_warnings.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('All Students is an explicit audience preset', () => {
  assert.ok(ui.includes('All Students'));
  assert.ok(ui.includes("setAcademicYear('all')"));
  assert.ok(ui.includes('setGrades([])'));
  assert.ok(ui.includes('setSectionIds([])'));
  assert.ok(ui.includes('setTracks([])'));
});
check('grade filter is supported', () => {
  assert.ok(ui.includes('<Label>Grade</Label>'));
  assert.ok(ui.includes('grades.includes(grade)'));
  assert.ok(preview.includes('membership.grade=any(v_grades)'));
});
check('class and section filter is supported', () => {
  assert.ok(ui.includes('<Label>Sections</Label>'));
  assert.ok(ui.includes('sectionIds.includes(section.id)'));
  assert.ok(preview.includes('membership.section_id=any(v_sections)'));
});
check('stream and track filter is supported', () => {
  assert.ok(ui.includes('<Label>Programme / Track</Label>'));
  assert.ok(ui.includes('tracks.includes(track)'));
  assert.ok(preview.includes('membership.tracks && v_tracks'));
});
check('specific student selection is supported', () => {
  assert.ok(ui.includes('Specific students'));
  assert.ok(ui.includes("search_assignment_students_v19"));
  assert.ok(ui.includes('studentIds.includes(student.student_id)'));
  assert.ok(preview.includes('membership.student_id=any(v_students)'));
});
check('filter groups have documented AND/OR semantics', () => {
  assert.ok(ui.includes('Multiple selections use OR within the group and AND across groups.'));
});
check('all assignment outcomes remain server-previewed before materialization', () => {
  assert.ok(ui.includes("preview_paper_assignment_v19"));
  assert.ok(ui.includes("assign_paper_audience_v19"));
});
check('D6 regression is permanent in release gate', () => {
  assert.ok(workflow.includes('D6 audience-filter checks'));
  assert.ok(workflow.includes('node scripts/d6-audience-filter-smoke.mjs'));
});

console.log(`D6 audience filter smoke: ${checks.length}/${checks.length} checks passed`);
