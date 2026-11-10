const PILIHAN_IKON = ['🍜', '🛒', '⛽', '🚗', '🛵', '💡', '🏠', '💊', '📚', '👶', '🍼', '🎬', '👕', '🤲', '📦', '☕',
  '🎮', '✈️', '🐱', '📞', '🔧', '🧾', '💼', '🎁', '🏪', '📈', '💰', '💵', '🏦', '📱', '💳', '👛',
  '🐷', '🎯', '🏖️', '🎓', '💍', '🕋', '🏍️', '🛡️'];

const S = {
  data: null,
  bulan: '', // kunci periode 'yyyy-mm' yang dilihat; '' = periode berjalan (diisi setelah data dimuat)
  tab: 'beranda',
  filterTipe: 'Semua',
  cari: '',
  gabung: '', // ID spreadsheet dari link undangan (#gabung=...)
  tahun: new Date().getFullYear(), // tahun yang dilihat di Laporan
  lapKategori: 'bulan',            // Laporan → pengeluaran per kategori: 'bulan' | 'tahun'
  setup: { pilih: ['Tunai'], saldo: {}, lain: [], email: '' }, // isian layar setup pertama kali
  offline: false, // true = tanpa sinyal, menampilkan data terakhir yang tersimpan di HP
  sesiHabis: false, // true = dibuka dengan token Google kedaluwarsa, menampilkan data terakhir sampai tersambung lagi
  filter: { rentang: 'periode', dari: '', sampai: '', kategori: '', dompet: '', oleh: '', lampiran: false }, // filter Riwayat (lihat FILTER_KOSONG)
  pilih: null,          // Riwayat: Set ID transaksi yang dipilih (tekan lama), null = tidak sedang memilih
  modeRiwayat: (() => { try { return localStorage.getItem('dk_mode_riwayat') || 'daftar'; } catch (e) { return 'daftar'; } })(), // 'daftar' | 'kalender'
  hariKalender: '',     // tanggal yang diketuk di kalender Riwayat
  cariData: null,     // transaksi lintas bulan untuk Riwayat: { kunci, transaksi, memuat? }
  batasRiwayat: 200,  // jumlah transaksi yang ditampilkan sebelum "Tampilkan lebih banyak"
};
/** Pilihan cepat di layar setup: [nama, ikon]. */
const DOMPET_UMUM = [['Tunai', '💵'], ['BCA', '🏦BCA'], ['BRI', '🏦BRI'], ['Mandiri', '🏦Mandiri'], ['BNI', '🏦BNI'], ['BSI', '🏦BSI'],
  ['Jago', '🏦Jago'], ['SeaBank', '🏦SeaBank'], ['blu', '🏦blu'], ['GoPay', '📱GoPay'], ['OVO', '📱OVO'], ['DANA', '📱DANA'],
  ['ShopeePay', '📱ShopeePay'], ['LinkAja', '📱LinkAja']];
let F = null; // state form yang sedang terbuka

// ---------- Laporan error ----------
// Error JavaScript yang tidak tertangani di HP pengguna dicatat ke sheet Log spreadsheet keluarga itu sendiri
// (Aksi = "galat"), tanpa layanan luar. Maksimal 5 per sesi, pesan yang sama sekali saja; tidak di mode coba/offline.
const galatTerlapor = new Set();
function laporGalat(pesan, lokasi) {
  try {
    pesan = String(pesan || '').replace(/^Uncaught\s+/, '').replace(/^Error:\s*/, '').slice(0, 140);
    if (!pesan || /^Script error\.?$|ResizeObserver loop/i.test(pesan)) return;
    if (galatTerlapor.has(pesan) || galatTerlapor.size >= 5) return;
    if (DEMO.aktif() || !GOOGLE.sudahMasuk() || !S.data || S.data.perluSetup || S.offline || !navigator.onLine) return;
    galatTerlapor.add(pesan);
    const ua = navigator.userAgent;
    const perangkat = (ua.match(/Android [\d.]+|iPhone OS [\d_]+|iPad|Windows NT [\d.]+|Mac OS X [\d_]+|Linux/) || ['?'])[0]
      + ' · ' + ((ua.match(/(Edg|SamsungBrowser|Firefox|CriOS)\/\d+/) || ua.match(/(Chrome|Version)\/\d+/) || ['?'])[0]);
    let versi = '';
    try { versi = versiAwal ? 'v' + versiAwal : ''; } catch (e) { /* belum dimuat */ }
    SERVER.catatGalat([pesan, lokasi, S.tab, versi, perangkat].filter(Boolean).join(' · ')).catch(() => {});
  } catch (e) { /* laporan error tidak boleh menimbulkan error baru */ }
}
window.addEventListener('error', e => {
  if (e.filename && !e.filename.startsWith(location.origin)) return; // skrip pihak lain (ekstensi, Google)
  laporGalat(e.message, e.filename ? e.filename.split('/').pop() + ':' + e.lineno : '');
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  if (!r || r.jaringan || r.name === 'AbortError' || (typeof GOOGLE !== 'undefined' && r instanceof GOOGLE.PerluMasuk)) return;
  const asal = String(r.stack || '').split('\n').find(b => b.includes(location.origin)) || '';
  laporGalat(r.message || String(r), (asal.match(/([\w-]+\.js:\d+)/) || [])[1] || '');
});

terjemahkanHalaman(); // teks statis index.html (lihat bahasa.js)

// Font dipasang di sini, bukan sebagai <link rel="stylesheet"> di index.html, supaya layar pertama
// (dan splash screen Android) tidak menunggu Google Fonts. Teks tampil dulu dengan font sistem.
(() => {
  const p = document.getElementById('font-utama');
  if (!p) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = p.href;
  document.head.appendChild(l);
})();

// ---------- Util ----------

