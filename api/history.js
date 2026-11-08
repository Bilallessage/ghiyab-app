// /api/history  (statistics source)
//   GET                  -> any logged-in account: {weeks:[...]} newest first. The
//                           week currently on the sheet is always included, computed
//                           live from the stored sheet (flagged current:true).
//   DELETE ?week=YYYY-MM-DD -> admin only: remove one archived week (its Monday).
//   POST {action:'rename',from,to} | {action:'removeClass',cls,week?} | {action:'removeStudent',cls,week,name}
//                        -> admin only: edit the archive (class renamed on the sheet, absences recorded by mistake).
const L = require('./_lib');
const S = require('./_stats');

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  const session = await L.getActiveSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });

  const redis = L.getRedis();
  const key = S.historyKey(L.PREFIX);

  try {
    if (req.method === 'GET') {
      const all = (await redis.hgetall(key)) || {};
      const byWeek = {};
      for (const [k, v] of Object.entries(all)) {
        let snap = v;
        if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { continue; } }
        if (snap && S.validIso(snap.weekStart) && snap.classes && typeof snap.classes === 'object') byWeek[k] = snap;
      }
      const stored = await redis.get(L.PREFIX + ':state');
      const live = S.summarizeState(stored);
      if (live) { live.current = true; byWeek[live.weekStart] = live; }
      const weeks = Object.values(byWeek).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
      return L.send(res, 200, { weeks });
    }

    if (req.method === 'DELETE') {
      if (session.role !== 'admin') {
        return L.send(res, 403, { error: 'forbidden', message: 'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل' });
      }
      const week = String((req.query && req.query.week) || (L.parseBody(req) || {}).week || '');
      if (!S.validIso(week)) return L.send(res, 400, { error: 'bad_request' });
      await redis.hdel(key, week);
      return L.send(res, 200, { ok: true });
    }

    if (req.method === 'POST') {
      if (session.role !== 'admin') {
        return L.send(res, 403, { error: 'forbidden', message: 'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل' });
      }
      const b = L.parseBody(req) || {};
      if (!['rename', 'removeClass', 'removeStudent'].includes(b.action)) return L.send(res, 400, { error: 'bad_request' });
      if (b.week != null && b.week !== '' && !S.validIso(String(b.week))) return L.send(res, 400, { error: 'bad_request' });
      if (b.action === 'removeStudent' && !b.week) return L.send(res, 400, { error: 'bad_request' });
      const changed = await S.editHistory(redis, L.PREFIX, { action: b.action, from: b.from, to: b.to, cls: b.cls, name: b.name, week: b.week ? String(b.week) : '' });
      return L.send(res, 200, { ok: true, changed });
    }

    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error' });
  }
};
