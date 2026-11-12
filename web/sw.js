// Service worker: membuat aplikasi bisa dipasang, terbuka seketika, dan tetap jalan saat sinyal jelek.
//
// Isi aplikasi (INTI) diambil dari CACHE DULU, jadi splash screen Android langsung hilang tanpa menunggu
// internet. Pembaruannya diatur halaman (app.js → cekPembaruan): kalau versi.txt di server lebih baru dari
// versi isi cache, halaman meminta "perbarui" ke service worker ini, yang mengunduh SEMUA file INTI versi
// baru sekaligus lalu menggantinya di cache, baru kemudian halaman dimuat ulang. Dengan begitu isi cache
// selalu satu versi utuh (tidak campur file lama & baru) dan tidak ada muat ulang berulang.
// File lain (changelog.json, privasi.html, ikon besar, dll.) tetap "jaringan dulu".
const CACHE = 'dompet-keluarga-v5';
const INTI = [
  'index.html', 'manifest.webmanifest',
  'assets/styles.css', 'assets/bahasa.js', 'assets/bahasa-en.js', 'assets/config.js', 'assets/google.js', 'assets/demo.js', 'assets/struk.js', 'assets/sholat.js', 'assets/ilustrasi.js', 'assets/db.js',
  'assets/app.js', 'assets/app-halaman.js', 'assets/app-form.js', 'assets/app-aksi.js', 'assets/app-catatan.js', 'assets/app-interaksi.js', 'assets/app-fitur.js', 'assets/muda.js',
  'ikon/ikon-192.png', 'ikon/apple-touch-icon.png', 'ikon/favicon-32.png',
];
/** Versi isi cache disimpan di cache dengan kunci ini (dibaca app.js lewat caches.match('versi.txt')). */
const KUNCI_VERSI = 'versi.txt';
const BATAS_TUNGGU_MS = 5000; // file "jaringan dulu": sinyal lambat → pakai cache dulu

self.addEventListener('install', e => {
  e.waitUntil(isiCache(true).catch(() => {}).then(() => self.skipWaiting()));
});

const CACHE_BAGIKAN = 'dk-bagikan'; // gambar/teks dari "Bagikan → Dompet", dibaca app.js (terimaBagikan)

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CACHE && n !== CACHE_BAGIKAN).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

/** Halaman meminta pembaruan: { perbarui: true } lewat MessageChannel → dibalas { v } atau { galat }. */
self.addEventListener('message', e => {
  if (!e.data || !e.data.perbarui || !e.ports[0]) return;
  e.waitUntil(isiCache(false).then(
    v => e.ports[0].postMessage({ v }),
    err => e.ports[0].postMessage({ galat: String(err && err.message || err) }),
  ));
});

/**
 * Mengunduh semua file INTI versi server lalu menaruhnya di cache. Versi dibaca DULUAN, supaya kalau ada
 * deploy di tengah jalan, label versi paling-paling lebih lama dari isinya (memicu satu pembaruan ekstra
 * yang aman), bukan sebaliknya. `paksa` = tetap unduh walau versinya sama (saat pasang pertama kali).
 */
async function isiCache(paksa) {
  const r = await fetch(KUNCI_VERSI, { cache: 'no-store' });
  if (!r.ok) throw new Error('versi.txt HTTP ' + r.status);
  const v = (await r.text()).trim();
  const cache = await caches.open(CACHE);
  const lama = await cache.match(KUNCI_VERSI);
  if (!paksa && lama && (await lama.text()).trim() === v) return v;
  // Semua diunduh dulu; cache baru diubah kalau semuanya berhasil.
  const jawaban = await Promise.all(INTI.map(u => fetch(u, { cache: 'reload' }).then(res => {
    if (!res.ok) throw new Error(u + ' HTTP ' + res.status);
    return [u, res];
  })));
  await Promise.all(jawaban.map(([u, res]) => cache.put(u, res)));
  await cache.put(KUNCI_VERSI, new Response(v));
  return v;
}

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
  const inti = fileInti(req, url);
  e.respondWith(inti ? dariCache(req, url, inti) : jaringanDulu(req, url));
});

/** Nama file INTI untuk permintaan ini ('index.html' untuk membuka aplikasi), atau null. */
function fileInti(req, url) {
  const dasar = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(dasar)) return null;
  const jalur = url.pathname.slice(dasar.length);
  if (req.mode === 'navigate') return jalur === '' || jalur === 'index.html' ? 'index.html' : null;
  // Halaman lain (mis. admin.html) memakai config.js/google.js yang sama tapi tidak ikut pembaruan aplikasi:
  // ambil dari jaringan supaya tidak mendapat versi lama dari cache.
  try { if (req.referrer && !/\/(index\.html)?$/.test(new URL(req.referrer).pathname)) return null; } catch (e) { /* referrer tidak terbaca */ }
  return INTI.includes(jalur) ? jalur : null;
}

async function dariCache(req, url, nama) {
  const cache = await caches.open(CACHE);
  const r = await cache.match(nama);
  return r || jaringanDulu(req, url); // belum tersimpan (mis. pertama kali dibuka)
}

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
    // Server mengalihkan (mis. privasi.html → /privasi): halaman navigasi tidak boleh menerima jawaban
    // "redirected" dari service worker, jadi browser diminta pindah ke alamat barunya.
    if (res.redirected && req.mode === 'navigate') return Response.redirect(res.url, 302);
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
