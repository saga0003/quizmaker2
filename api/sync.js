const { configured, supabaseFetch, authenticate, appSession, filterDataForProfile, mergeRoleData, stripPasswords } = require('./_supabase');

function fail(res, error) {
  return res.status(error.status || 500).json({ error: error.message, details: error.data || null });
}

async function getSnapshot(organisationId) {
  const query = `/rest/v1/workspace_snapshots?organisation_id=eq.${encodeURIComponent(organisationId)}&scope=eq.organisation&select=id,data,version,updated_at&limit=1`;
  const { data } = await supabaseFetch(query, { service: true });
  return data?.[0] || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ error: 'Cloud backend is not configured.', mode: 'local-pilot' });
  try {
    const { user, profile } = await authenticate(req);
    if (!profile.organisation_id) return res.status(422).json({ error: 'The cloud profile has no organisation mapping.' });
    const snapshot = await getSnapshot(profile.organisation_id);

    if (req.method === 'GET') {
      if (!snapshot) return res.status(404).json({ error: 'No cloud workspace exists yet.', canBootstrap: ['super_admin','org_admin'].includes(profile.role), session: appSession(user, profile, null) });
      const data = filterDataForProfile(snapshot.data, profile);
      return res.status(200).json({ data, version: snapshot.version, updatedAt: snapshot.updated_at, session: appSession(user, profile, snapshot.data) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    const body = req.body || {};
    if (!body.data || typeof body.data !== 'object') return res.status(400).json({ error: 'A workspace data object is required.' });

    if (!snapshot) {
      if (!body.bootstrap || !['super_admin','org_admin'].includes(profile.role)) return res.status(404).json({ error: 'No cloud workspace exists.', canBootstrap: ['super_admin','org_admin'].includes(profile.role) });
      const clean = stripPasswords(body.data);
      const { data: inserted } = await supabaseFetch('/rest/v1/workspace_snapshots?select=id,data,version,updated_at', {
        method: 'POST', service: true, headers: { Prefer: 'return=representation' },
        body: { organisation_id: profile.organisation_id, scope: 'organisation', data: clean, version: 1, updated_by: user.id }
      });
      const row = inserted[0];
      return res.status(201).json({ data: filterDataForProfile(row.data, profile), version: row.version, updatedAt: row.updated_at, session: appSession(user, profile, row.data) });
    }

    const baseVersion = Number(body.baseVersion || 0);
    if (baseVersion !== Number(snapshot.version)) {
      return res.status(409).json({ error: 'Cloud data changed on another device. The latest version has been returned.', data: filterDataForProfile(snapshot.data, profile), version: snapshot.version, updatedAt: snapshot.updated_at, session: appSession(user, profile, snapshot.data) });
    }

    const merged = mergeRoleData(snapshot.data, body.data, profile);
    const nextVersion = Number(snapshot.version) + 1;
    const endpoint = `/rest/v1/workspace_snapshots?id=eq.${encodeURIComponent(snapshot.id)}&version=eq.${snapshot.version}&select=id,data,version,updated_at`;
    const { data: updated } = await supabaseFetch(endpoint, {
      method: 'PATCH', service: true, headers: { Prefer: 'return=representation' },
      body: { data: merged, version: nextVersion, updated_by: user.id, updated_at: new Date().toISOString() }
    });
    if (!updated?.length) return res.status(409).json({ error: 'The workspace was updated concurrently. Pull the latest version.' });
    const row = updated[0];
    return res.status(200).json({ data: filterDataForProfile(row.data, profile), version: row.version, updatedAt: row.updated_at, session: appSession(user, profile, row.data) });
  } catch (error) { return fail(res, error); }
};
