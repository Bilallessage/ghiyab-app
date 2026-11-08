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
  // A PAST week shown on the sheet is rebuilt from this archive by student name, so the absences of a student who is no
  // longer in the class list (deleted, renamed, list replaced) and of a class that no longer exists cannot be on the
  // sheet. Saving that week must not wipe them from the archive: keep what the sheet cannot show.
  if (todayMon && snap.weekStart < todayMon) {
    try { keepOrphans(snap, await redis.hget(historyKey(prefix), snap.weekStart), state); } catch (e) { /* never block saving */ }
  }
  await redis.hset(historyKey(prefix), { [snap.weekStart]: snap });
  return true;
}

// Put back into the new summary `snap` what the stored summary `old` of the same week holds and the sheet cannot hold.
function keepOrphans(snap, old, state) {
  if (typeof old === 'string') { try { old = JSON.parse(old); } catch (e) { return; } }
  if (!old || typeof old !== 'object' || !old.classes || typeof old.classes !== 'object') return;
  for (const c of Object.keys(old.classes)) {
    const o = old.classes[c];
    if (!o || typeof o !== 'object') continue;
    const n = snap.classes[c];
    if (!n) { snap.classes[c] = o; continue; }            // a class that is not on the sheet any more
    if (!Array.isArray(o.abs) || !o.abs.length || !Array.isArray(n.abs)) continue;
    const cls = state.data && state.data[c];
    const names = new Set((cls && Array.isArray(cls.names) ? cls.names : []).map((x) => String(x == null ? '' : x).trim().slice(0, 80)));
    const COLS = n.cols.length;
    const extra = o.abs.filter((a) => Array.isArray(a) && typeof a[0] === 'string' && typeof a[1] === 'string' && a[1].length === COLS && !names.has(a[0]));
    if (!extra.length) continue;
    n.abs = n.abs.concat(extra);
    const PER_DAY = COLS / DAYS;
    for (const [, bits] of extra) {
      const hit = Array(DAYS).fill(false);
      for (let i = 0; i < COLS; i++) if (bits[i] !== '0') { n.cols[i]++; if (bits[i] === '2') n.colsJ[i]++; hit[Math.floor(i / PER_DAY)] = true; }
      hit.forEach((h, d) => { if (h) n.dayStudents[d]++; });
      n.weekStudents++;
    }
  }
}


// ---- editing the archive (administrator, from the statistics page) ---------------------------------------------
// Recompute the counters of one archived class from its list of absences (one digit per column: 0 present, 1 absent, 2 justified).
function recountClass(n) {
  const COLS = Array.isArray(n.cols) ? n.cols.length : 0;
  const PER_DAY = COLS / DAYS;
  n.abs = (Array.isArray(n.abs) ? n.abs : []).filter((a) => Array.isArray(a) && typeof a[1] === 'string' && a[1].length === COLS && /[12]/.test(a[1]));
  n.cols = Array(COLS).fill(0); n.colsJ = Array(COLS).fill(0); n.dayStudents = Array(DAYS).fill(0); n.weekStudents = 0;
  for (const [, bits] of n.abs) {
    const hit = Array(DAYS).fill(false);
    for (let i = 0; i < COLS; i++) if (bits[i] !== '0') { n.cols[i]++; if (bits[i] === '2') n.colsJ[i]++; hit[Math.floor(i / PER_DAY)] = true; }
    hit.forEach((h, d) => { if (h) n.dayStudents[d]++; });
    n.weekStudents++;
  }
  return n;
}
// Merge archived class `b` into `a` of the same week (same column layout): the stronger mark of the two wins per student and column.
function mergeClassSnap(a, b) {
  if (!a || !Array.isArray(a.cols) || !b || !Array.isArray(b.cols) || a.cols.length !== b.cols.length) return null;
  const by = new Map((a.abs || []).map(([nm, bits]) => [nm, bits]));
  for (const [nm, bits] of b.abs || []) {
    const cur = by.get(nm);
    by.set(nm, cur ? cur.split('').map((ch, i) => (ch === '2' || bits[i] === '2' ? '2' : ch === '1' || bits[i] === '1' ? '1' : '0')).join('') : bits);
  }
  a.abs = [...by.entries()];
  a.students = Math.max(a.students || 0, b.students || 0);
  return recountClass(a);
}
async function readHistory(redis, prefix) {
  const all = (await redis.hgetall(historyKey(prefix))) || {};
  const out = {};
  for (const [k, v] of Object.entries(all)) {
    let snap = v;
    if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { continue; } }
    if (snap && validIso(snap.weekStart) && snap.classes && typeof snap.classes === 'object') out[k] = snap;
  }
  return out;
}
// op: {action:'rename',from,to} | {action:'removeClass',cls,week?} | {action:'removeStudent',cls,week,name}
// Returns the number of weeks changed.
async function editHistory(redis, prefix, op) {
  const weeks = await readHistory(redis, prefix);
  const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  let changed = 0;
  for (const [wk, snap] of Object.entries(weeks)) {
    if (op.week && wk !== op.week) continue;
    const cl = snap.classes;
    let dirty = false;
    if (op.action === 'rename') {
      const from = clean(op.from, 80), to = clean(op.to, 80);
      if (!from || !to || from === to || !cl[from]) continue;
      if (cl[to]) { const m = mergeClassSnap(cl[to], cl[from]); if (!m) continue; } else cl[to] = cl[from];
      delete cl[from]; dirty = true;
    } else if (op.action === 'removeClass') {
      const c = clean(op.cls, 80);
      if (!cl[c]) continue;
      delete cl[c]; dirty = true;
    } else if (op.action === 'removeStudent') {
      const c = clean(op.cls, 80), nm = clean(op.name, 80);
      const n = cl[c];
      if (!n || !Array.isArray(n.abs) || !n.abs.some((a) => a[0] === nm)) continue;
      n.abs = n.abs.filter((a) => a[0] !== nm); recountClass(n); dirty = true;
    }
    if (!dirty) continue;
    changed++;
    if (Object.keys(cl).length) await redis.hset(historyKey(prefix), { [wk]: snap });
    else await redis.hdel(historyKey(prefix), wk);   // nothing left in that week
  }
  return changed;
}

module.exports = { editHistory, keepOrphans, DEFAULT_HOLIDAYS, holidayOn, validIso, addDays, mondayOf, deriveLevel, summarizeState, archiveWeek, historyKey, periodCounts, DEFAULT_BREAKS };
