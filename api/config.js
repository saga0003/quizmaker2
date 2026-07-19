module.exports = function handler(_req, res) {
  const configured = Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    release: '3.0',
    configured,
    mode: configured ? 'hybrid-cloud' : 'local-pilot',
    supabaseUrl: configured ? process.env.SUPABASE_URL : null,
    supabaseAnonKey: configured ? process.env.SUPABASE_ANON_KEY : null
  });
};
