import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const school = read('src/components/evidara/school-views.tsx');
const student = read('src/components/evidara/student-dashboard.tsx');
const failures = [];
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
for (const label of ['Students', 'Teachers', 'Tests', 'Participation', 'Score', 'Licence usage']) check(`H3 School Admin includes ${label}`, school.includes(`label=\"${label}\"`));
for (const label of ['Manage Students', 'Manage Teachers', 'Create Test', 'View Results']) check(`H3 School Admin action ${label}`, school.includes(`label: '${label}'`));
check('H3 participation and score preserve unavailable state', school.includes("schoolAdminMetrics.participation == null ? '—'") && school.includes("schoolAdminMetrics.averageScore == null ? '—'"));
for (const label of ['Upload Questions', 'Create Test', 'Upcoming Tests', 'Recent Results']) check(`H4 Teacher action ${label}`, school.includes(`label: '${label}'`));
check('H4 Students Needing Attention is first-class', school.includes('Students Needing Attention') && school.includes('<TeacherNeedsAttention'));
for (const label of ['Next Test', 'Recent Result', 'Improvement', 'Focus Topics']) check(`H5 Student focus includes ${label}`, student.includes(`>${label}<`));
check('H5 Improvement uses two submitted results only', /submittedResults\.length < 2/.test(student) && /submittedResults\[0\]/.test(student) && /submittedResults\[1\]/.test(student));
check('H5 Focus Topics routes to released analytics priorities', student.includes("setView('student-analytics-priorities')") && /no topic is invented/i.test(student));
console.log(`\n${22 - failures.length}/22 H3-H5 role-dashboard checks passed.`);
if (failures.length) { console.error(`Failed: ${failures.join(', ')}`); process.exit(1); }
