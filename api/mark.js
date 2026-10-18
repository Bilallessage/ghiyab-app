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
// POST {action:'called', cls, ci, value:true|false} = roll call done with NOBODY absent in that period («لا أحد»):
//   stored as cls.columns[ci].called = {at, by} so the administration can see the teacher did the roll call.
//   It needs the same rights as recording an absence in that period and is refused while an absence is recorded in it;
//   recording an absence in the period later cancels it.
// Both writes accept `at` (epoch ms): a teacher whose phone had no connection sends what was tapped while offline
//   later, and the time rules (today / period started) are checked against the moment of the tap, not of the delivery.
//   `at` is accepted only if it is not in the future and at most MAX_AGE old (teachers only; the admin has no time rules).
const L = require('./_lib');
const S = require('./_stats');

const STATE_KEY = L.PREFIX + ':state';
const TZ = 'Africa/Casablanca';

function todayIso(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
}

// Same teacher written differently on the sheet and on the account: "نعيمة بداوي" / "بداوي نعيمة" /
// "ذ. نعيمة  بداوي" / "نعيمه بداوى". Compare word by word, ignoring order, spaces, dots, diacritics,
// the alef / ya / ta-marbuta spellings and Latin accents. Every word of the shorter name must be in the other.
function words(s) {
  return String(s || '').normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640\u0300-\u036f]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function sameTeacher(a, b) {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  return small.every((w) => big.includes(w));
}
// student names: spaces / case only
function norm(s) { return words(s).join(''); }

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

const MAX_AGE = 18 * 3600 * 1000;   // a tap made offline is still accepted for 18 hours
// the moment a teacher's tap happened: `at` when it is a plausible past time, otherwise now
function tapTime(at) {
  const now = Date.now();
  if (typeof at !== 'number' || !isFinite(at)) return { ok: true, d: new Date(now), late: false };
  if (at > now + 120000) return { ok: false, message: 'ساعة الجهاز غير صحيحة، صحّحوا التاريخ والوقت ثم أعيدوا المحاولة' };
  if (now - at > MAX_AGE) return { ok: false, message: 'مضى وقت طويل على هذا التسجيل (أكثر من 18 ساعة) فلم يُقبل. أخبروا المسؤول ليسجّله.' };
  return { ok: true, d: new Date(Math.min(at, now)), late: now - at > 60000 };
}

function fail(res, code, error, message) { return L.send(res, code, { ok: false, error, message }); }

// The rules a teacher is bound by for column ci (same for an absence and for «لا أحد»). Returns a failure
// description or null. `d` = the moment of the tap.
function teacherRules(state, cls, pc, W, ci, session, d, needStarted) {
  const monday = S.mondayOf(state.weekFrom);
  if (!monday) return ['conflict', 409, 'no_week', 'الأسبوع غير محدد في الورقة'];
  const breaks = Array.isArray(state.breaks) ? state.breaks : S.DEFAULT_BREAKS;
  if (breaks.some((x) => x && S.validIso(x.from) && S.validIso(x.to) && state.weekFrom >= x.from && state.weekFrom <= x.to)) {
    return ['x', 403, 'break', 'هذا الأسبوع عطلة، لا يُسجَّل فيه غياب'];
  }
  const colDate = S.addDays(monday, Math.floor(ci / W));
  if (colDate !== todayIso(d)) return ['x', 403, 'not_today', 'يمكن تسجيل غياب حصص اليوم فقط'];
  if (needStarted && nowMinutes(d) < startMinutes(state, cls, pc, ci)) {
    return ['x', 403, 'not_started', 'هذه الحصة لم يحن وقتها بعد'];
  }
  if (session.teacher) {
    const have = cls.columns && cls.columns[ci] && cls.columns[ci].teacher;
    if (!sameTeacher(session.teacher, have)) {
      return ['x', 403, 'not_yours', 'هذه الحصة ليست من حصصكم: اسم الأستاذ(ة) المكتوب فيها «' + (String(have || '').trim() || '—') + '» واسم حسابكم «' + session.teacher + '».'];
    }
  }
  return null;
}

