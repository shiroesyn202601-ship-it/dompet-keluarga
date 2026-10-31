// Service worker: membuat aplikasi bisa dipasang & tetap terbuka saat sinyal jelek.
// Strategi "jaringan dulu": selalu ambil versi terbaru dari GitHub Pages, cache hanya cadangan.
// Jadi setiap update di GitHub langsung terpakai tanpa pasang ulang.
const CACHE = 'dompet-keluarga-v1';
const INTI = [
  'index.html', 'manifest.webmanifest',
  'assets/styles.css', 'assets/config.js', 'assets/google.js', 'assets/struk.js', 'assets/db.js', 'assets/app.js',
  'ikon/ikon-192.png', 'ikon/apple-touch-icon.png', 'ikon/favicon-32.png',
];
const BATAS_TUNGGU_MS = 5000; // sinyal lambat → pakai cache dulu, versi baru tetap disimpan untuk berikutnya

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(INTI.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Google API, font, dan versi.txt tidak disentuh.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/versi.txt')) return;
  e.respondWith(jaringanDulu(req, url));
});

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
