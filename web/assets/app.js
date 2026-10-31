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
};
/** Pilihan cepat di layar setup: [nama, ikon]. */
const DOMPET_UMUM = [['Tunai', '💵'], ['BCA', '🏦'], ['BRI', '🏦'], ['Mandiri', '🏦'], ['BNI', '🏦'], ['BSI', '🏦'],
  ['Jago', '🏦'], ['SeaBank', '🏦'], ['GoPay', '📱'], ['OVO', '📱'], ['DANA', '📱'], ['ShopeePay', '📱']];
let F = null; // state form yang sedang terbuka

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
  if (a >= 1e9) return f(n / 1e9, 'M');
  if (a >= 1e6) return f(n / 1e6, 'jt');
  if (a >= 1e3) return f(n / 1e3, 'rb');
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
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  kembali: '<path d="m15 18-6-6 6-6"/>',
};
const svg = nama => `<svg class="ik" viewBox="0 0 24 24" aria-hidden="true">${IKON[nama]}</svg>`;

const dompetBiasa = () => S.data.dompet.filter(w => w.jenis === JENIS.DOMPET);
const daftarUtang = () => S.data.dompet.filter(w => w.jenis === JENIS.UTANG);
const adalahUtang = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.UTANG);
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
  if (mulai === 1) return keTanggal(b).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const r = SERVER.rentangPeriode(b, mulai);
  const f = (s, opsi) => keTanggal(s).toLocaleDateString('id-ID', opsi);
  return f(r.awal, { day: 'numeric', month: 'short' }) + ' – ' + f(r.akhir, { day: 'numeric', month: 'short', year: 'numeric' });
}
/** Kunci periode yang sedang berjalan (mengikuti tanggal gajian). */
function periodeSekarang() {
  return S.data && S.data.mulaiPeriode > 1 ? SERVER.periodeDari(hariIni(), S.data.mulaiPeriode) : bulanSekarang();
}
function labelTanggal(s) {
  if (s === hariIni()) return 'Hari ini';
  const kemarin = new Date(); kemarin.setDate(kemarin.getDate() - 1);
  if (keTanggal(s).toDateString() === kemarin.toDateString()) return 'Kemarin';
  return keTanggal(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}
function namaPendek(email) {
  const n = String(email || '').split('@')[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
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

function loading(ya) { $('#loading').hidden = !ya; }
let timerToast;
function toast(pesan, error) {
  const el = $('#toast');
  el.textContent = pesan;
  el.className = 'toast' + (error ? ' error' : '');
  el.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.hidden = true; }, error ? 8000 : 2500);
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
  if (GOOGLE.sudahMasuk()) muat();
  else if (!navigator.onLine && pakaiDataTerakhir()) { /* tanpa sinyal: tetap bisa mencatat, login menyusul saat online */ }
  else tampilMasuk();
}

async function muat() {
  try {
    if (S.gabung) {
      // Tetap disimpan kalau gagal, supaya "Coba lagi" mengulang setelah pemilik memberi akses.
      await api('hubungkanDatabase', S.gabung);
      S.gabung = '';
      toast('Berhasil bergabung ke Dompet Keluarga ✔');
    }
    S.data = await api('getData', S.bulan);
    S.offline = false;
    $('#nav').hidden = !!S.data.perluSetup;
    if (S.data.perluSetup) $('#view').innerHTML = viewSetup();
    else {
      S.bulan = S.data.bulan; // kosong = periode berjalan, ditentukan server dari tanggal gajian
      tulisLokal('data', S.data);
      render();
      kirimTertunda();
    }
  } catch (e) {
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
const tertunda = () => bacaLokal('tertunda', []);

/** Tanpa sinyal: pakai data terakhir yang tersimpan di HP. false kalau belum pernah ada. */
function pakaiDataTerakhir() {
  if (!S.data || S.data.perluSetup) {
    const d = bacaLokal('data', null);
    if (!d) return false;
    S.data = d;
  }
  S.bulan = S.data.bulan;
  S.offline = true;
  $('#nav').hidden = false;
  render();
  return true;
}

/** Transaksi baru yang belum bisa dikirim disimpan di HP, lengkap dengan ID-nya supaya tidak dobel saat dikirim ulang. */
function simpanTertunda(t) {
  tulisLokal('tertunda', tertunda().concat([{
    idBaru: t.idBaru || crypto.randomUUID(), tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori,
    dompet: t.dompet, dompetTujuan: t.dompetTujuan, tanggal: t.tanggal, catatan: t.catatan,
    dariRutin: t.dariRutin || '', ulang: t.ulang || '',
  }]));
  tutupSheet();
  render();
  toast('📴 Tersimpan di HP. Dikirim otomatis begitu ada sinyal.');
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
        tulisLokal('tertunda', tertunda().filter(x => x.idBaru !== t.idBaru));
      } catch (e) {
        if (e.jaringan || e instanceof GOOGLE.PerluMasuk) break;
        tulisLokal('tertunda', tertunda().map(x => (x.idBaru === t.idBaru ? Object.assign({}, x, { gagal: pesanError(e) }) : x)));
        berubah = true;
      }
    }
  } finally {
    mengirimTertunda = false;
  }
  if (terkirim) {
    toast(terkirim + ' transaksi tertunda terkirim ✔');
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
  return (S.offline ? '<div class="status-bar">📴 Offline · menampilkan data terakhir. Transaksi baru tetap bisa dicatat.</div>' : '') +
    (menunggu ? `<div class="status-bar">📤 ${menunggu} transaksi menunggu dikirim${S.offline ? '' : ' <button type="button" data-aksi="kirim-tertunda">Kirim sekarang</button>'}</div>` : '') +
    gagal.map(t => `<div class="status-bar gagal">⚠️ ${rp(t.jumlah)} ${esc(t.kategori || 'Transfer')} tidak bisa dikirim: ${esc(t.gagal)}
      <button type="button" data-aksi="ulang-tertunda" data-id="${esc(t.idBaru)}">Catat ulang</button></div>`).join('');
}

function tampilMasuk() {
  tutupSheet();
  loading(false);
  $('#sesi').hidden = true;
  $('#nav').hidden = true;
  const email = GOOGLE.email();
  $('#view').innerHTML = `
    <div class="sambut">
      <div class="logo">👛</div>
      <h1>Dompet Keluarga</h1>
      <p>Catat keuangan keluarga bersama. Semua data tersimpan di Google Spreadsheet milik Anda sendiri.</p>
      ${S.gabung ? '<p><b>Anda diundang bergabung.</b> Masuk dengan akun Google yang diundang untuk melanjutkan.</p>' : ''}
      ${email ? `
        <button type="button" class="btn btn-utama" data-aksi="masuk">Lanjutkan sebagai ${esc(email)}</button>
        <button type="button" class="tombol-teks" data-aksi="masuk" data-akun-lain="1">Pakai akun Google lain</button>`
      : '<button type="button" class="btn btn-utama" data-aksi="masuk">Masuk dengan Google</button>'}
      <a class="tombol-teks" href="privasi.html">Kebijakan privasi</a>
    </div>`;
}

/** Setelah masuk (atau ganti akun): buang semua tampilan & data lama, lalu muat ulang. */
async function muatDariAwal() {
  $('#sesi').hidden = true;
  tutupSheet();
  S.data = null;
  $('#nav').hidden = true;
  $('#view').innerHTML = '<div class="memuat-awal"><div class="spinner"></div><p>Memuat…</p></div>';
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
      <b id="sesi-judul">Sesi login berakhir</b>
      <p>Demi keamanan, Google meminta konfirmasi sekitar tiap 1 jam. Isian Anda tidak hilang.</p>
      <button type="button" class="btn btn-utama" data-aksi="lanjut-sesi">Lanjutkan sebagai ${esc(GOOGLE.email() || S.data.user)}</button>
      <button type="button" class="tombol-teks" data-aksi="masuk" data-akun-lain="1">Pakai akun lain</button>
    </div>`;
  $('#sesi').hidden = false;
}

function viewGagal(e) {
  return `
    <div class="sambut">
      <div class="logo">⚠️</div>
      <p>${esc(pesanError(e))}</p>
      ${e.tanpaAkses
        ? `<button type="button" class="btn btn-utama" data-aksi="pilih-db" data-id="${esc(e.idDb || '')}">Pilih spreadsheet</button>
           <button type="button" class="btn btn-hapus" data-aksi="coba-lagi">Coba lagi</button>
           <button type="button" class="btn btn-hapus" data-aksi="lupakan-db">Pakai spreadsheet lain</button>`
        : '<button type="button" class="btn btn-utama" data-aksi="coba-lagi">Coba lagi</button>'}
      <button type="button" class="btn btn-hapus" data-aksi="keluar">Keluar (${esc(GOOGLE.email() || '')})</button>
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
    toast('Spreadsheet terhubung ✔');
  } finally {
    loading(false);
  }
}

function render() {
  const view = { beranda: viewBeranda, riwayat: viewRiwayat, dompet: viewDompet, laporan: viewLaporan, lainnya: viewLainnya }[S.tab];
  $('#view').innerHTML = bannerStatus() + view();
  document.querySelectorAll('#nav [data-tab]').forEach(b => b.classList.toggle('aktif', b.dataset.tab === S.tab));
}

function pemilihBulan() {
  return `<div class="pemilih-bulan">
    <button data-aksi="bulan" data-geser="-1" aria-label="Bulan sebelumnya">‹</button>
    <span>${esc(namaBulan(S.bulan))}</span>
    <button data-aksi="bulan" data-geser="1" aria-label="Bulan berikutnya">›</button>
  </div>`;
}

function itemTrx(t) {
  let judul = t.kategori, ikon = ikonKategori(t.kategori, t.tipe), kelas = 'keluar', tanda = '−';
  let sub = [t.catatan, t.dompet].filter(Boolean).join(' · ');
  if (t.tipe === TIPE.MASUK) { kelas = 'masuk'; tanda = '+'; }
  if (t.tipe === TIPE.TRANSFER) {
    judul = 'Transfer'; ikon = '🔁'; kelas = 'transfer'; tanda = '';
    if (adalahTabungan(t.dompetTujuan)) { judul = 'Setor tabungan'; ikon = ikonDompet(t.dompetTujuan); }
    else if (adalahTabungan(t.dompet)) { judul = 'Tarik tabungan'; ikon = ikonDompet(t.dompet); }
    else if (adalahUtang(t.dompetTujuan)) { judul = 'Uang ke ' + t.dompetTujuan; ikon = '🤝'; }
    else if (adalahUtang(t.dompet)) { judul = 'Uang dari ' + t.dompet; ikon = '🤝'; }
    sub = [`${t.dompet} → ${t.dompetTujuan}`, t.catatan].filter(Boolean).join(' · ');
  }
  return `<button class="trx" data-aksi="edit-trx" data-id="${esc(t.id)}">
    <span class="ikon-bulat">${esc(ikon)}</span>
    <span class="trx-isi"><b>${esc(judul)}</b><small>${esc(sub)}</small></span>
    <span class="nominal ${kelas}">${tanda}${rp(t.jumlah)}</span>
  </button>`;
}

function kosong(ikon, teks) {
  return `<div class="kosong"><span>${ikon}</span>${teks}</div>`;
}

/** Bar horizontal berperingkat, satu warna. items: [{ ikon, nama, nilai }] sudah terurut besar → kecil. */
function barBerperingkat(items, totalUntukPersen) {
  const maks = Math.max(1, ...items.map(x => x.nilai));
  return items.map(x => `
    <div class="bar-item">
      <span class="ikon">${esc(x.ikon)}</span>
      <span class="nama">${esc(x.nama)}</span>
      <span class="nilai">${rp(x.nilai)}${totalUntukPersen ? ` <small>${Math.round(x.nilai / totalUntukPersen * 100)}%</small>` : ''}</span>
      <div class="bar"><i style="width:${Math.max(2, x.nilai / maks * 100)}%"></i></div>
    </div>`).join('');
}

