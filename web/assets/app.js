const PILIHAN_IKON = ['🍜', '🛒', '⛽', '🚗', '🛵', '💡', '🏠', '💊', '📚', '👶', '🍼', '🎬', '👕', '🤲', '📦', '☕',
  '🎮', '✈️', '🐱', '📞', '🔧', '🧾', '💼', '🎁', '🏪', '📈', '💰', '💵', '🏦', '📱', '💳', '👛',
  '🐷', '🎯', '🏖️', '🎓', '💍', '🕋', '🏍️', '🛡️'];

const S = {
  data: null,
  bulan: bulanSekarang(),
  tab: 'beranda',
  filterTipe: 'Semua',
  cari: '',
  gabung: '', // ID spreadsheet dari link undangan (#gabung=...)
  tahun: new Date().getFullYear(), // tahun yang dilihat di Laporan
  lapKategori: 'bulan',            // Laporan → pengeluaran per kategori: 'bulan' | 'tahun'
};
let F = null; // state form yang sedang terbuka

// ---------- Util ----------

async function api(fungsi, ...args) {
  try {
    return await SERVER[fungsi](...args);
  } catch (e) {
    if (e instanceof GOOGLE.PerluMasuk) tampilMasuk();
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

const dompetBiasa = () => S.data.dompet.filter(w => w.jenis !== JENIS.TABUNGAN);
const daftarTabungan = () => S.data.dompet.filter(w => w.jenis === JENIS.TABUNGAN);
const adalahTabungan = nama => S.data.dompet.some(w => w.nama === nama && w.jenis === JENIS.TABUNGAN);
function angka(s) {
  return Number(String(s).replace(/\D/g, '')) || 0;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function namaBulan(b) {
  return keTanggal(b).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
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
    $('#nav').hidden = !!S.data.perluSetup;
    if (S.data.perluSetup) $('#view').innerHTML = viewSetup();
    else render();
  } catch (e) {
    if (e instanceof GOOGLE.PerluMasuk) return;
    if (!S.data || S.data.perluSetup) {
      $('#nav').hidden = true;
      $('#view').innerHTML = viewGagal(e);
    } else {
      toast(pesanError(e), true);
    }
  }
}

function tampilMasuk() {
  tutupSheet();
  loading(false);
  $('#nav').hidden = true;
  $('#view').innerHTML = `
    <div class="sambut">
      <div class="logo">👛</div>
      <h1>Dompet Keluarga</h1>
      <p>Catat keuangan keluarga bersama. Semua data tersimpan di Google Spreadsheet milik Anda sendiri.</p>
      ${S.gabung ? '<p><b>Anda diundang bergabung.</b> Masuk dengan akun Google yang diundang untuk melanjutkan.</p>' : ''}
      <button type="button" class="btn btn-utama" data-aksi="masuk">Masuk dengan Google</button>
    </div>`;
}

function viewGagal(e) {
  return `
    <div class="sambut">
      <div class="logo">⚠️</div>
      <p>${esc(pesanError(e))}</p>
      <button type="button" class="btn btn-utama" data-aksi="coba-lagi">Coba lagi</button>
      ${e.tanpaAkses ? '<button type="button" class="btn btn-hapus" data-aksi="lupakan-db">Pakai spreadsheet lain</button>' : ''}
      <button type="button" class="btn btn-hapus" data-aksi="keluar">Keluar (${esc(GOOGLE.email() || '')})</button>
    </div>`;
}

function render() {
  const view = { beranda: viewBeranda, riwayat: viewRiwayat, dompet: viewDompet, laporan: viewLaporan, lainnya: viewLainnya }[S.tab];
  $('#view').innerHTML = view();
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
    </section>

    <div class="aksi-cepat">
      <button data-aksi="tambah-trx"><span class="kotak">${svg('plus')}</span>Catat</button>
      <button data-aksi="cepat-struk"><span class="kotak">${svg('kamera')}</span>Foto struk</button>
      <button data-aksi="cepat-transfer"><span class="kotak">${svg('transfer')}</span>Transfer</button>
      <button data-aksi="tab" data-tab="laporan"><span class="kotak">${svg('laporan')}</span>Laporan</button>
    </div>

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
          <span class="isi"><b>${esc(w.nama)}</b><small>Saldo awal ${rp(w.saldoAwal)}</small></span>
          <b class="nominal ${w.saldo < 0 ? 'minus' : ''}">${rp(w.saldo)}</b>
        </button>`).join('') || kosong('👛', 'Belum ada dompet.')}
    </section>
    <button class="tombol-tambah" data-aksi="tambah-dompet">＋ Tambah dompet</button>

    <h2 class="judul-bagian">Tabungan</h2>
    ${tabungan.length
      ? `<section class="kartu" style="padding:4px 16px">${tabungan.map(itemTabungan).join('')}</section>`
      : `<section class="kartu">${kosong('🐷', 'Belum ada tabungan. Buat tabungan dengan target (mis. dana darurat, liburan) atau tanpa batas.')}</section>`}
    <button class="tombol-tambah" data-aksi="tambah-tabungan">＋ Tambah tabungan</button>`;
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

function viewSetup() {
  return `
    <div class="kepala"><div><small>Selamat datang,</small><h1>${esc(namaPendek(S.data.user))} 👋</h1></div></div>
    <section class="kartu">
      <h3>📒 Siapkan Dompet Keluarga</h3>
      <p>Aplikasi akan membuat spreadsheet <b>Dompet Keluarga</b> di Google Drive akun
        <b>${esc(S.data.user)}</b> untuk menyimpan semua catatan keuangan.</p>
    </section>
    <section class="kartu">
      <div class="grup-form">
        <label class="label" for="s-pasangan">Email Google pasangan (opsional)</label>
        <input class="field" id="s-pasangan" type="email" inputmode="email" placeholder="nama@gmail.com">
        <p class="info-kecil" style="text-align:left">Supaya bisa mencatat berdua. Bisa juga diisi nanti dari menu Lainnya.</p>
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-utama" data-aksi="buat-db">Buat spreadsheet baru</button>
      </div>
    </section>
    <section class="kartu">
      <h3>🔗 Sudah punya spreadsheet?</h3>
      <p style="margin-top:0">Kalau diundang pasangan, atau sebelumnya memakai versi Apps Script, tempel link spreadsheet-nya di sini.</p>
      <div class="grup-form">
        <input class="field" id="s-link" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…">
      </div>
      <div class="aksi-form">
        <button type="button" class="btn btn-hapus" style="flex:1" data-aksi="hubungkan-db">Hubungkan</button>
      </div>
    </section>
    <button type="button" class="tombol-tambah" data-aksi="keluar">Keluar dari ${esc(S.data.user)}</button>`;
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
      <button class="baris" data-aksi="gemini">
        <span class="ikon-bulat">🤖</span>
        <span class="isi"><b>Baca struk dengan AI</b><small>${d.kunciGemini.length ? `Aktif · ${d.kunciGemini.length} kunci API` : 'Belum diatur, perlu kunci API Gemini'}</small></span>
        <span class="panah">›</span>
      </button>
      <a class="baris" href="${esc(d.urlSpreadsheet)}" target="_blank" style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">📊</span>
        <span class="isi"><b>Buka spreadsheet</b><small>Lihat semua data di Google Sheets</small></span>
        <span class="panah">›</span>
      </a>
    </section>
    <section class="kartu panduan">
      <h3>📲 Pasang di layar utama HP</h3>
      <b>Android (Chrome):</b>
      <ol><li>Ketuk menu ⋮ di kanan atas.</li><li>Pilih <b>Tambahkan ke layar utama</b>.</li><li>Ketuk <b>Tambahkan</b>.</li></ol>
      <b>iPhone (Safari):</b>
      <ol><li>Ketuk tombol Bagikan (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b>.</li></ol>
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

async function kirim(tombol, fungsi, args, pesan) {
  tombol.disabled = true;
  loading(true);
  try {
    await api(fungsi, ...args);
    tutupSheet();
    await muat();
    toast(pesan);
    return true;
  } catch (e) {
    toast(pesanError(e), true);
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
    .filter(w => termasukTabungan || w.jenis !== JENIS.TABUNGAN || w.nama === terpilih).map(w =>
    `<button type="button" class="pilihan ${w.nama === terpilih ? 'aktif' : ''}" data-aksi="${aksi}" data-nama="${esc(w.nama)}">
      <span>${esc(w.ikon)}</span>${esc(w.nama)}</button>`).join('')}</div>`;

  $('#form-trx').innerHTML = `
    <div class="segmen">
      ${[TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button type="button" class="${F.tipe === t ? 'aktif' : ''}" data-aksi="f-tipe" data-tipe="${t}">${t}</button>`).join('')}
    </div>

    ${!F.id && F.tipe === TIPE.KELUAR ? `
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
      <label class="label" for="f-tanggal">Tanggal</label>
      <input class="field" id="f-tanggal" type="date" value="${esc(F.tanggal)}">
    </div>

    <div class="grup-form">
      <label class="label" for="f-catatan">Catatan (opsional)</label>
      <input class="field" id="f-catatan" maxlength="500" placeholder="mis. Belanja bulanan di Indomaret" value="${esc(F.catatan)}">
    </div>

    <div class="aksi-form">
      ${F.id ? '<button type="button" class="btn btn-hapus" data-aksi="hapus-trx">Hapus</button>' : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-trx">Simpan</button>
    </div>
    ${F.oleh ? `<p class="info-kecil">Dicatat oleh ${esc(namaPendek(F.oleh))}</p>` : ''}`;
}

/** Simpan isian field teks ke F sebelum form dirender ulang. */
function bacaFieldTrx() {
  if (!$('#f-jumlah')) return;
  F.jumlah = angka($('#f-jumlah').value);
  F.tanggal = $('#f-tanggal').value;
  F.catatan = $('#f-catatan').value;
}

// ---------- Foto struk ----------

/** Mengecilkan foto supaya cepat dikirim; hasilnya base64 JPEG tanpa awalan data URL. */
function kecilkanGambar(file, maks = 2000) {
  return new Promise((ok, gagal) => {
    const rusak = () => gagal(new Error('Gambar tidak bisa dibuka. Coba foto lain.'));
    const reader = new FileReader();
    reader.onerror = rusak;
    reader.onload = () => {
      const img = new Image();
      img.onerror = rusak;
      img.onload = () => {
        const skala = Math.min(1, maks / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * skala);
        c.height = Math.round(img.height * skala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function prosesStruk(file) {
  loading(true);
  try {
    const hasil = await api('bacaStruk', await kecilkanGambar(file), 'image/jpeg');
    if (!F || !$('#form-trx')) return; // form sudah ditutup
    bacaFieldTrx();
    F.tipe = TIPE.KELUAR;
    F.jumlah = hasil.jumlah;
    if (hasil.tanggal) F.tanggal = hasil.tanggal;
    if (hasil.kategori) F.kategori = hasil.kategori;
    if (hasil.catatan) F.catatan = hasil.catatan;
    F.struk = hasil;
    renderFormTrx();
    toast(hasil.yakin ? 'Struk terbaca ✔ Cek lagi sebelum disimpan.' : 'Struk terbaca, tapi hasilnya kurang pasti. Periksa totalnya.');
  } catch (e) {
    toast(pesanError(e), true);
  } finally {
    loading(false);
  }
}

/** Ringkasan hasil baca struk per lapis; kalau totalnya beda-beda, tampilkan pilihan. */
function infoStruk(h) {
  const pilihan = h.pilihanJumlah.length > 1 ? `
    <p class="label" style="margin:0 0 6px">⚠️ Hasil pembacaan berbeda. Ketuk total yang benar:</p>
    <div class="chips" style="margin-bottom:6px">${h.pilihanJumlah.map(p =>
      `<button type="button" class="chip ${p.jumlah === F.jumlah ? 'aktif' : ''}" data-aksi="f-pilih-jumlah" data-jumlah="${p.jumlah}">
        ${rp(p.jumlah)} <small>(${esc(p.sumber.join(', '))})</small></button>`).join('')}</div>` : '';
  const status = h.yakin
    ? `✅ Total cocok di ${h.pilihanJumlah[0].sumber.length} cara baca: ${esc(h.pilihanJumlah[0].sumber.join(', '))}`
    : `Dibaca dengan: ${esc(h.lapis.join(', '))}. Periksa lagi totalnya.`;
  return `<div style="margin:-8px 0 16px">${pilihan}<p class="info-kecil" style="text-align:left;margin-top:0">${status}</p></div>`;
}

function bukaFormGemini() {
  const daftar = S.data.kunciGemini;
  bukaSheet('Baca Struk dengan AI', `
    <p style="margin-bottom:12px">Untuk membaca foto struk, aplikasi memakai Gemini dari Google. Perlu kunci API (gratis).
      Boleh lebih dari satu: kunci dipakai bergiliran, dan kalau satu kena batas kuota otomatis pindah ke kunci lain.</p>
    <span class="label">Kunci tersimpan: ${daftar.length}</span>
    ${daftar.length ? `
      <div style="margin-bottom:16px">${daftar.map((k, i) => `
        <div class="baris">
          <span class="ikon-bulat">🔑</span>
          <span class="isi"><b>Kunci ${i + 1}</b><small>${esc(k)}</small></span>
          <button type="button" class="tombol-ikon" data-aksi="hapus-gemini" data-kunci="${esc(k)}" aria-label="Hapus kunci ${i + 1}">🗑️</button>
        </div>`).join('')}</div>` : `<p class="info-kecil" style="text-align:left;margin:0 0 16px">Belum ada kunci. Tambahkan di bawah.</p>`}
    <ol class="panduan" style="padding-left:20px;margin-bottom:16px">
      <li>Buka <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>.</li>
      <li>Klik <b>Create API key</b>, lalu salin kuncinya.</li>
      <li>Tempel di bawah, lalu ketuk Tambah.</li>
    </ol>
    <p class="info-kecil" style="text-align:left">Kunci disimpan di sheet <b>Pengaturan</b> pada spreadsheet keluarga, jadi bisa dipakai semua anggota.
      Tanpa kunci, struk tetap dibaca dengan OCR saja.</p>
    <div class="grup-form">
      <label class="label" for="g-kunci">Kunci API Gemini baru</label>
      <input class="field" id="g-kunci" type="password" autocomplete="off" placeholder="AIza…">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-gemini">Tambah</button></div>`);
}

// ---------- Form dompet ----------

/** Form dompet biasa maupun tabungan (jenis diambil dari w, atau dari parameter untuk yang baru). */
function bukaFormDompet(w, jenis) {
  jenis = w ? w.jenis : jenis || JENIS.DOMPET;
  const tab = jenis === JENIS.TABUNGAN;
  const sebutan = tab ? 'tabungan' : 'dompet';
  F = { namaLama: w ? w.nama : '', ikon: w ? w.ikon : (tab ? '🐷' : '👛'), jenis };
  bukaSheet((w ? 'Ubah ' : 'Tambah ') + (tab ? 'Tabungan' : 'Dompet'), `
    <div class="grup-form">
      <label class="label" for="d-nama">Nama ${sebutan}</label>
      <input class="field" id="d-nama" maxlength="40" placeholder="${tab ? 'mis. Dana Darurat, Liburan, Umroh' : 'mis. BCA, GoPay, Celengan'}" value="${esc(w ? w.nama : '')}">
    </div>
    <div class="grup-form">
      <label class="label" for="d-saldo">${tab ? 'Sudah terkumpul' : 'Saldo awal'}</label>
      <input class="field" id="d-saldo" inputmode="numeric" placeholder="0" value="${formatAngka(w && w.saldoAwal)}">
      <p class="info-kecil" style="text-align:left">${tab ? 'Jumlah yang sudah ada sebelum dicatat di aplikasi ini.' : 'Isi dengan saldo saat Anda mulai memakai aplikasi ini.'}</p>
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
    $('#input-struk').click();
  },
  'f-pilih-jumlah': el => { bacaFieldTrx(); F.jumlah = Number(el.dataset.jumlah); renderFormTrx(); },
  'gemini': () => bukaFormGemini(),
  'simpan-gemini': async el => {
    const kunci = $('#g-kunci').value.trim();
    if (!kunci) return toast('Tempel kunci API-nya dulu.', true);
    if (await kirim(el, 'tambahKunciGemini', [kunci], 'Kunci API ditambahkan ✔')) bukaFormGemini();
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
    kirim(el, 'simpanTransaksi', [F], pesan);
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
    kirim(el, 'simpanDompet', [{
      namaLama: F.namaLama, nama, ikon: F.ikon, jenis: F.jenis,
      saldoAwal: angka($('#d-saldo').value),
      target: tab ? angka($('#d-target').value) : 0,
      tenggat: tab ? $('#d-tenggat').value : '',
    }], (tab ? 'Tabungan' : 'Dompet') + ' tersimpan ✔');
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
    // Langsung buka pemilih foto; masih dalam ketukan pengguna supaya tidak diblokir browser.
    bukaFormTrx(null);
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
    S.bulan = S.tahun === new Date().getFullYear() ? bulanSekarang() : S.tahun + '-12';
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

  'buat-db': async el => {
    el.disabled = true;
    loading(true);
    try {
      await api('buatDatabase', $('#s-pasangan').value.trim());
      await muat();
      toast('Siap dipakai ✔');
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'hubungkan-db': async el => {
    const link = $('#s-link').value.trim();
    if (!link) return toast('Tempel link spreadsheet-nya dulu.', true);
    el.disabled = true;
    loading(true);
    try {
      await api('hubungkanDatabase', link);
      await muat();
      toast('Spreadsheet terhubung ✔');
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
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
      await GOOGLE.masuk();
      $('#view').innerHTML = '<div class="memuat-awal"><div class="spinner"></div><p>Memuat…</p></div>';
      await muat();
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'keluar': () => {
    if (!confirm('Keluar dari ' + GOOGLE.email() + '?')) return;
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
  if (file) prosesStruk(file);
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

mulai();
