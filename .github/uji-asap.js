// Uji asap (smoke test) sebelum deploy: aplikasi dibuka di mode coba lewat browser tanpa layar, lalu semua tab
// dan dialog utama dibuka satu per satu, dalam bahasa Indonesia dan Inggris. Gagal (kode keluar 1) kalau ada
// error JavaScript di halaman, halaman kosong, atau dialog tidak terbuka.
//
// Jalankan: npm i --no-save playwright@1.47.2 && npx playwright install chromium && node .github/uji-asap.js
// Di komputer yang sudah punya Edge/Chrome cukup playwright-core: UJI_CHANNEL=msedge node .github/uji-asap.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const AKAR = path.join(__dirname, '..', 'web');
const JENIS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.ico': 'image/x-icon' };

function server() {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(AKAR, path.normalize(p));
    if (!f.startsWith(AKAR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': JENIS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok(s)));
}

// Dialog yang dibuka langsung (tanpa argumen). Yang butuh izin perangkat (PIN, lokasi) tidak ikut.
const DIALOG = ['bukaFormTrx', 'bukaRincianAnggaran', 'bukaRingkasPeriode', 'bukaAturPintasan', 'bukaFilter', 'bukaZakat', 'bukaDaftarBuku',
  'bukaCadangan', 'bukaRincianAman', 'bukaFormPeriode', 'bukaAktivitas', 'bukaTips', 'bukaCariGlobal', 'bukaDaftarRutin', 'bukaFormGemini',
  'bukaFormAnggaran', 'bukaGantiAvatar', 'bukaKebiasaan', 'bukaKalender'];
const TAB = ['beranda', 'riwayat', 'dompet', 'laporan', 'catatan', 'lainnya', 'beranda'];

async function uji(browser, alamat, bahasa) {
  const p = await browser.newPage({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
  const galat = [];
  p.on('pageerror', e => galat.push(e.message.split('\n')[0]));
  const tunggu = async (fn, arg, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(200); }
    return false;
  };
  const gagal = [];
  await p.goto(alamat, { waitUntil: 'load' });
  await p.evaluate(b => { localStorage.clear(); localStorage.setItem('dk_bahasa', b); }, bahasa);
  await p.goto(alamat + '?coba', { waitUntil: 'load' });
  if (!(await tunggu(() => !!document.querySelector('.avatar-tombol')))) gagal.push('mode coba tidak terbuka');
  await p.waitForTimeout(800);
  await p.evaluate(() => ['tur', 'kilas', 'pengingat'].forEach(id => { const e = document.getElementById(id); if (e) e.hidden = true; }));

  for (const tab of TAB) {
    await p.evaluate(t => { S.tab = t; tutupSheet(); render(); }, tab);
    await p.waitForTimeout(250);
    const isi = await p.evaluate(() => document.getElementById('view').innerText.trim().length);
    if (isi < 20) gagal.push('tab ' + tab + ' kosong');
  }
  for (const fn of DIALOG) {
    const ada = await p.evaluate(f => typeof window[f] === 'function', fn);
    if (!ada) { gagal.push('fungsi ' + fn + ' tidak ada'); continue; }
    await p.evaluate(f => { tutupSheet(); try { window[f](); } catch (e) { setTimeout(() => { throw e; }); } }, fn);
    await p.waitForTimeout(300);
    const terbuka = await p.evaluate(() => !document.getElementById('sheet').hidden || document.body.dataset.tab === 'catatan');
    if (!terbuka) gagal.push('dialog ' + fn + ' tidak terbuka');
  }
  // Detail emas & form tambah gram.
  await p.evaluate(() => { tutupSheet(); S.tab = 'dompet'; render(); });
  if (await tunggu(() => !!document.querySelector('[data-aksi="lihat-emas"]'), null, 5000)) {
    await p.evaluate(() => document.querySelector('[data-aksi="lihat-emas"]').click());
    await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.querySelector('[data-aksi="mutasi-emas"]'); if (b) b.click(); });
    await p.waitForTimeout(300);
    if (!(await p.evaluate(() => !!document.querySelector('#me-gram')))) gagal.push('form tambah gram tidak terbuka');
  } else gagal.push('emas contoh tidak tampil');

  await p.close();
  return gagal.concat(galat.map(g => 'error JS: ' + g));
}

(async () => {
  const s = await server();
  const alamat = 'http://127.0.0.1:' + s.address().port + '/';
  const browser = await pw.chromium.launch(process.env.UJI_CHANNEL ? { channel: process.env.UJI_CHANNEL } : {});
  let semua = [];
  try {
    for (const b of ['id', 'en']) {
      const g = await uji(browser, alamat, b);
      semua = semua.concat(g.map(x => '[' + b + '] ' + x));
    }
  } finally {
    await browser.close();
    s.close();
  }
  if (semua.length) {
    console.log('❌ Uji asap gagal:\n' + Array.from(new Set(semua)).map(x => '  - ' + x).join('\n'));
    process.exit(1);
  }
  console.log('✅ Uji asap lolos (' + TAB.length + ' tab, ' + (DIALOG.length + 1) + ' dialog, 2 bahasa)');
})().catch(e => { console.error('❌ Uji asap tidak bisa dijalankan:', e.message); process.exit(1); });