async function api(fungsi, ...args) {
  try {
    return await SERVER[fungsi](...args);
  } catch (e) {
    if (e instanceof GOOGLE.PerluMasuk) perluMasukLagi();
    throw e;
  }
}
function bulanSekarang() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function hariIni() {
  const d = new Date();
  return bulanSekarang() + '-' + String(d.getDate()).padStart(2, '0');
}
function keTanggal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}
function rp(n) {
  return (n < 0 ? '−Rp' : 'Rp') + new Intl.NumberFormat('id-ID').format(Math.abs(n));
}
/** Nominal besar (kartu saldo, kartu dompet): "Rp" kecil di depan angka tebal. Hasilnya HTML. */
function rpBesar(n) {
  return `${n < 0 ? '−' : ''}<span class="mata-uang">Rp</span>${new Intl.NumberFormat('id-ID').format(Math.abs(n))}`;
}
/** Nominal ringkas untuk sumbu grafik: 1,5jt, 250rb. */
function rpPendek(n) {
  const f = (x, s) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(x) + s;
  const a = Math.abs(n);
  if (a >= 1e9) return f(n / 1e9, T('M||miliar'));
  if (a >= 1e6) return f(n / 1e6, T('jt'));
  if (a >= 1e3) return f(n / 1e3, T('rb'));
  return String(n);
}
function formatAngka(n) {
  return n ? new Intl.NumberFormat('id-ID').format(n) : '';
}
/** Ikon garis (gaya lucide), digambar dengan currentColor. */
const IKON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  kamera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  transfer: '<path d="M7 7h13l-4-4"/><path d="M17 17H4l4 4"/>',
  laporan: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  dompet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  kalender: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3M7.5 17h6"/>',
  masjid: '<path d="M12 3c2.5 2 4.5 3.6 4.5 6.5V11h-9V9.5C7.5 6.6 9.5 5 12 3z"/><path d="M4 21V11h16v10"/><path d="M2 21h20"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M4 11V8M20 11V8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  kembali: '<path d="m15 18-6-6 6-6"/>',
  cari: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  maju: '<path d="m9 18 6-6-6-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  pensil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  celengan: '<path d="M19 9.5c-.5-3-3.6-5.5-7.5-5.5C7.4 4 4 7 4 10.7c0 2 1 3.8 2.6 5V19h3v-1.5h4V19h3v-3.2c1-.7 1.8-1.6 2.3-2.8H21v-3.5z"/><path d="M15.5 9.5h.01"/>',
  tangan: '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.8l-4.2 3.9"/><path d="m2 15 6 6"/>',
  tagihan: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  // Ikon Sorotan Laporan (garis, ikut warna status butirnya)
  naik: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  turun: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  peringatan: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  senyum: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"/>',
  tunas: '<path d="M7 21h10M12 21v-9"/><path d="M12 12c0-3.3-2.7-6-6-6H4v1c0 3.3 2.7 6 6 6h2"/><path d="M12 10c0-2.8 2.2-5 5-5h3v1c0 2.8-2.2 5-5 5h-3"/>',
  ramal: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  // Layar masuk: keunggulan aplikasi
  berdua: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  obrolan: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
  gembok: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v2"/>',
  nyala: '<path d="M12 22c4 0 7-2.7 7-6.7 0-3.3-2.3-5.6-3.6-7.3-.4 1.8-1.4 3-2.6 3.6.2-3.4-1.4-6.6-4.3-8.6.2 3-1.4 5-3 6.8C4.3 11.2 5 13.6 5 15.3 5 19.3 8 22 12 22z"/>',
};
const svg = nama => `<svg class="ik" viewBox="0 0 24 24" aria-hidden="true">${IKON[nama]}</svg>`;

const dompetBiasa = () => S.data.dompet.filter(w => w.jenis === JENIS.DOMPET);
const daftarUtang = () => S.data.dompet.filter(w => w.jenis === JENIS.UTANG);
const adalahUtang = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.UTANG);
const daftarAset = () => S.data.dompet.filter(w => w.jenis === JENIS.ASET);
const adalahAset = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.ASET);
/** Aset emas dicatat dalam gram: tidak ikut transfer rupiah biasa (tambah/kurangi lewat detail emas). */
const adalahEmas = nama => !!((S.data && S.data.emas) || {})[nama] && adalahAset(nama);
const trxEmas = t => !!t && t.tipe === TIPE.TRANSFER && (adalahEmas(t.dompet) || adalahEmas(t.dompetTujuan));
/** Dompet yang boleh dipilih untuk transfer: semua kecuali emas. */
const dompetTransfer = () => S.data.dompet.filter(w => !adalahEmas(w.nama));
const daftarTabungan = () => S.data.dompet.filter(w => w.jenis === JENIS.TABUNGAN);
const adalahTabungan = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.TABUNGAN);
function angka(s) {
  return Number(String(s).replace(/\D/g, '')) || 0;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Nama periode: "November 2026", atau "25 Okt – 24 Nov 2026" kalau periode gajian tidak mulai tanggal 1. */
function namaBulan(b) {
  const mulai = S.data && S.data.mulaiPeriode || 1;
  if (mulai === 1) return keTanggal(b).toLocaleDateString(LOKAL, { month: 'long', year: 'numeric' });
  const r = SERVER.rentangPeriode(b, mulai);
  const f = (s, opsi) => keTanggal(s).toLocaleDateString(LOKAL, opsi);
  return f(r.awal, { day: 'numeric', month: 'short' }) + ' – ' + f(r.akhir, { day: 'numeric', month: 'short', year: 'numeric' });
}
/** Kunci periode yang sedang berjalan (mengikuti tanggal gajian). */
function periodeSekarang() {
  return S.data && S.data.mulaiPeriode > 1 ? SERVER.periodeDari(hariIni(), S.data.mulaiPeriode) : bulanSekarang();
}
function labelTanggal(s) {
  if (s === hariIni()) return T('Hari ini');
  const kemarin = new Date(); kemarin.setDate(kemarin.getDate() - 1);
  if (keTanggal(s).toDateString() === kemarin.toDateString()) return T('Kemarin');
  return keTanggal(s).toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'short' });
}
/** Nama panggilan dari email: "galang.setiawan.syn@gmail.com" → "Galang" (kata pertama sebelum . _ - atau angka). */
function namaPendek(email) {
  const lokal = String(email || '').split('@')[0];
  const n = lokal.split(/[._\-+\d]+/).find(Boolean) || lokal;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
function total(trx, tipe) {
  return trx.filter(t => t.tipe === tipe).reduce((a, t) => a + t.jumlah, 0);
}
function ikonKategori(nama, tipe) {
  const k = S.data.kategori.find(k => k.nama === nama && k.tipe === tipe);
  return k ? k.ikon : '🏷️';
}
function ikonDompet(nama) {
  const w = S.data.dompet.find(w => w.nama === nama);
  return w ? w.ikon : '👛';
}
function $(sel) { return document.querySelector(sel); }
/** Ikon kategori/dompet sebagai ilustrasi berwarna (ilustrasi.js); emoji lain tetap emoji. */
const ilus = e => (typeof ILUSTRASI !== 'undefined' ? ILUSTRASI.html(e, esc) : esc(e));
/** Ikon untuk teks biasa (mis. <option>): ubin merek '🏦BCA' → '🏦'. */
const emojiIkon = e => String(e || '').replace(/^(\p{Extended_Pictographic}️?)[A-Za-z].*$/u, '$1');
/** Ikon umum yang boleh diganti ubin merek saat ditampilkan (dompet lama yang dibuat sebelum ada ubin merek). */
const IKON_UMUM_DOMPET = ['🏦', '📱', '💳', '👛', ''];
/**
 * Dompet lama ber-ikon umum yang namanya merek dikenal (mis. "BCA" + 🏦) tampil dengan ubin mereknya.
 * Hanya di tampilan; spreadsheet baru berubah kalau dompetnya disimpan ulang.
 */
const sudahDiperkaya = new WeakSet();
function perkayaIkonDompet(d) {
  if (!d || !d.dompet || sudahDiperkaya.has(d.dompet) || typeof ILUSTRASI === 'undefined') return;
  d.dompet.forEach(w => {
    if (w.jenis !== JENIS.DOMPET || !IKON_UMUM_DOMPET.includes(w.ikon || '')) return;
    const m = ILUSTRASI.tebakMerek(w.nama);
    if (m) w.ikon = m;
  });
  sudahDiperkaya.add(d.dompet);
}

function loading(ya) { $('#loading').hidden = !ya; }
let timerToast;
let trxTerhapus = null; // baris terakhir yang dihapus, untuk tombol "Urungkan"
let catatanTerhapus = null;
/** tombol (opsional): { label, aksi } → tombol di dalam toast, mis. "Urungkan"; toast tampil lebih lama. */
function toast(pesan, error, tombol) {
  const el = $('#toast');
  el.textContent = pesan;
  if (tombol) el.insertAdjacentHTML('beforeend', `<button type="button" data-aksi="${esc(tombol.aksi)}">${esc(tombol.label)}</button>`);
  el.className = 'toast' + (error ? ' error' : '') + (tombol ? ' ada-tombol' : '');
  el.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.hidden = true; }, error ? 8000 : tombol ? 6000 : 2500);
}
/**
 * Pengganti confirm() bawaan browser, bergaya aplikasi. Hasil: Promise<boolean>.
 * ya: label tombol utama; aman: true kalau tindakannya tidak merusak (tombol tidak merah).
 */
