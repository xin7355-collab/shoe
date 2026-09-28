/* 丈量大師 Service Worker：讓工地沒訊號也能開啟 App。
 * - 自家檔案（index.html 等）：網路優先，失敗才用快取 → 有網路時永遠拿到最新版。
 * - CDN 函式庫（jsPDF、three.js、字型）：快取優先 → 下載一次後離線可用。
 * 改版時把 VERSION +1，舊快取會在 activate 時清掉。 */
const VERSION = 'v2';
const CORE = `core-${VERSION}`;
const CDN = `cdn-${VERSION}`;
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const CDN_WARM = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* CDN 預熱：工地訊號差時第一次常失敗，失敗就等 2/4/8 秒重試（最多 4 次），
 * 仍失敗就放棄——使用者下次連網用到 PDF／3D 時，fetch 事件會再補進快取。
 * 放在 claim 之後才做，不拖慢新版接手。逐一下載，不併發，避免瞬間塞爆弱網路。 */
async function warmCDN() {
  const c = await caches.open(CDN);
  for (const u of CDN_WARM) {
    if (await c.match(u)) continue;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) { await c.put(u, r); break; } if (r.status < 500 && r.status !== 429) break; } catch (err) {}
      if (attempt < 3) await new Promise(res => setTimeout(res, 2000 * 2 ** attempt)); // backoff 2/4/8 秒
    }
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(CORE)).addAll(CORE_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE && k !== CDN) await caches.delete(k);
    await self.clients.claim();
    await warmCDN();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') (await caches.open(CDN)).put(req, r.clone());
      return r;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000); // 訊號差時 4 秒就改用快取，不讓畫面空白等待
      const r = await fetch(req, { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) (await caches.open(CORE)).put(req, r.clone());
      return r;
    } catch (err) {
      return (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    }
  })());
});
