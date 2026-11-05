// Service worker: membuat aplikasi bisa dipasang & tetap terbuka saat sinyal jelek.
// Strategi "jaringan dulu": selalu ambil versi terbaru dari GitHub Pages, cache hanya cadangan.
// Jadi setiap update di GitHub langsung terpakai tanpa pasang ulang.
const CACHE = 'dompet-keluarga-v2';
const INTI = [
  'index.html', 'manifest.webmanifest',
  'assets/styles.css', 'assets/config.js', 'assets/google.js', 'assets/struk.js', 'assets/db.js', 'assets/app.js',
  'ikon/ikon-192.png', 'ikon/apple-touch-icon.png', 'ikon/favicon-32.png',
];
const BATAS_TUNGGU_MS = 5000; // sinyal lambat → pakai cache dulu, versi baru tetap disimpan untuk berikutnya

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(INTI.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

const CACHE_BAGIKAN = 'dk-bagikan'; // gambar/teks dari "Bagikan → Dompet", dibaca app.js (terimaBagikan)

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CACHE && n !== CACHE_BAGIKAN).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Share target (manifest "share_target"): simpan kiriman, lalu buka aplikasi di ./?dibagikan=1.
  if (req.method === 'POST' && url.origin === location.origin && url.searchParams.has('bagikan')) {
    e.respondWith(terimaBagikan(req));
    return;
  }
  // Google API, font, dan versi.txt tidak disentuh.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/versi.txt')) return;
  e.respondWith(jaringanDulu(req, url));
});

async function terimaBagikan(req) {
  try {
    const data = await req.formData();
    await caches.delete(CACHE_BAGIKAN);
    const cache = await caches.open(CACHE_BAGIKAN);
    const gambar = data.getAll('gambar').filter(f => f && f.size && /^image\//.test(f.type));
    await Promise.all(gambar.slice(0, 5).map((f, i) =>
      cache.put(new Request('bagikan/' + i), new Response(f, { headers: { 'Content-Type': f.type } }))));
    const teks = [data.get('title'), data.get('text'), data.get('url')].filter(Boolean).join(' ').trim();
    if (teks) await cache.put(new Request('bagikan/teks'), new Response(teks));
  } catch (err) {
    // Kiriman tidak terbaca: aplikasi tetap dibuka seperti biasa.
  }
  return Response.redirect('./?dibagikan=1', 303);
}

async function jaringanDulu(req, url) {
  const cache = await caches.open(CACHE);
  const kunci = req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;
  const dariJaringan = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res.ok) cache.put(kunci, res.clone());
    return res;
  });
  dariJaringan.catch(() => {}); // kalau offline & dijawab dari cache, jangan jadi error tak tertangani
  const tersimpan = () => cache.match(kunci, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
  try {
    const res = await Promise.race([
      dariJaringan,
      new Promise((_, gagal) => setTimeout(() => gagal(new Error('lambat')), BATAS_TUNGGU_MS)),
    ]);
    return res;
  } catch (err) {
    const r = await tersimpan();
    if (r) return r;
    return dariJaringan; // belum ada cache: tunggu jaringan saja
  }
}
