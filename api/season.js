// /api/season  (school-year archive)
//   GET               -> any logged-in account: {seasons:[{label,archivedAt,weeks}]} newest first.
//   GET ?label=YYYY/YYYY -> {label,archivedAt,weeks:[...]} (the weekly summaries of that season,
//                           same shape as /api/history, newest week first).
//   POST {action:'archive', label} -> admin only: moves every week recorded in the statistics
//                           history (plus the week now on the sheet) into the archive of that
//                           season and empties the history, so the statistics start from zero.
//                           The sheet itself is reset by the page right after (see archiveSeason()).
//   DELETE ?label=...  -> admin only: remove one archived season.
const L = require('./_lib');
const S = require('./_stats');

const META_KEY = L.PREFIX + ':seasons';
const seasonKey = (label) => L.PREFIX + ':season:' + label.replace('/', '-');
const validLabel = (s) => typeof s === 'string' && /^\d{4}\/\d{4}$/.test(s) && +s.slice(5) === +s.slice(0, 4) + 1;

function parseSnap(v) {
  let snap = v;
  if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { return null; } }
  return snap && S.validIso(snap.weekStart) && snap.classes && typeof snap.classes === 'object' ? snap : null;
}
function parseMeta(v) {
  let m = v;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return null; } }
  return m && typeof m === 'object' ? m : null;
}

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  const session = await L.getActiveSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });
  const admin = session.role === 'admin';
  const redis = L.getRedis();
  const query = req.query || {};

  try {
    if (req.method === 'GET') {
      const label = String(query.label || '');
      if (!label) {
        const all = (await redis.hgetall(META_KEY)) || {};
        const seasons = Object.values(all).map(parseMeta).filter((m) => m && validLabel(m.label))
          .map((m) => ({ label: m.label, archivedAt: m.archivedAt || 0, weeks: m.weeks || 0 }))
          .sort((a, b) => (a.label < b.label ? 1 : -1));
        return L.send(res, 200, { seasons });
      }
      if (!validLabel(label)) return L.send(res, 400, { error: 'bad_request' });
      const meta = parseMeta(await redis.hget(META_KEY, label));
      if (!meta) return L.send(res, 404, { error: 'not_found' });
      const all = (await redis.hgetall(seasonKey(label))) || {};
      const weeks = Object.values(all).map(parseSnap).filter(Boolean).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
      return L.send(res, 200, { label, archivedAt: meta.archivedAt || 0, weeks });
    }

    if (!admin) return L.send(res, 403, { error: 'forbidden', message: 'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل' });

    if (req.method === 'POST') {
      const body = L.parseBody(req) || {};
      if (body.action !== 'archive') return L.send(res, 400, { error: 'bad_request' });
      const label = String(body.label || '');
      if (!validLabel(label)) return L.send(res, 400, { error: 'bad_label', message: 'صيغة الموسم غير صحيحة، اكتبوها هكذا: 2026/2027' });
      if (await redis.hget(META_KEY, label)) {
        return L.send(res, 409, { error: 'exists', message: 'الموسم ' + label + ' مؤرشف من قبل.' });
      }
      const hKey = S.historyKey(L.PREFIX);
      const all = (await redis.hgetall(hKey)) || {};
      const byWeek = {};
      for (const [k, v] of Object.entries(all)) { const s = parseSnap(v); if (s) byWeek[s.weekStart] = s; }
      // the week on the sheet is archived too (it may not have been summarised yet)
      const live = S.summarizeState(await redis.get(L.PREFIX + ':state'));
      if (live) byWeek[live.weekStart] = live;
      const weeks = Object.values(byWeek);
      if (!weeks.length) return L.send(res, 400, { error: 'empty', message: 'لا توجد أسابيع مسجّلة لأرشفتها.' });
      const sKey = seasonKey(label);
      const entries = {};
      weeks.forEach((w) => { entries[w.weekStart] = w; });
      await redis.hset(sKey, entries);
      await redis.hset(META_KEY, { [label]: { label, archivedAt: Date.now(), weeks: weeks.length } });
      const keys = Object.keys(all);
      if (keys.length) await redis.hdel(hKey, ...keys);
      return L.send(res, 200, { ok: true, label, weeks: weeks.length });
    }

    if (req.method === 'DELETE') {
      const label = String(query.label || (L.parseBody(req) || {}).label || '');
      if (!validLabel(label)) return L.send(res, 400, { error: 'bad_request' });
      await redis.del(seasonKey(label));
      await redis.hdel(META_KEY, label);
      return L.send(res, 200, { ok: true });
    }

    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error' });
  }
};
