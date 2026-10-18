// /api/backups  (admin only) — automatic and manual snapshots of the shared sheet
//   GET                                   -> {backups:[{ts,reason,weekFrom,students,absences,phones}], now:{students,absences,phones}}
//   POST {action:'snapshot'}              -> take a snapshot of the current sheet now
//   POST {action:'restore', ts, mode}     -> mode 'merge' (default): give the CURRENT students back their absences
//                                            (same week) and phones from that snapshot, matched by name;
//                                            mode 'full': put the snapshot back as the whole sheet.
//        The current sheet is snapshotted first, so a restore can itself be undone.
const L = require('./_lib');
const B = require('./_backup');
const { archiveWeek } = require('./_stats');

const STATE_KEY = L.PREFIX + ':state';

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });
  const session = L.getSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });
  if (session.role !== 'admin') return L.send(res, 403, { error: 'forbidden', message: 'هذه الصفحة مخصّصة للمسؤول' });
  const redis = L.getRedis();
  try {
    if (req.method === 'GET') {
      const idx = await B.readIndex(redis, L.PREFIX);
      const cur = await redis.get(STATE_KEY);
      return L.send(res, 200, { backups: idx.slice().reverse(), now: B.stats(cur) });
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method_not_allowed' });
    const body = L.parseBody(req) || {};
    return await L.withLock('state', async () => {
      const cur = await redis.get(STATE_KEY);
      if (body.action === 'snapshot') {
        if (!cur) return L.send(res, 409, { error: 'no_state', message: 'لا توجد ورقة محفوظة بعد' });
        const e = await B.maybeSnapshot(redis, L.PREFIX, cur, cur, true);
        return L.send(res, 200, { ok: true, entry: e });
      }
      if (body.action === 'restore') {
        const ts = Number(body.ts);
        const idx = await B.readIndex(redis, L.PREFIX);
        if (!idx.some((e) => e.ts === ts)) return L.send(res, 404, { error: 'not_found', message: 'هذه النسخة لم تعد موجودة' });
        const snap = await redis.get(B.snapKey(L.PREFIX, ts));
        if (!snap || !snap.data) return L.send(res, 404, { error: 'not_found', message: 'هذه النسخة لم تعد موجودة' });
        if (cur) await B.maybeSnapshot(redis, L.PREFIX, cur, cur, true); // so that this restore can be undone
        let next, info = {};
        if (body.mode === 'full' || !cur) {
          next = snap;
        } else {
          next = cur;
          info = B.mergeFromSnapshot(next, snap);
        }
        await redis.set(STATE_KEY, next);
        try { await archiveWeek(redis, L.PREFIX, next); } catch (e) { /* the sheet itself is restored */ }
        return L.send(res, 200, { ok: true, mode: body.mode === 'full' || !cur ? 'full' : 'merge', ...info });
      }
      return L.send(res, 400, { error: 'bad_action' });
    });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error' });
  }
};
