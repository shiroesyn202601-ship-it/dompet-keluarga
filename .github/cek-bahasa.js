// Cek kelengkapan kamus bahasa Inggris (lihat web/assets/bahasa.js). Jalankan: node .github/cek-bahasa.js [file.js ...]
// Tanpa argumen: memeriksa semua web/assets/*.js. Keluar dengan kode 1 kalau ada masalah.
//   - KURANG   : T('...') yang teksnya belum ada di kamus
//   - DINAMIS  : T(...) yang argumen pertamanya bukan teks tetap (kunci kamus harus teks tetap; isian pakai {nama})
//   - ISIAN    : {nama} di kunci dan di terjemahannya tidak sama
//   - TAK DIPAKAI (peringatan saja): entri kamus yang tidak dipanggil di mana pun
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const folder = path.join(__dirname, '..', 'web', 'assets');
const kamusFile = fs.readdirSync(folder).filter(f => /^bahasa-en.*\.js$/.test(f)).map(f => path.join(folder, f));
const konteks = { localStorage: { getItem: () => 'en' }, document: {}, location: {} };
vm.createContext(konteks);
vm.runInContext(fs.readFileSync(path.join(folder, 'bahasa.js'), 'utf8') + ';this.KAMUS = KAMUS;', konteks);
for (const f of kamusFile) vm.runInContext(fs.readFileSync(f, 'utf8'), konteks, { filename: f });
const KAMUS = konteks.KAMUS;

const sasaran = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(folder).filter(f => f.endsWith('.js') && !/^bahasa/.test(f)).map(f => path.join(folder, f));

const LITERAL = /\bT\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.|\$(?!\{))*`)\s*[,)]/g;
const PANGGIL = /\bT\(/g;
const isian = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const dipakai = new Set();
let masalah = 0;

for (const f of sasaran) {
  const isi = fs.readFileSync(f, 'utf8');
  const baris = i => isi.slice(0, i).split('\n').length;
  const terbaca = new Set();
  for (const m of isi.matchAll(LITERAL)) {
    terbaca.add(m.index);
    const kunci = vm.runInNewContext(m[1]);
    dipakai.add(kunci);
    if (!Object.prototype.hasOwnProperty.call(KAMUS, kunci)) {
      console.log(`KURANG   ${path.basename(f)}:${baris(m.index)}  ${JSON.stringify(kunci)}`);
      masalah++;
    }
  }
  for (const m of isi.matchAll(PANGGIL)) {
    if (terbaca.has(m.index)) continue;
    if (/^\s*function\b/.test(isi.slice(isi.lastIndexOf('\n', m.index) + 1, m.index))) continue; // definisi
    console.log(`DINAMIS  ${path.basename(f)}:${baris(m.index)}  ${isi.slice(m.index, m.index + 60).split('\n')[0]}`);
    masalah++;
  }
}
for (const [k, v] of Object.entries(KAMUS)) {
  for (const x of Array.isArray(v) ? v : [v]) {
    if (isian(k) !== isian(x)) { console.log(`ISIAN    ${JSON.stringify(k)} → ${JSON.stringify(x)}`); masalah++; }
  }
}
if (!process.argv.slice(2).length) {
  const takDipakai = Object.keys(KAMUS).filter(k => !dipakai.has(k));
  if (takDipakai.length) console.log(`(peringatan) ${takDipakai.length} entri kamus tidak dipakai: ` + takDipakai.slice(0, 20).map(k => JSON.stringify(k)).join(', '));
}
console.log(masalah ? `${masalah} masalah.` : `Kamus lengkap (${Object.keys(KAMUS).length} entri).`);
process.exit(masalah ? 1 : 0);
