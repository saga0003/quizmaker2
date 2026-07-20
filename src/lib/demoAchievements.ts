import type { AchievementDefinition, PublicCertificate, SchoolAchievementRow, StudentAchievement } from "@/lib/achievementClient";

export const demoAchievementDefinitions: AchievementDefinition[] = [
  {code:"first_assessment",title:"First Evidence",description:"Completed the first verified Evidara assessment.",category:"milestone",tier:"bronze",icon_key:"flag",rule_version:"2026.07-v1",criteria:{submitted_attempts_minimum:1,responsible_use:"A completion milestone, not a measure of ability."},certificate_eligible:false,display_order:10},
  {code:"assessment_excellence",title:"Assessment Excellence",description:"Scored at least 90% on a verified assessment with meaningful question coverage.",category:"performance",tier:"silver",icon_key:"star",rule_version:"2026.07-v1",criteria:{percentage_minimum:90,questions_minimum:10,responsible_use:"Applies only to the cited paper and scoring context."},certificate_eligible:true,display_order:20},
  {code:"perfect_score",title:"Perfect Score",description:"Achieved 100% on a verified assessment.",category:"performance",tier:"gold",icon_key:"trophy",rule_version:"2026.07-v1",criteria:{percentage_minimum:100,questions_minimum:5,responsible_use:"Recognises one exact assessment result; it is not a prediction."},certificate_eligible:true,display_order:30},
  {code:"growth_milestone",title:"Growth Milestone",description:"Improved by at least 15 percentage points between comparable assessments of the same exam type.",category:"growth",tier:"silver",icon_key:"trending-up",rule_version:"2026.07-v1",criteria:{percentage_point_improvement_minimum:15,comparison:"same_exam_type",responsible_use:"Shows observed improvement between two assessments, not permanent growth."},certificate_eligible:true,display_order:40},
  {code:"consistent_performer",title:"Consistent Performer",description:"Maintained at least 75% across the three most recent verified assessments.",category:"consistency",tier:"gold",icon_key:"layers",rule_version:"2026.07-v1",criteria:{recent_attempts:3,percentage_minimum_each:75,responsible_use:"Uses only the current three-assessment evidence window."},certificate_eligible:true,display_order:50},
  {code:"integrity_streak",title:"Integrity Streak",description:"Completed five recent verified assessments without a recorded integrity event.",category:"integrity",tier:"gold",icon_key:"shield",rule_version:"2026.07-v1",criteria:{recent_attempts:5,maximum_integrity_events_each:0,responsible_use:"Reflects recorded platform events only and is not a character judgement."},certificate_eligible:true,display_order:60},
  {code:"benchmark_participant",title:"Shared Benchmark Participant",description:"Completed a valid shared-paper benchmark contribution.",category:"benchmark",tier:"bronze",icon_key:"network",rule_version:"2026.07-v1",criteria:{valid_benchmark_contributions_minimum:1,responsible_use:"Recognises participation; no school or student ranking is implied."},certificate_eligible:false,display_order:70},
  {code:"benchmark_top_decile",title:"Benchmark Distinction",description:"Placed in the top external decile after the privacy minimum was reached.",category:"benchmark",tier:"platinum",icon_key:"medal",rule_version:"2026.07-v1",criteria:{external_percentile_minimum:90,privacy_threshold_required:true,responsible_use:"The percentile is specific to the exact paper and anonymous comparison pool."},certificate_eligible:true,display_order:80},
];

const certificate = {
  id:"demo-certificate-1",
  achievement_id:"demo-achievement-2",
  certificate_number:"EVI-2026-DEMO7642",
  verification_code:"demo-evidara-2026",
  status:"active" as const,
  issued_at:"2026-07-18T09:30:00.000Z",
  revoked_at:null,
  revoked_reason:null,
};

