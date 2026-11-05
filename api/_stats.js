// Weekly absence summaries, used for the daily / weekly / monthly statistics.
//
// The sheet itself only ever holds ONE week. Every time the admin saves it, a
// compact summary of that week is also stored (one hash field per week, keyed
// by the Monday of the week), so past weeks stay available for statistics
// without making the polled sheet any bigger.
//
// Column layout of the sheet: 5 days x (morning periods + evening periods).
// state.pc = [morning, evening] (default [3,3] = 30 columns), so day d
// (0 = Monday) owns columns d*W .. d*W+W-1 with W = morning + evening.
// The layout used is stored in every class summary (`pc`) so older weeks
// saved with another number of periods are still read correctly.

const DAYS = 5;
// same default as DEFAULT_BREAKS in index.html (used while the saved state has no `breaks` list yet)
const DEFAULT_BREAKS = [
  { from: '2026-10-19', to: '2026-10-23', label: 'عطلة بينية' },
  { from: '2026-12-07', to: '2026-12-11', label: 'عطلة بينية' },
  { from: '2027-01-25', to: '2027-01-29', label: 'عطلة منتصف السنة الدراسية' },
  { from: '2027-03-22', to: '2027-03-26', label: 'عطلة بينية' },
  { from: '2027-05-10', to: '2027-05-14', label: 'عطلة بينية' },
];
// one-day holidays (same default as DEFAULT_HOLIDAYS in index.html; the training site, SEED_DEMO, has none)
const DEFAULT_HOLIDAYS = [
  { date: '2026-10-31', label: 'عيد الوحدة' },
  { date: '2026-11-06', label: 'ذكرى المسيرة الخضراء' },
  { date: '2026-11-18', label: 'عيد الاستقلال' },
  { date: '2027-01-01', label: 'فاتح السنة الميلادية' },
  { date: '2027-01-11', label: 'ذكرى تقديم وثيقة الاستقلال' },
  { date: '2027-01-14', label: 'فاتح السنة الأمازيغية' },
  { date: '2027-05-01', label: 'عيد الشغل' },
];
function holidayOn(state, iso) {
  const list = Array.isArray(state && state.holidays) ? state.holidays : (process.env.SEED_DEMO ? [] : DEFAULT_HOLIDAYS);
  return list.find((h) => h && validIso(h.date) && h.date === iso) || null;
}
const DEFAULT_PC = [3, 3];
const MAX_PC = 8;

function periodCounts(state) {
  const p = state && state.pc;
  const ok = Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_PC) && p[0] + p[1] >= 1;
  return ok ? [p[0], p[1]] : DEFAULT_PC.slice();
}

function validIso(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Monday of the school week that a "from" date belongs to. A Saturday or
// Sunday means the week that starts on the following Monday.
function mondayOf(iso) {
  if (!validIso(iso)) return null;
  const dow = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
  if (dow === 6) return addDays(iso, 2);
  if (dow === 0) return addDays(iso, 1);
  return addDays(iso, -(dow - 1));
}

// "1AIPC-2" -> "1AIPC"; a name without a trailing number stays as it is.
function deriveLevel(name) {
  const n = String(name || '').trim();
  const base = n.replace(/[\s\-–_/.]*\d+$/, '').trim();
  return base || n;
}

function summarizeState(state) {
  if (!state || !Array.isArray(state.classNames)) return null;
  const weekStart = mondayOf(state.weekFrom);
  if (!weekStart) return null;
  // an inter-term holiday week («عطلة بينية») holds nothing and stays out of the statistics
  const breaks = Array.isArray(state.breaks) ? state.breaks : DEFAULT_BREAKS;
  if (validIso(state.weekFrom) && breaks.some((b) => b && validIso(b.from) && validIso(b.to) && state.weekFrom >= b.from && state.weekFrom <= b.to)) return null;
  const classes = {};
  for (const c of state.classNames) {
    const cls = state.data && state.data[c];
    if (!cls) continue;
    const names = Array.isArray(cls.names) ? cls.names : [];
    const abs = Array.isArray(cls.absences) ? cls.absences : [];
    const pc = periodCounts(state);
    const PER_DAY = pc[0] + pc[1];
    const COLS = DAYS * PER_DAY;
    const cols = Array(COLS).fill(0);
    const colsJ = Array(COLS).fill(0); // of which justified (مبرر)
    const dayStudents = Array(DAYS).fill(0);
    const holDay = Array.from({ length: DAYS }, (_, d) => !!holidayOn(state, addDays(weekStart, d))); // a one-day holiday counts nothing
    let weekStudents = 0;
    const absList = []; // [name, "0102…" one digit per column: 0 present, 1 absent, 2 justified absence] for every student with at least one absence
    for (let si = 0; si < names.length; si++) {
      const row = Array.isArray(abs[si]) ? abs[si] : [];
      const dayHit = Array(DAYS).fill(false);
      let any = false;
      for (let i = 0; i < COLS; i++) {
        if (row[i] && !holDay[Math.floor(i / PER_DAY)]) { cols[i]++; if (row[i] === 'j') colsJ[i]++; dayHit[Math.floor(i / PER_DAY)] = true; any = true; }
      }
      for (let d = 0; d < DAYS; d++) if (dayHit[d]) dayStudents[d]++;
      if (any) {
        weekStudents++;
        let bits = '';
        for (let i = 0; i < COLS; i++) bits += holDay[Math.floor(i / PER_DAY)] ? '0' : row[i] === 'j' ? '2' : row[i] ? '1' : '0'; // 1 = absent, 2 = absent and justified
        absList.push([String(names[si] == null ? '' : names[si]).trim().slice(0, 80), bits]);
      }
    }
    // subject / teacher of every column (the timetable of that week), so the catch-up list knows which subject was missed
    const colsInfo = Array.isArray(cls.columns) ? cls.columns : [];
    const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 40);
    const subj = [], tch = [];
    for (let i = 0; i < COLS; i++) {
      const ci = colsInfo[i] && typeof colsInfo[i] === 'object' ? colsInfo[i] : {};
      subj.push(clean(ci.subject));
      tch.push(clean(ci.teacher));
    }
    const custom = state.levels && typeof state.levels[c] === 'string' ? state.levels[c].trim() : '';
    classes[c] = {
      pc,
      level: custom || deriveLevel(c),
      students: names.length,
      cols,
      colsJ,
      dayStudents,
      weekStudents,
      abs: absList,
      subj,
      tch,
    };
  }
  return {
    weekStart,
    weekFrom: state.weekFrom,
    weekTo: validIso(state.weekTo) ? state.weekTo : '',
    updated: Date.now(),
    classes,
  };
}

function historyKey(prefix) { return prefix + ':history'; }

// Store/refresh the summary of the sheet's current week (no-op without a date).
async function archiveWeek(redis, prefix, state) {
  const snap = summarizeState(state);
  if (!snap) return false;
  // a week that has not started yet (shown by typing its date) and holds no absence is not archived: it would
  // only add an empty week to the statistics
  const todayMon = mondayOf(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  if (todayMon && snap.weekStart > todayMon && !Object.values(snap.classes).some((c) => c.weekStudents > 0)) return false;
  await redis.hset(historyKey(prefix), { [snap.weekStart]: snap });
  return true;
}

module.exports = { DEFAULT_HOLIDAYS, holidayOn, validIso, addDays, mondayOf, deriveLevel, summarizeState, archiveWeek, historyKey, periodCounts, DEFAULT_BREAKS };
