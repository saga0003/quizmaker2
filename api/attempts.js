const { configured, supabaseFetch, authenticate, appSession, filterDataForProfile, keysForProfile } = require('./_supabase');

function average(values) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0; }
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

async function getSnapshot(organisationId) {
  const { data } = await supabaseFetch(`/rest/v1/workspace_snapshots?organisation_id=eq.${encodeURIComponent(organisationId)}&scope=eq.organisation&select=id,data,version,updated_at&limit=1`, { service: true });
  return data?.[0] || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!configured()) return res.status(503).json({ error: 'Cloud backend is not configured.' });
  try {
    const { user, profile } = await authenticate(req);
    if (profile.role !== 'student') return res.status(403).json({ error: 'Only a student account can submit a student attempt.' });
    const snapshot = await getSnapshot(profile.organisation_id);
    if (!snapshot) return res.status(404).json({ error: 'Cloud workspace not found.' });
    if (Number(req.body?.baseVersion || 0) !== Number(snapshot.version)) return res.status(409).json({ error: 'Assessment data changed. Pull the latest version before submitting.' });

    const master = JSON.parse(JSON.stringify(snapshot.data));
    const { studentKey } = keysForProfile(profile, master);
    if (!studentKey) return res.status(422).json({ error: 'Student mapping is missing from the cloud profile.' });
    const assessment = (master.assessments || []).find(a => String(a.id) === String(req.body.assessmentId));
    if (!assessment || assessment.status !== 'Live') return res.status(404).json({ error: 'This assessment is not live.' });
    const questions = assessment.questionIds.map(id => (master.questions || []).find(q => String(q.id) === String(id))).filter(Boolean);
    const answers = req.body.answers || {};
    const times = req.body.times || {};
    const review = questions.map(q => {
      const chosen = answers[q.id];
      const correct = Number(chosen) === Number(q.answer);
      return {
        questionId: q.id,
        topic: q.topic,
        correct,
        message: correct ? `Correct. ${q.explanation || ''}` : `Your answer: ${chosen === undefined ? 'Not answered' : q.options?.[chosen]}. ${q.explanation || 'Review this concept before the retest.'}`
      };
    });
    const correct = review.filter(r => r.correct).length;
    const score = Math.round(100 * correct / Math.max(1, questions.length));
    const previous = (master.attempts || []).filter(a => String(a.studentId) === studentKey);
    const percentile = Math.min(99, Math.max(20, Math.round(score * .72 + 35 + previous.length * 2)));
    const normalizedTimes = {};
    questions.forEach(q => normalizedTimes[q.id] = Number(times[q.id] || q.expectedTime || 60));
    const wrong = review.filter(r => !r.correct);
    const actions = wrong.slice(0,3).map(r => ({ title: r.topic, detail: 'Review the worked explanation, complete eight controlled questions and retest after seven days.' }));
    if (!actions.length) actions.push({ title: 'Retention challenge', detail: 'Revisit two mastered topics after 21 days and maintain at least 80% accuracy.' });
    const attempt = {
      id: uid('at'), assessmentId: assessment.id, studentId: studentKey, submittedAt: new Date().toISOString(),
      score, correct, total: questions.length, percentile, avgTime: average(Object.values(normalizedTimes)),
      answers, times: normalizedTimes, review, actions,
      summary: score >= 80 ? 'Strong current mastery. Now make the performance repeatable across unfamiliar formats.' : 'Recoverable gaps were found. Repair the misconception before increasing difficulty.'
    };
    master.attempts = [...(master.attempts || []), attempt];
    const nextVersion = Number(snapshot.version) + 1;
    const endpoint = `/rest/v1/workspace_snapshots?id=eq.${encodeURIComponent(snapshot.id)}&version=eq.${snapshot.version}&select=id,data,version,updated_at`;
    const { data: updated } = await supabaseFetch(endpoint, {
      method: 'PATCH', service: true, headers: { Prefer: 'return=representation' },
      body: { data: master, version: nextVersion, updated_by: user.id, updated_at: new Date().toISOString() }
    });
    if (!updated?.length) return res.status(409).json({ error: 'The workspace changed during submission. Your answers were not overwritten; retry after pulling the latest data.' });
    const row = updated[0];
    return res.status(201).json({ attempt, data: filterDataForProfile(row.data, profile), version: row.version, updatedAt: row.updated_at, session: appSession(user, profile, row.data) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, details: error.data || null });
  }
};
