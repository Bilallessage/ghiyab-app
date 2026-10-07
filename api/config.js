// /api/config
//   GET  (any logged-in or anonymous caller) -> {logo, custom}
//        logo = the institution's own uploaded logo (a small data: URL kept in
//        Redis), else the LOGO_FILE from /logos, else '' (the built-in default).
//   POST (admin only) {logo:"data:image/..."}  -> saves a new logo
//        POST (admin only) {reset:true}        -> removes it (back to the default)
// The page shrinks the picture before sending it, so the stored value is small;
// the server still checks the type and size so nothing else can be stored here.
const L = require('./_lib');

const LOGO_KEY = L.PREFIX + ':logo';
const MAX_LEN = 300000; // characters of the data: URL (about 220 KB of image)
const DATA_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function envLogo() {
  const file = String(process.env.LOGO_FILE || '').replace(/[^A-Za-z0-9._-]/g, '');
  return file ? '/logos/' + file : '';
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    let logo = envLogo(), custom = false;
    if (!L.configProblem()) {
      try {
        const v = await L.getRedis().get(LOGO_KEY);
        if (typeof v === 'string' && v.length <= MAX_LEN && DATA_RE.test(v)) { logo = v; custom = true; }
      } catch (e) { /* keep the file / default logo */ }
    }
    return L.send(res, 200, { logo, custom });
  }

  if (req.method === 'POST') {
    const problem = L.configProblem();
    if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });
    const session = L.getSession(req);
    if (!session) return L.send(res, 401, { error: 'unauthorized' });
    if (session.role !== 'admin') {
      return L.send(res, 403, { error: 'forbidden', message: 'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل' });
    }
    try {
      const body = L.parseBody(req);
      if (!body) throw new Error('invalid body');
      if (body.reset === true) {
        await L.getRedis().del(LOGO_KEY);
        return L.send(res, 200, { ok: true });
      }
      const logo = body.logo;
      if (typeof logo !== 'string' || logo.length > MAX_LEN || !DATA_RE.test(logo)) throw new Error('invalid logo');
      await L.getRedis().set(LOGO_KEY, logo);
      return L.send(res, 200, { ok: true });
    } catch (e) {
      return L.send(res, 400, { ok: false, error: 'bad_request', message: 'صورة غير صالحة أو كبيرة جدا' });
    }
  }

  L.send(res, 405, { error: 'method_not_allowed' });
};