/** Status anggaran selalu berupa ikon + teks, tidak hanya warna. */
function statusAnggaran(terpakai, batas) {
  if (terpakai > batas) return { kelas: 'lewat', teks: `⛔ Lewat ${rp(terpakai - batas)}` };
  if (terpakai >= batas * 0.8) return { kelas: 'hampir', teks: `⚠️ Hampir habis · sisa ${rp(batas - terpakai)}` };
  return { kelas: '', teks: `Sisa ${rp(batas - terpakai)}` };
}

function meterAnggaran(ikon, nama, terpakai, batas) {
  const s = statusAnggaran(terpakai, batas);
  return `
    <div class="bar-item">
      <span class="ikon">${esc(ikon)}</span>
      <span class="nama">${esc(nama)}</span>
      <span class="nilai">${rp(terpakai)} <small>/ ${rp(batas)}</small></span>
      <div class="meter ${s.kelas}" role="meter" aria-label="${esc(nama)}" aria-valuemin="0" aria-valuemax="${batas}" aria-valuenow="${terpakai}">
        <i style="width:${Math.min(100, terpakai / batas * 100)}%"></i></div>
      <small class="ket">${s.teks}</small>
    </div>`;
}

/** Pengeluaran bulan terpilih per kategori: { nama: jumlah }. */
function pengeluaranPerKategori() {
  const per = {};
  S.data.transaksi.filter(t => t.tipe === TIPE.KELUAR).forEach(t => { per[t.kategori] = (per[t.kategori] || 0) + t.jumlah; });
  return per;
}

const kategoriBeranggaran = () => S.data.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0);

/** Rincian semua meter anggaran (dibuka dari tile Anggaran di Beranda). */
function bukaRincianAnggaran() {
  const per = pengeluaranPerKategori();
  const pakai = k => per[k.nama] || 0;
  const daftar = kategoriBeranggaran().sort((a, b) => pakai(b) / b.anggaran - pakai(a) / a.anggaran);
  const totalBatas = daftar.reduce((a, k) => a + k.anggaran, 0);
  const totalPakai = daftar.reduce((a, k) => a + pakai(k), 0);
  bukaSheet('Anggaran ' + namaBulan(S.bulan), `
    ${meterAnggaran('📊', 'Total', totalPakai, totalBatas)}
    <div class="pemisah"></div>
    ${daftar.map(k => meterAnggaran(k.ikon, k.nama, pakai(k), k.anggaran)).join('')}
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="atur-anggaran">Atur anggaran</button></div>`);
}

function tileAnggaran(per) {
  const daftar = kategoriBeranggaran();
  if (!daftar.length) {
    return `<button data-aksi="atur-anggaran"><small>Anggaran</small><b>Atur</b><span class="ket">Batasi belanja per kategori</span></button>`;
  }
  const batas = daftar.reduce((a, k) => a + k.anggaran, 0);
  const pakai = daftar.reduce((a, k) => a + (per[k.nama] || 0), 0);
  const s = statusAnggaran(pakai, batas);
  const persen = Math.round(pakai / batas * 100);
  const lewat = daftar.filter(k => (per[k.nama] || 0) > k.anggaran).length;
  return `<button data-aksi="rincian-anggaran">
    <small>Anggaran <span>›</span></small>
    <b>${persen}% <span style="font-size:13px;font-weight:600;color:var(--muted)">terpakai</span></b>
    <span class="meter ${s.kelas}" role="meter" aria-label="Total anggaran" aria-valuemin="0" aria-valuemax="${batas}" aria-valuenow="${pakai}"><i style="width:${Math.min(100, persen)}%"></i></span>
    <span class="ket">${lewat ? `⛔ ${lewat} kategori lewat batas` : esc(s.teks)}</span>
  </button>`;
}

function tileTabungan() {
  const daftar = daftarTabungan();
  if (!daftar.length) {
    return `<button data-aksi="tambah-tabungan"><small>Tabungan</small><b>Mulai</b><span class="ket">Buat tabungan pertama</span></button>`;
  }
  const total = daftar.reduce((a, w) => a + w.saldo, 0);
  const bertarget = daftar.filter(w => w.target);
  const target = bertarget.reduce((a, w) => a + w.target, 0);
  const terkumpul = bertarget.reduce((a, w) => a + Math.min(w.saldo, w.target), 0);
  const persen = target ? Math.floor(terkumpul / target * 100) : null;
  return `<button data-aksi="tab" data-tab="dompet">
    <small>Tabungan <span>›</span></small>
    <b>Rp${rpPendek(total)}</b>
    ${persen !== null ? `<span class="meter" role="meter" aria-label="Progres target tabungan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${persen}"><i style="width:${persen}%"></i></span>` : ''}
    <span class="ket">${daftar.length} tabungan${persen !== null ? ` · ${persen}% dari target` : ''}</span>
  </button>`;
}

// ---------- Halaman: Beranda ----------

function viewBeranda() {
  const d = S.data;
  const trx = d.transaksi;
  const masuk = total(trx, TIPE.MASUK);
  const keluar = total(trx, TIPE.KELUAR);
  const saldo = dompetBiasa().reduce((a, w) => a + w.saldo, 0);
  const per = pengeluaranPerKategori();
  const urut = Object.keys(per).map(n => ({ ikon: ikonKategori(n, TIPE.KELUAR), nama: n, nilai: per[n] })).sort((a, b) => b.nilai - a.nilai);
  const nama = namaPendek(d.user);

  return `
    <div class="kepala">
      <div class="sapa">
        <span class="avatar" aria-hidden="true">${esc(nama.charAt(0))}</span>
        <div style="min-width:0"><small>Halo,</small><h1>${esc(nama)}</h1></div>
      </div>
      <div class="kepala-kanan">
        ${pemilihBulan()}
        <button class="tombol-ikon" data-aksi="tab" data-tab="lainnya" aria-label="Pengaturan">${svg('gear')}</button>
      </div>
    </div>

    <section class="kartu kartu-saldo">
      <small>Total saldo dompet</small>
      <div class="besar">${rp(saldo)}</div>
      <div class="ringkas">
        <div><span class="panah-bulat masuk" aria-hidden="true">↓</span><span><small>Pemasukan</small><b>${rp(masuk)}</b></span></div>
        <div><span class="panah-bulat keluar" aria-hidden="true">↑</span><span><small>Pengeluaran</small><b>${rp(keluar)}</b></span></div>
      </div>
      <div class="selisih">Selisih ${esc(namaBulan(S.bulan))}: <b>${rp(masuk - keluar)}</b></div>
      ${barisSisaAman()}
    </section>

    <div class="aksi-cepat">
      <button data-aksi="tambah-trx"><span class="kotak">${svg('plus')}</span>Catat</button>
      <button data-aksi="cepat-struk"><span class="kotak">${svg('kamera')}</span>Foto struk</button>
      <button data-aksi="cepat-transfer"><span class="kotak">${svg('transfer')}</span>Transfer</button>
      <button data-aksi="tab" data-tab="laporan"><span class="kotak">${svg('laporan')}</span>Laporan</button>
    </div>

    ${kartuTagihan()}

    <div class="bento">${tileAnggaran(per)}${tileTabungan()}</div>

    <h2 class="judul-bagian">Pengeluaran per kategori ${urut.length > 5 ? '<button data-aksi="tab" data-tab="laporan">Semua</button>' : ''}</h2>
    <section class="kartu">
      ${urut.length ? barBerperingkat(urut.slice(0, 5)) : kosong('🧾', 'Belum ada pengeluaran bulan ini.')}
    </section>

    <h2 class="judul-bagian">Transaksi terakhir ${trx.length ? '<button data-aksi="tab" data-tab="riwayat">Lihat semua</button>' : ''}</h2>
    <section class="kartu" style="padding:4px 18px">
      ${trx.length ? trx.slice(0, 5).map(itemTrx).join('') : kosong('✍️', 'Belum ada transaksi. Ketuk tombol ＋ untuk mencatat.')}
    </section>`;
}

// ---------- Halaman: Riwayat ----------

