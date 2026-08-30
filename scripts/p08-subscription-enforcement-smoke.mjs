import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (name, condition) => {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
};

const migration = read('supabase/migrations/20260830172500_phase1_assignment_and_subscription_core.sql');
const resultsMigration = read('supabase/migrations/20260830235800_phase1_result_release_security.sql');

check('subscription policy defines active state', /return 'active'/i.test(migration));
check('subscription policy defines seven-day grace state', /v_ends \+ 7/i.test(migration) && /return 'grace'/i.test(migration));
check('subscription policy defines expired state', /return 'expired'/i.test(migration));
check('subscription policy defines suspended state', /in \('suspended','cancelled'\)[\s\S]*return 'suspended'/i.test(migration));
check('new activity is allowed only for active or grace', /school_license_state_v19\(p_organization_id, current_date\) in \('active','grace'\)/i.test(migration));
check('student activation is blocked outside active/grace', /This institution licence is not active\. Renew the annual licence before activating students/i.test(migration));
check('new paper publication is subscription-gated', /question_paper_publish_subscription_guard_v19/i.test(migration) && /licence must be active before publishing a new test/i.test(migration));
check('new paper assignment is subscription-gated', /Renew the institution licence before assigning a new test/i.test(migration));
check('student test discovery is subscription-gated', /create or replace function public\.list_available_papers[\s\S]*school_can_run_new_activity_v19\(p\.organization_id\)/i.test(migration));
check('student test start is subscription-gated', /create or replace function public\.start_exam_attempt[\s\S]*school_can_run_new_activity_v19\(v_paper\.organization_id\)/i.test(migration));
check('historical results remain readable independent of current licence', /create or replace function public\.list_my_attempt_results/i.test(resultsMigration) && !/school_can_run_new_activity_v19/i.test(resultsMigration));
check('subscription helpers are not directly browser-executable', /revoke all on function public\.school_license_state_v19\(uuid,date\) from public, anon, authenticated/i.test(migration) && /revoke all on function public\.school_can_run_new_activity_v19\(uuid\) from public, anon, authenticated/i.test(migration));

console.log(`\n${12 - failures.length}/12 P0.8 subscription-enforcement checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
