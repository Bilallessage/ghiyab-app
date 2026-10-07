// /api/auth
//   GET                      -> who am I?  ({email, role}) — needs a valid token
//   POST {action:'login'}    -> {token, email, role}
//   POST {action:'register'} -> files a sign-up REQUEST for a read-only (viewer) account.
//        The account cannot log in until the admin approves it (/api/users).
const L = require('./_lib');

const userKey = L.userKey;
const MAX_PENDING = 200; // stops a flood of sign-up requests from filling the admin's list

module.exports = async function handler(req, res) {
  const problem = L.configProblem();
  if (problem) return L.send(res, 503, { error: 'not_configured', message: problem });

  if (req.method === 'GET') {
    const s = await L.getActiveSession(req);
    if (!s) return L.send(res, 401, { error: 'unauthorized' });
    return L.send(res, 200, s);
  }

  if (req.method !== 'POST') return L.send(res, 405, { error: 'method_not_allowed' });

  const body = L.parseBody(req);
  if (!body) return L.send(res, 400, { error: 'bad_request', message: 'طلب غير صالح' });

  const email = L.normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = L.clientIp(req);

  try {
    // ------------------------------------------------------------- login
    if (body.action === 'login') {
      if (!(await L.allow(L.PREFIX + ':rl:login:' + ip + ':' + email, 10, 900))) {
        return L.send(res, 429, { error: 'too_many', message: 'محاولات كثيرة، انتظروا 15 دقيقة ثم أعيدوا المحاولة' });
      }
      const fail = () => L.send(res, 401, { error: 'bad_credentials', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      if (!L.validEmail(email) || !password || password.length > 200) return fail();

      if (email === L.ADMIN_EMAIL) {
        if (!L.safeEqual(password, L.ADMIN_PASSWORD)) return fail();
        return L.send(res, 200, { token: L.signToken(email, 'admin'), email, role: 'admin' });
      }

      const user = await L.getRedis().get(userKey(email));
      if (!user || !user.hash) {
        await L.dummyVerify(password);
        return fail();
      }
      if (!(await L.verifyPassword(password, user.hash))) return fail();
      if (user.status === 'pending') {
        return L.send(res, 403, { error: 'pending', message: 'حسابكم في انتظار موافقة المسؤول. سيتمكّن من الدخول بعد قبول طلبكم.' });
      }
      return L.send(res, 200, { token: L.signToken(email, 'viewer'), email, role: 'viewer' });
    }

    // ---------------------------------------------------------- register
    if (body.action === 'register') {
      if (!(await L.allow(L.PREFIX + ':rl:register:' + ip, 10, 3600))) {
        return L.send(res, 429, { error: 'too_many', message: 'محاولات كثيرة، أعيدوا المحاولة لاحقًا' });
      }
      if (!L.validEmail(email)) {
        return L.send(res, 400, { error: 'bad_email', message: 'البريد الإلكتروني غير صالح' });
      }
      if (email === L.ADMIN_EMAIL) {
        return L.send(res, 403, { error: 'reserved', message: 'هذا البريد مخصّص للمسؤول، استعملوه من تبويب «دخول»' });
      }
      if (password.length < 8 || password.length > 128) {
        return L.send(res, 400, { error: 'bad_password', message: 'كلمة المرور يجب أن تكون بين 8 و128 حرفًا' });
      }
      const redis = L.getRedis();
      const pending = (await redis.hgetall(L.PENDING_KEY)) || {};
      if (Object.keys(pending).length >= MAX_PENDING) {
        return L.send(res, 429, { error: 'too_many', message: 'عدد طلبات الحسابات المعلّقة كبير، أخبروا المسؤول ليعالجها ثم أعيدوا المحاولة' });
      }
      const hash = await L.hashPassword(password);
      const now = Date.now();
      // nx: only create when the email is not taken yet (atomic, no race)
      const created = await redis.set(userKey(email), { email, hash, createdAt: now, status: 'pending' }, { nx: true });
      if (!created) {
        return L.send(res, 409, { error: 'exists', message: 'يوجد حساب أو طلب بهذا البريد بالفعل. إن كان طلبكم معلّقا فانتظروا موافقة المسؤول، وإلا استعملوا تبويب «دخول»' });
      }
      await redis.hset(L.PENDING_KEY, { [email]: now });
      // No token on purpose: the admin has to approve the account first.
      return L.send(res, 202, { pending: true, message: 'تم إرسال طلبكم إلى المسؤول. يمكنكم الدخول بعد موافقته عليه.' });
    }

    return L.send(res, 400, { error: 'bad_action', message: 'طلب غير صالح' });
  } catch (e) {
    return L.send(res, 500, { error: 'server_error', message: 'خطأ في الخادم، أعيدوا المحاولة' });
  }
};