function viewRiwayat() {
  const q = S.cari.toLowerCase();
  const trx = S.data.transaksi.filter(t =>
    (S.filterTipe === 'Semua' || t.tipe === S.filterTipe) &&
    (!q || [t.kategori, t.catatan, t.dompet, t.dompetTujuan, String(t.jumlah)].join(' ').toLowerCase().includes(q))
  );

  const grup = {};
  trx.forEach(t => (grup[t.tanggal] = grup[t.tanggal] || []).push(t));

  const isi = Object.keys(grup).sort().reverse().map(tgl => {
    const daftar = grup[tgl];
    const bersih = total(daftar, TIPE.MASUK) - total(daftar, TIPE.KELUAR);
    return `<div class="grup-tanggal"><span>${esc(labelTanggal(tgl))}</span><span>${bersih ? rp(bersih) : ''}</span></div>
      <section class="kartu" style="padding:4px 16px">${daftar.map(itemTrx).join('')}</section>`;
  }).join('');

  return `
    <div class="kepala"><h1>Riwayat</h1>${pemilihBulan()}</div>
    <input class="cari" id="cari" type="search" placeholder="Cari catatan, kategori, nominal…" value="${esc(S.cari)}">
    <div class="chips">
      ${['Semua', TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button class="chip ${S.filterTipe === t ? 'aktif' : ''}" data-aksi="filter-tipe" data-tipe="${t}">${t}</button>`).join('')}
    </div>
    <div id="hasil-riwayat">${isi || kosong('🔍', 'Tidak ada transaksi yang cocok.')}</div>`;
}

// ---------- Halaman: Dompet ----------

function viewDompet() {
  const dompet = dompetBiasa();
  const tabungan = daftarTabungan();
  const saldo = dompet.reduce((a, w) => a + w.saldo, 0);
  const totalTabungan = tabungan.reduce((a, w) => a + w.saldo, 0);
  return `
    <div class="kepala"><h1>Dompet & Tabungan</h1></div>
    <section class="kartu kartu-saldo">
      <small>Total saldo dompet</small>
      <div class="besar" style="margin-bottom:0">${rp(saldo)}</div>
      ${tabungan.length ? `<div class="selisih">🐷 Total tabungan: <b>${rp(totalTabungan)}</b></div>` : ''}
    </section>

    <h2 class="judul-bagian">Dompet</h2>
    <section class="kartu" style="padding:4px 16px">
      ${dompet.map(w => `
        <button class="baris" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">
          <span class="ikon-bulat">${esc(w.ikon)}</span>
          <span class="isi"><b>${esc(w.nama)}</b></span>
          <b class="nominal ${w.saldo < 0 ? 'minus' : ''}">${rp(w.saldo)}</b>
        </button>`).join('') || kosong('👛', 'Belum ada dompet.')}
    </section>
    ${dompet.length ? '<p class="info-kecil" style="margin-top:8px">Saldo tidak cocok dengan aslinya? Ketuk dompetnya, lalu ganti angka saldo sekarang.</p>' : ''}
    <button class="tombol-tambah" data-aksi="tambah-dompet">＋ Tambah dompet</button>

    <h2 class="judul-bagian">Tabungan</h2>
    ${tabungan.length
      ? `<section class="kartu" style="padding:4px 16px">${tabungan.map(itemTabungan).join('')}</section>`
      : `<section class="kartu">${kosong('🐷', 'Belum ada tabungan. Buat tabungan dengan target (mis. dana darurat, liburan) atau tanpa batas.')}</section>`}
    <button class="tombol-tambah" data-aksi="tambah-tabungan">＋ Tambah tabungan</button>

    ${bagianUtang()}`;
}

// ---------- Utang & piutang ----------

/** Teks status satu orang. saldo > 0: dia berutang ke kita; < 0: kita berutang ke dia. */
function statusUtang(w) {
  if (!w.saldo) return '✅ Lunas';
  const teks = w.saldo > 0 ? `Berutang ke Anda ${rp(w.saldo)}` : `Anda berutang ${rp(-w.saldo)}`;
  return teks + (w.tenggat ? ' · ' + labelJatuhTempo(w.tenggat).replace(/ · .*$/, '') : '');
}

function itemUtang(w) {
  return `
    <button class="baris" data-aksi="buka-utang" data-nama="${esc(w.nama)}">
      <span class="ikon-bulat">${esc(w.ikon)}</span>
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
    <h2 class="judul-bagian">Utang & Piutang</h2>
    ${aktif.length ? `
      <div class="kpi">
        <div class="tile"><small>Orang berutang ke Anda</small><b>${rp(piutang)}</b></div>
        <div class="tile"><small>Anda berutang</small><b>${rp(utang)}</b></div>
      </div>
      <section class="kartu" style="padding:4px 16px">${aktif.map(itemUtang).join('')}</section>`
    : `<section class="kartu">${kosong('🤝', 'Tidak ada utang-piutang. Catat saat meminjamkan atau meminjam uang, supaya tidak lupa.')}</section>`}
    ${lunas.length ? `
      <details class="tabel-data"><summary>Sudah lunas (${lunas.length})</summary>
        <section class="kartu" style="padding:4px 16px">${lunas.map(itemUtang).join('')}</section></details>` : ''}
    <button class="tombol-tambah" data-aksi="tambah-utang">＋ Catat utang / piutang</button>`;
}

/** Form pinjaman baru (atau tambahan pinjaman ke orang yang sama). */
function bukaFormUtang(nama, arah) {
  const pertama = dompetBiasa()[0];
  F = { utang: true, arah: arah || 'piutang', nama: nama || '', dompet: pertama ? pertama.nama : '', jumlah: 0, tanggal: hariIni(), tenggat: '', catatan: '' };
  bukaSheet(nama ? 'Pinjaman · ' + nama : 'Catat Utang / Piutang', '<div id="form-utang"></div>');
  renderFormUtang();
}

function renderFormUtang() {
  const keOrang = F.arah === 'piutang';
  $('#form-utang').innerHTML = `
    <div class="segmen">
      <button type="button" class="${keOrang ? 'aktif' : ''}" data-aksi="u-arah" data-arah="piutang">Saya meminjamkan</button>
      <button type="button" class="${keOrang ? '' : 'aktif'}" data-aksi="u-arah" data-arah="utang">Saya meminjam</button>
    </div>
    <div class="grup-form">
      <label class="label" for="u-nama">${keOrang ? 'Dipinjamkan ke' : 'Pinjam dari'}</label>
      <input class="field" id="u-nama" maxlength="40" list="u-daftar" placeholder="Nama orang, mis. Budi" value="${esc(F.nama)}">
      <datalist id="u-daftar">${daftarUtang().map(w => `<option value="${esc(w.nama)}">`).join('')}</datalist>
    </div>
    <label class="input-jumlah">
      <span>Rp</span>
      <input id="u-jumlah" class="input-rp" inputmode="numeric" autocomplete="off" placeholder="0" value="${formatAngka(F.jumlah)}">
    </label>
    <div class="grup-form">
      <span class="label">${keOrang ? 'Uangnya keluar dari' : 'Uangnya masuk ke'}</span>
      <div class="grid-pilih">${dompetBiasa().map(w =>
        `<button type="button" class="pilihan ${w.nama === F.dompet ? 'aktif' : ''}" data-aksi="u-dompet" data-nama="${esc(w.nama)}"><span>${esc(w.ikon)}</span>${esc(w.nama)}</button>`).join('')}</div>
    </div>
    <div class="grup-form">
      <label class="label" for="u-tanggal">Tanggal</label>
      <input class="field" id="u-tanggal" type="date" value="${esc(F.tanggal)}">
    </div>
    <div class="grup-form">
      <label class="label" for="u-tenggat">Jatuh tempo (opsional)</label>
      <input class="field" id="u-tenggat" type="date" value="${esc(F.tenggat)}">
      <p class="info-kecil" style="text-align:left">Diingatkan di Beranda menjelang tanggal ini.</p>
    </div>
    <div class="grup-form">
      <label class="label" for="u-catatan">Catatan (opsional)</label>
      <input class="field" id="u-catatan" maxlength="500" placeholder="mis. untuk bayar kos" value="${esc(F.catatan)}">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-utang">Simpan</button></div>
    <p class="info-kecil">Pinjam-meminjam tidak dihitung sebagai pemasukan atau pengeluaran.</p>`;
}

function bacaFormUtang() {
  F.nama = $('#u-nama').value.trim();
  F.jumlah = angka($('#u-jumlah').value);
  F.tanggal = $('#u-tanggal').value;
  F.tenggat = $('#u-tenggat').value;
  F.catatan = $('#u-catatan').value;
}

/** Ringkasan satu orang: pelunasan, tambah pinjaman, ingatkan lewat WhatsApp. */
function bukaUtang(w) {
  const dia = w.saldo > 0;
  const pesanWa = `Halo ${w.nama}, mau mengingatkan pinjaman ${rp(w.saldo)}${w.tenggat ? ' (jatuh tempo ' + tanggalPendek(w.tenggat) + ')' : ''}. Terima kasih 🙏`;
  bukaSheet(w.nama, `
    <div class="ringkas-tabungan">
      <span class="ikon-bulat">${esc(w.ikon)}</span>
      <div><small>${w.saldo ? (dia ? 'Berutang ke Anda' : 'Anda berutang') : 'Status'}</small><b>${w.saldo ? rp(Math.abs(w.saldo)) : '✅ Lunas'}</b></div>
    </div>
    ${w.tenggat && w.saldo ? `<p class="info-kecil" style="text-align:left;margin:8px 0 0">Jatuh tempo: ${esc(labelJatuhTempo(w.tenggat))}</p>` : ''}
    ${w.saldo ? `
      <div class="aksi-form">
        <button type="button" class="btn btn-utama" data-aksi="lunasi-utang" data-nama="${esc(w.nama)}">${dia ? 'Terima pembayaran' : 'Bayar utang'}</button>
      </div>` : ''}
    ${dia ? `<a class="tombol-tambah" style="display:block;text-align:center;text-decoration:none;margin-top:12px" href="https://wa.me/?text=${encodeURIComponent(pesanWa)}" target="_blank" rel="noopener">💬 Ingatkan lewat WhatsApp</a>` : ''}
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="tambah-utang" data-nama="${esc(w.nama)}" data-arah="${w.saldo < 0 ? 'utang' : 'piutang'}">＋ Tambah pinjaman</button>
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">✏️ Ubah nama / jatuh tempo</button>
    <p class="info-kecil">Riwayatnya bisa dicari di tab Riwayat dengan mengetik "${esc(w.nama)}".</p>`);
}

function tanggalPendek(s) {
  return keTanggal(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Progres tabungan: { persen, teks }. Tanpa target → persen null. */
function progresTabungan(w) {
  if (!w.target) return { persen: null, teks: 'Tanpa target' };
  const persen = Math.max(0, Math.min(100, Math.floor(w.saldo / w.target * 100)));
  if (w.saldo >= w.target) return { persen: 100, teks: `🎉 Target ${rp(w.target)} tercapai` };
  const sisa = w.target - w.saldo;
  let teks = `${persen}% dari ${rp(w.target)} · kurang ${rp(sisa)}`;
  if (w.tenggat) {
    if (w.tenggat < hariIni()) {
      teks += ` · ⚠️ lewat tenggat ${tanggalPendek(w.tenggat)}`;
    } else {
      const [y1, m1] = hariIni().split('-').map(Number);
      const [y2, m2] = w.tenggat.split('-').map(Number);
      const bulanLagi = Math.max(1, (y2 - y1) * 12 + (m2 - m1));
      teks += ` · ${rp(Math.ceil(sisa / bulanLagi))}/bulan s.d. ${tanggalPendek(w.tenggat)}`;
    }
  }
  return { persen, teks };
}

function itemTabungan(w) {
  const p = progresTabungan(w);
  return `
    <button class="baris" data-aksi="buka-tabungan" data-nama="${esc(w.nama)}">
      <span class="ikon-bulat">${esc(w.ikon)}</span>
      <span class="isi"><b>${esc(w.nama)}</b>
        ${p.persen !== null ? `<span class="meter" role="meter" aria-label="${esc(w.nama)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.persen}"><i style="width:${p.persen}%"></i></span>` : ''}
        <small>${esc(p.teks)}</small></span>
      <b class="nominal">${rp(w.saldo)}</b>
    </button>`;
}

// ---------- Halaman: Laporan ----------

const NAMA_BULAN_PENDEK = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'short' }));
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
      <h1>Laporan</h1>
      <div class="pemilih-bulan">
        <button data-aksi="tahun" data-geser="-1" aria-label="Tahun sebelumnya">‹</button>
        <span>${th}</span>
        <button data-aksi="tahun" data-geser="1" aria-label="Tahun berikutnya">›</button>
      </div>
    </div>

    <div class="kpi">
      ${tile('Pemasukan ' + th, rp(masuk))}
      ${tile('Pengeluaran ' + th, rp(keluar))}
      ${tile('Selisih', rp(masuk - keluar), rasio !== null ? `${rasio}% dari pemasukan` : '')}
      ${tile('Rata-rata pengeluaran', rp(Math.round(keluar / Math.max(1, bulanAktif))), 'per bulan')}
      ${ditabung ? tile('Masuk tabungan', rp(ditabung), 'setoran − penarikan') : ''}
    </div>

    <section class="kartu">
      <h3>Pemasukan & pengeluaran per bulan</h3>
      <div class="legenda"><span><i class="sw seri-1"></i>Pemasukan</span><span><i class="sw seri-2"></i>Pengeluaran</span></div>
      ${grafikBulanan(bulan, data, pilih)}
      <p class="detail-bulan"><b>${esc(namaBulan(pilih))}</b> · Pemasukan ${rp(r.masuk)} · Pengeluaran ${rp(r.keluar)}
        <br><small>Ketuk bulan di grafik untuk melihat rinciannya.</small></p>
      <details class="tabel-data">
        <summary>Lihat sebagai tabel</summary>
        <table>
          <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th></tr></thead>
          <tbody>${data.map((x, i) => `<tr><td>${NAMA_BULAN_PENDEK[i]}</td><td>${rp(x.masuk)}</td><td>${rp(x.keluar)}</td><td>${rp(x.masuk - x.keluar)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    </section>

    ${kartuKategoriLaporan(pilih, data)}
    ${kartuBanding(pilih)}
    ${kartuAnggota(pilih)}`;
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
      ${batang(cx - 1 - bw, y(d.masuk), bw, dasar, 'seri-1')}
      ${batang(cx + 1, y(d.keluar), bw, dasar, 'seri-2')}
      <text class="sumbu ${aktif ? 'aktif' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>
      <rect class="hit" x="${x0}" y="0" width="${lebarGrup}" height="${H}" data-aksi="lap-bulan" data-bulan="${k}">
        <title>${namaBulan(k)}: pemasukan ${rp(d.masuk)}, pengeluaran ${rp(d.keluar)}</title></rect>`;
  }).join('');

  return `<svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pemasukan dan pengeluaran per bulan">
    ${grid}<line class="dasar" x1="${kiri}" x2="${W}" y1="${dasar}" y2="${dasar}"/>${grup}</svg>`;
}

