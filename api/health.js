const { configured, supabaseFetch } = require('./_supabase');

module.exports = async function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) {
    return res.status(200).json({ mode: 'local-pilot', configured: false, healthy: true, message: 'Cloud variables are not configured; browser-persistent pilot mode is active.' });
  }
  try {
    await supabaseFetch('/rest/v1/workspace_snapshots?select=id&limit=1', { service: true });
    return res.status(200).json({ mode: 'hybrid-cloud', configured: true, healthy: true, message: 'Supabase connection and workspace table are available.' });
  } catch (error) {
    return res.status(200).json({ mode: 'cloud-degraded', configured: true, healthy: false, message: error.message });
  }
};
