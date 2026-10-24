// Minimal SMTP client (no dependency) used to e-mail the teacher invitations.
//
// Configure with environment variables (any SMTP account works: Gmail with an "app password",
// Brevo, Outlook, the school's own mail host...):
//   SMTP_HOST   e.g. smtp.gmail.com            (required)
//   SMTP_USER   login, usually the full address  (required)
//   SMTP_PASS   password / app password          (required)
//   SMTP_PORT   465 (default, implicit TLS) or 587 (STARTTLS)
//   SMTP_SECURE '1' = implicit TLS, '0' = STARTTLS (default: implicit TLS only on port 465)
//   SMTP_FROM   sender, e.g.  "اسم المؤسسة" <school@gmail.com>   (default: SMTP_USER)
// Without these the invitation link is still created: the admin copies it or sends it by WhatsApp.
//
// The credentials are never sent over a clear connection: when the server offers no STARTTLS
// on a non-TLS port the message is refused (set SMTP_ALLOW_PLAIN=1 only for a trusted LAN relay).
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

function config() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  let pass = process.env.SMTP_PASS || '';
  // Google shows an app password as 4 groups of 4 letters separated by spaces: spaces (or a stray line break from copy/paste) are never part of it
  if (/(^|\.)(gmail|googlemail)\.com$/i.test(host)) pass = pass.replace(/\s+/g, '');
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== '0' : port === 465;
  return { host, port, secure, user, pass, from: (process.env.SMTP_FROM || user).trim() };
}
function configured() { return !!config(); }

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=');
const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

function parseFrom(from) {
  const m = /^(.*)<([^>]+)>\s*$/.exec(from);
  if (!m) return { name: '', addr: from.trim() };
  return { name: m[1].replace(/^[\s"]+|[\s"]+$/g, ''), addr: m[2].trim() };
}

function buildMessage(cfg, to, subject, text, html) {
  const f = parseFrom(cfg.from);
  const boundary = '=_ghiyab_' + crypto.randomBytes(12).toString('hex');
  const domain = (f.addr.split('@')[1] || 'localhost').replace(/[^A-Za-z0-9.-]/g, '');
  const head = [
    'From: ' + (f.name ? encWord(clean(f.name)) + ' <' + f.addr + '>' : f.addr),
    'To: <' + to + '>',
    'Subject: ' + encWord(clean(subject)),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + domain + '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
  ];
  const part = (type, body) => '--' + boundary + '\r\nContent-Type: ' + type + '; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(b64(body)) + '\r\n';
  return head.join('\r\n') + '\r\n\r\n' + part('text/plain', text) + part('text/html', html) + '--' + boundary + '--\r\n';
}

// ---- line reader over a socket -------------------------------------------------
function Conn(sock) { this.attach(sock); }
Conn.prototype.attach = function (sock) {
  const self = this;
  this.sock = sock; this.buf = ''; this.lines = []; this.waiter = null; this.error = null;
  sock.on('data', (d) => { self.buf += d.toString('utf8'); let i; while ((i = self.buf.indexOf('\n')) >= 0) { self.lines.push(self.buf.slice(0, i).replace(/\r$/, '')); self.buf = self.buf.slice(i + 1); } self.wake(); });
  sock.on('error', (e) => { self.error = e; self.wake(); });
  sock.on('close', () => { if (!self.error) self.error = new Error('connection closed'); self.wake(); });
};
Conn.prototype.wake = function () { if (this.waiter) { const w = this.waiter; this.waiter = null; w(); } };
Conn.prototype.reply = async function () {
  const out = [];
  for (;;) {
    while (!this.lines.length) {
      if (this.error) throw this.error;
      await new Promise((r) => { this.waiter = r; });
    }
    const l = this.lines.shift();
    out.push(l);
    if (/^\d{3}( |$)/.test(l)) return { code: Number(l.slice(0, 3)), text: out.join('\n') };
  }
};
Conn.prototype.cmd = async function (line, ok) {
  this.sock.write(line + '\r\n');
  const r = await this.reply();
  if (ok.indexOf(r.code) < 0) throw new Error('SMTP ' + r.code + ' ' + r.text.split('\n').pop().slice(4, 140));
  return r;
};

function connect(cfg) {
  return new Promise((resolve, reject) => {
    const sock = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });
    sock.once(cfg.secure ? 'secureConnect' : 'connect', () => resolve(sock));
    sock.once('error', reject);
  });
}

// send({to, subject, text, html}) -> resolves when the server accepted the message.
async function send(msg) {
  const cfg = config();
  if (!cfg) { const e = new Error('البريد غير مُعدّ'); e.code = 'not_configured'; throw e; }
  let sock = null;
  const deadline = setTimeout(() => { if (sock) sock.destroy(new Error('timeout')); }, 9000);
  try {
    sock = await Promise.race([connect(cfg), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
    const conn = new Conn(sock);
    const g = await conn.reply();
    if (g.code !== 220) throw new Error('SMTP ' + g.code);
    let r = await conn.cmd('EHLO ghiyab', [250]);
    if (!cfg.secure) {
      if (/STARTTLS/i.test(r.text)) {
        await conn.cmd('STARTTLS', [220]);
        sock.removeAllListeners('data'); sock.removeAllListeners('error'); sock.removeAllListeners('close');
        const t = await new Promise((resolve, reject) => {
          const s = tls.connect({ socket: sock, servername: cfg.host });
          s.once('secureConnect', () => resolve(s)); s.once('error', reject);
        });
        sock = t; conn.attach(t);
        r = await conn.cmd('EHLO ghiyab', [250]);
      } else if (process.env.SMTP_ALLOW_PLAIN !== '1') {
        throw new Error('الخادم لا يوفّر تشفيرا (STARTTLS)');
      }
    }
    if (/AUTH[^\n]*PLAIN/i.test(r.text)) {
      await conn.cmd('AUTH PLAIN ' + b64('\0' + cfg.user + '\0' + cfg.pass), [235]);
    } else {
      await conn.cmd('AUTH LOGIN', [334]);
      await conn.cmd(b64(cfg.user), [334]);
      await conn.cmd(b64(cfg.pass), [235]);
    }
    await conn.cmd('MAIL FROM:<' + parseFrom(cfg.from).addr + '>', [250]);
    await conn.cmd('RCPT TO:<' + msg.to + '>', [250, 251]);
    await conn.cmd('DATA', [354]);
    await conn.cmd(buildMessage(cfg, msg.to, msg.subject, msg.text, msg.html) + '\r\n.', [250]);
    try { sock.write('QUIT\r\n'); } catch (e) { /* done anyway */ }
  } finally {
    clearTimeout(deadline);
    if (sock) { try { sock.end(); } catch (e) { /* ignore */ } }
  }
}

module.exports = { configured, send, _config: config };
