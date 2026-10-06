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
    const dayStudents = Array(DAYS).fill(0);
    let weekStudents = 0;
    const absList = []; // [name, "0101…" one bit per column] for every student with at least one absence
    for (let si = 0; si < names.length; si++) {
      const row = Array.isArray(abs[si]) ? abs[si] : [];
      const dayHit = Array(DAYS).fill(false);
      let any = false;
      for (let i = 0; i < COLS; i++) {
        if (row[i]) { cols[i]++; dayHit[Math.floor(i / PER_DAY)] = true; any = true; }
      }
      for (let d = 0; d < DAYS; d++) if (dayHit[d]) dayStudents[d]++;
      if (any) {
        weekStudents++;
        let bits = '';
        for (let i = 0; i < COLS; i++) bits += row[i] ? '1' : '0';
        absList.push([String(names[si] == null ? '' : names[si]).trim().slice(0, 80), bits]);
      }
    }
    const custom = state.levels && typeof state.levels[c] === 'string' ? state.levels[c].trim() : '';
    classes[c] = {
      pc,
      level: custom || deriveLevel(c),
      students: names.length,
      cols,
      dayStudents,
      weekStudents,
      abs: absList,
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
  await redis.hset(historyKey(prefix), { [snap.weekStart]: snap });
  return true;
}

module.exports = { validIso, addDays, mondayOf, deriveLevel, summarizeState, archiveWeek, historyKey };
