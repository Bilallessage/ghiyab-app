// Keeps the application page so it opens without internet. Only the page, fr.js, the logos and the Excel
// library are kept; /api/* is never touched (the sheet is stored by the page itself, see index.html).
const CACHE = 'ghiyab-shell-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(['/', '/fr.js']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// network first (so every deployment is picked up at once); the kept copy is used when the network fails
async function networkFirst(req) {
  const key = req.mode === 'navigate' ? new Request('/') : req;
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req), 6000);
    if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    e.respondWith(networkFirst(req));
  } else if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(networkFirst(req));
  }
});
