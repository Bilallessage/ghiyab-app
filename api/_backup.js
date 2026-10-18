// Safety net for the shared sheet: automatic snapshots of the stored state, and restoring from them.
//   - A snapshot is taken right before a save that LOSES data in one go (several absences, phone numbers or
//     students fewer than what is stored: «استبدال اللائحة», a bulk delete, a new week, a wrong import...),
//     and at most every 12 hours otherwise, so there is always a recent restore point.
//   - The last KEEP snapshots are kept (<prefix>:bk:<ts> and the small index <prefix>:bk:index).
//   - Restore: «full» puts a snapshot back as the sheet; «merge» only gives the CURRENT students back their
//     absences (same week) and phone numbers, matched by name, and leaves everything else as it is.
// Taking a snapshot never blocks saving: any problem here is ignored by the caller.
const KEEP = 15;
const TIMED_MS = 12 * 3600 * 1000;

const indexKey = (p) => p + ':bk:index';
const snapKey = (p, ts) => p + ':bk:' + ts;

function stats(state) {
  const out = { students: 0, absences: 0, phones: 0 };
  if (!state || !state.data) return out;
  for (const k of Object.keys(state.data)) {
    const c = state.data[k];
    if (!c || !Array.isArray(c.names)) continue;
    out.students += c.names.length;
    if (Array.isArray(c.absences)) for (const r of c.absences) if (Array.isArray(r)) for (const v of r) if (v) out.absences++;
    if (Array.isArray(c.phones)) for (const x of c.phones) if (x && String(x).trim()) out.phones++;
  }
  return out;
}

async function readIndex(redis, prefix) {
  const idx = await redis.get(indexKey(prefix));
  return Array.isArray(idx) ? idx : [];
}

// prev = stored state, next = incoming state. Returns the snapshot entry, or null when none was needed.
async function maybeSnapshot(redis, prefix, prev, next, force) {
  if (!prev || !prev.data) return null;
  const a = stats(prev), b = stats(next);
  const loss = a.students - b.students >= 2 || a.absences - b.absences >= 3 || a.phones - b.phones >= 2;
  const idx = await readIndex(redis, prefix);
  const last = idx.length ? idx[idx.length - 1].ts : 0;
  const timed = a.students > 0 && Date.now() - last > TIMED_MS;
  if (!force && !loss && !timed) return null;
  const ts = Math.max(Date.now(), last + 1);
  await redis.set(snapKey(prefix, ts), prev);
  const entry = { ts, reason: force ? 'manual' : loss ? 'loss' : 'timed', weekFrom: prev.weekFrom || '', ...a };
  idx.push(entry);
  while (idx.length > KEEP) { const old = idx.shift(); try { await redis.del(snapKey(prefix, old.ts)); } catch (e) { /* ignore */ } }
  await redis.set(indexKey(prefix), idx);
  return entry;
}

// ---- name matching (same spirit as the page): word by word, any order, spelling variants ignored
function words(s) {
  return String(s || '').normalize('NFKD')
    .replace(/[ً-ٰٟـ̀-ͯ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
const nameKey = (s) => words(s).sort().join(' ');

// merge: give the current students back what the snapshot knew about them. -> {absencesBack, phonesBack}
function mergeFromSnapshot(cur, snap) {
  const res = { absencesBack: 0, phonesBack: 0, studentsMatched: 0 };
  const sameWeek = !!cur.weekFrom && cur.weekFrom === snap.weekFrom;
  for (const k of Object.keys(cur.data || {})) {
    const c = cur.data[k], s = snap.data && snap.data[k];
    if (!c || !s || !Array.isArray(c.names) || !Array.isArray(s.names)) continue;
    const map = new Map();
    s.names.forEach((n, i) => { const key = nameKey(n); if (key && !map.has(key)) map.set(key, i); });
    if (!Array.isArray(c.absences)) c.absences = [];
    if (!Array.isArray(c.phones)) c.phones = [];
    c.names.forEach((n, si) => {
      const j = map.get(nameKey(n));
      if (j == null) return;
      res.studentsMatched++;
      const ph = s.phones && s.phones[j];
      if (ph && String(ph).trim() && !(c.phones[si] && String(c.phones[si]).trim())) { c.phones[si] = ph; res.phonesBack++; }
      if (sameWeek && Array.isArray(s.absences && s.absences[j])) {
        const old = s.absences[j], row = Array.isArray(c.absences[si]) ? c.absences[si] : [];
        if (old.length === row.length || !row.length) {
          const merged = old.map((v, i) => (row[i] || v || false));
          const before = row.filter(Boolean).length;
          c.absences[si] = merged;
          res.absencesBack += merged.filter(Boolean).length - before;
        }
      }
    });
  }
  return res;
}

module.exports = { KEEP, stats, readIndex, snapKey, indexKey, maybeSnapshot, mergeFromSnapshot, nameKey };
