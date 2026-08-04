// ===== DEMO DATA FOR EVIDARA PLATFORM =====

export const demoStudent = {
  id: 's1',
  name: 'Aarav Sharma',
  grade: '12',
  board: 'CBSE',
  track: 'NEET',
  school: 'Green Valley High',
  avatar: null,
};

export const demoSchool = {
  id: 'sc1',
  name: 'Green Valley High School',
  type: 'Senior Secondary',
  city: 'Bengaluru',
  state: 'Karnataka',
  plan: 'Annual Pro',
  seatsTotal: 500,
  seatsUsed: 347,
  daysRemaining: 218,
  revenue: 489500,
};

export const demoStudentStats = {
  totalAssessments: 24,
  avgScore: 76.4,
  avgAccuracy: 71.2,
  percentile: 82,
  trend: 'improving' as const,
  segment: 'Fast Improver',
  readiness: 78,
};

export const demoStudentTrend = [
  { assessment: 'Assess 1', score: 58, accuracy: 52 },
  { assessment: 'Assess 2', score: 63, accuracy: 58 },
  { assessment: 'Assess 3', score: 61, accuracy: 60 },
  { assessment: 'Assess 4', score: 68, accuracy: 64 },
  { assessment: 'Assess 5', score: 72, accuracy: 68 },
  { assessment: 'Assess 6', score: 70, accuracy: 67 },
  { assessment: 'Assess 7', score: 76, accuracy: 72 },
  { assessment: 'Assess 8', score: 80, accuracy: 74 },
  { assessment: 'Assess 9', score: 78, accuracy: 73 },
  { assessment: 'Assess 10', score: 82, accuracy: 76 },
];

export const demoErrorCauses = [
  { cause: 'Conceptual Gap', count: 14, percentage: 35 },
  { cause: 'Calculation Error', count: 10, percentage: 25 },
  { cause: 'Time Pressure', count: 8, percentage: 20 },
  { cause: 'Misread Question', count: 5, percentage: 12.5 },
  { cause: 'Silly Mistake', count: 3, percentage: 7.5 },
];

export const demoTopicMastery = [
  { topic: 'Electrostatics', mastery: 85, questions: 42, avg: 88 },
  { topic: 'Organic Chemistry', mastery: 78, questions: 38, avg: 80 },
  { topic: 'Cell Biology', mastery: 92, questions: 30, avg: 94 },
  { topic: 'Thermodynamics', mastery: 65, questions: 35, avg: 68 },
  { topic: 'Coordinate Geometry', mastery: 72, questions: 40, avg: 75 },
  { topic: 'Genetics', mastery: 88, questions: 28, avg: 90 },
  { topic: 'Mechanics', mastery: 70, questions: 45, avg: 72 },
  { topic: 'Inorganic Chemistry', mastery: 60, questions: 32, avg: 63 },
];

export const demoTests = [
  {
    id: 't1',
    title: 'NEET Mock Test — Full Syllabus',
    subject: 'NEET',
    questions: 200,
    duration: '3h 20m',
    status: 'available' as const,
    scheduledFor: '2026-08-01',
    accessCode: null,
  },
  {
    id: 't2',
    title: 'Physics — Electrostatics & Current',
    subject: 'Physics',
    questions: 45,
    duration: '1h',
    status: 'available' as const,
    scheduledFor: '2026-07-25',
    accessCode: 'PHY456',
  },
  {
    id: 't3',
    title: 'Chemistry — Organic Reactions',
    subject: 'Chemistry',
    questions: 40,
    duration: '50m',
    status: 'available' as const,
    scheduledFor: '2026-07-28',
    accessCode: 'CHE789',
  },
  {
    id: 't4',
    title: 'Biology — Genetics & Evolution',
    subject: 'Biology',
    questions: 45,
    duration: '1h',
    status: 'available' as const,
    scheduledFor: '2026-07-30',
    accessCode: 'BIO123',
  },
  {
    id: 't5',
    title: 'Mathematics — Calculus Fundamentals',
    subject: 'Mathematics',
    questions: 30,
    duration: '45m',
    status: 'available' as const,
    scheduledFor: '2026-08-02',
    accessCode: 'MAT456',
  },
];

