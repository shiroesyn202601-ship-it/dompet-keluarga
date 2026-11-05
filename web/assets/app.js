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
  filter: { rentang: 'periode', dari: '', sampai: '', kategori: '', dompet: '', oleh: '' }, // filter Riwayat (lihat FILTER_KOSONG)
  cariData: null,     // transaksi lintas bulan untuk Riwayat: { kunci, transaksi, memuat? }
  batasRiwayat: 200,  // jumlah transaksi yang ditampilkan sebelum "Tampilkan lebih banyak"
};
/** Pilihan cepat di layar setup: [nama, ikon]. */
const DOMPET_UMUM = [['Tunai', '💵'], ['BCA', '🏦'], ['BRI', '🏦'], ['Mandiri', '🏦'], ['BNI', '🏦'], ['BSI', '🏦'],
  ['Jago', '🏦'], ['SeaBank', '🏦'], ['GoPay', '📱'], ['OVO', '📱'], ['DANA', '📱'], ['ShopeePay', '📱']];
let F = null; // state form yang sedang terbuka
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
};
const svg = nama => `<svg class="ik" viewBox="0 0 24 24" aria-hidden="true">${IKON[nama]}</svg>`;

const dompetBiasa = () => S.data.dompet.filter(w => w.jenis === JENIS.DOMPET);
const daftarUtang = () => S.data.dompet.filter(w => w.jenis === JENIS.UTANG);
const adalahUtang = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.UTANG);
const daftarAset = () => S.data.dompet.filter(w => w.jenis === JENIS.ASET);
const adalahAset = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.ASET);
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
      toast(T('Berhasil bergabung ke Dompet Keluarga ✔'));
    }
    S.data = await api('getData', S.bulan);
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
  return (S.menyegarkan ? `<div class="bilah-segar" role="status" aria-label="${T('Memperbarui data')}"><i></i></div>` : '') +
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
      <p>${T('Catat keuangan keluarga bersama. Semua data tersimpan di Google Spreadsheet milik Anda sendiri.')}</p>
      ${S.gabung ? `<p>${T('<b>Anda diundang bergabung.</b> Masuk dengan akun Google yang diundang untuk melanjutkan.')}</p>` : ''}
      ${email ? `
        <button type="button" class="btn btn-utama" data-aksi="masuk">${T('Lanjutkan sebagai {email}', { email: esc(email) })}</button>
        <button type="button" class="tombol-teks" data-aksi="masuk" data-akun-lain="1">${T('Pakai akun Google lain')}</button>`
      : `<button type="button" class="btn btn-utama" data-aksi="masuk">${T('Masuk dengan Google')}</button>`}
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
      <b id="sesi-judul">${T('Sesi login berakhir')}</b>
      <p>${T('Demi keamanan, Google meminta konfirmasi sekitar tiap 1 jam. Isian Anda tidak hilang.')}</p>
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

function render() {
  const view = { beranda: viewBeranda, riwayat: viewRiwayat, dompet: viewDompet, laporan: viewLaporan, lainnya: viewLainnya, catatan: viewCatatan, sholat: viewSholat, 'catatan-edit': viewFormCatatan }[S.tab] || viewBeranda;
  if (S.tab === 'catatan-edit') simpanDraftCatatan();
  $('#view').innerHTML = bannerStatus() + view();
  document.querySelectorAll('#nav [data-tab]').forEach(b => b.classList.toggle('aktif', b.dataset.tab === S.tab));
  simpanPosisi();
  setTimeout(cekPengingat, 500); // overlay pengingat catatan yang jatuh tempo hari ini
  setTimeout(() => { if (typeof cekKilasBalik === 'function') cekKilasBalik(); }, 900); // kilas balik awal periode
  setTimeout(() => { if (typeof cekPetunjuk === 'function' && !kilas) cekPetunjuk(); }, 1400);
  if (S.tab !== 'laporan') kunciAnimasiGrafik = ''; // kembali ke Laporan nanti: animasi diputar lagi
  pasangGeserGrafik();
  if (S.tab === 'catatan') pasangGeserKalender();
  document.body.classList.toggle('tanpa-nav', S.tab === 'catatan-edit'); // fokus menulis
  if (window.dikte && dikte.aktif) { if (S.tab !== 'catatan-edit') hentikanDikte(); else tampilDikte(); } // dikte dideklarasikan di bawah
  if (S.tab === 'catatan-edit') {
    tinggiIsiCatatan();
    if (S.formCatatan.fokus) { S.formCatatan.fokus = false; setTimeout(() => $('#c-judul') && $('#c-judul').focus(), 200); }
  }
  if (S.tab !== 'sholat' && statusKompas !== 'mati') matikanKompas(); // hemat baterai
  if (luncurTertunda) setTimeout(jalankanLuncur); // pintasan ikon / berbagi: tunggu data pertama tampil
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
    S.bulan = p.bulan || '';
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

function itemTrx(t) {
  let judul = namaT(t.kategori), ikon = ikonKategori(t.kategori, t.tipe), kelas = 'keluar', tanda = '−';
  let sub = [t.lampiran ? '📎' : '', t.catatan, namaT(t.dompet)].filter(Boolean).join(' · ');
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
  // Dibungkus .trx-geser: geser kiri = hapus (bisa diurungkan), geser kanan = catat lagi hari ini.
  return `<div class="trx-geser">
    <div class="latar-geser" aria-hidden="true"><span class="ulang">${T('🔁 Catat lagi')}</span><span class="hapus">${T('🗑 Hapus')}</span></div>
    <button class="trx" data-aksi="edit-trx" data-id="${esc(t.id)}">
      <span class="ikon-bulat">${ilus(ikon)}</span>
      <span class="trx-isi"><b>${esc(judul)}</b><small>${esc(sub)}</small></span>
      <span class="nominal ${kelas}">${tanda}${rp(t.jumlah)}</span>
    </button>
  </div>`;
}

function kosong(ikon, teks) {
  return `<div class="kosong"><span>${ikon}</span>${teks}</div>`;
}

/** Bar horizontal berperingkat, satu warna. items: [{ ikon, nama, nilai }] sudah terurut besar → kecil. */
function barBerperingkat(items, totalUntukPersen) {
  const maks = Math.max(1, ...items.map(x => x.nilai));
  return items.map(x => `
    <div class="bar-item">
      <span class="ikon">${ilus(x.ikon)}</span>
      <span class="nama">${esc(x.nama)}</span>
      <span class="nilai">${rp(x.nilai)}${totalUntukPersen ? ` <small>${Math.round(x.nilai / totalUntukPersen * 100)}%</small>` : ''}</span>
      <div class="bar"><i style="width:${Math.max(2, x.nilai / maks * 100)}%"></i></div>
    </div>`).join('');
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

// ---------- Halaman: Beranda ----------

/** Tanda per perangkat untuk kartu "Mulai di sini": { undang: 1, tutup: 1 }. */
const tandaTips = () => { try { return JSON.parse(bacaHp('dk_tips')) || {}; } catch (e) { return {}; } };
function tandaiTips(kunci) {
  const t = tandaTips();
  if (t[kunci]) return;
  t[kunci] = 1;
  tulisHp('dk_tips', JSON.stringify(t));
}

/** Daftar langkah pertama untuk pengguna baru. Hilang kalau semua selesai atau ditutup. */
function kartuMulai() {
  const t = tandaTips();
  if (t.tutup || S.data.transaksi.length >= 15) return ''; // pengguna lama tidak perlu panduan
  const langkah = [
    [S.data.transaksi.length > 0, T('Catat transaksi pertama'), T('Ketik saja "bakso 25rb gopay" lalu Enter'), 'tambah-trx', ''],
    [S.data.kategori.some(k => k.anggaran > 0), T('Atur anggaran belanja'), T('Diberi tahu sebelum belanja kebablasan'), 'atur-anggaran', ''],
    [!!t.undang, T('Undang pasangan / keluarga'), T('Catat bersama di satu buku'), 'undang', ''],
    [MODE_APLIKASI, T('Pasang di layar utama HP'), T('Buka cepat seperti aplikasi biasa'), 'tab', 'lainnya'],
  ];
  const sisa = langkah.filter(l => !l[0]).length;
  if (!sisa) return '';
  return `
    <section class="kartu mulai">
      <h3><span>${T('👋 Mulai di sini · {selesai}/{total}', { selesai: langkah.length - sisa, total: langkah.length })}</span>
        <button type="button" data-aksi="tutup-tips" aria-label="${T('Tutup panduan')}">${T('Tutup')}</button></h3>
      ${langkah.map(([selesai, judul, ket, aksi, tab]) => `
        <button class="baris ${selesai ? 'selesai' : ''}" data-aksi="${aksi}"${tab ? ` data-tab="${tab}"` : ''}>
          <span class="ikon-bulat">${selesai ? '✅' : '⬜'}</span>
          <span class="isi"><b>${judul}</b><small>${ket}</small></span>
          <span class="panah">${svg('maju')}</span>
        </button>`).join('')}
    </section>`;
}

function viewBeranda() {
  const d = S.data;
  const trx = d.transaksi;
  const masuk = total(trx, TIPE.MASUK);
  const keluar = total(trx, TIPE.KELUAR);
  const saldo = dompetBiasa().reduce((a, w) => a + w.saldo, 0);
  const per = pengeluaranPerKategori();
  const urut = Object.keys(per).map(n => ({ ikon: ikonKategori(n, TIPE.KELUAR), nama: namaT(n), nilai: per[n] })).sort((a, b) => b.nilai - a.nilai);
  const nama = namaPendek(d.user);

  return `
    <div class="kepala">
      <div class="sapa">
        <span class="avatar" aria-hidden="true">${esc(nama.charAt(0))}</span>
        <div style="min-width:0"><small>${T('Halo,')}</small><h1>${esc(nama)}</h1></div>
      </div>
      <div class="kepala-kanan"><button type="button" class="tombol-ikon tombol-cari" data-aksi="cari-global" aria-label="${T('Cari transaksi & catatan')}">${svg('cari')}</button>${pemilihBulan(true)}</div>
    </div>

    <section class="kartu kartu-saldo">
      <div class="atas-saldo">
        <small>${T('Total saldo dompet')}</small>
        <button type="button" class="chip-buku-saldo" data-aksi="buku" aria-label="${T('Buku keuangan: {nama}. Ketuk untuk ganti buku', { nama: esc(namaT(d.namaBuku) || T('Buku')) })}">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>
          <span>${esc(namaT(d.namaBuku) || T('Buku'))}</span>
          <svg class="ik panah-buku" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      <div class="baris-saldo">
        <div class="besar">${rp(saldo)}</div>
        <button type="button" class="tombol-mata" data-aksi="samar" aria-label="${modeSamar() ? T('Tampilkan nominal') : T('Sembunyikan nominal')}" aria-pressed="${modeSamar()}">${modeSamar()
          ? '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/></svg>'
          : '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>'}</button>
      </div>
      <div class="ringkas">
        <div><span class="panah-bulat masuk" aria-hidden="true">↓</span><span><small>${T('Pemasukan')}</small><b>${rp(masuk)}</b></span></div>
        <div><span class="panah-bulat keluar" aria-hidden="true">↑</span><span><small>${T('Pengeluaran')}</small><b>${rp(keluar)}</b></span></div>
      </div>
      <div class="selisih">${T('Selisih {bulan}: <b>{jumlah}</b>', { bulan: esc(namaBulan(S.bulan)), jumlah: rp(masuk - keluar) })}</div>
      ${barisSisaAman()}
    </section>

    <div class="aksi-cepat">
      <button data-aksi="tambah-trx"><span class="kotak">${svg('plus')}</span>${T('Catat')}</button>
      <button data-aksi="cepat-struk"><span class="kotak">${svg('kamera')}</span>${T('Foto struk')}</button>
      <button data-aksi="cepat-transfer"><span class="kotak">${svg('transfer')}</span>${T('Transfer')}</button>
      <button data-aksi="tab" data-tab="dompet"><span class="kotak">${svg('dompet')}</span>${T('Dompet||jamak')}</button>
      <button data-aksi="kalender"><span class="kotak">${svg('kalender')}</span>${T('Catatan')}</button>
      <button data-aksi="sholat"><span class="kotak">${svg('masjid')}</span>${T('Sholat')}</button>
    </div>
    ${bagianSekaliKetuk()}

    ${kartuMulai()}
    ${kartuTagihan()}
    ${kartuSaranRutin()}
    ${kartuAktivitasBaru()}

    <div class="bento">${tileAnggaran(per)}${tileTabungan()}</div>

    <h2 class="judul-bagian">${T('Pengeluaran per kategori')} ${urut.length > 5 ? `<button data-aksi="tab" data-tab="laporan">${T('Semua')}</button>` : ''}</h2>
    <section class="kartu">
      ${urut.length ? barBerperingkat(urut.slice(0, 5)) : kosong('🧾', T('Belum ada pengeluaran bulan ini.'))}
    </section>

    <h2 class="judul-bagian">${T('Transaksi terakhir')} ${trx.length ? `<button data-aksi="tab" data-tab="riwayat">${T('Lihat semua')}</button>` : ''}</h2>
    <section class="kartu" style="padding:4px 18px">
      ${trx.length ? trx.slice(0, 5).map(itemTrx).join('') : kosong('✍️', T('Belum ada transaksi. Ketuk tombol ＋ untuk mencatat.'))}
    </section>`;
}

// ---------- Halaman: Riwayat ----------

// Filter Riwayat. rentang 'periode' = data periode yang sedang dilihat (sudah dimuat);
// selain itu transaksi dibaca dari spreadsheet saat dibutuhkan (S.cariData).
const FILTER_KOSONG = { rentang: 'periode', dari: '', sampai: '', kategori: '', dompet: '', oleh: '' };
const PILIHAN_RENTANG = [['periode', T('Periode ini')], ['3bulan', T('3 bulan terakhir')], ['tahun', T('Tahun ini')], ['semua', T('Semua waktu')], ['kustom', T('Pilih tanggal')]];

function tanggalIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** { dari, sampai } untuk filter rentang, atau null kalau cukup data periode yang sudah dimuat. */
function rentangFilter() {
  const f = S.filter;
  if (f.rentang === 'periode') return null;
  if (f.rentang === '3bulan') { const d = new Date(); d.setMonth(d.getMonth() - 3); return { dari: tanggalIso(d), sampai: hariIni() }; }
  if (f.rentang === 'tahun') return { dari: hariIni().slice(0, 4) + '-01-01', sampai: hariIni() };
  if (f.rentang === 'kustom') return { dari: f.dari, sampai: f.sampai };
  return { dari: '', sampai: '' };
}

function labelRentang() {
  const f = S.filter;
  if (f.rentang === 'kustom') return [f.dari, f.sampai].map(t => (t ? tanggalPendek(t) : '…')).join(' – ');
  return (PILIHAN_RENTANG.find(p => p[0] === f.rentang) || [])[1];
}

/** Transaksi untuk Riwayat sesuai rentang; null = sedang dimuat dari spreadsheet. */
function sumberRiwayat() {
  const r = rentangFilter();
  if (!r) return S.data.transaksi;
  const kunci = r.dari + '|' + r.sampai;
  if (S.cariData && S.cariData.kunci === kunci) return S.cariData.memuat ? null : S.cariData.transaksi;
  S.cariData = { kunci, memuat: true, transaksi: [] };
  api('cariTransaksi', r.dari, r.sampai).then(daftar => {
    if (!S.cariData || S.cariData.kunci !== kunci) return;
    S.cariData = { kunci, transaksi: daftar };
    if (S.tab === 'riwayat') render();
  }, e => {
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(e.jaringan ? T('Pencarian lintas bulan butuh sinyal.') : pesanError(e), true);
    S.filter = Object.assign({}, S.filter, { rentang: 'periode' });
    S.cariData = null;
    if (S.tab === 'riwayat') render();
  });
  return null;
}

function viewRiwayat() {
  const f = S.filter;
  const sumber = sumberRiwayat();
  const q = S.cari.toLowerCase();
  const trx = (sumber || []).filter(t =>
    (S.filterTipe === 'Semua' || t.tipe === S.filterTipe) &&
    (!f.kategori || t.kategori === f.kategori) &&
    (!f.dompet || t.dompet === f.dompet || t.dompetTujuan === f.dompet) &&
    (!f.oleh || t.oleh === f.oleh) &&
    (!q || [t.kategori, t.catatan, t.dompet, t.dompetTujuan, String(t.jumlah)].join(' ').toLowerCase().includes(q))
  );

  const grup = {};
  trx.slice(0, S.batasRiwayat).forEach(t => (grup[t.tanggal] = grup[t.tanggal] || []).push(t));

  const isi = Object.keys(grup).sort().reverse().map(tgl => {
    const daftar = grup[tgl];
    const bersih = total(daftar, TIPE.MASUK) - total(daftar, TIPE.KELUAR);
    return `<div class="grup-tanggal"><span>${esc(labelTanggal(tgl))}</span><span>${bersih ? rp(bersih) : ''}</span></div>
      <section class="kartu" style="padding:4px 16px">${daftar.map(itemTrx).join('')}</section>`;
  }).join('');

  // Ringkasan hasil, mis. "berapa total jajan kopi tahun ini" — muncul kalau sedang mencari/memfilter.
  const menyaring = q || f.rentang !== 'periode' || f.kategori || f.dompet || f.oleh || S.filterTipe !== 'Semua';
  const ringkas = menyaring && trx.length ? `<p class="ringkas-cari">${T('{n} transaksi', { n: trx.length })}
    ${total(trx, TIPE.KELUAR) ? ` · ${T('Keluar||uang')} <b>${rp(total(trx, TIPE.KELUAR))}</b>` : ''}
    ${total(trx, TIPE.MASUK) ? ` · ${T('Masuk||uang')} <b>${rp(total(trx, TIPE.MASUK))}</b>` : ''}</p>` : '';
  const lagi = trx.length > S.batasRiwayat
    ? `<button class="tombol-tambah" data-aksi="riwayat-lagi">${T('Tampilkan lebih banyak ({n} lagi)', { n: trx.length - S.batasRiwayat })}</button>` : '';
  const chipFilter = [
    f.kategori && ['kategori', '🏷️ ' + namaT(f.kategori)],
    f.dompet && ['dompet', '👛 ' + namaT(f.dompet)],
    f.oleh && ['oleh', '👤 ' + namaPendek(f.oleh)],
  ].filter(Boolean);
  const jumlahFilter = chipFilter.length + (f.rentang !== 'periode' ? 1 : 0);

  return `
    <div class="kepala"><h1>${T('Riwayat')}</h1>${f.rentang === 'periode' ? pemilihBulan()
      : `<button class="chip aktif" data-aksi="hapus-filter" data-k="rentang" aria-label="${T('Kembali ke periode ini')}">📅 ${esc(labelRentang())} ✕</button>`}</div>
    <input class="cari" id="cari" type="search" placeholder="${T('Cari catatan, kategori, nominal…')}" value="${esc(S.cari)}">
    <div class="chips">
      <button class="chip ${jumlahFilter ? 'aktif' : ''}" data-aksi="buka-filter">⚙︎ ${T('Filter')}${jumlahFilter ? ' (' + jumlahFilter + ')' : ''}</button>
      ${['Semua', TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button class="chip ${S.filterTipe === t ? 'aktif' : ''}" data-aksi="filter-tipe" data-tipe="${t}">${t === 'Semua' ? T('Semua') : namaT(t)}</button>`).join('')}
    </div>
    ${chipFilter.length ? `<div class="chips">${chipFilter.map(([k, l]) =>
      `<button class="chip aktif" data-aksi="hapus-filter" data-k="${k}">${esc(l)} ✕</button>`).join('')}</div>` : ''}
    <div id="hasil-riwayat">${sumber === null
      ? KERANGKA_DAFTAR
      : ringkas + (isi || kosong('🔍', T('Tidak ada transaksi yang cocok.'))) + lagi}</div>`;
}

function bukaFilter() {
  const f = S.filter;
  F = { rentang: f.rentang };
  const daftar = (S.cariData && S.cariData.transaksi) || S.data.transaksi;
  const anggota = Array.from(new Set([S.data.user].concat(daftar.map(t => t.oleh)).filter(Boolean)));
  const pilih = (id, label, kosongLabel, opsi, nilai) => `
    <div class="grup-form">
      <label class="label" for="${id}">${label}</label>
      <select class="field" id="${id}"><option value="">${kosongLabel}</option>${opsi.map(([v, l]) =>
        `<option value="${esc(v)}" ${v === nilai ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    </div>`;
  const namaKategori = Array.from(new Set(S.data.kategori.map(k => k.nama)));
  bukaSheet(T('Filter Riwayat'), `
    <span class="label">${T('Rentang waktu')}</span>
    <div class="chips" style="flex-wrap:wrap">${PILIHAN_RENTANG.map(([k, l]) =>
      `<button type="button" class="chip ${f.rentang === k ? 'aktif' : ''}" data-aksi="pilih-rentang" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="dua-kolom" id="filter-kustom" ${f.rentang === 'kustom' ? '' : 'hidden'}>
      <div class="grup-form"><label class="label" for="fl-dari">${T('Dari')}</label><input class="field" id="fl-dari" type="date" value="${esc(f.dari)}"></div>
      <div class="grup-form"><label class="label" for="fl-sampai">${T('Sampai')}</label><input class="field" id="fl-sampai" type="date" value="${esc(f.sampai)}"></div>
    </div>
    ${pilih('fl-kategori', T('Kategori'), T('Semua kategori'), namaKategori.map(n => [n, namaT(n)]), f.kategori)}
    ${pilih('fl-dompet', T('Dompet'), T('Semua dompet'), S.data.dompet.map(w => [w.nama, w.ikon + ' ' + namaT(w.nama)]), f.dompet)}
    ${anggota.length > 1 ? pilih('fl-oleh', T('Dicatat oleh'), T('Semua anggota'), anggota.map(e => [e, namaPendek(e)]), f.oleh) : ''}
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="reset-filter">${T('Reset')}</button>
      <button type="button" class="btn btn-utama" data-aksi="terapkan-filter">${T('Terapkan')}</button>
    </div>`);
}

// ---------- Halaman: Dompet ----------

function viewDompet() {
  const dompet = dompetBiasa();
  const tabungan = daftarTabungan();
  const saldo = dompet.reduce((a, w) => a + w.saldo, 0);
  const totalTabungan = tabungan.reduce((a, w) => a + w.saldo, 0);
  return `
    <div class="kepala"><h1>${T('Dompet & Tabungan')}</h1></div>
    <section class="kartu kartu-saldo">
      <small>${T('Total saldo dompet')}</small>
      <div class="besar" style="margin-bottom:0">${rp(saldo)}</div>
      ${tabungan.length ? `<div class="selisih">${T('🐷 Total tabungan: <b>{jumlah}</b>', { jumlah: rp(totalTabungan) })}</div>` : ''}
    </section>

    <h2 class="judul-bagian">${T('Dompet||jamak')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${dompet.map(w => `
        <button class="baris" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">
          <span class="ikon-bulat">${ilus(w.ikon)}</span>
          <span class="isi"><b>${esc(namaT(w.nama))}</b></span>
          <b class="nominal ${w.saldo < 0 ? 'minus' : ''}">${rp(w.saldo)}</b>
        </button>`).join('') || kosong('👛', T('Belum ada dompet.'))}
    </section>
    ${dompet.length ? `<p class="info-kecil" style="margin-top:8px">${T('Saldo tidak cocok dengan aslinya? Ketuk dompetnya, lalu ganti angka saldo sekarang.')}</p>` : ''}
    <button class="tombol-tambah" data-aksi="tambah-dompet">${T('＋ Tambah dompet')}</button>

    <h2 class="judul-bagian">${T('Tabungan')}</h2>
    ${tabungan.length
      ? `<section class="kartu" style="padding:4px 16px">${tabungan.map(itemTabungan).join('')}</section>`
      : `<section class="kartu">${kosong('🐷', T('Belum ada tabungan. Buat tabungan dengan target (mis. dana darurat, liburan) atau tanpa batas.'))}</section>`}
    <button class="tombol-tambah" data-aksi="tambah-tabungan">${T('＋ Tambah tabungan')}</button>

    ${bagianUtang()}

    ${bagianAset()}`;
}

// ---------- Aset & kekayaan bersih ----------

/** Kekayaan bersih = dompet + tabungan + aset + piutang − utang. */
function hitungKekayaan() {
  const jumlah = daftar => daftar.reduce((a, w) => a + w.saldo, 0);
  const utang = daftarUtang();
  const r = {
    dompet: jumlah(dompetBiasa()),
    tabungan: jumlah(daftarTabungan()),
    aset: jumlah(daftarAset()),
    piutang: utang.filter(w => w.saldo > 0).reduce((a, w) => a + w.saldo, 0),
    utang: utang.filter(w => w.saldo < 0).reduce((a, w) => a - w.saldo, 0),
  };
  r.bersih = r.dompet + r.tabungan + r.aset + r.piutang - r.utang;
  return r;
}

function bagianAset() {
  const k = hitungKekayaan();
  const baris = (label, nilai, minus) => nilai ? `<div class="baris-rincian"><span>${label}</span><span>${minus ? '−' : ''}${rp(nilai)}</span></div>` : '';
  return `
    <h2 class="judul-bagian">${T('Aset & Kekayaan Bersih')}</h2>
    <section class="kartu">
      <small class="label" style="margin:0">${T('Kekayaan bersih')}</small>
      <div class="kekayaan ${k.bersih < 0 ? 'minus' : ''}">${rp(k.bersih)}</div>
      ${baris(T('👛 Dompet'), k.dompet)}${baris(T('🐷 Tabungan'), k.tabungan)}${baris(T('💎 Aset'), k.aset)}
      ${baris(T('🤝 Piutang (orang berutang ke Anda)'), k.piutang)}${baris(T('🤝 Utang Anda'), k.utang, true)}
      <p class="info-kecil" style="text-align:left">${T('Semua yang dimiliki dikurangi utang. Nilai aset diperbarui manual.')}</p>
    </section>
    ${daftarAset().length ? `<section class="kartu" style="padding:4px 16px">${daftarAset().map(w => `
      <button class="baris" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">
        <span class="ikon-bulat">${ilus(w.ikon)}</span>
        <span class="isi"><b>${esc(w.nama)}</b><small>${T('Ketuk untuk memperbarui nilai')}</small></span>
        <b class="nominal">${rp(w.saldo)}</b>
      </button>`).join('')}</section>` : ''}
    <button class="tombol-tambah" data-aksi="tambah-aset">${T('＋ Tambah aset (emas, reksadana, properti…)')}</button>
    <button class="tombol-tambah" style="margin-top:10px" data-aksi="buka-zakat">${T('🕌 Hitung zakat')}</button>`;
}

// ---------- Kalkulator zakat ----------

const NISAB_EMAS_GRAM = 85;
const KADAR_ZAKAT = 0.025;

/**
 * Perkiraan zakat dari data yang ada. Maal: harta (dompet + tabungan + aset + piutang − utang) ≥ nisab 85 g emas.
 * Penghasilan: pemasukan periode ini ≥ nisab/12 (pendapat yang umum dipakai di Indonesia). Haul tidak diperiksa.
 */
function bukaZakat() {
  const hargaEmas = Number(bacaHp('dk_harga_emas')) || 0;
  const k = hitungKekayaan();
  const harta = k.bersih;
  const masuk = total(S.data.transaksi, TIPE.MASUK);
  const nisab = hargaEmas * NISAB_EMAS_GRAM;
  const maal = hargaEmas && harta >= nisab ? Math.round(harta * KADAR_ZAKAT) : 0;
  const penghasilan = hargaEmas && masuk >= nisab / 12 ? Math.round(masuk * KADAR_ZAKAT) : 0;
  const hasil = (judul, dasar, batas, zakat, jenis) => `
    <section class="kartu" style="margin:12px 0 0">
      <h3 style="margin-bottom:6px">${judul}</h3>
      <div class="baris-rincian"><span>${jenis === 'maal' ? T('Harta bersih saat ini') : T('Pemasukan {bulan}', { bulan: esc(namaBulan(S.bulan)) })}</span><span>${rp(dasar)}</span></div>
      <div class="baris-rincian"><span>${jenis === 'maal' ? T('Nisab ({gram} g emas)', { gram: NISAB_EMAS_GRAM }) : T('Nisab per bulan')}</span><span>${hargaEmas ? rp(Math.round(batas)) : '—'}</span></div>
      <div class="baris-rincian"><span><b>${T('Zakat 2,5%')}</b></span><b>${!hargaEmas ? T('Isi harga emas') : zakat ? rp(zakat) : T('Belum wajib')}</b></div>
      ${zakat ? `<button type="button" class="tombol-tambah" style="margin-top:10px" data-aksi="catat-zakat" data-jumlah="${zakat}" data-jenis="${jenis}">${T('Catat pembayaran {jumlah}', { jumlah: rp(zakat) })}</button>` : ''}
    </section>`;
  bukaSheet(T('Kalkulator Zakat'), `
    <div class="grup-form">
      <label class="label" for="z-emas">${T('Harga emas per gram (Rp)')}</label>
      <input class="field input-rp" id="z-emas" inputmode="numeric" placeholder="${T('mis. 1.500.000')}" value="${formatAngka(hargaEmas)}">
      <p class="info-kecil" style="text-align:left">${T('Lihat harga emas hari ini (mis. di situs Antam), lalu ketuk Hitung. Disimpan di HP ini.')}</p>
    </div>
    <div class="aksi-form" style="margin-top:0"><button type="button" class="btn btn-hapus" style="flex:1" data-aksi="hitung-zakat">${T('Hitung')}</button></div>
    ${hasil(T('💰 Zakat maal (harta)'), harta, nisab, maal, 'maal')}
    ${hasil(T('💼 Zakat penghasilan'), masuk, nisab / 12, penghasilan, 'penghasilan')}
    <p class="info-kecil" style="text-align:left">${T('Ini perkiraan. Zakat maal juga mensyaratkan harta sudah dimiliki selama 1 tahun (haul). Untuk kepastian, tanyakan ke lembaga amil zakat atau ustadz.')}</p>`);
}

// ---------- Templat cepat (tabungan & tagihan rutin) ----------

const TEMPLAT_TABUNGAN = [['🛡️', T('Dana Darurat')], ['🕌', T('Lebaran & THR')], ['🕋', T('Umroh / Haji')], ['🏖️', T('Liburan')],
  ['🎓', T('Pendidikan Anak')], ['🏠', T('DP Rumah')], ['💍', T('Pernikahan')], ['🏍️', T('Kendaraan')]];
const TEMPLAT_RUTIN = [['💡', T('Listrik PLN'), TIPE.KELUAR], ['📶', T('Internet / WiFi'), TIPE.KELUAR], ['🎯', T('Arisan'), TIPE.KELUAR],
  ['🏍️', T('Cicilan motor'), TIPE.KELUAR], ['🎓', T('SPP sekolah'), TIPE.KELUAR], ['🛡️', T('BPJS Kesehatan'), TIPE.KELUAR],
  ['📱', T('Pulsa & kuota'), TIPE.KELUAR], ['💼', T('Gaji||templat'), TIPE.MASUK]];

function chipTemplat(daftar, aksi) {
  return `<div class="chips" aria-label="${T('Templat')}">${daftar.map((t, i) =>
    `<button type="button" class="chip" data-aksi="${aksi}" data-i="${i}">${t[0]} ${esc(t[1])}</button>`).join('')}</div>`;
}

// ---------- Utang & piutang ----------

/** Teks status satu orang. saldo > 0: dia berutang ke kita; < 0: kita berutang ke dia. */
function statusUtang(w) {
  if (!w.saldo) return T('✅ Lunas');
  const teks = w.saldo > 0 ? T('Berutang ke Anda {jumlah}', { jumlah: rp(w.saldo) }) : T('Anda berutang {jumlah}', { jumlah: rp(-w.saldo) });
  return teks + (w.tenggat ? ' · ' + labelJatuhTempo(w.tenggat).replace(/ · .*$/, '') : '');
}

function itemUtang(w) {
  return `
    <button class="baris" data-aksi="buka-utang" data-nama="${esc(w.nama)}">
      <span class="ikon-bulat">${ilus(w.ikon)}</span>
      <span class="isi"><b>${esc(w.nama)}</b><small class="${w.saldo && w.tenggat && selisihHari(w.tenggat) < 0 ? 'terlambat' : ''}">${esc(statusUtang(w))}</small></span>
      <b class="nominal ${w.saldo < 0 ? 'minus' : ''}">${w.saldo ? rp(Math.abs(w.saldo)) : ''}</b>
    </button>`;
}

function bagianUtang() {
  const semua = daftarUtang();
  const aktif = semua.filter(w => w.saldo);
  const lunas = semua.filter(w => !w.saldo);
  const piutang = aktif.filter(w => w.saldo > 0).reduce((a, w) => a + w.saldo, 0);
  const utang = aktif.filter(w => w.saldo < 0).reduce((a, w) => a - w.saldo, 0);
  return `
    <h2 class="judul-bagian">${T('Utang & Piutang')}</h2>
    ${aktif.length ? `
      <div class="kpi">
        <div class="tile"><small>${T('Orang berutang ke Anda')}</small><b>${rp(piutang)}</b></div>
        <div class="tile"><small>${T('Anda berutang')}</small><b>${rp(utang)}</b></div>
      </div>
      <section class="kartu" style="padding:4px 16px">${aktif.map(itemUtang).join('')}</section>`
    : `<section class="kartu">${kosong('🤝', T('Tidak ada utang-piutang. Catat saat meminjamkan atau meminjam uang, supaya tidak lupa.'))}</section>`}
    ${lunas.length ? `
      <details class="tabel-data"><summary>${T('Sudah lunas ({n})', { n: lunas.length })}</summary>
        <section class="kartu" style="padding:4px 16px">${lunas.map(itemUtang).join('')}</section></details>` : ''}
    <button class="tombol-tambah" data-aksi="tambah-utang">${T('＋ Catat utang / piutang')}</button>`;
}

/** Form pinjaman baru (atau tambahan pinjaman ke orang yang sama). */
function bukaFormUtang(nama, arah) {
  const pertama = dompetBiasa()[0];
  F = { utang: true, arah: arah || 'piutang', nama: nama || '', dompet: pertama ? pertama.nama : '', jumlah: 0, tanggal: hariIni(), tenggat: '', catatan: '' };
  bukaSheet(nama ? T('Pinjaman · {nama}', { nama }) : T('Catat Utang / Piutang'), '<div id="form-utang"></div>');
  renderFormUtang();
}

function renderFormUtang() {
  const keOrang = F.arah === 'piutang';
  $('#form-utang').innerHTML = `
    <div class="segmen">
      <button type="button" class="${keOrang ? 'aktif' : ''}" data-aksi="u-arah" data-arah="piutang">${T('Saya meminjamkan')}</button>
      <button type="button" class="${keOrang ? '' : 'aktif'}" data-aksi="u-arah" data-arah="utang">${T('Saya meminjam')}</button>
    </div>
    <div class="grup-form">
      <label class="label" for="u-nama">${keOrang ? T('Dipinjamkan ke') : T('Pinjam dari')}</label>
      <input class="field" id="u-nama" maxlength="40" list="u-daftar" placeholder="${T('Nama orang, mis. Budi')}" value="${esc(F.nama)}">
      <datalist id="u-daftar">${daftarUtang().map(w => `<option value="${esc(w.nama)}">`).join('')}</datalist>
    </div>
    <label class="input-jumlah">
      <span>Rp</span>
      <input id="u-jumlah" class="input-rp" inputmode="numeric" autocomplete="off" placeholder="0" value="${formatAngka(F.jumlah)}">
    </label>
    <div class="grup-form">
      <span class="label">${keOrang ? T('Uangnya keluar dari') : T('Uangnya masuk ke')}</span>
      <div class="grid-pilih">${dompetBiasa().map(w =>
        `<button type="button" class="pilihan ${w.nama === F.dompet ? 'aktif' : ''}" data-aksi="u-dompet" data-nama="${esc(w.nama)}"><span>${ilus(w.ikon)}</span>${esc(namaT(w.nama))}</button>`).join('')}</div>
    </div>
    <div class="grup-form">
      <label class="label" for="u-tanggal">${T('Tanggal')}</label>
      ${inputTanggal('u-tanggal', F.tanggal)}
    </div>
    <div class="grup-form">
      <label class="label" for="u-tenggat">${T('Jatuh tempo (opsional)')}</label>
      <input class="field" id="u-tenggat" type="date" value="${esc(F.tenggat)}">
      <p class="info-kecil" style="text-align:left">${T('Diingatkan di Beranda menjelang tanggal ini.')}</p>
    </div>
    <div class="grup-form">
      <label class="label" for="u-catatan">${T('Catatan (opsional)')}</label>
      <input class="field" id="u-catatan" maxlength="500" placeholder="${T('mis. untuk bayar kos')}" value="${esc(F.catatan)}">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-utang">${T('Simpan')}</button></div>
    <p class="info-kecil">${T('Pinjam-meminjam tidak dihitung sebagai pemasukan atau pengeluaran.')}</p>`;
}

function bacaFormUtang() {
  F.nama = $('#u-nama').value.trim();
  F.jumlah = angka($('#u-jumlah').value);
  F.tanggal = $('#u-tanggal').value;
  F.tenggat = $('#u-tenggat').value;
  F.catatan = $('#u-catatan').value;
}

// ---------- Beberapa buku keuangan ----------

const TEMPLAT_BUKU = [T('Pribadi'), T('Usaha||buku'), T('Orang Tua'), T('Arisan||buku'), T('Kos / Kontrakan')];

function bukaDaftarBuku() {
  const daftar = S.data.buku || [];
  bukaSheet(T('Buku Keuangan'), `
    ${tombolCekUndangan()}
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">${T('Tiap buku punya dompet, kategori, dan catatan sendiri (spreadsheet terpisah), dan bisa dibagikan ke orang yang berbeda. Mis. Keluarga dengan pasangan, Usaha dengan rekan.')}</p>
    ${daftar.map(b => `
      <div class="kartu-buku ${b.aktif ? 'aktif' : ''}">
        <div class="baris">
          <button type="button" class="isi tombol-buku" data-aksi="pindah-buku" data-id="${esc(b.id)}" ${b.aktif ? 'disabled' : ''}>
            <span class="ikon-bulat">${/(^| - )deleted$/i.test(b.nama) ? '🗑️' : '📒'}</span>
            <span><b>${esc(namaT(b.nama))}</b><small>${b.aktif ? T('✅ Sedang dibuka') : /(^| - )deleted$/i.test(b.nama) ? T('Sudah dihapus pemiliknya') : T('Ketuk untuk membuka')}</small></span>
          </button>
          <span class="slot-hapus" data-buku-hapus="${esc(b.id)}"></span>
        </div>
        <button type="button" class="anggota-buku" data-aksi="anggota-buku" data-id="${esc(b.id)}">
          <span class="ringkas-anggota" data-buku-anggota="${esc(b.id)}">${T('👥 Memuat siapa saja yang bisa mencatat…')}</span>
          <span class="undang-buku">${T('＋ Undang')}</span>
        </button>
      </div>`).join('')}
    <div class="grup-form" style="margin-top:16px">
      <label class="label" for="b-nama">${T('Buku baru')}</label>
      ${chipTemplat(TEMPLAT_BUKU.map(n => ['📒', n]), 'templat-buku')}
      <div class="salin">
        <input class="field" id="b-nama" maxlength="40" placeholder="${T('Nama buku, mis. Usaha')}">
        <button type="button" class="btn btn-utama" style="flex:none" data-aksi="buat-buku">${T('Buat')}</button>
      </div>
    </div>
    <p class="info-kecil" style="text-align:left">${T('🗑️ Hapus buku hanya bisa oleh pemiliknya: buku hilang dari daftar, dan spreadsheet-nya di Google Drive diberi nama "… - deleted" (datanya tidak hilang). ✕ pada buku milik orang lain hanya menghapusnya dari daftar Anda. Buku yang sedang dibuka tidak bisa dihapus, pindah ke buku lain dulu.')}</p>`);
  muatRingkasAnggota(daftar);
}

/** Kartu "Cek undangan": membuka daftar spreadsheet yang dibagikan orang lain ke akun ini. */
function tombolCekUndangan() {
  return `<button type="button" class="kartu-undangan" data-aksi="cek-undangan">
      <span class="ikon-bulat">📩</span>
      <span class="isi"><b>${T('Diundang ke buku orang lain?')}</b><small>${T('Cek undangan, lalu pilih satu atau beberapa buku')}</small></span>
      <span class="panah">${svg('maju')}</span>
    </button>`;
}

/**
 * Ringkasan anggota tiap buku ("👑 Anda · Rina, Budi"), dimuat bersamaan setelah lembar terbuka.
 * Sekalian menentukan tombol di kanan: 🗑️ Hapus buku (pemilik) atau ✕ Keluarkan dari daftar (bukan pemilik).
 */
function muatRingkasAnggota(daftar) {
  const saya = String(GOOGLE.email() || '').toLowerCase();
  daftar.forEach(async b => {
    const el = () => document.querySelector(`[data-buku-anggota="${CSS.escape(b.id)}"]`);
    const slot = () => document.querySelector(`[data-buku-hapus="${CSS.escape(b.id)}"]`);
    let teks, milikSaya = null;
    try {
      const anggota = await api('daftarAnggota', b.aktif ? '' : b.id);
      const nama = a => (a.email.toLowerCase() === saya ? T('Anda') : (a.nama || a.email).split(/[ @]/)[0]);
      const pemilik = anggota.find(a => a.peran === 'owner');
      milikSaya = !!pemilik && pemilik.email.toLowerCase() === saya;
      const lain = anggota.filter(a => a !== pemilik).map(nama);
      teks = (pemilik ? '👑 ' + nama(pemilik) : '👥') + (lain.length ? ' · ' + lain.join(', ') : '')
        + (anggota.length > 1 ? ' ' + T('({n} orang)', { n: anggota.length }) : ' · ' + T('belum dibagikan'));
    } catch (e) {
      if (e instanceof GOOGLE.PerluMasuk) return;
      teks = T('👥 Daftar anggota tidak bisa dimuat');
    }
    if (el()) el().textContent = teks;
    if (!slot() || b.aktif) return;
    slot().innerHTML = milikSaya
      ? `<button type="button" class="tombol-ikon" data-aksi="hapus-buku" data-id="${esc(b.id)}" aria-label="${T('Hapus buku {nama}', { nama: esc(b.nama) })}">🗑️</button>`
      : `<button type="button" class="tombol-ikon" data-aksi="lupakan-buku" data-id="${esc(b.id)}" aria-label="${T('Hapus {nama} dari daftar Anda', { nama: esc(b.nama) })}">✕</button>`;
  });
}

/** Setelah "Cek undangan" menambah beberapa buku sekaligus: pilih mana yang dibuka dulu. */
function bukaPilihBukuUndangan(buku) {
  bukaSheet(T('Buka buku yang mana?'), `
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">${T('{n} buku sudah masuk ke daftar Anda. Pilih yang mau dibuka sekarang; yang lain bisa dibuka kapan saja dari Lainnya → Buku Keuangan.', { n: buku.length })}</p>
    ${buku.map(b => `
      <button type="button" class="baris" data-aksi="buka-undangan" data-id="${esc(b.id)}" data-nama="${esc(b.nama)}">
        <span class="ikon-bulat">📒</span>
        <span class="isi"><b>${esc(b.nama)}</b><small>${T('Ketuk untuk membuka')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`).join('')}`);
}

/** Setelah pindah/buat buku: semua yang terkait buku lama dibuang, lalu muat ulang. */
async function gantiBuku(fungsi, args, pesan) {
  loading(true);
  try {
    await api(fungsi, ...args);
    S.bulan = '';
    S.cariData = null;
    S.filter = Object.assign({}, FILTER_KOSONG);
    S.tab = 'beranda';
    await muatDariAwal();
    toast(pesan);
  } catch (e) {
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
  } finally {
    loading(false);
  }
}

// ---------- Patungan ----------

/** dari: isian form transaksi yang sedang dibuka (total, kategori, dompet, tanggal, catatan). */
function bukaFormPatungan(dari) {
  const pertama = dompetBiasa()[0];
  F = Object.assign({ patungan: true, total: 0, kategori: '', dompet: pertama ? pertama.nama : '', tanggal: hariIni(), catatan: '' }, dari,
    { patungan: true, ikut: true, peserta: [] });
  bukaSheet(T('Patungan'), '<div id="form-patungan"></div>');
  renderFormPatungan();
}

/** Bagian rata; sisa pembulatan masuk ke bagian kita (atau orang pertama kalau kita tidak ikut). */
function bagiRata() {
  const orang = F.peserta.length + (F.ikut ? 1 : 0);
  if (!orang) return;
  const per = Math.floor(F.total / orang);
  F.peserta.forEach(p => { p.jumlah = per; });
  if (!F.ikut && F.peserta.length) F.peserta[0].jumlah += F.total - per * orang;
}

const bagianSaya = () => (F.ikut ? F.total - F.peserta.reduce((a, p) => a + p.jumlah, 0) : 0);

function renderFormPatungan() {
  const kenal = daftarUtang().map(w => w.nama).filter(n => !F.peserta.some(p => p.nama.toLowerCase() === n.toLowerCase()));
  const saya = bagianSaya();
  const selisih = F.total - F.peserta.reduce((a, p) => a + p.jumlah, 0) - (F.ikut ? saya : 0);
  $('#form-patungan').innerHTML = `
    <p class="info-kecil" style="text-align:left;margin:0 0 12px">${T('Anda membayar dulu. Bagian Anda dicatat sebagai pengeluaran, bagian orang lain jadi <b>piutang</b> (bisa ditagih lewat WhatsApp dari tab Dompet).')}</p>
    <label class="input-jumlah"><span>Rp</span>
      <input id="p-total" class="input-rp" inputmode="numeric" autocomplete="off" placeholder="${T('Total tagihan')}" value="${formatAngka(F.total)}"></label>
    <div class="grup-form">
      <label class="label" for="p-catatan">${T('Untuk apa')}</label>
      <input class="field" id="p-catatan" maxlength="200" placeholder="${T('mis. Makan bareng di Solaria')}" value="${esc(F.catatan)}">
    </div>
    <div class="grup-form">
      <span class="label">${T('Siapa saja yang ikut?')}</span>
      ${F.peserta.map((p, i) => `
        <div class="baris baris-input">
          <span class="ikon-bulat">👤</span>
          <span class="isi"><b>${esc(p.nama)}</b><button type="button" class="tombol-teks" style="padding:0;font-size:12px" data-aksi="p-hapus" data-i="${i}">${T('Hapus')}</button></span>
          <input class="field input-rp input-bagian" data-i="${i}" inputmode="numeric" aria-label="${T('Bagian {nama}', { nama: esc(p.nama) })}" value="${formatAngka(p.jumlah)}">
        </div>`).join('')}
      <div class="salin" style="margin-top:8px">
        <input class="field" id="p-nama" maxlength="40" list="p-kenal" placeholder="${T('Nama teman, lalu Tambah')}">
        <datalist id="p-kenal">${kenal.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <button type="button" class="btn btn-hapus" data-aksi="p-tambah">${T('Tambah')}</button>
      </div>
      <label class="amplop" style="margin-top:10px"><input type="checkbox" id="p-ikut" data-aksi="p-ikut" ${F.ikut ? 'checked' : ''}> ${T('Saya juga ikut menanggung')}</label>
      ${F.peserta.length ? `<p class="info-kecil" style="text-align:left">
        ${F.ikut ? `${T('Bagian Anda: <b>{jumlah}</b>', { jumlah: rp(saya) })} · ` : ''}<button type="button" class="tombol-teks" style="padding:0;font-size:12px" data-aksi="p-rata">${T('Bagi rata lagi')}</button>
        ${saya < 0 || (!F.ikut && selisih) ? `<br>${T('⚠️ Jumlah bagian belum sama dengan total.')}` : ''}</p>` : ''}
    </div>
    ${F.ikut ? `
      <div class="grup-form">
        <label class="label" for="p-kategori">${T('Kategori bagian Anda')}</label>
        <select class="field" id="p-kategori">${S.data.kategori.filter(k => k.tipe === TIPE.KELUAR).map(k =>
          `<option value="${esc(k.nama)}" ${k.nama === F.kategori ? 'selected' : ''}>${esc(k.ikon + ' ' + namaT(k.nama))}</option>`).join('')}</select>
      </div>` : ''}
    <div class="grup-form">
      <label class="label" for="p-dompet">${T('Dibayar dari')}</label>
      <select class="field" id="p-dompet">${dompetBiasa().map(w =>
        `<option value="${esc(w.nama)}" ${w.nama === F.dompet ? 'selected' : ''}>${esc(w.ikon + ' ' + namaT(w.nama))}</option>`).join('')}</select>
    </div>
    <div class="grup-form">
      <label class="label" for="p-tanggal">${T('Tanggal')}</label>
      ${inputTanggal('p-tanggal', F.tanggal)}
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-patungan">${T('Simpan patungan')}</button></div>`;
}

function bacaFormPatungan() {
  const totalBaru = angka($('#p-total').value);
  F.catatan = $('#p-catatan').value;
  F.tanggal = $('#p-tanggal').value;
  F.dompet = $('#p-dompet').value;
  if ($('#p-kategori')) F.kategori = $('#p-kategori').value;
  document.querySelectorAll('.input-bagian').forEach(i => { F.peserta[Number(i.dataset.i)].jumlah = angka(i.value); });
  if (totalBaru !== F.total) { F.total = totalBaru; bagiRata(); } // total berubah → bagi rata ulang
}

/** Ringkasan satu orang: pelunasan, tambah pinjaman, ingatkan lewat WhatsApp. */
function bukaUtang(w) {
  const dia = w.saldo > 0;
  const pesanWa = w.tenggat
    ? T('Halo {nama}, mau mengingatkan pinjaman {jumlah} (jatuh tempo {tanggal}). Terima kasih 🙏', { nama: w.nama, jumlah: rp(w.saldo), tanggal: tanggalPendek(w.tenggat) })
    : T('Halo {nama}, mau mengingatkan pinjaman {jumlah}. Terima kasih 🙏', { nama: w.nama, jumlah: rp(w.saldo) });
  bukaSheet(w.nama, `
    <div class="ringkas-tabungan">
      <span class="ikon-bulat">${ilus(w.ikon)}</span>
      <div><small>${w.saldo ? (dia ? T('Berutang ke Anda') : T('Anda berutang')) : T('Status')}</small><b>${w.saldo ? rp(Math.abs(w.saldo)) : T('✅ Lunas')}</b></div>
    </div>
    ${w.tenggat && w.saldo ? `<p class="info-kecil" style="text-align:left;margin:8px 0 0">${T('Jatuh tempo: {tanggal}', { tanggal: esc(labelJatuhTempo(w.tenggat)) })}</p>` : ''}
    ${w.saldo ? `
      <div class="aksi-form">
        <button type="button" class="btn btn-utama" data-aksi="lunasi-utang" data-nama="${esc(w.nama)}">${dia ? T('Terima pembayaran') : T('Bayar utang')}</button>
      </div>` : ''}
    ${dia ? `<a class="tombol-tambah" style="display:block;text-align:center;text-decoration:none;margin-top:12px" href="https://wa.me/?text=${encodeURIComponent(pesanWa)}" target="_blank" rel="noopener">${T('💬 Ingatkan lewat WhatsApp')}</a>` : ''}
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="tambah-utang" data-nama="${esc(w.nama)}" data-arah="${w.saldo < 0 ? 'utang' : 'piutang'}">${T('＋ Tambah pinjaman')}</button>
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">${T('✏️ Ubah nama / jatuh tempo')}</button>
    <p class="info-kecil">${T('Riwayatnya bisa dicari di tab Riwayat dengan mengetik "{nama}".', { nama: esc(w.nama) })}</p>`);
}

function tanggalPendek(s) {
  return keTanggal(s).toLocaleDateString(LOKAL, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Hari ini · Kamis, 5 November 2026" (juga Kemarin / Besok) untuk keterangan di bawah isian tanggal. */
function keteranganHari(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return '';
  const selisih = Math.round((keTanggal(s) - keTanggal(hariIni())) / 864e5);
  const dekat = { '-1': T('Kemarin'), 0: T('Hari ini'), 1: T('Besok') }[selisih];
  const lengkap = keTanggal(s).toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (dekat ? dekat + ' · ' : '') + lengkap;
}

/** Isian tanggal dengan tombol ‹ › (hari sebelumnya / berikutnya) dan nama hari di bawahnya. */
function inputTanggal(id, nilai) {
  const tombol = (geser, label, ikon) =>
    `<button type="button" class="geser-tanggal" data-aksi="geser-tanggal" data-untuk="${id}" data-geser="${geser}" aria-label="${label}">${ikon}</button>`;
  return `<div class="input-tanggal">
      ${tombol(-1, T('Hari sebelumnya'), svg('kembali'))}
      <input class="field" id="${id}" type="date" value="${esc(nilai)}" aria-describedby="${id}-hari">
      ${tombol(1, T('Hari berikutnya'), svg('maju'))}
    </div>
    <p class="hari-tanggal" id="${id}-hari">${esc(keteranganHari(nilai))}</p>`;
}
function perbaruiHari(input) {
  const ket = document.getElementById(input.id + '-hari');
  if (ket) ket.textContent = keteranganHari(input.value);
}

/** Progres tabungan: { persen, teks }. Tanpa target → persen null. */
function progresTabungan(w) {
  if (!w.target) return { persen: null, teks: T('Tanpa target') };
  const persen = Math.max(0, Math.min(100, Math.floor(w.saldo / w.target * 100)));
  if (w.saldo >= w.target) return { persen: 100, teks: T('🎉 Target {jumlah} tercapai', { jumlah: rp(w.target) }) };
  const sisa = w.target - w.saldo;
  let teks = T('{persen}% dari {target} · kurang {sisa}', { persen, target: rp(w.target), sisa: rp(sisa) });
  if (w.tenggat) {
    if (w.tenggat < hariIni()) {
      teks += ' · ' + T('⚠️ lewat tenggat {tanggal}', { tanggal: tanggalPendek(w.tenggat) });
    } else {
      const [y1, m1] = hariIni().split('-').map(Number);
      const [y2, m2] = w.tenggat.split('-').map(Number);
      const bulanLagi = Math.max(1, (y2 - y1) * 12 + (m2 - m1));
      teks += ' · ' + T('{jumlah}/bulan s.d. {tanggal}', { jumlah: rp(Math.ceil(sisa / bulanLagi)), tanggal: tanggalPendek(w.tenggat) });
    }
  }
  return { persen, teks };
}

function itemTabungan(w) {
  const p = progresTabungan(w);
  return `
    <button class="baris" data-aksi="buka-tabungan" data-nama="${esc(w.nama)}">
      <span class="ikon-bulat">${ilus(w.ikon)}</span>
      <span class="isi"><b>${esc(w.nama)}</b>
        ${p.persen !== null ? `<span class="meter" role="meter" aria-label="${esc(w.nama)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.persen}"><i style="width:${p.persen}%"></i></span>` : ''}
        <small>${esc(p.teks)}</small></span>
      <b class="nominal">${rp(w.saldo)}</b>
    </button>`;
}

// ---------- Halaman: Laporan ----------

const NAMA_BULAN_PENDEK = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(LOKAL, { month: 'short' }));
const RINGKAS_KOSONG = { masuk: 0, keluar: 0, ditabung: 0, kategori: {}, oleh: {} };
const ringkasBulan = k => S.data.bulanan[k] || RINGKAS_KOSONG;

function bulanSebelum(k) {
  const d = keTanggal(k);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function viewLaporan() {
  const th = S.tahun;
  const bulan = Array.from({ length: 12 }, (_, i) => th + '-' + String(i + 1).padStart(2, '0'));
  const data = bulan.map(ringkasBulan);
  const jumlah = f => data.reduce((a, x) => a + x[f], 0);
  const masuk = jumlah('masuk');
  const keluar = jumlah('keluar');
  const ditabung = jumlah('ditabung');
  const bulanAktif = data.filter(x => x.masuk || x.keluar).length;
  const rasio = masuk ? Math.round((masuk - keluar) / masuk * 100) : null;
  const pilih = S.bulan.slice(0, 4) === String(th) ? S.bulan : bulan[11];
  const r = ringkasBulan(pilih);
  const tile = (label, nilai, ket) => `<div class="tile"><small>${label}</small><b>${nilai}</b>${ket ? `<span>${ket}</span>` : ''}</div>`;

  return `
    <div class="kepala">
      <h1>${T('Laporan')}</h1>
      <div class="pemilih-bulan">
        <button data-aksi="tahun" data-geser="-1" aria-label="${T('Tahun sebelumnya')}">${svg('kembali')}</button>
        <span>${th}</span>
        <button data-aksi="tahun" data-geser="1" aria-label="${T('Tahun berikutnya')}">${svg('maju')}</button>
      </div>
    </div>

    <div class="kpi">
      ${tile(T('Pemasukan {tahun}', { tahun: th }), rp(masuk))}
      ${tile(T('Pengeluaran {tahun}', { tahun: th }), rp(keluar))}
      ${tile(T('Selisih'), rp(masuk - keluar), rasio !== null ? T('{persen}% dari pemasukan', { persen: rasio }) : '')}
      ${tile(T('Rata-rata pengeluaran'), rp(Math.round(keluar / Math.max(1, bulanAktif))), T('per bulan'))}
      ${ditabung ? tile(T('Masuk tabungan'), rp(ditabung), T('setoran − penarikan')) : ''}
    </div>

    <section class="kartu">
      <h3>${T('Pemasukan & pengeluaran per bulan')}</h3>
      ${geserGrafik(bulan, data, pilih)}
      <p class="detail-bulan"><b>${esc(namaBulan(pilih))}</b> · ${T('Pemasukan {jumlah}', { jumlah: rp(r.masuk) })} · ${T('Pengeluaran {jumlah}', { jumlah: rp(r.keluar) })}
        <br><small>${T('Ketuk bulan di grafik untuk melihat rinciannya.')}</small></p>
      <button type="button" class="tombol-tambah" style="margin:0 0 12px" data-aksi="bagikan-laporan" data-bulan="${esc(pilih)}">${T('📤 Bagikan ringkasan {bulan}', { bulan: esc(namaBulan(pilih)) })}</button>
      <details class="tabel-data">
        <summary>${T('Lihat sebagai tabel')}</summary>
        <table>
          <thead><tr><th>${T('Bulan')}</th><th>${T('Pemasukan')}</th><th>${T('Pengeluaran')}</th><th>${T('Selisih')}</th></tr></thead>
          <tbody>${data.map((x, i) => `<tr><td>${NAMA_BULAN_PENDEK[i]}</td><td>${rp(x.masuk)}</td><td>${rp(x.keluar)}</td><td>${rp(x.masuk - x.keluar)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    </section>

    ${kartuSorotan(pilih)}
    ${kartuKategoriLaporan(pilih, data)}
    ${kartuPolaBelanja(pilih)}
    ${kartuTerbesar(pilih)}
    ${kartuBanding(pilih)}
    ${kartuAnggota(pilih)}`;
}

/**
 * Gambar ringkasan satu periode (1080×1350, pas untuk WhatsApp/Instagram), lalu dibagikan lewat menu berbagi HP;
 * kalau browser tidak mendukung berbagi file, gambarnya diunduh.
 */
async function bagikanLaporan(k) {
  const r = ringkasBulan(k);
  const top = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v).slice(0, 5);
  const W = 1080, H = 1350, P = 80;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; // browser lama: sudut kotak biasa
  try { await document.fonts.ready; } catch (e) { /* font cadangan */ }
  const font = (ukuran, tebal) => `${tebal || 700} ${ukuran}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const teks = (s, x, y, ukuran, warna, tebal, rata) => {
    g.font = font(ukuran, tebal); g.fillStyle = warna; g.textAlign = rata || 'left'; g.fillText(s, x, y);
  };

  const latar = g.createLinearGradient(0, 0, W, H);
  latar.addColorStop(0, '#0c111d'); latar.addColorStop(1, '#1f1b4d');
  g.fillStyle = latar; g.fillRect(0, 0, W, H);

  teks('👛  Dompet Keluarga', P, 130, 34, 'rgba(255,255,255,.7)', 600);
  teks(T('Ringkasan keuangan'), P, 220, 44, '#ffffff', 600);
  teks(namaBulan(k), P, 290, 60, '#ffffff', 800);

  const kotak = (x, y, w, label, nilai, warna) => {
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(x, y, w, 170, 28); g.fill();
    teks(label, x + 32, y + 62, 30, 'rgba(255,255,255,.7)', 600);
    teks(nilai, x + 32, y + 128, 46, warna, 800);
  };
  const lebar = (W - P * 2 - 24) / 2;
  kotak(P, 350, lebar, T('Pemasukan'), rp(r.masuk), '#3ccb8b');
  kotak(P + lebar + 24, 350, lebar, T('Pengeluaran'), rp(r.keluar), '#fb7593');
  kotak(P, 544, W - P * 2, T('Selisih') + (r.masuk ? ' · ' + T('{persen}% dari pemasukan', { persen: Math.round((r.masuk - r.keluar) / r.masuk * 100) }) : ''), rp(r.masuk - r.keluar), '#ffffff');

  teks(T('Pengeluaran terbesar'), P, 820, 36, '#ffffff', 700);
  const maks = Math.max(1, ...top.map(x => x.v));
  top.forEach((x, i) => {
    const y = 880 + i * 82;
    teks(ikonKategori(x.n, TIPE.KELUAR) + '  ' + namaT(x.n), P, y + 30, 32, '#ffffff', 600);
    teks(rp(x.v) + (r.keluar ? `  ${Math.round(x.v / r.keluar * 100)}%` : ''), W - P, y + 30, 32, 'rgba(255,255,255,.85)', 700, 'right');
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(P, y + 46, W - P * 2, 12, 6); g.fill();
    g.fillStyle = '#8b8cf8'; g.beginPath(); g.roundRect(P, y + 46, Math.max(12, (W - P * 2) * x.v / maks), 12, 6); g.fill();
  });
  if (!top.length) teks(T('Belum ada pengeluaran.'), P, 900, 32, 'rgba(255,255,255,.7)', 600);
  teks(T('Dicatat dengan Dompet Keluarga'), W / 2, H - 70, 28, 'rgba(255,255,255,.5)', 600, 'center');

  const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
  const nama = 'ringkasan-' + k + '.png';
  const file = new File([blob], nama, { type: 'image/png' });
  const keterangan = T('Ringkasan keuangan {bulan}: pemasukan {masuk}, pengeluaran {keluar}, selisih {selisih}.', { bulan: namaBulan(k), masuk: rp(r.masuk), keluar: rp(r.keluar), selisih: rp(r.masuk - r.keluar) });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: T('Ringkasan {bulan}', { bulan: namaBulan(k) }), text: keterangan });
    } catch (e) { /* dibatalkan pengguna */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(T('Gambar ringkasan diunduh ✔'));
}

/** Grafik batang berkelompok: 2 seri, satu sumbu, ujung atas membulat 4px, celah 2px antar batang. */
function grafikBulanan(bulan, data, pilih) {
  const W = 340, H = 190, kiri = 36, bawah = 22, atas = 8;
  const tinggi = H - bawah - atas;
  const skala = angkaBulat(Math.max(1, ...data.map(x => Math.max(x.masuk, x.keluar))));
  const y = v => atas + tinggi - v / skala * tinggi;
  const lebarGrup = (W - kiri) / 12;
  const bw = Math.min(10, (lebarGrup - 8) / 2);
  const dasar = y(0);

  const grid = [skala / 2, skala].map(v => `
    <line class="grid" x1="${kiri}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="sumbu" x="${kiri - 6}" y="${y(v) + 3}" text-anchor="end">${rpPendek(v)}</text>`).join('');

  const grup = bulan.map((k, i) => {
    const x0 = kiri + i * lebarGrup;
    const cx = x0 + lebarGrup / 2;
    const d = data[i];
    const aktif = k === pilih;
    return `
      ${aktif ? `<rect class="pilih" x="${x0 + 1}" y="${atas}" width="${lebarGrup - 2}" height="${tinggi}" rx="6"/>` : ''}
      ${batang(cx - 1 - bw, y(d.masuk), bw, dasar, 'seri-1', i * 35)}
      ${batang(cx + 1, y(d.keluar), bw, dasar, 'seri-2', i * 35 + 20)}
      <text class="sumbu ${aktif ? 'aktif' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>
      <rect class="hit" x="${x0}" y="0" width="${lebarGrup}" height="${H}" data-aksi="lap-bulan" data-bulan="${k}">
        <title>${T('{bulan}: pemasukan {masuk}, pengeluaran {keluar}', { bulan: namaBulan(k), masuk: rp(d.masuk), keluar: rp(d.keluar) })}</title></rect>`;
  }).join('');

  return `<svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('Pemasukan dan pengeluaran per bulan')}">
    ${grid}<line class="dasar" x1="${kiri}" x2="${W}" y1="${dasar}" y2="${dasar}"/>${grup}</svg>`;
}

/** Tren pemasukan & pengeluaran sebagai garis, titik tiap bulan. */
function grafikGaris(bulan, data, pilih) {
  const W = 340, H = 190, kiri = 36, bawah = 22, atas = 10;
  const tinggi = H - bawah - atas;
  const skala = angkaBulat(Math.max(1, ...data.map(x => Math.max(x.masuk, x.keluar))));
  const y = v => atas + tinggi - v / skala * tinggi;
  const lebarGrup = (W - kiri) / 12;
  const cx = i => kiri + i * lebarGrup + lebarGrup / 2;
  // Bulan setelah bulan ini (tahun berjalan) belum terjadi: garis berhenti di bulan terakhir yang ada datanya.
  const akhir = data.reduce((a, d, i) => (d.masuk || d.keluar ? i : a), -1);
  const garis = (f, kelas) => {
    if (akhir < 0) return '';
    const titik = data.slice(0, akhir + 1).map((d, i) => [cx(i), y(d[f])]);
    const jalur = jalurHalus(titik);
    const area = titik.length > 1 ? `${jalur} L${titik[titik.length - 1][0]},${y(0)} L${titik[0][0]},${y(0)} Z` : '';
    return `
      ${area ? `<path class="area ${kelas}" d="${area}"/>` : ''}
      <path class="garis ${kelas}" d="${jalur}" pathLength="1"/>
      ${titik.map(([x, yy], i) => `<circle class="titik ${kelas}" cx="${x}" cy="${yy}" r="${bulan[i] === pilih ? 4.5 : 2.8}" style="animation-delay:${(0.35 + i * 0.05).toFixed(2)}s"/>`).join('')}`;
  };

  const grid = [skala / 2, skala].map(v => `
    <line class="grid" x1="${kiri}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="sumbu" x="${kiri - 6}" y="${y(v) + 3}" text-anchor="end">${rpPendek(v)}</text>`).join('');
  const label = bulan.map((k, i) => `
    ${k === pilih ? `<rect class="pilih" x="${kiri + i * lebarGrup + 1}" y="${atas - 4}" width="${lebarGrup - 2}" height="${tinggi + 4}" rx="6"/>` : ''}
    <text class="sumbu ${k === pilih ? 'aktif' : ''}" x="${cx(i)}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>`).join('');

  return `<svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('Tren pemasukan dan pengeluaran per bulan')}">
    ${grid}${label}<line class="dasar" x1="${kiri}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
    ${garis('masuk', 'seri-1')}${garis('keluar', 'seri-2')}${areaKetuk(bulan, data, kiri, lebarGrup, H)}</svg>`;
}

/**
 * Kurva halus melewati semua titik (spline kubik monoton, Fritsch–Carlson): melengkung tanpa "melampaui"
 * nilai aslinya, jadi tidak pernah tergambar di bawah nol atau di atas nilai tertinggi.
 */
function jalurHalus(t) {
  const f = v => Math.round(v * 10) / 10;
  if (t.length < 3) return t.map(([x, y], i) => (i ? 'L' : 'M') + f(x) + ',' + f(y)).join(' ');
  const n = t.length, dx = [], s = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = t[i + 1][0] - t[i][0]; s[i] = (t[i + 1][1] - t[i][1]) / dx[i]; }
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * s[i]; m[i + 1] = k * b * s[i]; }
  }
  let d = 'M' + f(t[0][0]) + ',' + f(t[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(t[i][0] + h)},${f(t[i][1] + m[i] * h)} ${f(t[i + 1][0] - h)},${f(t[i + 1][1] - m[i + 1] * h)} ${f(t[i + 1][0])},${f(t[i + 1][1])}`;
  }
  return d;
}

/** Selisih (pemasukan − pengeluaran) per bulan: batang ke atas = surplus, ke bawah = defisit. */
function grafikSelisih(bulan, data, pilih) {
  const W = 340, H = 190, kiri = 36, bawah = 22, atas = 8;
  const tinggi = H - bawah - atas;
  const nilai = data.map(d => d.masuk - d.keluar);
  const skala = angkaBulat(Math.max(1, ...nilai.map(Math.abs)));
  const adaMinus = nilai.some(v => v < 0);
  const bawahSkala = adaMinus ? -skala : 0;
  const y = v => atas + (skala - v) / (skala - bawahSkala) * tinggi;
  const lebarGrup = (W - kiri) / 12;
  const bw = Math.min(16, lebarGrup - 8);
  const nol = y(0);

  const grid = (adaMinus ? [skala, -skala] : [skala / 2, skala]).map(v => `
    <line class="grid" x1="${kiri}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="sumbu" x="${kiri - 6}" y="${y(v) + 3}" text-anchor="end">${v < 0 ? '−' : ''}${rpPendek(Math.abs(v))}</text>`).join('');
  const grup = bulan.map((k, i) => {
    const x0 = kiri + i * lebarGrup;
    const cx = x0 + lebarGrup / 2;
    const v = nilai[i];
    const h = Math.abs(y(v) - nol);
    return `
      ${k === pilih ? `<rect class="pilih" x="${x0 + 1}" y="${atas}" width="${lebarGrup - 2}" height="${tinggi}" rx="6"/>` : ''}
      ${h >= 0.5 ? `<rect class="${v >= 0 ? 'surplus' : 'defisit'} tumbuh" style="animation-delay:${i * 35}ms" x="${cx - bw / 2}" y="${Math.min(y(v), nol)}" width="${bw}" height="${h}" rx="${Math.min(5, h / 2, bw / 2)}"/>` : ''}
      <text class="sumbu ${k === pilih ? 'aktif' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>`;
  }).join('');

  return `<svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('Selisih pemasukan dan pengeluaran per bulan')}">
    ${grid}<line class="dasar" x1="${kiri}" x2="${W}" y1="${nol}" y2="${nol}"/>${grup}${areaKetuk(bulan, data, kiri, lebarGrup, H)}</svg>`;
}

/** Area ketuk per bulan (sama untuk semua jenis grafik bulanan): membuka rincian bulan itu. */
function areaKetuk(bulan, data, kiri, lebarGrup, H) {
  return bulan.map((k, i) => `<rect class="hit" x="${kiri + i * lebarGrup}" y="0" width="${lebarGrup}" height="${H}" data-aksi="lap-bulan" data-bulan="${k}">
    <title>${T('{bulan}: pemasukan {masuk}, pengeluaran {keluar}, selisih {selisih}', { bulan: namaBulan(k), masuk: rp(data[i].masuk), keluar: rp(data[i].keluar), selisih: rp(data[i].masuk - data[i].keluar) })}</title></rect>`).join('');
}

/** Jenis grafik bulanan di Laporan; digeser ke samping (scroll-snap) atau lewat titik di bawahnya. */
const JENIS_GRAFIK = [
  { judul: T('Batang'), legenda: `<span><i class="sw seri-1"></i>${T('Pemasukan')}</span><span><i class="sw seri-2"></i>${T('Pengeluaran')}</span>`, gambar: grafikBulanan },
  { judul: T('Tren'), legenda: `<span><i class="sw seri-1"></i>${T('Pemasukan')}</span><span><i class="sw seri-2"></i>${T('Pengeluaran')}</span>`, gambar: grafikGaris },
  { judul: T('Selisih'), legenda: `<span><i class="sw surplus"></i>${T('Surplus')}</span><span><i class="sw defisit"></i>${T('Defisit')}</span>`, gambar: grafikSelisih },
];

/**
 * Animasi grafik diputar setiap kali sebuah grafik tampil: saat Laporan dibuka / tahun diganti, dan setiap kali
 * pengguna menggeser ke grafik lain (lihat putarGrafik). Digambar ulang karena ketuk bulan → tanpa animasi (diam).
 */
let kunciAnimasiGrafik = '';

function geserGrafik(bulan, data, pilih) {
  const aktif = S.grafikLaporan || 0;
  const diam = kunciAnimasiGrafik === String(S.tahun);
  kunciAnimasiGrafik = String(S.tahun);
  return `
    <div class="geser-grafik" id="geser-grafik" data-diam="${diam ? '1' : ''}" aria-roledescription="carousel" aria-label="${T('Grafik per bulan, geser untuk ganti jenis')}">
      ${JENIS_GRAFIK.map((j, i) => `
        <div class="slide-grafik" role="group" aria-label="${T('{judul} ({i} dari {n})', { judul: j.judul, i: i + 1, n: JENIS_GRAFIK.length })}">
          <div class="legenda">${j.legenda}</div>
          ${j.gambar(bulan, data, pilih)}
        </div>`).join('')}
    </div>
    <div class="titik-grafik" role="tablist" aria-label="${T('Jenis grafik')}">
      ${JENIS_GRAFIK.map((j, i) => `<button type="button" role="tab" class="${i === aktif ? 'aktif' : ''}" aria-selected="${i === aktif}"
        data-aksi="jenis-grafik" data-i="${i}"><span></span>${j.judul}</button>`).join('')}
    </div>`;
}

/** Setelah render: kembalikan posisi geser grafik & pantau geserannya. */
/** Putar ulang animasi satu slide grafik; slide lain dikembalikan ke keadaan awal supaya beranimasi lagi saat didatangi. */
function putarGrafik(el, i, tanpaAnimasi) {
  el.querySelectorAll('.slide-grafik').forEach((slide, n) => {
    slide.classList.remove('main', 'diam');
    if (n !== i) return;
    if (tanpaAnimasi) { slide.classList.add('diam'); return; }
    void slide.offsetWidth; // paksa browser memulai animasi dari awal
    slide.classList.add('main');
  });
}

function pasangGeserGrafik() {
  const el = $('#geser-grafik');
  if (!el) return;
  el.scrollLeft = (S.grafikLaporan || 0) * el.clientWidth;
  putarGrafik(el, S.grafikLaporan || 0, el.dataset.diam === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches);
  let timer = 0;
  el.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (i === (S.grafikLaporan || 0)) return;
      S.grafikLaporan = i;
      putarGrafik(el, i, matchMedia('(prefers-reduced-motion: reduce)').matches);
      document.querySelectorAll('.titik-grafik button').forEach((b, n) => {
        b.classList.toggle('aktif', n === i);
        b.setAttribute('aria-selected', n === i);
      });
    }, 80);
  }, { passive: true });
}

/** Batang vertikal dengan sudut atas membulat, menempel di garis dasar; tumbuh dari bawah setelah `jeda` ms. */
function batang(x, yAtas, w, yDasar, kelas, jeda = 0) {
  const h = yDasar - yAtas;
  if (h < 0.5) return '';
  const r = Math.min(5, h, w / 2);
  return `<path class="${kelas} tumbuh" style="animation-delay:${jeda}ms" d="M${x},${yDasar} V${yAtas + r} Q${x},${yAtas} ${x + r},${yAtas} H${x + w - r} Q${x + w},${yAtas} ${x + w},${yAtas + r} V${yDasar} Z"/>`;
}

/** Membulatkan ke atas ke angka "rapi" untuk batas sumbu: 1, 2, 2,5, 5 × 10^n. */
function angkaBulat(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function kartuKategoriLaporan(pilih, data) {
  const setahun = S.lapKategori === 'tahun';
  const per = {};
  (setahun ? data : [ringkasBulan(pilih)]).forEach(x => {
    Object.keys(x.kategori).forEach(n => { per[n] = (per[n] || 0) + x.kategori[n]; });
  });
  const urut = Object.keys(per).map(n => ({ ikon: ikonKategori(n, TIPE.KELUAR), nama: namaT(n), nilai: per[n] })).sort((a, b) => b.nilai - a.nilai);
  const total = urut.reduce((a, x) => a + x.nilai, 0);
  return `<section class="kartu">
    <h3>${T('Pengeluaran per kategori')}</h3>
    <div class="chips">
      <button class="chip ${setahun ? '' : 'aktif'}" data-aksi="lap-kategori" data-mode="bulan">${esc(namaBulan(pilih))}</button>
      <button class="chip ${setahun ? 'aktif' : ''}" data-aksi="lap-kategori" data-mode="tahun">${T('Setahun {tahun}', { tahun: S.tahun })}</button>
    </div>
    ${urut.length ? donatKategori(urut, total) + barBerperingkat(urut, total) : kosong('🧾', T('Belum ada pengeluaran.'))}
  </section>`;
}

// ---------- Laporan: sorotan, donat kategori, pola belanja, transaksi terbesar ----------

/** Transaksi rinci hanya tersedia untuk periode yang sedang dimuat (S.data.bulan); periode lain cukup ringkasan bulanan. */
const trxLaporan = pilih => (S.data.bulan === pilih ? S.data.transaksi : null);
const WARNA_DONAT = ['#6366F1', '#F97316', '#10B981', '#EC4899', '#0EA5E9', '#94A3B8'];
const NAMA_HARI_SEMINGGU = [T('Sen'), T('Sel'), T('Rab'), T('Kam'), T('Jum'), T('Sab'), T('Min')];

/** Wawasan otomatis untuk periode terpilih, disusun dari yang paling berguna. */
function kartuSorotan(pilih) {
  const r = ringkasBulan(pilih);
  const lalu = ringkasBulan(bulanSebelum(pilih));
  const trx = trxLaporan(pilih);
  const rentang = SERVER.rentangPeriode(pilih, S.data.mulaiPeriode || 1);
  const hari = hariIni();
  const akhir = rentang.akhir < hari ? rentang.akhir : hari;
  const jumlahHari = Math.max(1, Math.round((keTanggal(akhir) - keTanggal(rentang.awal)) / 864e5) + 1);
  const butir = [];
  const tambah = (ikon, judul, ket, kelas) => butir.push({ ikon, judul, ket, kelas: kelas || '' });

  if (r.keluar) tambah('📆', T('{jumlah} per hari', { jumlah: rp(Math.round(r.keluar / jumlahHari)) }), T('Rata-rata pengeluaran selama {n} hari', { n: jumlahHari }));
  if (r.masuk) {
    const rasio = Math.round((r.masuk - r.keluar) / r.masuk * 100);
    tambah(rasio >= 20 ? '🐷' : rasio >= 0 ? '🙂' : '⚠️', rasio >= 0 ? T('Tersisa {persen}% dari pemasukan', { persen: Math.abs(rasio) }) : T('Minus {persen}% dari pemasukan', { persen: Math.abs(rasio) }),
      rasio >= 20 ? T('Bagus! Di atas 20% yang biasa disarankan') : rasio >= 0 ? T('Coba sisihkan minimal 20% untuk ditabung') : T('Pengeluaran lebih besar dari pemasukan'),
      rasio >= 20 ? 'baik' : rasio < 0 ? 'buruk' : '');
  }
  if (r.keluar && lalu.keluar) {
    const p = Math.round((r.keluar - lalu.keluar) / lalu.keluar * 100);
    if (p) tambah(p > 0 ? '📈' : '📉', p > 0 ? T('Pengeluaran naik {persen}%', { persen: Math.abs(p) }) : T('Pengeluaran turun {persen}%', { persen: Math.abs(p) }), T('Dibanding {bulan} ({jumlah})', { bulan: namaBulan(bulanSebelum(pilih)), jumlah: rp(lalu.keluar) }), p > 0 ? 'buruk' : 'baik');
  }
  const kat = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v)[0];
  if (kat && r.keluar) tambah(ilus(ikonKategori(kat.n, TIPE.KELUAR)), T('{nama} paling besar', { nama: esc(namaT(kat.n)) }), T('{jumlah} · {persen}% dari pengeluaran', { jumlah: rp(kat.v), persen: Math.round(kat.v / r.keluar * 100) }));
  if (trx) {
    const keluar = trx.filter(t => t.tipe === TIPE.KELUAR);
    const perHari = {};
    keluar.forEach(t => { perHari[t.tanggal] = (perHari[t.tanggal] || 0) + t.jumlah; });
    const boros = Object.keys(perHari).sort((a, b) => perHari[b] - perHari[a])[0];
    if (boros) tambah('🔥', T('Paling boros: {hari}', { hari: esc(labelHariPendek(boros)) }), T('{jumlah} dalam sehari', { jumlah: rp(perHari[boros]) }));
    const tanpa = jumlahHari - Object.keys(perHari).filter(t => t >= rentang.awal && t <= akhir).length;
    if (keluar.length && tanpa > 0) tambah('🌱', T('{n} hari tanpa pengeluaran', { n: tanpa }), T('Hari tanpa jajan bikin saldo awet'), 'baik');
  }
  if (!butir.length) return '';
  return `<section class="kartu">
    <div class="kepala-kartu"><h3>${T('✨ Sorotan · {bulan}', { bulan: esc(namaBulan(pilih)) })}</h3>
      <button type="button" class="chip chip-kilas" data-aksi="kilas-putar" data-bulan="${esc(pilih)}">${T('▶ Kilas balik')}</button></div>
    <div class="sorotan">${butir.map(b => `
      <div class="butir-sorotan ${b.kelas}"><span class="ikon-sorotan">${b.ikon}</span>
        <span class="isi"><b>${b.judul}</b><small>${esc(b.ket)}</small></span></div>`).join('')}</div>
  </section>`;
}

/** Donat komposisi pengeluaran: 5 kategori terbesar + "Lainnya", total di tengah. */
function donatKategori(urut, total) {
  if (!urut.length || !total) return '';
  const atas = urut.slice(0, 5);
  const sisa = urut.slice(5).reduce((a, x) => a + x.nilai, 0);
  const bagian = atas.map((x, i) => ({ nama: x.nama, nilai: x.nilai, warna: WARNA_DONAT[i] }));
  if (sisa) bagian.push({ nama: T('Lainnya||sisa'), nilai: sisa, warna: WARNA_DONAT[5] });
  const R = 42, K = 2 * Math.PI * R;
  let jalan = 0;
  const busur = bagian.map((b, i) => {
    const panjang = b.nilai / total * K;
    const celah = bagian.length > 1 ? Math.min(2, panjang / 3) : 0;
    const s = `<circle class="busur-donat" cx="60" cy="60" r="${R}" stroke="${b.warna}" stroke-dasharray="${Math.max(0, panjang - celah)} ${K}"
      stroke-dashoffset="${-jalan}" style="animation-delay:${i * 90}ms"/>`;
    jalan += panjang;
    return s;
  }).join('');
  return `<div class="donat">
      <svg viewBox="0 0 120 120" role="img" aria-label="${T('Komposisi pengeluaran per kategori')}">
        <circle cx="60" cy="60" r="${R}" class="alas-donat"/>
        <g transform="rotate(-90 60 60)">${busur}</g>
        <text x="60" y="56" text-anchor="middle" class="donat-label">${T('Total')}</text>
        <text x="60" y="72" text-anchor="middle" class="donat-nilai">${rpPendek(total)}</text>
      </svg>
      <ul class="legenda-donat">${bagian.map(b => `
        <li><i style="background:${b.warna}"></i><span>${esc(namaT(b.nama))}</span><b>${Math.round(b.nilai / total * 100)}%</b></li>`).join('')}</ul>
    </div>`;
}

/** Kalender panas pengeluaran harian + pola per hari dalam seminggu (periode yang sedang dimuat). */
function kartuPolaBelanja(pilih) {
  const trx = trxLaporan(pilih);
  if (!trx) return '';
  const keluar = trx.filter(t => t.tipe === TIPE.KELUAR);
  if (!keluar.length) return '';
  const rentang = SERVER.rentangPeriode(pilih, S.data.mulaiPeriode || 1);
  const perHari = {}, jumlahTrx = {};
  keluar.forEach(t => { perHari[t.tanggal] = (perHari[t.tanggal] || 0) + t.jumlah; jumlahTrx[t.tanggal] = (jumlahTrx[t.tanggal] || 0) + 1; });
  const maks = Math.max(1, ...Object.values(perHari));
  const hari = hariIni();
  const awal = keTanggal(rentang.awal);
  const geser = (awal.getDay() + 6) % 7; // Senin = 0
  const sel = Array.from({ length: geser }, () => '<span class="sel-panas kosong"></span>');
  const perPekan = [0, 0, 0, 0, 0, 0, 0], hitungPekan = [0, 0, 0, 0, 0, 0, 0];
  // Sengaja tidak memakai geserHari/isoDari: keduanya const di bagian bawah file, belum ada saat render awal.
  const besok = iso => {
    const d = keTanggal(iso);
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  for (let iso = rentang.awal; iso <= rentang.akhir; iso = besok(iso)) {
    const d = keTanggal(iso);
    const n = perHari[iso] || 0;
    const tingkat = n ? Math.min(4, Math.ceil(n / maks * 4)) : 0;
    const nanti = iso > hari;
    if (!nanti) { perPekan[(d.getDay() + 6) % 7] += n; hitungPekan[(d.getDay() + 6) % 7]++; }
    sel.push(`<button type="button" class="sel-panas t${tingkat} ${iso === hari ? 'hari-ini' : ''} ${nanti ? 'nanti' : ''}" data-aksi="hari-laporan"
      data-tgl="${iso}" data-n="${n}" data-k="${jumlahTrx[iso] || 0}" aria-label="${esc(labelHariPendek(iso))}: ${rp(n)}">${d.getDate()}</button>`);
  }
  const rata = perPekan.map((v, i) => (hitungPekan[i] ? v / hitungPekan[i] : 0));
  const maksPekan = Math.max(1, ...rata);
  const iMaks = rata.indexOf(Math.max(...rata));
  return `<section class="kartu">
    <h3>${T('Pola belanja harian')}</h3>
    <div class="kal-panas">
      <div class="kepala-panas">${NAMA_HARI_SEMINGGU.map(h => `<span>${h}</span>`).join('')}</div>
      <div class="grid-panas">${sel.join('')}</div>
      <div class="skala-panas"><small>${T('Sedikit')}</small>${[0, 1, 2, 3, 4].map(t => `<i class="t${t}"></i>`).join('')}<small>${T('Banyak')}</small></div>
    </div>
    <h4 class="sub-laporan">${T('Rata-rata per hari dalam seminggu')}</h4>
    <div class="pola-pekan">${rata.map((v, i) => `
      <div class="${i === iMaks && v ? 'puncak' : ''}"><span class="nilai-pekan">${v ? rpPendek(Math.round(v)) : '–'}</span>
        <span class="batang-pekan"><i style="height:${Math.max(v ? 6 : 0, v / maksPekan * 100)}%"></i></span><small>${NAMA_HARI_SEMINGGU[i]}</small></div>`).join('')}</div>
    ${rata[iMaks] ? `<p class="info-kecil" style="text-align:left;margin:8px 0 0">${T('Paling banyak keluar uang di hari <b>{hari}</b>.', { hari: [T('Senin'), T('Selasa'), T('Rabu'), T('Kamis'), T('Jumat'), T('Sabtu'), T('Minggu')][iMaks] })}</p>` : ''}
  </section>`;
}

function kartuTerbesar(pilih) {
  const trx = trxLaporan(pilih);
  if (!trx) return '';
  const atas = trx.filter(t => t.tipe === TIPE.KELUAR).sort((a, b) => b.jumlah - a.jumlah).slice(0, 5);
  if (!atas.length) return '';
  return `<section class="kartu" style="padding-bottom:6px">
    <h3>${T('Pengeluaran terbesar · {bulan}', { bulan: esc(namaBulan(pilih)) })}</h3>
    ${atas.map(itemTrx).join('')}
  </section>`;
}


function kartuBanding(pilih) {
  const lalu = bulanSebelum(pilih);
  const a = ringkasBulan(pilih).kategori;
  const b = ringkasBulan(lalu).kategori;
  const baris = Array.from(new Set(Object.keys(a).concat(Object.keys(b))))
    .map(n => ({ nama: n, kini: a[n] || 0, lalu: b[n] || 0 }))
    .map(x => Object.assign(x, { selisih: x.kini - x.lalu }))
    .filter(x => x.selisih)
    .sort((p, q) => Math.abs(q.selisih) - Math.abs(p.selisih))
    .slice(0, 6);
  const delta = (s, dasar) => {
    if (!s) return T('sama');
    const persen = dasar ? ` (${s > 0 ? '+' : '−'}${Math.abs(Math.round(s / dasar * 100))}%)` : ' ' + T('(baru)');
    return `<span class="${s > 0 ? 'naik' : 'turun'}">${s > 0 ? '▲' : '▼'} ${rp(Math.abs(s))}${persen}</span>`;
  };
  const totKini = ringkasBulan(pilih).keluar;
  const totLalu = ringkasBulan(lalu).keluar;
  return `<section class="kartu">
    <h3>${T('Dibanding {bulan}', { bulan: esc(namaBulan(lalu)) })}</h3>
    <div class="banding"><span class="isi"><b>${T('Total pengeluaran')}</b><small>${rp(totLalu)} → ${rp(totKini)}</small></span>${delta(totKini - totLalu, totLalu)}</div>
    ${baris.map(x => `
      <div class="banding">
        <span class="ikon">${ilus(ikonKategori(x.nama, TIPE.KELUAR))}</span>
        <span class="isi"><b>${esc(namaT(x.nama))}</b><small>${rp(x.lalu)} → ${rp(x.kini)}</small></span>
        ${delta(x.selisih, x.lalu)}
      </div>`).join('') || `<p class="info-kecil">${T('Tidak ada perubahan per kategori.')}</p>`}
    <p class="info-kecil" style="text-align:left">${T('▲ pengeluaran naik · ▼ pengeluaran turun')}</p>
  </section>`;
}

function kartuAnggota(pilih) {
  const oleh = ringkasBulan(pilih).oleh;
  const urut = Object.keys(oleh).map(e => ({ ikon: '👤', nama: e === '?' ? T('Tidak diketahui') : namaPendek(e), nilai: oleh[e] }))
    .sort((a, b) => b.nilai - a.nilai);
  if (urut.length < 2) return '';
  return `<section class="kartu">
    <h3>${T('Pengeluaran per anggota · {bulan}', { bulan: esc(namaBulan(pilih)) })}</h3>
    ${barBerperingkat(urut, urut.reduce((a, x) => a + x.nilai, 0))}
  </section>`;
}

// ---------- Halaman: Setup pertama kali ----------

const semuaDompetSetup = () => DOMPET_UMUM.concat(S.setup.lain.map(n => [n, '💳']));

/** Wizard satu layar: pilih dompet → isi saldo sekarang → (opsional) undang anggota keluarga. */
function viewSetup() {
  const st = S.setup;
  const semua = semuaDompetSetup();
  const dipilih = semua.filter(([n]) => st.pilih.includes(n));
  return `
    <div class="kepala"><div><small>${T('Selamat datang,')}</small><h1>${esc(namaPendek(S.data.user))} 👋</h1></div></div>
    ${tombolCekUndangan()}
    <p class="setup-intro">${T('Atau buat buku sendiri: tiga langkah singkat, lalu langsung bisa mencatat.')}</p>

    <section class="kartu">
      <h3>${T('1. Dompet apa saja yang dipakai?')}</h3>
      <p class="info-kecil" style="text-align:left;margin:0 0 10px">${T('Ketuk semua yang dipakai keluarga. Bisa ditambah atau diubah nanti.')}</p>
      <div class="chips">${semua.map(([n, i]) =>
        `<button type="button" class="chip ${st.pilih.includes(n) ? 'aktif' : ''}" data-aksi="setup-dompet" data-nama="${esc(n)}" aria-pressed="${st.pilih.includes(n)}">${ilus(i)} ${esc(namaT(n))}</button>`).join('')}</div>
      <div class="salin" style="margin-top:10px">
        <input class="field" id="s-lain" maxlength="40" placeholder="${T('Lainnya, mis. Bank Jatim')}">
        <button type="button" class="btn btn-hapus" data-aksi="setup-lain">${T('Tambah')}</button>
      </div>
    </section>

    <section class="kartu">
      <h3>${T('2. Berapa saldonya sekarang?')}</h3>
      <p class="info-kecil" style="text-align:left;margin:0 0 4px">${T('Supaya saldo di aplikasi sama dengan aslinya. Boleh dikira-kira dulu, bisa disesuaikan kapan saja.')}</p>
      ${dipilih.map(([n, i]) => `
        <label class="baris baris-input">
          <span class="ikon-bulat">${ilus(i)}</span>
          <span class="isi"><b>${esc(namaT(n))}</b></span>
          <input class="field input-rp input-saldo-setup" data-nama="${esc(n)}" inputmode="numeric" placeholder="0" value="${formatAngka(st.saldo[n])}">
        </label>`).join('') || `<p class="info-kecil" style="text-align:left">${T('Pilih minimal satu dompet di langkah 1.')}</p>`}
    </section>

    <section class="kartu">
      <h3>${T('3. Catat bersama keluarga?')} <small style="font-weight:600;color:var(--muted)">${T('(opsional)')}</small></h3>
      <div class="grup-form">
        <label class="label" for="s-anggota">${T('Email Google anggota keluarga')}</label>
        <input class="field" id="s-anggota" type="email" inputmode="email" placeholder="${T('nama@gmail.com')}" value="${esc(st.email)}">
        <p class="info-kecil" style="text-align:left">${T('Bisa juga nanti dari ⚙️ → Anggota keluarga.')}</p>
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-utama" data-aksi="buat-db">${T('Mulai pakai')}</button>
      </div>
      <p class="info-kecil">${T('Catatan disimpan di spreadsheet <b>Dompet Keluarga</b> yang dibuat di Google Drive {email}.', { email: esc(S.data.user) })}</p>
    </section>

    <p class="info-kecil">${T('Sudah punya spreadsheet Dompet Keluarga sendiri?')}</p>
    <div style="text-align:center"><button type="button" class="tombol-teks" data-aksi="pilih-db">${T('Pilih dari Google Drive')}</button></div>
    <button type="button" class="tombol-tambah" data-aksi="keluar">${T('Keluar dari {email}', { email: esc(S.data.user) })}</button>`;
}

/** Simpan isian layar setup ke S.setup sebelum dirender ulang. */
function bacaSetup() {
  document.querySelectorAll('.input-saldo-setup').forEach(i => { S.setup.saldo[i.dataset.nama] = angka(i.value); });
  if ($('#s-anggota')) S.setup.email = $('#s-anggota').value.trim();
}

function renderSetup() {
  bacaSetup();
  $('#view').innerHTML = viewSetup();
}

// ---------- Halaman: Lainnya ----------

function viewLainnya() {
  const d = S.data;
  return `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Lainnya')}</h1>
    </div>
    <section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="keluar">
        <span class="ikon-bulat">👤</span>
        <span class="isi"><b>${esc(namaPendek(d.user))}</b><small>${esc(d.user)}</small></span>
        <span class="panah" style="font-size:13px">${T('Keluar')}</span>
      </button>
      <button class="baris" data-aksi="atur-anggaran">
        <span class="ikon-bulat">🎯</span>
        <span class="isi"><b>${T('Anggaran bulanan')}</b><small>${T('Batas belanja per kategori')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="kelola-rutin">
        <span class="ikon-bulat">🔁</span>
        <span class="isi"><b>${T('Tagihan & transaksi rutin')}</b><small>${daftarRutin().length ? T('{n} rutin · berikutnya {nama}, {tanggal}', { n: daftarRutin().length, nama: esc(daftarRutin()[0].nama), tanggal: esc(tanggalPendek(daftarRutin()[0].berikutnya)) }) : T('Listrik, internet, cicilan, SPP, gaji…')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="aktivitas">
        <span class="ikon-bulat">👥</span>
        <span class="isi"><b>${T('Aktivitas keluarga')}</b><small>${T('Siapa mencatat, mengubah, atau menghapus apa')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="buku">
        <span class="ikon-bulat">📒</span>
        <span class="isi"><b>${T('Buku keuangan')}</b><small>${esc(namaT(d.namaBuku || 'Keluarga'))}${(d.buku || []).length > 1 ? ' · ' + T('{n} buku', { n: d.buku.length }) : ' · ' + T('pisahkan pribadi, keluarga, usaha')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="atur-periode">
        <span class="ikon-bulat">📅</span>
        <span class="isi"><b>${T('Periode gajian')}</b><small>${(d.mulaiPeriode || 1) > 1 ? T('Mulai tanggal {tanggal} tiap bulan', { tanggal: d.mulaiPeriode }) : T('Bulan kalender (tanggal 1)')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="kelola-kategori">
        <span class="ikon-bulat">🏷️</span>
        <span class="isi"><b>${T('Kelola kategori')}</b><small>${T('Tambah, ubah nama, atau hapus kategori')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <button class="baris" data-aksi="undang">
        <span class="ikon-bulat">👨‍👩‍👧</span>
        <span class="isi"><b>${T('Anggota keluarga')}</b><small>${T('Undang atau keluarkan akun Google lain')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
    </section>

    <h2 class="judul-bagian">${T('Fitur lanjutan')}</h2>
    <section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="gemini">
        <span class="ikon-bulat">🤖</span>
        <span class="isi"><b>${T('Baca struk lebih akurat')}</b><small>${d.kunciGemini.length ? T('Aktif · memakai AI Gemini') : T('Opsional · pakai kunci Gemini gratis dari Google')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      ${d.telegram.bot || d.telegram.pengguna.length ? `<button class="baris" data-aksi="telegram">
        <span class="ikon-bulat">💬</span>
        <span class="isi"><b>${T('Bot Telegram')}</b><small>${d.telegram.bot ? '@' + esc(d.telegram.bot) + ' · ' : ''}${T('{n} akun terhubung', { n: d.telegram.pengguna.length })}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>` : ''}
      <a class="baris" href="${esc(d.urlSpreadsheet)}" target="_blank" style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">📊</span>
        <span class="isi"><b>${T('Buka spreadsheet')}</b><small>${T('Lihat semua data di Google Sheets')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </a>
      <button class="baris" data-aksi="cadangan">
        <span class="ikon-bulat">💾</span>
        <span class="isi"><b>${T('Unduh & cadangan data')}</b><small>${T('Simpan semua transaksi sebagai file Excel/CSV')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <a class="baris" href="privasi.html" style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">🔒</span>
        <span class="isi"><b>${T('Kebijakan privasi')}</b><small>${T('Data apa yang dipakai aplikasi ini')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </a>
    </section>

    <h2 class="judul-bagian">${T('Tampilan & keamanan')}</h2>
    <section class="kartu" style="padding:4px 16px">
      <label class="baris baris-pilih">
        <span class="ikon-bulat">🌐</span>
        <span class="isi"><b>${BAHASA === 'en' ? 'Language · Bahasa' : 'Bahasa · Language'}</b><small>${T('Bahasa tampilan aplikasi di HP ini')}</small></span>
        <span class="pilih-kecil">${pilihBahasa()}</span>
      </label>
      <label class="baris baris-pilih">
        <span class="ikon-bulat">${temaDipilih() === 'dark' ? '🌙' : temaDipilih() === 'light' ? '☀️' : '🌓'}</span>
        <span class="isi"><b>${T('Tema')}</b><small>${temaDipilih() ? (temaDipilih() === 'dark' ? T('Tetap gelap') : T('Tetap terang')) : T('Ikut pengaturan HP')}</small></span>
        <span class="pilih-kecil">
          <select id="pilih-tema" aria-label="${T('Tema')}">${[['', T('Otomatis')], ['light', T('Terang')], ['dark', T('Gelap')]].map(([t, l]) =>
            `<option value="${t}" ${temaDipilih() === t ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </span>
      </label>
      <label class="baris baris-pilih">
        <span class="ikon-bulat">🔠</span>
        <span class="isi"><b>${T('Ukuran tampilan')}</b><small>${T('Perbesar teks & tombol supaya lebih mudah dibaca')}</small></span>
        <span class="pilih-kecil">
          <select id="pilih-ukuran" aria-label="${T('Ukuran tampilan')}">${[['', T('Normal')], ['besar', T('Besar')], ['sangat', T('Sangat besar')]].map(([u, l]) =>
            `<option value="${u}" ${ukuranDipilih() === u ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </span>
      </label>
      <button class="baris" data-aksi="samar" role="switch" aria-checked="${modeSamar()}">
        <span class="ikon-bulat">👁</span>
        <span class="isi"><b>${T('Sembunyikan nominal')}</b><small>${modeSamar() ? T('Angka disamarkan') : T('Samarkan angka saat HP dilihat orang lain')}</small></span>
        <span class="saklar ${modeSamar() ? 'nyala' : ''}" aria-hidden="true"></span>
      </button>
      <button class="baris" data-aksi="atur-kunci">
        <span class="ikon-bulat">🔒</span>
        <span class="isi"><b>${T('Kunci aplikasi')}</b><small>${kunciTersimpan() ? (kunciTersimpan().bio ? T('Aktif · PIN + sidik jari/wajah') : T('Aktif · PIN')) : T('Minta PIN saat aplikasi dibuka')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
    </section>
    <section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="log-update">
        <span class="ikon-bulat">🆕</span>
        <span class="isi"><b>${T('Apa yang baru')}</b><small>${labelVersi() ? T('Riwayat pembaruan aplikasi · sekarang {versi}', { versi: labelVersi() }) : T('Riwayat pembaruan aplikasi')}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
    </section>
    ${kartuPasang()}
    ${!MODE_APLIKASI && labelVersi() ? `<p class="catatan-versi">Dompet Keluarga ${labelVersi()}</p>` : ''}`;
}

/** "v1.66" dari versi.txt (dibuat saat deploy: 1.<jumlah commit>); penanda lama berupa kode commit tidak ditampilkan. */
const labelVersi = () => (/^\d+\.\d+$/.test(versiAwal || '') ? 'v' + versiAwal : '');

function kartuPasang() {
  if (MODE_APLIKASI) {
    return `<p class="catatan-versi">${T('✅ Terpasang sebagai aplikasi · update otomatis')}${labelVersi() ? ' · ' + labelVersi() : ''}</p>`;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return `
    <section class="kartu panduan">
      <h3>${T('📲 Pasang sebagai aplikasi')}</h3>
      <p>${T('Cukup sekali pasang. Setiap ada pembaruan, aplikasi ikut ter-update sendiri tanpa perlu pasang ulang.')}</p>
      ${ajakanPasang ? `<button type="button" class="btn btn-utama" data-aksi="pasang-aplikasi">${T('Pasang aplikasi')}</button>`
      : ios ? `
        <b>${T('iPhone / iPad (wajib pakai Safari):')}</b>
        <ol><li>${T('Ketuk tombol Bagikan (kotak dengan panah ke atas).')}</li><li>${T('Gulir lalu pilih <b>Tambah ke Layar Utama</b>.')}</li><li>${T('Ketuk <b>Tambah</b>.')}</li></ol>`
      : `
        <b>Android (Chrome):</b>
        <ol><li>${T('Ketuk menu ⋮ di kanan atas.')}</li><li>${T('Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.')}</li><li>${T('Ketuk <b>Instal</b>.')}</li></ol>`}
    </section>`;
}

// ---------- Anggota keluarga ----------

/** Daftar akun yang punya akses ke buku ini (dimuat setelah lembar terbuka) + form undangan. */
const linkUndanganBuku = id => location.origin + location.pathname + '#gabung=' + id;
const PERAN_ANGGOTA = { owner: T('Pemilik'), writer: T('Bisa mencatat'), reader: T('Hanya lihat'), commenter: T('Hanya lihat') };

/**
 * Anggota sebuah buku + form undangan. idBuku kosong = buku yang sedang dibuka; selain itu buku lain dari
 * daftar Buku Keuangan (tidak perlu pindah buku dulu untuk mengundang).
 */
async function bukaAnggota(idBuku) {
  const buku = idBuku ? (S.data.buku || []).find(b => b.id === idBuku) : null;
  if (!buku || buku.aktif) return bukaAnggotaAktif();
  bukaSheet(T('Anggota · {buku}', { buku: namaT(buku.nama) }), `
    <div id="daftar-anggota" data-buku="${esc(buku.id)}"><p class="info-kecil">${T('Memuat anggota…')}</p></div>
    ${formUndangan(buku.id, buku.linkUndangan || linkUndanganBuku(buku.id))}`);
  isiDaftarAnggota(buku.id);
}

function formUndangan(idBuku, link) {
  return `
    <span class="label" style="margin-top:16px">${T('Undang anggota baru')}</span>
    <div class="grup-form">
      <label class="label" for="u-email">${T('Email Google')}</label>
      <input class="field" id="u-email" type="email" inputmode="email" autocomplete="email" placeholder="${T('nama@gmail.com')}">
      <p class="info-kecil" style="text-align:left">${T('Akun ini akan bisa ikut mencatat (Editor spreadsheet), dan Google mengirim email berisi link undangan.')}</p>
    </div>
    <div class="grup-form" style="margin-top:20px">
      <label class="label" for="u-link">${T('Atau kirim link undangan ini (mis. lewat WhatsApp)')}</label>
      <div class="salin">
        <input class="field" id="u-link" readonly value="${esc(link)}">
        <button type="button" class="btn btn-hapus" data-aksi="salin-link">${T('Salin')}</button>
      </div>
      <p class="info-kecil" style="text-align:left">${T('Link ini hanya bisa dipakai akun yang sudah diundang lewat email di atas.')}</p>
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="kirim-undangan" data-buku="${esc(idBuku || '')}">${T('Undang')}</button></div>`;
}

/** Mengisi #daftar-anggota (dimuat setelah lembar terbuka). */
async function isiDaftarAnggota(idBuku) {
  const kotak = () => $('#daftar-anggota'); // null kalau lembar sudah ditutup
  let anggota;
  try {
    anggota = await api('daftarAnggota', idBuku || '');
  } catch (e) {
    if (kotak()) kotak().innerHTML = `<p class="info-kecil">${T('Daftar anggota tidak bisa dimuat: {pesan}', { pesan: esc(pesanError(e)) })}</p>`;
    return;
  }
  if (!kotak()) return;
  const saya = String(GOOGLE.email() || '').toLowerCase();
  kotak().innerHTML = `<span class="label">${T('Yang bisa membuka buku ini ({n})', { n: anggota.length })}</span>` + anggota.map(a => {
    const sendiri = a.email.toLowerCase() === saya;
    return `
    <div class="baris">
      <span class="ikon-bulat">${a.peran === 'owner' ? '👑' : '👤'}</span>
      <span class="isi"><b>${esc(a.nama || a.email)}${sendiri ? ' ' + T('(Anda)') : ''}</b><small>${esc(a.email)} · ${esc(PERAN_ANGGOTA[a.peran] || a.peran)}</small></span>
      ${sendiri || a.peran === 'owner' ? '' : `<button type="button" class="tombol-ikon" data-aksi="keluarkan-anggota" data-id="${esc(a.id)}" data-email="${esc(a.email)}" data-buku="${esc(idBuku || '')}" aria-label="${T('Keluarkan {email}', { email: esc(a.email) })}">✕</button>`}
    </div>`;
  }).join('');
}

async function bukaAnggotaAktif() {
  bukaSheet(T('Anggota · {buku}', { buku: namaT(S.data.namaBuku || 'Keluarga') }), `
    <div id="daftar-anggota"><p class="info-kecil">${T('Memuat anggota…')}</p></div>
    ${formUndangan('', S.data.linkUndangan)}`);
  isiDaftarAnggota('');
}

// ---------- Unduh & cadangan ----------

function bukaCadangan() {
  bukaSheet(T('Unduh & cadangan data'), `
    <p style="margin-top:0">${S.data.namaBuku ? T('Semua transaksi buku <b>{buku}</b> diunduh sebagai file CSV, bisa dibuka di Excel atau Google Sheets.', { buku: esc(namaT(S.data.namaBuku)) }) : T('Semua transaksi buku <b>ini</b> diunduh sebagai file CSV, bisa dibuka di Excel atau Google Sheets.')}</p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" style="flex:1" data-aksi="unduh-csv">${T('Unduh semua transaksi')}</button></div>
    <span class="label" style="margin-top:16px">${T('Salah hapus atau salah ubah?')}</span>
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Google Sheets menyimpan riwayat perubahan. Buka spreadsheet di komputer, lalu <b>File → Histori versi → Lihat histori versi</b> untuk melihat atau memulihkan versi sebelumnya.')}</p>
    <a class="btn btn-hapus" style="display:block;text-decoration:none;text-align:center" href="${esc(S.data.urlSpreadsheet)}" target="_blank" rel="noopener">${T('Buka spreadsheet')}</a>`);
}

/** Teks yang diawali = + - @ tidak dibaca sebagai rumus oleh Excel (CSV injection). */
function selCsv(v) {
  let s = String(v == null ? '' : v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function unduhCsv() {
  const trx = await api('cariTransaksi', '', '');
  // Titik koma + BOM: langsung terbaca rapi di Excel berbahasa Indonesia, dan tetap bisa diimpor Google Sheets.
  const baris = [[T('Tanggal'), T('Tipe'), T('Jumlah'), T('Kategori'), T('Dompet'), T('Dompet Tujuan'), T('Catatan'), T('Dicatat oleh')]]
    .concat(trx.slice().reverse().map(t => [t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, t.oleh]));
  const blob = new Blob(['﻿' + baris.map(r => r.map(selCsv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Dompet Keluarga - ${S.data.namaBuku || T('Transaksi')} - ${hariIni()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(T('{n} transaksi diunduh ✔', { n: trx.length }));
}

// ---------- Bottom sheet ----------

function bukaSheet(judul, html) {
  $('#sheet-judul').textContent = judul;
  $('#sheet-isi').innerHTML = html;
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function tutupSheet() {
  simpanDrafTrx();
  $('#sheet').hidden = true;
  if (typeof tutupRingkasanSuara === 'function') tutupRingkasanSuara();
  document.body.style.overflow = '';
  F = null;
}

// ---------- Draf transaksi baru (lembar ditutup sebelum disimpan) ----------
const kunciDrafTrx = () => 'dk_draf_trx_' + (S.data && S.data.spreadsheetId || '');
function simpanDrafTrx() {
  if (!F || F.id || F._menyimpan || F.modeRutin || F.patungan || F.utang || F.dariRutin || F.dariJob || F.strukJob || !('tipe' in F) || !$('#f-jumlah')) return;
  try { bacaFieldTrx(); } catch (e) { return; }
  if (!F.jumlah && !String(F.catatan || '').trim()) return;
  tulisHp(kunciDrafTrx(), JSON.stringify({ waktu: Date.now(), isian: {
    tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet, dompetTujuan: F.dompetTujuan, tanggal: F.tanggal, catatan: F.catatan,
  } }));
}
function bacaDrafTrx() {
  try {
    const d = JSON.parse(bacaHp(kunciDrafTrx()));
    return d && Date.now() - d.waktu < 12 * 3600e3 ? d.isian : null;
  } catch (e) { return null; }
}

/** tanganiGagal(e): opsional; kembalikan true kalau error sudah ditangani (mis. disimpan sebagai tertunda). */
/** pesan: teks toast, atau fungsi(hasil) yang menampilkan toast-nya sendiri. */
async function kirim(tombol, fungsi, args, pesan, tanganiGagal) {
  tombol.disabled = true;
  loading(true);
  try {
    const hasil = await api(fungsi, ...args);
    tutupSheet();
    await muat();
    if (typeof pesan === 'function') pesan(hasil);
    else toast(pesan);
    return true;
  } catch (e) {
    if (tanganiGagal && tanganiGagal(e)) return false;
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true); // kartu "Sesi login berakhir" sudah tampil
    return false;
  } finally {
    tombol.disabled = false;
    loading(false);
  }
}

function gridIkon(terpilih) {
  return `<div class="grid-ikon">${PILIHAN_IKON.map(i =>
    `<button type="button" class="${i === terpilih ? 'aktif' : ''}" data-aksi="pilih-ikon" data-ikon="${i}" aria-label="${i}">${ilus(i)}</button>`).join('')}</div>`;
}

// ---------- Form transaksi ----------

/** preset: isian awal untuk transaksi baru, mis. setor/tarik tabungan. */
function bukaFormTrx(t, preset, judul) {
  const pertama = dompetBiasa()[0];
  F = t ? Object.assign({}, t) : Object.assign({
    tipe: TIPE.KELUAR, jumlah: 0, kategori: '', dompet: pertama ? pertama.nama : '', dompetTujuan: '',
    tanggal: hariIni(), catatan: '',
  }, preset);
  bukaSheet(t ? T('Ubah Transaksi') : judul || T('Catat Transaksi'), '<div id="form-trx"></div>');
  renderFormTrx();
  // Tidak fokus kalau form langsung diisi hasil struk (kartu konfirmasi muncul di atasnya, keyboard jangan terbuka).
  if (!t) setTimeout(() => F && !F.struk && $('#f-jumlah') && $('#f-jumlah').focus(), 250);
}

function renderFormTrx() {
  const kategori = S.data.kategori.filter(k => k.tipe === F.tipe);
  // Tabungan hanya muncul untuk Transfer (setor/tarik); pemasukan & pengeluaran memakai dompet biasa.
  const pilihDompet = (aksi, terpilih, termasukTabungan) => `<div class="grid-pilih">${S.data.dompet
    // Orang (utang-piutang) hanya muncul kalau sedang terpilih, mis. saat mencatat pelunasan.
    .filter(w => w.jenis === JENIS.DOMPET || (termasukTabungan && (w.jenis === JENIS.TABUNGAN || w.jenis === JENIS.ASET)) || w.nama === terpilih).map(w =>
    `<button type="button" class="pilihan ${w.nama === terpilih ? 'aktif' : ''}" data-aksi="${aksi}" data-nama="${esc(w.nama)}">
      <span>${ilus(w.ikon)}</span>${esc(namaT(w.nama))}</button>`).join('')}</div>`;

  // Form yang sama dipakai untuk: transaksi baru/ubah, membayar tagihan rutin (F.dariRutin),
  // dan membuat/mengubah tagihan rutin itu sendiri (F.modeRutin).
  const rutin = F.modeRutin;
  const bolehUlang = rutin || (!F.id && !F.dariRutin);
  const berikutUlang = F.ulang && !rutin ? SERVER.tanggalBerikut(F.tanggal || hariIni(), F.tanggal || hariIni(), F.ulang) : '';

  $('#form-trx').innerHTML = `
    ${F.galatSimpan ? `<div class="status-bar gagal galat-simpan" role="alert">⚠️ <span><b>${T('Gagal menyimpan.')}</b> ${esc(F.galatSimpan)}
      ${T('Periksa isiannya, lalu ketuk Simpan lagi.')}</span></div>` : ''}
    ${F.dariRutin ? `
      <div class="info-rutin">🔁 <span>${T('Setelah disimpan, jatuh tempo berikutnya <b>{tanggal}</b>.', { tanggal: esc(tanggalPendek(F.berikutRutin)) })}
        <button type="button" data-aksi="lewati-rutin">${T('Lewati kali ini')}</button></span></div>` : ''}

    ${!rutin && !F.id && !F.dariRutin && !F.strukJob && !F.struk && F.tipe !== TIPE.TRANSFER ? bagianCepat() : ''}

    ${rutin && !F.idRutin ? chipTemplat(TEMPLAT_RUTIN, 'templat-rutin') : ''}

    ${rutin ? `
      <div class="grup-form">
        <label class="label" for="f-nama">${T('Nama tagihan')}</label>
        <input class="field" id="f-nama" maxlength="60" placeholder="${T('mis. Listrik PLN, Internet, Cicilan motor, Gaji')}" value="${esc(F.nama)}">
      </div>` : ''}

    <div class="segmen">
      ${[TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button type="button" class="${F.tipe === t ? 'aktif' : ''}" data-aksi="f-tipe" data-tipe="${t}">${namaT(t)}</button>`).join('')}
    </div>

    ${F.strukJob ? `
      <div class="struk-proses" role="status"><span class="spinner kecil"></span>
        <span><b>${T('Membaca struk…')} <span class="detik" data-detik="${F.strukJob}"></span></b>
          <small class="tahap-struk" data-tahap="${F.strukJob}">${esc((ANTRIAN.find(j => j.id === F.strukJob) || {}).tahap || '')}</small>
          <small>${T('Isi lain boleh diisi dulu, atau tutup form ini. Hasilnya tetap muncul di bawah layar.')}</small></span></div>`
    : !F.id && !rutin && F.tipe === TIPE.KELUAR ? `
      <p class="label" style="margin:0 0 6px">${T('Isi otomatis dari foto struk')}</p>
      <div style="display:flex;gap:8px;margin:0 0 16px">
        <button type="button" class="tombol-tambah" style="margin:0" data-aksi="foto-struk" data-kamera="1">📷 ${T('Kamera')}</button>
        <button type="button" class="tombol-tambah" style="margin:0" data-aksi="foto-struk">🖼️ ${T('Galeri')}</button>
      </div>` : ''}

    <label class="input-jumlah">
      <span>Rp</span>
      <input id="f-jumlah" inputmode="numeric" autocomplete="off" placeholder="0"
        value="${F.jumlah ? new Intl.NumberFormat('id-ID').format(F.jumlah) : ''}">
    </label>
    ${F.struk ? infoStruk(F.struk) : ''}

    ${F.tipe !== TIPE.TRANSFER ? `
      <div class="grup-form">
        <span class="label">${T('Kategori')}</span>
        <div class="grid-pilih">${kategori.map(k =>
          `<button type="button" class="pilihan ${k.nama === F.kategori ? 'aktif' : ''}" data-aksi="f-kategori" data-nama="${esc(k.nama)}">
            <span>${ilus(k.ikon)}</span>${esc(namaT(k.nama))}</button>`).join('')}</div>
      </div>` : ''}

    <div class="grup-form">
      <span class="label">${F.tipe === TIPE.TRANSFER ? T('Dari dompet') : T('Dompet')}</span>
      ${pilihDompet('f-dompet', F.dompet, F.tipe === TIPE.TRANSFER)}
    </div>

    ${F.tipe === TIPE.TRANSFER ? `
      <div class="grup-form">
        <span class="label">${T('Ke dompet')}</span>
        ${pilihDompet('f-tujuan', F.dompetTujuan, true)}
      </div>` : ''}

    <div class="grup-form">
      <label class="label" for="f-tanggal">${rutin ? T('Jatuh tempo berikutnya') : T('Tanggal')}</label>
      ${inputTanggal('f-tanggal', F.tanggal)}
    </div>

    ${bolehUlang ? `
      <div class="grup-form">
        <span class="label">🔁 ${rutin ? T('Berulang') : T('Ulangi (tagihan rutin)')}</span>
        <div class="chips">${(rutin ? [] : [['', T('Tidak||ulang')]]).concat([['Bulanan', T('Tiap bulan')], ['Mingguan', T('Tiap minggu')], ['Tahunan', T('Tiap tahun')]]).map(([u, l]) =>
          `<button type="button" class="chip ${(F.ulang || '') === u ? 'aktif' : ''}" data-aksi="f-ulang" data-ulang="${u}">${l}</button>`).join('')}</div>
        ${berikutUlang ? `<p class="info-kecil" style="text-align:left">${T('Muncul lagi di Beranda menjelang {tanggal}, tinggal ketuk untuk mencatat.', { tanggal: esc(tanggalPendek(berikutUlang)) })}</p>` : ''}
      </div>` : ''}

    <div class="grup-form">
      <label class="label" for="f-catatan">${T('Catatan (opsional)')}</label>
      <input class="field" id="f-catatan" maxlength="500" list="f-saran" autocomplete="off" placeholder="${T('mis. Belanja bulanan di Indomaret')}" value="${esc(F.catatan)}">
      <datalist id="f-saran">${kebiasaan().saran.filter(s => s.tipe === F.tipe).map(s => `<option value="${esc(s.catatan)}">`).join('')}</datalist>
    </div>

    ${rutin ? '' : bagianLampiran()}

    ${!F.id && !rutin && !F.dariRutin && F.tipe === TIPE.KELUAR
      ? `<button type="button" class="tombol-teks" style="display:block;margin:-4px 0 8px;padding-left:0" data-aksi="buka-patungan">👥 ${T('Dibayar bareng teman? Bagi tagihan (patungan)')}</button>` : ''}

    ${F.oleh ? `<p class="info-kecil">${T('Dicatat oleh {nama}', { nama: esc(namaPendek(F.oleh)) })}</p>` : ''}
    <div class="aksi-form">
      ${rutin
        ? `${F.idRutin ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-rutin">${T('Hapus')}</button>` : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-rutin">${T('Simpan')}</button>`
        : `${F.id ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-trx">${T('Hapus')}</button>` : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-trx">${T('Simpan')}</button>`}
    </div>`;
}

/**
 * Lampiran foto struk di form transaksi: foto baru (F.lampiranData, diunggah saat Simpan),
 * lampiran yang sudah ada (F.lampiran = ID file Drive), atau tombol untuk melampirkan.
 */
function bagianLampiran() {
  if (F.lampiranData) {
    // Foto belum ada di Drive (diunggah saat Simpan), jadi dibuka dari data di HP.
    return `<div class="lampiran"><button type="button" class="lampiran-buka" data-aksi="lihat-lampiran" aria-label="${T('Lihat foto struk')}">
        ${F.lampiranThumb ? `<img src="${F.lampiranThumb}" alt="">` : '<span class="ikon-bulat">🧾</span>'}
        <span class="isi"><b>📎 ${T('Lihat foto struk')}</b><small>${T('Disimpan ke Google Drive saat transaksi disimpan')}</small></span></button>
      <button type="button" class="tombol-ikon" data-aksi="lampiran-hapus" aria-label="${T('Buang foto')}">✕</button></div>`;
  }
  if (F.lampiran) {
    const foto = fotoLampiranHp(F.lampiran, F.id);
    return `<div class="lampiran"><button type="button" class="lampiran-buka" data-aksi="lihat-lampiran" aria-label="${T('Lihat foto struk')}">
        ${foto ? `<img src="${foto}" alt="">` : '<span class="ikon-bulat">🧾</span>'}
        <span class="isi"><b>📎 ${T('Lihat foto struk')}</b><small>${T('Tersimpan di Google Drive')}</small></span></button>
      <button type="button" class="tombol-ikon" data-aksi="lampiran-hapus" aria-label="${T('Lepas lampiran')}">✕</button></div>`;
  }
  return `<button type="button" class="tombol-teks" style="display:block;margin:-4px 0 8px;padding-left:0" data-aksi="lampiran-pilih">📎 ${T('Lampirkan foto struk / bukti transfer')}</button>`;
}

/** Simpan isian field teks ke F sebelum form dirender ulang. */
function bacaFieldTrx() {
  if (!$('#f-jumlah')) return;
  const j = $('#f-jumlah');
  F.jumlah = j.dataset.nilai ? Number(j.dataset.nilai) : angka(j.value); // nilai akhir walau animasi hitung naik belum selesai
  F.tanggal = $('#f-tanggal').value;
  F.catatan = $('#f-catatan').value;
  if ($('#f-nama')) F.nama = $('#f-nama').value;
}

// ---------- Tampilan & keamanan (disimpan per perangkat) ----------

function bacaHp(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function tulisHp(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) { /* mode privat */ }
}

const WARNA_BILAH = { light: '#f4f5f8', dark: '#0b0c10' }; // = --bg tiap tema
/** '' = otomatis ikut perangkat, 'light', atau 'dark'. Dipasang awal di index.html supaya tidak berkedip. */
const temaDipilih = () => bacaHp('dk_tema') || '';
/** Ukuran tampilan: '' (normal) | 'besar' | 'sangat' — seluruh aplikasi diperbesar (zoom), bukan hanya huruf. */
const ukuranDipilih = () => bacaHp('dk_ukuran') || '';
function aturUkuran(u) {
  tulisHp('dk_ukuran', u || null);
  if (u) document.documentElement.dataset.ukuran = u;
  else delete document.documentElement.dataset.ukuran;
}

function aturTema(t) {
  tulisHp('dk_tema', t || null);
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.content = WARNA_BILAH[t || (/dark/.test(m.media) ? 'dark' : 'light')];
  });
}

const modeSamar = () => bacaHp('dk_samar') === '1';
function aturSamar(ya) {
  tulisHp('dk_samar', ya ? '1' : null);
  document.body.classList.toggle('samar', ya);
}

/*
 * Kunci aplikasi: PIN (disimpan sebagai hash bergaram) + opsional sidik jari/wajah (WebAuthn, perangkat ini saja).
 * Hanya mengunci tampilan di HP ini supaya tidak dibuka orang lain; datanya sendiri tetap di Google Drive.
 */
const kunciTersimpan = () => { try { return JSON.parse(bacaHp('dk_kunci')); } catch (e) { return null; } };
async function hashPin(pin, garam) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(garam + ':' + pin));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}
const keBase64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
const dariBase64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function bioTersedia() {
  try {
    return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) {
    return false;
  }
}
/** Mendaftarkan sidik jari/wajah perangkat ini; hasilnya ID kredensial (base64). Harus dari ketukan tombol. */
async function daftarBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Dompet Keluarga' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: GOOGLE.email() || 'pengguna', displayName: 'Dompet Keluarga' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  return keBase64(cred.rawId);
}
function cekBio(id) {
  return navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: dariBase64(id) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

let pinDiketik = '';
let waktuDisembunyikan = 0;
let timerJeda = 0;
const KUNCI_SETELAH_MS = 60 * 1000;
// PIN 4 angka hanya 10.000 kemungkinan: tiap 5× salah jeda 30 detik, 10× salah wajib masuk ulang dengan Google.
const SALAH_PER_JEDA = 5;
const JEDA_PIN_MS = 30 * 1000;
const SALAH_MAKS = 10;

/** { n: jumlah salah berturut-turut, sampai: waktu jeda berakhir }. Disimpan supaya tidak bisa direset dengan muat ulang. */
const pinSalah = () => { try { return JSON.parse(bacaHp('dk_pin_salah')) || { n: 0, sampai: 0 }; } catch (e) { return { n: 0, sampai: 0 }; } };
const sisaJedaPin = () => Math.max(0, pinSalah().sampai - Date.now());

/** Mencatat satu PIN salah; true kalau sudah terlalu sering sehingga kunci direset. */
function catatPinSalah() {
  const s = pinSalah();
  s.n++;
  if (s.n >= SALAH_MAKS) {
    resetKunci();
    toast(T('PIN salah {n} kali. Demi keamanan, silakan masuk lagi dengan akun Google.', { n: SALAH_MAKS }), true);
    return true;
  }
  if (s.n % SALAH_PER_JEDA === 0) s.sampai = Date.now() + JEDA_PIN_MS;
  tulisHp('dk_pin_salah', JSON.stringify(s));
  return false;
}

/** Lupa PIN / terlalu sering salah: kunci dimatikan, sesi Google & data di HP dihapus, lalu masuk ulang. */
function resetKunci() {
  tulisHp('dk_kunci', null);
  tulisHp('dk_pin_salah', null);
  tulisLokal('data', null);
  GOOGLE.keluar();
  S.data = null;
  bukaKunci();
  tampilMasuk();
}

function kunciLayar() {
  if (!kunciTersimpan()) return;
  pinDiketik = '';
  renderKunci();
  $('#kunci').hidden = false;
}
function bukaKunci() {
  pinDiketik = '';
  clearTimeout(timerJeda);
  $('#kunci').hidden = true;
  $('#kunci').innerHTML = '';
  setTimeout(cekPengingat, 300); // pengingat hari ini tampil setelah PIN dibuka
}
function renderKunci(salah) {
  const k = kunciTersimpan();
  const jeda = sisaJedaPin();
  clearTimeout(timerJeda);
  if (jeda) timerJeda = setTimeout(() => { if (!$('#kunci').hidden) renderKunci(); }, Math.min(jeda, 1000));
  $('#kunci').innerHTML = `
    <div class="kunci-isi">
      <div class="logo" aria-hidden="true">🔒</div>
      <b>${jeda ? T('Coba lagi dalam {n} detik', { n: Math.ceil(jeda / 1000) }) : T('Masukkan PIN')}</b>
      <div class="titik-pin ${salah ? 'salah' : ''}">${Array.from({ length: k.panjang || 4 }, (_, i) =>
        `<i class="${i < pinDiketik.length ? 'isi' : ''}"></i>`).join('')}</div>
      <div class="papan-pin">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-aksi="pin" data-n="${n}">${n}</button>`).join('')}
        ${k.bio ? `<button type="button" data-aksi="buka-bio" aria-label="${T('Pakai sidik jari atau wajah')}">👆</button>` : '<span></span>'}
        <button type="button" data-aksi="pin" data-n="0">0</button>
        <button type="button" data-aksi="pin-hapus" aria-label="${T('Hapus satu angka')}">⌫</button>
      </div>
      <button type="button" class="tombol-teks" data-aksi="lupa-pin">${T('Lupa PIN?')}</button>
    </div>`;
}

async function bukaFormKunci() {
  const k = kunciTersimpan();
  if (k) {
    return bukaSheet(T('Kunci Aplikasi'), `
      <p style="margin-top:0">${k.bio ? T('Kunci aktif: PIN + sidik jari/wajah. Diminta saat aplikasi dibuka atau ditinggal lebih dari 1 menit.') : T('Kunci aktif: PIN. Diminta saat aplikasi dibuka atau ditinggal lebih dari 1 menit.')}</p>
      <div class="grup-form">
        <label class="label" for="k-pin">${T('Masukkan PIN untuk mematikan kunci')}</label>
        <input class="field" id="k-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">
      </div>
      <div class="aksi-form"><button type="button" class="btn btn-hapus" style="flex:1" data-aksi="hapus-kunci">${T('Matikan kunci')}</button></div>`);
  }
  const bio = await bioTersedia();
  bukaSheet(T('Kunci Aplikasi'), `
    <p style="margin-top:0">${T('PIN diminta setiap aplikasi dibuka, atau setelah ditinggal lebih dari 1 menit. Hanya berlaku di HP ini.')}</p>
    <div class="grup-form">
      <label class="label" for="k-pin">${T('PIN baru (4–6 angka)')}</label>
      <input class="field" id="k-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </div>
    <div class="grup-form">
      <label class="label" for="k-pin2">${T('Ulangi PIN')}</label>
      <input class="field" id="k-pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </div>
    ${bio ? `<label class="baris" style="cursor:pointer"><input type="checkbox" id="k-bio" checked>
      <span class="isi"><b>${T('Juga pakai sidik jari / wajah')}</b><small>${T('Lebih cepat dari mengetik PIN')}</small></span></label>` : ''}
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-kunci">${T('Aktifkan')}</button></div>
    <p class="info-kecil">${T('Lupa PIN? Cukup keluar lalu masuk lagi dengan akun Google. Data tidak hilang.')}</p>
    <p class="info-kecil">${T('Kunci ini menjaga dari orang yang meminjam HP. Kalau HP hilang, segera ganti sandi Google Anda dan keluarkan HP itu dari akun Google.')}</p>`);
}

// ---------- Input cepat ----------

const kebiasaan = () => S.data.cepat || { favorit: [], saran: [] }; // data offline versi lama belum punya

/** Kata kunci → kata yang biasanya ada di nama kategori (sama dengan bot/Kode.gs). */
const KATA_KATEGORI = [
  [/makan|minum|bakso|nasi|mie|kopi|jajan|resto|warung|sarapan|cemilan|snack|gofood|grabfood|shopeefood/, ['makan']],
  [/bensin|parkir|ojek|ojol|grab|gojek|tol|bus|kereta|krl|angkot|taksi|servis/, ['transport']],
  [/listrik|pln|pdam|internet|wifi|pulsa|kuota|token|bpjs|tagihan|cicilan/, ['tagihan']],
  [/belanja|sayur|indomaret|alfamart|pasar|supermarket|sabun|beras|minyak|galon/, ['belanja', 'rumah']],
  [/obat|dokter|apotek|klinik|rumah sakit|vitamin/, ['kesehatan']],
  [/sekolah|spp|buku|kursus|les|kuliah/, ['pendidikan']],
  [/popok|pampers|susu anak|mainan/, ['anak']],
  [/film|nonton|netflix|spotify|game|liburan|wisata/, ['hiburan']],
  [/baju|celana|sepatu|kaos|jaket/, ['pakaian']],
  [/sedekah|zakat|infaq|infak|kondangan|sumbangan|donasi/, ['sosial']],
  [/gaji|upah|honor/, ['gaji']],
  [/bonus|thr/, ['bonus']],
];
/**
 * Kata kunci bahasa Inggris (hanya dipakai saat BAHASA === 'en'), menunjuk ke nama kategori bawaan yang sama.
 * Terpisah dari daftar Indonesia supaya kata seperti "gas" (elpiji) tidak salah terbaca untuk pengguna Indonesia.
 */
const KATA_KATEGORI_EN = [
  [/\b(food|eat|meal|lunch|dinner|breakfast|brunch|coffee|tea|drinks?|snacks?|restaurant|cafe|takeaway|takeout)\b/, ['makan']],
  [/\b(fuel|gas|petrol|gasoline|parking|taxi|cab|uber|bus|train|toll|fare|ride|transport)\b/, ['transport']],
  [/\b(electricity|electric|water bill|internet|wifi|phone|credit|data plan|bills?|installment|rent)\b/, ['tagihan']],
  [/\b(groceries|grocery|supermarket|market|vegetables|rice|soap|detergent|shopping)\b/, ['belanja', 'rumah']],
  [/\b(medicine|doctor|pharmacy|clinic|hospital|vitamins?|medical)\b/, ['kesehatan']],
  [/\b(school|tuition|books?|course|lessons?|college|university)\b/, ['pendidikan']],
  [/\b(diapers?|baby|toys?|kids?)\b/, ['anak']],
  [/\b(movies?|cinema|netflix|spotify|games?|holiday|vacation|trip)\b/, ['hiburan']],
  [/\b(clothes|clothing|shirt|pants|shoes|jacket|dress)\b/, ['pakaian']],
  [/\b(charity|donation|donate|zakat|gift|wedding)\b/, ['sosial']],
  [/\b(salary|wages?|paycheck|payroll)\b/, ['gaji']],
  [/\b(bonus)\b/, ['bonus']],
];
const NOMINAL_SLANG = { gopek: 500, seceng: 1000, goceng: 5000, ceban: 10000, gocap: 50000, cepek: 100000 };

/**
 * "bakso 25rb gopay" → { tipe, jumlah, kategori, dompet, catatan }. Hanya aturan sederhana,
 * jadi cepat dan tetap jalan tanpa sinyal. Field yang tidak dikenali dikosongkan.
 */
/**
 * Kata bilangan → angka, untuk hasil suara / ketikan: "dua puluh lima ribu" → "25000", "satu setengah juta" → "1500000",
 * "seratus dua puluh ribu" → "120000". Kata lain dibiarkan apa adanya.
 */
const KATA_ANGKA = { nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
/** Bilangan bahasa Inggris (hanya saat BAHASA === 'en'): "twenty five thousand" → "25000". */
const KATA_ANGKA_EN = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
function angkaDariKata(teks) {
  const kata = teks.split(/\s+/);
  const hasil = [];
  const en = BAHASA === 'en';
  let total = 0, kelompok = 0, satuan = 0, aktif = false;
  const selesai = () => { if (aktif) hasil.push(String(Math.round(total + kelompok + satuan))); total = kelompok = satuan = 0; aktif = false; };
  for (const asli of kata) {
    const w = asli.toLowerCase();
    let m;
    if (en && Object.prototype.hasOwnProperty.call(KATA_ANGKA_EN, w)) { satuan += KATA_ANGKA_EN[w]; aktif = true; }
    else if (en && w === 'hundred' && aktif) { kelompok += (satuan || 1) * 100; satuan = 0; }
    else if (en && (m = w.match(/^(thousand|million|billion)$/)) && aktif) {
      total += ((kelompok + satuan) || 1) * { thousand: 1e3, million: 1e6, billion: 1e9 }[m[1]]; kelompok = satuan = 0;
    }
    else if (w in KATA_ANGKA && w !== 'se') { satuan += KATA_ANGKA[w]; aktif = true; }
    else if (w === 'belas' && aktif) { satuan += 10; }
    else if (w === 'puluh' && aktif) { kelompok += (satuan || 1) * 10; satuan = 0; }
    else if ((m = w.match(/^(se)?ratus$/)) && (aktif || m[1])) { kelompok += (m[1] ? 1 : (satuan || 1)) * 100; satuan = 0; aktif = true; }
    else if ((m = w.match(/^(se)?(ribu|juta|miliar)$/)) && (aktif || m[1])) {
      const kali = { ribu: 1e3, juta: 1e6, miliar: 1e9 }[m[2]];
      total += ((m[1] ? 1 : (kelompok + satuan)) || 1) * kali; kelompok = satuan = 0; aktif = true;
    }
    else if (w === 'setengah' && aktif === false) { satuan = 0.5; aktif = true; }
    else if (w === 'setengah' && aktif) { satuan += 0.5; }
    else { selesai(); hasil.push(asli); }
  }
  selesai();
  return hasil.join(' ');
}

/**
 * Tanggal dari ucapan/ketikan → { tanggal 'yyyy-mm-dd', sisa (kalimat tanpa kata tanggal) }. Contoh:
 * "kemarin", "kemarin lusa", "3 hari lalu", "Sabtu minggu lalu" (minggu = Senin–Minggu sebelumnya),
 * "Sabtu lalu" / "Sabtu kemarin" (Sabtu terakhir sebelum hari ini), "tanggal 1", "tanggal 1 bulan kemarin",
 * "tanggal 17 Agustus". tanggal kosong kalau tidak ada kata tanggal.
 */
const NAMA_HARI_LISAN = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const NAMA_BULAN_LISAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
function bacaTanggalLisan(teks) {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const kini = keTanggal(hariIni());
  const geser = n => { const d = new Date(kini); d.setDate(d.getDate() + n); return iso(d); };
  const idxHari = (kini.getDay() + 6) % 7; // Senin = 0
  const HARI = "(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)";
  let sisa = ' ' + String(teks).replace(/jum'at/gi, 'jumat') + ' ';
  let tanggal = '';
  const coba = (re, f) => {
    if (tanggal) return;
    const m = sisa.match(re);
    if (!m) return;
    const t = f(m);
    if (!t) return;
    tanggal = t;
    sisa = sisa.replace(m[0], ' ');
  };
  // "Sabtu minggu lalu" / "Sabtu pekan kemarin": hari itu di minggu (Senin–Minggu) sebelumnya.
  coba(new RegExp('\\b(hari\\s+)?' + HARI + '\\s+(minggu|pekan)\\s+(lalu|kemarin|kemaren)\\b', 'i'),
    m => geser(-idxHari - 7 + NAMA_HARI_LISAN.indexOf(m[2].toLowerCase().replace("'", ''))));
  // "tanggal 1 bulan kemarin" / "tgl 15 bulan lalu"
  coba(/\b(tanggal|tgl)\s+(\d{1,2})\s+bulan\s+(lalu|kemarin|kemaren)\b/i, m => {
    const d = new Date(kini.getFullYear(), kini.getMonth() - 1, Number(m[2]));
    return d.getMonth() === (kini.getMonth() + 11) % 12 ? iso(d) : '';
  });
  // "tanggal 17 Agustus" (tahun ini; kalau masih di depan, tahun lalu)
  coba(new RegExp('\\b(tanggal\\s+|tgl\\s+)?(\\d{1,2})\\s+(' + NAMA_BULAN_LISAN.join('|') + ')\\b', 'i'), m => {
    const b = NAMA_BULAN_LISAN.indexOf(m[3].toLowerCase());
    let d = new Date(kini.getFullYear(), b, Number(m[2]));
    if (d.getMonth() !== b) return '';
    if (d > kini) d = new Date(kini.getFullYear() - 1, b, Number(m[2]));
    return iso(d);
  });
  // "tanggal 3" (bulan ini; kalau tanggalnya belum lewat, bulan lalu)
  coba(/\b(tanggal|tgl)\s+(\d{1,2})\b/i, m => {
    const n = Number(m[2]);
    let d = new Date(kini.getFullYear(), kini.getMonth(), n);
    if (d.getDate() !== n) return '';
    if (d > kini) d = new Date(kini.getFullYear(), kini.getMonth() - 1, n);
    return d.getDate() === n ? iso(d) : '';
  });
  coba(/\b(kemarin|kemaren)\s+lusa\b|\blusa\s+(kemarin|kemaren)\b/i, () => geser(-2));
  coba(/\b(\d{1,2})\s+hari\s+(yang\s+)?(lalu|kemarin|sebelumnya)\b/i, m => (Number(m[1]) <= 60 ? geser(-Number(m[1])) : ''));
  // "Sabtu lalu" / "Sabtu kemarin": Sabtu terakhir sebelum hari ini.
  coba(new RegExp('\\b(hari\\s+)?' + HARI + '\\s+(lalu|kemarin|kemaren)\\b', 'i'), m => {
    const target = NAMA_HARI_LISAN.indexOf(m[2].toLowerCase().replace("'", ''));
    return geser(-(((idxHari - target + 7) % 7) || 7));
  });
  coba(/\b(kemarin|kemaren|kmrn|kmarin)\b/i, () => geser(-1));
  coba(/\b(hari ini|tadi pagi|tadi siang|tadi sore|tadi malam|barusan)\b/i, () => hariIni());
  if (BAHASA === 'en') bacaTanggalInggris(coba, { kini, iso, geser, idxHari });
  return { tanggal, sisa: sisa.replace(/\s+/g, ' ').trim() };
}

/**
 * Tambahan untuk bahasa Inggris (hanya saat BAHASA === 'en'; pola Indonesia di atas tetap berlaku):
 * "today", "yesterday", "tomorrow", "day before yesterday", "3 days ago", "last Saturday", "Saturday last week",
 * "17 August" / "Aug 17" / "17th of Aug", "on the 3rd".
 */
const NAMA_HARI_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const NAMA_BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function bacaTanggalInggris(coba, { kini, iso, geser, idxHari }) {
  const HARI = '(' + NAMA_HARI_EN.join('|') + ')';
  const BULAN = '(' + NAMA_BULAN_EN.join('|') + '|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
  const keBulan = s => NAMA_BULAN_EN.findIndex(b => b.startsWith(s.toLowerCase().slice(0, 3)));
  const tanggalBulan = (b, n) => {
    let d = new Date(kini.getFullYear(), b, n);
    if (d.getMonth() !== b) return '';
    if (d > kini) d = new Date(kini.getFullYear() - 1, b, n);
    return iso(d);
  };
  coba(new RegExp('\\b(on\\s+)?' + HARI + '\\s+last\\s+week\\b', 'i'), m => geser(-idxHari - 7 + NAMA_HARI_EN.indexOf(m[2].toLowerCase())));
  coba(new RegExp('\\b(on\\s+)?(the\\s+)?(\\d{1,2})(st|nd|rd|th)?\\s+(of\\s+)?' + BULAN + '\\b', 'i'), m => tanggalBulan(keBulan(m[6]), Number(m[3])));
  coba(new RegExp('\\b(on\\s+)?' + BULAN + '\\s+(\\d{1,2})(st|nd|rd|th)?\\b', 'i'), m => tanggalBulan(keBulan(m[2]), Number(m[3])));
  // "on the 3rd" / "the 3rd" / "on the 3" (bulan ini; kalau belum lewat, bulan lalu)
  coba(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b|\bon\s+the\s+(\d{1,2})\b/i, m => {
    const n = Number(m[1] || m[2]);
    let d = new Date(kini.getFullYear(), kini.getMonth(), n);
    if (d.getDate() !== n) return '';
    if (d > kini) d = new Date(kini.getFullYear(), kini.getMonth() - 1, n);
    return d.getDate() === n ? iso(d) : '';
  });
  coba(/\b(the\s+)?day\s+before\s+yesterday\b/i, () => geser(-2));
  coba(/\b(\d{1,2})\s+days?\s+ago\b/i, m => (Number(m[1]) <= 60 ? geser(-Number(m[1])) : ''));
  coba(new RegExp('\\b(on\\s+)?last\\s+' + HARI + '\\b', 'i'), m => {
    const target = NAMA_HARI_EN.indexOf(m[2].toLowerCase());
    return geser(-(((idxHari - target + 7) % 7) || 7));
  });
  coba(/\byesterday\b/i, () => geser(-1));
  coba(/\btomorrow\b/i, () => geser(1));
  coba(/\b(today|this morning|this afternoon|this evening|tonight|just now)\b/i, () => hariIni());
}

function bacaKetikCepat(teks) {
  teks = angkaDariKata(teks);
  const waktu = bacaTanggalLisan(teks);
  teks = waktu.sisa;
  let sisa = ' ' + teks.toLowerCase() + ' ';
  let jumlah = 0;
  const en = BAHASA === 'en';
  // Angka pertama yang bersatuan (rb/jt) atau ≥ 100; "nasi 2 bungkus 30rb" → 30.000, bukan 2.
  // Bahasa Inggris menambah: 10m / 10 million (juta), 25 thousand (ribu). "M" tidak dipakai di bahasa Indonesia (= miliar).
  const re = en ? /(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|thousand|m|mn|mil|million)?(?=\s|$)/g
    : /(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?(?=\s|$)/g;
  let m = null;
  for (let x; (x = re.exec(sisa));) {
    let n = Number(x[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (/^(rb|ribu|k|thousand)$/.test(x[2] || '')) n *= 1000;
    if (/^(jt|juta|m|mn|mil|million)$/.test(x[2] || '')) n *= 1e6;
    if (x[2] || n >= 100) { m = x; jumlah = n; break; }
  }
  if (m) {
    sisa = sisa.replace(m[0], ' ');
  } else {
    const slang = Object.keys(NOMINAL_SLANG).find(s => sisa.includes(' ' + s + ' '));
    if (slang) { jumlah = NOMINAL_SLANG[slang]; sisa = sisa.replace(' ' + slang + ' ', ' '); }
  }
  // Dompet: nama terpanjang dulu, supaya "BCA Syariah" tidak terbaca "BCA".
  // Bahasa Inggris: nama tampilannya juga dikenali ("cash" → Tunai, "bank account" → Rekening Bank).
  const sebutan = [];
  dompetBiasa().forEach(w => {
    sebutan.push({ w, s: w.nama.toLowerCase() });
    if (en && namaT(w.nama) !== w.nama) sebutan.push({ w, s: namaT(w.nama).toLowerCase() });
  });
  const cocok = sebutan.sort((a, b) => b.s.length - a.s.length).find(x => sisa.includes(' ' + x.s + ' '));
  const dompet = cocok ? cocok.w : null;
  if (cocok) sisa = sisa.replace(' ' + cocok.s + ' ', ' ');
  sisa = sisa.replace(/\b(pakai|pake|pk|via|dari|ke|lewat|bayar)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (en) sisa = sisa.replace(/\b(with|using|paid|pay|by)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const tipe = /\b(gaji|terima|dapat|bonus|thr|masuk|transferan)\b/.test(sisa)
    || (en && /\b(salary|wages?|paycheck|payroll|income|received|refund)\b/.test(sisa)) ? TIPE.MASUK : TIPE.KELUAR;
  const catatan = sisa ? sisa.charAt(0).toUpperCase() + sisa.slice(1) : '';
  return { tipe, jumlah: Math.round(jumlah), kategori: tebakKategori(tipe, catatan), dompet: dompet ? dompet.nama : '', catatan, tanggal: waktu.tanggal };
}

/** Kategori dari riwayat catatan yang sama, lalu dari nama kategori, lalu dari kata kunci. */
function tebakKategori(tipe, catatan) {
  const c = String(catatan || '').trim().toLowerCase();
  if (!c) return '';
  const daftar = S.data.kategori.filter(k => k.tipe === tipe);
  const ada = n => daftar.some(k => k.nama === n);
  const dulu = kebiasaan().saran.find(s => s.tipe === tipe && s.catatan.toLowerCase() === c && ada(s.kategori));
  if (dulu) return dulu.kategori;
  const kata = c.split(/\s+/).filter(w => w.length > 3);
  // Nama tampilan ikut dicocokkan (bahasa Inggris: "groceries" → Belanja Harian); namaT = nama asli di bahasa Indonesia.
  const namaCocok = daftar.find(k => k.nama !== 'Lainnya'
    && kata.some(w => k.nama.toLowerCase().includes(w) || namaT(k.nama).toLowerCase().includes(w)));
  if (namaCocok) return namaCocok.nama;
  for (const [pola, petunjuk] of BAHASA === 'en' ? KATA_KATEGORI.concat(KATA_KATEGORI_EN) : KATA_KATEGORI) {
    if (!pola.test(c)) continue;
    const k = daftar.find(k => petunjuk.some(p => k.nama.toLowerCase().includes(p)));
    if (k) return k.nama;
  }
  return '';
}

/** Tombol "⚡ Sering dicatat" + kolom ketik cepat; hanya untuk transaksi baru biasa. */
function bagianCepat() {
  const fav = kebiasaan().favorit;
  return `
    <div class="ketik-cepat">
      <input class="field" id="f-cepat" enterkeyhint="done" autocomplete="off" placeholder="${T('⚡ Ketik cepat, mis. bakso 25rb gopay')}">
    </div>
    ${fav.length ? `<div class="chips chips-geser" aria-label="${T('Sering dicatat')}">${fav.map((f, i) =>
      `<button type="button" class="chip" data-aksi="f-favorit" data-i="${i}">${ilus(ikonKategori(f.kategori, f.tipe))} ${esc(f.catatan || namaT(f.kategori))} <small>${rpPendek(f.jumlah)}</small></button>`).join('')}</div>` : ''}`;
}

/** Mengisi form dari hasil ketik cepat / favorit; field yang tidak dikenali tidak menimpa isian yang ada. */
function isiFormCepat(h) {
  bacaFieldTrx();
  const lama = { tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet, dompetTujuan: F.dompetTujuan, tanggal: F.tanggal, catatan: F.catatan };
  if (h.tipe && h.tipe !== F.tipe) { F.tipe = h.tipe; F.kategori = ''; }
  if (h.jumlah) F.jumlah = h.jumlah;
  if (h.kategori) F.kategori = h.kategori;
  if (h.dompet && (F.tipe === TIPE.TRANSFER ? S.data.dompet : dompetBiasa()).some(w => w.nama === h.dompet)) F.dompet = h.dompet;
  if (h.dompetTujuan && F.tipe === TIPE.TRANSFER) F.dompetTujuan = h.dompetTujuan;
  if (h.tanggal) F.tanggal = h.tanggal;
  if (h.catatan) F.catatan = h.catatan;
  renderFormTrx();
  sorotTerisi(lama);
}

/**
 * Animasi untuk field yang baru saja terisi otomatis (suara / ketik cepat / favorit): menyala bergantian dari atas,
 * dan nominal "menghitung naik" ke nilainya. lama = nilai sebelum diisi.
 */
function sorotTerisi(lama) {
  const daftar = [];
  if (F.tipe !== lama.tipe) daftar.push(document.querySelector('#form-trx [data-aksi="f-tipe"].aktif'));
  if (F.jumlah && F.jumlah !== lama.jumlah) { daftar.push(document.querySelector('#form-trx .input-jumlah')); hitungNaik($('#f-jumlah'), F.jumlah); }
  if (F.kategori && F.kategori !== lama.kategori) daftar.push(document.querySelector('#form-trx [data-aksi="f-kategori"].aktif'));
  if (F.dompet && F.dompet !== lama.dompet) daftar.push(document.querySelector('#form-trx [data-aksi="f-dompet"].aktif'));
  if (F.dompetTujuan && F.dompetTujuan !== lama.dompetTujuan) daftar.push(document.querySelector('#form-trx [data-aksi="f-tujuan"].aktif'));
  if (F.tanggal && F.tanggal !== lama.tanggal) daftar.push(document.querySelector('#form-trx .input-tanggal, #f-tanggal'));
  if (F.catatan && F.catatan !== lama.catatan) daftar.push($('#f-catatan'));
  const ada = daftar.filter(Boolean);
  ada.forEach((el, i) => {
    el.classList.remove('terisi-otomatis');
    void el.offsetWidth; // mulai ulang animasi kalau diisi lagi
    el.style.setProperty('--tunda', (i * 110) + 'ms');
    el.classList.add('terisi-otomatis');
    el.addEventListener('animationend', function selesai(e) {
      if (e.animationName !== 'sorot-terisi') return;
      el.classList.remove('terisi-otomatis');
      el.removeEventListener('animationend', selesai);
    });
  });
  if (ada.length) getar();
}

/** Nominal menghitung naik dari 0 ke n (~0,5 detik), lalu kembali ke nilai sebenarnya. */
function hitungNaik(input, n) {
  if (!input || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fmt = v => new Intl.NumberFormat('id-ID').format(v);
  const mulai = performance.now(), lama = 520;
  input.dataset.nilai = n;
  const langkah = t => {
    if (!input.isConnected) return;
    const k = Math.min(1, Math.max(0, (t - mulai) / lama)); // frame pertama bisa bertanda waktu sebelum "mulai"
    const v = k < 1 ? Math.round(n * (1 - Math.pow(1 - k, 3)) / 100) * 100 : n;
    if (document.activeElement === input) { input.value = fmt(n); delete input.dataset.nilai; return; } // disentuh: langsung nilai akhir
    input.value = fmt(Math.min(v, n));
    if (k < 1) requestAnimationFrame(langkah);
    else { input.value = fmt(n); delete input.dataset.nilai; }
  };
  requestAnimationFrame(langkah);
}

// ---------- Sisa aman per hari & periode gajian ----------

/**
 * Berapa yang aman dibelanjakan per hari sampai akhir periode (hanya untuk periode berjalan).
 * Dasar: total anggaran kalau ada (hanya kategori beranggaran yang dihitung), kalau tidak: pemasukan periode ini.
 * Tagihan rutin yang masih akan jatuh tempo di periode ini ikut disisihkan. null kalau tidak berlaku.
 */
function hitungSisaAman() {
  if (S.bulan !== periodeSekarang()) return null;
  const r = SERVER.rentangPeriode(S.bulan, S.data.mulaiPeriode || 1);
  const beranggaran = kategoriBeranggaran();
  const pakaiAnggaran = beranggaran.length > 0;
  const lingkup = k => !pakaiAnggaran || beranggaran.some(x => x.nama === k);
  const per = pengeluaranPerKategori();
  const dasar = pakaiAnggaran ? beranggaran.reduce((a, k) => a + k.batas, 0) : total(S.data.transaksi, TIPE.MASUK);
  if (!dasar) return null;
  const terpakai = Object.keys(per).filter(lingkup).reduce((a, k) => a + per[k], 0);
  const tagihan = daftarRutin().filter(x => x.tipe === TIPE.KELUAR && x.berikutnya >= hariIni() && x.berikutnya <= r.akhir && lingkup(x.kategori))
    .reduce((a, x) => a + x.jumlah, 0);
  const hari = selisihHari(r.akhir) + 1;
  const sisa = dasar - terpakai - tagihan;
  return { pakaiAnggaran, dasar, terpakai, tagihan, hari, akhir: r.akhir, sisa, perHari: sisa > 0 ? Math.floor(sisa / hari / 500) * 500 : 0 };
}

function barisSisaAman() {
  const a = hitungSisaAman();
  if (!a) return '';
  return `<button type="button" class="tautan-putih aman" data-aksi="rincian-aman">
    ${a.sisa > 0 ? `🟢 ${T('Aman dibelanjakan <b>{jumlah}/hari</b> · {n} hari lagi', { jumlah: rp(a.perHari), n: a.hari })}` : `⚠️ ${T('Batas periode ini sudah terlewati')}`} ›</button>`;
}

function bukaRincianAman() {
  const a = hitungSisaAman();
  if (!a) return;
  const baris = (label, nilai, tebal) => `<div class="baris-rincian"><span>${label}</span>${tebal ? `<b>${nilai}</b>` : `<span>${nilai}</span>`}</div>`;
  bukaSheet(T('Aman Dibelanjakan'), `
    ${baris(a.pakaiAnggaran ? T('Total anggaran periode ini') : T('Pemasukan periode ini'), rp(a.dasar))}
    ${baris(a.pakaiAnggaran ? T('− Terpakai (kategori beranggaran)') : T('− Pengeluaran sejauh ini'), rp(a.terpakai))}
    ${a.tagihan ? baris(T('− Tagihan rutin sampai {tanggal}', { tanggal: tanggalPendek(a.akhir) }), rp(a.tagihan)) : ''}
    ${baris(T('= Sisa'), rp(a.sisa), true)}
    ${baris(T('÷ {n} hari (s.d. {tanggal})', { n: a.hari, tanggal: tanggalPendek(a.akhir) }), a.sisa > 0 ? T('{jumlah}/hari', { jumlah: rp(a.perHari) }) : '—', true)}
    <p class="info-kecil" style="text-align:left">${a.pakaiAnggaran
      ? T('Dihitung dari anggaran per kategori. Pengeluaran di kategori tanpa anggaran tidak ikut dihitung.')
      : T('Belum ada anggaran, jadi dihitung dari pemasukan yang dicatat di periode ini. Atur anggaran supaya lebih tepat.')}</p>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="atur-periode">${T('Periode gajian')}</button>
      <button type="button" class="btn btn-utama" data-aksi="atur-anggaran">${T('Atur anggaran')}</button>
    </div>`);
}

function bukaFormPeriode() {
  const kini = S.data.mulaiPeriode || 1;
  F = { mulai: kini };
  const contoh = n => {
    if (n === 1) return T('Periode = bulan kalender (1 – akhir bulan).');
    const r = SERVER.rentangPeriode(SERVER.periodeDari(hariIni(), n), n);
    return T('Periode berjalan: {awal} – {akhir}.', { awal: tanggalPendek(r.awal), akhir: tanggalPendek(r.akhir) });
  };
  bukaSheet(T('Periode Gajian'), `
    <p style="margin-top:0">${T('Tanggal berapa biasanya gajian? Ringkasan, anggaran, dan laporan dihitung dari tanggal itu sampai sehari sebelum gajian berikutnya.')}</p>
    <div class="grid-tanggal">${Array.from({ length: 28 }, (_, i) => i + 1).map(n =>
      `<button type="button" class="${n === kini ? 'aktif' : ''}" data-aksi="pilih-periode" data-n="${n}">${n}</button>`).join('')}</div>
    <p class="info-kecil" id="contoh-periode" style="text-align:left">${contoh(kini)}</p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-periode">${T('Simpan')}</button></div>`);
  F.contoh = contoh;
}

// ---------- Tagihan & transaksi rutin ----------

const SEBUTAN_ULANG = { Bulanan: T('Tiap bulan'), Mingguan: T('Tiap minggu'), Tahunan: T('Tiap tahun') };
const daftarRutin = () => S.data.rutin || []; // data offline versi lama belum punya rutin

function ikonRutin(r) {
  return r.tipe === TIPE.TRANSFER ? (adalahTabungan(r.dompetTujuan) ? ikonDompet(r.dompetTujuan) : '🔁') : ikonKategori(r.kategori, r.tipe);
}

function selisihHari(tgl) {
  return Math.round((keTanggal(tgl) - keTanggal(hariIni())) / 864e5);
}

function labelJatuhTempo(tgl) {
  const n = selisihHari(tgl);
  if (n < 0) return T('⛔ Terlambat {n} hari · {tanggal}', { n: -n, tanggal: tanggalPendek(tgl) });
  if (n === 0) return T('⚠️ Jatuh tempo hari ini');
  if (n === 1) return T('Besok · {tanggal}', { tanggal: tanggalPendek(tgl) });
  return T('{n} hari lagi · {tanggal}', { n, tanggal: tanggalPendek(tgl) });
}

/** Kartu Beranda: rutin yang jatuh tempo dalam 7 hari atau sudah terlewat. */
// ---------- Aktivitas keluarga ----------

const kunciAktivitas = () => 'dk_aktivitas_' + (S.data && S.data.spreadsheetId || '');
const ikonAksi = { catat: '➕', ubah: '✏️', hapus: '🗑️', kembalikan: '↩️' };
const kataAksi = { catat: T('mencatat'), ubah: T('mengubah'), hapus: T('menghapus'), kembalikan: T('mengembalikan') };

/** Gabungan log perubahan + transaksi baru periode ini, terbaru dulu. */
function daftarAktivitas() {
  const baru = (S.data.transaksi || []).filter(t => t.oleh && t.dibuat).map(t => ({
    waktu: t.dibuat, oleh: t.oleh, aksi: 'catat',
    ringkasan: (t.tipe === TIPE.TRANSFER ? T('Transfer {dari} → {ke}', { dari: namaT(t.dompet), ke: namaT(t.dompetTujuan) }) : namaT(t.kategori)) + ' ' + rp(t.jumlah) + (t.catatan ? ' · ' + t.catatan : ''),
  }));
  return (S.data.log || []).concat(baru).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu))).slice(0, 80);
}

function waktuRelatif(w) {
  const d = new Date(String(w).replace(' ', 'T'));
  if (isNaN(d)) return '';
  const menit = Math.round((Date.now() - d) / 60000);
  if (menit < 1) return T('baru saja');
  if (menit < 60) return T('{n} mnt lalu', { n: menit });
  if (menit < 24 * 60) return T('{n} jam lalu', { n: Math.round(menit / 60) });
  if (menit < 7 * 24 * 60) return T('{n} hari lalu', { n: Math.round(menit / 1440) });
  return d.toLocaleDateString(LOKAL, { day: 'numeric', month: 'short' });
}

/** Beranda: perubahan oleh anggota LAIN sejak terakhir dilihat (ubah/hapus saja, supaya tidak ramai). */
function kartuAktivitasBaru() {
  const terakhir = bacaHp(kunciAktivitas()) || '';
  const lain = (S.data.log || []).filter(x => x.oleh !== S.data.user && String(x.waktu) > terakhir && (x.aksi === 'ubah' || x.aksi === 'hapus'));
  if (!lain.length) return '';
  const x = lain[0];
  return `<button type="button" class="kartu kartu-aktivitas" data-aksi="aktivitas">
    <span class="ikon-bulat">${ikonAksi[x.aksi] || '👥'}</span>
    <span class="isi"><b>${T('{nama} {aksi} transaksi', { nama: esc(namaPendek(x.oleh)), aksi: kataAksi[x.aksi] || x.aksi })}</b>
      <small>${esc(x.ringkasan)}</small>
      ${lain.length > 1 ? `<small class="lagi">${T('+{n} perubahan lain · {waktu}', { n: lain.length - 1, waktu: esc(waktuRelatif(x.waktu)) })}</small>` : `<small class="lagi">${esc(waktuRelatif(x.waktu))}</small>`}</span>
    <span class="panah">${svg('maju')}</span>
  </button>`;
}

function bukaAktivitas() {
  const daftar = daftarAktivitas();
  if (daftar.length) tulisHp(kunciAktivitas(), String(daftar[0].waktu));
  bukaSheet(T('Aktivitas keluarga'), `
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Perubahan & penghapusan tercatat di sheet <b>Log</b> spreadsheet. Pencatatan baru dari periode ini.')}</p>
    <div class="daftar-aktivitas">${daftar.map(x => `
      <div class="baris-aktivitas ${x.aksi}">
        <span class="ikon-aksi">${ikonAksi[x.aksi] || '•'}</span>
        <span class="isi"><b>${esc(x.oleh === S.data.user ? T('Anda') : namaPendek(x.oleh))}</b> ${kataAksi[x.aksi] || esc(x.aksi)}
          <small>${esc(x.ringkasan)}</small></span>
        <small class="waktu">${esc(waktuRelatif(x.waktu))}</small>
      </div>`).join('') || kosong('👥', T('Belum ada aktivitas.'))}</div>`);
  if (S.tab === 'beranda') render();
}

// ---------- Pencarian global (transaksi semua bulan + catatan) ----------
let semuaTrxCari = null; // dimuat sekali saat pencarian pertama
function bukaCariGlobal() {
  S.hasilGlobal = [];
  bukaSheet(T('Cari'), `
    <div class="kotak-cari-global"><input class="field" id="cari-global" type="search" enterkeyhint="search" autocomplete="off"
      placeholder="${T('mis. arisan, bpjs, 25000, GoPay')}"></div>
    <div id="hasil-global"><p class="info-kecil">${T('Cari di semua transaksi (semua bulan) dan catatan.')}</p></div>`);
  setTimeout(() => $('#cari-global') && $('#cari-global').focus(), 200);
}
let timerCari = 0;
async function jalankanCariGlobal(q) {
  const kotak = $('#hasil-global');
  if (!kotak) return;
  q = q.trim().toLowerCase();
  if (q.length < 2) { kotak.innerHTML = `<p class="info-kecil">${T('Ketik minimal 2 huruf.')}</p>`; return; }
  const angkaQ = q.replace(/\D/g, '');
  const cocokTrx = t => [t.catatan, t.kategori, t.dompet, t.dompetTujuan].some(x => String(x || '').toLowerCase().includes(q))
    || (angkaQ.length >= 3 && String(t.jumlah).includes(angkaQ));
  const catatan = daftarCatatan().filter(c => (c.judul + ' ' + c.isi).toLowerCase().includes(q)).slice(0, 10);
  if (!semuaTrxCari) {
    kotak.innerHTML = KERANGKA_DAFTAR;
    try { semuaTrxCari = await api('cariTransaksi', '', ''); } catch (e) { semuaTrxCari = null; }
    if (!$('#hasil-global')) return;
  }
  const sumber = semuaTrxCari || S.data.transaksi;
  const trx = sumber.filter(cocokTrx).slice(0, 40);
  S.hasilGlobal = trx;
  $('#hasil-global').innerHTML = (catatan.length ? `<h4 class="sub-laporan">📝 ${T('Catatan ({n})', { n: catatan.length })}</h4>` + catatan.map(c => `
      <button type="button" class="kal-item" data-aksi="ubah-catatan" data-id="${esc(c.id)}" style="--w:${warnaCatatan(c.warna)}">
        <span class="isi"><b>${esc(c.judul)}</b><small>${esc(labelHariPendek(c.tanggal))}${c.isi ? ' · ' + esc(c.isi.replace(/\[( |x)\] ?/gi, '').slice(0, 80)) : ''}</small></span>
      </button>`).join('') : '')
    + (trx.length ? `<h4 class="sub-laporan">💳 ${T('Transaksi ({n})', { n: trx.length + (trx.length === 40 ? '+' : '') })}</h4>` + trx.map(t => {
      const tgl = `<small class="tgl-cari">${esc(labelHariPendek(t.tanggal))}</small>`;
      return tgl + itemTrx(t);
    }).join('') : '')
    + (!catatan.length && !trx.length ? kosong('🔍', T('Tidak ditemukan.')) : '')
    + (!semuaTrxCari ? `<p class="info-kecil">${T('Offline: hanya mencari di periode ini.')}</p>` : '');
}
document.addEventListener('input', e => {
  if (e.target.id !== 'cari-global') return;
  clearTimeout(timerCari);
  timerCari = setTimeout(() => jalankanCariGlobal(e.target.value), 250);
});

// ---------- Petunjuk sekali lihat (fitur yang tidak kelihatan: geser, mic, sekali ketuk) ----------
let petunjukTampil = false;
function petunjukSekali(kunci, sasaran, teks) {
  if (!sasaran || petunjukTampil || bacaHp('dk_petunjuk_' + kunci)) return false;
  const r = sasaran.getBoundingClientRect();
  if (!r.width || r.top > innerHeight - 60 || r.bottom < 0) return false;
  tulisHp('dk_petunjuk_' + kunci, '1');
  petunjukTampil = true;
  const el = document.createElement('div');
  el.className = 'petunjuk';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${teks}</span><button type="button" aria-label="${T('Tutup petunjuk')}">${T('Oke')}</button>`;
  document.body.appendChild(el);
  const lebar = Math.min(300, innerWidth - 24);
  el.style.width = lebar + 'px';
  const kiri = Math.max(12, Math.min(innerWidth - lebar - 12, r.left + r.width / 2 - lebar / 2));
  const bawah = r.bottom + 12 + el.offsetHeight < innerHeight - 90;
  el.style.left = kiri + 'px';
  el.style.top = (bawah ? r.bottom + 10 : r.top - el.offsetHeight - 10) + 'px';
  el.style.setProperty('--panah', Math.max(16, Math.min(lebar - 16, r.left + r.width / 2 - kiri)) + 'px');
  el.classList.add(bawah ? 'bawah' : 'atas');
  const tutup = () => { el.remove(); petunjukTampil = false; document.removeEventListener('pointerdown', tutup, true); };
  setTimeout(() => document.addEventListener('pointerdown', tutup, true), 300);
  setTimeout(tutup, 7000);
  return true;
}
function cekPetunjuk() {
  if (!S.data || $('#sheet').hidden === false && !$('.tombol-suara')) return;
  if (S.tab === 'riwayat') {
    const k = document.querySelector('#view .trx-geser');
    if (k && petunjukSekali('geser', k, T('👆 <b>Geser</b> transaksi: ← untuk <b>hapus</b>, → untuk <b>catat lagi</b>'))) {
      k.classList.add('contoh-geser');
      setTimeout(() => k.classList.remove('contoh-geser'), 2600);
    }
  } else if (S.tab === 'beranda' && $('#sheet').hidden) {
    petunjukSekali('ketuk', document.querySelector('.sekali-ketuk'), T('⚡ Ketuk sekali, langsung tercatat hari ini. Bisa diurungkan.'));
  } else if (S.tab === 'catatan-edit') {
    petunjukSekali('dikte', $('#tombol-dikte'), T('🎤 Ketuk untuk <b>menulis dengan suara</b>. Bisa berkali-kali, teks ditambahkan.'));
  }
}

// ---------- Catat sekali ketuk (Beranda) ----------
let trxSekaliKetuk = null;
const daftarSekaliKetuk = () => kebiasaan().favorit.filter(f => f.tipe !== TIPE.TRANSFER && f.jumlah > 0).slice(0, 4);

function bagianSekaliKetuk() {
  const fav = daftarSekaliKetuk();
  if (!fav.length) return '';
  return `<div class="sekali-ketuk">
      <small>⚡ ${T('Catat sekali ketuk')}</small>
      <div class="chips chips-geser">${fav.map((f, i) => `<button type="button" class="chip chip-ketuk" data-aksi="ketuk-catat" data-i="${i}">
        ${ilus(ikonKategori(f.kategori, f.tipe))} ${esc(f.catatan || namaT(f.kategori))} <b>${f.tipe === TIPE.MASUK ? '+' : ''}${rpPendek(f.jumlah)}</b></button>`).join('')}</div>
    </div>`;
}

async function catatSekaliKetuk(el) {
  const f = daftarSekaliKetuk()[Number(el.dataset.i)];
  if (!f || el.disabled) return;
  const dompet = dompetBiasa().some(w => w.nama === f.dompet) ? f.dompet : (dompetBiasa()[0] || {}).nama;
  const t = { idBaru: crypto.randomUUID(), tipe: f.tipe, jumlah: f.jumlah, kategori: f.kategori, dompet, dompetTujuan: '', tanggal: hariIni(), catatan: f.catatan };
  getar();
  el.disabled = true;
  el.classList.add('mengirim');
  const nama = (f.catatan || namaT(f.kategori)) + ' ' + rp(f.jumlah);
  try {
    if (S.offline || !navigator.onLine) { simpanTertunda(t, true); return; }
    await api('simpanTransaksi', t);
    trxSekaliKetuk = t.idBaru;
    await muat();
    const a = pesanAnggaran(t);
    toast(T('Tercatat {nama} ✔', { nama }) + (a ? ' · ' + a.teks : ''), a && a.lewat, { label: T('Urungkan'), aksi: 'urungkan-ketuk' });
  } catch (e) {
    if (e.jaringan) simpanTertunda(t, true);
    else if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
  } finally {
    el.disabled = false;
    el.classList.remove('mengirim');
  }
}

/** Saran "jadikan tagihan rutin" (dari pola transaksi 3–4 bulan terakhir); bisa ditolak per saran. */
const kunciSaranDitolak = () => 'dk_saran_tolak_' + (S.data && S.data.spreadsheetId || '');
function kartuSaranRutin() {
  let tolak = [];
  try { tolak = JSON.parse(bacaHp(kunciSaranDitolak())) || []; } catch (e) { tolak = []; }
  const x = (S.data.saranRutin || []).find(s => !tolak.includes(s.kunci));
  if (!x) return '';
  return `<section class="kartu kartu-saran">
    <span class="ikon-bulat">${ilus(ikonKategori(x.kategori, x.tipe))}</span>
    <div class="isi"><small>💡 ${T('Sepertinya rutin')}</small>
      <b>${esc(namaT(x.nama))} · ${rp(x.jumlah)}</b>
      <span>${T('Tercatat {n} bulan terakhir, sekitar tanggal {tanggal}. Jadikan tagihan rutin supaya diingatkan?', { n: x.kali, tanggal: x.hari })}</span>
      <div class="aksi-saran">
        <button type="button" class="chip aktif" data-aksi="saran-rutin" data-kunci="${esc(x.kunci)}">${T('Jadikan rutin')}</button>
        <button type="button" class="chip" data-aksi="tolak-saran" data-kunci="${esc(x.kunci)}">${T('Bukan')}</button>
      </div>
    </div>
  </section>`;
}

function kartuTagihan() {
  const dibayarOffline = tertunda().map(t => t.dariRutin).filter(Boolean); // sudah dibayar, menunggu sinyal
  const daftar = daftarRutin().filter(r => selisihHari(r.berikutnya) <= 7 && !dibayarOffline.includes(r.id));
  // Utang-piutang yang belum lunas dan jatuh temponya dekat ikut diingatkan di sini.
  const pinjaman = daftarUtang().filter(w => w.saldo && w.tenggat && selisihHari(w.tenggat) <= 7);
  if (!daftar.length && !pinjaman.length) return '';
  const baris = (aksi, attr, ikon, judul, tgl, nominal) => `
      <button class="baris" data-aksi="${aksi}" ${attr}>
        <span class="ikon-bulat">${ilus(ikon)}</span>
        <span class="isi"><b>${esc(judul)}</b><small class="${selisihHari(tgl) < 0 ? 'terlambat' : ''}">${esc(labelJatuhTempo(tgl))}</small></span>
        <b class="nominal">${rp(nominal)}</b>
      </button>`;
  return `
    <h2 class="judul-bagian">${T('Tagihan mendatang')} <button data-aksi="kelola-rutin">${T('Kelola')}</button></h2>
    <section class="kartu" style="padding:4px 16px">
      ${daftar.map(r => baris('bayar-rutin', `data-id="${esc(r.id)}"`, ikonRutin(r), r.nama, r.berikutnya, r.jumlah)).join('')}
      ${pinjaman.map(w => baris('buka-utang', `data-nama="${esc(w.nama)}"`, w.ikon,
        w.saldo > 0 ? T('{nama} membayar utang', { nama: w.nama }) : T('Bayar utang ke {nama}', { nama: w.nama }), w.tenggat, Math.abs(w.saldo))).join('')}
    </section>`;
}

function bukaDaftarRutin() {
  const daftar = daftarRutin();
  bukaSheet(T('Tagihan & Transaksi Rutin'), `
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">${T('Muncul di Beranda 7 hari sebelum jatuh tempo. Ketuk di sana untuk mencatat, nominal bisa diubah saat itu.')}</p>
    ${daftar.map(r => `
      <button class="baris" data-aksi="edit-rutin" data-id="${esc(r.id)}">
        <span class="ikon-bulat">${ilus(ikonRutin(r))}</span>
        <span class="isi"><b>${esc(r.nama)}</b><small>${T('{ulang} · berikutnya {tanggal}', { ulang: SEBUTAN_ULANG[r.ulang], tanggal: esc(tanggalPendek(r.berikutnya)) })}</small></span>
        <b class="nominal">${rp(r.jumlah)}</b>
      </button>`).join('') || kosong('🔁', T('Belum ada. Contoh: listrik, internet, cicilan, SPP, gaji.'))}
    <button class="tombol-tambah" data-aksi="tambah-rutin">＋ ${T('Tambah tagihan rutin')}</button>`);
}

function bukaFormRutin(r) {
  const pertama = dompetBiasa()[0];
  F = r
    ? Object.assign({}, r, { modeRutin: true, idRutin: r.id, id: '', tanggal: r.berikutnya })
    : { modeRutin: true, idRutin: '', nama: '', tipe: TIPE.KELUAR, jumlah: 0, kategori: '', dompet: pertama ? pertama.nama : '',
        dompetTujuan: '', tanggal: hariIni(), catatan: '', ulang: 'Bulanan' };
  bukaSheet(r ? T('Ubah Tagihan Rutin') : T('Tagihan Rutin Baru'), '<div id="form-trx"></div>');
  renderFormTrx();
}

/** Validasi bersama form transaksi & rutin; mengembalikan pesan kesalahan atau ''. */
function cekIsianTrx() {
  if (!F.jumlah) return T('Isi jumlahnya dulu.');
  if (F.tipe !== TIPE.TRANSFER && !F.kategori) return T('Pilih kategorinya dulu.');
  if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) return T('Pilih dompet tujuan yang berbeda.');
  return '';
}

// ---------- Foto struk (dibaca di latar belakang) ----------

/**
 * Antrian struk yang sedang/selesai dibaca: { id, file, status: 'proses' | 'siap' | 'gagal', thumb, hasil, pesan }.
 * Pengguna tetap bisa memakai aplikasi; hasilnya muncul di indikator di atas navigasi bawah.
 */
const ANTRIAN = [];
let nomorStruk = 0;
let sumberStruk = 'cepat'; // 'form' kalau foto dipilih dari dalam form transaksi

/**
 * Batas ukuran foto dihitung dari JUMLAH PIKSEL, bukan sisi terpanjang. Dengan batas sisi terpanjang,
 * struk panjang (1:4) atau screenshot panjang ikut menyempit sampai angkanya tidak terbaca.
 */
const PIKSEL_BACA = 5e6;   // untuk dibaca AI/OCR: cukup tajam untuk angka kecil di struk
const PIKSEL_ARSIP = 2e6;  // dikirim ke AI: cukup tajam, unggahan tetap kecil
const PIKSEL_LAMPIRAN = 1.2e6; // disimpan ke Drive sebagai lampiran: cukup untuk dilihat, cepat diunggah (±150–300 KB)
const SISI_MAKS = 4096;

/**
 * Menyiapkan foto. Hasil: { base64 (untuk OCR), arsip (untuk AI), lampiran (disimpan ke Drive), thumb (data URL kecil) };
 * base64/arsip/lampiran berupa JPEG tanpa awalan data URL.
 */
function kecilkanGambar(file) {
  return new Promise((ok, gagal) => {
    // Object URL: browser langsung membaca file, tanpa mengubah foto 5–10 MB menjadi teks base64 dulu.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error(T('Gambar tidak bisa dibuka. Coba foto lain (format JPG/PNG).'))); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      const jpeg = (skala, mutu) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * skala));
        c.height = Math.max(1, Math.round(h * skala));
        const ctx = c.getContext('2d');
        // Screenshot PNG transparan: tanpa latar putih, bagian transparan jadi hitam di JPEG dan teksnya hilang.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', mutu);
      };
      const skalaPiksel = batas => Math.min(1, Math.sqrt(batas / (w * h)), SISI_MAKS / Math.max(w, h));
      ok({
        base64: jpeg(skalaPiksel(PIKSEL_BACA), 0.88).split(',')[1],
        arsip: jpeg(skalaPiksel(PIKSEL_ARSIP), 0.8).split(',')[1],
        lampiran: jpeg(skalaPiksel(PIKSEL_LAMPIRAN), 0.72).split(',')[1],
        thumb: jpeg(Math.min(1, 120 / Math.max(w, h)), 0.7),
      });
    };
    img.src = url;
  });
}

/** otomatis: begitu terbaca, kartu konfirmasi langsung muncul (kalau pengguna tidak sedang membuka form lain). */
function mulaiStruk(file, dariForm, otomatis) {
  const job = { id: ++nomorStruk, file, status: 'proses', thumb: '', hasil: null, pesan: '', otomatis: !!otomatis };
  ANTRIAN.push(job);
  if (dariForm && F && $('#form-trx')) {
    bacaFieldTrx();
    F.strukJob = job.id;
    renderFormTrx();
  } else {
    toast(T('🧾 Struk sedang dibaca. Silakan lanjut pakai aplikasi.'));
  }
  jalankanStruk(job);
}

async function jalankanStruk(job) {
  job.status = 'proses';
  job.pesan = '';
  job.ulangOtomatis = '';
  job.mulai = Date.now();
  renderAntrian();
  try {
    if (!navigator.onLine) throw new Error(T('Tidak ada sinyal.'));
    tulisTahap(job, T('Menyiapkan foto…'));
    const g = await kecilkanGambar(job.file);
    job.thumb = g.thumb;
    job.base64 = g.lampiran; // versi kecil yang disimpan sebagai lampiran transaksi
    renderAntrian();
    // AI cukup versi ~2 MP (sama dengan lampiran) supaya unggahan dari HP kecil; OCR Drive tetap memakai versi tajam.
    job.hasil = await api('bacaStruk', g.base64, 'image/jpeg', { base64Ai: g.arsip, kabar: t => tulisTahap(job, t) });
    if (!ANTRIAN.includes(job)) return; // sudah dibuang pengguna
    job.status = 'siap';
    const kartuBebas = !$('#ringkas-suara') || $('#ringkas-suara').hidden;
    if (formMenungguStruk(job)) {
      terapkanStruk(job);
      hapusJob(job.id);
      if (kartuBebas) { tampilRingkasanStruk(); getar(); }
      else toast(T('Struk terbaca ✔ Cek sekilas sebelum disimpan.'));
    } else if (job.otomatis && kartuBebas && $('#sheet').hidden && $('#kunci').hidden && !kilas) {
      // Foto dari Beranda dan pengguna tidak sedang membuka apa-apa: langsung tampilkan konfirmasinya.
      bukaFormTrx(null, null, T('Tinjau Struk'));
      terapkanStruk(job);
      tampilRingkasanStruk();
      getar();
    } else {
      getar();
      toast(T('🧾 Struk siap ditinjau: {jumlah}', { jumlah: rp(job.hasil.jumlah) }));
    }
  } catch (e) {
    if (!ANTRIAN.includes(job)) return;
    job.status = 'gagal';
    job.pesan = pesanError(e);
    // Gagal karena sesi login / sinyal: dibaca ulang otomatis begitu tersambung (lihat ulangiStrukTertunda).
    if (e instanceof GOOGLE.PerluMasuk) job.ulangOtomatis = 'sesi';
    else if (e.jaringan || !navigator.onLine) job.ulangOtomatis = 'sinyal';
    if (job.ulangOtomatis) job.pesan = job.ulangOtomatis === 'sesi' ? T('Sesi login berakhir. Dibaca ulang otomatis setelah tersambung.') : T('Tidak ada sinyal. Dibaca ulang otomatis begitu online.');
    if (formMenungguStruk(job)) {
      F.strukJob = null;
      renderFormTrx();
      toast(T('Struk gagal dibaca: {pesan}', { pesan: job.pesan }), true);
    }
  }
  renderAntrian();
}

const formMenungguStruk = job => !!(F && F.strukJob === job.id && $('#form-trx'));

/** Tahap baca struk ("Mengunggah foto… 40%", "AI membaca struk…") di antrian & form, tanpa menggambar ulang form. */
function tulisTahap(job, teks) {
  job.tahap = teks;
  document.querySelectorAll(`[data-tahap="${job.id}"]`).forEach(el => { el.textContent = teks; });
}

/**
 * Menyimpan transaksi berfoto di latar belakang (unggah foto ke Drive bisa lama). Form langsung ditutup,
 * kemajuannya tampil di antrian bawah. Gagal → form dibuka lagi lengkap dengan isian & pesan errornya;
 * kalau pengguna sedang membuka form lain, cukup tombol "Buka" di antrian supaya isiannya tidak tertimpa.
 */
function simpanDiLatar(t, pesan) {
  const job = { id: ++nomorStruk, jenis: 'simpan', status: 'proses', t, thumb: t.lampiranThumb || '', pesan: '', mulai: Date.now() };
  ANTRIAN.push(job);
  // Hasil struk asalnya dibuang dari antrian (isinya sudah ada di t), supaya "Tinjau" tidak bisa mencatat dobel.
  if (t.dariJob) hapusJob(t.dariJob);
  tutupSheet();
  renderAntrian();
  toast(T('⏳ Menyimpan di latar belakang. Silakan lanjut pakai aplikasi.'));
  (async () => {
    try {
      const idTrx = await api('simpanTransaksi', t);
      FOTO_TRX[idTrx || t.id] = 'data:image/jpeg;base64,' + t.lampiranData;
      hapusJob(job.id);
      await muat(); // data baru dulu, supaya pesan sisa anggaran menghitung transaksi ini
      if (typeof pesan === 'function') pesan(idTrx); else toast(pesan);
    } catch (e) {
      if (!ANTRIAN.includes(job)) return;
      // Sinyal putus saat mencatat transaksi baru: masuk antrean tertunda seperti biasa (tanpa foto).
      if (!t.id && e.jaringan) {
        hapusJob(job.id);
        simpanTertunda(t, true);
        return;
      }
      job.status = 'gagal';
      job.pesan = pesanError(e);
      renderAntrian();
      if ($('#sheet').hidden && $('#kunci').hidden) bukaLagiSimpan(job);
      else toast(T('Gagal menyimpan {jumlah}: {pesan} Ketuk "Buka" di bawah layar.', { jumlah: rp(t.jumlah), pesan: job.pesan }), true);
    }
  })();
}

/** Membuka lagi form transaksi yang gagal disimpan di latar belakang, beserta pesan errornya. */
function bukaLagiSimpan(job) {
  hapusJob(job.id);
  F = Object.assign(job.t, { galatSimpan: job.pesan });
  bukaSheet(F.id ? T('Ubah Transaksi') : T('Catat Transaksi'), '<div id="form-trx"></div>');
  renderFormTrx();
  toast(T('Gagal menyimpan: {pesan}', { pesan: job.pesan }), true);
}

/** Struk yang gagal karena sesi login / sinyal dibaca ulang. jenis: 'sesi' | 'sinyal'. */
function ulangiStrukTertunda(jenis) {
  ANTRIAN.filter(j => j.status === 'gagal' && j.ulangOtomatis === jenis).forEach(jalankanStruk);
}

/** Lama membaca ("12 dtk") di antrian & form, supaya pengguna tahu prosesnya masih berjalan. */
setInterval(() => {
  document.querySelectorAll('[data-detik]').forEach(el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.detik));
    if (job && job.mulai) el.textContent = T('{n} dtk', { n: Math.round((Date.now() - job.mulai) / 1000) });
  });
}, 1000);

/** Mengisi form transaksi yang sedang terbuka dengan hasil struk. */
function terapkanStruk(job) {
  bacaFieldTrx();
  const h = job.hasil;
  F.tipe = TIPE.KELUAR;
  F.jumlah = h.jumlah;
  if (h.tanggal) F.tanggal = h.tanggal;
  if (h.kategori) F.kategori = h.kategori;
  if (h.catatan) F.catatan = h.catatan;
  F.struk = h;
  if (job.base64) { F.lampiranData = job.base64; F.lampiranThumb = job.thumb; }
  F.strukJob = null;
  F.dariJob = job.id; // dihapus dari antrian setelah transaksinya disimpan
  renderFormTrx();
}

function hapusJob(id) {
  const i = ANTRIAN.findIndex(j => j.id === Number(id));
  if (i >= 0) ANTRIAN.splice(i, 1);
  renderAntrian();
}

function getar() {
  try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* abaikan */ }
}

function renderAntrian() {
  const el = $('#antrian');
  el.hidden = !ANTRIAN.length;
  document.body.classList.toggle('ada-antrian', ANTRIAN.length > 0);
  el.innerHTML = ANTRIAN.map(j => {
    const gambar = j.thumb ? `<img src="${j.thumb}" alt="">` : '<span class="antrian-ikon">🧾</span>';
    let isi, aksi;
    if (j.jenis === 'simpan') {
      const judul = rp(j.t.jumlah) + (j.t.kategori ? ' · ' + esc(namaT(j.t.kategori)) : '');
      if (j.status === 'proses') {
        isi = `<b>${T('Menyimpan {judul}', { judul })} <span class="detik" data-detik="${j.id}"></span></b><small>${T('Foto sedang diunggah · boleh lanjut pakai aplikasi')}</small>`;
        aksi = `<span class="spinner kecil" aria-label="${T('Sedang menyimpan')}"></span>`;
      } else {
        isi = `<b>❌ ${T('Gagal menyimpan {judul}', { judul })}</b><small>${esc(j.pesan)}</small>`;
        aksi = `<button type="button" class="btn btn-utama kecil" data-aksi="buka-simpan" data-id="${j.id}">${T('Buka')}</button>`;
      }
    } else if (j.status === 'proses') {
      isi = `<b>${T('Membaca struk…')} <span class="detik" data-detik="${j.id}"></span></b><small><span data-tahap="${j.id}">${esc(j.tahap || '')}</span> · ${T('boleh lanjut pakai aplikasi')}</small>`;
      aksi = `<span class="spinner kecil" aria-label="${T('Sedang memproses')}"></span>`;
    } else if (j.status === 'siap') {
      isi = `<b>✅ ${T('Struk siap · {jumlah}', { jumlah: rp(j.hasil.jumlah) })}</b><small>${esc(j.hasil.catatan || namaT(j.hasil.kategori) || T('Ketuk Tinjau untuk menyimpan'))}</small>`;
      aksi = `<button type="button" class="btn btn-utama kecil" data-aksi="tinjau-struk" data-id="${j.id}">${T('Tinjau')}</button>`;
    } else {
      isi = `<b>❌ ${T('Gagal dibaca')}</b><small>${esc(j.pesan)}</small>`;
      aksi = `<button type="button" class="btn btn-hapus kecil" data-aksi="ulangi-struk" data-id="${j.id}">${T('Ulangi')}</button>`;
    }
    const tutup = j.status === 'proses' ? '' : `<button type="button" class="antrian-tutup" data-aksi="buang-struk" data-id="${j.id}" aria-label="${T('Buang')}">✕</button>`;
    return `<div class="antrian-item ${j.status}" role="status">${gambar}<span class="isi">${isi}</span>${aksi}${tutup}</div>`;
  }).join('');
}

/** Ringkasan hasil baca struk tanpa istilah teknis; kalau totalnya beda-beda, tampilkan pilihan. */
function infoStruk(h) {
  const pilihan = h.pilihanJumlah.length > 1 ? `
    <p class="label" style="margin:0 0 6px">${T('Ketuk total yang sesuai struk:')}</p>
    <div class="chips" style="margin-bottom:6px">${h.pilihanJumlah.map(p =>
      `<button type="button" class="chip ${p.jumlah === F.jumlah ? 'aktif' : ''}" data-aksi="f-pilih-jumlah" data-jumlah="${p.jumlah}">${rp(p.jumlah)}</button>`).join('')}</div>` : '';
  const kembar = teksStrukKembar();
  const peringatan = kembar ? `<p class="info-kecil peringatan-kembar">${kembar}</p>` : '';
  return `<div style="margin:-8px 0 16px">${pilihan}<p class="info-kecil" style="text-align:left;margin-top:0">${statusStruk(h)}</p>${peringatan}${tombolPecahStruk(h)}</div>`;
}

function statusStruk(h) {
  return h.yakin ? T('✅ Yakin, totalnya terbaca sama beberapa kali.')
    : h.pilihanJumlah.length > 1 ? T('⚠️ Hasil baca berbeda-beda. Cocokkan dengan struk.')
    : T('🔍 Cocokkan sekilas totalnya dengan struk.');
}

/** Peringatan kalau sudah ada pengeluaran dengan nominal & tanggal yang sama (struk mungkin sudah pernah dicatat). */
function teksStrukKembar() {
  const kembar = !F.id && S.data && (S.data.transaksi || []).find(t =>
    t.tipe === TIPE.KELUAR && t.jumlah === F.jumlah && t.tanggal === F.tanggal);
  return kembar ? T('⚠️ Sudah ada {kategori} {jumlah} di tanggal yang sama{catatan}. Pastikan struk ini belum pernah dicatat.', {
    kategori: esc(namaT(kembar.kategori)), jumlah: rp(kembar.jumlah), catatan: kembar.catatan ? ' (' + esc(kembar.catatan) + ')' : '' }) : '';
}

/** Tombol "Pecah jadi N transaksi" kalau struk berisi beberapa kategori yang jumlahnya pas dengan total. */
function tombolPecahStruk(h) {
  return (h.rincian || []).length >= 2 && h.rincian.reduce((a, x) => a + x.jumlah, 0) === F.jumlah && !F.id ? `
    <button type="button" class="tombol-pecah" data-aksi="pecah-struk">
      <span class="ikon-pecah">🧩</span>
      <span class="isi"><b>${T('Pecah jadi {n} transaksi per kategori', { n: h.rincian.length })}</b>
        <small>${h.rincian.map(x => esc(namaT(x.kategori)) + ' ' + rpPendek(x.jumlah)).join(' · ')}</small></span>
      <span class="panah">${svg('maju')}</span>
    </button>` : '';
}

/**
 * kode: kode penautan yang baru dibuat, ditampilkan beserta tombol pembuka Telegram.
 * muatan: isi /start untuk bot (bot bersama: "<ID spreadsheet>_<kode>", supaya bot tahu spreadsheet-nya).
 */
function bukaFormTelegram(kode, muatan = kode) {
  const t = S.data.telegram;
  bukaSheet(T('Bot Telegram'), `
    ${t.bot ? `<a class="baris" href="https://t.me/${esc(t.bot)}" target="_blank" rel="noopener">
      <span class="ikon-bulat">🤖</span>
      <span class="isi"><b>@${esc(t.bot)}</b><small>${T('Buka di Telegram')}</small></span>
      <span class="panah">${svg('maju')}</span>
    </a>` : ''}
    ${kode ? `
      <div class="kartu" style="margin:14px 0;text-align:center;background:var(--primary-soft);border:0">
        <small class="label" style="margin:0">${T('Kode penautan · berlaku 15 menit')}</small>
        <div style="font-size:30px;font-weight:800;letter-spacing:.2em;margin:6px 0 12px">${esc(kode)}</div>
        ${t.bot ? `<a class="btn btn-utama" style="display:block;text-decoration:none" href="https://t.me/${esc(t.bot)}?start=${esc(muatan)}" target="_blank" rel="noopener">${T('Buka Telegram & hubungkan')}</a>` : ''}
        <p class="info-kecil" style="margin-bottom:0;word-break:break-all">${t.bot
          ? T('Atau kirim <b>{perintah}</b> ke bot.', { perintah: '/hubungkan ' + esc(muatan) })
          : T('Kirim <b>{perintah}</b> ke bot.', { perintah: '/hubungkan ' + esc(muatan) })}</p>
      </div>` : ''}
    ${t.pengguna.length ? `<button type="button" class="baris" data-aksi="pengingat-telegram" role="switch" aria-checked="${t.pengingat !== false}">
      <span class="ikon-bulat">🔔</span>
      <span class="isi"><b>${T('Pengingat harian')}</b><small>${T('Tiap pagi ± jam 6: catatan berpengingat & tagihan yang jatuh tempo')}</small></span>
      <span class="saklar ${t.pengingat !== false ? 'nyala' : ''}" aria-hidden="true"></span>
    </button>
    <button type="button" class="baris" data-aksi="rekap-telegram" role="switch" aria-checked="${t.rekap !== false}">
      <span class="ikon-bulat">📊</span>
      <span class="isi"><b>${T('Rekap bulanan')}</b><small>${T('Di awal periode: pemasukan, pengeluaran & kategori terbesar bulan lalu')}</small></span>
      <span class="saklar ${t.rekap !== false ? 'nyala' : ''}" aria-hidden="true"></span>
    </button>` : ''}
    <span class="label" style="margin-top:14px">${T('Akun terhubung ({n})', { n: t.pengguna.length })}</span>
    ${t.pengguna.map(p => `
      <div class="baris">
        <span class="ikon-bulat">👤</span>
        <span class="isi"><b>${esc(p.nama)}</b><small>${esc(p.email)}${p.username ? ' · @' + esc(p.username) : ''}</small></span>
        <button type="button" class="tombol-ikon" data-aksi="putus-telegram" data-id="${esc(p.id)}" aria-label="${T('Putuskan {nama}', { nama: esc(p.nama) })}">✕</button>
      </div>`).join('') || `<p class="info-kecil" style="text-align:left;margin-top:0">${T('Belum ada.')}</p>`}
    ${kode ? '' : `<div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="kode-telegram">${T('Hubungkan akun Telegram saya')}</button></div>`}
    ${t.bersama ? `<p class="info-kecil" style="text-align:left">🔐 ${t.pengguna.length
      ? T('Buku ini dibagikan ke akun bot selama masih ada akun Telegram yang terhubung. Putuskan semua akun untuk mencabutnya.')
      : T('Saat menghubungkan, buku ini dibagikan ke akun bot supaya bot bisa mencatat.')}</p>` : ''}
    <details class="tabel-data">
      <summary>${T('Contoh pesan ke bot')}</summary>
      <ul class="panduan" style="padding-left:20px">
        <li><i>makan bakso 25rb</i></li>
        <li><i>bensin 30rb pakai gopay, parkir 5rb</i></li>
        <li><i>gaji masuk 8jt ke rekening bank</i></li>
        <li><i>setor dana darurat 500rb</i></li>
        <li><i>yang terakhir ubah jadi 30rb</i></li>
        <li><i>pengeluaran bulan ini berapa?</i></li>
        <li>${T('kirim foto struk 📸')}</li>
      </ul>
    </details>`);
}

/** Cukup satu kunci. Kunci cadangan (dipakai bergiliran saat kuota habis) disembunyikan di bagian lipat. */
function bukaFormGemini() {
  const daftar = S.data.kunciGemini;
  const isian = (label, tombol) => `
    <div class="grup-form">
      <label class="label" for="g-kunci">${label}</label>
      <input class="field" id="g-kunci" type="password" autocomplete="off" placeholder="AIza…">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-gemini">${tombol}</button></div>`;
  bukaSheet(T('Baca Struk Lebih Akurat'), `
    <p style="margin-top:0">${T('Foto struk <b>tetap bisa dibaca tanpa pengaturan apa pun</b>. Dengan kunci Gemini (AI dari Google, gratis), hasilnya jauh lebih akurat, termasuk kategori dan catatan.')}</p>
    ${daftar.length ? `
      <div style="margin-bottom:12px">${daftar.map((k, i) => `
        <div class="baris">
          <span class="ikon-bulat">🔑</span>
          <span class="isi"><b>${i ? T('Kunci cadangan {n}', { n: i }) : T('✅ Kunci aktif')}</b><small>${esc(k)}</small></span>
          <button type="button" class="tombol-ikon" data-aksi="hapus-gemini" data-kunci="${esc(k)}" aria-label="${T('Hapus kunci {n}', { n: i + 1 })}">🗑️</button>
        </div>`).join('')}</div>
      <details class="tabel-data">
        <summary>${T('Tambah kunci cadangan')}</summary>
        <p class="info-kecil" style="text-align:left">${T('Kalau kuota harian satu kunci habis, aplikasi otomatis memakai kunci berikutnya.')}</p>
        ${isian(T('Kunci cadangan'), T('Tambah'))}
      </details>` : `
      <ol class="panduan" style="padding-left:20px;margin-bottom:16px">
        <li>${T('Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> dan masuk dengan akun Google.')}</li>
        <li>${T('Klik <b>Create API key</b>, lalu salin kuncinya.')}</li>
        <li>${T('Tempel di bawah, lalu ketuk Simpan.')}</li>
      </ol>
      ${isian(T('Kunci Gemini'), T('Simpan'))}`}
    <p class="info-kecil" style="text-align:left">${T('Kunci disimpan di spreadsheet keluarga, jadi otomatis dipakai semua anggota, dan <b>bisa dilihat semua anggota</b> yang membuka spreadsheet. Pakai kunci gratis khusus untuk aplikasi ini, jangan kunci yang terhubung ke penagihan (billing).')}</p>`);
}

// ---------- Form dompet ----------

/** Form dompet biasa maupun tabungan (jenis diambil dari w, atau dari parameter untuk yang baru). */
function bukaFormDompet(w, jenis) {
  jenis = w ? w.jenis : jenis || JENIS.DOMPET;
  if (jenis === JENIS.UTANG) {
    // Orang utang-piutang: jumlahnya hanya berubah lewat transaksi, jadi yang bisa diubah cuma nama & jatuh tempo.
    F = { namaLama: w.nama, ikon: w.ikon, jenis, saldoAwal: w.saldoAwal, mutasi: 0, saldoTampil: '' };
    return bukaSheet(T('Ubah {nama}', { nama: w.nama }), `
      <div class="grup-form">
        <label class="label" for="d-nama">${T('Nama orang')}</label>
        <input class="field" id="d-nama" maxlength="40" value="${esc(w.nama)}">
      </div>
      <div class="grup-form">
        <label class="label" for="d-tenggat">${T('Jatuh tempo (opsional)')}</label>
        <input class="field" id="d-tenggat" type="date" value="${esc(w.tenggat)}">
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-hapus" data-aksi="hapus-dompet">${T('Hapus')}</button>
        <button type="button" class="btn btn-utama" data-aksi="simpan-dompet">${T('Simpan')}</button>
      </div>
      <p class="info-kecil">${T('Hanya bisa dihapus kalau belum ada transaksinya.')}</p>`);
  }
  const tab = jenis === JENIS.TABUNGAN;
  const aset = jenis === JENIS.ASET;
  const labelNama = tab ? T('Nama tabungan') : aset ? T('Nama aset') : T('Nama dompet');
  const saldoTampil = formatAngka(w ? Math.max(0, w.saldo) : 0);
  F = {
    namaLama: w ? w.nama : '', ikon: w ? w.ikon : (tab ? '🐷' : aset ? '💎' : '👛'), jenis,
    saldoAwal: w ? w.saldoAwal : 0, mutasi: w ? w.saldo - w.saldoAwal : 0, saldoTampil,
  };
  const ket = aset
    ? T('Perkiraan nilai jual saat ini. Perbarui sesekali (mis. ikuti harga emas atau nilai reksadana); riwayat transaksi tidak berubah.')
    : !w
      ? (tab ? T('Jumlah yang sudah terkumpul sebelum dicatat di aplikasi ini.') : T('Saldo saat Anda mulai mencatat di aplikasi ini.'))
      : tab ? T('Tidak sama dengan jumlah sebenarnya? Ganti dengan angka sebenarnya, saldo akan disesuaikan tanpa mengubah riwayat transaksi.')
        : T('Tidak sama dengan saldo di rekening/dompet asli? Ganti dengan angka sebenarnya, saldo akan disesuaikan tanpa mengubah riwayat transaksi.');
  const judul = w
    ? (tab ? T('Ubah Tabungan') : aset ? T('Ubah Aset') : T('Ubah Dompet'))
    : (tab ? T('Tambah Tabungan') : aset ? T('Tambah Aset') : T('Tambah Dompet'));
  bukaSheet(judul, `
    ${tab && !w ? chipTemplat(TEMPLAT_TABUNGAN, 'templat-tabungan') : ''}
    <div class="grup-form">
      <label class="label" for="d-nama">${labelNama}</label>
      <input class="field" id="d-nama" maxlength="40" placeholder="${tab ? T('mis. Dana Darurat, Liburan, Umroh') : aset ? T('mis. Emas 10 gram, Reksadana, Motor') : T('mis. BCA, GoPay, Celengan')}" value="${esc(w ? w.nama : '')}">
    </div>
    <div class="grup-form">
      <label class="label" for="d-saldo">${tab ? T('Terkumpul sekarang') : aset ? T('Nilai sekarang') : T('Saldo sekarang')}</label>
      <input class="field" id="d-saldo" inputmode="numeric" placeholder="0" value="${saldoTampil}">
      <p class="info-kecil" style="text-align:left">${ket}</p>
    </div>
    ${tab ? `
      <div class="grup-form">
        <label class="label" for="d-target">${T('Target (opsional)')}</label>
        <input class="field" id="d-target" inputmode="numeric" placeholder="${T('Tanpa batas')}" value="${formatAngka(w && w.target)}">
        <p class="info-kecil" style="text-align:left">${T('Kosongkan untuk tabungan tanpa batas.')}</p>
      </div>
      <div class="grup-form">
        <label class="label" for="d-tenggat">${T('Ingin tercapai pada (opsional)')}</label>
        <input class="field" id="d-tenggat" type="date" value="${esc(w ? w.tenggat : '')}">
      </div>` : ''}
    <div class="grup-form"><span class="label">${T('Ikon')}</span>${gridIkon(F.ikon)}</div>
    <div class="aksi-form">
      ${w ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-dompet">${T('Hapus')}</button>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-dompet">${T('Simpan')}</button>
    </div>`);
}

/** Perkiraan kapan target tercapai dari rata-rata setoran 3 bulan terakhir. */
function perkiraanTabungan(w) {
  if (!w.target || w.saldo >= w.target) return '';
  const rata = (S.data.setoranTabungan || {})[w.nama] || 0;
  const sisa = w.target - w.saldo;
  if (rata <= 0) return `<div class="perkiraan-tabungan">🔮 ${T('Belum ada setoran rutin 3 bulan terakhir. Setor sedikit tiap bulan supaya bisa diperkirakan.')}</div>`;
  const bulan = Math.ceil(sisa / rata);
  const d = new Date();
  d.setMonth(d.getMonth() + bulan);
  const kapan = d.toLocaleDateString(LOKAL, { month: 'long', year: 'numeric' });
  const telat = w.tenggat && d.toISOString().slice(0, 10) > w.tenggat;
  return `<div class="perkiraan-tabungan ${telat ? 'telat' : ''}">🔮 ${T('Dengan rata-rata setoran <b>{jumlah}/bulan</b>, target tercapai sekitar <b>{kapan}</b>', { jumlah: rp(rata), kapan })} ${bulan <= 1 ? T('(bulan depan!)') : T('({n} bulan lagi)', { n: bulan })}.${telat ? ' ⚠️ ' + T('Lewat tenggat, perlu setoran lebih besar.') : ''}</div>`;
}

/** Sekali per tabungan: perayaan saat target tercapai. */
function rayakanTabungan(w) {
  if (!w.target || w.saldo < w.target) return;
  const kunci = 'dk_tercapai_' + (S.data.spreadsheetId || '') + '_' + w.nama;
  if (bacaHp(kunci)) return;
  tulisHp(kunci, '1');
  const el = document.createElement('div');
  el.className = 'konfeti';
  el.innerHTML = Array.from({ length: 28 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}%;--t:${(Math.random() * .6).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg">${['🎉', '✨', '💰', '🎊', '⭐'][i % 5]}</i>`).join('');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
  getar();
  toast(T('🎉 Selamat! Target {nama} tercapai!', { nama: namaT(w.nama) }));
}

function bukaTabungan(w) {
  const p = progresTabungan(w);
  setTimeout(() => rayakanTabungan(w), 400);
  bukaSheet(namaT(w.nama), `
    <div class="ringkas-tabungan">
      <span class="ikon-bulat">${ilus(w.ikon)}</span>
      <div><small>${T('Terkumpul')}</small><b>${rp(w.saldo)}</b></div>
    </div>
    ${p.persen !== null ? `<span class="meter" role="meter" aria-label="${esc(w.nama)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.persen}"><i style="width:${p.persen}%"></i></span>` : ''}
    <p class="info-kecil" style="text-align:left;margin:8px 0 ${perkiraanTabungan(w) ? '8px' : '16px'}">${esc(p.teks)}</p>
    ${perkiraanTabungan(w)}
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="tarik-tabungan" data-nama="${esc(w.nama)}">${T('Tarik')}</button>
      <button type="button" class="btn btn-utama" data-aksi="setor-tabungan" data-nama="${esc(w.nama)}">${T('Setor')}</button>
    </div>
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">✏️ ${T('Ubah tabungan')}</button>`);
}

/**
 * Saran anggaran per kategori dari 3 periode terakhir (sebelum periode berjalan): rata-rata × 95%, dibulatkan
 * (kelipatan 50rb kalau ≥ 500rb, selain itu 10rb). Hanya kategori yang terpakai ≥ 2 dari 3 periode.
 */
function saranAnggaran() {
  const per = [];
  let k = periodeSekarang();
  for (let i = 0; i < 3; i++) { k = bulanSebelum(k); per.push(ringkasBulan(k)); }
  const hasil = {};
  S.data.kategori.filter(x => x.tipe === TIPE.KELUAR).forEach(x => {
    const nilai = per.map(r => r.kategori[x.nama] || 0);
    if (nilai.filter(Boolean).length < 2) return;
    const rata = nilai.reduce((a, b) => a + b, 0) / 3;
    const kelipatan = rata >= 500000 ? 50000 : 10000;
    const batas = Math.max(kelipatan, Math.round(rata * 0.95 / kelipatan) * kelipatan);
    hasil[x.nama] = { rata: Math.round(rata), batas };
  });
  return hasil;
}

function bukaFormAnggaran() {
  const daftar = S.data.kategori.filter(k => k.tipe === TIPE.KELUAR);
  const saran = saranAnggaran();
  bukaSheet(T('Anggaran Bulanan'), `
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">${T('Batas belanja per kategori setiap bulan. Kosongkan kategori yang tidak perlu dibatasi.')}
      ${T('Centang <b>📨 Amplop</b> supaya sisa bulan ini menambah anggaran bulan depan (dan kelebihan menguranginya).')}</p>
    ${Object.keys(saran).length ? `<button type="button" class="tombol-pecah" data-aksi="isi-saran-anggaran" style="margin:0 0 12px">
      <span class="ikon-pecah">✨</span><span class="isi"><b>${T('Isi otomatis dari kebiasaan belanja')}</b>
      <small>${T('Berdasarkan rata-rata 3 bulan terakhir · {n} kategori', { n: Object.keys(saran).length })}</small></span></button>` : ''}
    ${daftar.map(k => `
      <div class="baris baris-input">
        <span class="ikon-bulat">${ilus(k.ikon)}</span>
        <span class="isi"><b>${esc(namaT(k.nama))}</b>
          ${saran[k.nama] ? `<button type="button" class="saran-anggaran" data-aksi="pakai-saran-anggaran" data-nama="${esc(k.nama)}" data-n="${saran[k.nama].batas}" title="${T('Rata-rata 3 bulan: {jumlah}', { jumlah: rp(saran[k.nama].rata) })}">💡 ${T('Saran {jumlah}', { jumlah: rpPendek(saran[k.nama].batas) })}</button>` : ''}
          <label class="amplop"><input type="checkbox" class="input-amplop" data-nama="${esc(k.nama)}" ${k.bawaSisa ? 'checked' : ''}> 📨 ${T('Amplop')}</label></span>
        <input class="field input-rp input-anggaran" data-nama="${esc(k.nama)}" inputmode="numeric" placeholder="${T('Tanpa batas')}" aria-label="${T('Anggaran {nama}', { nama: esc(namaT(k.nama)) })}" value="${formatAngka(k.anggaran)}">
      </div>`).join('')}
    <p class="info-kecil" id="total-anggaran"></p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-anggaran">${T('Simpan')}</button></div>`);
  hitungTotalAnggaran();
}

function hitungTotalAnggaran() {
  const total = Array.from(document.querySelectorAll('.input-anggaran')).reduce((a, el) => a + angka(el.value), 0);
  $('#total-anggaran').textContent = T('Total anggaran per bulan: {jumlah}', { jumlah: rp(total) });
}

// ---------- Kelola kategori ----------

function bukaDaftarKategori(tipe) {
  tipe = tipe || TIPE.KELUAR;
  const daftar = S.data.kategori.filter(k => k.tipe === tipe);
  bukaSheet(T('Kelola Kategori'), `
    <div class="segmen">
      ${[TIPE.KELUAR, TIPE.MASUK].map(t =>
        `<button type="button" class="${t === tipe ? 'aktif' : ''}" data-aksi="daftar-kategori" data-tipe="${t}">${namaT(t)}</button>`).join('')}
    </div>
    ${daftar.map(k => `
      <button class="baris" data-aksi="edit-kategori" data-nama="${esc(k.nama)}" data-tipe="${esc(k.tipe)}">
        <span class="ikon-bulat">${ilus(k.ikon)}</span>
        <span class="isi"><b>${esc(namaT(k.nama))}</b></span>
        <span class="panah">${svg('maju')}</span>
      </button>`).join('')}
    <button class="tombol-tambah" data-aksi="tambah-kategori" data-tipe="${tipe}">＋ ${tipe === TIPE.MASUK ? T('Tambah kategori pemasukan') : T('Tambah kategori pengeluaran')}</button>`);
}

function bukaFormKategori(k, tipe) {
  F = { namaLama: k ? k.nama : '', tipeLama: k ? k.tipe : tipe, tipe: k ? k.tipe : tipe, ikon: k ? k.ikon : '🏷️' };
  bukaSheet(k ? T('Ubah Kategori') : T('Tambah Kategori'), `
    <div class="grup-form">
      <label class="label" for="k-nama">${F.tipe === TIPE.MASUK ? T('Nama kategori pemasukan') : T('Nama kategori pengeluaran')}</label>
      <input class="field" id="k-nama" maxlength="40" placeholder="${T('mis. Jajan Anak')}" value="${esc(k ? k.nama : '')}">
    </div>
    <div class="grup-form"><span class="label">${T('Ikon')}</span>${gridIkon(F.ikon)}</div>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="daftar-kategori" data-tipe="${esc(F.tipe)}">${T('Kembali')}</button>
      ${k ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-kategori">${T('Hapus')}</button>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-kategori">${T('Simpan')}</button>
    </div>`);
}

// ---------- Aksi (event delegation) ----------

const AKSI = {
  'tab': el => { S.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  'bulan': async el => {
    const d = keTanggal(S.bulan);
    d.setMonth(d.getMonth() + Number(el.dataset.geser));
    S.bulan = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    loading(true);
    await muat();
    loading(false);
  },
  'filter-tipe': el => { S.filterTipe = el.dataset.tipe; render(); },

  'tambah-trx': () => {
    const draf = bacaDrafTrx();
    tulisHp(kunciDrafTrx(), null);
    bukaFormTrx(null, draf || undefined);
    if (draf) toast(T('📝 Isian tadi dipulihkan') + (draf.jumlah ? ' · ' + rp(draf.jumlah) : ''), false, { label: T('Mulai baru'), aksi: 'buang-draf-trx' });
  },
  'buang-draf-trx': () => { $('#toast').hidden = true; tulisHp(kunciDrafTrx(), null); F = null; bukaFormTrx(null); },
  'buang-draf-catatan': () => {
    $('#toast').hidden = true;
    if (!S.formCatatan) return;
    buangDrafCatatan(S.formCatatan.id);
    const c = S.formCatatan.id ? daftarCatatan().find(x => x.id === S.formCatatan.id) : null;
    bukaFormCatatan(c || null, S.formCatatan.tanggal);
  },
  'keluar-catatan': () => { tinggalkanFormCatatan(); bukaKalender(S.formCatatan && S.formCatatan.tanggal); },
  'lanjut-draf-catatan': () => {
    $('#toast').hidden = true;
    const d = S.drafTerakhir || {};
    const c = d.id ? daftarCatatan().find(x => x.id === d.id) : null;
    bukaFormCatatan(c || null, d.tanggal);
  },
  // #1 Sekali ketuk
  'ketuk-catat': el => catatSekaliKetuk(el),
  'urungkan-ketuk': el => {
    const id = trxSekaliKetuk;
    trxSekaliKetuk = null;
    $('#toast').hidden = true;
    if (id) kirim(el, 'hapusTransaksi', [id], T('Dibatalkan ↩️'));
  },
  // #2 Item belanja dicentang → form pengeluaran terisi
  'tugas-jadi-trx': () => {
    $('#toast').hidden = true;
    const teks = tugasUntukTrx;
    if (!teks) return;
    bukaFormTrx(null, { tipe: TIPE.KELUAR, catatan: teks, kategori: tebakKategori(TIPE.KELUAR, teks) }, T('Catat belanja'));
    setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 250);
  },
  'edit-trx': el => bukaFormTrx(S.data.transaksi.concat((S.cariData && S.cariData.transaksi) || [], S.hasilGlobal || []).find(t => t.id === el.dataset.id)),
  'buka-filter': () => bukaFilter(),
  'pilih-rentang': el => {
    F.rentang = el.dataset.k;
    el.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('aktif', b === el));
    $('#filter-kustom').hidden = F.rentang !== 'kustom';
  },
  'terapkan-filter': () => {
    const nilai = id => ($(id) ? $(id).value : '');
    const f = {
      rentang: F.rentang, dari: nilai('#fl-dari'), sampai: nilai('#fl-sampai'),
      kategori: nilai('#fl-kategori'), dompet: nilai('#fl-dompet'), oleh: nilai('#fl-oleh'),
    };
    if (f.rentang === 'kustom' && !f.dari && !f.sampai) return toast(T('Isi tanggal dari atau sampai.'), true);
    if (f.dari && f.sampai && f.dari > f.sampai) return toast(T('Tanggal "dari" harus sebelum "sampai".'), true);
    S.filter = f;
    S.batasRiwayat = 200;
    tutupSheet();
    render();
  },
  'reset-filter': () => { S.filter = Object.assign({}, FILTER_KOSONG); S.batasRiwayat = 200; tutupSheet(); render(); },
  'hapus-filter': el => {
    S.filter = Object.assign({}, S.filter, el.dataset.k === 'rentang' ? { rentang: 'periode' } : { [el.dataset.k]: '' });
    render();
  },
  'riwayat-lagi': () => { S.batasRiwayat += 200; render(); },
  'tutup-sheet': () => tutupSheet(),
  'f-tipe': el => {
    bacaFieldTrx();
    if (F.tipe !== el.dataset.tipe) { F.tipe = el.dataset.tipe; F.kategori = ''; }
    renderFormTrx();
  },
  'foto-struk': el => {
    // Tanpa kunci Gemini, struk tetap dibaca dengan OCR saja.
    bacaFieldTrx();
    sumberStruk = 'form';
    $(el.dataset.kamera ? '#input-struk-kamera' : '#input-struk').click();
  },
  'tinjau-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (!job || job.status !== 'siap') return;
    bukaFormTrx(null, null, T('Tinjau Struk'));
    terapkanStruk(job);
    tampilRingkasanStruk();
  },
  'ulangi-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job) jalankanStruk(job);
  },
  'buang-struk': async el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job && job.jenis === 'simpan' && !await tanya(T('Buang transaksi {jumlah} yang gagal disimpan ini?', { jumlah: rp(job.t.jumlah) }), T('Buang'))) return;
    if (job && job.status === 'siap' && !await tanya(T('Buang hasil struk ini tanpa menyimpannya?'), T('Buang'))) return;
    hapusJob(el.dataset.id);
  },
  'buka-simpan': async el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (!job) return;
    if (!$('#sheet').hidden) {
      if (F && !await tanya(T('Tutup form yang sedang dibuka? Isiannya akan hilang.'), T('Tutup'))) return;
      tutupSheet();
    }
    bukaLagiSimpan(job);
  },
  'f-pilih-jumlah': el => { bacaFieldTrx(); F.jumlah = Number(el.dataset.jumlah); renderFormTrx(); },
  'gemini': () => bukaFormGemini(),
  'telegram': () => bukaFormTelegram(),
  'cari-global': () => bukaCariGlobal(),
  'log-update': () => { $('#toast').hidden = true; bukaLogUpdate(); },
  'aktivitas': () => bukaAktivitas(),
  'saran-rutin': el => {
    const x = (S.data.saranRutin || []).find(s => s.kunci === el.dataset.kunci);
    if (!x) return;
    // Jatuh tempo berikutnya: tanggal yang sama bulan ini kalau belum lewat, selain itu bulan depan.
    const kini = keTanggal(hariIni());
    let d = new Date(kini.getFullYear(), kini.getMonth(), Math.min(x.hari, 28));
    if (d < kini) d = new Date(kini.getFullYear(), kini.getMonth() + 1, Math.min(x.hari, 28));
    bukaFormRutin();
    Object.assign(F, { nama: x.nama, tipe: x.tipe, jumlah: x.jumlah, kategori: x.kategori, dompet: x.dompet, catatan: x.nama,
      tanggal: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') });
    renderFormTrx();
  },
  'tolak-saran': el => {
    let tolak = [];
    try { tolak = JSON.parse(bacaHp(kunciSaranDitolak())) || []; } catch (e) { tolak = []; }
    tolak.push(el.dataset.kunci);
    tulisHp(kunciSaranDitolak(), JSON.stringify(tolak.slice(-50)));
    render();
    toast(T('Oke, tidak disarankan lagi'));
  },
  'rekap-telegram': async el => {
    const nyala = S.data.telegram.rekap === false;
    if (await kirim(el, 'aturRekapTelegram', [nyala], nyala ? T('Rekap bulanan dinyalakan 📊') : T('Rekap bulanan dimatikan'))) bukaFormTelegram();
  },
  'pengingat-telegram': async el => {
    const nyala = S.data.telegram.pengingat === false;
    if (await kirim(el, 'aturPengingatTelegram', [nyala], nyala ? T('Pengingat harian dinyalakan 🔔') : T('Pengingat harian dimatikan'))) bukaFormTelegram();
  },
  'cadangan': () => bukaCadangan(),
  'unduh-csv': async el => {
    el.disabled = true;
    loading(true);
    try { await unduhCsv(); } catch (e) { if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('Gagal mengunduh: {galat}', { galat: pesanError(e) }), true); }
    el.disabled = false;
    loading(false);
  },
  'kode-telegram': async el => {
    const t = S.data.telegram;
    // Bot bersama: buku ini akan dibagikan ke akun robot bot → minta persetujuan dulu.
    if (t.bersama && !t.pengguna.length && !await tanya(
      S.data.namaBuku
        ? T('Supaya bisa mencatat lewat Telegram, spreadsheet buku "{buku}" dibagikan (bisa mengubah) ke akun bot Dompet Keluarga. Pengelola bot secara teknis bisa membuka isinya. Akses bot dicabut otomatis saat semua akun Telegram diputus.', { buku: namaT(S.data.namaBuku) })
        : T('Supaya bisa mencatat lewat Telegram, spreadsheet buku "ini" dibagikan (bisa mengubah) ke akun bot Dompet Keluarga. Pengelola bot secara teknis bisa membuka isinya. Akses bot dicabut otomatis saat semua akun Telegram diputus.'),
      T('Setuju & lanjut'), true)) return;
    el.disabled = true;
    loading(true);
    try {
      const r = await api('buatKodeTelegram');
      bukaFormTelegram(r.kode, r.muatan);
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'putus-telegram': async el => {
    if (!await tanya(T('Putuskan akun Telegram ini dari Dompet Keluarga?'), T('Putuskan'))) return;
    if (await kirim(el, 'putuskanTelegram', [el.dataset.id], T('Akun Telegram diputuskan'))) bukaFormTelegram();
  },
  'simpan-gemini': async el => {
    const kunci = $('#g-kunci').value.trim();
    if (!kunci) return toast(T('Tempel kunci API-nya dulu.'), true);
    if (await kirim(el, 'tambahKunciGemini', [kunci], T('Kunci Gemini tersimpan ✔'))) bukaFormGemini();
  },
  'hapus-gemini': async el => {
    if (!await tanya(T('Hapus kunci API {kunci}?', { kunci: el.dataset.kunci }), T('Hapus'))) return;
    if (await kirim(el, 'hapusKunciGemini', [el.dataset.kunci], T('Kunci API dihapus'))) bukaFormGemini();
  },
  'f-kategori': el => { bacaFieldTrx(); F.kategori = el.dataset.nama; renderFormTrx(); },
  'f-dompet': el => { bacaFieldTrx(); F.dompet = el.dataset.nama; renderFormTrx(); },
  'f-tujuan': el => { bacaFieldTrx(); F.dompetTujuan = el.dataset.nama; renderFormTrx(); },
  'simpan-trx': el => {
    bacaFieldTrx();
    if (!F.jumlah) return toast(T('Isi jumlahnya dulu.'), true);
    if (F.tipe !== TIPE.TRANSFER && !F.kategori) return toast(T('Pilih kategorinya dulu.'), true);
    if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) return toast(T('Pilih dompet tujuan yang berbeda.'), true);
    const t = F;
    t._menyimpan = true; // lembar ditutup karena tersimpan → bukan draf
    tulisHp(kunciDrafTrx(), null);
    const dasar = F.id ? T('Transaksi diperbarui ✔') : T('Transaksi tersimpan ✔');
    const pesan = () => { const a = pesanAnggaran(t); toast(a ? dasar + ' · ' + a.teks : dasar, a && a.lewat); };
    const dariJob = t.dariJob;
    // ID transaksi baru dibuat di HP, supaya kiriman ulang (setelah sinyal putus) tidak membuat data dobel.
    if (!t.id && !t.idBaru) t.idBaru = crypto.randomUUID();
    const tunda = () => { simpanTertunda(t); if (dariJob) hapusJob(dariJob); return true; };
    if (!t.id && (S.offline || !navigator.onLine)) return tunda();
    t.galatSimpan = '';
    // Ada foto baru: unggah ke Drive lama, jadi disimpan di latar belakang dan form langsung ditutup.
    if (t.lampiranData) return simpanDiLatar(t, pesan);
    kirim(el, 'simpanTransaksi', [t], pesan, e => !t.id && e.jaringan && tunda())
      .then(ok => { if (ok && dariJob) hapusJob(dariJob); if (!ok) t._menyimpan = false; });
  },
  'bagikan-laporan': async el => {
    el.disabled = true;
    try { await bagikanLaporan(el.dataset.bulan); } catch (e) { toast(T('Gambar tidak bisa dibuat: {galat}', { galat: pesanError(e) }), true); }
    el.disabled = false;
  },
  'tema': el => { aturTema(el.dataset.t); render(); },
  'samar': () => { aturSamar(!modeSamar()); render(); },
  'atur-kunci': () => bukaFormKunci(),
  'simpan-kunci': async el => {
    const pin = $('#k-pin').value;
    if (!/^\d{4,6}$/.test(pin)) return toast(T('PIN harus 4–6 angka.'), true);
    if (pin !== $('#k-pin2').value) return toast(T('Kedua PIN belum sama.'), true);
    el.disabled = true;
    const k = { garam: keBase64(crypto.getRandomValues(new Uint8Array(16))), panjang: pin.length };
    // Sidik jari didaftarkan lebih dulu, selagi masih dalam ketukan pengguna (syarat browser).
    if ($('#k-bio') && $('#k-bio').checked) {
      try { k.bio = await daftarBio(); } catch (e) { toast(T('Sidik jari/wajah tidak bisa diaktifkan. PIN tetap dipakai.'), true); }
    }
    k.hash = await hashPin(pin, k.garam);
    tulisHp('dk_kunci', JSON.stringify(k));
    el.disabled = false;
    tutupSheet();
    render();
    toast(T('Kunci aplikasi aktif 🔒'));
  },
  'hapus-kunci': async () => {
    const k = kunciTersimpan();
    if (!k || (await hashPin($('#k-pin').value, k.garam)) !== k.hash) return toast(T('PIN salah.'), true);
    tulisHp('dk_kunci', null);
    tutupSheet();
    render();
    toast(T('Kunci aplikasi dimatikan'));
  },
  'pin': async el => {
    const k = kunciTersimpan();
    if (!k || pinDiketik.length >= k.panjang || sisaJedaPin()) return;
    pinDiketik += el.dataset.n;
    renderKunci();
    if (pinDiketik.length < k.panjang) return;
    if ((await hashPin(pinDiketik, k.garam)) === k.hash) {
      tulisHp('dk_pin_salah', null);
      return bukaKunci();
    }
    pinDiketik = '';
    getar();
    if (!catatPinSalah()) renderKunci(true);
  },
  'pin-hapus': () => { pinDiketik = pinDiketik.slice(0, -1); renderKunci(); },
  'buka-bio': async () => {
    try {
      await cekBio(kunciTersimpan().bio);
      tulisHp('dk_pin_salah', null);
      bukaKunci();
    } catch (e) {
      toast(T('Sidik jari/wajah gagal. Pakai PIN.'), true);
    }
  },
  'lupa-pin': async () => {
    if (!await tanya(T('Untuk membuka kunci tanpa PIN, Anda perlu keluar lalu masuk lagi dengan akun Google. Data tetap aman di Google Drive. Lanjutkan?'), T('Keluar & masuk lagi'))) return;
    resetKunci();
  },
  'rincian-aman': () => bukaRincianAman(),
  'atur-periode': () => bukaFormPeriode(),
  'pilih-periode': el => {
    F.mulai = Number(el.dataset.n);
    document.querySelectorAll('.grid-tanggal button').forEach(b => b.classList.toggle('aktif', b === el));
    $('#contoh-periode').textContent = F.contoh(F.mulai);
  },
  'simpan-periode': el => {
    S.bulan = ''; // pindah ke periode berjalan menurut tanggal gajian yang baru
    S.tahun = new Date().getFullYear();
    kirim(el, 'simpanMulaiPeriode', [F.mulai], T('Periode gajian tersimpan ✔'));
  },
  'f-ulang': el => { bacaFieldTrx(); F.ulang = el.dataset.ulang; renderFormTrx(); },
  'f-favorit': el => {
    const f = kebiasaan().favorit[Number(el.dataset.i)];
    if (f) isiFormCepat(f);
  },
  'kelola-rutin': () => bukaDaftarRutin(),
  'tambah-rutin': () => bukaFormRutin(null),
  'edit-rutin': el => bukaFormRutin(daftarRutin().find(r => r.id === el.dataset.id)),
  'bayar-rutin': el => {
    const r = daftarRutin().find(x => x.id === el.dataset.id);
    if (!r) return;
    bukaFormTrx(null, {
      tipe: r.tipe, jumlah: r.jumlah, kategori: r.kategori, dompet: r.dompet, dompetTujuan: r.dompetTujuan,
      catatan: r.catatan || r.nama, dariRutin: r.id, berikutRutin: SERVER.tanggalBerikut(r.berikutnya, r.mulai, r.ulang),
    }, r.nama);
  },
  'lewati-rutin': async el => {
    if (!await tanya(T('Lewati tagihan ini tanpa mencatat transaksi? Jatuh temponya pindah ke {tanggal}.', { tanggal: tanggalPendek(F.berikutRutin) }), T('Lewati'), true)) return;
    kirim(el, 'majukanRutin', [F.dariRutin], T('Dilewati ✔ Berikutnya {tanggal}', { tanggal: tanggalPendek(F.berikutRutin) }));
  },
  'simpan-rutin': async el => {
    bacaFieldTrx();
    const salah = cekIsianTrx() || (!F.tanggal ? T('Isi tanggal jatuh tempo.') : '');
    if (salah) return toast(salah, true);
    const ok = await kirim(el, 'simpanRutin', [{
      id: F.idRutin, nama: F.nama, tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet,
      dompetTujuan: F.dompetTujuan, catatan: F.catatan, ulang: F.ulang, berikutnya: F.tanggal,
    }], T('Tagihan rutin tersimpan ✔'));
    if (ok) bukaDaftarRutin();
  },
  'hapus-rutin': async el => {
    if (!await tanya(T('Hapus tagihan rutin "{nama}"? Transaksi yang sudah dicatat tidak ikut terhapus.', { nama: F.nama || '' }), T('Hapus'))) return;
    if (await kirim(el, 'hapusRutin', [F.idRutin], T('Tagihan rutin dihapus'))) bukaDaftarRutin();
  },
  'kirim-tertunda': async () => {
    if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
    loading(true);
    await kirimTertunda();
    loading(false);
    if (tertunda().some(t => !t.gagal)) toast(T('Belum bisa dikirim. Periksa koneksi internet.'), true);
  },
  'ulang-tertunda': el => {
    const t = tertunda().find(x => x.idBaru === el.dataset.id);
    tulisTertunda(tertunda().filter(x => x.idBaru !== el.dataset.id));
    render();
    if (t) {
      bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet,
        dompetTujuan: t.dompetTujuan, tanggal: t.tanggal, catatan: t.catatan }, T('Catat Ulang'));
    }
  },
  // Tanpa konfirmasi: kesalahan cukup diurungkan dari toast.
  'hapus-trx': el => kirim(el, 'hapusTransaksi', [F.id], baris => {
    trxTerhapus = baris;
    toast(T('Transaksi dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-hapus' });
  }),
  'urungkan-hapus': el => {
    const baris = trxTerhapus;
    trxTerhapus = null;
    $('#toast').hidden = true;
    if (baris) kirim(el, 'kembalikanTransaksi', [baris], T('Transaksi dikembalikan'));
  },

  'tambah-dompet': () => bukaFormDompet(null, JENIS.DOMPET),
  'tambah-tabungan': () => bukaFormDompet(null, JENIS.TABUNGAN),
  'tambah-aset': () => bukaFormDompet(null, JENIS.ASET),
  'edit-dompet': el => bukaFormDompet(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'buka-tabungan': el => bukaTabungan(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'simpan-dompet': el => {
    const tab = F.jenis === JENIS.TABUNGAN;
    const nama = $('#d-nama').value.trim();
    if (!nama) return toast(tab ? T('Isi nama tabungan dulu.') : T('Isi nama dompet dulu.'), true);
    // Yang diisi adalah saldo sekarang; saldo awal dihitung mundur dari mutasi transaksi,
    // jadi riwayat transaksi tidak berubah. Field yang tidak disentuh → saldo awal tetap.
    const isian = $('#d-saldo') ? $('#d-saldo').value : F.saldoTampil; // form orang utang tidak punya isian saldo
    const saldoAwal = isian === F.saldoTampil ? F.saldoAwal : angka(isian) - F.mutasi;
    kirim(el, 'simpanDompet', [{
      namaLama: F.namaLama, nama, ikon: F.ikon, jenis: F.jenis,
      saldoAwal,
      target: tab ? angka($('#d-target').value) : 0,
      tenggat: $('#d-tenggat') ? $('#d-tenggat').value : '',
    }], T('Tersimpan ✔'));
  },
  'lampiran-pilih': () => {
    bacaFieldTrx();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file || !F || !$('#form-trx')) return;
      try {
        const g = await kecilkanGambar(file);
        bacaFieldTrx();
        F.lampiranData = g.lampiran;
        F.lampiranThumb = g.thumb;
        renderFormTrx();
      } catch (e) {
        toast(pesanError(e), true);
      }
    };
    input.click();
  },
  'lampiran-hapus': () => {
    bacaFieldTrx();
    if (F.lampiranData) { F.lampiranData = ''; F.lampiranThumb = ''; } else if (F.lampiran) { F.lampiran = ''; F.hapusLampiran = true; }
    renderFormTrx();
  },
  'buku': () => bukaDaftarBuku(),
  'pindah-buku': el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    gantiBuku('hubungkanDatabase', [el.dataset.id], T('Buku {nama} dibuka ✔', { nama: b ? b.nama : '' }));
  },
  'templat-buku': el => { $('#b-nama').value = TEMPLAT_BUKU[Number(el.dataset.i)]; },
  'buat-buku': () => {
    const nama = $('#b-nama').value.trim();
    if (!nama) return toast(T('Isi nama bukunya dulu.'), true);
    if ((S.data.buku || []).some(b => b.nama.toLowerCase() === nama.toLowerCase())) return toast(T('Buku "{nama}" sudah ada.', { nama }), true);
    gantiBuku('buatBuku', [nama], T('Buku {nama} dibuat ✔ Atur dompetnya di tab Dompet.', { nama }));
  },
  'lupakan-buku': async el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    if (!await tanya(b ? T('Hapus "{nama}" dari daftar Anda? Buku ini milik orang lain, jadi isinya tidak berubah. Anda bisa menambahkannya lagi lewat "Cek undangan" selama masih diberi akses.', { nama: b.nama }) : T('Hapus "buku ini" dari daftar Anda? Buku ini milik orang lain, jadi isinya tidak berubah. Anda bisa menambahkannya lagi lewat "Cek undangan" selama masih diberi akses.'), T('Hapus dari daftar'))) return;
    if (await kirim(el, 'lupakanBuku', [el.dataset.id], T('Dihapus dari daftar'))) bukaDaftarBuku();
  },
  'hapus-buku': async el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    const nama = b ? b.nama : T('buku ini');
    if (!await tanya(T('Hapus buku "{nama}"? Buku hilang dari daftar Anda, dan spreadsheet-nya di Google Drive diberi nama "… - deleted". Datanya tidak hilang dan masih bisa dipulihkan dari Drive. Anggota lain akan melihat buku ini sebagai "dihapus".', { nama }), T('Hapus buku'))) return;
    if (await kirim(el, 'hapusBuku', [el.dataset.id], T('Buku {nama} dihapus', { nama }))) bukaDaftarBuku();
  },
  'cek-undangan': async el => {
    el.disabled = true;
    try {
      const ids = await GOOGLE.pilihSpreadsheet('', { undangan: true, banyak: true });
      if (!ids.length) return;
      loading(true);
      const hasil = await api('tambahBuku', ids);
      loading(false);
      const ok = hasil.filter(h => !h.pesan);
      const lewat = hasil.filter(h => h.pesan);
      if (lewat.length) toast((lewat.length > 1 ? T('{n} file dilewati.', { n: lewat.length }) + ' ' : '') + lewat[0].pesan + '.', true);
      if (ok.length === 1) await gantiBuku('hubungkanDatabase', [ok[0].id], T('Bergabung ke buku {nama} ✔', { nama: ok[0].nama }));
      else if (ok.length > 1) bukaPilihBukuUndangan(ok);
    } catch (e) {
      // Sesi habis sebelum jendela Google terbuka (bukan lewat api): tampilkan kartu "Lanjutkan sebagai …".
      if (e instanceof GOOGLE.PerluMasuk) perluMasukLagi();
      else toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'buka-undangan': el => gantiBuku('hubungkanDatabase', [el.dataset.id], T('Buku {nama} dibuka ✔', { nama: el.dataset.nama })),
  'buka-zakat': () => bukaZakat(),
  'hitung-zakat': () => { tulisHp('dk_harga_emas', String(angka($('#z-emas').value) || '') || null); bukaZakat(); },
  'catat-zakat': el => {
    // Kategori sosial/donasi kalau ada; kalau tidak, biarkan pengguna memilih.
    const k = S.data.kategori.find(x => x.tipe === TIPE.KELUAR && /zakat|sosial|donasi|sedekah/i.test(x.nama));
    bukaFormTrx(null, { tipe: TIPE.KELUAR, jumlah: Number(el.dataset.jumlah), kategori: k ? k.nama : '',
      catatan: el.dataset.jenis === 'maal' ? T('Zakat maal') : T('Zakat penghasilan {bulan}', { bulan: namaBulan(S.bulan) }) }, T('Bayar Zakat'));
  },
  'templat-tabungan': el => {
    const [ikon, nama] = TEMPLAT_TABUNGAN[Number(el.dataset.i)];
    $('#d-nama').value = nama;
    F.ikon = ikon;
    document.querySelectorAll('.grid-ikon button').forEach(b => b.classList.toggle('aktif', b.dataset.ikon === ikon));
    $('#d-target').focus();
  },
  'templat-rutin': el => {
    const [, nama, tipe] = TEMPLAT_RUTIN[Number(el.dataset.i)];
    bacaFieldTrx();
    if (F.tipe !== tipe) { F.tipe = tipe; F.kategori = ''; }
    F.nama = nama;
    F.kategori = tebakKategori(tipe, nama) || F.kategori;
    if (!F.catatan) F.catatan = nama;
    renderFormTrx();
    $('#f-jumlah').focus();
  },
  'buka-patungan': () => {
    bacaFieldTrx();
    bukaFormPatungan({ total: F.jumlah, kategori: F.kategori, dompet: F.dompet, tanggal: F.tanggal, catatan: F.catatan });
  },
  'p-tambah': () => {
    bacaFormPatungan();
    const nama = $('#p-nama').value.trim();
    if (!nama) return toast(T('Ketik nama temannya dulu.'), true);
    if (F.peserta.some(p => p.nama.toLowerCase() === nama.toLowerCase())) return toast(T('{nama} sudah ada.', { nama }), true);
    F.peserta.push({ nama, jumlah: 0 });
    bagiRata();
    renderFormPatungan();
    $('#p-nama').focus();
  },
  'p-hapus': el => { bacaFormPatungan(); F.peserta.splice(Number(el.dataset.i), 1); bagiRata(); renderFormPatungan(); },
  'p-rata': () => { bacaFormPatungan(); bagiRata(); renderFormPatungan(); },
  'p-ikut': () => { bacaFormPatungan(); F.ikut = !F.ikut; bagiRata(); renderFormPatungan(); },
  'simpan-patungan': el => {
    bacaFormPatungan();
    if (!F.total) return toast(T('Isi total tagihannya dulu.'), true);
    if (!F.peserta.length) return toast(T('Tambahkan minimal satu teman.'), true);
    const saya = bagianSaya();
    if (saya < 0 || F.peserta.reduce((a, p) => a + p.jumlah, 0) + saya !== F.total) return toast(T('Jumlah semua bagian belum sama dengan total.'), true);
    const n = F.peserta.length;
    kirim(el, 'catatPatungan', [{
      total: F.total, bagianSaya: saya, kategori: F.kategori, dompet: F.dompet, tanggal: F.tanggal, catatan: F.catatan, peserta: F.peserta,
    }], T('Patungan tercatat ✔ {n} orang berutang ke Anda', { n }));
  },
  'tambah-utang': el => bukaFormUtang(el.dataset.nama, el.dataset.arah),
  'buka-utang': el => bukaUtang(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'u-arah': el => { bacaFormUtang(); F.arah = el.dataset.arah; renderFormUtang(); },
  'u-dompet': el => { bacaFormUtang(); F.dompet = el.dataset.nama; renderFormUtang(); },
  'simpan-utang': el => {
    bacaFormUtang();
    if (!F.nama) return toast(T('Isi nama orangnya dulu.'), true);
    if (!F.jumlah) return toast(T('Isi jumlahnya dulu.'), true);
    if (!F.dompet) return toast(T('Pilih dompetnya dulu.'), true);
    kirim(el, 'catatUtang', [{ nama: F.nama, arah: F.arah, jumlah: F.jumlah, dompet: F.dompet, tanggal: F.tanggal, tenggat: F.tenggat, catatan: F.catatan }],
      F.arah === 'piutang' ? T('Pinjaman ke {nama} tercatat ✔', { nama: F.nama }) : T('Utang ke {nama} tercatat ✔', { nama: F.nama }));
  },
  'lunasi-utang': el => {
    const w = S.data.dompet.find(x => x.nama === el.dataset.nama);
    const pertama = dompetBiasa()[0];
    if (!w || !pertama) return;
    // Pelunasan = transfer balik: dia membayar → dari orang ke dompet kita; kita membayar → dari dompet ke orang.
    const dia = w.saldo > 0;
    bukaFormTrx(null, {
      tipe: TIPE.TRANSFER, jumlah: Math.abs(w.saldo),
      dompet: dia ? w.nama : pertama.nama, dompetTujuan: dia ? pertama.nama : w.nama,
      catatan: dia ? T('Pelunasan dari {nama}', { nama: w.nama }) : T('Bayar utang ke {nama}', { nama: w.nama }),
    }, dia ? T('Terima dari {nama}', { nama: w.nama }) : T('Bayar ke {nama}', { nama: w.nama }));
  },
  'hapus-dompet': async el => {
    if (await tanya(T('Hapus "{nama}"?', { nama: namaT(F.namaLama) }), T('Hapus'))) kirim(el, 'hapusDompet', [F.namaLama], T('Dihapus'));
  },
  'setor-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast(T('Buat dompet dulu sebagai sumber setoran.'), true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: pertama.nama, dompetTujuan: el.dataset.nama }, T('Setor ke {nama}', { nama: namaT(el.dataset.nama) }));
  },
  'tarik-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast(T('Buat dompet dulu sebagai tujuan penarikan.'), true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: el.dataset.nama, dompetTujuan: pertama.nama }, T('Tarik dari {nama}', { nama: namaT(el.dataset.nama) }));
  },

  'atur-anggaran': () => bukaFormAnggaran(),
  'rincian-anggaran': () => bukaRincianAnggaran(),
  'cepat-struk': () => {
    // Langsung buka kamera (masih dalam ketukan pengguna supaya tidak diblokir browser);
    // struk dibaca di latar belakang tanpa membuka form. Di komputer, capture diabaikan → pemilih file.
    sumberStruk = 'cepat';
    $('#input-struk-kamera').click();
  },
  'cepat-transfer': () => bukaFormTrx(null, { tipe: TIPE.TRANSFER }, T('Transfer')),
  'pakai-saran-anggaran': el => {
    const i = document.querySelector(`.input-anggaran[data-nama="${CSS.escape(el.dataset.nama)}"]`);
    if (i) { i.value = formatAngka(Number(el.dataset.n)); i.classList.add('terisi-otomatis'); hitungTotalAnggaran(); }
  },
  'isi-saran-anggaran': () => {
    let n = 0;
    document.querySelectorAll('[data-aksi="pakai-saran-anggaran"]').forEach(b => {
      const i = document.querySelector(`.input-anggaran[data-nama="${CSS.escape(b.dataset.nama)}"]`);
      if (i && !angka(i.value)) { i.value = formatAngka(Number(b.dataset.n)); i.classList.add('terisi-otomatis'); n++; }
    });
    hitungTotalAnggaran();
    toast(n ? T('{n} kategori diisi. Periksa lalu ketuk Simpan.', { n }) : T('Semua kategori yang disarankan sudah terisi.'));
  },
  'simpan-anggaran': el => {
    const peta = {};
    const amplop = {};
    document.querySelectorAll('.input-anggaran').forEach(i => { peta[i.dataset.nama] = angka(i.value); });
    document.querySelectorAll('.input-amplop').forEach(i => { amplop[i.dataset.nama] = i.checked; });
    kirim(el, 'simpanAnggaran', [peta, amplop], T('Anggaran tersimpan ✔'));
  },

  'tahun': async el => {
    S.tahun += Number(el.dataset.geser);
    S.bulan = S.tahun === new Date().getFullYear() ? periodeSekarang() : S.tahun + '-12';
    render();
    muat(); // muat ulang transaksi bulan terpilih untuk tab lain, di latar belakang
  },
  'jenis-grafik': el => {
    const g = $('#geser-grafik');
    if (g) g.scrollTo({ left: Number(el.dataset.i) * g.clientWidth, behavior: 'smooth' });
  },
  'lap-bulan': el => {
    S.bulan = el.dataset.bulan;
    render();
    muat();
  },
  'lap-kategori': el => { S.lapKategori = el.dataset.mode; render(); },

  'kelola-kategori': () => bukaDaftarKategori(TIPE.KELUAR),
  'daftar-kategori': el => bukaDaftarKategori(el.dataset.tipe),
  'tambah-kategori': el => bukaFormKategori(null, el.dataset.tipe),
  'edit-kategori': el => bukaFormKategori(S.data.kategori.find(k => k.nama === el.dataset.nama && k.tipe === el.dataset.tipe)),
  'simpan-kategori': async el => {
    const nama = $('#k-nama').value.trim();
    if (!nama) return toast(T('Isi nama kategori dulu.'), true);
    const tipe = F.tipe;
    const ok = await kirim(el, 'simpanKategori', [{ namaLama: F.namaLama, tipeLama: F.tipeLama, nama, tipe, ikon: F.ikon }], T('Kategori tersimpan ✔'));
    if (ok) bukaDaftarKategori(tipe);
  },
  'hapus-kategori': async el => {
    if (!await tanya(T('Hapus kategori "{nama}"?', { nama: namaT(F.namaLama) }), T('Hapus'))) return;
    const tipe = F.tipeLama;
    const ok = await kirim(el, 'hapusKategori', [F.namaLama, F.tipeLama], T('Kategori dihapus'));
    if (ok) bukaDaftarKategori(tipe);
  },

  'setup-dompet': el => {
    const p = S.setup.pilih;
    const i = p.indexOf(el.dataset.nama);
    if (i >= 0) p.splice(i, 1);
    else p.push(el.dataset.nama);
    renderSetup();
  },
  'setup-lain': () => {
    const nama = $('#s-lain').value.trim();
    if (!nama) return toast(T('Ketik nama dompetnya dulu.'), true);
    const ada = semuaDompetSetup().find(([n]) => n.toLowerCase() === nama.toLowerCase());
    if (!ada) S.setup.lain.push(nama);
    const n = ada ? ada[0] : nama;
    if (!S.setup.pilih.includes(n)) S.setup.pilih.push(n);
    renderSetup();
  },
  'buat-db': async el => {
    bacaSetup();
    const st = S.setup;
    if (!st.pilih.length) return toast(T('Pilih minimal satu dompet.'), true);
    const dompet = semuaDompetSetup().filter(([n]) => st.pilih.includes(n))
      .map(([nama, ikon]) => ({ nama, ikon, saldoAwal: st.saldo[nama] || 0 }));
    el.disabled = true;
    loading(true);
    try {
      await api('buatDatabase', st.email, dompet);
      await muat();
      toast(T('Siap dipakai ✔ Ketuk ＋ untuk mencatat transaksi pertama.'));
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'pilih-db': async el => {
    el.disabled = true;
    try {
      await pilihDanHubungkan(el.dataset.id);
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'lupakan-db': async () => {
    loading(true);
    try {
      await api('lupakanDatabase');
      S.data = null;
      S.gabung = '';
      await muat();
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      loading(false);
    }
  },
  'geser-tanggal': el => {
    const input = document.getElementById(el.dataset.untuk);
    if (!input) return;
    const d = keTanggal(input.value || hariIni());
    d.setDate(d.getDate() + Number(el.dataset.geser));
    input.value = tanggalIso(d);
    perbaruiHari(input);
  },
  'coba-lagi': async () => { loading(true); await muat(); loading(false); },
  'masuk': async el => {
    el.disabled = true;
    try {
      await GOOGLE.masuk(!!el.dataset.akunLain);
      await muatDariAwal();
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'lanjut-sesi': async el => {
    el.disabled = true;
    try {
      await setelahTersambung(await GOOGLE.masuk(), true);
    } catch (e) {
      loading(false);
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'keluar': async () => {
    const n = bacaLokal('tertunda', []).length; // semua buku, karena semuanya ikut terhapus
    if (!await tanya(n ? T('{n} transaksi belum terkirim dan akan hilang. Tetap keluar dari {email}?', { n, email: GOOGLE.email() }) : T('Keluar dari {email}?', { email: GOOGLE.email() }), T('Keluar'))) return;
    // Data yang tersimpan di HP ikut dihapus, karena HP bisa dipakai orang lain.
    tulisLokal('data', null);
    tulisLokal('tertunda', null);
    GOOGLE.keluar();
    S.data = null;
    tampilMasuk();
  },

  'undang': () => { tandaiTips('undang'); bukaAnggota(); },
  'tutup-tips': () => { tandaiTips('tutup'); render(); },
  'keluarkan-anggota': async el => {
    if (!await tanya(T('Keluarkan {email}? Akun ini tidak bisa lagi membuka buku ini, melihat foto struknya, atau mencatat lewat bot Telegram. Transaksi yang sudah dicatatnya tetap ada.', { email: el.dataset.email }), T('Keluarkan'))) return;
    kirim(el, 'keluarkanAnggota', [el.dataset.id, el.dataset.email, el.dataset.buku || ''], T('Anggota dikeluarkan'));
  },
  'kirim-undangan': el => {
    const email = $('#u-email').value.trim();
    if (!email) return toast(T('Isi emailnya dulu.'), true);
    kirim(el, 'bagikanKe', [email, el.dataset.buku || ''], T('Undangan terkirim ✔ {email} akan menerima email dari Google.', { email }));
  },
  'anggota-buku': el => bukaAnggota(el.dataset.id),
  'salin-link': async () => {
    const input = $('#u-link');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast(T('Link disalin ✔'));
  },

  'pasang-aplikasi': async () => {
    if (!ajakanPasang) return;
    ajakanPasang.prompt();
    await ajakanPasang.userChoice.catch(() => null);
    ajakanPasang = null;
    if (S.tab === 'lainnya') render();
  },

  'pilih-ikon': el => {
    F.ikon = el.dataset.ikon;
    document.querySelectorAll('.grid-ikon button').forEach(b => b.classList.toggle('aktif', b === el));
  },
};

/**
 * Aksi yang tidak memicu perpanjangan sesi: login/kunci sendiri, dan aksi yang butuh "ketukan segar"
 * (kamera, bagikan, salin, sidik jari, pasang) — popup Google bisa memakai izin ketukan itu lebih dulu.
 */
const AKSI_TANPA_SEGARKAN = new Set([
  'masuk', 'lanjut-sesi', 'pilih-db', 'pin', 'pin-hapus', 'buka-bio', 'lupa-pin', 'simpan-kunci',
  'foto-struk', 'cepat-struk', 'lampiran-pilih', 'bagikan-laporan', 'salin-link', 'pasang-aplikasi', 'suara', 'contoh-suara', 'ketuk-catat', 'tugas-jadi-trx', 'pakai-saran-anggaran', 'isi-saran-anggaran', 'buang-banyak', 'kilas-maju', 'kilas-mundur', 'kilas-tutup', 'kilas-bagikan', 'kilas-putar', 'ringkas-tanpa-ai', 'suara-catatan', 'ringkas-koreksi', 'ringkas-ulang', 'cek-undangan', 'kompas', 'lokasi-gps',
]);

/**
 * Sesi login tersambung lagi (lewat tombol "Lanjutkan sebagai …" atau diam-diam saat mengetuk layar):
 * tutup kartu sesi lalu baca ulang data, kecuali sedang mengisi form.
 */
async function setelahTersambung(email, dariTombol) {
  if (!S.data || S.data.perluSetup) return muatDariAwal();
  if (email !== S.data.user) return muatDariAwal(); // ternyata akun lain
  const kartuTampil = !$('#sesi').hidden;
  $('#sesi').hidden = true;
  ulangiStrukTertunda('sesi');
  if ($('#sheet').hidden) {
    if (dariTombol) loading(true);
    await muat();
    loading(false);
    if (dariTombol || kartuTampil) toast(T('Tersambung lagi ✔'));
  } else if (dariTombol || kartuTampil) {
    toast(T('Tersambung lagi ✔ Silakan ulangi, isian Anda masih ada.'));
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-aksi]');
  // Sesi habis saat aplikasi dibuka lagi: ketukan apa pun (termasuk di luar tombol) dipakai untuk menyambung ulang.
  const segarkan = $('#kunci').hidden && (!el || !AKSI_TANPA_SEGARKAN.has(el.dataset.aksi))
    && (el || S.sesiHabis);
  if (segarkan) {
    const habis = !GOOGLE.sudahMasuk();
    const p = GOOGLE.segarkanKalauPerlu();
    if (p && habis) p.then(email => { if (email) setelahTersambung(email, false).catch(() => {}); });
  }
  if (!el || !AKSI[el.dataset.aksi]) return;
  e.preventDefault();
  AKSI[el.dataset.aksi](el, e);
});

['#input-struk', '#input-struk-kamera'].forEach(sel => $(sel).addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) mulaiStruk(file, sumberStruk === 'form', sumberStruk === 'cepat');
  sumberStruk = 'cepat';
}));

// Format ribuan saat mengetik nominal.
document.addEventListener('input', e => {
  if (e.target.type === 'date') perbaruiHari(e.target);
  if (['f-jumlah', 'd-saldo', 'd-target'].includes(e.target.id) || e.target.classList.contains('input-rp')) {
    e.target.value = formatAngka(angka(e.target.value));
    if (e.target.classList.contains('input-anggaran')) hitungTotalAnggaran();
  }
  if (e.target.id === 'cari') {
    S.cari = e.target.value;
    const tmp = document.createElement('div');
    tmp.innerHTML = viewRiwayat();
    $('#hasil-riwayat').innerHTML = tmp.querySelector('#hasil-riwayat').innerHTML;
  }
});

// Input cepat: "change" = Enter/selesai mengetik, atau memilih saran dari daftar.
document.addEventListener('change', e => {
  if (e.target.type === 'date') perbaruiHari(e.target); // sebagian pemilih tanggal hanya memicu "change"
  if (!F) return;
  if (F.patungan && e.target.id === 'p-total') { bacaFormPatungan(); renderFormPatungan(); return; }
  if (e.target.id === 'f-cepat' && e.target.value.trim()) {
    const h = bacaKetikCepat(e.target.value.trim());
    isiFormCepat(h);
    if (!h.jumlah) toast(T('Nominalnya belum terbaca. Contoh: bakso 25rb'), true);
  }
  // Catatan yang pernah dipakai → kategori terisi sendiri (tanpa render ulang, supaya ketukan berikutnya tidak hilang).
  if (e.target.id === 'f-catatan' && !F.kategori && F.tipe !== TIPE.TRANSFER) {
    const k = tebakKategori(F.tipe, e.target.value);
    const tombol = k && document.querySelector(`.pilihan[data-aksi="f-kategori"][data-nama="${CSS.escape(k)}"]`);
    if (tombol) {
      F.kategori = k;
      tombol.classList.add('aktif');
    }
  }
});

// ---------- Aplikasi terpasang (PWA) & pembaruan otomatis ----------
// Isi aplikasi dibuka dari cache service worker supaya langsung tampil (lihat sw.js). Versi isi cache
// dibandingkan dengan versi.txt di server (dibuat saat deploy); kalau server lebih baru, service worker
// diminta mengunduh versi baru dulu, lalu aplikasi dimuat ulang sendiri saat pengguna tidak mengisi apa pun.

const MODE_APLIKASI = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let ajakanPasang = null;
let versiAwal = null;      // versi isi aplikasi yang sedang berjalan
let pembaruanDitunda = false;
let pembaruanSiap = '';    // versi baru yang sudah diunduh ke cache, tinggal dimuat ulang
let sedangCekVersi = false;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/**
 * Versi isi yang sedang berjalan, dibaca SEKARANG (saat app.js dimuat) sebelum ada pembaruan cache.
 * null = halaman tidak dibuka dari cache service worker (mis. pertama kali), berarti sama dengan versi server.
 */
const versiDimuat = (async () => {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return null;
    const r = await caches.match('versi.txt');
    return r ? (await r.text()).trim() : null;
  } catch (e) {
    return null;
  }
})();

/** Minta service worker mengunduh versi `v` ke cache. true kalau cache sudah berisi versi itu. */
function siapkanVersi(v) {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) return Promise.resolve(true); // tanpa service worker: muat ulang langsung mengambil dari server
  return new Promise(ok => {
    const ch = new MessageChannel();
    const batas = setTimeout(() => ok(false), 60000);
    ch.port1.onmessage = e => {
      clearTimeout(batas);
      if (e.data && e.data.galat) console.warn('Pembaruan belum bisa diunduh:', e.data.galat);
      ok(!!(e.data && e.data.v === v));
    };
    sw.postMessage({ perbarui: true }, [ch.port2]);
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  ajakanPasang = e;
  if (S.data && S.tab === 'lainnya') render();
});
window.addEventListener('appinstalled', () => {
  ajakanPasang = null;
  toast(T('Aplikasi terpasang ✔ Buka dari layar utama HP'));
});

async function versiServer() {
  try {
    const r = await fetch('versi.txt', { cache: 'no-store' });
    return r.ok ? (await r.text()).trim() : null;
  } catch (e) {
    return null;
  }
}
const sedangSibuk = () => !$('#sheet').hidden || ANTRIAN.length > 0 || !$('#loading').hidden || ($('#sesi') && !$('#sesi').hidden);

// ---------- Log update (Apa yang baru) ----------
// web/changelog.json dibuat saat deploy dari judul pesan commit (.github/changelog.js).

/** Setelah aplikasi diperbarui: sekali tampilkan toast "Diperbarui ke v1.xx" dengan tombol ke log update. */
function umumkanVersi(v) {
  if (!/^\d+\.\d+$/.test(v)) return;
  const lama = bacaHp('dk_versi_lihat');
  tulisHp('dk_versi_lihat', v);
  if (!lama || lama === v) return; // pertama kali dipakai: tidak perlu diumumkan
  setTimeout(() => toast(T('✨ Diperbarui ke v{v}', { v }), false, { label: T('Lihat yang baru'), aksi: 'log-update' }), 2500);
}

/** Judul commit → poin-poin: dipecah di "; " dan huruf pertama dibesarkan. */
function poinLog(judul) {
  return String(judul).split(/;\s+/).map(x => x.trim()).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1));
}

async function bukaLogUpdate() {
  bukaSheet(T('Apa yang baru'), '<div class="kerangka k-daftar" style="margin-top:8px">' + '<div><i class="k-bulat kecil"></i><i class="k-garis"></i></div>'.repeat(5) + '</div>');
  let log = [];
  try {
    const r = await fetch('changelog.json', { cache: 'no-store' });
    if (r.ok) log = await r.json();
  } catch (e) { /* offline */ }
  if ($('#sheet-judul').textContent !== T('Apa yang baru')) return; // sudah ditutup / ganti lembar
  if (!log.length) {
    $('#sheet-isi').innerHTML = kosong('🆕', navigator.onLine ? T('Log update belum tersedia. Muncul setelah versi berikutnya ter-deploy.') : T('Butuh internet untuk memuat log update.'));
    return;
  }
  const sekarang = versiAwal || log[0].v;
  const tgl = t => keTanggal(t).toLocaleDateString(LOKAL, { day: 'numeric', month: 'long', year: 'numeric' });
  let tanggalSebelum = '';
  $('#sheet-isi').innerHTML = `
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Aplikasi diperbarui otomatis. Versi Anda: <b>{versi}</b>', { versi: esc(labelVersi() || 'v' + sekarang) })}</p>
    <div class="daftar-log">${log.slice(0, 60).map(x => {
      const kepala = x.tanggal !== tanggalSebelum ? `<h4 class="tanggal-log">${esc(tgl(x.tanggal))}</h4>` : '';
      tanggalSebelum = x.tanggal;
      return kepala + `<div class="item-log ${x.v === sekarang ? 'ini' : ''}">
        <span class="versi-log">v${esc(x.v)}</span>
        <ul>${poinLog(x.judul).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${x.v === sekarang ? `<span class="lencana-log">${T('Versi Anda')}</span>` : ''}
      </div>`;
    }).join('')}</div>`;
}

async function cekPembaruan() {
  if (sedangCekVersi) return;
  sedangCekVersi = true;
  try {
    const v = await versiServer();
    if (!v) return;
    if (!versiAwal) { versiAwal = (await versiDimuat) || v; umumkanVersi(versiAwal); }
    if (v === versiAwal) return;
    // Versi baru diunduh utuh ke cache dulu; gagal (mis. sinyal putus) → dicoba lagi di pengecekan berikutnya.
    if (pembaruanSiap !== v) {
      if (!await siapkanVersi(v)) return;
      pembaruanSiap = v;
    }
    if (!sedangSibuk()) return location.reload();
    if (!pembaruanDitunda) toast(T('Versi baru tersedia, dipasang setelah Anda selesai'));
    pembaruanDitunda = true;
  } finally {
    sedangCekVersi = false;
  }
}

// Mode samar & kunci aplikasi: dipasang saat dibuka, dan kunci lagi setelah ditinggal > 1 menit.
document.body.classList.toggle('samar', modeSamar());
kunciLayar();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    waktuDisembunyikan = Date.now();
    if (S.data && !S.data.perluSetup) simpanPosisi(); // waktu posisi dihitung dari saat ditinggal
  }
  else if (waktuDisembunyikan && Date.now() - waktuDisembunyikan > KUNCI_SETELAH_MS && $('#kunci').hidden) kunciLayar();
});

// Sinyal kembali → keluar dari mode offline & kirim transaksi tertunda (kalau sesi habis, minta lanjutkan dulu).
window.addEventListener('online', () => {
  if (!S.data || S.data.perluSetup) return;
  if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
  ulangiStrukTertunda('sinyal');
  muat();
});
window.addEventListener('offline', () => {
  if (!S.data || S.data.perluSetup) return;
  S.offline = true;
  if ($('#sheet').hidden) render();
});

cekPembaruan();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cekPembaruan(); });
setInterval(() => { if (document.visibilityState === 'visible') cekPembaruan(); }, 5 * 60 * 1000);
// Pembaruan yang tertunda langsung dipasang begitu form ditutup & antrian struk kosong.
setInterval(() => { if (pembaruanDitunda && !sedangSibuk()) location.reload(); }, 3000);

// ---------- Catatan & pengingat (kalender) ----------
// Catatan disimpan di sheet "Catatan" buku ini, jadi seluruh anggota keluarga melihat kalender yang sama.
// Catatan berpengingat muncul sebagai overlay saat aplikasi dibuka di tanggalnya (atau sampai 7 hari sesudahnya
// kalau terlewat), sampai ditutup "Oke" di HP itu. "Ingatkan besok" menunda sehari.

const WARNA_CATATAN = [['biru', '#3b82f6'], ['hijau', '#10b981'], ['kuning', '#f59e0b'], ['merah', '#ef4444'], ['ungu', '#8b5cf6']];
const warnaCatatan = k => (WARNA_CATATAN.find(w => w[0] === k) || WARNA_CATATAN[0])[1];
const NAMA_WARNA = { biru: T('biru'), hijau: T('hijau'), kuning: T('kuning'), merah: T('merah'), ungu: T('ungu') };
const NAMA_HARI_PENDEK = [T('Sen'), T('Sel'), T('Rab'), T('Kam'), T('Jum'), T('Sab'), T('Min||hari')];
const daftarCatatan = () => (S.data && S.data.catatan) || []; // data offline versi lama belum punya catatan

const isoDari = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const geserHari = (iso, n) => { const d = keTanggal(iso); d.setDate(d.getDate() + n); return isoDari(d); };
const hariDalamBulan = (y, m) => new Date(y, m, 0).getDate(); // m: 1–12

/** Apakah catatan ini terjadi di tanggal iso (memperhitungkan pengulangan)? */
function terjadiPada(c, iso) {
  if (iso < c.tanggal) return false;
  if (!c.ulang) return iso === c.tanggal;
  const [y, m, d] = iso.split('-').map(Number);
  const [, m0, d0] = c.tanggal.split('-').map(Number);
  if (c.ulang === 'Mingguan') return Math.round((keTanggal(iso) - keTanggal(c.tanggal)) / 864e5) % 7 === 0;
  const hariPatokan = Math.min(d0, hariDalamBulan(y, m)); // tanggal 31 → 30/28 di bulan yang lebih pendek
  if (c.ulang === 'Bulanan') return d === hariPatokan;
  if (c.ulang === 'Tahunan') return m === m0 && d === hariPatokan;
  return false;
}

const catatanPada = iso => daftarCatatan().filter(c => terjadiPada(c, iso));
const tagihanPada = iso => daftarRutin().filter(r => r.berikutnya === iso);

/** "Hari ini" / "Besok" / "Kemarin" / "Kamis, 5 Nov". */
function labelHariPendek(iso) {
  const n = Math.round((keTanggal(iso) - keTanggal(hariIni())) / 864e5);
  if (n === 0) return T('Hari ini');
  if (n === 1) return T('Besok');
  if (n === -1) return T('Kemarin');
  return keTanggal(iso).toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Pindah ke halaman penuh (Catatan / Sholat), menutup lembar bawah yang mungkin masih terbuka. */
function bukaHalaman(tab) {
  if (!$('#sheet').hidden) tutupSheet();
  const pindah = S.tab !== tab;
  S.tab = tab;
  render();
  if (pindah) window.scrollTo(0, 0);
}

/** Halaman kalender bulanan (mulai Senin). S.kal = { bulan: 'yyyy-mm', pilih: 'yyyy-mm-dd' }. */
function bukaKalender(pilih) {
  const tgl = pilih || (S.kal && S.kal.pilih) || hariIni();
  S.kal = { bulan: tgl.slice(0, 7), pilih: tgl };
  bukaHalaman('catatan');
}

function viewCatatan() {
  if (!S.kal) S.kal = { bulan: hariIni().slice(0, 7), pilih: hariIni() };
  return `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Catatan & Pengingat')}</h1>
    </div>
    <section class="kartu halaman-kalender"><div id="kalender">${htmlKalender()}</div></section>`;
}

function renderKalender() {
  const kotak = $('#kalender');
  if (!kotak) return;
  kotak.innerHTML = htmlKalender();
  pasangGeserKalender();
}

function htmlKalender() {
  const [y, m] = S.kal.bulan.split('-').map(Number);
  const awal = new Date(y, m - 1, 1);
  const geserAwal = (awal.getDay() + 6) % 7; // Senin = 0
  const mulai = new Date(y, m - 1, 1 - geserAwal);
  const hari = hariIni();
  const sel = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + i);
    const iso = isoDari(d);
    if (i >= 35 && d.getMonth() !== m - 1) break; // baris ke-6 hanya kalau perlu
    const ada = catatanPada(iso);
    const tagihan = tagihanPada(iso);
    const label = ada.slice(0, 2).map(c => `<i style="--w:${warnaCatatan(c.warna)}">${esc(c.judul)}</i>`).join('')
      + (tagihan.length && ada.length < 2 ? `<i class="tagihan">💡 ${esc(tagihan[0].nama)}</i>` : '');
    const sisa = ada.length + tagihan.length - (ada.slice(0, 2).length + (tagihan.length && ada.length < 2 ? 1 : 0));
    sel.push(`<button type="button" class="kal-sel ${d.getMonth() !== m - 1 ? 'luar' : ''} ${iso === hari ? 'hari-ini' : ''} ${iso === S.kal.pilih ? 'pilih' : ''}"
      data-aksi="kal-tgl" data-tgl="${iso}" aria-label="${esc(keteranganHari(iso))}${ada.length ? T(', {n} catatan', { n: ada.length }) : ''}">
      <span class="kal-angka">${d.getDate()}</span>${label}${sisa > 0 ? `<i class="lagi">+${sisa}</i>` : ''}</button>`);
  }

  const dipilih = catatanPada(S.kal.pilih);
  const tagihanDipilih = tagihanPada(S.kal.pilih);
  return `
    <div class="kal-kepala">
      <button type="button" class="tombol-ikon" data-aksi="kal-bulan" data-geser="-1" aria-label="${T('Bulan sebelumnya')}">${svg('kembali')}</button>
      <b>${awal.toLocaleDateString(LOKAL, { month: 'long', year: 'numeric' })}</b>
      <button type="button" class="tombol-ikon" data-aksi="kal-bulan" data-geser="1" aria-label="${T('Bulan berikutnya')}">${svg('maju')}</button>
      ${S.kal.bulan !== hari.slice(0, 7) || S.kal.pilih !== hari ? '<button type="button" class="chip" data-aksi="kal-tgl" data-tgl="' + hari + '">' + T('Hari ini') + '</button>' : ''}
    </div>
    <div class="kal-hari">${NAMA_HARI_PENDEK.map(h => `<span>${h}</span>`).join('')}</div>
    <div class="kal-grid" id="kal-grid">${sel.join('')}</div>
    <h3 class="kal-judul-hari">${esc(keteranganHari(S.kal.pilih))}</h3>
    ${dipilih.map(itemCatatan).join('')}
    ${tagihanDipilih.map(r => `
      <button type="button" class="kal-item tagihan" data-aksi="kelola-rutin">
        <span class="isi"><b>💡 ${esc(r.nama)}</b><small>${T('Tagihan rutin')} · ${rp(r.jumlah)}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`).join('')}
    ${dipilih.length || tagihanDipilih.length ? '' : '<p class="info-kecil" style="text-align:left;margin-top:0">' + T('Belum ada catatan di tanggal ini.') + '</p>'}
    ${S.data.bisaCatatan === false ? '<p class="info-kecil" style="text-align:left">' + T('⚠️ Buku ini belum bisa menyimpan catatan (butuh akses Editor ke spreadsheet).') + '</p>' : ''}
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="tambah-catatan">${labelHariPendek(S.kal.pilih) === T('Hari ini') ? T('＋ Catatan di hari ini') : T('＋ Catatan di {hari}', { hari: esc(labelHariPendek(S.kal.pilih)) })}</button></div>`;
}

/** Geser kiri/kanan di kalender untuk ganti bulan. */
function pasangGeserKalender() {
  const grid = $('#kal-grid');
  if (!grid) return;
  let x0 = null, y0 = 0;
  grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) gantiBulanKalender(dx < 0 ? 1 : -1);
  });
}

function gantiBulanKalender(n) {
  const [y, m] = S.kal.bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  S.kal.bulan = isoDari(d).slice(0, 7);
  // Tanggal terpilih ikut pindah ke bulan itu (hari ini kalau bulan ini, selain itu tanggal 1).
  S.kal.pilih = S.kal.bulan === hariIni().slice(0, 7) ? hariIni() : S.kal.bulan + '-01';
  renderKalender();
}

// ---------- Daftar tugas (to-do) di catatan ----------
// Disimpan di kolom Isi sebagai baris "[ ] item" / "[x] item", jadi tetap terbaca di spreadsheet & tanpa kolom baru.
const POLA_TUGAS = /^\[( |x)\] ?(.*)$/i;
function bacaTugas(isi) {
  const baris = String(isi || '').split('\n').map(b => b.trim()).filter(Boolean);
  if (!baris.length || !baris.every(b => POLA_TUGAS.test(b))) return null;
  return baris.map(b => { const m = b.match(POLA_TUGAS); return { teks: m[2], selesai: m[1].toLowerCase() === 'x' }; });
}
const tulisTugas = daftar => daftar.filter(t => t.teks.trim()).map(t => (t.selesai ? '[x] ' : '[ ] ') + t.teks.trim()).join('\n');

/** Checklist yang bisa dicentang langsung (kalender & overlay pengingat). */
function daftarCentang(c, semua) {
  const tugas = bacaTugas(c.isi) || [];
  const tampil = semua ? tugas : tugas.slice(0, 6);
  return `<div class="daftar-centang">${tampil.map((t, i) => `
      <button type="button" class="centang ${t.selesai ? 'selesai' : ''}" role="checkbox" aria-checked="${t.selesai}"
        data-aksi="centang-tugas" data-id="${esc(c.id)}" data-i="${i}"><span class="kotak-centang" aria-hidden="true"></span><span>${esc(t.teks)}</span></button>`).join('')}
      ${tugas.length > tampil.length ? `<small class="centang-lagi">${T('+{n} item lagi', { n: tugas.length - tampil.length })}</small>` : ''}</div>`;
}

function itemCatatan(c) {
  const meta = `${c.pengingat ? T('🔔 Pengingat') : T('📝 Catatan')}${c.ulang ? ' · 🔁 ' + namaT(c.ulang).toLowerCase() : ''}${c.oleh ? ' · ' + esc(namaPendek(c.oleh)) : ''}`;
  const tugas = bacaTugas(c.isi);
  if (!tugas) {
    return `
      <button type="button" class="kal-item" data-aksi="ubah-catatan" data-id="${esc(c.id)}" style="--w:${warnaCatatan(c.warna)}">
        <span class="isi"><b>${esc(c.judul)}</b>${c.isi ? `<small>${esc(c.isi)}</small>` : ''}<small class="kal-meta">${meta}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`;
  }
  const selesai = tugas.filter(t => t.selesai).length;
  return `
    <div class="kal-item kal-tugas ${selesai === tugas.length ? 'tuntas' : ''}" style="--w:${warnaCatatan(c.warna)}">
      <button type="button" class="kal-tugas-kepala" data-aksi="ubah-catatan" data-id="${esc(c.id)}">
        <span class="isi"><b>${esc(c.judul)}</b><small class="kal-meta">☑️ ${T('{a}/{b} selesai', { a: selesai, b: tugas.length })} · ${meta}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <div class="progres-tugas"><i style="width:${Math.round(selesai / tugas.length * 100)}%"></i></div>
      ${daftarCentang(c)}
    </div>`;
}

function barisTugasForm(t) {
  return `<div class="baris-tugas ${t.selesai ? 'selesai' : ''}">
      <button type="button" class="kotak-centang" data-aksi="c-tugas-centang" role="checkbox" aria-checked="${t.selesai}" aria-label="${T('Tandai selesai')}"></button>
      <input maxlength="200" enterkeyhint="next" placeholder="${T('Tulis item…')}" value="${esc(t.teks)}">
      <button type="button" class="tombol-hapus-tugas" data-aksi="c-tugas-hapus" aria-label="${T('Hapus item')}">✕</button>
    </div>`;
}
const tugasDariForm = () => [...document.querySelectorAll('#c-tugas .baris-tugas')].map(r => ({
  teks: r.querySelector('input').value, selesai: r.classList.contains('selesai'),
}));
function tambahBarisTugas(setelah, teks) {
  const tmp = document.createElement('div');
  tmp.innerHTML = barisTugasForm({ teks: teks || '', selesai: false });
  const baris = tmp.firstElementChild;
  if (setelah) setelah.after(baris); else $('#c-tugas').appendChild(baris);
  baris.querySelector('input').focus();
}

// Centang dari kalender/overlay: tampilan langsung berubah, simpan di latar (berurutan supaya tidak saling timpa).
let antrianTugas = Promise.resolve();
let tugasUntukTrx = '';
function centangTugas(id, i) {
  const c = daftarCatatan().find(x => x.id === id);
  const tugas = c && bacaTugas(c.isi);
  if (!tugas || !tugas[i]) return;
  const isiLama = c.isi;
  tugas[i].selesai = !tugas[i].selesai;
  c.isi = tulisTugas(tugas);
  getar();
  segarkanCentang(c);
  if (tugas[i].selesai) { // item belanja dicentang → tawarkan catat sebagai pengeluaran
    tugasUntukTrx = tugas[i].teks;
    toast('✔ ' + tugas[i].teks, false, { label: T('Catat pengeluaran'), aksi: 'tugas-jadi-trx' });
  }
  const kirimIsi = c.isi;
  antrianTugas = antrianTugas.then(() => api('simpanCatatan', {
    id: c.id, tanggal: c.tanggal, judul: c.judul, isi: kirimIsi, pengingat: c.pengingat, ulang: c.ulang, warna: c.warna,
  })).catch(e => {
    c.isi = isiLama;
    segarkanCentang(c);
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('Centang belum tersimpan: {pesan}', { pesan: pesanError(e) }), true);
  });
}
function segarkanCentang(c) {
  if ($('#kalender')) renderKalender();
  const overlay = document.querySelector('#ingat .ingat-isi');
  if (overlay && overlay.querySelector(`[data-id="${CSS.escape(c.id)}"]`)) overlay.innerHTML = daftarCentang(c, true);
}

Object.assign(AKSI, {
  'centang-tugas': el => centangTugas(el.dataset.id, Number(el.dataset.i)),
  'c-jenis': el => {
    const jenis = el.dataset.v;
    if (jenis === S.formCatatan.jenis) return;
    simpanDraftCatatan();
    S.formCatatan.jenis = jenis;
    document.querySelectorAll('#c-jenis button').forEach(b => { b.classList.toggle('aktif', b === el); b.setAttribute('aria-selected', b === el); });
    $('#c-jenis').dataset.jenis = jenis;
    if (jenis === 'tugas') {
      // Teks yang sudah ditulis jadi item per baris.
      const baris = $('#c-isi').value.split('\n').map(b => b.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      if (baris.length) $('#c-tugas').innerHTML = baris.map(t => barisTugasForm({ teks: t, selesai: false })).join('');
    } else {
      const isi = tugasDariForm().filter(t => t.teks.trim()).map(t => '- ' + t.teks.trim()).join('\n');
      if (isi && !$('#c-isi').value.trim()) $('#c-isi').value = isi;
    }
    $('#c-isi-teks').hidden = jenis === 'tugas';
    $('#c-isi-tugas').hidden = jenis !== 'tugas';
    tinggiIsiCatatan();
    if (jenis === 'tugas') { const kosong = [...document.querySelectorAll('#c-tugas input')].find(x => !x.value); if (kosong) kosong.focus(); }
  },
  'c-tugas-tambah': () => tambahBarisTugas(),
  'suara-catatan': () => mulaiDikte(),
  'c-tugas-centang': el => {
    const baris = el.closest('.baris-tugas');
    baris.classList.toggle('selesai');
    el.setAttribute('aria-checked', baris.classList.contains('selesai'));
  },
  'c-tugas-hapus': el => {
    const baris = el.closest('.baris-tugas');
    if (document.querySelectorAll('#c-tugas .baris-tugas').length > 1) baris.remove();
    else { baris.querySelector('input').value = ''; baris.classList.remove('selesai'); }
  },
});

// Enter di item = item baru di bawahnya; Backspace di item kosong = hapus & pindah ke item sebelumnya.
document.addEventListener('keydown', e => {
  const input = e.target.closest && e.target.closest('#c-tugas .baris-tugas input');
  if (!input) return;
  const baris = input.closest('.baris-tugas');
  if (e.key === 'Enter') {
    e.preventDefault();
    tambahBarisTugas(baris);
  } else if (e.key === 'Backspace' && !input.value && document.querySelectorAll('#c-tugas .baris-tugas').length > 1) {
    e.preventDefault();
    const sebelum = baris.previousElementSibling || baris.nextElementSibling;
    baris.remove();
    const x = sebelum && sebelum.querySelector('input');
    if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); }
  }
});

/**
 * Form catatan sebagai halaman penuh (tab 'catatan-edit'). c: catatan yang diubah (null = baru); tanggal: untuk catatan baru.
 * Isian disimpan di S.formCatatan & dibaca ulang dari layar sebelum render, supaya muat ulang data di latar tidak menghapus ketikan.
 */
function bukaFormCatatan(c, tanggal) {
  const x = c || { judul: '', isi: '', tanggal: tanggal || hariIni(), pengingat: true, ulang: '', warna: 'biru' };
  const tugas = bacaTugas(x.isi);
  S.formCatatan = {
    id: c ? c.id : '', oleh: c ? c.oleh : '', judul: x.judul, tanggal: x.tanggal, pengingat: x.pengingat, ulang: x.ulang,
    warna: x.warna || 'biru', jenis: tugas ? 'tugas' : 'teks', isi: tugas ? '' : x.isi, tugas: tugas || [{ teks: '', selesai: false }],
    fokus: !c,
  };
  const draf = bacaDrafCatatan(S.formCatatan.id);
  S.formCatatan.awal = jejakCatatan(S.formCatatan);
  if (draf) {
    Object.assign(S.formCatatan, draf);
    setTimeout(() => toast(T('📝 Isian yang belum disimpan dipulihkan'), false, { label: T('Buang'), aksi: 'buang-draf-catatan' }), 300);
  }
  bukaHalaman('catatan-edit');
}

// ---------- Catatan tanpa sinyal: disimpan di HP, dikirim otomatis saat online ----------
const catatanTertunda = () => bacaLokal('catatan_tertunda', []).filter(bukuIni);
function antreCatatan(input, idLama) {
  const x = Object.assign({}, input, { id: input.id || crypto.randomUUID(), buku: S.data.spreadsheetId });
  tulisLokal('catatan_tertunda', bacaLokal('catatan_tertunda', []).filter(c => c.id !== x.id).concat([x]));
  // Tampil langsung di kalender (data lokal), sebelum terkirim.
  const daftar = S.data.catatan || (S.data.catatan = []);
  const lokal = { id: x.id, tanggal: x.tanggal, judul: x.judul, isi: x.isi, pengingat: x.pengingat, ulang: x.ulang, warna: x.warna, oleh: S.data.user, tertunda: true };
  const i = daftar.findIndex(c => c.id === x.id);
  if (i >= 0) daftar[i] = lokal; else daftar.push(lokal);
  tulisLokal('data', S.data);
  buangDrafCatatan(idLama);
  toast(T('📴 Catatan disimpan di HP. Dikirim otomatis begitu ada sinyal.'));
  bukaKalender(x.tanggal);
  return true;
}
let mengirimCatatan = false;
async function kirimCatatanTertunda() {
  if (mengirimCatatan || !GOOGLE.sudahMasuk() || !catatanTertunda().length) return;
  mengirimCatatan = true;
  let terkirim = 0;
  try {
    for (const c of catatanTertunda()) {
      const input = Object.assign({}, c);
      delete input.buku;
      await api('simpanCatatan', input);
      tulisLokal('catatan_tertunda', bacaLokal('catatan_tertunda', []).filter(x => x.id !== c.id));
      terkirim++;
    }
  } catch (e) { /* sinyal putus lagi: dicoba lain kali */ }
  mengirimCatatan = false;
  if (terkirim) { toast(T('{n} catatan terkirim ✔', { n: terkirim })); muat(); }
}

// ---------- Draf catatan (tersimpan di HP selama belum disimpan ke spreadsheet) ----------
const kunciDrafCatatan = id => 'dk_draf_catatan_' + (S.data && S.data.spreadsheetId || '') + '_' + (id || 'baru');
const jejakCatatan = f => JSON.stringify([f.judul, f.jenis === 'tugas' ? '' : f.isi, f.jenis === 'tugas' ? tulisTugas(f.tugas || []) : '',
  f.jenis, f.tanggal, f.pengingat, f.ulang, f.warna]);
function bacaDrafCatatan(id) {
  try {
    const d = JSON.parse(bacaHp(kunciDrafCatatan(id)));
    return d && Date.now() - d.waktu < 14 * 864e5 ? d.isian : null;
  } catch (e) { return null; }
}
function buangDrafCatatan(id) { tulisHp(kunciDrafCatatan(id), null); }
/** Dipanggil saat mengetik / mengubah opsi: simpan draf kalau berbeda dari isi awal, hapus kalau sama. */
function catatDrafCatatan() {
  const f = S.formCatatan;
  if (!f || !$('#c-judul')) return;
  simpanDraftCatatan();
  if (jejakCatatan(f) === f.awal) return buangDrafCatatan(f.id);
  tulisHp(kunciDrafCatatan(f.id), JSON.stringify({ waktu: Date.now(), isian: {
    judul: f.judul, isi: f.isi, tugas: f.tugas, jenis: f.jenis, tanggal: f.tanggal, pengingat: f.pengingat, ulang: f.ulang, warna: f.warna,
  } }));
}
let timerDrafCatatan = 0;
document.addEventListener('input', e => {
  if (S.tab !== 'catatan-edit' || !e.target.closest || !e.target.closest('.form-catatan')) return;
  clearTimeout(timerDrafCatatan);
  timerDrafCatatan = setTimeout(catatDrafCatatan, 400);
});
document.addEventListener('click', e => {
  if (S.tab === 'catatan-edit' && e.target.closest && e.target.closest('.form-catatan [data-aksi]')) setTimeout(catatDrafCatatan, 50);
});
document.addEventListener('change', e => {
  if (S.tab === 'catatan-edit' && e.target.closest && e.target.closest('.form-catatan')) setTimeout(catatDrafCatatan, 50);
});
/** Keluar dari form catatan tanpa menyimpan: isian tetap ada sebagai draf. */
function tinggalkanFormCatatan() {
  if (S.tab !== 'catatan-edit' || !S.formCatatan) return;
  catatDrafCatatan();
  if (bacaDrafCatatan(S.formCatatan.id)) toast(T('📝 Belum disimpan · isian disimpan sebagai draf'), false, { label: T('Lanjutkan'), aksi: 'lanjut-draf-catatan' });
  S.drafTerakhir = { id: S.formCatatan.id, tanggal: S.formCatatan.tanggal };
}

/** Ambil isian form yang sedang tampil ke S.formCatatan (dipanggil sebelum render ulang & saat ganti jenis). */
function simpanDraftCatatan() {
  const f = S.formCatatan;
  if (!f || !$('#c-judul')) return;
  f.judul = $('#c-judul').value;
  f.tanggal = $('#c-tanggal').value || f.tanggal;
  f.isi = $('#c-isi').value;
  f.tugas = tugasDariForm();
}

// [nilai, label pendek di chip, teks pilihan]
const LABEL_ULANG = [['', T('Sekali'), T('Tidak berulang')], ['Mingguan', namaT('Mingguan'), T('Tiap minggu')], ['Bulanan', namaT('Bulanan'), T('Tiap bulan')], ['Tahunan', namaT('Tahunan'), T('Tiap tahun')]];

function viewFormCatatan() {
  const f = S.formCatatan;
  if (!f) { S.tab = 'catatan'; return viewCatatan(); }
  const tugas = f.jenis === 'tugas';
  return `
    <div class="kepala kepala-kembali kepala-form-catatan">
      <button class="tombol-ikon" data-aksi="keluar-catatan" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${f.id ? T('Ubah catatan') : T('Catatan baru')}</h1>
    </div>
    <div class="form-catatan" style="--w:${warnaCatatan(f.warna)}">
      <input class="judul-catatan" id="c-judul" maxlength="80" enterkeyhint="next" placeholder="${T('Judul')}" value="${esc(f.judul)}" aria-label="${T('Judul')}">

      <div class="saklar-jenis" id="c-jenis" data-jenis="${f.jenis}" role="tablist" aria-label="${T('Jenis catatan')}">
        <button type="button" role="tab" aria-selected="${!tugas}" class="${tugas ? '' : 'aktif'}" data-aksi="c-jenis" data-v="teks">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/></svg>${T('Teks')}</button>
        <button type="button" role="tab" aria-selected="${tugas}" class="${tugas ? 'aktif' : ''}" data-aksi="c-jenis" data-v="tugas">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1.2 1.2L8 6M12 7h9"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M12 17h9"/></svg>${T('Daftar tugas')}</button>
      </div>

      <div id="c-isi-teks" ${tugas ? 'hidden' : ''}>
        <textarea class="isi-catatan" id="c-isi" maxlength="2000" placeholder="${T('Tulis catatan… atau ketuk 🎤 untuk bicara')}" aria-label="${T('Isi catatan')}">${esc(f.isi)}</textarea>
      </div>
      <div id="c-isi-tugas" ${tugas ? '' : 'hidden'}>
        <div id="c-tugas">${f.tugas.map(barisTugasForm).join('')}</div>
        <button type="button" class="tombol-tambah-tugas" data-aksi="c-tugas-tambah">${T('＋ Tambah item')}</button>
      </div>

      ${f.oleh ? `<p class="oleh-catatan">${T('Dibuat oleh {nama}', { nama: esc(namaPendek(f.oleh)) })}</p>` : ''}

      <!-- Bilah bawah menempel (ikut naik di atas keyboard): opsi ringkas + Hapus/Simpan, mudah dijangkau jempol. -->
      <div class="bilah-catatan">
        <div class="pratinjau-dikte" id="pratinjau-dikte" role="status" aria-live="polite" hidden></div>
        <div class="opsi-catatan">
          <label class="chip-opsi">📅 <span id="c-tanggal-label">${esc(labelHariPendek(f.tanggal))}</span>
            <input type="date" id="c-tanggal" value="${f.tanggal}" aria-label="${T('Tanggal')}"></label>
          <button type="button" class="chip-opsi ${f.pengingat ? 'nyala' : ''}" data-aksi="c-pengingat" role="switch" aria-checked="${f.pengingat}">${f.pengingat ? T('🔔 Ingatkan') : T('🔕 Ingatkan')}</button>
          <label class="chip-opsi ${f.ulang ? 'nyala' : ''}">🔁 <span id="c-ulang-label">${LABEL_ULANG.find(u => u[0] === f.ulang)[1]}</span>
            <select id="c-ulang" aria-label="${T('Ulangi')}">${LABEL_ULANG.map(([v, , l]) => `<option value="${v}" ${f.ulang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <button type="button" class="chip-opsi" data-aksi="c-warna" aria-label="${T('Ganti warna (sekarang {warna})', { warna: esc(NAMA_WARNA[f.warna] || f.warna) })}"><i class="titik-warna"></i></button>
        </div>
        <div class="aksi-catatan">
          ${(window.SpeechRecognition || window.webkitSpeechRecognition) ? `<button type="button" class="tombol-dikte" id="tombol-dikte" data-aksi="suara-catatan" aria-label="${T('Tulis dengan suara')}">
            <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}
          ${f.id ? `<button type="button" class="btn btn-hapus btn-hapus-catatan" data-aksi="hapus-catatan">${T('🗑 Hapus')}</button>` : ''}
          <button type="button" class="btn btn-utama" data-aksi="simpan-catatan">${T('Simpan')}</button>
        </div>
      </div>
    </div>`;
}

// ---------- Dikte suara di catatan ----------
// Setiap kalimat yang selesai diucapkan DITAMBAHKAN ke isi catatan (tidak pernah menimpa). Satu kali tekan mic =
// satu sesi: mulai di baris baru, kalimat berikutnya disambung dengan spasi. Mic tetap mendengar sampai ditekan lagi
// (pengenal dimulai ulang otomatis setelah jeda). Di mode Daftar tugas, tiap kalimat jadi item baru.
var dikte = { aktif: false, r: null, awalSesi: true, tahap: '', sementara: '', galat: false };

function tampilDikte() {
  const tombol = $('#tombol-dikte'), pratinjau = $('#pratinjau-dikte');
  if (tombol) {
    tombol.classList.toggle('dengar', dikte.aktif);
    tombol.setAttribute('aria-label', dikte.aktif ? T('Berhenti merekam suara') : T('Tulis dengan suara'));
  }
  if (!pratinjau) return;
  pratinjau.hidden = !dikte.aktif;
  if (!dikte.aktif) return;
  pratinjau.innerHTML = `<span class="gelombang-suara kecil" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
    <span class="teks-dikte">${dikte.sementara ? '“' + esc(dikte.sementara) + '”'
      : dikte.tahap === 'siap' ? T('Menyalakan mikrofon…') : T('<b>Mic menyala</b> · bicara, teks ditambahkan ke catatan')}</span>
    <button type="button" class="tombol-teks" data-aksi="suara-catatan">${T('Selesai')}</button>`;
  pratinjau.dataset.tahap = dikte.sementara ? 'bicara' : dikte.tahap;
}

const hurufBesarAwal = t => t.charAt(0).toUpperCase() + t.slice(1);

function tambahTeksDikte(t) {
  t = t.trim();
  if (!t || !S.formCatatan) return;
  if (S.formCatatan.jenis === 'tugas') {
    const kosong = [...document.querySelectorAll('#c-tugas .baris-tugas input')].find(x => !x.value.trim());
    if (kosong) kosong.value = hurufBesarAwal(t);
    else {
      const tmp = document.createElement('div');
      tmp.innerHTML = barisTugasForm({ teks: hurufBesarAwal(t), selesai: false });
      $('#c-tugas').appendChild(tmp.firstElementChild);
    }
  } else {
    const ta = $('#c-isi');
    if (!ta) return;
    const ada = ta.value.replace(/\s+$/, '');
    const sambung = !ada ? '' : dikte.awalSesi ? '\n' : ' ';
    ta.value = ada + sambung + (dikte.awalSesi || !ada || /[.!?]$/.test(ada) ? hurufBesarAwal(t) : t);
    tinggiIsiCatatan();
    ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  dikte.awalSesi = false;
  simpanDraftCatatan();
}

function dengarLagi() {
  const Pengenal = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new Pengenal();
  r.lang = BAHASA === 'en' ? 'en-US' : 'id-ID';
  r.interimResults = true;
  r.maxAlternatives = 1;
  dikte.r = r;
  r.onaudiostart = () => { if (dikte.tahap === 'siap' && navigator.vibrate) navigator.vibrate(30); dikte.tahap = 'dengar'; tampilDikte(); };
  r.onresult = ev => {
    let sementara = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) tambahTeksDikte(t);
      else sementara += t;
    }
    dikte.sementara = sementara.trim();
    tampilDikte();
  };
  r.onerror = ev => {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return; // jeda biasa: dengar lagi
    dikte.galat = true;
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast(T('Izinkan akses mikrofon untuk menulis dengan suara.'), true);
    else if (ev.error === 'network') toast(T('Menulis dengan suara butuh sinyal internet.'), true);
    else toast(T('Mikrofon berhenti ({galat}).', { galat: ev.error }), true);
  };
  r.onend = () => {
    dikte.sementara = '';
    if (dikte.aktif && !dikte.galat && S.tab === 'catatan-edit') {
      try { dengarLagi(); return; } catch (e) { /* jatuh ke berhenti */ }
    }
    hentikanDikte();
  };
  r.start();
}

function mulaiDikte() {
  if (dikte.aktif) return hentikanDikte();
  Object.assign(dikte, { aktif: true, awalSesi: true, tahap: 'siap', sementara: '', galat: false });
  tampilDikte();
  try { dengarLagi(); } catch (e) { hentikanDikte(); toast(T('Mikrofon tidak bisa dipakai.'), true); }
}

function hentikanDikte() {
  const r = dikte.r;
  Object.assign(dikte, { aktif: false, r: null, tahap: '', sementara: '' });
  if (r) { r.onend = null; try { r.stop(); } catch (e) { /* sudah berhenti */ } }
  tampilDikte();
}

/** Textarea isi catatan ikut memanjang sesuai isi (halaman yang scroll, bukan kotaknya). */
function tinggiIsiCatatan() {
  const t = $('#c-isi');
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = Math.max(t.scrollHeight, 180) + 'px';
}
document.addEventListener('input', e => { if (e.target.id === 'c-isi') tinggiIsiCatatan(); });
document.addEventListener('change', e => {
  if (!S.formCatatan) return;
  if (e.target.id === 'c-tanggal' && e.target.value) {
    S.formCatatan.tanggal = e.target.value;
    $('#c-tanggal-label').textContent = labelHariPendek(e.target.value);
  }
  if (e.target.id === 'c-ulang') {
    S.formCatatan.ulang = e.target.value;
    $('#c-ulang-label').textContent = LABEL_ULANG.find(u => u[0] === e.target.value)[1];
    e.target.closest('.chip-opsi').classList.toggle('nyala', !!e.target.value);
  }
});

// ---------- Overlay pengingat ----------

let pengingatTampil = false;
let pengingatDilewatiHari = ''; // ditutup dengan tombol kembali: tidak dimunculkan lagi hari ini di sesi ini
const kunciPengingat = () => 'dk_ingat_' + (S.data && S.data.spreadsheetId || '');
const bacaPengingat = () => { try { return JSON.parse(bacaHp(kunciPengingat())) || {}; } catch (e) { return {}; } };

/** Pengingat yang perlu ditampilkan sekarang: [{ c, tgl }] (kejadian terakhir ≤ hari ini, maks. 7 hari lalu). */
function pengingatJatuhTempo() {
  const hari = hariIni();
  const status = bacaPengingat();
  const hasil = [];
  daftarCatatan().filter(c => c.pengingat).forEach(c => {
    for (let i = 0; i <= 7; i++) {
      const tgl = geserHari(hari, -i);
      if (!terjadiPada(c, tgl)) continue;
      const s = status[c.id + '|' + tgl] || '';
      const ditunda = s.startsWith('tunda:') && s.slice(6) > hari;
      if (s !== 'ok' && !ditunda) hasil.push({ c, tgl });
      break; // hanya kejadian terakhir
    }
  });
  return hasil.sort((a, b) => b.tgl.localeCompare(a.tgl));
}

function cekPengingat() {
  if (pengingatTampil || pengingatDilewatiHari === hariIni()) return;
  if (!S.data || S.data.perluSetup || !$('#kunci').hidden || !$('#sesi').hidden || !$('#tanya').hidden) return;
  const daftar = pengingatJatuhTempo();
  if (!daftar.length) return;
  tampilPengingat(daftar);
}

function tampilPengingat(daftar) {
  const { c, tgl } = daftar[0];
  let el = $('#ingat');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ingat';
    el.className = 'sesi ingat';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ingat-judul');
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="sesi-kartu ingat-kartu" style="--w:${warnaCatatan(c.warna)}">
      <span class="ingat-label">${T('🔔 Pengingat')} · ${esc(labelHariPendek(tgl))}${daftar.length > 1 ? ' · ' + T('1 dari {n}', { n: daftar.length }) : ''}</span>
      <b id="ingat-judul">${esc(c.judul)}</b>
      ${bacaTugas(c.isi) ? `<div class="ingat-isi">${daftarCentang(c, true)}</div>` : c.isi ? `<p class="ingat-isi">${esc(c.isi)}</p>` : ''}
      ${c.oleh ? `<small class="ingat-oleh">${T('Dari {nama}', { nama: esc(namaPendek(c.oleh)) })}${c.ulang ? ' · ' + T('berulang {ulang}', { ulang: namaT(c.ulang).toLowerCase() }) : ''}</small>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="ingat-ok" data-id="${esc(c.id)}" data-tgl="${tgl}">${T('Oke, sudah')}</button>
      <div class="ingat-aksi">
        <button type="button" class="tombol-teks" data-aksi="ingat-tunda" data-id="${esc(c.id)}" data-tgl="${tgl}">${T('Ingatkan besok')}</button>
        <button type="button" class="tombol-teks" data-aksi="ingat-lihat" data-tgl="${tgl}">${T('Lihat di kalender')}</button>
      </div>
    </div>`;
  el.hidden = false;
  pengingatTampil = true;
  getar();
}

function tutupPengingat(id, tgl, nilai) {
  if (id) {
    const status = bacaPengingat();
    status[id + '|' + tgl] = nilai;
    // Bersihkan status lama (> 60 hari) supaya penyimpanan tidak terus membesar.
    const batas = geserHari(hariIni(), -60);
    Object.keys(status).forEach(k => { if (k.split('|')[1] < batas) delete status[k]; });
    tulisHp(kunciPengingat(), JSON.stringify(status));
  }
  $('#ingat').hidden = true;
  pengingatTampil = false;
}

// ---------- Jadwal sholat & kiblat ----------

const NAMA_WAKTU = [['imsak', T('Imsak')], ['subuh', T('Subuh')], ['terbit', T('Terbit')], ['dzuhur', T('Dzuhur')], ['ashar', T('Ashar')], ['maghrib', T('Maghrib')], ['isya', T('Isya')]];
/** Nama arah mata angin dari SHOLAT.namaArah, diterjemahkan untuk tampilan. */
const NAMA_ARAH = {
  utara: T('utara'), 'timur laut': T('timur laut'), timur: T('timur'), tenggara: T('tenggara'),
  selatan: T('selatan'), 'barat daya': T('barat daya'), barat: T('barat'), 'barat laut': T('barat laut'),
};
const namaArahT = d => { const a = SHOLAT.namaArah(d); return NAMA_ARAH[a] || a; };
const WAKTU_SHOLAT = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const bacaLokasi = () => { try { return JSON.parse(bacaHp('dk_lokasi')); } catch (e) { return null; } };
const jamMenit = m => String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
const zonaHp = () => -new Date().getTimezoneOffset() / 60;

function jadwalHari(lok, tanggal) {
  return SHOLAT.hitung(tanggal || new Date(), lok.lat, lok.lng, zonaHp());
}

/** Sholat berikutnya dari sekarang: { kunci, nama, menit (jam), sisa (menit) }; lewat Isya → Subuh besok. */
function sholatBerikut(lok) {
  const kini = new Date();
  const m = kini.getHours() * 60 + kini.getMinutes();
  const j = jadwalHari(lok);
  const k = WAKTU_SHOLAT.find(x => j[x] > m);
  if (k) return { kunci: k, nama: NAMA_WAKTU.find(n => n[0] === k)[1], menit: j[k], sisa: j[k] - m };
  const besok = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + 1);
  const jb = jadwalHari(lok, besok);
  return { kunci: 'subuh', nama: T('Subuh'), menit: jb.subuh, sisa: jb.subuh + 1440 - m };
}

const teksSisa = n => (n >= 60 ? T('{j} j {m} m lagi', { j: Math.floor(n / 60), m: n % 60 }) : T('{m} m lagi', { m: n % 60 }));

/** Kota terdekat dari koordinat (untuk nama lokasi GPS), kalau dalam 60 km. */
function kotaTerdekat(lat, lng) {
  let terbaik = null;
  SHOLAT.KOTA.forEach(([nama, a, b]) => {
    const km = Math.hypot((a - lat) * 111, (b - lng) * 111 * Math.cos(lat * Math.PI / 180));
    if (!terbaik || km < terbaik.km) terbaik = { nama, km };
  });
  return terbaik && terbaik.km < 60 ? terbaik.nama : '';
}

function bukaSholat() {
  bukaHalaman('sholat');
}

function viewSholat() {
  const kepala = `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Jadwal Sholat & Kiblat')}</h1>
    </div>`;
  const lok = bacaLokasi();
  if (!lok) {
    return kepala + `
    <section class="kartu halaman-sholat">
      <p style="margin-top:0">${T('Jadwal sholat dan arah kiblat dihitung dari lokasi Anda, langsung di HP (tanpa internet).')}</p>
      <div class="aksi-form" style="margin-bottom:14px"><button type="button" class="btn btn-utama" data-aksi="lokasi-gps">${T('📍 Pakai lokasi saya')}</button></div>
      ${pilihKota()}
    </section>`;
  }
  // Satu layar penuh tanpa scroll: jadwal ringkas di atas, kompas mengisi sisa tinggi layar.
  const j = jadwalHari(lok);
  const s = sholatBerikut(lok);
  const kiblat = SHOLAT.arahKiblat(lok.lat, lok.lng);
  const tanggal = new Date().toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="hal-sholat">${kepala}
    <div class="sholat-kepala">
      <div><small>${esc(tanggal)}</small><b>📍 ${esc(lok.nama)}</b></div>
      <button type="button" class="chip" data-aksi="ganti-lokasi">${T('Ganti')}</button>
    </div>
    <div class="sholat-berikut">
      <div><small>${T('Berikutnya')}</small><b>${esc(s.nama)} · ${jamMenit(s.menit)}</b></div>
      <span data-sisa-sholat>${teksSisa(s.sisa)}</span>
    </div>
    <div class="jadwal-sholat">${WAKTU_SHOLAT.map(k => `
      <div class="${k === s.kunci ? 'berikut' : ''}"><span>${NAMA_WAKTU.find(n => n[0] === k)[1]}</span><b>${jamMenit(j[k])}</b></div>`).join('')}</div>
    <p class="sholat-pelengkap">${T('Imsak')} <b>${jamMenit(j.imsak)}</b> · ${T('Terbit')} <b>${jamMenit(j.terbit)}</b></p>
    <p class="sholat-pelengkap">${T("Metode Kemenag RI (Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyat 2 menit). Bisa berbeda 1–3 menit dengan jadwal masjid setempat.")}</p>

    <div class="area-kompas">${htmlKompas(kiblat)}${tombolKompas()}</div>
    <p class="teks-kiblat" id="teks-kiblat">${T('<b>Kiblat {derajat}°</b> dari utara', { derajat: Math.round(kiblat) })} · ${namaArahT(kiblat)}</p>
    <p class="sholat-pelengkap">${T('Letakkan HP mendatar dan jauhkan dari benda logam/magnet. Putar badan sampai 🕋 tepat di garis atas.')}</p>
  </div>`;
}

function pilihKota() {
  return `<div class="grup-form">
      <label class="label" for="pilih-kota">${T('Atau pilih kota terdekat')}</label>
      <select class="field" id="pilih-kota" data-pilih-kota>
        <option value="">${T('Pilih kota…')}</option>
        ${SHOLAT.KOTA.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}
      </select>
    </div>`;
}

function simpanLokasi(lok) {
  tulisHp('dk_lokasi', JSON.stringify(lok));
  bukaSholat();
}

// Kompas: arah HP dari sensor. Android (Chrome): deviceorientationabsolute; iPhone: webkitCompassHeading (perlu izin).
/**
 * Kompas kiblat. Piringan (skala, U/T/S/B, penanda 🕋) berputar mengikuti arah HP; huruf & 🕋 diputar balik supaya
 * tetap tegak. Segitiga di atas = arah depan HP. Busur di tepi = sisa putaran menuju kiblat.
 * Nilai sensor dihaluskan & dianimasikan per frame, dan tidak melompat saat melewati 359° → 0°.
 */
function htmlKompas(kiblat) {
  const huruf = [[T('U||kompas'), 0, 'u'], [T('T||kompas'), 90, ''], [T('S||kompas'), 180, ''], [T('B||kompas'), 270, '']];
  return `<div class="kompas ${statusKompas === 'aktif' ? 'hidup' : ''}" id="kompas" style="--kiblat:${kiblat.toFixed(1)}deg;--hp:${tampilHp.toFixed(1)}deg">
      <div class="kompas-riak" aria-hidden="true"><i></i><i></i></div>
      <div class="kompas-piringan" id="kompas-piringan">
        <div class="kompas-skala"></div>
        ${huruf.map(([h, d, c]) => `<div class="kompas-sudut" style="--a:${d}deg"><span class="mata-angin ${c}">${h}</span></div>`).join('')}
        <div class="kompas-sudut kompas-kiblat" style="--a:var(--kiblat)"><i class="garis-kiblat"></i><span class="ikon-kabah">🕋</span></div>
      </div>
      <div class="kompas-busur" aria-hidden="true"></div>
      <div class="penanda-atas" aria-hidden="true"></div>
      <div class="kompas-tengah" id="kompas-tengah" aria-live="polite">${isiTengahKompas(kiblat, null)}</div>
    </div>`;
}

function isiTengahKompas(kiblat, selisih) {
  if (selisih == null) return `<b>${Math.round(kiblat)}°</b><small>${namaArahT(kiblat)}</small>`;
  if (statusPas) return '<b class="cek">✓</b><small>' + T('Menghadap kiblat') + '</small>';
  return `<b>${Math.round(Math.abs(selisih))}°</b><small>${selisih > 0 ? T('putar ke kanan ↻') : T('putar ke kiri ↺')}</small>`;
}

// Tombol melayang di atas kompas & hilang saat kompas menyala.
// Status: 'mati' → 'menunggu' (izin diberikan, belum ada data sensor) → 'aktif'; 'tidak-ada' kalau sensor tak pernah mengirim data.
let statusKompas = 'mati';
let jenisKompas = '';
let statusPas = false;
let targetHp = 0;   // arah HP dari sensor, tidak "dibungkus" ke 0–360 supaya animasi tidak berputar balik
let tampilHp = 0;   // arah yang sedang digambar (mengejar targetHp)
let adaDataHp = false;
let frameKompas = 0;
let teksTengahTerakhir = '';
const LABEL_KOMPAS = {
  mati: T('🧭 Aktifkan kompas'),
  menunggu: T('⏳ Menunggu sensor kompas…'),
  aktif: T('🧭 Kompas aktif'),
  'tidak-ada': T('⚠️ HP ini tidak punya sensor kompas'),
};
function tombolKompas() {
  return `<button type="button" class="tombol-kompas ${statusKompas}" data-aksi="kompas" id="tombol-kompas"
    ${statusKompas === 'aktif' ? 'hidden' : ''}>${LABEL_KOMPAS[statusKompas]}</button>`;
}
function aturStatusKompas(st) {
  statusKompas = st;
  const t = $('#tombol-kompas');
  if (t) t.outerHTML = tombolKompas();
  const k = $('#kompas');
  if (k) k.classList.toggle('hidup', st === 'aktif');
}

function terimaArahHp(arah) {
  if (statusKompas === 'menunggu') aturStatusKompas('aktif');
  if (statusKompas !== 'aktif') return;
  if (!adaDataHp) { targetHp = tampilHp = arah; adaDataHp = true; }
  targetHp += ((arah - targetHp) % 360 + 540) % 360 - 180; // jalur terpendek ke arah baru
  if (!frameKompas) frameKompas = requestAnimationFrame(gambarKompas);
}

function gambarKompas() {
  frameKompas = 0;
  const kompas = $('#kompas');
  if (!kompas || statusKompas !== 'aktif') return;
  const sisa = targetHp - tampilHp;
  tampilHp = Math.abs(sisa) < 0.05 ? targetHp : tampilHp + sisa * 0.2; // pelembut gerak
  kompas.style.setProperty('--hp', tampilHp.toFixed(2) + 'deg');

  const kiblat = parseFloat(kompas.style.getPropertyValue('--kiblat')) || 0;
  const selisih = ((kiblat - tampilHp) % 360 + 540) % 360 - 180; // + = putar ke kanan
  const jarak = Math.abs(selisih);
  // Histeresis: masuk "pas" di bawah 3°, keluar baru di atas 6°, supaya tidak berkedip saat tangan bergetar.
  const pas = statusPas ? jarak < 6 : jarak < 3;
  if (pas && !statusPas && navigator.vibrate) navigator.vibrate([40, 60, 40]);
  statusPas = pas;
  kompas.classList.toggle('pas', pas);
  kompas.classList.toggle('dekat', !pas && jarak < 20);
  kompas.style.setProperty('--busur-mulai', (selisih < 0 ? selisih : 0).toFixed(2) + 'deg');
  kompas.style.setProperty('--busur', jarak.toFixed(2) + 'deg');
  const tengah = $('#kompas-tengah');
  const teks = isiTengahKompas(kiblat, selisih);
  if (tengah && teks !== teksTengahTerakhir) { tengah.innerHTML = teks; teksTengahTerakhir = teks; }
  if (tampilHp !== targetHp) frameKompas = requestAnimationFrame(gambarKompas);
}

function saatOrientasi(e) {
  if (typeof e.webkitCompassHeading === 'number') return terimaArahHp(e.webkitCompassHeading);
  if (e.absolute && typeof e.alpha === 'number') terimaArahHp(360 - e.alpha);
}

async function nyalakanKompas() {
  if (statusKompas === 'aktif' || statusKompas === 'menunggu') return matikanKompas();
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return toast(T('Izin sensor arah ditolak.'), true);
    }
  } catch (e) { return toast(T('Sensor arah tidak bisa diakses.'), true); }
  jenisKompas = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  adaDataHp = false;
  window.addEventListener(jenisKompas, saatOrientasi);
  aturStatusKompas('menunggu');
  setTimeout(() => {
    if (statusKompas !== 'menunggu') return;
    window.removeEventListener(jenisKompas, saatOrientasi);
    aturStatusKompas('tidak-ada');
    toast(T('Sensor kompas tidak terbaca. Pakai derajat di atas dengan kompas biasa.'), true);
  }, 3000);
}

/** Matikan kompas & kembalikan tampilan ke arah utara di atas (dipanggil juga saat meninggalkan halaman). */
function matikanKompas() {
  if (jenisKompas) window.removeEventListener(jenisKompas, saatOrientasi);
  jenisKompas = '';
  statusPas = false;
  adaDataHp = false;
  targetHp = tampilHp = 0;
  teksTengahTerakhir = '';
  if (frameKompas) cancelAnimationFrame(frameKompas);
  frameKompas = 0;
  const k = $('#kompas');
  if (k) {
    k.classList.remove('pas', 'dekat');
    k.style.setProperty('--hp', '0deg');
    k.style.setProperty('--busur', '0deg');
    const kiblat = parseFloat(k.style.getPropertyValue('--kiblat')) || 0;
    const tengah = $('#kompas-tengah');
    if (tengah) tengah.innerHTML = isiTengahKompas(kiblat, null);
  }
  aturStatusKompas('mati');
}

// Hitung mundur sholat di halaman jadwal, tiap 30 detik.
setInterval(() => {
  const lok = bacaLokasi();
  const el = document.querySelectorAll('[data-sisa-sholat]');
  if (!lok || !el.length) return;
  const s = sholatBerikut(lok);
  el.forEach(x => { x.textContent = teksSisa(s.sisa); });
}, 30000);

document.addEventListener('change', e => {
  if (!e.target.matches('[data-pilih-kota]') || e.target.value === '') return;
  const [nama, lat, lng] = SHOLAT.KOTA[Number(e.target.value)];
  simpanLokasi({ nama, lat, lng });
});

Object.assign(AKSI, {
  'kalender': () => bukaKalender(),
  'kal-tgl': el => {
    S.kal.pilih = el.dataset.tgl;
    S.kal.bulan = el.dataset.tgl.slice(0, 7);
    renderKalender();
  },
  'kal-bulan': el => gantiBulanKalender(Number(el.dataset.geser)),
  'tambah-catatan': () => bukaFormCatatan(null, S.kal && S.kal.pilih),
  'ubah-catatan': el => {
    const c = daftarCatatan().find(x => x.id === el.dataset.id);
    if (c) bukaFormCatatan(c);
  },
  'c-pengingat': el => {
    const on = S.formCatatan.pengingat = !S.formCatatan.pengingat;
    el.setAttribute('aria-checked', on);
    el.classList.toggle('nyala', on);
    el.textContent = on ? T('🔔 Ingatkan') : T('🔕 Ingatkan');
  },
  'c-warna': el => { // ketuk = warna berikutnya
    const i = WARNA_CATATAN.findIndex(w => w[0] === S.formCatatan.warna);
    S.formCatatan.warna = WARNA_CATATAN[(i + 1) % WARNA_CATATAN.length][0];
    el.setAttribute('aria-label', T('Ganti warna (sekarang {warna})', { warna: NAMA_WARNA[S.formCatatan.warna] || S.formCatatan.warna }));
    const f = $('.form-catatan');
    if (f) f.style.setProperty('--w', warnaCatatan(S.formCatatan.warna));
  },
  'simpan-catatan': async el => {
    hentikanDikte();
    simpanDraftCatatan();
    const f = S.formCatatan;
    const input = {
      id: f.id, judul: f.judul, tanggal: f.tanggal, pengingat: f.pengingat, ulang: f.ulang, warna: f.warna,
      isi: f.jenis === 'tugas' ? tulisTugas(f.tugas) : f.isi,
    };
    if (!input.judul.trim()) return toast(T('Isi judul catatannya dulu.'), true);
    if (S.offline || !navigator.onLine) return antreCatatan(input, f.id);
    if (await kirim(el, 'simpanCatatan', [input], input.pengingat ? T('Pengingat tersimpan 🔔') : T('Catatan tersimpan ✔'),
      e => e.jaringan && antreCatatan(input, f.id))) {
      buangDrafCatatan(f.id);
      bukaKalender(input.tanggal);
    }
  },
  'hapus-catatan': async el => {
    const tgl = S.formCatatan.tanggal;
    const idDraf = S.formCatatan.id;
    const ok = await kirim(el, 'hapusCatatan', [S.formCatatan.id], baris => {
      catatanTerhapus = baris;
      toast(T('Catatan dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-catatan' });
    });
    if (ok) { buangDrafCatatan(idDraf); bukaKalender(tgl); }
  },
  'urungkan-catatan': el => {
    const baris = catatanTerhapus;
    catatanTerhapus = null;
    $('#toast').hidden = true;
    if (baris) kirim(el, 'kembalikanCatatan', [baris], T('Catatan dikembalikan'));
  },
  'ingat-ok': el => { tutupPengingat(el.dataset.id, el.dataset.tgl, 'ok'); setTimeout(cekPengingat, 300); },
  'ingat-tunda': el => {
    tutupPengingat(el.dataset.id, el.dataset.tgl, 'tunda:' + geserHari(hariIni(), 1));
    toast(T('Diingatkan lagi besok'));
    setTimeout(cekPengingat, 300);
  },
  'ingat-lihat': el => { tutupPengingat('', '', ''); pengingatDilewatiHari = hariIni(); bukaKalender(el.dataset.tgl); },
  'sholat': () => bukaSholat(),
  'ganti-lokasi': () => bukaSheet(T('Lokasi jadwal sholat'), `
    <div class="aksi-form" style="margin:0 0 14px"><button type="button" class="btn btn-utama" data-aksi="lokasi-gps">${T('📍 Pakai lokasi saya sekarang')}</button></div>
    ${pilihKota()}`),
  'lokasi-gps': el => {
    if (!navigator.geolocation) return toast(T('HP ini tidak mendukung lokasi. Pilih kota di bawah.'), true);
    el.disabled = true;
    el.textContent = T('📍 Mencari lokasi…');
    navigator.geolocation.getCurrentPosition(p => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      const kota = kotaTerdekat(lat, lng);
      simpanLokasi({ nama: kota ? T('Sekitar {kota}', { kota }) : T('Lokasi Anda ({lat}, {lng})', { lat: lat.toFixed(2), lng: lng.toFixed(2) }), lat, lng });
    }, err => {
      el.disabled = false;
      el.textContent = T('📍 Pakai lokasi saya');
      toast(err.code === 1 ? T('Izin lokasi ditolak. Pilih kota terdekat di bawah.') : T('Lokasi tidak ditemukan. Pilih kota terdekat di bawah.'), true);
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  },
  'kompas': () => nyalakanKompas(),
});

// Pengingat dicek setelah tampilan pertama, setelah PIN dibuka, dan saat aplikasi dibuka lagi (bisa sudah ganti hari).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(cekPengingat, 600);
});

// ---------- Tombol kembali (Android) ----------
// Satu entri riwayat "penjaga" selalu dipasang di atas halaman, supaya tombol kembali tidak langsung
// menutup aplikasi. Saat ditekan: tutup dialog/form → kembali ke Beranda → di Beranda harus ditekan
// 2× dalam JEDA_KELUAR_MS untuk keluar.

const JEDA_KELUAR_MS = 2000;
let adaPenjaga = !!(history.state && history.state.dkJaga); // halaman dimuat ulang: penjaganya masih ada
let timerPenjaga = 0;

function pasangPenjaga() {
  clearTimeout(timerPenjaga);
  if (adaPenjaga) return;
  history.pushState({ dkJaga: 1 }, '');
  adaPenjaga = true;
}

/** Menutup lapisan paling atas yang boleh ditutup dengan tombol kembali; true kalau ada yang ditutup. */
function tutupLapisanAtas() {
  if (kilas) { tutupKilasBalik(); return true; }
  if (tutupFoto()) return true;
  if ($('#ringkas-suara') && !$('#ringkas-suara').hidden) { tutupRingkasanSuara(); hasilSuara = null; return true; }
  if ($('#ingat') && !$('#ingat').hidden) {
    // Pengingat ditutup dengan tombol kembali: muncul lagi saat aplikasi dibuka besok / sesi berikutnya.
    tutupPengingat('', '', '');
    pengingatDilewatiHari = hariIni();
    return true;
  }
  if (!$('#tanya').hidden) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // = Batal
    return true;
  }
  if (!$('#loading').hidden) return true; // sedang menyimpan: jangan diganggu
  if (!$('#sheet').hidden) {
    tutupSheet();
    return true;
  }
  return false;
}

window.addEventListener('popstate', e => {
  if (e.state && e.state.dkJaga) { adaPenjaga = true; return; } // maju lagi ke entri penjaga
  adaPenjaga = false;
  if (tutupLapisanAtas()) return pasangPenjaga();
  if (S.tab === 'catatan-edit') { tinggalkanFormCatatan(); bukaKalender(S.formCatatan && S.formCatatan.tanggal); return pasangPenjaga(); }
  const bisaKeBeranda = S.data && !S.data.perluSetup && $('#kunci').hidden && $('#sesi').hidden && S.tab !== 'beranda';
  if (bisaKeBeranda) {
    S.tab = 'beranda';
    render();
    window.scrollTo(0, 0);
    return pasangPenjaga();
  }
  // Di Beranda: penjaga tidak dipasang dulu, jadi tekan kembali sekali lagi = keluar.
  toast(T('Tekan kembali sekali lagi untuk keluar'));
  timerPenjaga = setTimeout(pasangPenjaga, JEDA_KELUAR_MS);
});

// Chrome melewati (tidak berhenti di) entri riwayat yang dibuat sebelum pengguna menyentuh halaman,
// jadi penjaga baru dipasang setelah sentuhan pertama.
if (navigator.userActivation && navigator.userActivation.hasBeenActive) pasangPenjaga();
else document.addEventListener('pointerdown', function sentuhanPertama() {
  document.removeEventListener('pointerdown', sentuhanPertama);
  pasangPenjaga();
});

// ---------- Geser lembar ke bawah untuk menutup ----------
// Hanya dari garis pegangan & judul lembar, supaya tidak bentrok dengan menggulir isi form.

const geser = { awal: null, jarak: 0, waktu: 0 };
const panelSheet = () => $('#sheet .sheet-panel');

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || !e.target.closest('#sheet .grabber, #sheet .sheet-head') || e.target.closest('button')) return;
  geser.awal = e.touches[0].clientY;
  geser.jarak = 0;
  geser.waktu = Date.now();
  panelSheet().classList.add('ditarik');
  panelSheet().classList.remove('lepas');
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (geser.awal == null) return;
  geser.jarak = Math.max(0, e.touches[0].clientY - geser.awal);
  panelSheet().style.transform = `translate(-50%, ${geser.jarak}px)`;
}, { passive: true });

document.addEventListener('touchend', () => {
  if (geser.awal == null) return;
  const p = panelSheet();
  // Ditutup kalau digeser cukup jauh, atau dikibas cepat ke bawah.
  const kibas = geser.jarak > 40 && geser.jarak / Math.max(1, Date.now() - geser.waktu) > 0.6;
  const tutup = geser.jarak > Math.min(160, p.offsetHeight * 0.3) || kibas;
  geser.awal = null;
  p.classList.remove('ditarik');
  p.classList.add('lepas');
  p.style.transform = tutup ? 'translate(-50%, 100%)' : '';
  if (tutup) {
    setTimeout(() => {
      tutupSheet();
      p.classList.remove('lepas');
      p.style.transform = '';
    }, 200);
  }
});

// ---------- Getar singkat saat ada kesalahan (Android) ----------
const toastAsli = toast;
toast = function (pesan, error, tombol) { // eslint-disable-line no-func-assign
  if (error) { try { if (navigator.vibrate) navigator.vibrate([25, 40, 25]); } catch (e) { /* abaikan */ } }
  return toastAsli(pesan, error, tombol);
};

// Ketuk tanggal di kalender panas Laporan.
Object.assign(AKSI, {
  'hari-laporan': el => {
    const n = Number(el.dataset.n), k = Number(el.dataset.k);
    toast(`${labelHariPendek(el.dataset.tgl)}: ${n ? rp(n) + ' · ' + T('{n} transaksi', { n: k }) : T('tanpa pengeluaran 🌱')}`);
  },
});

// Pilihan tema (dropdown di Lainnya).
document.addEventListener('change', e => {
  if (e.target.id === 'pilih-bahasa') gantiBahasa(e.target.value);
  if (e.target.id === 'pilih-tema') { aturTema(e.target.value); render(); }
  if (e.target.id === 'pilih-ukuran') { aturUkuran(e.target.value); render(); }
});

// ---------- Mencatat dengan suara ----------
// Tombol 🎤 di kotak "ketik cepat": ucapkan "bakso dua puluh lima ribu pakai gopay", teksnya diisi lalu
// dibaca sama seperti ketikan biasa. Hanya muncul kalau browser mendukung (Chrome Android, Safari iOS).

const PengenalSuara = window.SpeechRecognition || window.webkitSpeechRecognition;
let suaraAktif = null;

function pasangTombolSuara() {
  const kotak = document.querySelector('.ketik-cepat');
  if (!PengenalSuara || !kotak || kotak.querySelector('.tombol-suara')) return;
  kotak.classList.add('ada-suara');
  setTimeout(() => petunjukSekali('mic', kotak.querySelector('.tombol-suara'), T('🎤 Ketuk lalu ucapkan, mis. <i>"bakso 25 ribu pakai gopay kemarin"</i>')), 700);
  kotak.insertAdjacentHTML('beforeend', '<button type="button" class="tombol-suara" data-aksi="suara" aria-label="' + T('Catat dengan suara') + '">'
    + '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>');
}
// Form dirender ulang berkali-kali; tombol dipasang setiap kotak ketik cepat muncul.
new MutationObserver(pasangTombolSuara).observe(document.getElementById('sheet-isi'), { childList: true, subtree: true });

/**
 * Panel di bawah kotak ketik cepat selama mikrofon dipakai.
 * tahap: 'siap' (menyalakan mic) → 'dengar' (mic menyala, belum ada suara) → 'bicara' (suara tertangkap).
 */
function panelSuara(tahap, teks) {
  const kotak = document.querySelector('.ketik-cepat');
  if (!kotak) return;
  kotak.classList.toggle('sedang-dengar', !!tahap);
  const tombol = kotak.querySelector('.tombol-suara');
  if (tombol) {
    tombol.classList.toggle('dengar', !!tahap);
    tombol.setAttribute('aria-label', tahap ? T('Berhenti mendengarkan') : T('Catat dengan suara'));
  }
  let panel = document.getElementById('panel-suara');
  if (!tahap) { if (panel) panel.remove(); return; }
  if (!panel) {
    kotak.insertAdjacentHTML('afterend', `<div class="panel-suara" id="panel-suara">
        <div class="kepala-panel-suara" role="status" aria-live="polite">
          <div class="gelombang-suara" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
          <div class="teks-suara"><b></b><span></span></div>
          <button type="button" class="tombol-teks" data-aksi="suara">${T('Selesai')}</button>
        </div>
        <div class="contoh-suara">
          <small>${T('Contoh yang bisa diucapkan <i>(ketuk untuk mencoba)</i>')}</small>
          <ul>${contohSuara().map(([kal, ket]) =>
            `<li><button type="button" data-aksi="contoh-suara" data-teks="${esc(kal)}"><span>“${esc(kal)}”</span><em>${esc(ket)}</em></button></li>`).join('')}</ul>
          <p>${T('Sebut <b>untuk apa</b>, <b>berapa</b>, dan <b>pakai dompet apa</b>. Tanggal & transfer diatur di form.')}</p>
        </div>
      </div>`);
    panel = document.getElementById('panel-suara');
  }
  panel.dataset.tahap = tahap;
  panel.querySelector('b').textContent = tahap === 'siap' ? T('Menyalakan mikrofon…') : tahap === 'dengar' ? T('Mic menyala, silakan bicara') : T('Mendengarkan…');
  panel.querySelector('.teks-suara span').textContent = teks || (tahap === 'bicara' ? '' : T('Ucapkan transaksinya seperti mengobrol'));
}

/**
 * Contoh kalimat untuk input suara, memakai nama dompet milik pengguna supaya bisa langsung dicoba.
 * Hanya pola yang memang dikenali bacaKetikCepat: nominal angka/kata/rb/jt/slang, nama dompet, kata pemasukan.
 */
function contohSuara() {
  const dompet = dompetBiasa().map(w => w.nama);
  const nonTunai = dompet.filter(n => !/tunai|cash|dompet/i.test(n));
  const d1 = nonTunai[0] || dompet[0] || 'GoPay';
  const d2 = nonTunai[1] || dompet[1] || d1;
  const tunai = dompet.find(n => /tunai|cash/i.test(n)) || dompet[0] || 'tunai';
  if (BAHASA === 'en') {
    // Contoh bahasa Inggris (dibaca bacaKetikCepat yang juga mengenali kata kunci Inggris).
    const cash = dompet.find(n => /tunai|cash/i.test(n)) ? namaT(tunai) : 'cash';
    return [
      [`Coffee 25k ${cash}`, 'Expense · Food & Drinks'],
      [`Lunch 50 thousand yesterday`, 'Expense · dated yesterday'],
      [`Gas 30k via ${d1}`, 'Expense · Transport'],
      [`Groceries 75k`, 'Expense · wallet selected in the form'],
      [`Electricity bill 350k via ${d2}`, 'Expense · Bills'],
      [`Medicine 45k via ${d1}`, 'Expense · Health'],
      [`Coffee 25k, parking 5k, gas 30k via ${d1}`, 'Several transactions at once'],
      [`Salary 5 million ${d2}`, 'Income · Salary'],
      [`Bonus 1.5 million`, 'Income · Bonus'],
      [`Fried rice 2 plates 40k`, 'Small numbers (2 plates) are not read as the amount'],
    ];
  }
  return [
    [`Bakso dua puluh lima ribu pakai ${d1}`, 'Pengeluaran · Makan & Minum'],
    [`Bensin motor 30 ribu ${tunai}`, 'Pengeluaran · Transportasi'],
    [`Belanja sayur di pasar 75rb`, 'Pengeluaran · dompet yang terpilih di form'],
    [`Bayar listrik tiga ratus lima puluh ribu ${d2}`, 'Pengeluaran · Tagihan'],
    [`Beli obat 45 ribu pakai ${d1}`, 'Pengeluaran · Kesehatan'],
    [`Parkir goceng`, 'Bahasa gaul: gopek, seceng, goceng, ceban, gocap, cepek'],
    [`Bakso 25 ribu, parkir goceng, bensin 30 ribu pakai ${d1}`, 'Beberapa transaksi sekaligus'],
    [`Belanja sayur 50 ribu Sabtu minggu lalu`, 'Tanggal: kemarin, Sabtu lalu, tanggal 1 bulan kemarin'],
    [`Gaji lima juta masuk ${d2}`, 'Pemasukan · Gaji'],
    [`Dapat bonus satu setengah juta`, 'Pemasukan · Bonus'],
    [`Nasi padang 2 bungkus 40 ribu`, 'Angka kecil (2 bungkus) tidak dianggap nominal'],
  ];
}

// ---------- Peringatan anggaran setelah menyimpan pengeluaran ----------

/** Pengeluaran yang baru disimpan membuat kategorinya ≥ 80% anggaran? → { teks, lewat }; selain itu null. */
function pesanAnggaran(t) {
  if (!t || t.tipe !== TIPE.KELUAR || !t.kategori || !S.data) return null;
  if (SERVER.periodeDari(t.tanggal, S.data.mulaiPeriode || 1) !== S.data.bulan) return null; // anggaran periode yang tampil
  const k = kategoriBeranggaran().find(x => x.nama === t.kategori);
  if (!k || !k.batas) return null;
  const pakai = pengeluaranPerKategori()[k.nama] || 0;
  const persen = Math.round(pakai / k.batas * 100);
  if (persen >= 100) return { lewat: true, teks: T('⛔ anggaran {kategori} lewat {jumlah}', { kategori: namaT(k.nama), jumlah: rp(pakai - k.batas) }) };
  if (persen >= 80) return { lewat: false, teks: T('⚠️ {kategori} sudah {persen}% anggaran (sisa {sisa})', { kategori: namaT(k.nama), persen, sisa: rp(k.batas - pakai) }) };
  return null;
}

// ---------- Geser transaksi: kiri = hapus, kanan = catat lagi ----------

let geserTrx = null;
const BATAS_GESER = 90;
document.addEventListener('pointerdown', e => {
  const kotak = e.target.closest && e.target.closest('.trx-geser');
  if (!kotak || e.button > 0 || e.pointerType === 'mouse') return;
  geserTrx = { kotak, x0: e.clientX, y0: e.clientY, dx: 0, arah: '' };
});
document.addEventListener('pointermove', e => {
  const g = geserTrx;
  if (!g) return;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (!g.arah) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    g.arah = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
    if (g.arah === 'x') g.kotak.classList.add('digeser');
  }
  if (g.arah !== 'x') return;
  g.dx = Math.max(-150, Math.min(150, dx));
  g.kotak.style.setProperty('--dx', g.dx + 'px');
  g.kotak.dataset.arah = g.dx < 0 ? 'hapus' : 'ulang';
  const lewat = Math.abs(g.dx) > BATAS_GESER;
  if (lewat !== g.kotak.classList.contains('lewat') && lewat && navigator.vibrate) navigator.vibrate(15);
  g.kotak.classList.toggle('lewat', lewat);
}, { passive: true });
function selesaiGeser() {
  const g = geserTrx;
  geserTrx = null;
  if (!g || g.arah !== 'x') return;
  const lewat = Math.abs(g.dx) > BATAS_GESER;
  g.kotak.classList.remove('digeser', 'lewat');
  g.kotak.style.setProperty('--dx', '0px');
  g.kotak.dataset.dicegah = '1'; // ketukan dari geseran ini tidak membuka form
  setTimeout(() => { delete g.kotak.dataset.dicegah; }, 60);
  if (!lewat) return;
  const tombol = g.kotak.querySelector('.trx');
  const t = S.data.transaksi.concat((S.cariData && S.cariData.transaksi) || []).find(x => x.id === tombol.dataset.id);
  if (!t) return;
  if (g.dx < 0) {
    g.kotak.classList.add('terhapus');
    kirim(tombol, 'hapusTransaksi', [t.id], baris => {
      trxTerhapus = baris;
      toast(T('Transaksi dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-hapus' });
    }).then(ok => { if (!ok) g.kotak.classList.remove('terhapus'); });
  } else {
    bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet, dompetTujuan: t.dompetTujuan,
      catatan: t.catatan, tanggal: hariIni() }, T('Catat lagi'));
  }
}
document.addEventListener('pointerup', selesaiGeser);
document.addEventListener('pointercancel', selesaiGeser);
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.trx-geser[data-dicegah]')) { e.stopPropagation(); e.preventDefault(); }
}, true);

// ---------- Kilas balik bulanan (gaya "story") ----------
// Muncul sekali saat aplikasi pertama dibuka di periode baru, untuk periode sebelumnya. Bisa diputar lagi dari Laporan.

let kilas = null; // { k, i, n, timer }
const kunciKilas = () => 'dk_kilas_' + (S.data && S.data.spreadsheetId || '');
let kilasDicek = false;

function cekKilasBalik() {
  if (kilas || kilasDicek || !S.data || S.data.perluSetup || S.tab !== 'beranda') return;
  kilasDicek = true;
  const lalu = bulanSebelum(periodeSekarang());
  const r = (S.data.bulanan || {})[lalu];
  if (!r || !(r.keluar || r.masuk) || bacaHp(kunciKilas()) === lalu) return;
  if (!$('#sheet').hidden || ($('#ingat') && !$('#ingat').hidden) || !$('#kunci').hidden || !$('#sesi').hidden) { kilasDicek = false; return; }
  tulisHp(kunciKilas(), lalu);
  bukaKilasBalik(lalu);
}

function slideKilas(k) {
  const r = ringkasBulan(k);
  const sebelum = ringkasBulan(bulanSebelum(k));
  const top = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v);
  const nama = namaPendek(S.data.user);
  const slide = [];
  slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">✨</span><small>${T('Kilas balik')}</small>
    <h2>${esc(namaBulan(k))}</h2><p>${T('Halo {nama}, yuk lihat ke mana uang keluarga pergi bulan itu 👀', { nama: esc(nama) })}</p></div>`);
  slide.push(`<div class="kilas-isi"><small>${T('Total pengeluaran')}</small><div class="kilas-angka keluar">${rp(r.keluar)}</div>
    <div class="kilas-baris"><span>${T('💰 Pemasukan')}</span><b>${rp(r.masuk)}</b></div>
    <div class="kilas-baris"><span>${r.masuk >= r.keluar ? T('🟢 Sisa') : T('🔴 Minus')}</span><b>${rp(Math.abs(r.masuk - r.keluar))}</b></div></div>`);
  if (top.length) {
    slide.push(`<div class="kilas-isi"><small>${T('Paling banyak untuk')}</small>
      <div class="kilas-ilus">${ilus(ikonKategori(top[0].n, TIPE.KELUAR))}</div>
      <h2>${esc(namaT(top[0].n))}</h2><p><b>${rp(top[0].v)}</b> · ${T('{persen}% dari pengeluaran', { persen: r.keluar ? Math.round(top[0].v / r.keluar * 100) : 0 })}</p>
      ${top.slice(1, 4).map((x, i) => `<div class="kilas-baris"><span>${i + 2}. ${esc(namaT(x.n))}</span><b>${rp(x.v)}</b></div>`).join('')}</div>`);
  }
  if (sebelum.keluar && r.keluar) {
    const p = Math.round((r.keluar - sebelum.keluar) / sebelum.keluar * 100);
    slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">${p > 0 ? '📈' : p < 0 ? '📉' : '⚖️'}</span>
      <small>${T('Dibanding {bulan}', { bulan: esc(namaBulan(bulanSebelum(k))) })}</small>
      <div class="kilas-angka ${p > 0 ? 'keluar' : 'masuk'}">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%</div>
      <p>${p > 0 ? T('Pengeluaran naik {jumlah}. Cek lagi kategori yang membengkak, ya.', { jumlah: rp(r.keluar - sebelum.keluar) })
        : p < 0 ? T('Hemat {jumlah} dari bulan sebelumnya. Mantap! 🎉', { jumlah: rp(sebelum.keluar - r.keluar) }) : T('Pengeluaran sama persis. Konsisten!')}</p></div>`);
  }
  const rasio = r.masuk ? Math.round((r.masuk - r.keluar) / r.masuk * 100) : null;
  slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">${rasio === null ? '📒' : rasio >= 20 ? '🏆' : rasio >= 0 ? '💪' : '🫶'}</span>
    <h2>${rasio === null ? T('Terus mencatat!') : rasio >= 20 ? T('Keuangan sehat!') : rasio >= 0 ? T('Masih aman') : T('Bulan yang berat')}</h2>
    <p>${rasio === null ? T('Catat pemasukan juga supaya rangkumannya lengkap.')
      : rasio >= 20 ? T('{persen}% pemasukan berhasil disisihkan. Pertahankan!', { persen: rasio })
      : rasio >= 0 ? T('Tersisa {persen}% pemasukan. Coba targetkan 20% bulan ini.', { persen: rasio })
      : T('Pengeluaran melebihi pemasukan. Pasang anggaran supaya bulan ini lebih terkendali.')}</p>
    <div class="kilas-aksi">
      <button type="button" class="btn btn-hapus" data-aksi="kilas-bagikan">${T('📤 Bagikan')}</button>
      <button type="button" class="btn btn-utama" data-aksi="kilas-tutup">${T('Mulai bulan ini 💪')}</button>
    </div></div>`);
  return slide;
}

function bukaKilasBalik(k) {
  const slide = slideKilas(k);
  let el = $('#kilas');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kilas';
    el.className = 'kilas';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', T('Kilas balik bulanan'));
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="kilas-bar">${slide.map(() => '<i><b></b></i>').join('')}</div>
    <button type="button" class="kilas-x" data-aksi="kilas-tutup" aria-label="${T('Tutup')}">✕</button>
    <div class="kilas-panggung">${slide.map((h, i) => `<section class="kilas-slide" data-i="${i}">${h}</section>`).join('')}</div>
    <button type="button" class="kilas-zona kiri" data-aksi="kilas-mundur" aria-label="${T('Sebelumnya')}"></button>
    <button type="button" class="kilas-zona kanan" data-aksi="kilas-maju" aria-label="${T('Berikutnya')}"></button>`;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  kilas = { k, i: -1, n: slide.length, timer: 0 };
  keSlideKilas(0);
}

function keSlideKilas(i) {
  if (!kilas) return;
  if (i >= kilas.n) return; // slide terakhir tetap tampil sampai ditutup
  kilas.i = Math.max(0, i);
  const el = $('#kilas');
  el.querySelectorAll('.kilas-slide').forEach((s, n) => s.classList.toggle('aktif', n === kilas.i));
  el.querySelectorAll('.kilas-bar i').forEach((b, n) => {
    b.className = n < kilas.i ? 'lewat' : n === kilas.i ? 'jalan' : '';
  });
  clearTimeout(kilas.timer);
  if (kilas.i < kilas.n - 1) kilas.timer = setTimeout(() => keSlideKilas(kilas.i + 1), 5000);
}

function tutupKilasBalik() {
  if (!kilas) return;
  clearTimeout(kilas.timer);
  kilas = null;
  const el = $('#kilas');
  if (el) el.hidden = true;
  document.body.style.overflow = '';
}

Object.assign(AKSI, {
  'kilas-maju': () => keSlideKilas(kilas ? kilas.i + 1 : 0),
  'kilas-mundur': () => keSlideKilas(kilas ? kilas.i - 1 : 0),
  'kilas-tutup': () => tutupKilasBalik(),
  'kilas-bagikan': async () => {
    const k = kilas && kilas.k;
    if (!k) return;
    try { await bagikanLaporan(k); } catch (e) { toast(T('Gambar tidak bisa dibuat: {pesan}', { pesan: pesanError(e) }), true); }
  },
  'kilas-putar': el => bukaKilasBalik(el.dataset.bulan),
});

// ---------- Ringkasan hasil suara ----------
// Setelah bicara, data yang terbaca ditampilkan dulu di kartu: Simpan langsung, Koreksi di form, atau Ulangi.

let hasilSuara = null; // { teks, h }
let urutanSuara = 0;   // hasil AI yang datang terlambat (sudah bicara lagi) diabaikan

/** Wadah kartu ringkasan (dibuat sekali). */
function kartuRingkasSuara() {
  let el = $('#ringkas-suara');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ringkas-suara';
    el.className = 'sesi ringkas-suara';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ringkas-judul');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Hasil suara final → kartu ringkasan. Kalau ada kunci Gemini, kalimat dipahami AI dulu (bisa tanggal, transfer,
 * kalimat bebas); gagal / offline / tanpa kunci → aturan biasa (bacaKetikCepat).
 */
async function tampilRingkasanSuara(teks) {
  if (!F) return;
  const urutan = ++urutanSuara;
  let h = null;
  let daftarAi = null;
  if ((S.data.kunciGemini || []).length && navigator.onLine) {
    const el = kartuRingkasSuara();
    el.innerHTML = `
      <div class="sesi-kartu kartu-ringkas memahami">
        <span class="label-ringkas" id="ringkas-judul">${T('🤖 Memahami kalimat…')}</span>
        <p class="kutipan-suara">“${esc(teks)}”</p>
        <div class="bilah-memahami"><i></i></div>
        <button type="button" class="tombol-teks" data-aksi="ringkas-tanpa-ai">${T('Lewati, baca tanpa AI')}</button>
      </div>`;
    el.hidden = false;
    lewatiAi = false;
    try {
      const konteks = {
        hariIni: hariIni(),
        kategori: S.data.kategori.map(k => ({ nama: k.nama, tipe: k.tipe })),
        dompet: dompetBiasa().map(w => w.nama),
        tabungan: S.data.dompet.filter(w => !dompetBiasa().includes(w) && w.jenis !== JENIS.UTANG).map(w => w.nama),
      };
      const r = await Promise.race([
        api('pahamiKalimat', teks, konteks),
        new Promise((_, gagal) => setTimeout(() => gagal(new Error('lama')), 12000)),
        new Promise((_, gagal) => { tungguLewati = () => gagal(new Error('dilewati')); }),
      ]);
      if (r) {
        const t = bacaTanggalLisan(angkaDariKata(teks)).tanggal;
        daftarAi = (Array.isArray(r.transaksi) ? r.transaksi : [r]).slice(0, 8).map(x => {
          const y = rapikanHasilAi(x);
          if (t) y.tanggal = t;
          return y;
        }).filter(y => y.jumlah || y.catatan);
        h = daftarAi[0] || null;
      }
    } catch (e) {
      if (e.message !== 'dilewati') console.warn('AI suara gagal, pakai aturan biasa:', e.message);
    }
    if (urutan !== urutanSuara || !F || $('#ringkas-suara').hidden) return; // sudah ditutup / bicara lagi
  }
  const daftar = daftarAi && daftarAi.length ? daftarAi : pecahKalimat(teks.slice(0, 300));
  if (daftar.length > 1) return tampilBanyakSuara(teks, daftar);
  if (!h) h = daftar[0] || Object.assign(bacaKetikCepat(teks.slice(0, 300)), { sumber: 'aturan' });
  bacaFieldTrx();
  hasilSuara = { teks, h };
  // Pratinjau = isian form setelah hasil ini diterapkan (aturan sama dengan isiFormCepat).
  const x = Object.assign({}, F);
  if (h.tipe && h.tipe !== x.tipe) { x.tipe = h.tipe; x.kategori = ''; }
  if (h.jumlah) x.jumlah = h.jumlah;
  if (h.kategori) x.kategori = h.kategori;
  if (h.dompet && (x.tipe === TIPE.TRANSFER ? S.data.dompet : dompetBiasa()).some(w => w.nama === h.dompet)) x.dompet = h.dompet;
  if (h.dompetTujuan && x.tipe === TIPE.TRANSFER) x.dompetTujuan = h.dompetTujuan;
  if (h.tanggal) x.tanggal = h.tanggal;
  if (h.catatan) x.catatan = h.catatan;

  const kurang = [];
  if (!x.jumlah) kurang.push(T('Nominal belum terbaca'));
  if (x.tipe !== TIPE.TRANSFER && !x.kategori) kurang.push(T('Kategori belum dipilih'));
  if (x.tipe === TIPE.TRANSFER && (!x.dompetTujuan || x.dompetTujuan === x.dompet)) kurang.push(T('Pilih dompet tujuan di form'));
  const dompet = S.data.dompet.find(w => w.nama === x.dompet);
  const tujuan = S.data.dompet.find(w => w.nama === x.dompetTujuan);
  const masuk = x.tipe === TIPE.MASUK;
  const baris = (ikon, label, nilai, kosong) => `
      <div class="baris-ringkas ${kosong ? 'belum' : ''}"><span class="ikon-ringkas">${ikon}</span>
        <span class="isi"><small>${label}</small><b>${nilai}</b></span></div>`;

  const el = kartuRingkasSuara();
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas">
      <span class="label-ringkas" id="ringkas-judul">${h.sumber === 'ai' ? T('🤖 Dipahami AI · yang akan dicatat') : T('🎤 Yang akan dicatat')}</span>
      <p class="kutipan-suara">“${esc(teks)}”</p>
      <div class="nominal-ringkas ${masuk ? 'masuk' : x.tipe === TIPE.TRANSFER ? '' : 'keluar'} ${x.jumlah ? '' : 'belum'}">
        <small>${esc(namaT(x.tipe))}</small>${x.jumlah ? (masuk ? '+' : x.tipe === TIPE.TRANSFER ? '' : '−') + rp(x.jumlah) : 'Rp —'}</div>
      <div class="daftar-ringkas">
        ${x.tipe !== TIPE.TRANSFER ? baris(ilus(x.kategori ? ikonKategori(x.kategori, x.tipe) : '🏷️'), T('Kategori'), x.kategori ? esc(namaT(x.kategori)) : T('Belum dipilih'), !x.kategori) : ''}
        ${baris(ilus(dompet ? dompet.ikon : '👛'), x.tipe === TIPE.TRANSFER ? T('Dari dompet') : T('Dompet'), x.dompet ? esc(namaT(x.dompet)) : T('Belum dipilih'), !x.dompet)}
        ${x.tipe === TIPE.TRANSFER ? baris(ilus(tujuan ? tujuan.ikon : '👛'), T('Ke dompet'), x.dompetTujuan ? esc(namaT(x.dompetTujuan)) : T('Belum dipilih'), !x.dompetTujuan || x.dompetTujuan === x.dompet) : ''}
        ${x.catatan ? baris('📝', T('Catatan'), esc(x.catatan)) : ''}
        ${baris('📅', T('Tanggal'), esc(labelHariPendek(x.tanggal || hariIni())))}
      </div>
      ${kurang.length ? `<p class="peringatan-ringkas">⚠️ ${kurang.join(' · ')}</p>` : ''}
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-koreksi">${T('✏️ Koreksi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="ringkas-simpan" ${kurang.length ? 'disabled' : ''}>${T('✔ Simpan')}</button>
      </div>
      <button type="button" class="tombol-teks" data-aksi="ringkas-ulang">${T('🎤 Ulangi bicara')}</button>
    </div>`;
  el.hidden = false;
  getar();
  setTimeout(() => { const b = el.querySelector('[data-aksi="ringkas-simpan"]:not([disabled])') || el.querySelector('[data-aksi="ringkas-koreksi"]'); if (b) b.focus(); }, 50);
}

/**
 * Aturan biasa untuk kalimat berisi beberapa transaksi: "bakso 25rb, parkir 5rb dan bensin 30rb pakai gopay".
 * Dipecah di koma / "dan" / "terus" kalau tiap bagian punya nominal; dompet & tanggal yang disebut sekali berlaku untuk semua.
 */
function pecahKalimat(teks) {
  const utuh = Object.assign(bacaKetikCepat(teks), { sumber: 'aturan' });
  const bagian = angkaDariKata(teks).split(/\s*(?:,|;|\bdan\b|\bterus\b)\s*/i).map(x => x.trim()).filter(Boolean);
  if (bagian.length < 2) return [utuh];
  const hasil = bagian.map(b => Object.assign(bacaKetikCepat(b), { sumber: 'aturan' }));
  if (hasil.filter(x => x.jumlah).length < 2) return [utuh]; // bukan daftar transaksi, mis. "nasi dan teh 20rb"
  return hasil.filter(x => x.jumlah).map(x => Object.assign(x, {
    dompet: x.dompet || utuh.dompet,
    tanggal: x.tanggal || utuh.tanggal,
  }));
}

let banyakSuara = null; // [{ ...transaksi siap simpan, kurang: [] }]

/** Kartu ringkasan untuk beberapa transaksi sekaligus: tiap baris bisa dibuang (✕), lalu Simpan semua. */
function tampilBanyakSuara(teks, daftar) {
  bacaFieldTrx();
  banyakSuara = daftar.map(h => {
    const x = { tipe: h.tipe || TIPE.KELUAR, jumlah: h.jumlah, kategori: h.kategori || '', dompet: h.dompet || F.dompet,
      dompetTujuan: h.dompetTujuan || '', tanggal: h.tanggal || F.tanggal || hariIni(), catatan: h.catatan || '', sumber: h.sumber };
    if (x.tipe !== TIPE.TRANSFER && !(x.tipe === TIPE.KELUAR ? dompetBiasa() : dompetBiasa()).some(w => w.nama === x.dompet)) x.dompet = F.dompet;
    x.kurang = [];
    if (!x.jumlah) x.kurang.push(T('nominal'));
    if (x.tipe !== TIPE.TRANSFER && !x.kategori) x.kurang.push(T('kategori'));
    if (x.tipe === TIPE.TRANSFER && (!x.dompetTujuan || x.dompetTujuan === x.dompet)) x.kurang.push(T('dompet tujuan'));
    return x;
  });
  hasilSuara = { teks, banyak: true };
  gambarBanyakSuara(teks);
  getar();
}

function gambarBanyakSuara(teks) {
  const el = kartuRingkasSuara();
  const daftar = banyakSuara;
  const lengkap = daftar.filter(x => !x.kurang.length);
  const total = lengkap.filter(x => x.tipe === TIPE.KELUAR).reduce((a, x) => a + x.jumlah, 0);
  const ai = daftar.some(x => x.sumber === 'ai');
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas">
      <span class="label-ringkas" id="ringkas-judul">${ai ? T('🤖 Dipahami AI · {n} transaksi', { n: daftar.length }) : T('🎤 Terbaca · {n} transaksi', { n: daftar.length })}</span>
      <p class="kutipan-suara">“${esc(teks || hasilSuara.teks)}”</p>
      <div class="daftar-banyak">${daftar.map((x, i) => {
        const ikon = x.tipe === TIPE.TRANSFER ? '🔁' : x.kategori ? ikonKategori(x.kategori, x.tipe) : '🏷️';
        return `<div class="baris-banyak ${x.kurang.length ? 'belum' : ''}">
          <span class="ikon-ringkas">${ilus(ikon)}</span>
          <span class="isi"><b>${esc(x.catatan || namaT(x.kategori || x.tipe))}</b>
            <small>${x.kurang.length ? T('⚠️ {daftar} belum terbaca', { daftar: x.kurang.join(', ') })
              : esc([x.tipe === TIPE.TRANSFER ? namaT(x.dompet) + ' → ' + namaT(x.dompetTujuan) : namaT(x.kategori), x.tipe === TIPE.TRANSFER ? '' : namaT(x.dompet), labelHariPendek(x.tanggal)].filter(Boolean).join(' · '))}</small></span>
          <b class="nominal ${x.tipe === TIPE.MASUK ? 'masuk' : x.tipe === TIPE.TRANSFER ? '' : 'keluar'}">${x.jumlah ? (x.tipe === TIPE.MASUK ? '+' : x.tipe === TIPE.TRANSFER ? '' : '−') + rp(x.jumlah) : '—'}</b>
          <button type="button" class="buang-banyak" data-aksi="buang-banyak" data-i="${i}" aria-label="${T('Buang transaksi ini')}">✕</button>
        </div>`;
      }).join('')}</div>
      ${total ? `<div class="total-banyak"><span>${T('Total pengeluaran')}</span><b>${rp(total)}</b></div>` : ''}
      ${lengkap.length < daftar.length ? `<p class="peringatan-ringkas">${T('⚠️ Yang belum lengkap tidak ikut disimpan. Buang (✕) atau catat manual nanti.')}</p>` : ''}
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-ulang">${T('🎤 Ulangi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="simpan-banyak" ${lengkap.length ? '' : 'disabled'}>${lengkap.length > 1 ? T('✔ Simpan semua ({n})', { n: lengkap.length }) : T('✔ Simpan') + ' '}</button>
      </div>
    </div>`;
  el.hidden = false;
}

function tutupRingkasanSuara() {
  const el = $('#ringkas-suara');
  if (el) el.hidden = true;
}

/** Foto struk layar penuh (sebelum diunggah ke Drive). Ketuk di mana saja atau tombol kembali untuk menutup. */
function lihatFoto(src) {
  let el = $('#lihat-foto');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lihat-foto';
    el.className = 'lihat-foto';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', T('Foto struk||gambar'));
    el.dataset.aksi = 'tutup-foto';
    document.body.appendChild(el);
  }
  el.innerHTML = `<img src="${src}" alt="${T('Foto struk||gambar')}"><button type="button" class="tutup-foto" data-aksi="tutup-foto" aria-label="${T('Tutup')}">✕</button>`;
  el.hidden = false;
  setTimeout(() => el.querySelector('.tutup-foto').focus(), 50);
}

/** Foto lampiran yang sudah pernah dibuka / baru disimpan dari HP ini (data URL / object URL), supaya langsung tampil. */
const FOTO_TRX = {};   // ID transaksi → foto (yang baru disimpan dari HP ini)
const FOTO_DRIVE = {}; // ID file Drive → object URL (sudah pernah diunduh)
function fotoLampiranHp(idFile, idTrx) {
  return FOTO_DRIVE[idFile] || (idTrx && FOTO_TRX[idTrx]) || '';
}

/**
 * Membuka foto lampiran di aplikasi: diunduh lewat API Drive dengan login aplikasi (tanpa ditanya akun Google lagi).
 * Kalau gagal (mis. foto milik anggota lain yang belum bisa dibaca aplikasi), baru dibuka di Google Drive.
 */
async function lihatLampiranDrive(idFile, idTrx) {
  const ada = fotoLampiranHp(idFile, idTrx);
  if (ada) return lihatFoto(ada);
  lihatFoto('');
  const el = $('#lihat-foto');
  el.insertAdjacentHTML('afterbegin', '<p class="muat-foto">' + T('Memuat foto…') + '</p>');
  el.querySelector('img').remove();
  try {
    const blob = await api('ambilLampiran', idFile);
    FOTO_DRIVE[idFile] = URL.createObjectURL(blob);
    if (el.hidden) return; // sudah ditutup pengguna
    lihatFoto(FOTO_DRIVE[idFile]);
    if ($('#form-trx') && F && F.lampiran === idFile) renderFormTrx(); // tampilkan foto kecilnya di form
  } catch (e) {
    if (el.hidden) return;
    tutupFoto();
    if (e.jaringan) return toast(T('Butuh internet untuk membuka foto struk.'), true);
    window.open('https://drive.google.com/file/d/' + encodeURIComponent(idFile) + '/view', '_blank', 'noopener');
  }
}

function tutupFoto() {
  const el = $('#lihat-foto');
  if (!el || el.hidden) return false;
  el.hidden = true;
  el.innerHTML = ''; // lepas gambar besar dari memori
  return true;
}

Object.assign(AKSI, {
  'lihat-lampiran': () => {
    if (F && F.lampiranData) lihatFoto('data:image/jpeg;base64,' + F.lampiranData);
    else if (F && F.lampiran) lihatLampiranDrive(F.lampiran, F.id);
    else if (F && F.lampiranThumb) lihatFoto(F.lampiranThumb);
  },
  'tutup-foto': () => tutupFoto(),
});

/**
 * Kartu konfirmasi hasil foto struk (sama seperti hasil suara): Simpan langsung, Koreksi di form, atau Foto ulang.
 * Form transaksi sudah diisi terapkanStruk(); kartu ini hanya menampilkan isian F.
 */
function tampilRingkasanStruk() {
  if (!F || !F.struk) return;
  const h = F.struk;
  const dompet = S.data.dompet.find(w => w.nama === F.dompet);
  const kembar = teksStrukKembar();
  const kurang = [];
  if (!F.jumlah) kurang.push(T('Nominal belum terbaca'));
  if (!F.kategori) kurang.push(T('Kategori belum dipilih'));
  const baris = (ikon, label, nilai, kosong) => `
      <div class="baris-ringkas ${kosong ? 'belum' : ''}"><span class="ikon-ringkas">${ikon}</span>
        <span class="isi"><small>${label}</small><b>${nilai}</b></span></div>`;

  const el = kartuRingkasSuara();
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas">
      <span class="label-ringkas" id="ringkas-judul">${T('🧾 Struk terbaca · yang akan dicatat')}</span>
      <div class="kepala-ringkas-struk">
        <div class="nominal-ringkas keluar ${F.jumlah ? '' : 'belum'}"><small>${esc(namaT(F.tipe))}</small>${F.jumlah ? '−' + rp(F.jumlah) : 'Rp —'}</div>
        ${F.lampiranThumb ? `<button type="button" class="thumb-ringkas" data-aksi="lihat-lampiran" aria-label="${T('Lihat foto struk')}"><img src="${F.lampiranThumb}" alt=""></button>` : ''}
      </div>
      ${h.pilihanJumlah.length > 1 ? `
        <div class="pilih-total-ringkas"><small>${T('Total terbaca berbeda-beda, ketuk yang sesuai struk:')}</small>
          <div class="chips">${h.pilihanJumlah.map(p =>
            `<button type="button" class="chip ${p.jumlah === F.jumlah ? 'aktif' : ''}" data-aksi="ringkas-struk-jumlah" data-jumlah="${p.jumlah}">${rp(p.jumlah)}</button>`).join('')}</div>
        </div>` : ''}
      <p class="status-ringkas">${statusStruk(h)}</p>
      <div class="daftar-ringkas">
        ${baris(ilus(F.kategori ? ikonKategori(F.kategori, F.tipe) : '🏷️'), T('Kategori'), F.kategori ? esc(namaT(F.kategori)) : T('Belum dipilih'), !F.kategori)}
        ${baris(ilus(dompet ? dompet.ikon : '👛'), T('Dompet'), F.dompet ? esc(namaT(F.dompet)) : T('Belum dipilih'), !F.dompet)}
        ${F.catatan ? baris('📝', T('Catatan'), esc(F.catatan)) : ''}
        ${baris('📅', T('Tanggal'), esc(labelHariPendek(F.tanggal || hariIni())))}
      </div>
      ${kembar ? `<p class="peringatan-ringkas">${kembar}</p>` : ''}
      ${kurang.length ? `<p class="peringatan-ringkas">⚠️ ${kurang.join(' · ')}</p>` : ''}
      ${tombolPecahStruk(h)}
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-struk-koreksi">${T('✏️ Koreksi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="ringkas-struk-simpan" ${kurang.length ? 'disabled' : ''}>${T('✔ Simpan')}</button>
      </div>
      <button type="button" class="tombol-teks" data-aksi="ringkas-struk-ulang">${T('📷 Foto ulang')}</button>
    </div>`;
  el.hidden = false;
  setTimeout(() => { const b = el.querySelector('[data-aksi="ringkas-struk-simpan"]:not([disabled])') || el.querySelector('[data-aksi="ringkas-struk-koreksi"]'); if (b) b.focus(); }, 50);
}

Object.assign(AKSI, {
  'ringkas-struk-jumlah': el => {
    if (!F) return;
    bacaFieldTrx();
    F.jumlah = Number(el.dataset.jumlah);
    renderFormTrx();
    tampilRingkasanStruk();
  },
  'ringkas-struk-simpan': () => {
    tutupRingkasanSuara();
    const tombol = document.querySelector('#form-trx [data-aksi="simpan-trx"], #sheet [data-aksi="simpan-trx"]');
    if (F && tombol) AKSI['simpan-trx'](tombol);
  },
  // Form di belakang kartu sudah terisi: cukup tutup kartunya.
  'ringkas-struk-koreksi': () => {
    tutupRingkasanSuara();
    setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 50);
  },
  'ringkas-struk-ulang': () => {
    tutupRingkasanSuara();
    if (!F) return;
    bacaFieldTrx();
    // Hasil lama dibuang (juga dari antrian), supaya tidak bisa tercatat dobel.
    if (F.dariJob) hapusJob(F.dariJob);
    Object.assign(F, { jumlah: 0, kategori: '', catatan: '', struk: null, dariJob: null, lampiranData: '', lampiranThumb: '' });
    renderFormTrx();
    sumberStruk = 'form';
    $('#input-struk-kamera').click();
  },
});

let lewatiAi = false;
let tungguLewati = () => {};

/** Hasil Gemini dicek ulang terhadap data buku: nama harus persis ada, tanggal wajar, nominal bulat positif. */
function rapikanHasilAi(r) {
  const tipe = [TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].includes(r.tipe) ? r.tipe : TIPE.KELUAR;
  const ada = (daftar, n) => daftar.some(w => w.nama === n) ? n : '';
  const tanggalOk = /^\d{4}-\d{2}-\d{2}$/.test(r.tanggal || '') && !isNaN(keTanggal(r.tanggal))
    && r.tanggal <= geserHari(hariIni(), 1) && r.tanggal >= geserHari(hariIni(), -400);
  return {
    sumber: 'ai',
    tipe,
    jumlah: Math.max(0, Math.round(Number(r.jumlah) || 0)),
    kategori: tipe === TIPE.TRANSFER ? '' : ada(S.data.kategori.filter(k => k.tipe === tipe), r.kategori),
    dompet: ada(tipe === TIPE.TRANSFER ? S.data.dompet : dompetBiasa(), r.dompet),
    dompetTujuan: tipe === TIPE.TRANSFER ? ada(S.data.dompet, r.dompetTujuan) : '',
    tanggal: tanggalOk ? r.tanggal : '',
    catatan: String(r.catatan || '').trim().slice(0, 100),
  };
}

Object.assign(AKSI, {
  // Mengetuk contoh = seolah diucapkan: mic berhenti, kartu ringkasan muncul.
  'contoh-suara': el => {
    if (suaraAktif) { suaraAktif.onresult = null; try { suaraAktif.stop(); } catch (e) { /* sudah berhenti */ } }
    const input = $('#f-cepat');
    if (input) input.value = el.dataset.teks;
    tampilRingkasanSuara(el.dataset.teks);
  },
  'ringkas-tanpa-ai': () => { lewatiAi = true; tungguLewati(); },
  // Struk berisi beberapa kategori → kartu "Simpan semua" (sama dengan suara banyak transaksi).
  'pecah-struk': () => {
    if (!F || !F.struk || !(F.struk.rincian || []).length) return;
    bacaFieldTrx();
    const toko = String(F.catatan || F.struk.catatan || '').split(/\s+-\s+/)[0].trim();
    const daftar = F.struk.rincian.map(x => ({
      sumber: 'struk', tipe: TIPE.KELUAR, jumlah: x.jumlah, kategori: x.kategori, dompet: F.dompet, tanggal: F.tanggal,
      catatan: [toko, x.barang].filter(Boolean).join(' - ').slice(0, 100),
    }));
    tampilBanyakSuara(T('Struk {toko} · total {jumlah}', { toko: toko || '', jumlah: rp(F.jumlah) }), daftar);
    const label = $('#ringkas-judul');
    if (label) label.textContent = T('🧾 Struk dipecah · {n} transaksi', { n: daftar.length });
  },
  'buang-banyak': el => {
    if (!banyakSuara) return;
    banyakSuara.splice(Number(el.dataset.i), 1);
    if (!banyakSuara.length) { tutupRingkasanSuara(); banyakSuara = null; return; }
    gambarBanyakSuara();
  },
  'simpan-banyak': async el => {
    const daftar = (banyakSuara || []).filter(x => !x.kurang.length);
    if (!daftar.length) return;
    const job = F && F.dariJob; // struk dari antrean baca di latar: dibersihkan setelah tersimpan
    el.disabled = true;
    loading(true);
    let tersimpan = 0;
    try {
      for (const x of daftar) {
        await api('simpanTransaksi', { idBaru: crypto.randomUUID(), tipe: x.tipe, jumlah: x.jumlah, kategori: x.kategori, dompet: x.dompet,
          dompetTujuan: x.dompetTujuan, tanggal: x.tanggal, catatan: x.catatan });
        tersimpan++;
      }
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('{n} tersimpan, sisanya gagal: {pesan}', { n: tersimpan, pesan: pesanError(e) }), true);
    }
    loading(false);
    el.disabled = false;
    if (!tersimpan) return;
    tutupRingkasanSuara();
    banyakSuara = null;
    hasilSuara = null;
    if (job && typeof hapusJob === 'function') hapusJob(job);
    tutupSheet();
    await muat();
    if (tersimpan === daftar.length) toast(T('{n} transaksi tersimpan ✔', { n: tersimpan }));
  },
  'ringkas-simpan': () => {
    if (!hasilSuara || !F) return tutupRingkasanSuara();
    tutupRingkasanSuara();
    isiFormCepat(hasilSuara.h);
    hasilSuara = null;
    const tombol = document.querySelector('#form-trx [data-aksi="simpan-trx"], #sheet [data-aksi="simpan-trx"]');
    if (tombol) AKSI['simpan-trx'](tombol);
  },
  'ringkas-koreksi': () => {
    tutupRingkasanSuara();
    if (!hasilSuara || !F) return;
    $('#f-cepat') && ($('#f-cepat').value = hasilSuara.teks);
    isiFormCepat(hasilSuara.h);
    hasilSuara = null;
  },
  'ringkas-ulang': () => {
    tutupRingkasanSuara();
    hasilSuara = null;
    const t = document.querySelector('.tombol-suara');
    if (t) AKSI.suara(t);
  },
});

AKSI.suara = el => {
  if (suaraAktif) { suaraAktif.stop(); return; }
  const r = new PengenalSuara();
  r.lang = BAHASA === 'en' ? 'en-US' : 'id-ID';
  r.interimResults = true;
  r.maxAlternatives = 1;
  suaraAktif = r;
  panelSuara('siap');
  const input = $('#f-cepat');
  r.onaudiostart = () => { panelSuara('dengar'); if (navigator.vibrate) navigator.vibrate(30); };
  r.onspeechstart = () => panelSuara('bicara');
  r.onresult = ev => {
    const teks = Array.from(ev.results).map(x => x[0].transcript).join(' ').trim();
    if (input) input.value = teks;
    panelSuara('bicara', teks ? '“' + teks + '”' : '');
    if (ev.results[ev.results.length - 1].isFinal && teks) {
      try { r.stop(); } catch (e) { /* sudah berhenti */ }
      tampilRingkasanSuara(teks);
    }
  };
  r.onerror = ev => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast(T('Izinkan akses mikrofon untuk mencatat dengan suara.'), true);
    else if (ev.error === 'no-speech') toast(T('Suara tidak terdengar. Coba lagi lebih dekat ke HP.'), true);
    else if (ev.error === 'network') toast(T('Pengenalan suara butuh sinyal internet.'), true);
  };
  r.onend = () => {
    suaraAktif = null;
    panelSuara('');
  };
  try { r.start(); } catch (e) { suaraAktif = null; panelSuara(''); }
};

// ---------- Pintasan ikon aplikasi & berbagi dari aplikasi lain ----------
// manifest.webmanifest: "shortcuts" (tekan lama ikon) membuka ./?aksi=…, dan "share_target" (Bagikan → Dompet)
// diterima sw.js lalu dialihkan ke ./?dibagikan=1. Dijalankan setelah data pertama kali dimuat.

let luncurTertunda = location.search;

/** Menjalankan aksi dari URL peluncuran (sekali), lalu membersihkan URL-nya. */
async function jalankanLuncur() {
  if (!luncurTertunda || !S.data || S.data.perluSetup) return;
  const p = new URLSearchParams(luncurTertunda);
  luncurTertunda = '';
  if (p.has('aksi') || p.has('dibagikan')) history.replaceState(history.state, '', location.pathname);
  const aksi = p.get('aksi');
  if (aksi === 'keluar') bukaFormTrx(null, { tipe: TIPE.KELUAR });
  else if (aksi === 'masuk') bukaFormTrx(null, { tipe: TIPE.MASUK }, T('Catat Pemasukan'));
  else if (aksi === 'transfer') bukaFormTrx(null, { tipe: TIPE.TRANSFER }, T('Transfer'));
  else if (aksi === 'struk') {
    bukaFormTrx(null, { tipe: TIPE.KELUAR });
    toast(T('Ketuk 📷 Kamera atau 🖼️ Galeri untuk memotret struk'));
  }
  if (p.has('dibagikan')) await terimaBagikan();
}

/** Gambar / teks yang dibagikan dari aplikasi lain (disimpan sw.js di cache "dk-bagikan"). */
async function terimaBagikan() {
  let cache;
  try { cache = await caches.open('dk-bagikan'); } catch (e) { return; }
  const kunci = await cache.keys();
  const gambar = [];
  let teks = '';
  for (const k of kunci) {
    const r = await cache.match(k);
    if (/\/teks$/.test(k.url)) teks = await r.text();
    else gambar.push(new File([await r.blob()], 'dibagikan.jpg', { type: r.headers.get('content-type') || 'image/jpeg' }));
  }
  await caches.delete('dk-bagikan');
  if (gambar.length) {
    // Satu gambar: konfirmasi langsung muncul begitu terbaca; beberapa: ditinjau satu per satu dari antrian.
    gambar.slice(0, 5).forEach(f => mulaiStruk(f, false, gambar.length === 1));
    toast(gambar.length > 1 ? T('🧾 {n} gambar sedang dibaca', { n: Math.min(5, gambar.length) }) : T('🧾 Gambar sedang dibaca. Silakan lanjut pakai aplikasi.'));
  } else if (teks.trim()) {
    // Teks bukti transfer dari aplikasi bank, mis. "Transfer Rp50.000 ke Budi berhasil".
    bukaFormTrx(null, { tipe: TIPE.KELUAR });
    isiFormCepat(bacaKetikCepat(teks.trim().slice(0, 300)));
  }
}

// Aplikasi sudah terbuka (launch_handler focus-existing): URL pintasan diterima lewat launchQueue.
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(params => {
    if (!params || !params.targetURL) return;
    const u = new URL(params.targetURL);
    if (!u.search) return;
    luncurTertunda = u.search;
    jalankanLuncur();
  });
}

// ---------- Tarik ke bawah untuk memperbarui ----------
// Pengganti pull-to-refresh bawaan browser (dimatikan lewat overscroll-behavior di CSS): hanya data yang
// dibaca ulang dari spreadsheet, halaman tidak dimuat ulang. Jalan juga di aplikasi terpasang.

const JARAK_TARIK = 70;
const tarik = { awal: null, jarak: 0, memuat: false };
const indikatorTarik = document.createElement('div');
indikatorTarik.className = 'tarik';
indikatorTarik.innerHTML = '<div class="spinner kecil"></div>';
document.body.appendChild(indikatorTarik);

function aturIndikatorTarik() {
  const y = tarik.memuat ? JARAK_TARIK : Math.min(tarik.jarak, JARAK_TARIK * 1.4);
  indikatorTarik.style.transform = `translate(-50%, ${y - 50}px) rotate(${y * 4}deg)`;
  indikatorTarik.style.opacity = tarik.memuat ? 1 : Math.min(tarik.jarak / JARAK_TARIK, 1);
  indikatorTarik.classList.toggle('siap', tarik.memuat || tarik.jarak >= JARAK_TARIK);
  indikatorTarik.classList.toggle('memuat', tarik.memuat);
}

document.addEventListener('touchstart', e => {
  const bisa = !tarik.memuat && window.scrollY <= 0 && S.data && !S.data.perluSetup && !S.offline
    && $('#sheet').hidden && e.touches.length === 1;
  tarik.awal = bisa ? e.touches[0].clientY : null;
  tarik.jarak = 0;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (tarik.awal == null) return;
  if (window.scrollY > 0) { tarik.awal = null; tarik.jarak = 0; return aturIndikatorTarik(); }
  tarik.jarak = Math.max(0, (e.touches[0].clientY - tarik.awal) * 0.5);
  aturIndikatorTarik();
}, { passive: true });

document.addEventListener('touchend', async () => {
  if (tarik.awal == null) return;
  const cukup = tarik.jarak >= JARAK_TARIK;
  tarik.awal = null;
  tarik.jarak = 0;
  if (!cukup) return aturIndikatorTarik();
  tarik.memuat = true;
  aturIndikatorTarik();
  try { await muat(); } finally {
    tarik.memuat = false;
    aturIndikatorTarik();
  }
});

if (ukuranDipilih()) document.documentElement.dataset.ukuran = ukuranDipilih();
mulai();
