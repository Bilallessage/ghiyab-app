// /api/users  (admin only) — approve the sign-up requests for viewer accounts
//   GET             -> {pending:[{email,createdAt}]}
//   GET ?all=1      -> also {viewers:[{email,createdAt}]}: the approved viewer accounts
//   POST {action:'approve'|'reject'|'remove', email}
//        approve: the pending account may now log in (read-only)
//        reject : delete a pending request
//        remove : delete an approved viewer (its token stops working within a minute)
const L = require('./_lib');

const MAX_VIEWERS_LISTED = 500;

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  const session = L.getSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });
  if (session.role !== 'admin') {
    return L.send(res, 403, { error: 'forbidden', message: 'هذه الصفحة مخصّصة للمسؤول' });
  }
  const redis = L.getRedis();

  try {
    if (req.method === 'GET') {
      const raw = (await redis.hgetall(L.PENDING_KEY)) || {};
      const pending = Object.entries(raw)
        .map(([email, t]) => ({ email, createdAt: Number(t) || 0 }))
        .sort((a, b) => a.createdAt - b.createdAt);
      const out = { pending };
      if (req.query && req.query.all) {
        const viewers = [];
        let cursor = '0';
        const match = L.PREFIX + ':user:*';
        do {
          const r = await redis.scan(cursor, { match, count: 200 });
          cursor = String(r[0]);
          for (const k of r[1]) {
            if (viewers.length >= MAX_VIEWERS_LISTED) break;
            const u = await redis.get(k);
            if (u && u.email && u.status !== 'pending') viewers.push({ email: u.email, createdAt: u.createdAt || 0 });
          }
        } while (cursor !== '0' && viewers.length < MAX_VIEWERS_LISTED);
        viewers.sort((a, b) => (a.email < b.email ? -1 : 1));
        out.viewers = viewers;
      }
      return L.send(res, 200, out);
    }

    if (req.method === 'POST') {
      const body = L.parseBody(req) || {};
      const email = L.normalizeEmail(body.email);
      if (!L.validEmail(email) || email === L.ADMIN_EMAIL) return L.send(res, 400, { error: 'bad_request' });
      const key = L.userKey(email);
      const user = await redis.get(key);
      if (!user) {
        await redis.hdel(L.PENDING_KEY, email);
        return L.send(res, 404, { error: 'not_found', message: 'لا يوجد حساب بهذا البريد (ربما عولج الطلب من قبل)' });
      }
      if (body.action === 'approve') {
        await redis.set(key, Object.assign({}, user, { status: 'approved', approvedAt: Date.now() }));
        await redis.hdel(L.PENDING_KEY, email);
      } else if (body.action === 'reject') {
        if (user.status !== 'pending') return L.send(res, 400, { error: 'not_pending', message: 'هذا الحساب مقبول من قبل، استعملوا «إزالة»' });
        await redis.del(key);
        await redis.hdel(L.PENDING_KEY, email);
      } else if (body.action === 'remove') {
        await redis.del(key);
        await redis.hdel(L.PENDING_KEY, email);
      } else {
        return L.send(res, 400, { error: 'bad_action' });
      }
      L.forgetViewer(email);
      return L.send(res, 200, { ok: true });
    }

    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error' });
  }
};