export const demoResults = [
  {
    id: 'r1',
    paper: 'Physics — Mechanics Unit Test',
    date: '2026-07-15',
    score: 72,
    total: 100,
    correct: 36,
    incorrect: 9,
    unanswered: 5,
    percentile: 78,
    timeTaken: '52m 30s',
  },
  {
    id: 'r2',
    paper: 'Chemistry — Organic Chemistry',
    date: '2026-07-12',
    score: 85,
    total: 100,
    correct: 42,
    incorrect: 5,
    unanswered: 3,
    percentile: 89,
    timeTaken: '45m 12s',
  },
  {
    id: 'r3',
    paper: 'Biology — Cell Structure',
    date: '2026-07-08',
    score: 91,
    total: 100,
    correct: 45,
    incorrect: 2,
    unanswered: 3,
    percentile: 94,
    timeTaken: '48m 05s',
  },
  {
    id: 'r4',
    paper: 'NEET Mock Test — Half Syllabus',
    date: '2026-07-01',
    score: 68,
    total: 200,
    correct: 136,
    incorrect: 28,
    unanswered: 36,
    percentile: 72,
    timeTaken: '2h 58m',
  },
  {
    id: 'r5',
    paper: 'Physics — Thermodynamics',
    date: '2026-06-24',
    score: 64,
    total: 100,
    correct: 32,
    incorrect: 8,
    unanswered: 10,
    percentile: 65,
    timeTaken: '55m 18s',
  },
];

export const demoAchievements = [
  {
    id: 'ach1',
    title: 'First Assessment',
    description: 'Completed your first assessment on Evidara',
    tier: 'bronze' as const,
    earnedAt: '2026-06-15',
    icon: '🎯',
  },
  {
    id: 'ach2',
    title: 'Assessment Excellence',
    description: 'Scored above 90% on any assessment',
    tier: 'gold' as const,
    earnedAt: '2026-07-08',
    icon: '⭐',
  },
  {
    id: 'ach3',
    title: 'Perfect Score',
    description: 'Achieved 100% on any question paper',
    tier: 'gold' as const,
    earnedAt: '2026-07-10',
    icon: '💎',
  },
  {
    id: 'ach4',
    title: 'Growth Milestone',
    description: 'Improved score by 12+ points between assessments',
    tier: 'silver' as const,
    earnedAt: '2026-07-12',
    icon: '📈',
  },
  {
    id: 'ach5',
    title: 'Consistent Performer',
    description: 'Maintained above 75% across 5 consecutive assessments',
    tier: 'silver' as const,
    earnedAt: '2026-07-15',
    icon: '🔥',
  },
  {
    id: 'ach6',
    title: 'Integrity Streak',
    description: 'Completed 10 assessments with zero violations',
    tier: 'bronze' as const,
    earnedAt: '2026-07-15',
    icon: '🛡️',
  },
  {
    id: 'ach7',
    title: 'Benchmark Participant',
    description: 'Participated in your first benchmark publication',
    tier: 'bronze' as const,
    earnedAt: '2026-07-18',
    icon: '🏆',
  },
  {
    id: 'ach8',
    title: 'Top Decile',
    description: 'Ranked in the 90th percentile in a benchmark',
    tier: 'gold' as const,
    earnedAt: null,
    icon: '👑',
    locked: true,
  },
];