/** Batang vertikal dengan sudut atas membulat, menempel di garis dasar. */
function batang(x, yAtas, w, yDasar, kelas) {
  const h = yDasar - yAtas;
  if (h < 0.5) return '';
  const r = Math.min(4, h, w / 2);
  return `<path class="${kelas}" d="M${x},${yDasar} V${yAtas + r} Q${x},${yAtas} ${x + r},${yAtas} H${x + w - r} Q${x + w},${yAtas} ${x + w},${yAtas + r} V${yDasar} Z"/>`;
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
  const urut = Object.keys(per).map(n => ({ ikon: ikonKategori(n, TIPE.KELUAR), nama: n, nilai: per[n] })).sort((a, b) => b.nilai - a.nilai);
  const total = urut.reduce((a, x) => a + x.nilai, 0);
  return `<section class="kartu">
    <h3>Pengeluaran per kategori</h3>
    <div class="chips">
      <button class="chip ${setahun ? '' : 'aktif'}" data-aksi="lap-kategori" data-mode="bulan">${esc(namaBulan(pilih))}</button>
      <button class="chip ${setahun ? 'aktif' : ''}" data-aksi="lap-kategori" data-mode="tahun">Setahun ${S.tahun}</button>
    </div>
    ${urut.length ? barBerperingkat(urut, total) : kosong('🧾', 'Belum ada pengeluaran.')}
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
    if (!s) return 'sama';
    const persen = dasar ? ` (${s > 0 ? '+' : '−'}${Math.abs(Math.round(s / dasar * 100))}%)` : ' (baru)';
    return `<span class="${s > 0 ? 'naik' : 'turun'}">${s > 0 ? '▲' : '▼'} ${rp(Math.abs(s))}${persen}</span>`;
  };
  const totKini = ringkasBulan(pilih).keluar;
  const totLalu = ringkasBulan(lalu).keluar;
  return `<section class="kartu">
    <h3>Dibanding ${esc(namaBulan(lalu))}</h3>
    <div class="banding"><span class="isi"><b>Total pengeluaran</b><small>${rp(totLalu)} → ${rp(totKini)}</small></span>${delta(totKini - totLalu, totLalu)}</div>
    ${baris.map(x => `
      <div class="banding">
        <span class="ikon">${esc(ikonKategori(x.nama, TIPE.KELUAR))}</span>
        <span class="isi"><b>${esc(x.nama)}</b><small>${rp(x.lalu)} → ${rp(x.kini)}</small></span>
        ${delta(x.selisih, x.lalu)}
      </div>`).join('') || '<p class="info-kecil">Tidak ada perubahan per kategori.</p>'}
    <p class="info-kecil" style="text-align:left">▲ pengeluaran naik · ▼ pengeluaran turun</p>
  </section>`;
}

function kartuAnggota(pilih) {
  const oleh = ringkasBulan(pilih).oleh;
  const urut = Object.keys(oleh).map(e => ({ ikon: '👤', nama: e === '?' ? 'Tidak diketahui' : namaPendek(e), nilai: oleh[e] }))
    .sort((a, b) => b.nilai - a.nilai);
  if (urut.length < 2) return '';
  return `<section class="kartu">
    <h3>Pengeluaran per anggota · ${esc(namaBulan(pilih))}</h3>
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
    <div class="kepala"><div><small>Selamat datang,</small><h1>${esc(namaPendek(S.data.user))} 👋</h1></div></div>
    <p class="setup-intro">Tiga langkah singkat, lalu langsung bisa mencatat.</p>

    <section class="kartu">
      <h3>1. Dompet apa saja yang dipakai?</h3>
      <p class="info-kecil" style="text-align:left;margin:0 0 10px">Ketuk semua yang dipakai keluarga. Bisa ditambah atau diubah nanti.</p>
      <div class="chips">${semua.map(([n, i]) =>
        `<button type="button" class="chip ${st.pilih.includes(n) ? 'aktif' : ''}" data-aksi="setup-dompet" data-nama="${esc(n)}" aria-pressed="${st.pilih.includes(n)}">${esc(i)} ${esc(n)}</button>`).join('')}</div>
      <div class="salin" style="margin-top:10px">
        <input class="field" id="s-lain" maxlength="40" placeholder="Lainnya, mis. Bank Jatim">
        <button type="button" class="btn btn-hapus" data-aksi="setup-lain">Tambah</button>
      </div>
    </section>

    <section class="kartu">
      <h3>2. Berapa saldonya sekarang?</h3>
      <p class="info-kecil" style="text-align:left;margin:0 0 4px">Supaya saldo di aplikasi sama dengan aslinya. Boleh dikira-kira dulu, bisa disesuaikan kapan saja.</p>
      ${dipilih.map(([n, i]) => `
        <label class="baris baris-input">
          <span class="ikon-bulat">${esc(i)}</span>
          <span class="isi"><b>${esc(n)}</b></span>
          <input class="field input-rp input-saldo-setup" data-nama="${esc(n)}" inputmode="numeric" placeholder="0" value="${formatAngka(st.saldo[n])}">
        </label>`).join('') || '<p class="info-kecil" style="text-align:left">Pilih minimal satu dompet di langkah 1.</p>'}
    </section>

    <section class="kartu">
      <h3>3. Catat bersama keluarga? <small style="font-weight:600;color:var(--muted)">(opsional)</small></h3>
      <div class="grup-form">
        <label class="label" for="s-anggota">Email Google anggota keluarga</label>
        <input class="field" id="s-anggota" type="email" inputmode="email" placeholder="nama@gmail.com" value="${esc(st.email)}">
        <p class="info-kecil" style="text-align:left">Bisa juga nanti dari ⚙️ → Undang anggota keluarga.</p>
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-utama" data-aksi="buat-db">Mulai pakai</button>
      </div>
      <p class="info-kecil">Catatan disimpan di spreadsheet <b>Dompet Keluarga</b> yang dibuat di Google Drive ${esc(S.data.user)}.</p>
    </section>

    <p class="info-kecil">Diundang keluarga, atau sudah punya spreadsheet Dompet Keluarga?</p>
    <div style="text-align:center"><button type="button" class="tombol-teks" data-aksi="pilih-db">Pilih dari Google Drive</button></div>
    <button type="button" class="tombol-tambah" data-aksi="keluar">Keluar dari ${esc(S.data.user)}</button>`;
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
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="Kembali">${svg('kembali')}</button>
      <h1>Lainnya</h1>
    </div>
    <section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="keluar">
        <span class="ikon-bulat">👤</span>
        <span class="isi"><b>${esc(namaPendek(d.user))}</b><small>${esc(d.user)}</small></span>
        <span class="panah" style="font-size:13px">Keluar</span>
      </button>
      <button class="baris" data-aksi="atur-anggaran">
        <span class="ikon-bulat">🎯</span>
        <span class="isi"><b>Anggaran bulanan</b><small>Batas belanja per kategori</small></span>
        <span class="panah">›</span>
      </button>
      <button class="baris" data-aksi="kelola-rutin">
        <span class="ikon-bulat">🔁</span>
        <span class="isi"><b>Tagihan & transaksi rutin</b><small>${daftarRutin().length ? `${daftarRutin().length} rutin · berikutnya ${esc(daftarRutin()[0].nama)}, ${esc(tanggalPendek(daftarRutin()[0].berikutnya))}` : 'Listrik, internet, cicilan, SPP, gaji…'}</small></span>
        <span class="panah">›</span>
      </button>
      <button class="baris" data-aksi="atur-periode">
        <span class="ikon-bulat">📅</span>
        <span class="isi"><b>Periode gajian</b><small>${(d.mulaiPeriode || 1) > 1 ? `Mulai tanggal ${d.mulaiPeriode} tiap bulan` : 'Bulan kalender (tanggal 1)'}</small></span>
        <span class="panah">›</span>
      </button>
      <button class="baris" data-aksi="kelola-kategori">
        <span class="ikon-bulat">🏷️</span>
        <span class="isi"><b>Kelola kategori</b><small>Tambah, ubah nama, atau hapus kategori</small></span>
        <span class="panah">›</span>
      </button>
      <button class="baris" data-aksi="undang">
        <span class="ikon-bulat">👨‍👩‍👧</span>
        <span class="isi"><b>Undang anggota keluarga</b><small>Beri akses ke akun Google lain</small></span>
        <span class="panah">›</span>
      </button>
    </section>

    <h2 class="judul-bagian">Fitur lanjutan</h2>
    <section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="gemini">
        <span class="ikon-bulat">🤖</span>
        <span class="isi"><b>Baca struk lebih akurat</b><small>${d.kunciGemini.length ? 'Aktif · memakai AI Gemini' : 'Opsional · pakai kunci Gemini gratis dari Google'}</small></span>
        <span class="panah">›</span>
      </button>
      <button class="baris" data-aksi="telegram">
        <span class="ikon-bulat">💬</span>
        <span class="isi"><b>Bot Telegram</b><small>${d.telegram.bot ? `@${esc(d.telegram.bot)} · ${d.telegram.pengguna.length} akun terhubung` : 'Catat lewat chat & foto struk'}</small></span>
        <span class="panah">›</span>
      </button>
      <a class="baris" href="${esc(d.urlSpreadsheet)}" target="_blank" style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">📊</span>
        <span class="isi"><b>Buka spreadsheet</b><small>Lihat semua data di Google Sheets</small></span>
        <span class="panah">›</span>
      </a>
      <a class="baris" href="privasi.html" style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">🔒</span>
        <span class="isi"><b>Kebijakan privasi</b><small>Data apa yang dipakai aplikasi ini</small></span>
        <span class="panah">›</span>
      </a>
    </section>
    ${kartuPasang()}`;
}

