/**
 * Bahasa tampilan: 'id' (bawaan) atau 'en'. Dipilih di ⚙️ → Tampilan & keamanan (atau di layar masuk),
 * disimpan per perangkat (localStorage 'dk_bahasa'); mengganti bahasa memuat ulang aplikasi.
 *
 * Teks di kode tetap ditulis dalam bahasa Indonesia dan sekaligus menjadi KUNCI kamus:
 *   T('Simpan')                                  → 'Save' saat bahasa Inggris
 *   T('Lanjutkan sebagai {email}', { email })    → isian {nama} diganti setelah diterjemahkan
 *   T('{n} transaksi', { n })                    → nilai kamus boleh [tunggal, jamak], dipilih dari n
 *   T('Lainnya||menu')                           → konteks setelah || membedakan terjemahan; tidak ditampilkan
 * Kamus Inggris ada di bahasa-en.js. Teks yang belum ada di kamus tampil apa adanya (bahasa Indonesia).
 * Cek kelengkapan kamus: node .github/cek-bahasa.js
 *
 * Data di spreadsheet (nama kategori, dompet, tipe transaksi) TIDAK diterjemahkan — tetap bahasa Indonesia supaya
 * satu buku bisa dipakai bersama anggota yang memilih bahasa berbeda. Nama bawaan hanya diterjemahkan saat
 * ditampilkan, lewat namaT() dan KAMUS_NAMA.
 */
const BAHASA = (() => {
  try { return localStorage.getItem('dk_bahasa') === 'en' ? 'en' : 'id'; } catch (e) { return 'id'; }
})();
/** Locale untuk tanggal & nama bulan/hari. Nominal rupiah tetap berformat Indonesia (Rp25.000) di kedua bahasa. */
const LOKAL = BAHASA === 'en' ? 'en-GB' : 'id-ID';
/** Kamus teks antarmuka: { 'teks Indonesia': 'English' | ['tunggal', 'jamak'] }. Diisi bahasa-en.js. */
const KAMUS = {};
/** Kamus nama data bawaan (kategori/dompet awal, tipe, jenis, pengulangan). Diisi bahasa-en.js. */
const KAMUS_NAMA = {};
/** Teks yang diminta tapi belum ada di kamus (untuk pengembang: lihat di console → BAHASA_KURANG). */
const BAHASA_KURANG = new Set();

function T(teks, isi) {
  // 'Lainnya||menu': teks Indonesia sama tapi terjemahannya beda menurut konteks; bagian setelah || tidak ditampilkan.
  let s = teks.split('||')[0];
  if (BAHASA === 'en') {
    if (Object.prototype.hasOwnProperty.call(KAMUS, teks)) s = KAMUS[teks];
    else BAHASA_KURANG.add(teks);
  }
  if (Array.isArray(s)) s = isi && Number(isi.n) === 1 ? s[0] : s[1];
  if (isi) s = String(s).replace(/\{(\w+)\}/g, (m, k) => (k in isi ? isi[k] : m));
  return s;
}

/** Nama data untuk ditampilkan: 'Makan & Minum' → 'Food & Drinks' (bahasa Inggris). Nama buatan pengguna apa adanya. */
function namaT(nama) {
  return BAHASA === 'en' && Object.prototype.hasOwnProperty.call(KAMUS_NAMA, nama) ? KAMUS_NAMA[nama] : nama;
}

function gantiBahasa(b) {
  try {
    if (b === 'en') localStorage.setItem('dk_bahasa', 'en');
    else localStorage.removeItem('dk_bahasa');
  } catch (e) { /* mode privat */ }
  location.reload();
}

/** Teks statis di index.html: elemen ber-data-t (teks terakhirnya) dan ber-data-t-label (aria-label). */
function terjemahkanHalaman() {
  document.documentElement.lang = BAHASA;
  if (BAHASA === 'id') return;
  document.querySelectorAll('[data-t]').forEach(el => {
    const n = [...el.childNodes].reverse().find(c => c.nodeType === 3 && c.textContent.trim());
    if (n) n.textContent = T(n.textContent.trim());
  });
  document.querySelectorAll('[data-t-label]').forEach(el => el.setAttribute('aria-label', T(el.getAttribute('aria-label'))));
}
