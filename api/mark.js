// POST /api/mark  {cls, si, name, ci, value}
// Records (value:true) or removes (value:false) ONE absence cell of the shared sheet. This
// is the only write a TEACHER account may do (the whole-sheet POST /api/state stays
// admin-only). The server enforces every rule, the page only hides controls:
//   - the week on the sheet must be the current one and not an inter-term holiday week;
//   - only a column of TODAY (school time, Africa/Casablanca) can be changed;
//   - when the admin gave the account a teacher name, only columns whose «الأستاذ(ة)»
//     field contains that name;
//   - a period that has not started yet cannot get an absence (start times as on the sheet);
//   - a justified absence («م») is the administrator's decision: a teacher can neither
//     create nor remove one;
//   - `name` must match the student at index `si` (a list that changed in the meantime
//     must never mark the wrong child).
// The admin may use it too (any column, justified allowed).
// POST {action:'addstudent', cls, name} adds a student (name only) for a teacher or the admin.
const L = require('./_lib');
const S = require('./_stats');

const STATE_KEY = L.PREFIX + ':state';
const TZ = 'Africa/Casablanca';

function todayIso(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
}

// "أ. نعيمة  بداوي" vs "نعيمة بداوي": compare without spaces, dots, diacritics, case
function norm(s) {
  return String(s || '').normalize('NFKD').replace(/[ً-ٰٟـ]/g, '').replace(/[\s.\-_'’]+/g, '').toLowerCase();
}

function validTimes(t, pc) {
  return Array.isArray(t) && t.length === 2 && t.every((r, s) => Array.isArray(r) && r.length === pc[s] && r.every((x) => /^\d{1,2}:\d{2}$/.test(x)));
}
// start of column ci, in minutes since midnight (same rules as periodTimes() in index.html)
function startMinutes(state, cls, pc, ci) {
  const W = pc[0] + pc[1], r = ci % W, s = r < pc[0] ? 0 : 1, p = s ? r - pc[0] : r;
  let t = null;
  if (validTimes(cls.times, pc)) t = cls.times;
  else if (validTimes(state.periodTimes, pc)) t = state.periodTimes;
  const x = t ? t[s][p] : (s ? 14 : 8) * 60 + p * 60;
  if (typeof x === 'number') return x;
  const [h, m] = x.split(':').map(Number);
  return h * 60 + m;
}
function nowMinutes(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now || new Date());
  const g = (t) => Number((parts.find((x) => x.type === t) || {}).value);
  return g('hour') * 60 + g('minute');
}

function fail(res, code, error, message) { return L.send(res, code, { ok: false, error, message }); }

// A teacher may ADD a student to a class (name only: no phone, no deletion, no renaming).
async function addStudent(res, session, b) {
  const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
  if (typeof b.cls !== 'string' || !name || name.length > 80) return fail(res, 400, 'bad_request', 'اسم التلميذ غير صالح');
  const redis = L.getRedis();
  try {
    return await L.withLock('state', async () => {
      const state = await redis.get(STATE_KEY);
      if (!state || !Array.isArray(state.classNames) || !state.data) return fail(res, 409, 'no_state', 'لا توجد ورقة محفوظة بعد');
      const cls = state.data[b.cls];
      if (!state.classNames.includes(b.cls) || !cls || !Array.isArray(cls.names)) return fail(res, 404, 'no_class', 'القسم غير موجود');
      if (cls.names.length >= 200) return fail(res, 400, 'too_many', 'عدد التلاميذ في القسم بلغ الحد الأقصى');
      const key = norm(name);
      if (cls.names.some((x) => norm(x) === key)) return fail(res, 409, 'exists', 'هذا التلميذ موجود في القسم بالفعل');
      const W = S.periodCounts(state);
      const cols = 5 * (W[0] + W[1]);
      if (!Array.isArray(cls.absences)) cls.absences = [];
      if (!Array.isArray(cls.phones)) cls.phones = [];
      while (cls.absences.length < cls.names.length) cls.absences.push(Array(cols).fill(false));
      while (cls.phones.length < cls.names.length) cls.phones.push('');
      cls.names.push(name);
      cls.absences.push(Array(cols).fill(false));
      cls.phones.push('');
      await redis.set(STATE_KEY, state);
      return L.send(res, 200, { ok: true });
    });
  } catch (e) {
    return fail(res, 500, 'server_error', 'خطأ في الخادم، أعيدوا المحاولة');
  }
}

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method_not_allowed' });

  const session = await L.getActiveSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });
  if (session.role !== 'admin' && session.role !== 'teacher') {
    return fail(res, 403, 'forbidden', 'حسابكم للاطلاع فقط، ولا يملك صلاحية تسجيل الغياب');
  }
  const isAdmin = session.role === 'admin';

  const b = L.parseBody(req) || {};
  if (b.action === 'addstudent') return addStudent(res, session, b);
  const si = b.si, ci = b.ci;
  if (typeof b.cls !== 'string' || typeof b.name !== 'string' || !Number.isInteger(si) || !Number.isInteger(ci) || si < 0 || ci < 0) {
    return fail(res, 400, 'bad_request', 'طلب غير صالح');
  }
  let value = b.value;
  if (value !== false && value !== true && value !== 'j') return fail(res, 400, 'bad_request', 'قيمة غير صالحة');
  if (value === 'j' && !isAdmin) return fail(res, 403, 'forbidden', 'تبرير الغياب من اختصاص المسؤول');

  const redis = L.getRedis();
  try {
    return await L.withLock('state', async () => {
      const state = await redis.get(STATE_KEY);
      if (!state || !Array.isArray(state.classNames) || !state.data) return fail(res, 409, 'no_state', 'لا توجد ورقة محفوظة بعد');
      const cls = state.data[b.cls];
      if (!state.classNames.includes(b.cls) || !cls || !Array.isArray(cls.names)) return fail(res, 404, 'no_class', 'القسم غير موجود');
      if (cls.names[si] !== b.name) return fail(res, 409, 'stale', 'تغيّرت لائحة التلاميذ، حدّثوا الصفحة وأعيدوا المحاولة');
      const pc = S.periodCounts(state), W = pc[0] + pc[1];
      if (ci >= 5 * W) return fail(res, 400, 'bad_column', 'حصة غير موجودة');

      if (!isAdmin) {
        const monday = S.mondayOf(state.weekFrom);
        if (!monday) return fail(res, 409, 'no_week', 'الأسبوع غير محدد في الورقة');
        const breaks = Array.isArray(state.breaks) ? state.breaks : S.DEFAULT_BREAKS;
        if (breaks.some((x) => x && S.validIso(x.from) && S.validIso(x.to) && state.weekFrom >= x.from && state.weekFrom <= x.to)) {
          return fail(res, 403, 'break', 'هذا الأسبوع عطلة، لا يُسجَّل فيه غياب');
        }
        const colDate = S.addDays(monday, Math.floor(ci / W));
        if (colDate !== todayIso()) return fail(res, 403, 'not_today', 'يمكن تسجيل غياب حصص اليوم فقط');
        if (value === true && nowMinutes() < startMinutes(state, cls, pc, ci)) {
          return fail(res, 403, 'not_started', 'هذه الحصة لم يحن وقتها بعد');
        }
        if (session.teacher) {
          const want = norm(session.teacher), have = norm(cls.columns && cls.columns[ci] && cls.columns[ci].teacher);
          if (!want || !have || !(have.includes(want) || want.includes(have))) {
            return fail(res, 403, 'not_yours', 'هذه الحصة ليست من حصصكم');
          }
        }
      }

      if (!Array.isArray(cls.absences)) cls.absences = [];
      if (!Array.isArray(cls.absences[si])) cls.absences[si] = [];
      const row = cls.absences[si];
      while (row.length < 5 * W) row.push(false);
      if (!isAdmin && row[ci] === 'j') return fail(res, 403, 'justified', 'هذا الغياب مبرَّر من المسؤول ولا يمكن تغييره');
      row[ci] = value;
      await redis.set(STATE_KEY, state);
      try { await S.archiveWeek(redis, L.PREFIX, state); } catch (e) { /* the sheet itself is saved */ }
      return L.send(res, 200, { ok: true, value });
    });
  } catch (e) {
    return fail(res, 500, 'server_error', 'خطأ في الخادم، أعيدوا المحاولة');
  }
};
