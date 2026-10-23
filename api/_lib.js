// Shared helpers for the serverless functions (files starting with "_" are
// not exposed as routes by Vercel).
//
// Security model
// - ONE admin: the email in ADMIN_EMAIL (default karama252@gmail.com). Its
//   password is the ADMIN_PASSWORD environment variable. That email can never
//   be registered through the public form, so nobody can claim it first.
// - Everyone else registers an email + password and becomes a "viewer"
//   (read only). Passwords are stored as salted scrypt hashes in Redis.
// - After login the server hands out a signed token (HMAC-SHA256 with
//   SESSION_SECRET) carrying {email, role, expiry}. Every API call is checked
//   against it on the server, so hiding buttons in the page is only cosmetic:
//   a viewer's write requests are rejected with 403 no matter what.

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'karama252@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_DAYS = 30;
// Namespace for every Redis key. Lets several institutions share one Redis
// database without seeing each other's data (each Vercel project sets its own
// KEY_PREFIX). The default keeps the original deployment's keys unchanged.
const PREFIX = (String(process.env.KEY_PREFIX || '').replace(/[^A-Za-z0-9_-]/g, '') || 'ghiyab');

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// ---- configuration check ---------------------------------------------------
function configProblem() {
  const missing = [];
  if (!REST_URL || !REST_TOKEN) missing.push('قاعدة بيانات Upstash Redis (غير مربوطة بالمشروع)');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (SESSION_SECRET.length < 32) missing.push('SESSION_SECRET (32 حرفًا على الأقل)');
  if (!missing.length) return null;
  return 'الخادم غير مهيّأ بعد، ينقصه: ' + missing.join('، ') + '. أضيفوها من إعدادات Vercel ثم أعيدوا النشر.';
}

// ---- redis -----------------------------------------------------------------
let redisClient = null;
function getRedis() {
  if (!redisClient) {
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url: REST_URL, token: REST_TOKEN });
  }
  return redisClient;
}

// ---- small utilities -------------------------------------------------------
function send(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { return null; }
  }
  return b && typeof b === 'object' ? b : null;
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function validEmail(e) {
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Constant-time string comparison (hashing first makes the lengths equal).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---- password hashing ------------------------------------------------------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return 's1:' + salt.toString('hex') + ':' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const key = await scrypt(password, salt, expected.length);
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// A throw-away hash so that "unknown email" costs the same time as "wrong
// password" (avoids revealing which emails have accounts).
let dummyHashPromise = null;
function dummyVerify(password) {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('dummy-password-for-timing');
  return dummyHashPromise.then((h) => verifyPassword(password, h));
}

// ---- signed session tokens -------------------------------------------------
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function sign(body) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(body).digest();
}

function signToken(email, role) {
  const payload = { e: email, r: role, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 };
  const body = b64u(JSON.stringify(payload));
  return body + '.' + b64u(sign(body));
}

function verifyToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  let given;
  try { given = Buffer.from(token.slice(dot + 1), 'base64url'); } catch (e) { return null; }
  const expected = sign(body);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null;
  if (p.r === 'admin') {
    if (p.e !== ADMIN_EMAIL) return null;
  } else if (p.r !== 'viewer' && p.r !== 'teacher') {
    return null;
  }
  return { email: p.e, role: p.r };
}

function getSession(req) {
  const h = String(req.headers['authorization'] || '');
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? verifyToken(m[1].trim()) : null;
}

// ---- viewer accounts need the admin's approval -------------------------------
// A record without `status` is an old, already-approved account. New sign-ups are
// stored as status:'pending' (and listed in USERS_PENDING) until the admin approves.
const userKey = (email) => PREFIX + ':user:' + email;
const PENDING_KEY = PREFIX + ':pending';