// Roll call with nobody absent in one period.
async function calledAction(res, session, b, isAdmin) {
  const ci = b.ci;
  if (typeof b.cls !== 'string' || !Number.isInteger(ci) || ci < 0 || (b.value !== true && b.value !== false)) return fail(res, 400, 'bad_request', 'طلب غير صالح');
  const tap = isAdmin ? { ok: true, d: new Date() } : tapTime(b.at);
  if (!tap.ok) return fail(res, 403, 'too_old', tap.message);
  const redis = L.getRedis();
  try {
    return await L.withLock('state', async () => {
      const state = await redis.get(STATE_KEY);
      if (!state || !Array.isArray(state.classNames) || !state.data) return fail(res, 409, 'no_state', 'لا توجد ورقة محفوظة بعد');
      const cls = state.data[b.cls];
      if (!state.classNames.includes(b.cls) || !cls || !Array.isArray(cls.names)) return fail(res, 404, 'no_class', 'القسم غير موجود');
      const pc = S.periodCounts(state), W = pc[0] + pc[1];
      if (ci >= 5 * W) return fail(res, 400, 'bad_column', 'حصة غير موجودة');
      if (!isAdmin) {
        const bad = teacherRules(state, cls, pc, W, ci, session, tap.d, b.value === true);
        if (bad) return fail(res, bad[1], bad[2], bad[3]);
      }
      if (!Array.isArray(cls.columns)) cls.columns = [];
      while (cls.columns.length <= ci) cls.columns.push({ subject: '', teacher: '' });
      const col = cls.columns[ci] && typeof cls.columns[ci] === 'object' ? cls.columns[ci] : (cls.columns[ci] = { subject: '', teacher: '' });
      if (b.value === true) {
        const n = (cls.absences || []).filter((r) => Array.isArray(r) && r[ci]).length;
        if (n) return fail(res, 409, 'has_absences', 'سُجّل غياب في هذه الحصة، فلا يصحّ التصريح بأنه «لا أحد».');
        col.called = { at: tap.d.getTime(), by: String(session.teacher || session.email || '').slice(0, 80) };
      } else {
        delete col.called;
      }
      await redis.set(STATE_KEY, state);
      return L.send(res, 200, { ok: true, value: b.value });
    });
  } catch (e) {
    return fail(res, 500, 'server_error', 'خطأ في الخادم، أعيدوا المحاولة');
  }
}

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
  if (b.action === 'called') return calledAction(res, session, b, isAdmin);
  const si = b.si, ci = b.ci;
  if (typeof b.cls !== 'string' || typeof b.name !== 'string' || !Number.isInteger(si) || !Number.isInteger(ci) || si < 0 || ci < 0) {
    return fail(res, 400, 'bad_request', 'طلب غير صالح');
  }
  let value = b.value;
  if (value !== false && value !== true && value !== 'j') return fail(res, 400, 'bad_request', 'قيمة غير صالحة');
  if (value === 'j' && !isAdmin) return fail(res, 403, 'forbidden', 'تبرير الغياب من اختصاص المسؤول');

  const tap = isAdmin ? { ok: true, d: new Date() } : tapTime(b.at);
  if (!tap.ok) return fail(res, 403, 'too_old', tap.message);
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
        const bad = teacherRules(state, cls, pc, W, ci, session, tap.d, value === true);
        if (bad) return fail(res, bad[1], bad[2], bad[3]);
      }

      if (!Array.isArray(cls.absences)) cls.absences = [];
      if (!Array.isArray(cls.absences[si])) cls.absences[si] = [];
      const row = cls.absences[si];
      while (row.length < 5 * W) row.push(false);
      if (!isAdmin && row[ci] === 'j') return fail(res, 403, 'justified', 'هذا الغياب مبرَّر من المسؤول ولا يمكن تغييره');
      row[ci] = value;
      if (value && cls.columns && cls.columns[ci] && cls.columns[ci].called) delete cls.columns[ci].called;   // an absence is recorded: «لا أحد» no longer holds
      await redis.set(STATE_KEY, state);
      try { await S.archiveWeek(redis, L.PREFIX, state); } catch (e) { /* the sheet itself is saved */ }
      return L.send(res, 200, { ok: true, value });
    });
  } catch (e) {
    return fail(res, 500, 'server_error', 'خطأ في الخادم، أعيدوا المحاولة');
  }
};