function tanya(pesan, ya = T('Lanjutkan'), aman) {
  const el = $('#tanya');
  el.innerHTML = `
    <div class="sesi-kartu">
      <p id="tanya-pesan">${esc(pesan)}</p>
      <button type="button" class="btn ${aman ? 'btn-utama' : 'btn-bahaya'}" data-jawab="1">${esc(ya)}</button>
      <button type="button" class="tombol-teks" data-jawab="">${T('Batal')}</button>
    </div>`;
  el.hidden = false;
  el.querySelector('[data-jawab="1"]').focus();
  return new Promise(selesai => {
    const jawab = v => {
      el.hidden = true;
      el.innerHTML = '';
      el.onclick = null;
      document.removeEventListener('keydown', tombol);
      selesai(v);
    };
    const tombol = e => { if (e.key === 'Escape') jawab(false); };
    document.addEventListener('keydown', tombol);
    el.onclick = e => {
      const b = e.target.closest('[data-jawab]');
      if (b) jawab(!!b.dataset.jawab);
      else if (e.target === el) jawab(false); // ketuk di luar kartu = batal
    };
  });
}
function pesanError(e) {
  return (e && e.message ? e.message : String(e)).replace(/^Error:\s*/, '');
}

// ---------- Muat & render ----------

async function mulai() {
  const m = location.hash.match(/gabung=([\w-]{20,})/);
  if (m) {
    S.gabung = m[1];
    history.replaceState(null, '', location.pathname + location.search);
  }
  // ?coba (tautan "Coba sekarang" di tentang.html): langsung masuk mode coba, kecuali sudah login sungguhan.
  if (/[?&#]coba\b/.test(location.search + location.hash)) {
    history.replaceState(null, '', location.pathname);
    if (!GOOGLE.sudahMasuk() && !S.gabung) mulaiDemo();
  }
  pulihkanPosisi();
  if (GOOGLE.sudahMasuk()) {
    // Tampilkan data terakhir di HP seketika (kalau periodenya sama), lalu perbarui dari spreadsheet di latar.
    const d = bacaLokal('data', null);
    if (d && !d.perluSetup && (!S.bulan || S.bulan === d.bulan)) {
      S.data = d;
      S.bulan = d.bulan;
      S.menyegarkan = true;
      $('#nav').hidden = false;
      render();
    }
    muat();
  }
  else if (!navigator.onLine && pakaiDataTerakhir()) { /* tanpa sinyal: tetap bisa mencatat, login menyusul saat online */ }
  // Token habis (dibuka lagi > 1 jam kemudian): tampilkan data terakhir di HP, jangan lempar ke layar login.
  // Ketukan pertama di mana saja menyambung ulang diam-diam (lihat GOOGLE.segarkanKalauPerlu).
  else if (GOOGLE.email() && pakaiDataTerakhir(false)) S.sesiHabis = true;
  else tampilMasuk();
}

async function muat() {
  try {
    if (S.gabung) {
      // Tetap disimpan kalau gagal, supaya "Coba lagi" mengulang setelah pemilik memberi akses.
      await api('hubungkanDatabase', S.gabung);
      S.gabung = '';
      tulisHp('dk_tur_tunda', '1'); // anggota baru: tur singkat setelah data tampil
      toast(T('Berhasil bergabung ke Dompet Keluarga ✔'));
    }
    S.data = await api('getData', S.bulan);
    semuaTrxCari = null; // pencarian / label membaca ulang data terbaru
    S.menyegarkan = false;
    S.offline = false;
    S.sesiHabis = false;
    $('#nav').hidden = !!S.data.perluSetup;
    if (S.data.perluSetup) $('#view').innerHTML = viewSetup();
    else {
      S.bulan = S.data.bulan; // kosong = periode berjalan, ditentukan server dari tanggal gajian
      S.cariData = null;      // hasil cari lintas bulan dibaca ulang (mungkin baru ada yang diubah)
      tulisLokal('data', S.data);
      render();
      kirimTertunda();
      kirimCatatanTertunda();
      cadangkanNanti();
      cekTur();
      cekAjakAi(); // buku tanpa kunci Gemini: ajak mengaktifkan AI (menunggu tur selesai)
    }
  } catch (e) {
    if (S.menyegarkan) { S.menyegarkan = false; if (S.data) render(); }
    if (e instanceof GOOGLE.PerluMasuk) return;
    if (e.jaringan && pakaiDataTerakhir()) return;
    if (!S.data || S.data.perluSetup) {
      $('#nav').hidden = true;
      $('#view').innerHTML = viewGagal(e);
    } else {
      toast(pesanError(e), true);
    }
  }
}

// ---------- Offline: data terakhir & transaksi tertunda ----------

/** Penyimpanan HP per akun: 'data' (data terakhir dari spreadsheet) dan 'tertunda' (dicatat tanpa sinyal). */
const kunciHp = jenis => 'dk_' + jenis + '_' + (GOOGLE.email() || '');
function bacaLokal(jenis, cadangan) {
  try { return JSON.parse(localStorage.getItem(kunciHp(jenis))) || cadangan; } catch (e) { return cadangan; }
}
function tulisLokal(jenis, isi) {
  try {
    if (isi == null) localStorage.removeItem(kunciHp(jenis));
    else localStorage.setItem(kunciHp(jenis), JSON.stringify(isi));
  } catch (e) { /* penyimpanan penuh / mode privat */ }
}
// Transaksi tertunda dicatat beserta bukunya (spreadsheet), supaya hanya dikirim ke buku yang benar.
const bukuIni = x => !x.buku || !S.data || x.buku === S.data.spreadsheetId;
/** Transaksi tertunda milik buku yang sedang dibuka. */
const tertunda = () => bacaLokal('tertunda', []).filter(bukuIni);
/** Mengganti daftar tertunda buku ini; milik buku lain tidak tersentuh. */
function tulisTertunda(daftar) {
  tulisLokal('tertunda', bacaLokal('tertunda', []).filter(x => !bukuIni(x)).concat(daftar));
}

/**
 * Pakai data terakhir yang tersimpan di HP (tanpa sinyal, atau sesi login habis saat aplikasi dibuka).
 * false kalau belum pernah ada.
 */
function pakaiDataTerakhir(offline = true) {
  if (!S.data || S.data.perluSetup) {
    const d = bacaLokal('data', null);
    if (!d) return false;
    S.data = d;
  }
  S.bulan = S.data.bulan;
  S.offline = offline;
  $('#nav').hidden = false;
  render();
  return true;
}

/**
 * Transaksi baru yang belum bisa dikirim disimpan di HP, lengkap dengan ID-nya supaya tidak dobel saat dikirim ulang.
 * diLatar: dipanggil dari penyimpanan latar belakang; form lain yang mungkin sedang dibuka tidak ditutup.
 */
function simpanTertunda(t, diLatar) {
  tulisTertunda(tertunda().concat([{
    idBaru: t.idBaru || crypto.randomUUID(), tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori,
    dompet: t.dompet, dompetTujuan: t.dompetTujuan, tanggal: t.tanggal, catatan: t.catatan,
    dariRutin: t.dariRutin || '', ulang: t.ulang || '', buku: S.data.spreadsheetId,
  }]));
  if (!diLatar) tutupSheet();
  if ($('#sheet').hidden) render();
  toast(t.lampiranData ? T('📴 Tersimpan di HP. Dikirim otomatis begitu ada sinyal. Foto struk tidak ikut disimpan.') : T('📴 Tersimpan di HP. Dikirim otomatis begitu ada sinyal.'));
  return true;
}

let mengirimTertunda = false;
/**
 * Mengirim transaksi tertunda satu per satu. Gangguan sinyal/sesi → berhenti, dicoba lagi nanti.
 * Ditolak (mis. dompetnya sudah dihapus) → ditandai gagal dan ditampilkan untuk dicatat ulang.
 */
async function kirimTertunda() {
  if (mengirimTertunda || !GOOGLE.sudahMasuk()) return;
  mengirimTertunda = true;
  let terkirim = 0, berubah = false;
  try {
    for (;;) {
      const t = tertunda().find(x => !x.gagal);
      if (!t) break;
      try {
        await SERVER.simpanTransaksi(t);
        terkirim++;
        tulisTertunda(tertunda().filter(x => x.idBaru !== t.idBaru));
      } catch (e) {
        if (e.jaringan || e instanceof GOOGLE.PerluMasuk) break;
        tulisTertunda(tertunda().map(x => (x.idBaru === t.idBaru ? Object.assign({}, x, { gagal: pesanError(e) }) : x)));
        berubah = true;
      }
    }
  } finally {
    mengirimTertunda = false;
  }
  if (terkirim) {
    toast(T('{n} transaksi tertunda terkirim ✔', { n: terkirim }));
    await muat();
  } else if (berubah && S.data && $('#sheet').hidden) {
    render();
  }
}

/** Baris status di atas halaman: offline, transaksi menunggu, atau yang gagal dikirim. */
function bannerStatus() {
  const daftar = tertunda();
  const gagal = daftar.filter(t => t.gagal);
  const menunggu = daftar.length - gagal.length;
  return (DEMO.aktif() ? `<div class="status-bar demo">${T('👀 Mode coba · data contoh, hanya di HP ini')} <button type="button" data-aksi="demo-masuk">${T('Pakai sungguhan')}</button></div>` : '') +
    (S.menyegarkan ? `<div class="bilah-segar" role="status" aria-label="${T('Memperbarui data')}"><i></i></div>` : '') +
    (S.data && !S.data.perluSetup && S.bulan && ['beranda', 'riwayat'].includes(S.tab) && S.bulan !== periodeSekarang()
      ? `<div class="status-bar">${T('📅 Menampilkan {periode}, bukan periode sekarang.', { periode: esc(namaBulan(S.bulan)) })} <button type="button" data-aksi="bulan-ini">${T('Ke periode sekarang')}</button></div>` : '') +
    (S.offline ? `<div class="status-bar">${T('📴 Offline · menampilkan data terakhir. Transaksi baru tetap bisa dicatat.')}</div>` : '') +
    (!S.offline && S.sesiHabis ? `<div class="status-bar">${T('🔄 Menampilkan data terakhir · tersambung lagi begitu Anda mengetuk layar')}</div>` : '') +
    (catatanTertunda().length ? `<div class="status-bar">${T('📝 {n} catatan menunggu dikirim', { n: catatanTertunda().length })}</div>` : '') +
    (menunggu ? `<div class="status-bar">${T('📤 {n} transaksi menunggu dikirim', { n: menunggu })}${S.offline ? '' : ` <button type="button" data-aksi="kirim-tertunda">${T('Kirim sekarang')}</button>`}</div>` : '') +
    gagal.map(t => `<div class="status-bar gagal">${T('⚠️ {jumlah} {kategori} tidak bisa dikirim: {alasan}', { jumlah: rp(t.jumlah), kategori: esc(namaT(t.kategori || 'Transfer')), alasan: esc(t.gagal) })}
      <button type="button" data-aksi="ulang-tertunda" data-id="${esc(t.idBaru)}">${T('Catat ulang')}</button></div>`).join('');
}

/** Pilihan bahasa (nama tiap bahasa ditulis dalam bahasanya sendiri). Mengganti = muat ulang, lihat bahasa.js. */
function pilihBahasa() {
  return `<select id="pilih-bahasa" aria-label="Bahasa / Language">${[['id', 'Bahasa Indonesia'], ['en', 'English']].map(([b, l]) =>
    `<option value="${b}" ${BAHASA === b ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
}

function tampilMasuk() {
  tutupSheet();
  loading(false);
  $('#sesi').hidden = true;
  $('#nav').hidden = true;
  const email = GOOGLE.email();
  $('#view').innerHTML = `
    <div class="sambut">
      <img class="logo" src="ikon/ikon-192.png" alt="">
      <h1>Dompet Keluarga</h1>
      <p class="tagline-masuk">${T('Uang keluarga akur, sampai gajian berikutnya.')}</p>
      <ul class="keunggulan">
        <li><span class="ik-bulat">${svg('berdua')}</span>${T('Dicatat berdua dari HP masing-masing, angkanya langsung sama')}</li>
        <li><span class="ik-bulat">${svg('ramal')}</span>${T('Tahu berapa yang aman dibelanjakan tiap hari')}</li>
        <li><span class="ik-bulat">${svg('gembok')}</span>${T('Data di Google Drive Anda sendiri, gratis tanpa iklan')}</li>
      </ul>
      ${S.gabung ? `<p>${T('<b>Anda diundang bergabung.</b> Masuk dengan akun Google yang diundang untuk melanjutkan.')}</p>` : ''}
      ${email ? `
        <button type="button" class="btn btn-utama" data-aksi="masuk">${T('Lanjutkan sebagai {email}', { email: esc(email) })}</button>
        <button type="button" class="tombol-teks" data-aksi="masuk" data-akun-lain="1">${T('Pakai akun Google lain')}</button>`
      : `<button type="button" class="btn btn-utama" data-aksi="masuk">${T('Masuk dengan Google')}</button>`}
      ${S.gabung ? '' : `<button type="button" class="btn btn-coba" data-aksi="demo-mulai">${T('Coba dulu tanpa akun')}</button>
      <p class="info-kecil" style="margin-top:4px">${T('Berisi data contoh satu keluarga. Tidak perlu login, dan tidak ada yang tersimpan ke Google.')}</p>`}
      <a class="tombol-teks" href="tentang.html">${T('Kenalan dengan fitur-fiturnya')}</a>
      <a class="tombol-teks" href="privasi.html">${T('Kebijakan privasi')}</a>
      <span class="pilih-kecil pilih-bahasa-masuk">${pilihBahasa()}</span>
    </div>`;
}

/** Kerangka abu-abu berdenyut selama data pertama dimuat (sama dengan isi awal index.html). */
const KERANGKA_BERANDA = `<div class="kerangka" aria-busy="true" aria-label="${T('Memuat')}">
        <div class="k-kepala"><i class="k-bulat"></i><div><i class="k-garis" style="width:50px"></i><i class="k-garis tebal" style="width:110px"></i></div><i class="k-pil"></i></div>
        <i class="k-kartu"></i>
        <div class="k-pintasan"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="k-bento"><i></i><i></i></div>
        <i class="k-garis tebal" style="width:160px;margin:6px 0 12px"></i>
        <div class="k-daftar"><div><i class="k-bulat kecil"></i><i class="k-garis"></i></div><div><i class="k-bulat kecil"></i><i class="k-garis"></i></div><div><i class="k-bulat kecil"></i><i class="k-garis"></i></div></div>
      </div>`;
const KERANGKA_DAFTAR = '<div class="kerangka k-daftar" style="margin-top:8px">' + '<div><i class="k-bulat kecil"></i><i class="k-garis"></i></div>'.repeat(6) + '</div>';

/** Setelah masuk (atau ganti akun): buang semua tampilan & data lama, lalu muat ulang. */
async function muatDariAwal() {
  $('#sesi').hidden = true;
  tutupSheet();
  S.data = null;
  $('#nav').hidden = true;
  $('#view').innerHTML = KERANGKA_BERANDA;
  await muat();
}

/**
 * Token Google habis (±1 jam). Kalau aplikasi sedang dipakai, tampilan dan isian form dibiarkan;
 * cukup satu ketukan untuk menyambung lagi.
 */
function perluMasukLagi() {
  if (!S.data || S.data.perluSetup) return tampilMasuk();
  loading(false);
  $('#sesi').innerHTML = `
    <div class="sesi-kartu">
      <span class="sesi-ikon" aria-hidden="true">🔐</span>
      <b id="sesi-judul">${T('Sambungkan lagi ke Google')}</b>
      <p>${T('Ini bukan galat. Demi keamanan, Google meminta konfirmasi sekitar tiap 1 jam. Isian dan data Anda aman di HP ini.')}</p>
      ${tertunda().length ? `<p class="info-kecil">${T('{n} transaksi menunggu dan akan terkirim setelah tersambung.', { n: tertunda().length })}</p>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="lanjut-sesi">${T('Lanjutkan sebagai {email}', { email: esc(GOOGLE.email() || S.data.user) })}</button>
      <button type="button" class="tombol-teks" data-aksi="masuk" data-akun-lain="1">${T('Pakai akun lain')}</button>
    </div>`;
  $('#sesi').hidden = false;
}

function viewGagal(e) {
  return `
    <div class="sambut">
      <div class="logo">⚠️</div>
      <p>${esc(pesanError(e))}</p>
      ${e.tanpaAkses
        ? `<button type="button" class="btn btn-utama" data-aksi="pilih-db" data-id="${esc(e.idDb || '')}">${T('Pilih spreadsheet')}</button>
           <button type="button" class="btn btn-hapus" data-aksi="coba-lagi">${T('Coba lagi')}</button>
           <button type="button" class="btn btn-hapus" data-aksi="lupakan-db">${T('Pakai spreadsheet lain')}</button>`
        : `<button type="button" class="btn btn-utama" data-aksi="coba-lagi">${T('Coba lagi')}</button>`}
      <button type="button" class="btn btn-hapus" data-aksi="keluar">${T('Keluar ({email})', { email: esc(GOOGLE.email() || '') })}</button>
    </div>`;
}

/**
 * Memilih spreadsheet lewat Google Picker, lalu memakainya. Dengan scope drive.file, ini satu-satunya cara
 * membuka spreadsheet yang tidak dibuat aplikasi di akun ini (undangan keluarga, versi Apps Script).
 * idFile: langsung arahkan ke file itu.
 */
async function pilihDanHubungkan(idFile) {
  const id = await GOOGLE.pilihSpreadsheet(idFile);
  if (!id) return;
  loading(true);
  try {
    await api('hubungkanDatabase', id);
    S.gabung = '';
    S.data = null;
    await muat();
    toast(T('Spreadsheet terhubung ✔'));
  } finally {
    loading(false);
  }
}

// Navigasi bawah HP: beberapa halaman menu yang digeser kiri/kanan (styles.css → .nav-geser), ＋ tetap di tengah.
// Halaman yang memuat tab aktif ditampilkan otomatis; titik penanda di bawah ＋ mengikuti posisi geser.
function aturGeserNav() {
  const geser = $('#nav-geser');
  if (!geser) return;
  const titik = [...document.querySelectorAll('#nav .nav-titik i')];
  const tandai = () => {
    const ke = Math.round(geser.scrollLeft / (geser.clientWidth || 1));
    titik.forEach((t, i) => t.classList.toggle('aktif', i === ke));
  };
  if (!geser.dataset.siap) {
    geser.dataset.siap = '1';
    geser.addEventListener('scroll', tandai, { passive: true });
  }
  // Hanya saat tab berganti (bukan tiap render ulang karena sinkron data), supaya halaman menu yang sedang
  // dibuka pengguna tidak tiba-tiba melompat.
  if (geser.clientWidth && geser.dataset.tab !== S.tab) {
    const hal = [...geser.querySelectorAll('.nav-hal')].findIndex(h => h.querySelector('[data-tab].aktif'));
    if (hal >= 0 && Math.round(geser.scrollLeft / geser.clientWidth) !== hal) {
      geser.scrollTo({ left: hal * geser.clientWidth, behavior: geser.dataset.tab ? 'smooth' : 'auto' });
    }
    geser.dataset.tab = S.tab;
  }
  tandai();
}

function render() {
  perkayaIkonDompet(S.data);
  if (S.tab !== 'riwayat') S.pilih = null;
  document.body.classList.toggle('mode-pilih', !!S.pilih);
  const view = { beranda: viewBeranda, riwayat: viewRiwayat, dompet: viewDompet, laporan: viewLaporan, lainnya: viewLainnya, catatan: viewCatatan, sholat: viewSholat, 'catatan-edit': viewFormCatatan }[S.tab] || viewBeranda;
  if (S.tab === 'catatan-edit') simpanDraftCatatan();
  $('#view').innerHTML = bannerStatus() + view();
  document.body.dataset.tab = S.tab; // tata letak per halaman di layar lebar (styles.css → Tampilan web)
  kelompokkanBagian();
  document.querySelectorAll('#nav [data-tab]').forEach(b => b.classList.toggle('aktif', b.dataset.tab === S.tab));
  aturGeserNav();
  simpanPosisi();
  setTimeout(cekPengingat, 500); // overlay pengingat catatan yang jatuh tempo hari ini
  setTimeout(() => { if (typeof cekKilasBalik === 'function') cekKilasBalik(); }, 900); // kilas balik awal periode
  setTimeout(() => { if (typeof cekPetunjuk === 'function' && !kilas) cekPetunjuk(); }, 1400);
  if (S.tab !== 'laporan') kunciAnimasiGrafik = ''; // kembali ke Laporan nanti: animasi diputar lagi
  pasangGeserGrafik();
  if (S.tab === 'catatan') pasangGeserKalender();
  if (S.tab === 'riwayat') setTimeout(() => petunjukSekali('seret-kal', document.querySelector('.daftar-hari-kal .trx-geser'),
    T('✋ Tekan lama transaksi lalu seret ke tanggal lain di kalender untuk memindahkan tanggalnya.')), 1500);
  document.body.classList.toggle('tanpa-nav', S.tab === 'catatan-edit'); // fokus menulis
  if (window.dikte && dikte.aktif) { if (S.tab !== 'catatan-edit') hentikanDikte(); else tampilDikte(); } // dikte dideklarasikan di bawah
  if (S.tab === 'catatan-edit') {
    tinggiIsiCatatan();
    if (S.formCatatan.fokus) { S.formCatatan.fokus = false; setTimeout(() => $('#c-judul') && $('#c-judul').focus(), 200); }
  }
  if (S.tab !== 'sholat' && statusKompas !== 'mati') matikanKompas(); // hemat baterai
  if (luncurTertunda) setTimeout(jalankanLuncur); // pintasan ikon / berbagi: tunggu data pertama tampil
}

/**
 * Judul bagian + kartu-kartu sesudahnya dibungkus satu .grup-bagian, supaya di layar lebar (dua kolom)
 * satu bagian tidak terbelah ke kolom lain. Di HP pembungkusnya `display: contents` (tidak berpengaruh).
 */
const AKHIR_GRUP = '.judul-bagian, .pemilih-periode-lap, .aksi-laporan, .catatan-versi';
function kelompokkanBagian() {
  let grup = null;
  [...$('#view').children].forEach(el => {
    if (el.matches('.judul-bagian')) {
      grup = document.createElement('div');
      grup.className = 'grup-bagian';
      el.before(grup);
    } else if (el.matches(AKHIR_GRUP)) {
      grup = null;
    }
    if (grup) grup.appendChild(el);
  });
}

// Halaman & bulan yang sedang dilihat diingat, supaya refresh / update otomatis / membuka lagi dari ikon
// di layar utama (Android sering memuat ulang aplikasi) tidak melempar kembali ke Beranda.
// Disimpan di localStorage (sessionStorage hilang saat aplikasi dibuka ulang), berlaku POSISI_BERLAKU_MS.
const POSISI_BERLAKU_MS = 60 * 60 * 1000;
function simpanPosisi() {
  try { localStorage.setItem('dk_posisi', JSON.stringify({ tab: S.tab, bulan: S.bulan, tahun: S.tahun, waktu: Date.now() })); } catch (e) { /* mode privat */ }
}
function pulihkanPosisi() {
  try {
    const p = JSON.parse(localStorage.getItem('dk_posisi'));
    if (!p || !(Date.now() - p.waktu < POSISI_BERLAKU_MS)) return;
    if (!['beranda', 'riwayat', 'dompet', 'laporan', 'lainnya', 'catatan', 'sholat', 'catatan-edit'].includes(p.tab)) return;
    S.tab = p.tab === 'catatan-edit' ? 'catatan' : p.tab;
    // Periode sengaja TIDAK dipulihkan: refresh selalu membuka periode berjalan. Dulu periode lama (mis. Juli)
    // terbawa terus karena waktunya diperbarui tiap render, jadi Beranda tampak kosong (Rp0) walau di-refresh.
    S.tahun = p.tahun || S.tahun;
  } catch (e) { /* abaikan */ }
}

/**
 * ‹ periode ›. ringkas: versi kecil untuk pojok kanan atas Beranda ("Nov 2026"), supaya nama pengguna & buku
 * di sebelahnya tidak tertutup; rentang tanggal lengkapnya tetap tertulis di kartu saldo.
 */
function pemilihBulan(ringkas) {
  const label = ringkas
    ? keTanggal(S.bulan).toLocaleDateString(LOKAL, { month: 'short', year: 'numeric' })
    : namaBulan(S.bulan);
  return `<div class="pemilih-bulan ${ringkas ? 'mini' : ''}">
    <button data-aksi="bulan" data-geser="-1" aria-label="${T('Periode sebelumnya')}">${svg('kembali')}</button>
    <span title="${esc(namaBulan(S.bulan))}">${esc(label)}</span>
    <button data-aksi="bulan" data-geser="1" aria-label="${T('Periode berikutnya')}">${svg('maju')}</button>
  </div>`;
}

/** Judul, ikon, warna, tanda, dan keterangan satu transaksi (dipakai daftar & detail). */
function infoTrx(t) {
  let judul = namaT(t.kategori), ikon = ikonKategori(t.kategori, t.tipe), kelas = 'keluar', tanda = '−';
  let sub = [t.catatan, namaT(t.dompet)].filter(Boolean).join(' · ');
  if (t.tipe === TIPE.MASUK) { kelas = 'masuk'; tanda = '+'; }
  if (t.tipe === TIPE.TRANSFER) {
    judul = T('Transfer'); ikon = '🔁'; kelas = 'transfer'; tanda = '';
    if (adalahTabungan(t.dompetTujuan)) { judul = T('Setor tabungan'); ikon = ikonDompet(t.dompetTujuan); }
    else if (adalahTabungan(t.dompet)) { judul = T('Tarik tabungan'); ikon = ikonDompet(t.dompet); }
    else if (adalahAset(t.dompetTujuan)) { judul = T('Beli / tambah {nama}', { nama: t.dompetTujuan }); ikon = ikonDompet(t.dompetTujuan); }
    else if (adalahAset(t.dompet)) { judul = T('Jual / ambil {nama}', { nama: t.dompet }); ikon = ikonDompet(t.dompet); }
    else if (adalahUtang(t.dompetTujuan)) { judul = T('Uang ke {nama}', { nama: t.dompetTujuan }); ikon = '🤝'; }
    else if (adalahUtang(t.dompet)) { judul = T('Uang dari {nama}', { nama: t.dompet }); ikon = '🤝'; }
    sub = [`${namaT(t.dompet)} → ${namaT(t.dompetTujuan)}`, t.catatan].filter(Boolean).join(' · ');
  }
  return { judul, ikon, kelas, tanda, sub };
}

function itemTrx(t) {
  const info = infoTrx(t);
  const { ikon, kelas, tanda } = info;
  let { judul, sub } = info;
  // Catatan lebih menonjol daripada kategori: kalau ada catatan, catatan jadi judul tebal dan kategori pindah ke baris kecil.
  const catatan = String(t.catatan || '').trim();
  if (catatan) {
    judul = catatan;
    sub = t.tipe === TIPE.TRANSFER
      ? [info.judul, `${namaT(t.dompet)} → ${namaT(t.dompetTujuan)}`].join(' · ')
      : [info.judul, namaT(t.dompet)].filter(Boolean).join(' · ');
  }
  const dipilih = S.pilih && S.pilih.has(t.id);
  // 📎 bisa diketuk langsung untuk melihat foto (tanpa membuka detail).
  const klip = t.lampiran ? `<span class="klip-trx" role="button" tabindex="-1" data-aksi="lihat-foto-trx" data-id="${esc(t.id)}" aria-label="${T('Lihat foto struk')}">📎</span>` : '';
  // Dibungkus .trx-geser: geser kiri = hapus (bisa diurungkan), geser kanan = catat lagi hari ini, tekan lama = pilih banyak.
  return `<div class="trx-geser ${dipilih ? 'dipilih' : ''}">
    <div class="latar-geser" aria-hidden="true"><span class="ulang">${T('🔁 Catat lagi')}</span><span class="hapus">${T('🗑 Hapus')}</span></div>
    <button class="trx" data-aksi="edit-trx" data-id="${esc(t.id)}" ${S.pilih ? `aria-pressed="${!!dipilih}"` : ''}>
      <span class="ikon-bulat">${S.pilih ? `<span class="centang-pilih" aria-hidden="true">${dipilih ? '✓' : ''}</span>` : ilus(ikon)}</span>
      <span class="trx-isi"><b>${esc(judul)}</b><small>${klip}${esc(sub)}</small></span>
      <span class="nominal ${kelas}">${tanda}${rp(t.jumlah)}</span>
    </button>
  </div>`;
}

function kosong(ikon, teks) {
  return `<div class="kosong"><span>${ikon}</span>${teks}</div>`;
}

/**
 * Bar horizontal berperingkat, satu warna. items: [{ ikon, nama, nilai, atribut? }] sudah terurut besar → kecil.
 * atribut (opsional, sudah di-escape): mis. 'data-aksi="..." data-nama="..."' → barisnya jadi tombol yang bisa diketuk.
 */
function barBerperingkat(items, totalUntukPersen) {
  const maks = Math.max(1, ...items.map(x => x.nilai));
  return items.map(x => {
    const tag = x.atribut ? 'button' : 'div';
    return `
    <${tag} class="bar-item${x.atribut ? ' bisa-ketuk' : ''}" ${x.atribut ? 'type="button" ' + x.atribut : ''}>
      <span class="ikon">${ilus(x.ikon)}</span>
      <span class="nama">${esc(x.nama)}</span>
      <span class="nilai">${rp(x.nilai)}${totalUntukPersen ? ` <small>${Math.round(x.nilai / totalUntukPersen * 100)}%</small>` : ''}</span>
      <span class="bar"><i style="width:${Math.max(2, x.nilai / maks * 100)}%"></i></span>
    </${tag}>`;
  }).join('');
}

/** Status anggaran selalu berupa ikon + teks, tidak hanya warna. */
function statusAnggaran(terpakai, batas) {
  if (terpakai > batas) return { kelas: 'lewat', teks: T('⛔ Lewat {jumlah}', { jumlah: rp(terpakai - batas) }) };
  if (terpakai >= batas * 0.8) return { kelas: 'hampir', teks: T('⚠️ Hampir habis · sisa {jumlah}', { jumlah: rp(batas - terpakai) }) };
  return { kelas: '', teks: T('Sisa {jumlah}', { jumlah: rp(batas - terpakai) }) };
}

function meterAnggaran(ikon, nama, terpakai, batas, catatan) {
  const s = statusAnggaran(terpakai, batas);
  const lebar = batas ? Math.min(100, terpakai / batas * 100) : (terpakai ? 100 : 0);
  return `
    <div class="bar-item">
      <span class="ikon">${ilus(ikon)}</span>
      <span class="nama">${esc(nama)}</span>
      <span class="nilai">${rp(terpakai)} <small>/ ${rp(batas)}</small></span>
      <div class="meter ${s.kelas}" role="meter" aria-label="${esc(nama)}" aria-valuemin="0" aria-valuemax="${batas}" aria-valuenow="${terpakai}">
        <i style="width:${lebar}%"></i></div>
      <small class="ket">${s.teks}${catatan ? ' · ' + esc(catatan) : ''}</small>
    </div>`;
}

/**
 * Anggaran efektif periode yang dilihat. Kategori "amplop" (bawaSisa) mendapat tambahan sisa periode
 * sebelumnya, atau berkurang kalau periode sebelumnya lewat batas. Hanya satu periode ke belakang.
 */
function batasAnggaran(k) {
  if (!k.bawaSisa) return { batas: k.anggaran, sisaLalu: 0 };
  const sisaLalu = k.anggaran - (ringkasBulan(bulanSebelum(S.bulan)).kategori[k.nama] || 0);
  return { batas: Math.max(0, k.anggaran + sisaLalu), sisaLalu };
}
const catatanAmplop = k => (k.bawaSisa && k.sisaLalu ? T('📨 {jumlah} dari periode lalu', { jumlah: (k.sisaLalu > 0 ? '+' : '−') + rp(Math.abs(k.sisaLalu)) }) : '');

/** Pengeluaran bulan terpilih per kategori: { nama: jumlah }. */
function pengeluaranPerKategori() {
  const per = {};
  S.data.transaksi.filter(t => t.tipe === TIPE.KELUAR).forEach(t => { per[t.kategori] = (per[t.kategori] || 0) + t.jumlah; });
  return per;
}

/** Kategori pengeluaran yang punya anggaran, dengan `batas` = anggaran efektif periode ini (lihat batasAnggaran). */
const kategoriBeranggaran = () => S.data.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0)
  .map(k => Object.assign({}, k, batasAnggaran(k)));

/** Rincian semua meter anggaran (dibuka dari tile Anggaran di Beranda). */
function bukaRincianAnggaran() {
  const per = pengeluaranPerKategori();
  const pakai = k => per[k.nama] || 0;
  const daftar = kategoriBeranggaran().sort((a, b) => pakai(b) / (b.batas || 1) - pakai(a) / (a.batas || 1));
  const totalBatas = daftar.reduce((a, k) => a + k.batas, 0);
  const totalPakai = daftar.reduce((a, k) => a + pakai(k), 0);
  bukaSheet(T('Anggaran {bulan}', { bulan: namaBulan(S.bulan) }), `
    ${meterAnggaran('📊', T('Total'), totalPakai, totalBatas)}
    <div class="pemisah"></div>
    ${daftar.map(k => meterAnggaran(k.ikon, namaT(k.nama), pakai(k), k.batas, catatanAmplop(k))).join('')}
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="atur-anggaran">${T('Atur anggaran')}</button></div>`);
}

function tileAnggaran(per) {
  const daftar = kategoriBeranggaran();
  if (!daftar.length) {
    return `<button data-aksi="atur-anggaran"><small>${T('Anggaran')}</small><b>${T('Atur')}</b><span class="ket">${T('Batasi belanja per kategori')}</span></button>`;
  }
  const batas = daftar.reduce((a, k) => a + k.batas, 0);
  const pakai = daftar.reduce((a, k) => a + (per[k.nama] || 0), 0);
  const s = statusAnggaran(pakai, batas);
  const persen = batas ? Math.round(pakai / batas * 100) : 100;
  const lewat = daftar.filter(k => (per[k.nama] || 0) > k.batas).length;
  return `<button data-aksi="rincian-anggaran">
    <small>${T('Anggaran')} <span class="panah-kecil">${svg('maju')}</span></small>
    <b>${persen}% <span style="font-size:13px;font-weight:600;color:var(--muted)">${T('terpakai')}</span></b>
    <span class="meter ${s.kelas}" role="meter" aria-label="${T('Total anggaran')}" aria-valuemin="0" aria-valuemax="${batas}" aria-valuenow="${pakai}"><i style="width:${Math.min(100, persen)}%"></i></span>
    <span class="ket">${lewat ? T('⛔ {n} kategori lewat batas', { n: lewat }) : esc(s.teks)}</span>
  </button>`;
}

function tileTabungan() {
  const daftar = daftarTabungan();
  if (!daftar.length) {
    return `<button data-aksi="tambah-tabungan"><small>${T('Tabungan')}</small><b>${T('Mulai')}</b><span class="ket">${T('Buat tabungan pertama')}</span></button>`;
  }
  const total = daftar.reduce((a, w) => a + w.saldo, 0);
  const bertarget = daftar.filter(w => w.target);
  const target = bertarget.reduce((a, w) => a + w.target, 0);
  const terkumpul = bertarget.reduce((a, w) => a + Math.min(w.saldo, w.target), 0);
  const persen = target ? Math.floor(terkumpul / target * 100) : null;
  return `<button data-aksi="tab" data-tab="dompet">
    <small>${T('Tabungan')} <span class="panah-kecil">${svg('maju')}</span></small>
    <b>Rp${rpPendek(total)}</b>
    ${persen !== null ? `<span class="meter" role="meter" aria-label="${T('Progres target tabungan')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${persen}"><i style="width:${persen}%"></i></span>` : ''}
    <span class="ket">${persen !== null ? T('{n} tabungan · {persen}% dari target', { n: daftar.length, persen }) : T('{n} tabungan', { n: daftar.length })}</span>
  </button>`;
}
