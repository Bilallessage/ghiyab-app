// /api/users  (admin only) — approve the sign-up requests for viewer accounts
//   GET             -> {pending:[{email,createdAt}]}
//   GET ?all=1      -> also {viewers:[{email,createdAt}]}: the approved viewer accounts
//   POST {action:'approve'|'reject'|'remove', email}
//        approve: the pending account may now log in (read-only)
//        reject : delete a pending request
//        setrole: {role:'teacher', teacher:'<name, optional>'} or {role:'viewer'}
//        remove : delete an approved viewer (its token stops working within a minute)
//        invite : {email, teacher?} e-mail a teacher an invitation link (valid 7 days, one use). The
//                 teacher chooses a password through it and gets an already-approved teacher account,
//                 no approval needed. An existing approved account is simply made a teacher.
//                 Answers {link, emailed, mailConfigured, mailError}: when the mail could not be sent
//                 the admin copies the link or sends it by WhatsApp.
//        uninvite: cancel an invitation that has not been used yet
//   GET ?all=1 also returns {invites:[{email,teacher,createdAt}], mail:<is SMTP configured>}
const crypto = require('crypto');
const L = require('./_lib');
const M = require('./_mail');

const MAX_VIEWERS_LISTED = 500;
const MAX_INVITES = 200;
const cleanName = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function baseUrl(req) {
  const fixed = String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(fixed)) return fixed;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'http' ? 'http' : 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().replace(/[^A-Za-z0-9.:-]/g, '');
  return proto + '://' + host;
}

