// Membuat web/changelog.json dari pesan commit (dijalankan saat deploy, lihat workflows/deploy.yml).
// Versi tiap commit = "1.<jumlah commit sampai commit itu>", sama dengan versi.txt yang tampil di aplikasi.
// Hanya judul commit (baris pertama) yang dipakai; baris Co-Authored-By dan isi lainnya tidak ikut.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const total = Number(execSync('git rev-list --count HEAD').toString().trim());
const mentah = execSync('git log -n 120 --first-parent --format=%ad%x1f%s%x1e --date=short').toString();
const log = mentah.split('\x1e').map(s => s.trim()).filter(Boolean).map((baris, i) => {
  const [tanggal, judul] = baris.split('\x1f');
  return { v: '1.' + (total - i), tanggal, judul: judul.trim() };
}).filter(x => x.judul && !/^Merge /.test(x.judul));

const tujuan = path.join(__dirname, '..', 'web', 'changelog.json');
fs.writeFileSync(tujuan, JSON.stringify(log));
console.log('changelog.json: ' + log.length + ' entri, terbaru ' + (log[0] && log[0].v));
