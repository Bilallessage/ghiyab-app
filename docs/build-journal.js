// Builds docs/app-journal.pdf from docs/journal.json (+ git stats).
// Usage: node docs/build-journal.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright'))); }

const root = path.join(__dirname, '..');
const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'journal.json'), 'utf8'));
const sh = c => cp.execSync(c, { cwd: root }).toString().trim();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const AR = '٠١٢٣٤٥٦٧٨٩';
const num = n => String(n).replace(/\d/g, d => AR[d]);
const months = ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'];
const dateAr = iso => { const [y, m, d] = iso.split('-').map(Number); return `${num(d)} ${months[m - 1]} ${num(y)}`; };

const log = sh('git log --reverse --format=%h%x09%ad%x09%s --date=short').split('\n').map(l => l.split('\t'));
const commits = log.length;
const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n').length;
const files = sh('git ls-files').split('\n').length;
const last = log[log.length - 1][1];
const first = log[0][1];
const today = new Date().toISOString().slice(0, 10);

const phaseHtml = J.phases.map((p, i) => `
<section class="phase">
  <div class="ph-head"><span class="ph-n">${num(i + 1)}</span><div><h3>${esc(p.title)}</h3><div class="ph-date">${esc(p.date)}</div></div></div>
  <p class="goal"><b>الطلب:</b> ${esc(p.goal)}</p>
  <ul>${p.done.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
  ${p.tech ? `<p class="tech"><b>تقنيا:</b> ${esc(p.tech)}</p>` : ''}
</section>`).join('');

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
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
h2{font-size:16pt;color:#1f3b73;border-bottom:2px solid #1f5fbf;padding-bottom:4px;margin:0 0 12px}
.intro p{margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:9.5pt}
th,td{border:1px solid #cfd8ea;padding:5px 8px;text-align:right;vertical-align:top}
th{background:#1f5fbf;color:#fff}
tr:nth-child(even) td{background:#f5f8fe}
td.k{white-space:nowrap;font-weight:bold;width:70px}
.phase{border:1px solid #cfd8ea;border-radius:10px;padding:10px 14px;margin:0 0 12px;break-inside:avoid;background:#fff}
.ph-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.ph-n{width:30px;height:30px;border-radius:50%;background:#1f5fbf;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;flex:none}
.phase h3{font-size:12.5pt;color:#1f3b73}
.ph-date{font-size:8.5pt;color:#778}
.goal{margin:4px 0;color:#33405a}
.phase ul{margin:4px 0;padding-right:20px}
.phase li{margin:1px 0}
.tech{margin:6px 0 0;padding:5px 8px;background:#eef3fb;border-radius:6px;font-size:9pt;color:#33405a}
.pb{page-break-before:always}
ol,ul.plain{padding-right:22px;margin:0 0 14px}
li{margin:3px 0}
.git td{font-size:8.5pt;padding:3px 6px}
.git td.h{font-family:'DejaVu Sans Mono',monospace;direction:ltr;text-align:center;width:62px}
.git td.d{direction:ltr;text-align:center;width:78px;white-space:nowrap}
.git td.m{unicode-bidi:plaintext}
.note{font-size:9pt;color:#667;margin-top:6px}
</style></head><body>

<div class="cover">
  <div class="badge">غ</div>
  <h1>${esc(J.title)}</h1>
  <div class="sub">${esc(J.subtitle)}</div>
  <div class="stats">
    <div class="stat"><b>${num(J.phases.length)}</b><span>مرحلة تطوير</span></div>
    <div class="stat"><b>${num(commits)}</b><span>تعديلا منشورا</span></div>
    <div class="stat"><b>${num(lines)}</b><span>سطرا في الصفحة الرئيسية</span></div>
    <div class="stat"><b>${num(files)}</b><span>ملفا في المشروع</span></div>
  </div>
  <div class="upd">من ${dateAr(first)} إلى ${dateAr(last)}<br>آخر تحيين لهذا الملف: ${dateAr(today)}</div>
</div>

<h2>لمحة عن التطبيق</h2>
<div class="intro">${J.intro.map(p => `<p>${esc(p)}</p>`).join('')}</div>
<h2 style="margin-top:14px">البنية التقنية</h2>
<table><tr><th style="width:90px">الجزء</th><th>الوصف</th></tr>
${J.stack.map(([a, b]) => `<tr><td class="k">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>

<div style="break-inside:avoid"><h2>الخط الزمني</h2>
<table><tr><th style="width:90px">التاريخ</th><th>المرحلة</th></tr>
${J.phases.map((p, i) => `<tr><td class="k">${esc(p.date)}</td><td>${num(i + 1)}. ${esc(p.title)}</td></tr>`).join('')}</table></div>

<h2 style="margin-top:6px">مراحل التطوير بالتفصيل</h2>
${phaseHtml}

<h2 class="pb">طريقة العمل</h2>
<ol>${J.method.map(m => `<li>${esc(m)}</li>`).join('')}</ol>
<h2 style="margin-top:18px">ما بقي مفتوحا</h2>
<ul class="plain">${J.open.map(m => `<li>${esc(m)}</li>`).join('')}</ul>

<h2 class="pb">ملحق: سجل التعديلات</h2>
<table class="git"><tr><th>الرمز</th><th>التاريخ</th><th>التعديل</th></tr>
${log.map(([h, d, m]) => `<tr><td class="h">${esc(h)}</td><td class="d">${esc(d)}</td><td class="m">${esc(m)}</td></tr>`).join('')}</table>
<p class="note">يُولَّد هذا الملف آليا بالأمر node docs/build-journal.js من docs/journal.json وسجل git.</p>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  await pg.setContent(html, { waitUntil: 'load' });
  const out = path.join(__dirname, 'app-journal.pdf');
  await pg.pdf({
    path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:'DejaVu Sans';font-size:8px;color:#778;text-align:center;direction:rtl">سجل تطوير «${J.title}» — صفحة <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' }
  });
  await b.close();
  console.log('wrote', out);
})();
