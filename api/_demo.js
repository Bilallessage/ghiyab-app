// Training / demonstration data (SEED_DEMO): a fictional school with invented students, invented teachers and an
// invented timetable. Nothing here is real. Everything is generated from a fixed seed, so the same data comes out
// every time: the training files (docs/training) and the demo site always agree.
//
//   SEED_DEMO=1  fresh deployment = 6 classes with students and parents' phones, the current week empty, four past
//                weeks of invented absences in the statistics archive; the timetable (subjects / teachers) is left
//                empty so that trainees import «docs/training/التنظيم_التربوي_تجريبي.xlsx» themselves
//   SEED_DEMO=2  same, with the timetable already filled in
const { summarizeState, addDays, mondayOf } = require('./_stats');

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const INST_NAME = 'مؤسسة الأفق التجريبية';
const CLASS_NAMES = ['1AC-1', '1AC-2', '2AC-1', '2AC-2', '3AC-1', '3AC-2'];
const BOYS = ['يوسف', 'أيوب', 'ياسين', 'مهدي', 'أنس', 'رضا', 'سفيان', 'زكرياء', 'إلياس', 'هشام', 'بلال', 'حمزة', 'عمر', 'أمين', 'سعد', 'طارق', 'مروان', 'نبيل', 'كريم', 'آدم', 'ريان', 'عادل', 'ماجد', 'وليد'];
const GIRLS = ['سلمى', 'مريم', 'خديجة', 'هاجر', 'إيمان', 'أسماء', 'سناء', 'نهى', 'لبنى', 'ريم', 'غيثة', 'كوثر', 'رحمة', 'شيماء', 'أميمة', 'حفصة', 'ملاك', 'ياسمين', 'دعاء', 'هدى', 'جنى', 'سارة', 'رنا', 'ليلى'];
const FAMILIES = ['الودغيري', 'الزهراوي', 'السملالي', 'البقالي', 'التازي', 'الغزواني', 'الركراكي', 'الحسناوي', 'المرابط', 'الدكالي', 'السوسي', 'الشاوي', 'الفيلالي', 'الحمداوي', 'الجبلي', 'المراكشي', 'الصحراوي', 'العبدلاوي', 'الريفي', 'الزعري', 'البوعزاوي', 'الحيحي', 'المسفيوي', 'الإدريسي الصغير', 'بن الصديق', 'أيت الحاج', 'أولاد علي', 'بن عمر'];
const TEACHER_FIRST = ['كريم', 'سناء', 'محمد', 'فاطمة', 'عبد الله', 'نادية', 'رشيد', 'لطيفة', 'الحسين', 'خديجة', 'عبد الرحيم', 'سميرة', 'جمال', 'ليلى', 'أحمد'];
const TEACHER_FAMILY = ['المنصوري', 'الشرقاوي', 'العمراني', 'بنعيسى', 'الكتاني', 'السباعي', 'الحجوي', 'الناصري', 'بوزيان', 'اليعقوبي', 'الطاهري', 'القادري', 'بلحاج', 'الرحموني', 'الصنهاجي'];

// code -> teacher (name, subject written correctly, and as it is mistyped in the teachers' sheet of the file)
const TEACHERS = [
  { code: 'AR1', subject: 'اللغة العربية', typo: 'اللغة العربية' },
  { code: 'AR2', subject: 'اللغة العربية', typo: 'اللغة العربية' },
  { code: 'FR1', subject: 'اللغة الفرنسية', typo: 'اللغة الفرنسية' },
  { code: 'FR2', subject: 'اللغة الفرنسية', typo: 'اللغة الفرنسية' },
  { code: 'M1', subject: 'الرياضيات', typo: 'الرياضيات' },
  { code: 'M2', subject: 'الرياضيات', typo: 'الرياضيات' },
  { code: 'ANG', subject: 'اللغة الإنجليزية', typo: 'اللغة الانجليزية' },
  { code: 'HG1', subject: 'الاجتماعيات', typo: 'الاجتماعيات' },
  { code: 'HG2', subject: 'الاجتماعيات', typo: 'الاجتماعيات' },
  { code: 'PC', subject: 'الفيزياء والكيمياء', typo: 'الفيزياء و الكيمياء' },
  { code: 'SVT', subject: 'علوم الحياة والأرض', typo: 'علوم الحيات والارض' },
  { code: 'EI', subject: 'التربية الإسلامية', typo: 'التربية الاسلامية' },
  { code: 'EPS', subject: 'التربية البدنية', typo: 'التربيه البدنية' },
  { code: 'TEC', subject: 'التكنولوجيا', typo: 'التكنولوجيا' },
  { code: 'INF', subject: 'المعلوميات', typo: 'المعلوميات' },
].map((t, i) => Object.assign(t, { name: TEACHER_FIRST[i] + ' ' + TEACHER_FAMILY[i] }));
const T_BY_CODE = Object.fromEntries(TEACHERS.map((t) => [t.code, t]));
const ACT_SUBJECT = 'أنشطة / اللغة العربية';

