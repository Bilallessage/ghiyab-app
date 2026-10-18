// Builds docs/app-journal.pdf from docs/journal.json (+ git stats).
// Usage: node docs/build-journal.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright'))); }

const root = path.join(__dirname, '..');
const JA = JSON.parse(fs.readFileSync(path.join(__dirname, 'journal.json'), 'utf8')); // Arabic source (the reference)
const readJ = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const sh = c => cp.execSync(c, { cwd: root }).toString().trim();
const latin = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); // Arabic-Indic -> Latin digits
const esc = s => latin(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = n => String(n); // Latin digits (0-9) everywhere, as requested
// labels of the Arabic edition (fr / en editions carry theirs in journal.fr.json / journal.en.json -> "ui")
const UI_AR = {
  lang: 'ar', dir: 'rtl', file: 'app-journal.pdf', badge: 'غ',
  phasesStat: 'مرحلة تطوير', commitsStat: 'تعديلا منشورا', linesStat: 'سطرا في الصفحة الرئيسية', filesStat: 'ملفا في المشروع',
  fromTo: 'من {from} إلى {to}', updated: 'آخر تحيين لهذا الملف: {today}',
  aboutH: 'لمحة عن التطبيق', stackH: 'البنية التقنية', stackPart: 'الجزء', stackDesc: 'الوصف', timelineH: 'الخط الزمني', dateCol: 'التاريخ', phaseCol: 'المرحلة',
  detailsH: 'مراحل التطوير بالتفصيل', request: 'الطلب:', tech: 'تقنيا:', methodH: 'طريقة العمل', openH: 'ما بقي مفتوحا', appendixH: 'ملحق: سجل التعديلات',
  gitHash: 'الرمز', gitDate: 'التاريخ', gitChange: 'التعديل',
  generated: 'يُولَّد هذا الملف آليا بالأمر node docs/build-journal.js من docs/journal.json وسجل git.',
  footer: 'سجل تطوير «{title}» — صفحة {page} / {pages}',
  months: ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'],
  dateFmt: '{d} {m} {y}'
};
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k]);

const log = sh('git log --reverse --format=%h%x09%ad%x09%s --date=short').split('\n').map(l => l.split('\t'));
const commits = log.length;
const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n').length;
const files = sh('git ls-files').split('\n').length;
const last = log[log.length - 1][1];
const first = log[0][1];
const today = new Date().toISOString().slice(0, 10);

// The Arabic journal is the reference. The fr / en editions translate it: same phases, same order, same dates.
function edition(code) {
  if (code === 'ar') return { U: UI_AR, J: JA };
  const T = readJ(`journal.${code}.json`);
  const U = T.ui;
  const phases = JA.phases.map((p, i) => {
    const t = T.phases && T.phases[i];
    if (!t) { console.warn(`WARNING [${code}]: phase ${i + 1} («${p.title}») has no translation yet; the Arabic text is used`); return p; }
    return { date: p.date, title: t.title, goal: t.goal, done: t.done, tech: t.tech };
  });
  return { U, J: { title: T.title, subtitle: T.subtitle, intro: T.intro, stack: T.stack, phases, method: T.method, open: T.open, gitNote: T.gitNote } };
}

