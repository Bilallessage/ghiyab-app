// Vercel serverless function: GET/POST /api/state
// Stores the whole sheet as one JSON value in Upstash Redis.
//   GET  -> any logged-in account (admin or viewer)
//   POST -> the admin only (viewers get 403, anonymous callers get 401)
const L = require('./_lib');
const { buildSeedState } = require('./_seed');

const STATE_KEY = L.PREFIX + ':state';

function looksLikeState(d) {
  return d && typeof d === 'object' &&
    Array.isArray(d.classNames) && d.classNames.length > 0 && d.classNames.length <= 100 &&
    d.classNames.every((c) => typeof c === 'string') &&
    d.data && typeof d.data === 'object' && !Array.isArray(d.data);
}

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  const session = L.getSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });

  const redis = L.getRedis();

  if (req.method === 'GET') {
    try {
      const stored = await redis.get(STATE_KEY);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // Fresh deployment: hand out the default class lists (kept server side).
      res.status(200).send(JSON.stringify(stored || buildSeedState()));
    } catch (e) {
      L.send(res, 500, { error: 'server_error' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (session.role !== 'admin') {
      return L.send(res, 403, { error: 'forbidden', message: 'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل' });
    }
    try {
      const data = L.parseBody(req);
      if (!looksLikeState(data)) throw new Error('invalid body');
      await redis.set(STATE_KEY, data);
      L.send(res, 200, { ok: true });
    } catch (e) {
      L.send(res, 400, { ok: false, error: 'bad_request' });
    }
    return;
  }

  L.send(res, 405, { error: 'method_not_allowed' });
};