// who teaches the class: the first three classes have the first teacher of a subject, the others the second one
const LOWER = new Set(['1AC-1', '1AC-2', '2AC-1']);
function teacherCode(base, cls) { return LOWER.has(cls) ? base + '1' : base + '2'; }
// weekly lessons of a class: 28 hours (Friday afternoon is free)
function weeklyLessons(cls) {
  const ar = teacherCode('AR', cls);
  return [[ar, 4], ['ACT/' + ar, 1], [teacherCode('FR', cls), 4], [teacherCode('M', cls), 4], ['ANG', 2], [teacherCode('HG', cls), 3], ['PC', 2], ['SVT', 2], ['EI', 2], ['EPS', 2], ['TEC', 1], ['INF', 1]];
}

const DAYS = 5, PER = 6; // 3 morning + 3 afternoon periods a day -> 30 columns (day * 6 + period)
const FREE = new Set([4 * PER + 4, 4 * PER + 5]); // Friday 15-16 and 16-17

// timetable: code of each of the 30 slots of every class ('' = free); no teacher is in two classes at once
function buildTimetable() {
  const rand = rng(20261018);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const busy = {}; // slot -> Set(teacher codes)
    const tt = {};
    let ok = true;
    for (const cls of CLASS_NAMES) {
      const slots = Array(DAYS * PER).fill('');
      const lessons = [];
      weeklyLessons(cls).forEach(([code, n]) => { for (let i = 0; i < n; i++) lessons.push(code); });
      const free = []; for (let s = 0; s < DAYS * PER; s++) if (!FREE.has(s)) free.push(s);
      // most constrained lessons first (shared teachers), in a random order inside each group
      lessons.sort((a, b) => (/^(ANG|PC|SVT|EI|EPS|TEC|INF)$/.test(b) ? 1 : 0) - (/^(ANG|PC|SVT|EI|EPS|TEC|INF)$/.test(a) ? 1 : 0) || rand() - 0.5);
      const perDay = (code, d) => slots.slice(d * PER, d * PER + PER).filter((x) => x === code).length;
      for (const code of lessons) {
        const who = code.startsWith('ACT/') ? code.slice(4) : code;
        const cand = free.filter((s) => slots[s] === '' && !(busy[s] && busy[s].has(who)) && perDay(code, Math.floor(s / PER)) < (/^(AR|FR|M)/.test(code) ? 2 : 1));
        if (!cand.length) { ok = false; break; }
        const s = cand[Math.floor(rand() * cand.length)];
        slots[s] = code; (busy[s] = busy[s] || new Set()).add(who);
      }
      if (!ok) break;
      tt[cls] = slots;
    }
    if (ok) return tt;
  }
  throw new Error('demo timetable could not be built');
}

// the subject / teacher a code stands for ('ACT/AR1' = activities + the Arabic teacher)
function lesson(code) {
  if (!code) return { subject: '', teacher: '' };
  if (code.startsWith('ACT/')) return { subject: ACT_SUBJECT, teacher: T_BY_CODE[code.slice(4)].name };
  return { subject: T_BY_CODE[code].subject, teacher: T_BY_CODE[code].name };
}

