const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function configured() {
  return REQUIRED.every(key => Boolean(process.env[key]));
}

async function supabaseFetch(path, { method = 'GET', body, token, service = false, headers = {} } = {}) {
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || data?.hint || `Supabase request failed (${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return { data, response };
}

async function authenticate(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) {
    const error = new Error('Missing cloud access token.');
    error.status = 401;
    throw error;
  }
  const { data: user } = await supabaseFetch('/auth/v1/user', { token });
  const query = `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,organisation_id,school_id,role,full_name,metadata`;
  const { data: profiles } = await supabaseFetch(query, { service: true });
  const profile = profiles?.[0];
  if (!profile) {
    const error = new Error('Your account has no ScholarOS profile.');
    error.status = 403;
    throw error;
  }
  return { user, profile, token };
}

function appRole(role) {
  return ({ super_admin: 'super', org_admin: 'admin', school_admin: 'school', teacher: 'school', student: 'student', parent: 'student' })[role] || 'student';
}

function appSession(user, profile, data) {
  const schoolKey = profile.metadata?.pilot_school_key || profile.school_id || null;
  const studentKey = profile.metadata?.pilot_student_key || data?.students?.find(s => s.name === profile.full_name)?.id || null;
  return {
    id: user.id,
    name: profile.full_name,
    email: user.email,
    role: appRole(profile.role),
    schoolId: schoolKey,
    studentId: studentKey,
    cloud: true
  };
}

function stripPasswords(data) {
  const clean = JSON.parse(JSON.stringify(data || {}));
  delete clean.users;
  return clean;
}

function redactQuestions(questions = []) {
  return questions.map(({ answer, answer_key, explanation, solution, ...safe }) => safe);
}

function keysForProfile(profile, data) {
  const schoolKey = profile.metadata?.pilot_school_key || profile.school_id || data?.schools?.find(s => s.name === profile.metadata?.school_name)?.id || null;
  const studentKey = profile.metadata?.pilot_student_key || data?.students?.find(s => s.name === profile.full_name && (!schoolKey || s.schoolId === schoolKey))?.id || null;
  return { schoolKey: schoolKey && String(schoolKey), studentKey: studentKey && String(studentKey) };
}

function filterDataForProfile(raw, profile) {
  const data = stripPasswords(raw);
  if (['super_admin', 'org_admin'].includes(profile.role)) return data;
  const { schoolKey, studentKey } = keysForProfile(profile, data);
  if (['school_admin', 'teacher'].includes(profile.role)) {
    const studentIds = new Set((data.students || []).filter(s => String(s.schoolId) === schoolKey).map(s => s.id));
    return {
      ...data,
      schools: (data.schools || []).filter(s => String(s.id) === schoolKey),
      students: (data.students || []).filter(s => studentIds.has(s.id)),
      attempts: (data.attempts || []).filter(a => studentIds.has(a.studentId)),
      consents: (data.consents || []).filter(c => studentIds.has(c.studentId)),
      opportunities: (data.opportunities || []).filter(o => studentIds.has(o.studentId)),
      interventions: (data.interventions || []).filter(i => String(i.schoolId) === schoolKey),
      assessments: (data.assessments || []).filter(a => !a.schoolIds || a.schoolIds.map(String).includes(schoolKey))
    };
  }
  return {
    ...data,
    schools: (data.schools || []).filter(s => String(s.id) === schoolKey),
    students: (data.students || []).filter(s => String(s.id) === studentKey),
    attempts: (data.attempts || []).filter(a => String(a.studentId) === studentKey),
    consents: (data.consents || []).filter(c => String(c.studentId) === studentKey),
    opportunities: [],
    interventions: [],
    questions: redactQuestions(data.questions || []),
    assessments: (data.assessments || []).filter(a => !a.schoolIds || a.schoolIds.map(String).includes(schoolKey))
  };
}

function mergeRoleData(master, incoming, profile) {
  const clean = stripPasswords(incoming);
  if (['super_admin', 'org_admin'].includes(profile.role)) return clean;
  const merged = JSON.parse(JSON.stringify(master));
  const { schoolKey, studentKey } = keysForProfile(profile, master);
  if (['school_admin', 'teacher'].includes(profile.role)) {
    if (!schoolKey) throw Object.assign(new Error('School mapping is missing from the cloud profile.'), { status: 422 });
    const incomingStudentIds = new Set((clean.students || []).filter(s => String(s.schoolId) === schoolKey).map(s => s.id));
    merged.schools = [...(merged.schools || []).filter(s => String(s.id) !== schoolKey), ...(clean.schools || []).filter(s => String(s.id) === schoolKey)];
    merged.students = [...(merged.students || []).filter(s => String(s.schoolId) !== schoolKey), ...(clean.students || []).filter(s => String(s.schoolId) === schoolKey)];
    for (const collection of ['attempts','consents','opportunities']) {
      merged[collection] = [...(merged[collection] || []).filter(row => !incomingStudentIds.has(row.studentId)), ...(clean[collection] || []).filter(row => incomingStudentIds.has(row.studentId))];
    }
    merged.interventions = [...(merged.interventions || []).filter(i => String(i.schoolId) !== schoolKey), ...(clean.interventions || []).filter(i => String(i.schoolId) === schoolKey)];
    return merged;
  }
  if (!studentKey) throw Object.assign(new Error('Student mapping is missing from the cloud profile.'), { status: 422 });
  merged.attempts = [...(merged.attempts || []).filter(a => String(a.studentId) !== studentKey), ...(clean.attempts || []).filter(a => String(a.studentId) === studentKey)];
  return merged;
}

module.exports = { configured, supabaseFetch, authenticate, appSession, filterDataForProfile, mergeRoleData, stripPasswords, keysForProfile };