export const demoQuestions = [
  { id: 'q1', text: 'A charge of 2μC is placed at the origin. Find the electric field at a point (3, 4) cm.', subject: 'Physics', chapter: 'Electrostatics', type: 'numerical' as const, difficulty: 'medium' as const, status: 'published' as const },
  { id: 'q2', text: 'Which of the following is the correct IUPAC name for CH₃-CH(OH)-CH₂-CH₃?', subject: 'Chemistry', chapter: 'Organic Chemistry', type: 'mcq' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q3', text: 'Explain the process of DNA replication with a neat diagram.', subject: 'Biology', chapter: 'Molecular Biology', type: 'long-answer' as const, difficulty: 'hard' as const, status: 'published' as const },
  { id: 'q4', text: 'The value of lim(x→0) sin(x)/x is:', subject: 'Mathematics', chapter: 'Limits & Continuity', type: 'mcq' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q5', text: 'Derive the expression for the equivalent resistance of three resistors in parallel.', subject: 'Physics', chapter: 'Current Electricity', type: 'derivation' as const, difficulty: 'medium' as const, status: 'published' as const },
  { id: 'q6', text: 'What is the hybridization of carbon in methane? Explain with orbital diagram.', subject: 'Chemistry', chapter: 'Chemical Bonding', type: 'short-answer' as const, difficulty: 'medium' as const, status: 'review' as const },
  { id: 'q7', text: 'Differentiate between mitosis and meiosis.', subject: 'Biology', chapter: 'Cell Division', type: 'short-answer' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q8', text: 'A projectile is fired at 60° with velocity 20 m/s. Find the maximum height and range.', subject: 'Physics', chapter: 'Mechanics', type: 'numerical' as const, difficulty: 'medium' as const, status: 'draft' as const },
  { id: 'q9', text: 'Calculate the pH of 0.01M HCl solution.', subject: 'Chemistry', chapter: 'Equilibrium', type: 'numerical' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q10', text: 'Explain the structure and function of nephrons in the kidney.', subject: 'Biology', chapter: 'Excretory System', type: 'long-answer' as const, difficulty: 'medium' as const, status: 'review' as const },
  { id: 'q11', text: 'Find the area under the curve y = x² from x = 0 to x = 3 using integration.', subject: 'Mathematics', chapter: 'Integration', type: 'numerical' as const, difficulty: 'medium' as const, status: 'published' as const },
  { id: 'q12', text: 'State and prove Bernoulli\'s theorem.', subject: 'Physics', chapter: 'Mechanics', type: 'derivation' as const, difficulty: 'hard' as const, status: 'published' as const },
];

export const demoPapers = [
  { id: 'p1', title: 'NEET Mock Test — Full Syllabus', subject: 'NEET', sections: 4, questions: 200, duration: '3h 20m', status: 'published' as const, submissions: 89, createdAt: '2026-07-10' },
  { id: 'p2', title: 'Physics — Electrostatics Unit Test', subject: 'Physics', sections: 2, questions: 45, duration: '1h', status: 'published' as const, submissions: 156, createdAt: '2026-07-08' },
  { id: 'p3', title: 'Chemistry — Organic Reactions Test', subject: 'Chemistry', sections: 2, questions: 40, duration: '50m', status: 'published' as const, submissions: 142, createdAt: '2026-07-05' },
  { id: 'p4', title: 'Biology — Genetics & Evolution', subject: 'Biology', sections: 2, questions: 45, duration: '1h', status: 'draft' as const, submissions: 0, createdAt: '2026-07-18' },
  { id: 'p5', title: 'JEE Main — Mathematics Practice', subject: 'Mathematics', sections: 3, questions: 30, duration: '45m', status: 'scheduled' as const, submissions: 0, createdAt: '2026-07-20', scheduledFor: '2026-08-01' },
];

export const demoSchoolStudents = [
  { id: 'ss1', name: 'Aarav Sharma', grade: '12', track: 'NEET', email: 'aarav@greenvalley.edu', status: 'active' as const, assessments: 24, avgScore: 76.4, segment: 'Fast Improver' },
  { id: 'ss2', name: 'Priya Nair', grade: '12', track: 'NEET', email: 'priya@greenvalley.edu', status: 'active' as const, assessments: 22, avgScore: 88.2, segment: 'Academic Elite' },
  { id: 'ss3', name: 'Rohan Patel', grade: '11', track: 'JEE', email: 'rohan@greenvalley.edu', status: 'active' as const, assessments: 18, avgScore: 72.1, segment: 'Developing' },
  { id: 'ss4', name: 'Sneha Reddy', grade: '12', track: 'NEET', email: 'sneha@greenvalley.edu', status: 'active' as const, assessments: 20, avgScore: 81.5, segment: 'High Potential' },
  { id: 'ss5', name: 'Arjun Kumar', grade: '11', track: 'JEE', email: 'arjun@greenvalley.edu', status: 'active' as const, assessments: 15, avgScore: 69.8, segment: 'Accurate Slow' },
  { id: 'ss6', name: 'Divya Iyer', grade: '12', track: 'NEET', email: 'divya@greenvalley.edu', status: 'active' as const, assessments: 25, avgScore: 92.1, segment: 'Academic Elite' },
  { id: 'ss7', name: 'Karthik Menon', grade: '11', track: 'Boards', email: 'karthik@greenvalley.edu', status: 'active' as const, assessments: 12, avgScore: 65.3, segment: 'Developing' },
  { id: 'ss8', name: 'Ananya Gupta', grade: '12', track: 'NEET', email: 'ananya@greenvalley.edu', status: 'revoked' as const, assessments: 8, avgScore: 55.2, segment: 'Not Assessed' },
];

export const demoProducts = [
  { id: 'prod1', name: 'NEET Complete Test Series', description: 'Full syllabus mock tests with detailed analytics and benchmarks', price: 5999, discountPrice: 1999, audience: 'student', subscribers: 1240, status: 'active' as const },
  { id: 'prod2', name: 'JEE Main Practice Series', description: 'Topic-wise and full-length practice papers for JEE Main', price: 3999, discountPrice: 1499, audience: 'student', subscribers: 890, status: 'active' as const },
  { id: 'prod3', name: 'School Starter Plan', description: 'Up to 200 students, question bank, assessments, and basic analytics', price: 9999, discountPrice: 5999, audience: 'school', subscribers: 45, status: 'active' as const },
  { id: 'prod4', name: 'School Pro Plan', description: 'Unlimited students, advanced analytics, benchmarks, and achievements', price: 24999, discountPrice: 18999, audience: 'school', subscribers: 18, status: 'active' as const },
];

export const demoBenchmarks = [
  { id: 'b1', title: 'NEET 2026 — Physics Mid-Year', subject: 'Physics', participants: 2340, schoolRank: 12, schoolScore: 76.4, topScore: 96.2, avgScore: 62.8, status: 'active' as const },
  { id: 'b2', title: 'NEET 2026 — Chemistry Mid-Year', subject: 'Chemistry', participants: 2180, schoolRank: 8, schoolScore: 81.2, topScore: 94.5, avgScore: 60.1, status: 'active' as const },
  { id: 'b3', title: 'NEET 2026 — Biology Mid-Year', subject: 'Biology', participants: 2250, schoolRank: 15, schoolScore: 74.8, topScore: 97.1, avgScore: 65.3, status: 'closed' as const },
];

export const demoResources = [
  { id: 'res1', title: 'NEET Previous Year Papers (2018–2025)', type: 'PYQ' as const, subject: 'NEET', files: 8, eligible: true },
  { id: 'res2', title: 'JEE Main Formula Sheets', type: 'study-material' as const, subject: 'Mathematics', files: 12, eligible: true },
  { id: 'res3', title: 'NCERT Solutions — Class 12 Physics', type: 'solution-guide' as const, subject: 'Physics', files: 15, eligible: true },
  { id: 'res4', title: 'NEET Biology Diagram Bank', type: 'study-material' as const, subject: 'Biology', files: 45, eligible: true },
  { id: 'res5', title: 'Olympiad Practice Papers', type: 'olympiad' as const, subject: 'Science', files: 6, eligible: false },
  { id: 'res6', title: 'CBSE Sample Papers 2026', type: 'PYQ' as const, subject: 'All', files: 10, eligible: true },
];

export const demoSegments = [
  { name: 'Academic Elite', description: '95th+ percentile, 88%+ accuracy, efficient time management', count: 2, color: '#F2B84B' },
  { name: 'Fast Improver', description: 'Score improvement of 12+ points between recent assessments', count: 1, color: '#0E5A5A' },
  { name: 'High Potential (Careless)', description: '75th+ percentile with 20%+ avoidable mark loss', count: 1, color: '#2E6D8B' },
  { name: 'Accurate Slow', description: '80%+ accuracy but takes significantly more time than average', count: 1, color: '#6B7980' },
  { name: 'Developing', description: 'Building foundation, needs structured practice and concept support', count: 2, color: '#B54747' },
  { name: 'Not Yet Assessed', description: 'Fewer than 3 assessments completed for segment evaluation', count: 1, color: '#E7ECEB' },
];

export const demoAdminStats = {
  totalSchools: 63,
  totalStudents: 12847,
  totalAssessments: 45632,
  totalRevenue: 8456000,
  activeSubscriptions: 58,
  products: 4,
  benchmarksPublished: 12,
};

export const segmentCriteria = [
  { label: 'Percentile ≥ 95th', passed: true, value: '82nd' },
  { label: 'Accuracy ≥ 88%', passed: false, value: '71.2%' },
  { label: 'Time ratio ≤ 1.0', passed: true, value: '0.95' },
  { label: 'Score improvement ≥ 12 pts', passed: true, value: '+14 pts' },
  { label: 'Avoidable loss ≥ 20%', passed: false, value: '12.5%' },
  { label: 'Min 3 assessments', passed: true, value: '24' },
];