function buildStudents() {
  const rand = rng(7731);
  const used = new Set();
  const out = {};
  const sizes = [21, 20, 22, 19, 21, 18];
  CLASS_NAMES.forEach((cls, ci) => {
    const list = [];
    while (list.length < sizes[ci]) {
      const girl = rand() < 0.5;
      const first = (girl ? GIRLS : BOYS)[Math.floor(rand() * (girl ? GIRLS : BOYS).length)];
      const fam = FAMILIES[Math.floor(rand() * FAMILIES.length)];
      const name = fam + ' ' + first;
      if (used.has(name)) continue;
      used.add(name); list.push(name);
    }
    out[cls] = list;
  });
  return out;
}

const TIMETABLE = buildTimetable();
const STUDENTS = buildStudents();
// invented parents' phones: 0600 00 00 NN (obviously not real numbers)
function phonesFor(cls) {
  const base = CLASS_NAMES.indexOf(cls) * 30;
  return STUDENTS[cls].map((_, i) => '06000' + String(base + i + 1).padStart(5, '0'));
}

function blankCols(withTimetable, cls) {
  return Array.from({ length: DAYS * PER }, (_, s) => (withTimetable ? lesson(TIMETABLE[cls][s]) : { subject: '', teacher: '' }));
}

// absences of one invented week: a few students miss one period, a few a whole morning, now and then a justified one
function weekAbsences(cls, seed, upToSlot) {
  const rand = rng(seed * 131 + CLASS_NAMES.indexOf(cls) * 17 + 5);
  const n = STUDENTS[cls].length;
  const rows = Array.from({ length: n }, () => Array(DAYS * PER).fill(false));
  const last = upToSlot == null ? DAYS * PER : upToSlot;
  for (let i = 0; i < n; i++) {
    const r = rand();
    const heavy = i % 9 === 4; // one or two students per class are often absent
    const events = heavy ? 3 + Math.floor(rand() * 3) : (r < 0.35 ? 1 + Math.floor(rand() * 2) : 0);
    for (let e = 0; e < events; e++) {
      const d = Math.floor(rand() * DAYS), half = rand() < 0.55 ? 0 : 1, len = rand() < 0.4 ? 3 : 1 + Math.floor(rand() * 2);
      const start = half * 3 + Math.floor(rand() * (4 - len));
      const justified = rand() < 0.3;
      for (let k = 0; k < len; k++) { const s = d * PER + start + k; if (s < last && !FREE.has(s)) rows[i][s] = justified ? 'j' : true; }
    }
  }
  return rows;
}

function stateFor(monday, { timetable, absences, seed }) {
  const data = {};
  CLASS_NAMES.forEach((cls) => {
    data[cls] = {
      names: STUDENTS[cls].slice(),
      columns: blankCols(timetable, cls),
      absences: absences ? weekAbsences(cls, seed) : STUDENTS[cls].map(() => Array(DAYS * PER).fill(false)),
      phones: phonesFor(cls),
    };
  });
  // breaks: [] = no holiday week on the training site, whatever the calendar says
  return { weekFrom: monday, weekTo: addDays(monday, 4), instName: (process.env.INSTITUTION_NAME || '').trim() || INST_NAME, classNames: CLASS_NAMES.slice(), breaks: [], data };
}

// today's date in Casablanca (YYYY-MM-DD)
function todayIso() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

// { state, history: [summary, ...] } for a fresh demo site. `mode` = '1' (empty timetable) or '2' (timetable filled)
function buildDemo(mode) {
  const full = mode === '2';
  const monday = mondayOf(todayIso());
  const state = stateFor(monday, { timetable: full, absences: false });
  const history = [];
  let m = addDays(monday, -7), seed = 1;
  while (history.length < 4) {
    const s = summarizeState(stateFor(m, { timetable: true, absences: true, seed: seed++ }));
    if (s) history.push(s);
    m = addDays(m, -7);
  }
  return { state, history };
}

module.exports = { buildDemo, INST_NAME, CLASS_NAMES, STUDENTS, TEACHERS, TIMETABLE, DAYS, PER, FREE, ACT_SUBJECT, lesson, phonesFor, rng, T_BY_CODE };
