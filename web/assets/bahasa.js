/**
 * Bahasa tampilan: 'id' (bawaan) atau 'en'. Bahasa Indonesia punya dua gaya: formal & santai (lihat GAYA). Dipilih di ⚙️ → Tampilan & keamanan (atau di layar masuk),
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

/**
 * Gaya bahasa Indonesia: 'formal' (bawaan, "Anda") atau 'santai' ("kamu", lebih akrab). Dipilih di
 * ⚙️ → Tampilan & keamanan, disimpan per perangkat (localStorage 'dk_gaya'); hanya berlaku untuk bahasa Indonesia.
 * Gaya santai: teks yang ada di KAMUS_SANTAI diganti utuh; teks lain cukup "Anda" → "kamu"/"Kamu".
 * Penggantian dilakukan SEBELUM isian {nama} diisi, jadi data pengguna yang memuat kata "Anda" tidak ikut berubah.
 */
const GAYA = (() => {
  try { return BAHASA === 'id' && localStorage.getItem('dk_gaya') === 'santai' ? 'santai' : 'formal'; } catch (e) { return 'formal'; }
})();
const KAMUS_SANTAI = {
  'Halo,': 'Hai,',
  'Transaksi tersimpan ✔': 'Sip, tersimpan ✔',
  'Transaksi diperbarui ✔': 'Oke, sudah diperbarui ✔',
  'Tersimpan ✔': 'Sip, tersimpan ✔',
  'Dihapus': 'Udah dihapus',
  'Isi jumlahnya dulu.': 'Nominalnya diisi dulu, ya.',
  'Pilih kategorinya dulu.': 'Kategorinya dipilih dulu, ya.',
  'Belum ada transaksi. Ketuk tombol ＋ untuk mencatat.': 'Masih kosong nih. Ketuk ＋ buat mulai nyatet ✍️',
  'Belum ada pengeluaran bulan ini.': 'Belum ada jajan bulan ini. Mantap 😎',
  'Batas periode ini sudah terlewati': 'Waduh, batas periode ini udah kelewat',
  'Aman dibelanjakan <b>{jumlah}/hari</b> · {n} hari lagi': 'Aman jajan <b>{jumlah}/hari</b> · {n} hari lagi',
  'Belum ada tabungan. Buat tabungan dengan target (mis. dana darurat, liburan) atau tanpa batas.': 'Belum ada tabungan. Yuk bikin satu: dana darurat, liburan, atau apa aja yang kamu impikan ✨',
  'Hemat {jumlah} dari bulan sebelumnya. Mantap! 🎉': 'Hemat {jumlah} dari bulan sebelumnya. Keren banget! 🎉',
  'Pengeluaran naik {jumlah}. Cek lagi kategori yang membengkak, ya.': 'Pengeluaran naik {jumlah}. Coba intip kategori yang bengkak, ya 👀',
  // Fitur kebiasaan, insight Beranda, dan cek sebelum beli (muda.js)
  'Cek sebelum beli': 'Bisa beli nggak?',
  'Cek beli': 'Bisa beli?',
  'Rangkuman {bulan} saya: {persona} {emoji}': 'Rangkuman {bulan} aku: {persona} {emoji}',
  'Tetap catat': 'Tetap catat aja',
  'Mau beli apa?': 'Mau beli apa nih?',
  '{kategori} sudah lewat batas {jumlah}. Coba rem dulu, ya.': '{kategori} udah jebol {jumlah}. Rem dulu, ya 🫣',
  'Cek sebelum beli 🤔': 'Bisa beli nggak? 🤔',
  'Hari ini tanpa belanja': 'Hari ini nggak jajan',
  'Tandai hari ini tanpa belanja': 'Hari ini nggak jajan ✋',
  'Hari tanpa belanja': 'Hari tanpa jajan',
  '✅ Aman dibeli': '✅ Aman, gas!',
  '⚠️ Bisa, tapi harus berhemat': '⚠️ Bisa, tapi harus ngirit',
  '⛔ Sebaiknya jangan dulu': '⛔ Jangan dulu, deh',
  'Sampai hari ini pengeluaran Anda {persen}% lebih hemat dari periode lalu 👏': 'Sampai hari ini kamu {persen}% lebih hemat dari periode lalu 👏',
  'Minggu ini Anda {persen}% lebih hemat dari biasanya 👏': 'Minggu ini kamu {persen}% lebih hemat dari biasanya 👏',
  'Minggu ini belanja {persen}% lebih banyak dari biasanya. Rem sedikit, ya.': 'Minggu ini jajanmu {persen}% lebih banyak dari biasanya. Rem dikit, ya 🫣',
  'Belum ada catatan hari ini. Catat sebelum lupa ✍️': 'Belum nyatet hari ini. Yuk catat sebelum lupa ✍️',
  'Pengeluaran {kategori} sudah {jumlah} periode ini.': 'Jajan {kategori} kamu udah {jumlah} periode ini {emoji}',
  '{n} hari beruntun mencatat. Pertahankan! 🔥': '{n} hari beruntun nyatet. Jangan putus! 🔥',
  'Anggaran periode ini sudah terlewati. Tahan dulu belanja yang tidak penting.': 'Anggaran periode ini udah jebol. Tahan dulu jajan yang nggak penting, ya 🙏',
  'Hari ini masih aman belanja {jumlah}. Santai saja 😌': 'Hari ini masih aman jajan {jumlah}. Santuy 😌',
};
/** "Anda" → "kamu"; di awal kalimat (atau sesudah emoji/tag di awal) → "Kamu". */
function santaikan(s) {
  return String(s).replace(/\bAnda\b/g, (m, i, str) => {
    const sebelum = str.slice(0, i).replace(/<[^>]*>/g, '').trimEnd();
    return !sebelum || /[.!?:\n]$/.test(sebelum) || !/[\p{L}\p{N}]/u.test(sebelum) ? 'Kamu' : 'kamu';
  });
}
function gantiGaya(g) {
  try {
    if (g === 'santai') localStorage.setItem('dk_gaya', 'santai');
    else localStorage.removeItem('dk_gaya');
  } catch (e) { /* mode privat */ }
  location.reload();
}

function T(teks, isi) {
  // 'Lainnya||menu': teks Indonesia sama tapi terjemahannya beda menurut konteks; bagian setelah || tidak ditampilkan.
  let s = teks.split('||')[0];
  if (BAHASA === 'en') {
    if (Object.prototype.hasOwnProperty.call(KAMUS, teks)) s = KAMUS[teks];
    else BAHASA_KURANG.add(teks);
  } else if (GAYA === 'santai') {
    s = Object.prototype.hasOwnProperty.call(KAMUS_SANTAI, teks) ? KAMUS_SANTAI[teks] : santaikan(s);
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