export const demoStudentAchievements: StudentAchievement[] = [
  {id:"demo-achievement-1",student_id:"demo-student",organization_id:"demo-school",definition_code:"first_assessment",rule_version:"2026.07-v1",source_type:"exam_attempt",source_id:"demo-attempt-1",evidence:{submitted_attempts:6,paper_title:"Science Diagnostic 01",percentage:68},status:"active",awarded_at:"2026-06-22T10:00:00.000Z",last_evaluated_at:"2026-07-18T09:20:00.000Z",revoked_at:null,revoked_reason:null,definition:demoAchievementDefinitions[0],certificate:null},
  {id:"demo-achievement-2",student_id:"demo-student",organization_id:"demo-school",definition_code:"assessment_excellence",rule_version:"2026.07-v1",source_type:"exam_attempt",source_id:"demo-attempt-5",evidence:{paper_title:"Mathematics Common Assessment",percentage:92,question_count:40},status:"active",awarded_at:"2026-07-12T08:45:00.000Z",last_evaluated_at:"2026-07-18T09:20:00.000Z",revoked_at:null,revoked_reason:null,definition:demoAchievementDefinitions[1],certificate},
  {id:"demo-achievement-3",student_id:"demo-student",organization_id:"demo-school",definition_code:"growth_milestone",rule_version:"2026.07-v1",source_type:"exam_attempt",source_id:"demo-attempt-4",evidence:{paper_title:"Science Diagnostic 03",exam_type:"school",previous_percentage:64,current_percentage:82,percentage_point_improvement:18},status:"active",awarded_at:"2026-07-05T11:15:00.000Z",last_evaluated_at:"2026-07-18T09:20:00.000Z",revoked_at:null,revoked_reason:null,definition:demoAchievementDefinitions[3],certificate:null},
  {id:"demo-achievement-4",student_id:"demo-student",organization_id:"demo-school",definition_code:"benchmark_participant",rule_version:"2026.07-v1",source_type:"benchmark_contribution",source_id:"demo-contribution-1",evidence:{percentage:84,valid_contribution:true},status:"active",awarded_at:"2026-07-18T09:20:00.000Z",last_evaluated_at:"2026-07-18T09:20:00.000Z",revoked_at:null,revoked_reason:null,definition:demoAchievementDefinitions[6],certificate:null},
];

const names = ["Aarav S.","Ananya R.","Diya M.","Ishaan K.","Meera P.","Rohan V.","Saanvi N.","Vihaan G."];
export const demoSchoolAchievements: SchoolAchievementRow[] = names.map((name,index)=>{
  const definition=demoAchievementDefinitions[index%demoAchievementDefinitions.length];
  const base=demoStudentAchievements[index%demoStudentAchievements.length];
  return {
    ...base,
    id:`demo-school-achievement-${index+1}`,
    student_id:`demo-student-${index+1}`,
    definition_code:definition.code,
    definition,
    evidence:index===1?{paper_title:"Mathematics Common Assessment",percentage:94,question_count:40}:base.evidence,
    certificate:index===1?{...certificate,id:"demo-school-certificate-2",achievement_id:`demo-school-achievement-${index+1}`,certificate_number:"EVI-2026-DEMO9201",verification_code:"demo-school-certificate"}:null,
    student_name:name,
    student_email:`student${index+1}@example.edu`,
  };
});

export const demoPublicCertificates: Record<string, PublicCertificate> = {
  "demo-evidara-2026":{
    certificate_number:certificate.certificate_number,
    verification_code:certificate.verification_code,
    student_name:"Aarav Student",
    organization_name:"Green Valley School",
    achievement_title:"Assessment Excellence",
    achievement_description:"Scored at least 90% on a verified assessment with meaningful question coverage.",
    rule_version:"2026.07-v1",
    evidence_summary:"Achieved 92% on Mathematics Common Assessment with 40 evaluated questions.",
    issued_at:certificate.issued_at,
    status:"active",
    revoked_at:null,
    revoked_reason:null,
  },
  "demo-school-certificate":{
    certificate_number:"EVI-2026-DEMO9201",
    verification_code:"demo-school-certificate",
    student_name:"Ananya R.",
    organization_name:"Green Valley School",
    achievement_title:"Assessment Excellence",
    achievement_description:"Scored at least 90% on a verified assessment with meaningful question coverage.",
    rule_version:"2026.07-v1",
    evidence_summary:"Achieved 94% on Mathematics Common Assessment with 40 evaluated questions.",
    issued_at:"2026-07-19T06:30:00.000Z",
    status:"active",
    revoked_at:null,
    revoked_reason:null,
  },
};
