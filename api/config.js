// GET /api/config  (public)  ->  {logo}
// Per-deployment branding: set LOGO_FILE (e.g. "marjaiya.jpg", a file in /logos)
// in the Vercel project's environment variables to replace the default logo.
const L = require('./_lib');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return L.send(res, 405, { error: 'method_not_allowed' });
  const file = String(process.env.LOGO_FILE || '').replace(/[^A-Za-z0-9._-]/g, '');
  L.send(res, 200, { logo: file ? '/logos/' + file : '' });
};
