// Prints the invented training data as JSON (read by build-xlsx.py). Same data as the demo site (api/_demo.js).
//   node docs/training/export.js | python3 docs/training/build-xlsx.py <output folder>
const D = require('../../api/_demo');

function birth(cls, i) { // invented dates of birth, 2011-2013
  const r = D.rng(91 + D.CLASS_NAMES.indexOf(cls) * 101 + i);
  const y = 2011 + Math.floor(r() * 3), m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28);
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// the «updated» list (exercise: update a class list without losing the absences of those who stay)
const NEWCOMERS = {
  '1AC-1': ['الوزاني ياسمين', 'البرنوصي أيمن'], '1AC-2': ['الصقلي مريم'], '2AC-1': ['المسعودي زيد', 'العلوي سلمى'],
  '2AC-2': ['الهلالي أنس'], '3AC-1': ['القباج رنا', 'الأزرق وليد'], '3AC-2': ['الخطابي هاجر'],
};
const LEAVERS = { '1AC-1': 3, '1AC-2': 5, '2AC-1': 2, '2AC-2': 7, '3AC-1': 4, '3AC-2': 1 }; // index of the student who left
const classes = D.CLASS_NAMES.map((cls) => {
  const old = D.STUDENTS[cls].slice();
  const next = old.slice();
  const left = next.splice(LEAVERS[cls], 1)[0];
  next.push(...NEWCOMERS[cls]);
  next.sort((x, y) => x.localeCompare(y, 'ar')); // the new list is in alphabetical order: names must be matched, not positions
  return { name: cls, students: old.map((n, i) => ({ n, b: birth(cls, i) })), updated: next.map((n, i) => ({ n, b: birth(cls, 100 + i) })), left, joined: NEWCOMERS[cls] };
});

// timetable: slot s = day * 6 + half * 3 + period
const grid = D.CLASS_NAMES.map((cls) => ({ name: cls, slots: D.TIMETABLE[cls] }));
const classTimetable = D.CLASS_NAMES.map((cls) => ({ name: cls, slots: D.TIMETABLE[cls].map((c) => (c ? D.lesson(c).subject : '')) }));
const teachers = D.TEACHERS.map((t) => {
  let hours = 0;
  D.CLASS_NAMES.forEach((c) => D.TIMETABLE[c].forEach((x) => { if (x === t.code || x === 'ACT/' + t.code) hours++; }));
  return { code: t.code, name: t.name, subject: t.typo, hours };
});
console.log(JSON.stringify({ inst: D.INST_NAME, classes, grid, classTimetable, teachers }));