function makeHtml({ U, J }) {
  const dateTxt = iso => { const [y, m, d] = iso.split('-').map(Number); return fill(U.dateFmt, { d: num(d), m: U.months[m - 1], y: num(y) }); };
  const phaseHtml = J.phases.map((p, i) => `
<section class="phase">
  <div class="ph-head"><span class="ph-n">${num(i + 1)}</span><div><h3>${esc(p.title)}</h3><div class="ph-date">${esc(p.date)}</div></div></div>
  <p class="goal"><b>${esc(U.request)}</b> ${esc(p.goal)}</p>
  <ul>${p.done.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
  ${p.tech ? `<p class="tech"><b>${esc(U.tech)}</b> ${esc(p.tech)}</p>` : ''}
</section>`).join('');
  return `<!doctype html><html lang="${U.lang}" dir="${U.dir}"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}
body{font-family:'DejaVu Sans',sans-serif;font-size:10.5pt;line-height:1.75;color:#1d2433;margin:0}
h1,h2,h3{margin:0}
.cover{height:255mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}
.cover .badge{width:90px;height:90px;border-radius:22px;background:#1f5fbf;color:#fff;font-size:44pt;display:flex;align-items:center;justify-content:center;margin-bottom:22px}
.cover h1{font-size:30pt;color:#1f3b73}
.cover .sub{font-size:14pt;color:#556;margin:8px 0 34px}
.stats{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.stat{border:1px solid #cfd8ea;border-radius:10px;padding:10px 16px;min-width:120px;background:#f5f8fe}
.stat b{display:block;font-size:19pt;color:#1f5fbf}
.stat span{font-size:9pt;color:#556}
.upd{margin-top:30px;color:#556;font-size:10pt}
h2{break-after:avoid;font-size:16pt;color:#1f3b73;border-bottom:2px solid #1f5fbf;padding-bottom:4px;margin:0 0 12px}
.intro p{margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:9.5pt}
th,td{border:1px solid #cfd8ea;padding:5px 8px;text-align:start;vertical-align:top}
th{background:#1f5fbf;color:#fff}
tr:nth-child(even) td{background:#f5f8fe}
td.k{white-space:nowrap;font-weight:bold;width:70px}
.phase{border:1px solid #cfd8ea;border-radius:10px;padding:10px 14px;margin:0 0 12px;break-inside:avoid;background:#fff}
.ph-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.ph-n{width:30px;height:30px;border-radius:50%;background:#1f5fbf;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;flex:none}
.phase h3{font-size:12.5pt;color:#1f3b73}
.ph-date{font-size:8.5pt;color:#778}
.goal{margin:4px 0;color:#33405a}
.phase ul{margin:4px 0;padding-inline-start:20px}
.phase li{margin:1px 0}
.tech{margin:6px 0 0;padding:5px 8px;background:#eef3fb;border-radius:6px;font-size:9pt;color:#33405a}
.pb{page-break-before:always}
ol,ul.plain{padding-inline-start:22px;margin:0 0 14px}
li{margin:3px 0}
.git td{font-size:8.5pt;padding:3px 6px}
.git td.h{font-family:'DejaVu Sans Mono',monospace;direction:ltr;text-align:center;width:62px}
.git td.d{direction:ltr;text-align:center;width:78px;white-space:nowrap}
.git td.m{unicode-bidi:plaintext}
.note{font-size:9pt;color:#667;margin-top:6px}
</style></head><body>

<div class="cover">
  <div class="badge">${esc(U.badge)}</div>
  <h1>${esc(J.title)}</h1>
  <div class="sub">${esc(J.subtitle)}</div>
  <div class="stats">
    <div class="stat"><b>${num(J.phases.length)}</b><span>${esc(U.phasesStat)}</span></div>
    <div class="stat"><b>${num(commits)}</b><span>${esc(U.commitsStat)}</span></div>
    <div class="stat"><b>${num(lines)}</b><span>${esc(U.linesStat)}</span></div>
    <div class="stat"><b>${num(files)}</b><span>${esc(U.filesStat)}</span></div>
  </div>
  <div class="upd">${esc(fill(U.fromTo, { from: dateTxt(first), to: dateTxt(last) }))}<br>${esc(fill(U.updated, { today: dateTxt(today) }))}</div>
</div>

<h2>${esc(U.aboutH)}</h2>
<div class="intro">${J.intro.map(p => `<p>${esc(p)}</p>`).join('')}</div>
<h2 style="margin-top:14px">${esc(U.stackH)}</h2>
<table><tr><th style="width:90px">${esc(U.stackPart)}</th><th>${esc(U.stackDesc)}</th></tr>
${J.stack.map(([a, b]) => `<tr><td class="k">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>

<div style="break-inside:avoid"><h2>${esc(U.timelineH)}</h2>
<table><tr><th style="width:90px">${esc(U.dateCol)}</th><th>${esc(U.phaseCol)}</th></tr>
${J.phases.map((p, i) => `<tr><td class="k">${esc(p.date)}</td><td>${num(i + 1)}. ${esc(p.title)}</td></tr>`).join('')}</table></div>

<h2 style="margin-top:6px">${esc(U.detailsH)}</h2>
${phaseHtml}

<h2 class="pb">${esc(U.methodH)}</h2>
<ol>${J.method.map(m => `<li>${esc(m)}</li>`).join('')}</ol>
<h2 style="margin-top:18px">${esc(U.openH)}</h2>
<ul class="plain">${J.open.map(m => `<li>${esc(m)}</li>`).join('')}</ul>

<h2 class="pb">${esc(U.appendixH)}</h2>
<table class="git"><tr><th>${esc(U.gitHash)}</th><th>${esc(U.gitDate)}</th><th>${esc(U.gitChange)}</th></tr>
${log.map(([h, d, m]) => `<tr><td class="h">${esc(h)}</td><td class="d">${esc(d)}</td><td class="m">${esc(m)}</td></tr>`).join('')}</table>
<p class="note">${J.gitNote ? esc(J.gitNote) + ' ' : ''}${esc(U.generated)}</p>
</body></html>`;
}

(async () => {
  const arg = process.argv[2];
  const codes = arg ? arg.split(',') : ['ar', 'fr', 'en']; // default: the three editions
  const b = await chromium.launch();
  for (const code of codes) {
    const E = edition(code);
    const pg = await b.newPage();
    await pg.setContent(makeHtml(E), { waitUntil: 'load' });
    const out = path.join(__dirname, E.U.file);
    const footer = fill(E.U.footer, { title: E.J.title, page: '<span class="pageNumber"></span>', pages: '<span class="totalPages"></span>' });
    await pg.pdf({
      path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-family:'DejaVu Sans';font-size:8px;color:#778;text-align:center;direction:${E.U.dir}">${footer}</div>`,
      margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' }
    });
    await pg.close();
    console.log('wrote', out);
  }
  await b.close();
})();