// ---- teacher invitations ---------------------------------------------------------
// The admin invites a teacher by e-mail address. The link carries a random token; only its
// SHA-256 is stored (inviteKey), so a leak of the database does not leak working links.
// INVITES_KEY is the admin's list: {email: {h:<hash>, t:<created ms>, teacher:<name>}}.
// Opening the link and choosing a password creates an already-approved teacher account
// (see /api/auth action:'accept'); the link works once and for INVITE_DAYS days.
const INVITE_DAYS = 7;
const INVITES_KEY = PREFIX + ':invites';
const inviteKey = (hash) => PREFIX + ':inv:' + hash;
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
async function loadInvite(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const key = inviteKey(hashToken(token));
  const inv = await getRedis().get(key);
  if (!inv || !inv.email || !(Date.now() - Number(inv.createdAt || 0) < INVITE_DAYS * 86400000)) return null;
  return { key, email: String(inv.email), teacher: String(inv.teacher || ''), createdAt: Number(inv.createdAt) };
}

// Does this viewer still have an approved account? (A removed or still-pending
// account must not keep working with a token it already holds.) The answer is
// cached for a minute per server instance, so polling does not double the Redis traffic.
const viewerCache = new Map();
// -> {ok, role:'viewer'|'teacher', teacher:'<name or empty>'}. The role stored on the
// account (set by the admin) wins over the one written in the token, so promoting or
// demoting an account takes effect within a minute without a new login.
async function accountInfo(email) {
  const now = Date.now();
  const c = viewerCache.get(email);
  if (c && now - c.t < 60000) return c.v;
  let v;
  try {
    const u = await getRedis().get(userKey(email));
    const ok = !!(u && u.status !== 'pending');
    v = { ok, role: ok && u.role === 'teacher' ? 'teacher' : 'viewer', teacher: ok && u.role === 'teacher' ? String(u.teacher || '') : '' };
  } catch (e) { return { ok: true, role: 'viewer', teacher: '', failed: true }; } // Redis hiccup: the data call itself would fail anyway
  if (viewerCache.size > 500) viewerCache.clear();
  viewerCache.set(email, { v, t: now });
  return v;
}
async function viewerActive(email) { return (await accountInfo(email)).ok; }
function forgetViewer(email) { viewerCache.delete(email); }

// Session from the Authorization header, or null when missing / invalid / a
// non-admin whose account was removed. The role is the one on the account record.
async function getActiveSession(req) {
  const s = getSession(req);
  if (!s) return null;
  if (s.role === 'admin') return s;
  const a = await accountInfo(s.email);
  if (!a.ok) return null;
  return a.failed ? s : { email: s.email, role: a.role, teacher: a.teacher };
}

// A tiny cross-request mutex (SET NX EX) so that two roll calls arriving together do not
// overwrite each other's read-modify-write of the shared sheet. Waits up to ~2.5 s, then
// goes ahead anyway (the lock expires by itself after 6 s).
async function withLock(name, fn) {
  const redis = getRedis();
  const key = PREFIX + ':lock:' + name;
  let got = false;
  for (let i = 0; i < 16 && !got; i++) {
    got = !!(await redis.set(key, '1', { nx: true, ex: 6 }));
    if (!got) await new Promise((r) => setTimeout(r, 160));
  }
  try { return await fn(); } finally { if (got) { try { await redis.del(key); } catch (e) { /* expires anyway */ } } }
}

// ---- rate limiting (fixed window, counted in Redis) ------------------------
async function allow(key, limit, windowSec) {
  const redis = getRedis();
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}

module.exports = {
  ADMIN_EMAIL, ADMIN_PASSWORD, PREFIX,
  configProblem, getRedis, send, parseBody, clientIp, normalizeEmail, validEmail,
  safeEqual, hashPassword, verifyPassword, dummyVerify,
  signToken, verifyToken, getSession, getActiveSession, allow,
  userKey, PENDING_KEY, INVITE_DAYS, INVITES_KEY, inviteKey, hashToken, loadInvite, viewerActive, accountInfo, forgetViewer, withLock,
};