function kartuPasang() {
  if (MODE_APLIKASI) {
    return `<p class="catatan-versi">✅ Terpasang sebagai aplikasi · update otomatis${versiAwal ? ` · versi ${esc(versiAwal)}` : ''}</p>`;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return `
    <section class="kartu panduan">
      <h3>📲 Pasang sebagai aplikasi</h3>
      <p>Cukup sekali pasang. Setiap ada pembaruan, aplikasi ikut ter-update sendiri tanpa perlu pasang ulang.</p>
      ${ajakanPasang ? '<button type="button" class="btn btn-utama" data-aksi="pasang-aplikasi">Pasang aplikasi</button>'
      : ios ? `
        <b>iPhone / iPad (wajib pakai Safari):</b>
        <ol><li>Ketuk tombol Bagikan (kotak dengan panah ke atas).</li><li>Gulir lalu pilih <b>Tambah ke Layar Utama</b>.</li><li>Ketuk <b>Tambah</b>.</li></ol>`
      : `
        <b>Android (Chrome):</b>
        <ol><li>Ketuk menu ⋮ di kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Ketuk <b>Instal</b>.</li></ol>`}
    </section>`;
}

// ---------- Bottom sheet ----------

function bukaSheet(judul, html) {
  $('#sheet-judul').textContent = judul;
  $('#sheet-isi').innerHTML = html;
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function tutupSheet() {
  $('#sheet').hidden = true;
  document.body.style.overflow = '';
  F = null;
}

/** tanganiGagal(e): opsional; kembalikan true kalau error sudah ditangani (mis. disimpan sebagai tertunda). */
async function kirim(tombol, fungsi, args, pesan, tanganiGagal) {
  tombol.disabled = true;
  loading(true);
  try {
    await api(fungsi, ...args);
    tutupSheet();
    await muat();
    toast(pesan);
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
    `<button type="button" class="${i === terpilih ? 'aktif' : ''}" data-aksi="pilih-ikon" data-ikon="${i}">${i}</button>`).join('')}</div>`;
}

// ---------- Form transaksi ----------

/** preset: isian awal untuk transaksi baru, mis. setor/tarik tabungan. */
function bukaFormTrx(t, preset, judul) {
  const pertama = dompetBiasa()[0];
  F = t ? Object.assign({}, t) : Object.assign({
    tipe: TIPE.KELUAR, jumlah: 0, kategori: '', dompet: pertama ? pertama.nama : '', dompetTujuan: '',
    tanggal: hariIni(), catatan: '',
  }, preset);
  bukaSheet(t ? 'Ubah Transaksi' : judul || 'Catat Transaksi', '<div id="form-trx"></div>');
  renderFormTrx();
  if (!t) setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 250);
}

function renderFormTrx() {
  const kategori = S.data.kategori.filter(k => k.tipe === F.tipe);
  // Tabungan hanya muncul untuk Transfer (setor/tarik); pemasukan & pengeluaran memakai dompet biasa.
  const pilihDompet = (aksi, terpilih, termasukTabungan) => `<div class="grid-pilih">${S.data.dompet
    // Orang (utang-piutang) hanya muncul kalau sedang terpilih, mis. saat mencatat pelunasan.
    .filter(w => w.jenis === JENIS.DOMPET || (termasukTabungan && w.jenis === JENIS.TABUNGAN) || w.nama === terpilih).map(w =>
    `<button type="button" class="pilihan ${w.nama === terpilih ? 'aktif' : ''}" data-aksi="${aksi}" data-nama="${esc(w.nama)}">
      <span>${esc(w.ikon)}</span>${esc(w.nama)}</button>`).join('')}</div>`;

  // Form yang sama dipakai untuk: transaksi baru/ubah, membayar tagihan rutin (F.dariRutin),
  // dan membuat/mengubah tagihan rutin itu sendiri (F.modeRutin).
  const rutin = F.modeRutin;
  const bolehUlang = rutin || (!F.id && !F.dariRutin);
  const berikutUlang = F.ulang && !rutin ? SERVER.tanggalBerikut(F.tanggal || hariIni(), F.tanggal || hariIni(), F.ulang) : '';

  $('#form-trx').innerHTML = `
    ${F.dariRutin ? `
      <div class="info-rutin">🔁 <span>Setelah disimpan, jatuh tempo berikutnya <b>${esc(tanggalPendek(F.berikutRutin))}</b>.
        <button type="button" data-aksi="lewati-rutin">Lewati kali ini</button></span></div>` : ''}

    ${rutin ? `
      <div class="grup-form">
        <label class="label" for="f-nama">Nama tagihan</label>
        <input class="field" id="f-nama" maxlength="60" placeholder="mis. Listrik PLN, Internet, Cicilan motor, Gaji" value="${esc(F.nama)}">
      </div>` : ''}

    <div class="segmen">
      ${[TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button type="button" class="${F.tipe === t ? 'aktif' : ''}" data-aksi="f-tipe" data-tipe="${t}">${t}</button>`).join('')}
    </div>

    ${F.strukJob ? `
      <div class="struk-proses" role="status"><span class="spinner kecil"></span>
        <span><b>Membaca struk…</b><small>Isi lain boleh diisi dulu, atau tutup form ini. Hasilnya tetap muncul di bawah layar.</small></span></div>`
    : !F.id && !rutin && F.tipe === TIPE.KELUAR ? `
      <button type="button" class="tombol-tambah" style="margin:0 0 16px" data-aksi="foto-struk">📷 Isi otomatis dari foto struk</button>` : ''}

    <label class="input-jumlah">
      <span>Rp</span>
      <input id="f-jumlah" inputmode="numeric" autocomplete="off" placeholder="0"
        value="${F.jumlah ? new Intl.NumberFormat('id-ID').format(F.jumlah) : ''}">
    </label>
    ${F.struk ? infoStruk(F.struk) : ''}

    ${F.tipe !== TIPE.TRANSFER ? `
      <div class="grup-form">
        <span class="label">Kategori</span>
        <div class="grid-pilih">${kategori.map(k =>
          `<button type="button" class="pilihan ${k.nama === F.kategori ? 'aktif' : ''}" data-aksi="f-kategori" data-nama="${esc(k.nama)}">
            <span>${esc(k.ikon)}</span>${esc(k.nama)}</button>`).join('')}</div>
      </div>` : ''}

    <div class="grup-form">
      <span class="label">${F.tipe === TIPE.TRANSFER ? 'Dari dompet' : 'Dompet'}</span>
      ${pilihDompet('f-dompet', F.dompet, F.tipe === TIPE.TRANSFER)}
    </div>

    ${F.tipe === TIPE.TRANSFER ? `
      <div class="grup-form">
        <span class="label">Ke dompet</span>
        ${pilihDompet('f-tujuan', F.dompetTujuan, true)}
      </div>` : ''}

    <div class="grup-form">
      <label class="label" for="f-tanggal">${rutin ? 'Jatuh tempo berikutnya' : 'Tanggal'}</label>
      <input class="field" id="f-tanggal" type="date" value="${esc(F.tanggal)}">
    </div>

    ${bolehUlang ? `
      <div class="grup-form">
        <span class="label">🔁 ${rutin ? 'Berulang' : 'Ulangi (tagihan rutin)'}</span>
        <div class="chips">${(rutin ? [] : [['', 'Tidak']]).concat([['Bulanan', 'Tiap bulan'], ['Mingguan', 'Tiap minggu'], ['Tahunan', 'Tiap tahun']]).map(([u, l]) =>
          `<button type="button" class="chip ${(F.ulang || '') === u ? 'aktif' : ''}" data-aksi="f-ulang" data-ulang="${u}">${l}</button>`).join('')}</div>
        ${berikutUlang ? `<p class="info-kecil" style="text-align:left">Muncul lagi di Beranda menjelang ${esc(tanggalPendek(berikutUlang))}, tinggal ketuk untuk mencatat.</p>` : ''}
      </div>` : ''}

    <div class="grup-form">
      <label class="label" for="f-catatan">Catatan (opsional)</label>
      <input class="field" id="f-catatan" maxlength="500" placeholder="mis. Belanja bulanan di Indomaret" value="${esc(F.catatan)}">
    </div>

    <div class="aksi-form">
      ${rutin
        ? `${F.idRutin ? '<button type="button" class="btn btn-hapus" data-aksi="hapus-rutin">Hapus</button>' : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-rutin">Simpan</button>`
        : `${F.id ? '<button type="button" class="btn btn-hapus" data-aksi="hapus-trx">Hapus</button>' : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-trx">Simpan</button>`}
    </div>
    ${F.oleh ? `<p class="info-kecil">Dicatat oleh ${esc(namaPendek(F.oleh))}</p>` : ''}`;
}

/** Simpan isian field teks ke F sebelum form dirender ulang. */
function bacaFieldTrx() {
  if (!$('#f-jumlah')) return;
  F.jumlah = angka($('#f-jumlah').value);
  F.tanggal = $('#f-tanggal').value;
  F.catatan = $('#f-catatan').value;
  if ($('#f-nama')) F.nama = $('#f-nama').value;
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
  const dasar = pakaiAnggaran ? beranggaran.reduce((a, k) => a + k.anggaran, 0) : total(S.data.transaksi, TIPE.MASUK);
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
    ${a.sisa > 0 ? `🟢 Aman dibelanjakan <b>${rp(a.perHari)}/hari</b> · ${a.hari} hari lagi` : '⚠️ Batas periode ini sudah terlewati'} ›</button>`;
}

function bukaRincianAman() {
  const a = hitungSisaAman();
  if (!a) return;
  const baris = (label, nilai, tebal) => `<div class="baris-rincian"><span>${label}</span>${tebal ? `<b>${nilai}</b>` : `<span>${nilai}</span>`}</div>`;
  bukaSheet('Aman Dibelanjakan', `
    ${baris(a.pakaiAnggaran ? 'Total anggaran periode ini' : 'Pemasukan periode ini', rp(a.dasar))}
    ${baris(a.pakaiAnggaran ? '− Terpakai (kategori beranggaran)' : '− Pengeluaran sejauh ini', rp(a.terpakai))}
    ${a.tagihan ? baris('− Tagihan rutin sampai ' + tanggalPendek(a.akhir), rp(a.tagihan)) : ''}
    ${baris('= Sisa', rp(a.sisa), true)}
    ${baris('÷ ' + a.hari + ' hari (s.d. ' + tanggalPendek(a.akhir) + ')', a.sisa > 0 ? rp(a.perHari) + '/hari' : '—', true)}
    <p class="info-kecil" style="text-align:left">${a.pakaiAnggaran
      ? 'Dihitung dari anggaran per kategori. Pengeluaran di kategori tanpa anggaran tidak ikut dihitung.'
      : 'Belum ada anggaran, jadi dihitung dari pemasukan yang dicatat di periode ini. Atur anggaran supaya lebih tepat.'}</p>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="atur-periode">Periode gajian</button>
      <button type="button" class="btn btn-utama" data-aksi="atur-anggaran">Atur anggaran</button>
    </div>`);
}

function bukaFormPeriode() {
  const kini = S.data.mulaiPeriode || 1;
  F = { mulai: kini };
  const contoh = n => {
    if (n === 1) return 'Periode = bulan kalender (1 – akhir bulan).';
    const r = SERVER.rentangPeriode(SERVER.periodeDari(hariIni(), n), n);
    return `Periode berjalan: ${tanggalPendek(r.awal)} – ${tanggalPendek(r.akhir)}.`;
  };
  bukaSheet('Periode Gajian', `
    <p style="margin-top:0">Tanggal berapa biasanya gajian? Ringkasan, anggaran, dan laporan dihitung dari tanggal itu sampai sehari sebelum gajian berikutnya.</p>
    <div class="grid-tanggal">${Array.from({ length: 28 }, (_, i) => i + 1).map(n =>
      `<button type="button" class="${n === kini ? 'aktif' : ''}" data-aksi="pilih-periode" data-n="${n}">${n}</button>`).join('')}</div>
    <p class="info-kecil" id="contoh-periode" style="text-align:left">${contoh(kini)}</p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-periode">Simpan</button></div>`);
  F.contoh = contoh;
}

// ---------- Tagihan & transaksi rutin ----------

const SEBUTAN_ULANG = { Bulanan: 'Tiap bulan', Mingguan: 'Tiap minggu', Tahunan: 'Tiap tahun' };
const daftarRutin = () => S.data.rutin || []; // data offline versi lama belum punya rutin

function ikonRutin(r) {
  return r.tipe === TIPE.TRANSFER ? (adalahTabungan(r.dompetTujuan) ? ikonDompet(r.dompetTujuan) : '🔁') : ikonKategori(r.kategori, r.tipe);
}

function selisihHari(tgl) {
  return Math.round((keTanggal(tgl) - keTanggal(hariIni())) / 864e5);
}

function labelJatuhTempo(tgl) {
  const n = selisihHari(tgl);
  if (n < 0) return `⛔ Terlambat ${-n} hari · ${tanggalPendek(tgl)}`;
  if (n === 0) return '⚠️ Jatuh tempo hari ini';
  if (n === 1) return 'Besok · ' + tanggalPendek(tgl);
  return `${n} hari lagi · ${tanggalPendek(tgl)}`;
}

/** Kartu Beranda: rutin yang jatuh tempo dalam 7 hari atau sudah terlewat. */
function kartuTagihan() {
  const dibayarOffline = tertunda().map(t => t.dariRutin).filter(Boolean); // sudah dibayar, menunggu sinyal
  const daftar = daftarRutin().filter(r => selisihHari(r.berikutnya) <= 7 && !dibayarOffline.includes(r.id));
  // Utang-piutang yang belum lunas dan jatuh temponya dekat ikut diingatkan di sini.
  const pinjaman = daftarUtang().filter(w => w.saldo && w.tenggat && selisihHari(w.tenggat) <= 7);
  if (!daftar.length && !pinjaman.length) return '';
  const baris = (aksi, attr, ikon, judul, tgl, nominal) => `
      <button class="baris" data-aksi="${aksi}" ${attr}>
        <span class="ikon-bulat">${esc(ikon)}</span>
        <span class="isi"><b>${esc(judul)}</b><small class="${selisihHari(tgl) < 0 ? 'terlambat' : ''}">${esc(labelJatuhTempo(tgl))}</small></span>
        <b class="nominal">${rp(nominal)}</b>
      </button>`;
  return `
    <h2 class="judul-bagian">Tagihan mendatang <button data-aksi="kelola-rutin">Kelola</button></h2>
    <section class="kartu" style="padding:4px 16px">
      ${daftar.map(r => baris('bayar-rutin', `data-id="${esc(r.id)}"`, ikonRutin(r), r.nama, r.berikutnya, r.jumlah)).join('')}
      ${pinjaman.map(w => baris('buka-utang', `data-nama="${esc(w.nama)}"`, w.ikon,
        w.saldo > 0 ? w.nama + ' membayar utang' : 'Bayar utang ke ' + w.nama, w.tenggat, Math.abs(w.saldo))).join('')}
    </section>`;
}

function bukaDaftarRutin() {
  const daftar = daftarRutin();
  bukaSheet('Tagihan & Transaksi Rutin', `
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">Muncul di Beranda 7 hari sebelum jatuh tempo. Ketuk di sana untuk mencatat, nominal bisa diubah saat itu.</p>
    ${daftar.map(r => `
      <button class="baris" data-aksi="edit-rutin" data-id="${esc(r.id)}">
        <span class="ikon-bulat">${esc(ikonRutin(r))}</span>
        <span class="isi"><b>${esc(r.nama)}</b><small>${SEBUTAN_ULANG[r.ulang]} · berikutnya ${esc(tanggalPendek(r.berikutnya))}</small></span>
        <b class="nominal">${rp(r.jumlah)}</b>
      </button>`).join('') || kosong('🔁', 'Belum ada. Contoh: listrik, internet, cicilan, SPP, gaji.')}
    <button class="tombol-tambah" data-aksi="tambah-rutin">＋ Tambah tagihan rutin</button>`);
}

function bukaFormRutin(r) {
  const pertama = dompetBiasa()[0];
  F = r
    ? Object.assign({}, r, { modeRutin: true, idRutin: r.id, id: '', tanggal: r.berikutnya })
    : { modeRutin: true, idRutin: '', nama: '', tipe: TIPE.KELUAR, jumlah: 0, kategori: '', dompet: pertama ? pertama.nama : '',
        dompetTujuan: '', tanggal: hariIni(), catatan: '', ulang: 'Bulanan' };
  bukaSheet(r ? 'Ubah Tagihan Rutin' : 'Tagihan Rutin Baru', '<div id="form-trx"></div>');
  renderFormTrx();
}

/** Validasi bersama form transaksi & rutin; mengembalikan pesan kesalahan atau ''. */
function cekIsianTrx() {
  if (!F.jumlah) return 'Isi jumlahnya dulu.';
  if (F.tipe !== TIPE.TRANSFER && !F.kategori) return 'Pilih kategorinya dulu.';
  if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) return 'Pilih dompet tujuan yang berbeda.';
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

/** Mengecilkan foto supaya cepat dikirim. Hasil: { base64 (JPEG tanpa awalan data URL), thumb (data URL kecil) }. */
function kecilkanGambar(file, maks = 2000) {
  return new Promise((ok, gagal) => {
    const rusak = () => gagal(new Error('Gambar tidak bisa dibuka. Coba foto lain.'));
    const reader = new FileReader();
    reader.onerror = rusak;
    reader.onload = () => {
      const img = new Image();
      img.onerror = rusak;
      img.onload = () => {
        const gambar = ukuran => {
          const skala = Math.min(1, ukuran / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * skala);
          c.height = Math.round(img.height * skala);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          return c;
        };
        ok({
          base64: gambar(maks).toDataURL('image/jpeg', 0.85).split(',')[1],
          thumb: gambar(120).toDataURL('image/jpeg', 0.7),
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function mulaiStruk(file, dariForm) {
  const job = { id: ++nomorStruk, file, status: 'proses', thumb: '', hasil: null, pesan: '' };
  ANTRIAN.push(job);
  if (dariForm && F && $('#form-trx')) {
    bacaFieldTrx();
    F.strukJob = job.id;
    renderFormTrx();
  } else {
    toast('🧾 Struk sedang dibaca. Silakan lanjut pakai aplikasi.');
  }
  jalankanStruk(job);
}

async function jalankanStruk(job) {
  job.status = 'proses';
  job.pesan = '';
  renderAntrian();
  try {
    const g = await kecilkanGambar(job.file);
    job.thumb = g.thumb;
    renderAntrian();
    job.hasil = await api('bacaStruk', g.base64, 'image/jpeg');
    if (!ANTRIAN.includes(job)) return; // sudah dibuang pengguna
    job.status = 'siap';
    if (formMenungguStruk(job)) {
      terapkanStruk(job);
      hapusJob(job.id);
      toast(job.hasil.yakin ? 'Struk terbaca ✔ Cek lagi sebelum disimpan.' : 'Struk terbaca, tapi hasilnya kurang pasti. Periksa totalnya.');
    } else {
      getar();
      toast('🧾 Struk siap ditinjau: ' + rp(job.hasil.jumlah));
    }
  } catch (e) {
    if (!ANTRIAN.includes(job)) return;
    job.status = 'gagal';
    job.pesan = pesanError(e);
    if (formMenungguStruk(job)) {
      F.strukJob = null;
      renderFormTrx();
      toast('Struk gagal dibaca: ' + job.pesan, true);
    }
  }
  renderAntrian();
}

const formMenungguStruk = job => !!(F && F.strukJob === job.id && $('#form-trx'));

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
    if (j.status === 'proses') {
      isi = '<b>Membaca struk…</b><small>Boleh lanjut pakai aplikasi</small>';
      aksi = '<span class="spinner kecil" aria-label="Sedang memproses"></span>';
    } else if (j.status === 'siap') {
      isi = `<b>✅ Struk siap · ${rp(j.hasil.jumlah)}</b><small>${esc(j.hasil.catatan || j.hasil.kategori || 'Ketuk Tinjau untuk menyimpan')}</small>`;
      aksi = `<button type="button" class="btn btn-utama kecil" data-aksi="tinjau-struk" data-id="${j.id}">Tinjau</button>`;
    } else {
      isi = `<b>❌ Gagal dibaca</b><small>${esc(j.pesan)}</small>`;
      aksi = `<button type="button" class="btn btn-hapus kecil" data-aksi="ulangi-struk" data-id="${j.id}">Ulangi</button>`;
    }
    const tutup = j.status === 'proses' ? '' : `<button type="button" class="antrian-tutup" data-aksi="buang-struk" data-id="${j.id}" aria-label="Buang">✕</button>`;
    return `<div class="antrian-item ${j.status}" role="status">${gambar}<span class="isi">${isi}</span>${aksi}${tutup}</div>`;
  }).join('');
}

/** Ringkasan hasil baca struk tanpa istilah teknis; kalau totalnya beda-beda, tampilkan pilihan. */
function infoStruk(h) {
  const pilihan = h.pilihanJumlah.length > 1 ? `
    <p class="label" style="margin:0 0 6px">Ketuk total yang sesuai struk:</p>
    <div class="chips" style="margin-bottom:6px">${h.pilihanJumlah.map(p =>
      `<button type="button" class="chip ${p.jumlah === F.jumlah ? 'aktif' : ''}" data-aksi="f-pilih-jumlah" data-jumlah="${p.jumlah}">${rp(p.jumlah)}</button>`).join('')}</div>` : '';
  const status = h.yakin ? '✅ Yakin, totalnya terbaca sama beberapa kali.' : '⚠️ Cek lagi totalnya dengan struk.';
  return `<div style="margin:-8px 0 16px">${pilihan}<p class="info-kecil" style="text-align:left;margin-top:0">${status}</p></div>`;
}

/** kode: kode penautan yang baru dibuat, ditampilkan beserta tombol pembuka Telegram. */
function bukaFormTelegram(kode) {
  const t = S.data.telegram;
  const salin = (id, nilai) => `<div class="salin"><input class="field" id="${id}" readonly value="${esc(nilai)}">
    <button type="button" class="btn btn-hapus" data-aksi="salin" data-target="${id}">Salin</button></div>`;
  if (!t.bot) {
    return bukaSheet('Bot Telegram', `
      <p style="margin-top:0">Catat transaksi cukup dengan chat (<i>"makan bakso 25rb"</i>) atau kirim foto struk ke bot Telegram keluarga.</p>
      <span class="label">Belum dipasang. Pemilik memasangnya sekali (±10 menit):</span>
      <ol class="panduan" style="padding-left:20px;margin:0 0 16px">
        <li>Di Telegram, buka <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> → <b>/newbot</b>, lalu salin tokennya.</li>
        <li>Buat proyek di <a href="https://script.new" target="_blank" rel="noopener">script.new</a>, tempel isi folder <b>bot/</b> dari repo.</li>
        <li>Di <b>Project Settings → Script Properties</b>, isi <code>TELEGRAM_TOKEN</code> dan <code>SPREADSHEET_ID</code> (salin di bawah).</li>
        <li><b>Deploy → Web app</b>, lalu jalankan fungsi <b>pasangWebhook</b>.</li>
      </ol>
      <div class="grup-form"><span class="label">SPREADSHEET_ID</span>${salin('salin-id', S.data.spreadsheetId)}</div>
      <p class="info-kecil" style="text-align:left">Panduan lengkap ada di <b>docs/PEMILIK.md</b> di repo, bagian <b>Bot Telegram</b>. Setelah dipasang, buka lagi menu ini untuk menautkan akun.</p>`);
  }
  bukaSheet('Bot Telegram', `
    <a class="baris" href="https://t.me/${esc(t.bot)}" target="_blank" rel="noopener">
      <span class="ikon-bulat">🤖</span>
      <span class="isi"><b>@${esc(t.bot)}</b><small>Buka di Telegram</small></span>
      <span class="panah">›</span>
    </a>
    ${kode ? `
      <div class="kartu" style="margin:14px 0;text-align:center;background:var(--primary-soft);border:0">
        <small class="label" style="margin:0">Kode penautan · berlaku 15 menit</small>
        <div style="font-size:30px;font-weight:800;letter-spacing:.2em;margin:6px 0 12px">${esc(kode)}</div>
        <a class="btn btn-utama" style="display:block;text-decoration:none" href="https://t.me/${esc(t.bot)}?start=${esc(kode)}" target="_blank" rel="noopener">Buka Telegram & hubungkan</a>
        <p class="info-kecil" style="margin-bottom:0">Atau kirim <b>/hubungkan ${esc(kode)}</b> ke bot.</p>
      </div>` : ''}
    <span class="label" style="margin-top:14px">Akun terhubung (${t.pengguna.length})</span>
    ${t.pengguna.map(p => `
      <div class="baris">
        <span class="ikon-bulat">👤</span>
        <span class="isi"><b>${esc(p.nama)}</b><small>${esc(p.email)}${p.username ? ' · @' + esc(p.username) : ''}</small></span>
        <button type="button" class="tombol-ikon" data-aksi="putus-telegram" data-id="${esc(p.id)}" aria-label="Putuskan ${esc(p.nama)}">✕</button>
      </div>`).join('') || '<p class="info-kecil" style="text-align:left;margin-top:0">Belum ada.</p>'}
    ${kode ? '' : '<div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="kode-telegram">Hubungkan akun Telegram saya</button></div>'}
    <details class="tabel-data">
      <summary>Contoh pesan ke bot</summary>
      <ul class="panduan" style="padding-left:20px">
        <li><i>makan bakso 25rb</i></li>
        <li><i>bensin 30rb pakai gopay, parkir 5rb</i></li>
        <li><i>gaji masuk 8jt ke rekening bank</i></li>
        <li><i>setor dana darurat 500rb</i></li>
        <li><i>yang terakhir ubah jadi 30rb</i></li>
        <li><i>pengeluaran bulan ini berapa?</i></li>
        <li>kirim foto struk 📸</li>
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
  bukaSheet('Baca Struk Lebih Akurat', `
    <p style="margin-top:0">Foto struk <b>tetap bisa dibaca tanpa pengaturan apa pun</b>. Dengan kunci Gemini (AI dari Google, gratis),
      hasilnya jauh lebih akurat, termasuk kategori dan catatan.</p>
    ${daftar.length ? `
      <div style="margin-bottom:12px">${daftar.map((k, i) => `
        <div class="baris">
          <span class="ikon-bulat">🔑</span>
          <span class="isi"><b>${i ? 'Kunci cadangan ' + i : '✅ Kunci aktif'}</b><small>${esc(k)}</small></span>
          <button type="button" class="tombol-ikon" data-aksi="hapus-gemini" data-kunci="${esc(k)}" aria-label="Hapus kunci ${i + 1}">🗑️</button>
        </div>`).join('')}</div>
      <details class="tabel-data">
        <summary>Tambah kunci cadangan</summary>
        <p class="info-kecil" style="text-align:left">Kalau kuota harian satu kunci habis, aplikasi otomatis memakai kunci berikutnya.</p>
        ${isian('Kunci cadangan', 'Tambah')}
      </details>` : `
      <ol class="panduan" style="padding-left:20px;margin-bottom:16px">
        <li>Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> dan masuk dengan akun Google.</li>
        <li>Klik <b>Create API key</b>, lalu salin kuncinya.</li>
        <li>Tempel di bawah, lalu ketuk Simpan.</li>
      </ol>
      ${isian('Kunci Gemini', 'Simpan')}`}
    <p class="info-kecil" style="text-align:left">Kunci disimpan di spreadsheet keluarga, jadi otomatis dipakai semua anggota.</p>`);
}

// ---------- Form dompet ----------

/** Form dompet biasa maupun tabungan (jenis diambil dari w, atau dari parameter untuk yang baru). */
function bukaFormDompet(w, jenis) {
  jenis = w ? w.jenis : jenis || JENIS.DOMPET;
  if (jenis === JENIS.UTANG) {
    // Orang utang-piutang: jumlahnya hanya berubah lewat transaksi, jadi yang bisa diubah cuma nama & jatuh tempo.
    F = { namaLama: w.nama, ikon: w.ikon, jenis, saldoAwal: w.saldoAwal, mutasi: 0, saldoTampil: '' };
    return bukaSheet('Ubah ' + w.nama, `
      <div class="grup-form">
        <label class="label" for="d-nama">Nama orang</label>
        <input class="field" id="d-nama" maxlength="40" value="${esc(w.nama)}">
      </div>
      <div class="grup-form">
        <label class="label" for="d-tenggat">Jatuh tempo (opsional)</label>
        <input class="field" id="d-tenggat" type="date" value="${esc(w.tenggat)}">
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-hapus" data-aksi="hapus-dompet">Hapus</button>
        <button type="button" class="btn btn-utama" data-aksi="simpan-dompet">Simpan</button>
      </div>
      <p class="info-kecil">Hanya bisa dihapus kalau belum ada transaksinya.</p>`);
  }
  const tab = jenis === JENIS.TABUNGAN;
  const sebutan = tab ? 'tabungan' : 'dompet';
  const saldoTampil = formatAngka(w ? Math.max(0, w.saldo) : 0);
  F = {
    namaLama: w ? w.nama : '', ikon: w ? w.ikon : (tab ? '🐷' : '👛'), jenis,
    saldoAwal: w ? w.saldoAwal : 0, mutasi: w ? w.saldo - w.saldoAwal : 0, saldoTampil,
  };
  const ket = !w
    ? (tab ? 'Jumlah yang sudah terkumpul sebelum dicatat di aplikasi ini.' : 'Saldo saat Anda mulai mencatat di aplikasi ini.')
    : `Tidak sama dengan ${tab ? 'jumlah sebenarnya' : 'saldo di rekening/dompet asli'}? Ganti dengan angka sebenarnya, saldo akan disesuaikan tanpa mengubah riwayat transaksi.`;
  bukaSheet((w ? 'Ubah ' : 'Tambah ') + (tab ? 'Tabungan' : 'Dompet'), `
    <div class="grup-form">
      <label class="label" for="d-nama">Nama ${sebutan}</label>
      <input class="field" id="d-nama" maxlength="40" placeholder="${tab ? 'mis. Dana Darurat, Liburan, Umroh' : 'mis. BCA, GoPay, Celengan'}" value="${esc(w ? w.nama : '')}">
    </div>
    <div class="grup-form">
      <label class="label" for="d-saldo">${tab ? 'Terkumpul sekarang' : 'Saldo sekarang'}</label>
      <input class="field" id="d-saldo" inputmode="numeric" placeholder="0" value="${saldoTampil}">
      <p class="info-kecil" style="text-align:left">${ket}</p>
    </div>
    ${tab ? `
      <div class="grup-form">
        <label class="label" for="d-target">Target (opsional)</label>
        <input class="field" id="d-target" inputmode="numeric" placeholder="Tanpa batas" value="${formatAngka(w && w.target)}">
        <p class="info-kecil" style="text-align:left">Kosongkan untuk tabungan tanpa batas.</p>
      </div>
      <div class="grup-form">
        <label class="label" for="d-tenggat">Ingin tercapai pada (opsional)</label>
        <input class="field" id="d-tenggat" type="date" value="${esc(w ? w.tenggat : '')}">
      </div>` : ''}
    <div class="grup-form"><span class="label">Ikon</span>${gridIkon(F.ikon)}</div>
    <div class="aksi-form">
      ${w ? '<button type="button" class="btn btn-hapus" data-aksi="hapus-dompet">Hapus</button>' : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-dompet">Simpan</button>
    </div>`);
}

function bukaTabungan(w) {
  const p = progresTabungan(w);
  bukaSheet(w.nama, `
    <div class="ringkas-tabungan">
      <span class="ikon-bulat">${esc(w.ikon)}</span>
      <div><small>Terkumpul</small><b>${rp(w.saldo)}</b></div>
    </div>
    ${p.persen !== null ? `<span class="meter" role="meter" aria-label="${esc(w.nama)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.persen}"><i style="width:${p.persen}%"></i></span>` : ''}
    <p class="info-kecil" style="text-align:left;margin:8px 0 16px">${esc(p.teks)}</p>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="tarik-tabungan" data-nama="${esc(w.nama)}">Tarik</button>
      <button type="button" class="btn btn-utama" data-aksi="setor-tabungan" data-nama="${esc(w.nama)}">Setor</button>
    </div>
    <button type="button" class="tombol-tambah" style="margin-top:12px" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">✏️ Ubah tabungan</button>`);
}

function bukaFormAnggaran() {
  const daftar = S.data.kategori.filter(k => k.tipe === TIPE.KELUAR);
  bukaSheet('Anggaran Bulanan', `
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">Batas belanja per kategori setiap bulan. Kosongkan kategori yang tidak perlu dibatasi.</p>
    ${daftar.map(k => `
      <label class="baris baris-input">
        <span class="ikon-bulat">${esc(k.ikon)}</span>
        <span class="isi"><b>${esc(k.nama)}</b></span>
        <input class="field input-rp input-anggaran" data-nama="${esc(k.nama)}" inputmode="numeric" placeholder="Tanpa batas" value="${formatAngka(k.anggaran)}">
      </label>`).join('')}
    <p class="info-kecil" id="total-anggaran"></p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-anggaran">Simpan</button></div>`);
  hitungTotalAnggaran();
}

function hitungTotalAnggaran() {
  const total = Array.from(document.querySelectorAll('.input-anggaran')).reduce((a, el) => a + angka(el.value), 0);
  $('#total-anggaran').textContent = 'Total anggaran per bulan: ' + rp(total);
}

// ---------- Kelola kategori ----------

function bukaDaftarKategori(tipe) {
  tipe = tipe || TIPE.KELUAR;
  const daftar = S.data.kategori.filter(k => k.tipe === tipe);
  bukaSheet('Kelola Kategori', `
    <div class="segmen">
      ${[TIPE.KELUAR, TIPE.MASUK].map(t =>
        `<button type="button" class="${t === tipe ? 'aktif' : ''}" data-aksi="daftar-kategori" data-tipe="${t}">${t}</button>`).join('')}
    </div>
    ${daftar.map(k => `
      <button class="baris" data-aksi="edit-kategori" data-nama="${esc(k.nama)}" data-tipe="${esc(k.tipe)}">
        <span class="ikon-bulat">${esc(k.ikon)}</span>
        <span class="isi"><b>${esc(k.nama)}</b></span>
        <span class="panah">›</span>
      </button>`).join('')}
    <button class="tombol-tambah" data-aksi="tambah-kategori" data-tipe="${tipe}">＋ Tambah kategori ${tipe.toLowerCase()}</button>`);
}

function bukaFormKategori(k, tipe) {
  F = { namaLama: k ? k.nama : '', tipeLama: k ? k.tipe : tipe, tipe: k ? k.tipe : tipe, ikon: k ? k.ikon : '🏷️' };
  bukaSheet(k ? 'Ubah Kategori' : 'Tambah Kategori', `
    <div class="grup-form">
      <label class="label" for="k-nama">Nama kategori ${esc(F.tipe.toLowerCase())}</label>
      <input class="field" id="k-nama" maxlength="40" placeholder="mis. Jajan Anak" value="${esc(k ? k.nama : '')}">
    </div>
    <div class="grup-form"><span class="label">Ikon</span>${gridIkon(F.ikon)}</div>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="daftar-kategori" data-tipe="${esc(F.tipe)}">Kembali</button>
      ${k ? '<button type="button" class="btn btn-hapus" data-aksi="hapus-kategori">Hapus</button>' : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-kategori">Simpan</button>
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

  'tambah-trx': () => bukaFormTrx(null),
  'edit-trx': el => bukaFormTrx(S.data.transaksi.find(t => t.id === el.dataset.id)),
  'tutup-sheet': () => tutupSheet(),
  'f-tipe': el => {
    bacaFieldTrx();
    if (F.tipe !== el.dataset.tipe) { F.tipe = el.dataset.tipe; F.kategori = ''; }
    renderFormTrx();
  },
  'foto-struk': () => {
    // Tanpa kunci Gemini, struk tetap dibaca dengan OCR saja.
    bacaFieldTrx();
    sumberStruk = 'form';
    $('#input-struk').click();
  },
  'tinjau-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (!job || job.status !== 'siap') return;
    bukaFormTrx(null, null, 'Tinjau Struk');
    terapkanStruk(job);
  },
  'ulangi-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job) jalankanStruk(job);
  },
  'buang-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job && job.status === 'siap' && !confirm('Buang hasil struk ini tanpa menyimpannya?')) return;
    hapusJob(el.dataset.id);
  },
  'f-pilih-jumlah': el => { bacaFieldTrx(); F.jumlah = Number(el.dataset.jumlah); renderFormTrx(); },
  'gemini': () => bukaFormGemini(),
  'telegram': () => bukaFormTelegram(),
  'kode-telegram': async el => {
    el.disabled = true;
    loading(true);
    try {
      const r = await api('buatKodeTelegram');
      bukaFormTelegram(r.kode);
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'putus-telegram': async el => {
    if (!confirm('Putuskan akun Telegram ini dari Dompet Keluarga?')) return;
    if (await kirim(el, 'putuskanTelegram', [el.dataset.id], 'Akun Telegram diputuskan')) bukaFormTelegram();
  },
  'salin': async el => {
    const input = $('#' + el.dataset.target);
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast('Disalin ✔');
  },
  'simpan-gemini': async el => {
    const kunci = $('#g-kunci').value.trim();
    if (!kunci) return toast('Tempel kunci API-nya dulu.', true);
    if (await kirim(el, 'tambahKunciGemini', [kunci], 'Kunci Gemini tersimpan ✔')) bukaFormGemini();
  },
  'hapus-gemini': async el => {
    if (!confirm('Hapus kunci API ' + el.dataset.kunci + '?')) return;
    if (await kirim(el, 'hapusKunciGemini', [el.dataset.kunci], 'Kunci API dihapus')) bukaFormGemini();
  },
  'f-kategori': el => { bacaFieldTrx(); F.kategori = el.dataset.nama; renderFormTrx(); },
  'f-dompet': el => { bacaFieldTrx(); F.dompet = el.dataset.nama; renderFormTrx(); },
  'f-tujuan': el => { bacaFieldTrx(); F.dompetTujuan = el.dataset.nama; renderFormTrx(); },
  'simpan-trx': el => {
    bacaFieldTrx();
    if (!F.jumlah) return toast('Isi jumlahnya dulu.', true);
    if (F.tipe !== TIPE.TRANSFER && !F.kategori) return toast('Pilih kategorinya dulu.', true);
    if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) return toast('Pilih dompet tujuan yang berbeda.', true);
    const pesan = F.id ? 'Transaksi diperbarui ✔' : 'Transaksi tersimpan ✔';
    const t = F;
    const dariJob = t.dariJob;
    // ID transaksi baru dibuat di HP, supaya kiriman ulang (setelah sinyal putus) tidak membuat data dobel.
    if (!t.id && !t.idBaru) t.idBaru = crypto.randomUUID();
    const tunda = () => { simpanTertunda(t); if (dariJob) hapusJob(dariJob); return true; };
    if (!t.id && (S.offline || !navigator.onLine)) return tunda();
    kirim(el, 'simpanTransaksi', [t], pesan, e => !t.id && e.jaringan && tunda())
      .then(ok => { if (ok && dariJob) hapusJob(dariJob); });
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
    kirim(el, 'simpanMulaiPeriode', [F.mulai], 'Periode gajian tersimpan ✔');
  },
  'f-ulang': el => { bacaFieldTrx(); F.ulang = el.dataset.ulang; renderFormTrx(); },
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
  'lewati-rutin': el => {
    if (!confirm('Lewati tagihan ini tanpa mencatat transaksi? Jatuh temponya pindah ke ' + tanggalPendek(F.berikutRutin) + '.')) return;
    kirim(el, 'majukanRutin', [F.dariRutin], 'Dilewati ✔ Berikutnya ' + tanggalPendek(F.berikutRutin));
  },
  'simpan-rutin': async el => {
    bacaFieldTrx();
    const salah = cekIsianTrx() || (!F.tanggal ? 'Isi tanggal jatuh tempo.' : '');
    if (salah) return toast(salah, true);
    const ok = await kirim(el, 'simpanRutin', [{
      id: F.idRutin, nama: F.nama, tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet,
      dompetTujuan: F.dompetTujuan, catatan: F.catatan, ulang: F.ulang, berikutnya: F.tanggal,
    }], 'Tagihan rutin tersimpan ✔');
    if (ok) bukaDaftarRutin();
  },
  'hapus-rutin': async el => {
    if (!confirm('Hapus tagihan rutin "' + (F.nama || '') + '"? Transaksi yang sudah dicatat tidak ikut terhapus.')) return;
    if (await kirim(el, 'hapusRutin', [F.idRutin], 'Tagihan rutin dihapus')) bukaDaftarRutin();
  },
  'kirim-tertunda': async () => {
    if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
    loading(true);
    await kirimTertunda();
    loading(false);
    if (tertunda().some(t => !t.gagal)) toast('Belum bisa dikirim. Periksa koneksi internet.', true);
  },
  'ulang-tertunda': el => {
    const t = tertunda().find(x => x.idBaru === el.dataset.id);
    tulisLokal('tertunda', tertunda().filter(x => x.idBaru !== el.dataset.id));
    render();
    if (t) {
      bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet,
        dompetTujuan: t.dompetTujuan, tanggal: t.tanggal, catatan: t.catatan }, 'Catat Ulang');
    }
  },
  'hapus-trx': el => {
    if (confirm('Hapus transaksi ini?')) kirim(el, 'hapusTransaksi', [F.id], 'Transaksi dihapus');
  },

  'tambah-dompet': () => bukaFormDompet(null, JENIS.DOMPET),
  'tambah-tabungan': () => bukaFormDompet(null, JENIS.TABUNGAN),
  'edit-dompet': el => bukaFormDompet(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'buka-tabungan': el => bukaTabungan(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'simpan-dompet': el => {
    const tab = F.jenis === JENIS.TABUNGAN;
    const nama = $('#d-nama').value.trim();
    if (!nama) return toast('Isi nama ' + (tab ? 'tabungan' : 'dompet') + ' dulu.', true);
    // Yang diisi adalah saldo sekarang; saldo awal dihitung mundur dari mutasi transaksi,
    // jadi riwayat transaksi tidak berubah. Field yang tidak disentuh → saldo awal tetap.
    const isian = $('#d-saldo') ? $('#d-saldo').value : F.saldoTampil; // form orang utang tidak punya isian saldo
    const saldoAwal = isian === F.saldoTampil ? F.saldoAwal : angka(isian) - F.mutasi;
    kirim(el, 'simpanDompet', [{
      namaLama: F.namaLama, nama, ikon: F.ikon, jenis: F.jenis,
      saldoAwal,
      target: tab ? angka($('#d-target').value) : 0,
      tenggat: $('#d-tenggat') ? $('#d-tenggat').value : '',
    }], 'Tersimpan ✔');
  },
  'tambah-utang': el => bukaFormUtang(el.dataset.nama, el.dataset.arah),
  'buka-utang': el => bukaUtang(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'u-arah': el => { bacaFormUtang(); F.arah = el.dataset.arah; renderFormUtang(); },
  'u-dompet': el => { bacaFormUtang(); F.dompet = el.dataset.nama; renderFormUtang(); },
  'simpan-utang': el => {
    bacaFormUtang();
    if (!F.nama) return toast('Isi nama orangnya dulu.', true);
    if (!F.jumlah) return toast('Isi jumlahnya dulu.', true);
    if (!F.dompet) return toast('Pilih dompetnya dulu.', true);
    kirim(el, 'catatUtang', [{ nama: F.nama, arah: F.arah, jumlah: F.jumlah, dompet: F.dompet, tanggal: F.tanggal, tenggat: F.tenggat, catatan: F.catatan }],
      F.arah === 'piutang' ? 'Pinjaman ke ' + F.nama + ' tercatat ✔' : 'Utang ke ' + F.nama + ' tercatat ✔');
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
      catatan: dia ? 'Pelunasan dari ' + w.nama : 'Bayar utang ke ' + w.nama,
    }, dia ? 'Terima dari ' + w.nama : 'Bayar ke ' + w.nama);
  },
  'hapus-dompet': el => {
    if (confirm('Hapus "' + F.namaLama + '"?')) kirim(el, 'hapusDompet', [F.namaLama], 'Dihapus');
  },
  'setor-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast('Buat dompet dulu sebagai sumber setoran.', true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: pertama.nama, dompetTujuan: el.dataset.nama }, 'Setor ke ' + el.dataset.nama);
  },
  'tarik-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast('Buat dompet dulu sebagai tujuan penarikan.', true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: el.dataset.nama, dompetTujuan: pertama.nama }, 'Tarik dari ' + el.dataset.nama);
  },

  'atur-anggaran': () => bukaFormAnggaran(),
  'rincian-anggaran': () => bukaRincianAnggaran(),
  'cepat-struk': () => {
    // Langsung buka pemilih foto (masih dalam ketukan pengguna supaya tidak diblokir browser);
    // struk dibaca di latar belakang tanpa membuka form.
    sumberStruk = 'cepat';
    $('#input-struk').click();
  },
  'cepat-transfer': () => bukaFormTrx(null, { tipe: TIPE.TRANSFER }, 'Transfer'),
  'simpan-anggaran': el => {
    const peta = {};
    document.querySelectorAll('.input-anggaran').forEach(i => { peta[i.dataset.nama] = angka(i.value); });
    kirim(el, 'simpanAnggaran', [peta], 'Anggaran tersimpan ✔');
  },

  'tahun': async el => {
    S.tahun += Number(el.dataset.geser);
    S.bulan = S.tahun === new Date().getFullYear() ? periodeSekarang() : S.tahun + '-12';
    render();
    muat(); // muat ulang transaksi bulan terpilih untuk tab lain, di latar belakang
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
    if (!nama) return toast('Isi nama kategori dulu.', true);
    const tipe = F.tipe;
    const ok = await kirim(el, 'simpanKategori', [{ namaLama: F.namaLama, tipeLama: F.tipeLama, nama, tipe, ikon: F.ikon }], 'Kategori tersimpan ✔');
    if (ok) bukaDaftarKategori(tipe);
  },
  'hapus-kategori': async el => {
    if (!confirm('Hapus kategori "' + F.namaLama + '"?')) return;
    const tipe = F.tipeLama;
    const ok = await kirim(el, 'hapusKategori', [F.namaLama, F.tipeLama], 'Kategori dihapus');
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
    if (!nama) return toast('Ketik nama dompetnya dulu.', true);
    const ada = semuaDompetSetup().find(([n]) => n.toLowerCase() === nama.toLowerCase());
    if (!ada) S.setup.lain.push(nama);
    const n = ada ? ada[0] : nama;
    if (!S.setup.pilih.includes(n)) S.setup.pilih.push(n);
    renderSetup();
  },
  'buat-db': async el => {
    bacaSetup();
    const st = S.setup;
    if (!st.pilih.length) return toast('Pilih minimal satu dompet.', true);
    const dompet = semuaDompetSetup().filter(([n]) => st.pilih.includes(n))
      .map(([nama, ikon]) => ({ nama, ikon, saldoAwal: st.saldo[nama] || 0 }));
    el.disabled = true;
    loading(true);
    try {
      await api('buatDatabase', st.email, dompet);
      await muat();
      toast('Siap dipakai ✔ Ketuk ＋ untuk mencatat transaksi pertama.');
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
      const email = await GOOGLE.masuk();
      if (email !== S.data.user) return await muatDariAwal(); // ternyata akun lain
      $('#sesi').hidden = true;
      if ($('#sheet').hidden) {
        loading(true);
        await muat();
        loading(false);
        toast('Tersambung lagi ✔');
      } else {
        toast('Tersambung lagi ✔ Silakan ulangi, isian Anda masih ada.');
      }
    } catch (e) {
      loading(false);
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'keluar': () => {
    const n = tertunda().length;
    if (!confirm(n ? `${n} transaksi belum terkirim dan akan hilang. Tetap keluar dari ${GOOGLE.email()}?` : 'Keluar dari ' + GOOGLE.email() + '?')) return;
    // Data yang tersimpan di HP ikut dihapus, karena HP bisa dipakai orang lain.
    tulisLokal('data', null);
    tulisLokal('tertunda', null);
    GOOGLE.keluar();
    S.data = null;
    tampilMasuk();
  },

  'undang': () => bukaSheet('Undang Anggota Keluarga', `
    <div class="grup-form">
      <label class="label" for="u-email">Email Google</label>
      <input class="field" id="u-email" type="email" inputmode="email" placeholder="nama@gmail.com">
      <p class="info-kecil" style="text-align:left">Akun ini akan jadi Editor spreadsheet, dan Google mengirim email berisi link undangan.</p>
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="kirim-undangan">Undang</button></div>
    <div class="grup-form" style="margin-top:20px">
      <label class="label" for="u-link">Atau kirim link undangan ini (mis. lewat WhatsApp)</label>
      <div class="salin">
        <input class="field" id="u-link" readonly value="${esc(S.data.linkUndangan)}">
        <button type="button" class="btn btn-hapus" data-aksi="salin-link">Salin</button>
      </div>
      <p class="info-kecil" style="text-align:left">Link ini hanya bisa dipakai akun yang sudah diberi akses ke spreadsheet.</p>
    </div>`),
  'kirim-undangan': el => {
    const email = $('#u-email').value.trim();
    if (!email) return toast('Isi emailnya dulu.', true);
    kirim(el, 'bagikanKe', [email], 'Undangan terkirim ✔');
  },
  'salin-link': async () => {
    const input = $('#u-link');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast('Link disalin ✔');
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

document.addEventListener('click', e => {
  const el = e.target.closest('[data-aksi]');
  if (!el || !AKSI[el.dataset.aksi]) return;
  e.preventDefault();
  AKSI[el.dataset.aksi](el, e);
});

$('#input-struk').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) mulaiStruk(file, sumberStruk === 'form');
  sumberStruk = 'cepat';
});

// Format ribuan saat mengetik nominal.
document.addEventListener('input', e => {
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

// ---------- Aplikasi terpasang (PWA) & pembaruan otomatis ----------
// Isi aplikasi selalu diambil dari GitHub Pages (lihat sw.js), jadi cukup pasang sekali.
// Aplikasi yang lama terbuka di latar belakang dicek lewat versi.txt (dibuat saat deploy),
// lalu dimuat ulang sendiri saat pengguna sedang tidak mengisi apa pun.

const MODE_APLIKASI = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let ajakanPasang = null;
let versiAwal = null;
let pembaruanDitunda = false;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  ajakanPasang = e;
  if (S.data && S.tab === 'lainnya') render();
});
window.addEventListener('appinstalled', () => {
  ajakanPasang = null;
  toast('Aplikasi terpasang ✔ Buka dari layar utama HP');
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

async function cekPembaruan() {
  const v = await versiServer();
  if (!v) return;
  if (!versiAwal) { versiAwal = v; return; }
  if (v === versiAwal) return;
  if (!sedangSibuk()) return location.reload();
  if (!pembaruanDitunda) toast('Versi baru tersedia, dipasang setelah Anda selesai');
  pembaruanDitunda = true;
}

// Sinyal kembali → keluar dari mode offline & kirim transaksi tertunda (kalau sesi habis, minta lanjutkan dulu).
window.addEventListener('online', () => {
  if (!S.data || S.data.perluSetup) return;
  if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
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

mulai();