function inviteMail(to, teacher, link) {
  const inst = String(process.env.INSTITUTION_NAME || '').trim();
  const hello = 'السلام عليكم' + (teacher ? ' ' + teacher : '') + '،';
  const body = 'دعتكم إدارة ' + (inst || 'المؤسسة') + ' إلى استعمال تطبيق «تتبع غياب التلاميذ» لتسجيل الغياب عند النداء في حصصكم.';
  const how = 'لتفعيل حسابكم افتحوا الرابط التالي واختاروا كلمة مرور (8 أحرف على الأقل). يصبح حسابكم جاهزا مباشرة دون أي موافقة إضافية.';
  const note = 'الرابط صالح ' + L.INVITE_DAYS + ' أيام ويُستعمل مرة واحدة. إن لم تكونوا تنتظرون هذه الرسالة فتجاهلوها.';
  return {
    to,
    subject: 'دعوة لتفعيل حسابكم في تطبيق تتبع غياب التلاميذ',
    text: [hello, '', body, '', how, link, '', note].join('\n'),
    html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#1E2A28">'
      + '<p>' + esc(hello) + '</p><p>' + esc(body) + '</p><p>' + esc(how) + '</p>'
      + '<p style="margin:22px 0"><a href="' + esc(link) + '" style="background:#0F4C46;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;display:inline-block">تفعيل حسابي</a></p>'
      + '<p style="font-size:13px;color:#5B6664;word-break:break-all" dir="ltr">' + esc(link) + '</p>'
      + '<p style="font-size:13px;color:#5B6664">' + esc(note) + '</p></div>',
  };
}

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  const session = L.getSession(req);
  if (!session) return L.send(res, 401, { error: 'unauthorized' });
  if (session.role !== 'admin') {
    return L.send(res, 403, { error: 'forbidden', message: 'هذه الصفحة مخصّصة للمسؤول' });
  }
  const redis = L.getRedis();

  try {
    if (req.method === 'GET') {
      const raw = (await redis.hgetall(L.PENDING_KEY)) || {};
      const pending = Object.entries(raw)
        .map(([email, t]) => ({ email, createdAt: Number(t) || 0 }))
        .sort((a, b) => a.createdAt - b.createdAt);
      const out = { pending };
      if (req.query && req.query.all) {
        const viewers = [];
        let cursor = '0';
        const match = L.PREFIX + ':user:*';
        do {
          const r = await redis.scan(cursor, { match, count: 200 });
          cursor = String(r[0]);
          for (const k of r[1]) {
            if (viewers.length >= MAX_VIEWERS_LISTED) break;
            const u = await redis.get(k);
            if (u && u.email && u.status !== 'pending') viewers.push({ email: u.email, createdAt: u.createdAt || 0, role: u.role === 'teacher' ? 'teacher' : 'viewer', teacher: u.role === 'teacher' ? String(u.teacher || '') : '' });
          }
        } while (cursor !== '0' && viewers.length < MAX_VIEWERS_LISTED);
        viewers.sort((a, b) => (a.email < b.email ? -1 : 1));
        out.viewers = viewers;
        // invitations still waiting (expired ones are dropped from the list here)
        const rawInv = (await redis.hgetall(L.INVITES_KEY)) || {};
        const invites = [];
        for (const [em, v] of Object.entries(rawInv)) {
          if (v && Date.now() - Number(v.t || 0) < L.INVITE_DAYS * 86400000) invites.push({ email: em, teacher: String(v.teacher || ''), createdAt: Number(v.t) || 0 });
          else await redis.hdel(L.INVITES_KEY, em);
        }
        invites.sort((a, b) => a.createdAt - b.createdAt);
        out.invites = invites;
        out.mail = M.configured();
      }
      return L.send(res, 200, out);
    }

    if (req.method === 'POST') {
      const body = L.parseBody(req) || {};
      const email = L.normalizeEmail(body.email);
      if (!L.validEmail(email) || email === L.ADMIN_EMAIL) return L.send(res, 400, { error: 'bad_request' });
      const key = L.userKey(email);
      const user = await redis.get(key);

      if (body.action === 'uninvite') {
        const cur = await redis.hget(L.INVITES_KEY, email);
        if (cur && cur.h) await redis.del(L.inviteKey(cur.h));
        await redis.hdel(L.INVITES_KEY, email);
        return L.send(res, 200, { ok: true });
      }

      if (body.action === 'invite') {
        const teacher = cleanName(body.teacher);
        if (user && user.status !== 'pending') {
          // the account already exists and was approved: no link needed, it just becomes a teacher
          await redis.set(key, Object.assign({}, user, { role: 'teacher', teacher }));
          L.forgetViewer(email);
          return L.send(res, 200, { ok: true, upgraded: true });
        }
        // A self-registered request for this address never proved who owns the mailbox. Drop it:
        // the invited person sets the password through the link instead.
        if (user) { await redis.del(key); await redis.hdel(L.PENDING_KEY, email); L.forgetViewer(email); }
        const invites = (await redis.hgetall(L.INVITES_KEY)) || {};
        if (!invites[email] && Object.keys(invites).length >= MAX_INVITES) {
          return L.send(res, 429, { error: 'too_many', message: 'عدد الدعوات المعلّقة كبير، ألغوا بعضها أولا' });
        }
        const old = invites[email];
        if (old && old.h) await redis.del(L.inviteKey(old.h));
        const token = crypto.randomBytes(24).toString('base64url');
        const h = L.hashToken(token);
        const now = Date.now();
        await redis.set(L.inviteKey(h), { email, teacher, createdAt: now }, { ex: L.INVITE_DAYS * 86400 });
        await redis.hset(L.INVITES_KEY, { [email]: { h, t: now, teacher } });
        const link = baseUrl(req) + '/?invite=' + token;
        let emailed = false, mailError = '';
        if (M.configured()) {
          try { await M.send(inviteMail(email, teacher, link)); emailed = true; }
          catch (e) { mailError = String((e && e.message) || e).slice(0, 160); }
        }
        return L.send(res, 200, { ok: true, link, emailed, mailConfigured: M.configured(), mailError, days: L.INVITE_DAYS });
      }

      if (!user) {
        await redis.hdel(L.PENDING_KEY, email);
        return L.send(res, 404, { error: 'not_found', message: 'لا يوجد حساب بهذا البريد (ربما عولج الطلب من قبل)' });
      }
      if (body.action === 'approve') {
        await redis.set(key, Object.assign({}, user, { status: 'approved', approvedAt: Date.now() }));
        await redis.hdel(L.PENDING_KEY, email);
      } else if (body.action === 'reject') {
        if (user.status !== 'pending') return L.send(res, 400, { error: 'not_pending', message: 'هذا الحساب مقبول من قبل، استعملوا «إزالة»' });
        await redis.del(key);
        await redis.hdel(L.PENDING_KEY, email);
      } else if (body.action === 'setrole') {
        // viewer <-> teacher (a teacher may also record absences, see /api/mark)
        if (user.status === 'pending') return L.send(res, 400, { error: 'pending', message: 'اقبلوا الحساب أولا' });
        const next = Object.assign({}, user);
        if (body.role === 'teacher') {
          next.role = 'teacher';
          next.teacher = String(body.teacher || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        } else if (body.role === 'viewer') {
          delete next.role; delete next.teacher;
        } else {
          return L.send(res, 400, { error: 'bad_role' });
        }
        await redis.set(key, next);
      } else if (body.action === 'remove') {
        await redis.del(key);
        await redis.hdel(L.PENDING_KEY, email);
      } else {
        return L.send(res, 400, { error: 'bad_action' });
      }
      L.forgetViewer(email);
      return L.send(res, 200, { ok: true });
    }

    return L.send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error' });
  }
};
