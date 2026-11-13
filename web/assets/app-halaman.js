// Dompet Keluarga · Halaman utama: Beranda, Riwayat, Dompet (aset, zakat, utang, buku, patungan), Laporan, Setup, Lainnya, anggota, cadangan.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

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
        <span class="avatar-bungkus"><button type="button" class="avatar-tombol" data-aksi="ganti-avatar" aria-label="${T('Ganti avatar')}">${htmlAvatar(d.user)}</button>${typeof chipStreak === 'function' ? chipStreak() : ''}</span>
        <div style="min-width:0"><small>${T('Halo,')}</small><h1>${esc(nama)}</h1></div>
      </div>
      <div class="kepala-kanan">${pemilihBulan(true)}<button type="button" class="tombol-ikon tombol-cari" data-aksi="cari-global" aria-label="${T('Cari transaksi, catatan & fitur')}">${svg('cari')}</button><button type="button" class="tombol-ikon tombol-cari" data-aksi="tab" data-tab="lainnya" aria-label="${T('Pengaturan')}">${svg('gear')}</button></div>
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
        <div class="besar" data-gulir="saldo-beranda" data-nilai="${saldo}">${rpBesar(saldo)}</div>
        <button type="button" class="tombol-mata" data-aksi="samar" aria-label="${modeSamar() ? T('Tampilkan nominal') : T('Sembunyikan nominal')}" aria-pressed="${modeSamar()}">${modeSamar()
          ? '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/></svg>'
          : '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>'}</button>
      </div>
      <button type="button" class="ringkas" data-aksi="ringkas-periode" aria-label="${T('Rincian periode ini')}">
        <div><span class="panah-bulat masuk" aria-hidden="true">↓</span><span><small>${T('Pemasukan')}</small><b>${rp(masuk)}</b></span></div>
        <div><span class="panah-bulat keluar" aria-hidden="true">↑</span><span><small>${T('Pengeluaran')} ${lencanaBanding()}</small><b>${rp(keluar)}</b></span></div>
      </button>
      ${barisSisaAman() || `<div class="selisih">${T('Selisih {bulan}: <b>{jumlah}</b>', { bulan: esc(namaBulan(S.bulan)), jumlah: rp(masuk - keluar) })}</div>`}
    </section>

    ${typeof barisInsight === 'function' ? barisInsight() : ''}
    ${aksiCepat()}
    ${bagianSekaliKetuk()}

    ${kartuDinamis()}

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

/** Lencana kecil di samping "Pengeluaran": ▼12% (lebih hemat) / ▲8% dibanding periode lalu di hari yang sama. */
function lencanaBanding() {
  const p = S.data.pembanding;
  if (!p || !p.lalu || S.bulan !== S.data.bulan) return '';
  const persen = Math.round((p.ini - p.lalu) / p.lalu * 100);
  if (Math.abs(persen) < 3) return '';
  return `<span class="lencana-banding ${persen < 0 ? 'hemat' : 'boros'}">${persen < 0 ? '▼' : '▲'}${Math.abs(persen)}%</span>`;
}

/** Ketuk Pemasukan/Pengeluaran di kartu saldo: selisih + perbandingan dengan periode lalu. */
function bukaRingkasPeriode() {
  const trx = S.data.transaksi;
  const masuk = total(trx, TIPE.MASUK), keluar = total(trx, TIPE.KELUAR);
  const baris = (label, nilai, tebal) => `<div class="baris-rincian"><span>${label}</span>${tebal ? `<b>${nilai}</b>` : `<span>${nilai}</span>`}</div>`;
  bukaSheet(namaBulan(S.bulan), `
    ${baris(T('Pemasukan'), rp(masuk))}
    ${baris(T('− Pengeluaran'), rp(keluar))}
    ${baris(T('= Selisih'), rp(masuk - keluar), true)}
    ${barisPembanding()}
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="tab" data-tab="riwayat">${T('Riwayat')}</button>
      <button type="button" class="btn btn-utama" data-aksi="tab" data-tab="laporan">${T('Lihat laporan')}</button>
    </div>`);
}

/**
 * Pintasan di bawah kartu saldo, bisa diatur per HP (⚙️ di ujung baris). Catat & Dompet tidak perlu di sini:
 * sudah ada tombol ＋ dan tab Dompet di bawah layar. [ikon, label, aksi, atribut tambahan, tersedia?]
 */
const PINTASAN = {
  struk: ['kamera', T('Foto struk'), 'cepat-struk'],
  suara: ['mic', T('Suara'), 'cepat-suara', '', () => !!PengenalSuara],
  transfer: ['transfer', T('Transfer'), 'cepat-transfer'],
  catatan: ['kalender', T('Catatan'), 'kalender'],
  sholat: ['masjid', T('Sholat'), 'sholat'],
  anggaran: ['target', T('Anggaran'), 'atur-anggaran'],
  tabungan: ['celengan', T('Tabungan'), 'tambah-tabungan'],
  utang: ['tangan', T('Utang'), 'tambah-utang'],
  rutin: ['tagihan', T('Tagihan'), 'kelola-rutin'],
  catat: ['plus', T('Catat'), 'tambah-trx'],
};
const PINTASAN_AWAL = ['struk', 'suara', 'transfer', 'catatan', 'sholat'];
const MAKS_PINTASAN = 5;
const pintasanAda = k => PINTASAN[k] && (!PINTASAN[k][4] || PINTASAN[k][4]());
function pintasanDipilih() {
  let p = null;
  try { p = JSON.parse(bacaHp('dk_pintasan')); } catch (e) { /* abaikan */ }
  return (Array.isArray(p) ? p : PINTASAN_AWAL).filter(pintasanAda).slice(0, MAKS_PINTASAN);
}
/** 5 pintasan pilihan tampil lebih dulu; pintasan lain tetap ada sesudahnya, terlihat dengan geser ke samping (tanpa scrollbar). */
function aksiCepat() {
  const dipilih = pintasanDipilih();
  const urut = dipilih.concat(Object.keys(PINTASAN).filter(k => pintasanAda(k) && !dipilih.includes(k)));
  return `<div class="aksi-cepat">
    <div class="aksi-cepat-geser">${urut.map(k => { const [ikon, label, aksi] = PINTASAN[k];
      return `<button data-aksi="${aksi}"><span class="kotak">${svg(ikon)}</span>${label}</button>`; }).join('')}</div>
    <button data-aksi="atur-pintasan" class="atur-pintasan" aria-label="${T('Atur pintasan')}"><span class="kotak">${svg('pensil')}</span>${T('Atur||pintasan')}</button>
  </div>`;
}
function isiAturPintasan() {
  const dipilih = pintasanDipilih();
  return `
    <p style="margin-top:0">${T('Pilih sampai {n} pintasan yang tampil di Beranda. Urutannya mengikuti urutan Anda memilih. Pintasan lain tetap ada, geser ke samping untuk melihatnya.', { n: MAKS_PINTASAN })}</p>
    <div class="grid-pilih">${Object.keys(PINTASAN).filter(pintasanAda).map(k => {
      const i = dipilih.indexOf(k);
      return `<button type="button" class="pilihan ${i >= 0 ? 'aktif' : ''}" data-aksi="pilih-pintasan" data-k="${k}" aria-pressed="${i >= 0}">
        <span class="ikon-pintasan">${svg(PINTASAN[k][0])}${i >= 0 ? `<i class="urutan">${i + 1}</i>` : ''}</span>${PINTASAN[k][1]}</button>`; }).join('')}</div>
    <div class="aksi-form">
      <button type="button" class="btn btn-hapus" data-aksi="pintasan-awal">${T('Kembalikan semula')}</button>
      <button type="button" class="btn btn-utama" data-aksi="tutup-sheet">${T('Selesai')}</button>
    </div>`;
}
function bukaAturPintasan() {
  bukaSheet(T('Atur Pintasan'), `<div id="atur-pintasan">${isiAturPintasan()}</div>`);
}
/** Lembar Urutan menu: daftar menu per halaman menu bawah, tiap baris dengan tombol naik/turun. */
function isiAturMenu() {
  const peta = {};
  tombolMenu().forEach(b => { peta[kunciMenu(b)] = b; });
  const urut = urutanMenu();
  const panah = (i, arah, mati, label) => `<button type="button" class="tombol-ikon" data-aksi="geser-menu" data-i="${i}" data-arah="${arah}" ${mati ? 'disabled' : ''} aria-label="${label}">
    <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="${arah < 0 ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}"/></svg></button>`;
  let html = `<p style="margin-top:0">${T('Atur urutan menu di bagian bawah layar. Tiap halaman berisi 4 menu (2 di kiri dan 2 di kanan tombol ＋); geser menu ke kiri/kanan untuk pindah halaman.')}</p>`;
  for (let h = 0; h * 4 < urut.length; h++) {
    html += `<h4 class="sub-laporan">${T('Halaman {n}', { n: h + 1 })}</h4>` + urut.slice(h * 4, h * 4 + 4).map((k, j) => {
      const i = h * 4 + j, b = peta[k];
      return `<div class="baris baris-menu">
        <span class="ikon-bulat">${b.querySelector('svg').outerHTML}</span>
        <span class="isi"><b>${esc(b.textContent.trim())}</b></span>
        ${panah(i, -1, i === 0, T('Naikkan'))}${panah(i, 1, i === urut.length - 1, T('Turunkan'))}
      </div>`;
    }).join('');
  }
  return html + `<div class="aksi-form"><button type="button" class="btn btn-kedua" data-aksi="reset-menu">${T('Kembalikan urutan awal')}</button></div>`;
}
function bukaAturMenu() {
  bukaSheet(T('Urutan menu'), `<div id="atur-menu">${isiAturMenu()}</div>`);
}
function simpanUrutanMenu(daftar) {
  tulisHp('dk_menu', daftar ? JSON.stringify(daftar) : null);
  terapkanUrutanMenu();
  if ($('#atur-menu')) $('#atur-menu').innerHTML = isiAturMenu();
  if (S.tab === 'lainnya') render();
}
function simpanPintasan(daftar) {
  tulisHp('dk_pintasan', daftar ? JSON.stringify(daftar) : null);
  if ($('#atur-pintasan')) $('#atur-pintasan').innerHTML = isiAturPintasan();
  if (S.tab === 'beranda') render();
}

/**
 * Kartu yang muncul menurut keadaan (tagihan jatuh tempo, panduan awal, saran rutin, aktivitas keluarga).
 * Paling banyak dua sekaligus, menurut urutan pentingnya, supaya Beranda tidak menumpuk.
 */
const MAKS_KARTU_DINAMIS = 2;
function kartuDinamis() {
  return [kartuTagihan, kartuMulai, kartuSaranRutin, kartuAktivitasBaru, window.kartuGaya, window.kartuTantangan]
    .filter(f => typeof f === 'function') // kartuGaya & kartuTantangan ada di muda.js
    .map(f => f()).filter(h => h && h.trim()).slice(0, MAKS_KARTU_DINAMIS).join('');
}

// ---------- Halaman: Riwayat ----------

// Filter Riwayat. rentang 'periode' = data periode yang sedang dilihat (sudah dimuat);
// selain itu transaksi dibaca dari spreadsheet saat dibutuhkan (S.cariData).
const FILTER_KOSONG = { rentang: 'periode', dari: '', sampai: '', kategori: '', dompet: '', oleh: '', lampiran: false };
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
    (!f.lampiran || t.lampiran) &&
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
  S.trxTampil = trx.slice(0, S.batasRiwayat);
  const menyaring = q || f.rentang !== 'periode' || f.kategori || f.dompet || f.oleh || f.lampiran || S.filterTipe !== 'Semua';
  const kalender = S.modeRiwayat === 'kalender' && f.rentang === 'periode' && !S.pilih;
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
    <div class="kepala"><h1>${T('Riwayat')}</h1><div class="kepala-kanan">${f.rentang === 'periode' ? `<button type="button" class="tombol-ikon ${kalender ? 'aktif' : ''}" data-aksi="mode-riwayat" aria-pressed="${kalender}" aria-label="${kalender ? T('Tampilkan sebagai daftar') : T('Tampilkan sebagai kalender')}">${svg('kalender')}</button>` : ''}${f.rentang === 'periode' ? pemilihBulan()
      : `<button class="chip aktif" data-aksi="hapus-filter" data-k="rentang" aria-label="${T('Kembali ke periode ini')}">📅 ${esc(labelRentang())} ✕</button>`}</div></div>
    <input class="cari" id="cari" type="search" placeholder="${T('Cari catatan, kategori, nominal…')}" value="${esc(S.cari)}">
    <div class="chips">
      <button class="chip ${jumlahFilter ? 'aktif' : ''}" data-aksi="buka-filter">⚙︎ ${T('Filter')}${jumlahFilter ? ' (' + jumlahFilter + ')' : ''}</button>
      ${['Semua', TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].map(t =>
        `<button class="chip ${S.filterTipe === t ? 'aktif' : ''}" data-aksi="filter-tipe" data-tipe="${t}">${t === 'Semua' ? T('Semua') : namaT(t)}</button>`).join('')}
      <button class="chip ${f.lampiran ? 'aktif' : ''}" data-aksi="filter-lampiran" aria-pressed="${!!f.lampiran}">📎 ${T('Ada lampiran')}</button>
    </div>
    ${chipFilter.length ? `<div class="chips">${chipFilter.map(([k, l]) =>
      `<button class="chip aktif" data-aksi="hapus-filter" data-k="${k}">${esc(l)} ✕</button>`).join('')}</div>` : ''}
    <div id="hasil-riwayat">${sumber === null
      ? KERANGKA_DAFTAR
      : kalender ? htmlKalenderRiwayat(trx)
      : ringkas + (isi || kosong('🔍', T('Tidak ada transaksi yang cocok.'))) + lagi}</div>
    ${barPilih()}`;
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
    ${pilih('fl-dompet', T('Dompet'), T('Semua dompet'), S.data.dompet.map(w => [w.nama, emojiIkon(w.ikon) + ' ' + namaT(w.nama)]), f.dompet)}
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
      <div class="besar" style="margin-bottom:0" data-gulir="saldo-dompet" data-nilai="${saldo}">${rpBesar(saldo)}</div>
      ${tabungan.length ? `<div class="selisih">${T('🐷 Total tabungan: <b>{jumlah}</b>', { jumlah: rp(totalTabungan) })}</div>` : ''}
    </section>

    <h2 class="judul-bagian">${T('Dompet||jamak')}</h2>
    ${typeof deretKartuDompet === 'function' ? deretKartuDompet(dompet) : `<section class="kartu" style="padding:4px 16px">
      ${dompet.map(w => `
        <button class="baris" data-aksi="edit-dompet" data-nama="${esc(w.nama)}">
          <span class="ikon-bulat">${ilus(w.ikon)}</span>
          <span class="isi"><b>${esc(namaT(w.nama))}</b></span>
          <b class="nominal ${w.saldo < 0 ? 'minus' : ''}">${rp(w.saldo)}</b>
        </button>`).join('') || kosong('👛', T('Belum ada dompet.'))}
    </section>`}
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
    aset: daftarAset().reduce((a, w) => a + nilaiAset(w), 0),
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
      <p class="info-kecil" style="text-align:left">${T('Semua yang dimiliki dikurangi utang. Nilai emas mengikuti harga hari ini; aset lain diperbarui manual.')}</p>
    </section>
    ${daftarAset().length ? `<section class="kartu" style="padding:4px 16px">${daftarAset().map(w => {
      const e = infoEmas(w);
      return `
      <button class="baris" data-aksi="${e ? 'lihat-emas' : 'edit-dompet'}" data-nama="${esc(w.nama)}">
        <span class="ikon-bulat">${ilus(w.ikon)}</span>
        <span class="isi"><b>${esc(w.nama)}</b><small>${e ? esc(formatGram(e.gram) + ' · ' + namaPlatformEmas(e.platform)) : T('Ketuk untuk memperbarui nilai')}</small></span>
        <b class="nominal">${rp(nilaiAset(w))}</b>
      </button>`; }).join('')}</section>` : ''}${perbaruiHargaEmasNanti()}
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
/** Sumber harga emas zakat: id platform (harga beli otomatis, sama dengan aset emas) atau 'manual' (diisi sendiri). */
const sumberHargaZakat = () => bacaHp('dk_zakat_sumber') || (bacaHp('dk_harga_emas') ? 'manual' : 'antam');
function bukaZakat(sudahDimuat) {
  const sumber = sumberHargaZakat();
  const otomatis = sumber !== 'manual' && !!platformEmas(sumber)[2];
  const hEmas = otomatis ? cacheHargaEmas()[sumber] : null;
  const hargaEmas = otomatis ? (hEmas && hEmas.beli) || 0 : Number(bacaHp('dk_harga_emas')) || 0;
  const memuat = otomatis && !sudahDimuat && navigator.onLine && kapanDiambil(hEmas) !== hariIni();
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
      <div class="baris-rincian"><span>${jenis === 'maal' ? T('Nisab ({gram} g emas)', { gram: NISAB_EMAS_GRAM }) : T('Nisab per bulan')}
        <button type="button" class="info-nisab" data-aksi="info-nisab" data-id="nisab-${jenis}" aria-expanded="false" aria-controls="nisab-${jenis}" aria-label="${T('Dasar perhitungan nisab')}">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5v.01"/></svg></button></span>
        <span>${hargaEmas ? rp(Math.round(batas)) : '—'}</span></div>
      <div class="ket-nisab" id="nisab-${jenis}" hidden>${jenis === 'maal' ? `
        <p>${T('Nisab zakat maal adalah {gram} gram emas. Dasarnya hadis: "Tidak ada kewajiban zakat atasmu (pada emas) hingga engkau memiliki 20 dinar" (HR. Abu Dawud). 1 dinar = 4,25 gram emas, jadi 20 dinar = 85 gram. Ukuran ini juga dipakai BAZNAS.', { gram: NISAB_EMAS_GRAM })}</p>
        <p class="rumus">${hargaEmas ? T('{gram} gram × {harga} = {nisab}', { gram: NISAB_EMAS_GRAM, harga: rp(hargaEmas), nisab: rp(Math.round(batas)) }) : T('Isi harga emas dulu untuk melihat hitungannya.')}</p>
        <p>${T('Zakat 2,5% wajib bila harta bersih (dompet, tabungan, aset, dan piutang dikurangi utang) mencapai nisab dan sudah dimiliki selama 1 tahun hijriah (haul).')}</p>` : `
        <p>${T('Nisab zakat penghasilan disamakan dengan nisab emas, {gram} gram per tahun, mengikuti Fatwa MUI No. 3 Tahun 2003 dan ketentuan BAZNAS. Karena penghasilan diterima tiap bulan, nisabnya dibagi 12.', { gram: NISAB_EMAS_GRAM })}</p>
        <p class="rumus">${hargaEmas ? T('{gram} gram × {harga} ÷ 12 = {nisab}', { gram: NISAB_EMAS_GRAM, harga: rp(hargaEmas), nisab: rp(Math.round(batas)) }) : T('Isi harga emas dulu untuk melihat hitungannya.')}</p>
        <p>${T('Zakat 2,5% dari pemasukan bulan ini wajib bila pemasukan mencapai nisab per bulan.')}</p>`}
        <p class="sumber-harga">${hargaEmas ? T('Sumber: {sumber}, harga beli per gram.', { sumber: esc(otomatis ? keteranganHargaEmas(hEmas, sumber) : T('Harga diisi sendiri')) }) : ''}</p>
      </div>
      <div class="baris-rincian"><span><b>${T('Zakat 2,5%')}</b></span><b>${!hargaEmas ? T('Isi harga emas') : zakat ? rp(zakat) : T('Belum wajib')}</b></div>
      ${zakat ? `<button type="button" class="tombol-tambah" style="margin-top:10px" data-aksi="catat-zakat" data-jumlah="${zakat}" data-jenis="${jenis}">${T('Catat pembayaran {jumlah}', { jumlah: rp(zakat) })}</button>` : ''}
    </section>`;
  bukaSheet(T('Kalkulator Zakat'), `
    <div class="grup-form">
      <label class="label" for="z-sumber">${T('Harga emas per gram')}</label>
      <select class="field" id="z-sumber">${PLATFORM_EMAS.filter(p => p[2]).map(p =>
        `<option value="${p[0]}" ${sumber === p[0] ? 'selected' : ''}>${T('Otomatis · {platform}', { platform: esc(p[1]) })}</option>`).join('')}
        <option value="manual" ${otomatis ? '' : 'selected'}>${T('Isi sendiri')}</option></select>
    </div>
    ${otomatis ? `
      <div class="kotak-harga-emas">
        <div class="baris-rincian"><span>${T('Harga beli /gram')}</span><b>${hargaEmas ? rp(hargaEmas) : memuat ? T('Mengambil…') : '—'}</b></div>
        <small>${hargaEmas ? esc(keteranganHargaEmas(hEmas, sumber)) : memuat ? T('Mengambil harga hari ini…') : T('Harga {platform} belum bisa diambil. Coba lagi nanti.', { platform: namaPlatformEmas(sumber) })}</small>
      </div>
      <div class="aksi-form" style="margin-top:0"><button type="button" class="btn btn-kedua" style="flex:1" data-aksi="perbarui-harga-zakat" ${memuat ? 'disabled' : ''}>${T('🔄 Perbarui harga')}</button></div>` : `
      <div class="grup-form">
        <input class="field input-rp" id="z-emas" inputmode="numeric" aria-label="${T('Harga emas per gram (Rp)')}" placeholder="${T('mis. 1.500.000')}" value="${formatAngka(hargaEmas)}">
        <p class="info-kecil" style="text-align:left">${T('Lihat harga emas hari ini (mis. di situs Antam), lalu ketuk Hitung. Disimpan di HP ini.')}</p>
      </div>
      <div class="aksi-form" style="margin-top:0"><button type="button" class="btn btn-hapus" style="flex:1" data-aksi="hitung-zakat">${T('Hitung')}</button></div>`}
    ${hasil(T('💰 Zakat maal (harta)'), harta, nisab, maal, 'maal')}
    ${hasil(T('💼 Zakat penghasilan'), masuk, nisab / 12, penghasilan, 'penghasilan')}
    <p class="info-kecil" style="text-align:left">${T('Ini perkiraan. Zakat maal juga mensyaratkan harta sudah dimiliki selama 1 tahun (haul). Untuk kepastian, tanyakan ke lembaga amil zakat atau ustadz.')}</p>`);
  // Harga hari ini diambil sekali saat lembar dibuka (sudahDimuat mencegah lembar membuka ulang dirinya terus-menerus).
  if (memuat) muatHargaEmas([sumber]).finally(() => { if ($('#z-sumber') && sumberHargaZakat() === sumber) bukaZakat(true); });
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
    <p class="info-kecil" style="text-align:left;margin:0 0 8px">${T('{n} buku sudah masuk ke daftar Anda. Pilih yang mau dibuka sekarang; yang lain bisa dibuka kapan saja dari ⚙️ Pengaturan → Buku keuangan.', { n: buku.length })}</p>
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
        `<option value="${esc(w.nama)}" ${w.nama === F.dompet ? 'selected' : ''}>${esc(emojiIkon(w.ikon) + ' ' + namaT(w.nama))}</option>`).join('')}</select>
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

/** Kunci periode digeser n bulan: geserPeriode('2026-01', -1) → '2025-12'. */
function geserPeriode(k, n) {
  const d = keTanggal(k);
  d.setMonth(d.getMonth() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function bulanSebelum(k) { return geserPeriode(k, -1); }
function tahunLaluDari(k) { return geserPeriode(k, -12); }
function adaIsi(x) { return !!(x.masuk || x.keluar); }

/**
 * Pembanding pengeluaran yang adil. Untuk periode berjalan: kedua periode dihitung sampai hari ke-N yang sama
 * (dari S.data.setara); periode yang sudah selesai: dibanding penuh. mode: 'lalu' (periode sebelumnya) | 'tahun'.
 * → { kini: { keluar, kategori }, lalu: { keluar, kategori }, bulanLalu, sebagian, hariKe }
 */
function bandingPeriode(pilih, mode) {
  const st = S.data.setara;
  if (st && st.bulan === pilih) {
    const b = mode === 'tahun' ? st.tahunLalu : st.lalu;
    return { kini: st.ini, lalu: b, bulanLalu: b.bulan, sebagian: true, hariKe: st.hariKe };
  }
  const bulanLalu = mode === 'tahun' ? tahunLaluDari(pilih) : bulanSebelum(pilih);
  return { kini: ringkasBulan(pilih), lalu: ringkasBulan(bulanLalu), bulanLalu, sebagian: false };
}

function viewLaporan() {
  const th = S.tahun;
  const bulan = Array.from({ length: 12 }, (_, i) => th + '-' + String(i + 1).padStart(2, '0'));
  const data = bulan.map(ringkasBulan);
  const jumlah = f => data.reduce((a, x) => a + x[f], 0);
  const masuk = jumlah('masuk');
  const keluar = jumlah('keluar');
  const ditabung = jumlah('ditabung');
  const rasio = masuk ? Math.round((masuk - keluar) / masuk * 100) : null;
  const pilih = S.bulan.slice(0, 4) === String(th) ? S.bulan : bulan[11];
  const r = ringkasBulan(pilih);
  const rata = rataPengeluaran(bulan, data);
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
    <p class="judul-cetak">${T('Laporan keuangan {tahun}', { tahun: th })}${S.data.namaBuku ? ' · ' + esc(namaT(S.data.namaBuku)) : ''} · ${T('dicetak {tanggal}', { tanggal: esc(tanggalPendek(hariIni())) })}</p>

    <div class="kpi">
      ${tile(T('Pemasukan {tahun}', { tahun: th }), rp(masuk))}
      ${tile(T('Pengeluaran {tahun}', { tahun: th }), rp(keluar))}
      ${tile(T('Selisih'), rp(masuk - keluar), rasio !== null ? T('{persen}% dari pemasukan', { persen: rasio }) : '')}
      ${tile(T('Rata-rata pengeluaran'), rp(rata.nilai), rata.ket)}
      ${ditabung ? tile(T('Masuk tabungan'), rp(ditabung), T('setoran − penarikan')) : ''}
    </div>

    <section class="kartu">
      <h3>${T('Pemasukan & pengeluaran per bulan')}</h3>
      ${geserGrafik(bulan, data, pilih)}
      <p class="detail-bulan"><b>${esc(namaBulan(pilih))}</b> · ${T('Pemasukan {jumlah}', { jumlah: rp(r.masuk) })} · ${T('Pengeluaran {jumlah}', { jumlah: rp(r.keluar) })}
        <br><small>${T('Ketuk bulan di grafik untuk melihat rinciannya.')}</small></p>
      <button type="button" class="tombol-tambah" style="margin:0 0 12px" data-aksi="bagikan-laporan" data-bulan="${esc(pilih)}">${T('📤 Bagikan ringkasan {bulan}', { bulan: esc(namaBulan(pilih)) })}</button>
      <button type="button" class="tombol-tambah" style="margin:0 0 12px" data-aksi="bagikan-story" data-bulan="${esc(pilih)}">${T('📱 Bagikan ke Story (bisa tanpa nominal)')}</button>
      <button type="button" class="tombol-tambah" style="margin:0 0 12px" data-aksi="riwayat-harga">${T('🏷️ Riwayat harga barang dari struk')}</button>
      <details class="tabel-data">
        <summary>${T('Lihat sebagai tabel')}</summary>
        <table>
          <thead><tr><th>${T('Bulan')}</th><th>${T('Pemasukan')}</th><th>${T('Pengeluaran')}</th><th>${T('Selisih')}</th></tr></thead>
          <tbody>${data.map((x, i) => `<tr><td>${NAMA_BULAN_PENDEK[i]}</td><td>${rp(x.masuk)}</td><td>${rp(x.keluar)}</td><td>${rp(x.masuk - x.keluar)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    </section>

    ${kartuKekayaan(bulan)}

    ${pemilihPeriodeLaporan(pilih)}
    ${kartuSorotan(pilih)}
    ${kartuKategoriLaporan(pilih, data)}
    ${kartuAnggaranLaporan(bulan, data, pilih)}
    ${trxLaporan(pilih) ? kartuPolaBelanja(pilih) + kartuTerbesar(pilih) : kartuRincianMenunggu(pilih)}
    ${kartuBanding(pilih)}
    ${kartuAnggota(pilih)}
    ${kartuLabelLaporan(pilih)}

    <div class="aksi-laporan">
      <button type="button" class="tombol-tambah" data-aksi="bagikan-tahunan">${T('📤 Bagikan kilas balik {tahun}', { tahun: th })}</button>
      <button type="button" class="tombol-tambah" data-aksi="cetak-laporan">${T('🖨️ Cetak / simpan PDF')}</button>
    </div>`;
}

/**
 * Rata-rata pengeluaran per bulan dari periode yang sudah selesai saja: periode berjalan belum penuh dan akan
 * menurunkan rata-ratanya. Kalau belum ada periode yang selesai di tahun ini, pakai periode berjalan apa adanya.
 */
function rataPengeluaran(bulan, data) {
  const kini = periodeSekarang();
  const selesai = data.filter((x, i) => bulan[i] < kini && adaIsi(x));
  if (selesai.length) {
    return { nilai: Math.round(selesai.reduce((a, x) => a + x.keluar, 0) / selesai.length), ket: T('per bulan · {n} periode selesai', { n: selesai.length }) };
  }
  const berjalan = data.filter((x, i) => bulan[i] === kini && adaIsi(x));
  return { nilai: berjalan.length ? berjalan[0].keluar : 0, ket: berjalan.length ? T('periode berjalan, belum penuh') : T('per bulan') };
}

/** Pemilih periode untuk kartu-kartu rincian di bawahnya (selain mengetuk grafik). */
function pemilihPeriodeLaporan(pilih) {
  const bisaMaju = pilih < periodeSekarang();
  return `<div class="pemilih-periode-lap">
    <button type="button" data-aksi="lap-geser" data-geser="-1" aria-label="${T('Periode sebelumnya')}">${svg('kembali')}</button>
    <span><small>${T('Rincian periode')}</small><b>${esc(namaBulan(pilih))}</b></span>
    <button type="button" data-aksi="lap-geser" data-geser="1" aria-label="${T('Periode berikutnya')}" ${bisaMaju ? '' : 'disabled'}>${svg('maju')}</button>
  </div>`;
}

/** Pengganti kartu pola belanja & transaksi terbesar selama transaksi periode terpilih belum dimuat. */
function kartuRincianMenunggu(pilih) {
  if (S.offline || S.sesiHabis || !navigator.onLine) {
    return `<section class="kartu"><p class="info-kecil" style="margin:0">${T('Pola belanja harian & transaksi terbesar {bulan} butuh sinyal untuk dimuat.', { bulan: esc(namaBulan(pilih)) })}</p>
      <button type="button" class="tombol-tambah" style="margin-top:10px" data-aksi="lap-bulan" data-bulan="${esc(pilih)}">${T('Coba lagi')}</button></section>`;
  }
  return `<section class="kartu" aria-busy="true"><h3>${T('Memuat rincian {bulan}…', { bulan: esc(namaBulan(pilih)) })}</h3>${KERANGKA_DAFTAR}</section>`;
}

/**
 * Kekayaan bersih di akhir tiap periode, dihitung mundur dari kekayaan bersih sekarang: transfer antar dompet,
 * tabungan, aset, dan utang tidak mengubah totalnya, jadi akhir periode k = sekarang − Σ (masuk − keluar) setelah k.
 */
function deretKekayaan(bulan) {
  const kini = periodeSekarang();
  const semua = Object.keys(S.data.bulanan || {}).sort();
  if (!semua.length) return [];
  const pertama = semua[0];
  const sekarang = hitungKekayaan().bersih;
  return bulan.map(k => {
    if (k > kini || k < pertama) return null;
    const sesudah = semua.filter(p => p > k).reduce((a, p) => a + ringkasBulan(p).masuk - ringkasBulan(p).keluar, 0);
    return sekarang - sesudah;
  });
}

function kartuKekayaan(bulan) {
  const deret = deretKekayaan(bulan);
  const ada = deret.map((v, i) => ({ v, i })).filter(x => x.v !== null);
  if (ada.length < 2) return '';
  const W = 340, H = 150, kiri = 40, bawah = 22, atas = 10;
  const tinggi = H - bawah - atas;
  const nilai = ada.map(x => x.v);
  let lo = Math.min(0, ...nilai), hi = Math.max(...nilai);
  if (hi === lo) hi = lo + 1;
  const skala = angkaBulat(Math.max(Math.abs(hi), Math.abs(lo)));
  const atasSkala = hi > 0 ? skala : 0, bawahSkala = lo < 0 ? -skala : 0;
  const y = v => atas + (atasSkala - v) / ((atasSkala - bawahSkala) || 1) * tinggi;
  const lebarGrup = (W - kiri) / 12;
  const cx = i => kiri + i * lebarGrup + lebarGrup / 2;
  const titik = ada.map(x => [cx(x.i), y(x.v)]);
  const jalur = jalurHalus(titik);
  const awal = ada[0], akhir = ada[ada.length - 1];
  const naik = akhir.v - awal.v;
  const grid = [atasSkala, bawahSkala].filter(v => v).map(v => `
    <line class="grid" x1="${kiri}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="sumbu" x="${kiri - 6}" y="${y(v) + 3}" text-anchor="end">${v < 0 ? '−' : ''}${rpPendek(Math.abs(v))}</text>`).join('');
  const label = bulan.map((k, i) => `<text class="sumbu" x="${cx(i)}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>`).join('');
  const ketuk = ada.map(x => `<rect class="hit" x="${kiri + x.i * lebarGrup}" y="0" width="${lebarGrup}" height="${H}">
    <title>${T('Akhir {bulan}: {jumlah}', { bulan: namaBulan(bulan[x.i]), jumlah: rp(x.v) })}</title></rect>`).join('');
  return `<section class="kartu">
    <h3>${T('Kekayaan bersih')}</h3>
    <div class="banding" style="border:0;padding-top:0">
      <span class="isi"><b>${rp(akhir.v)}</b><small>${T('akhir {bulan}', { bulan: esc(namaBulan(bulan[akhir.i])) })}</small></span>
      ${naik ? `<span class="${naik > 0 ? 'turun' : 'naik'}">${naik > 0 ? '▲' : '▼'} ${rp(Math.abs(naik))}<small>${T('sejak {bulan}', { bulan: esc(NAMA_BULAN_PENDEK[awal.i]) })}</small></span>` : ''}
    </div>
    <div class="slide-grafik diam" style="padding:0">
      <svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('Tren kekayaan bersih per bulan')}">
        ${grid}${label}<line class="dasar" x1="${kiri}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
        <path class="area seri-1" d="${jalur} L${titik[titik.length - 1][0]},${y(0)} L${titik[0][0]},${y(0)} Z"/>
        <path class="garis seri-1" d="${jalur}" pathLength="1"/>
        ${titik.map(([x, yy]) => `<circle class="titik seri-1" cx="${x}" cy="${yy}" r="2.8"/>`).join('')}${ketuk}
      </svg>
    </div>
    <p class="info-kecil" style="text-align:left;margin-top:6px">${T('Dompet + tabungan + aset + piutang − utang. Dihitung mundur dari saldo sekarang, jadi perubahan nilai aset atau saldo yang disesuaikan tidak tercatat per bulan.')}</p>
  </section>`;
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

  latarMeriah(g, W, H, nilaiRapor(r).kelas); // warna mengikuti nilai rapor periode ini

  kopMerek(g, P, 130, 34, 'rgba(255,255,255,.92)');
  teks(T('Ringkasan keuangan'), P, 220, 44, '#ffffff', 600);
  teks(namaBulan(k), P, 290, 60, '#ffffff', 800);

  const kotak = (x, y, w, label, nilai, warna) => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.roundRect(x, y, w, 170, 28); g.fill();
    teks(label, x + 32, y + 62, 30, 'rgba(255,255,255,.7)', 600);
    teks(nilai, x + 32, y + 128, 46, warna, 800);
  };
  const lebar = (W - P * 2 - 24) / 2;
  kotak(P, 350, lebar, T('Pemasukan'), rp(r.masuk), '#3ccb8b');
  kotak(P + lebar + 24, 350, lebar, T('Pengeluaran'), rp(r.keluar), '#ff8a7a');
  kotak(P, 544, W - P * 2, T('Selisih') + (r.masuk ? ' · ' + T('{persen}% dari pemasukan', { persen: Math.round((r.masuk - r.keluar) / r.masuk * 100) }) : ''), rp(r.masuk - r.keluar), '#ffffff');

  teks(T('Pengeluaran terbesar'), P, 800, 36, '#ffffff', 700);
  const maks = Math.max(1, ...top.map(x => x.v));
  top.forEach((x, i) => {
    const y = 856 + i * 78;
    teks(ikonKategori(x.n, TIPE.KELUAR) + '  ' + namaT(x.n), P, y + 30, 32, '#ffffff', 600);
    teks(rp(x.v) + (r.keluar ? `  ${Math.round(x.v / r.keluar * 100)}%` : ''), W - P, y + 30, 32, 'rgba(255,255,255,.85)', 700, 'right');
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(P, y + 46, W - P * 2, 12, 6); g.fill();
    g.fillStyle = '#5fd0c8'; g.beginPath(); g.roundRect(P, y + 46, Math.max(12, (W - P * 2) * x.v / maks), 12, 6); g.fill();
  });
  if (!top.length) teks(T('Belum ada pengeluaran.'), P, 900, 32, 'rgba(255,255,255,.7)', 600);
  kakiMerek(g, W, H - 44, 28, 'rgba(255,255,255,.6)');

  const keterangan = T('Ringkasan keuangan {bulan}: pemasukan {masuk}, pengeluaran {keluar}, selisih {selisih}.', { bulan: namaBulan(k), masuk: rp(r.masuk), keluar: rp(r.keluar), selisih: rp(r.masuk - r.keluar) });
  await bagikanKanvas(c, 'ringkasan-' + k + '.png', T('Ringkasan {bulan}', { bulan: namaBulan(k) }), keterangan);
}

// ---------- Merek di gambar bagikan (ringkasan, kilas balik, Story) ----------
// Logo + nama di atas, ajakan + alamat aplikasi di bawah, supaya yang melihat tahu harus membuka apa.
// Alamat diarahkan ke halaman pengenalan (tombol "Coba tanpa akun"); ganti di sini kalau nanti ada link pendek.
const TAUTAN_PROMO = 'bit.ly/dompet-keluarga'; // → tentang.html (dibuat di bitly.com)
const FONT_MEREK = (ukuran, tebal) => `${tebal} ${ukuran}px "Plus Jakarta Sans", system-ui, sans-serif`;
/** Logo dompet-rumah + dua lembar uang (= ikon/logo.svg) di (x, y) dengan sisi s piksel. */
function gambarLogo(g, x, y, s) {
  const atap = new Path2D('M256 108 418 222V384a32 32 0 0 1-32 32H126a32 32 0 0 1-32-32V222Z');
  const kotak = (bx, by, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(bx, by, w, h, r); else g.rect(bx, by, w, h); };
  const bulat = (bx, by, w, h, r) => { kotak(bx, by, w, h, r); g.fill(); };
  /** Lembar uang 210×124 berpusat di (cx, cy), diputar r derajat. */
  const uang = (cx, cy, r, isi, aksen) => {
    g.save(); g.translate(cx, cy); g.rotate(r * Math.PI / 180);
    g.fillStyle = isi; bulat(-105, -62, 210, 124, 16);
    g.globalAlpha = 0.55; g.strokeStyle = aksen; g.lineWidth = 7; kotak(-91, -48, 182, 96, 8); g.stroke();
    g.fillStyle = aksen; g.beginPath(); g.arc(0, 0, 29.5, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  g.save();
  g.translate(x, y); g.scale(s / 512, s / 512);
  g.fillStyle = '#fff4e3'; bulat(0, 0, 512, 512, 112);
  uang(193, 132, -16, '#5fb48e', '#2f7f5f');
  uang(325, 132, 14, '#7cc8a4', '#3f9a76');
  g.fillStyle = g.strokeStyle = '#0e7c86'; g.lineWidth = 20; g.lineJoin = 'round'; g.fill(atap); g.stroke(atap);
  g.fillStyle = '#f5a524'; bulat(300, 278, 138, 84, 42);
  g.fillStyle = '#fff4e3'; g.beginPath(); g.arc(352, 320, 17, 0, Math.PI * 2); g.fill();
  g.restore();
}
/**
 * Latar gambar yang dibagikan, senada dengan slide Rapor Keuangan: dasar selalu teal tema aplikasi; yang berganti per suasana
 * hanya dekorasinya (dua bola cahaya). Suasana: 'a' (sangat sehat) | 'b' | 'c' | 'd' (perlu perhatian) | 'netral' | 'tahun'.
 */
const PALET_LATAR = {
  a: ['#4ade80', '#fde047'],
  b: ['#67e8f9', '#5fb48e'],
  c: ['#fbbf24', '#fb923c'],
  d: ['#f87171', '#c084fc'],
  netral: ['#94a3b8', '#60a5fa'],
  tahun: ['#f5a524', '#f472b6'],
};
function latarMeriah(g, W, H, suasana) {
  const [k1, k2] = PALET_LATAR[suasana] || PALET_LATAR.b;
  const dasar = g.createLinearGradient(0, 0, W * .4, H);
  dasar.addColorStop(0, '#0e7c86'); dasar.addColorStop(.6, '#073b40'); dasar.addColorStop(1, '#062a2e');
  g.fillStyle = dasar; g.fillRect(0, 0, W, H);
  const bola = (x, y, r, warna, kuat) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const a8 = Math.round(kuat * 255).toString(16).padStart(2, '0');
    rg.addColorStop(0, warna + a8); rg.addColorStop(1, warna + '00');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  };
  bola(W * .05, H * .02, W * .8, k1, .45);
  bola(W * 1.02, H * .55, W * .65, k2, .35);
  bola(W * .2, H * 1.02, W * .55, k1, .22);
  // Titik kilau acak tapi tetap (sama tiap kali digambar).
  let benih = 7;
  const acak = () => (benih = (benih * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 36; i++) {
    g.fillStyle = `rgba(255,255,255,${(.08 + acak() * .22).toFixed(2)})`;
    g.beginPath(); g.arc(acak() * W, acak() * H, 2 + acak() * 5, 0, Math.PI * 2); g.fill();
  }
  const bawah = g.createLinearGradient(0, H * .55, 0, H);
  bawah.addColorStop(0, 'rgba(0,0,0,0)'); bawah.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = bawah; g.fillRect(0, 0, W, H);

  // Ilustrasi tegas di pojok kanan atas (area kosong di samping judul), senada dengan dekorasi slide Rapor.
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.14)';
  [[150, 16], [215, 5], [280, 5]].forEach(([r, t]) => { g.lineWidth = t; g.beginPath(); g.arc(W - 30, 90, r, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = 'rgba(255,255,255,.28)';
  for (let b = 0; b < 5; b++) for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(W - 330 + k * 30, 40 + b * 30, 4.5, 0, Math.PI * 2); g.fill(); }
  const uang = (x, y, rot, s) => { // = uang di logo & slide Rapor
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.fillStyle = '#5fb48e'; g.beginPath(); g.roundRect(-92, -52, 184, 104, 16); g.fill();
    g.strokeStyle = 'rgba(47,127,95,.6)'; g.lineWidth = 6; g.beginPath(); g.roundRect(-76, -36, 152, 72, 8); g.stroke();
    g.fillStyle = 'rgba(47,127,95,.55)'; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  const koin = (x, y, r) => {
    g.fillStyle = k2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = r * .1; g.beginPath(); g.arc(x, y, r * .7, 0, Math.PI * 2); g.stroke();
    g.font = `800 ${Math.round(r * .55)}px "Plus Jakarta Sans", system-ui, sans-serif`; g.fillStyle = 'rgba(0,0,0,.32)'; g.textAlign = 'center';
    g.fillText('Rp', x, y + r * .2);
  };
  const kilau = (x, y, r, a) => { // bintang 4 sudut
    g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.moveTo(x, y - r);
    g.quadraticCurveTo(x + r * .14, y - r * .14, x + r, y); g.quadraticCurveTo(x + r * .14, y + r * .14, x, y + r);
    g.quadraticCurveTo(x - r * .14, y + r * .14, x - r, y); g.quadraticCurveTo(x - r * .14, y - r * .14, x, y - r); g.fill();
  };
  uang(W - 150, 250, -.3, 1);
  koin(W - 300, 300, 34);
  g.fillStyle = k1; g.beginPath(); g.arc(W - 70, 330, 16, 0, Math.PI * 2); g.fill();
  kilau(W - 380, 210, 22, .9); kilau(W - 60, 40, 14, .7); kilau(54, H - 52, 16, .6); kilau(W - 54, H - 64, 22, .8);
  g.restore();
}
/** Logo + "Dompet Keluarga"; y = garis dasar teks. */
function kopMerek(g, x, y, ukuran, warna) {
  const s = Math.round(ukuran * 1.75);
  gambarLogo(g, x, Math.round(y - ukuran * 0.36 - s / 2), s);
  g.font = FONT_MEREK(ukuran, 800); g.fillStyle = warna; g.textAlign = 'left';
  g.fillText('Dompet Keluarga', x + s + Math.round(ukuran * 0.45), y);
}
/** Ajakan + alamat aplikasi di tengah bawah; y = garis dasar baris alamat (paling bawah). */
function kakiMerek(g, W, y, ukuran, warna) {
  g.textAlign = 'center';
  g.font = FONT_MEREK(ukuran, 600); g.fillStyle = warna;
  g.fillText(T('Dicatat dengan Dompet Keluarga · coba gratis'), W / 2, y - Math.round(ukuran * 1.5));
  g.font = FONT_MEREK(ukuran, 800); g.fillStyle = '#ffffff';
  g.fillText(TAUTAN_PROMO, W / 2, y);
}

/**
 * Kanvas → PNG → lembar pratinjau: gambarnya ditampilkan dulu, baru tombol Bagikan (menu berbagi HP) & Simpan gambar.
 * Dipakai "Bagikan ringkasan" dan "Bagikan kilas balik". Berbagi file harus dari ketukan pengguna, jadi
 * kirimGambar dipanggil dari tombol di lembar ini (AKSI 'pratinjau-bagikan' / 'pratinjau-simpan').
 */
let GAMBAR_BAGIKAN = null; // { blob, file, nama, judul, keterangan, url }
async function bagikanKanvas(c, nama, judul, keterangan, tambahan) {
  const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
  if (GAMBAR_BAGIKAN) URL.revokeObjectURL(GAMBAR_BAGIKAN.url);
  const file = new File([blob], nama, { type: 'image/png' });
  GAMBAR_BAGIKAN = { blob, file, nama, judul, keterangan, url: URL.createObjectURL(blob) };
  const bisaBagi = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  bukaSheet(judul, `
    <div class="pratinjau-bagikan"><img src="${GAMBAR_BAGIKAN.url}" alt="${esc(T('Pratinjau gambar {judul}', { judul }))}"></div>
    <div class="aksi-form">
      <button type="button" class="btn ${bisaBagi ? 'btn-kedua' : 'btn-utama'}" data-aksi="pratinjau-simpan">${T('⬇️ Simpan gambar')}</button>
      ${bisaBagi ? `<button type="button" class="btn btn-utama" data-aksi="pratinjau-bagikan">${T('📤 Bagikan')}</button>` : ''}
    </div>${tambahan || ''}`);
}

/** Bagikan gambar lewat menu berbagi HP; kalau browser tidak mendukung berbagi file (atau simpan = true), gambarnya diunduh. */
async function kirimGambar(blob, nama, judul, keterangan, simpan) {
  const file = new File([blob], nama, { type: 'image/png' });
  if (!simpan && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: judul, text: keterangan });
    } catch (e) { /* dibatalkan pengguna */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(T('Gambar disimpan ke folder unduhan ✔'));
}

/** Kilas balik satu tahun sebagai gambar 1080×1920 (9:16): angka utama, grafik 12 bulan, bulan terhemat/terboros, kategori terbesar. */
async function bagikanTahunan(th) {
  const bulan = Array.from({ length: 12 }, (_, i) => th + '-' + String(i + 1).padStart(2, '0'));
  const data = bulan.map(ringkasBulan);
  const masuk = data.reduce((a, x) => a + x.masuk, 0), keluar = data.reduce((a, x) => a + x.keluar, 0);
  const per = {};
  data.forEach(x => Object.keys(x.kategori).forEach(n => { per[n] = (per[n] || 0) + x.kategori[n]; }));
  const top = Object.keys(per).map(n => ({ n, v: per[n] })).sort((a, b) => b.v - a.v).slice(0, 4);
  const kini = periodeSekarang();
  const selesai = bulan.map((k, i) => ({ k, x: data[i] })).filter(o => o.k < kini && o.x.keluar);
  const hemat = selesai.slice().sort((a, b) => a.x.keluar - b.x.keluar)[0];
  const boros = selesai.slice().sort((a, b) => b.x.keluar - a.x.keluar)[0];
  const rata = rataPengeluaran(bulan, data);

  // 1080×1920 (9:16, pas untuk Status WhatsApp & Story Instagram), tata letak sejalan dengan gambar Story bulanan.
  const W = 1080, H = 1920, P = 84;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  try { await document.fonts.ready; } catch (e) { /* font cadangan */ }
  const teks = (s, x, y, ukuran, warna, tebal, rata2) => {
    g.font = `${tebal || 700} ${ukuran}px "Plus Jakarta Sans", system-ui, sans-serif`; g.fillStyle = warna; g.textAlign = rata2 || 'left'; g.fillText(s, x, y);
  };
  latarMeriah(g, W, H, 'tahun');

  kopMerek(g, P, 150, 36, 'rgba(255,255,255,.95)');
  teks(T('Kilas balik').toUpperCase(), P, 260, 34, 'rgba(255,255,255,.7)', 800);
  teks(String(th), P, 380, 128, '#ffffff', 800);

  const kotak = (x, y, w, label, nilai, warna) => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.roundRect(x, y, w, 190, 32); g.fill();
    teks(label, x + 34, y + 66, 30, 'rgba(255,255,255,.72)', 600);
    teks(nilai, x + 34, y + 142, 48, warna, 800);
  };
  const lebar = (W - P * 2 - 24) / 2;
  kotak(P, 450, lebar, T('Pemasukan'), rp(masuk), '#3ccb8b');
  kotak(P + lebar + 24, 450, lebar, T('Pengeluaran'), rp(keluar), '#ff8a7a');
  kotak(P, 664, lebar, T('Selisih') + (masuk ? ` · ${Math.round((masuk - keluar) / masuk * 100)}%` : ''), rp(masuk - keluar), '#ffffff');
  kotak(P + lebar + 24, 664, lebar, T('Rata-rata / bulan'), rp(rata.nilai), '#ffffff');

  // Grafik batang 12 bulan: pemasukan (hijau) & pengeluaran (koral).
  const gx = P, gy = 930, gw = W - P * 2, gh = 260;
  const maks = Math.max(1, ...data.map(x => Math.max(x.masuk, x.keluar)));
  const kolom = gw / 12, bw = Math.min(26, (kolom - 14) / 2);
  data.forEach((x, i) => {
    const cx = gx + i * kolom + kolom / 2;
    [[x.masuk, '#3ccb8b', cx - bw - 2], [x.keluar, '#ff8a7a', cx + 2]].forEach(([v, warna, bx]) => {
      const h = v / maks * gh;
      if (h < 1) return;
      g.fillStyle = warna; g.beginPath(); g.roundRect(bx, gy + gh - h, bw, h, 7); g.fill();
    });
    teks(NAMA_BULAN_PENDEK[i], cx, gy + gh + 46, 26, 'rgba(255,255,255,.6)', 600, 'center');
  });

  let y = 1300;
  if (hemat && boros && hemat.k !== boros.k) {
    teks(T('🌱 Paling hemat: {bulan} ({jumlah})', { bulan: NAMA_BULAN_PENDEK[bulan.indexOf(hemat.k)], jumlah: rpPendek(hemat.x.keluar) }), P, y, 34, '#ffffff', 700);
    teks(T('🔥 Paling boros: {bulan} ({jumlah})', { bulan: NAMA_BULAN_PENDEK[bulan.indexOf(boros.k)], jumlah: rpPendek(boros.x.keluar) }), P, y + 58, 34, '#ffffff', 700);
    y += 140;
  }
  if (top.length) {
    teks(T('Pengeluaran terbesar'), P, y, 38, '#ffffff', 800);
    const maksKat = Math.max(1, ...top.map(x => x.v));
    top.forEach((x, i) => {
      const yy = y + 66 + i * 80;
      teks(ikonKategori(x.n, TIPE.KELUAR) + '  ' + namaT(x.n), P, yy, 31, 'rgba(255,255,255,.95)', 700);
      teks(rp(x.v) + (keluar ? `  ${Math.round(x.v / keluar * 100)}%` : ''), W - P, yy, 30, 'rgba(255,255,255,.88)', 700, 'right');
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.roundRect(P, yy + 18, W - P * 2, 10, 5); g.fill();
      g.fillStyle = '#5fd0c8'; g.beginPath(); g.roundRect(P, yy + 18, Math.max(10, (W - P * 2) * x.v / maksKat), 10, 5); g.fill();
    });
  }
  kakiMerek(g, W, H - 50, 30, 'rgba(255,255,255,.8)');

  const keterangan = T('Kilas balik keuangan {tahun}: pemasukan {masuk}, pengeluaran {keluar}, selisih {selisih}.', { tahun: th, masuk: rp(masuk), keluar: rp(keluar), selisih: rp(masuk - keluar) });
  await bagikanKanvas(c, 'kilas-balik-' + th + '.png', T('Kilas balik {tahun}', { tahun: th }), keterangan);
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

/** Per kategori dari ringkasan periode: pengeluaran (kategori) atau pemasukan (kategoriMasuk). */
function kategoriRingkas(x, tipe) {
  return (tipe === TIPE.MASUK ? x.kategoriMasuk : x.kategori) || {};
}

function kartuKategoriLaporan(pilih, data) {
  const setahun = S.lapKategori === 'tahun';
  const tipe = S.lapTipe === TIPE.MASUK ? TIPE.MASUK : TIPE.KELUAR;
  const per = {};
  (setahun ? data : [ringkasBulan(pilih)]).forEach(x => {
    const k = kategoriRingkas(x, tipe);
    Object.keys(k).forEach(n => { per[n] = (per[n] || 0) + k[n]; });
  });
  const urut = Object.keys(per).map(n => ({
    ikon: ikonKategori(n, tipe), nama: namaT(n), nilai: per[n],
    atribut: `data-aksi="tren-kategori" data-nama="${esc(n)}" data-tipe="${esc(tipe)}"`,
  })).sort((a, b) => b.nilai - a.nilai);
  const total = urut.reduce((a, x) => a + x.nilai, 0);
  const chip = (aksi, nilai, aktif, label) => `<button class="chip ${aktif ? 'aktif' : ''}" data-aksi="${aksi}" data-mode="${esc(nilai)}">${label}</button>`;
  return `<section class="kartu">
    <h3>${tipe === TIPE.MASUK ? T('Pemasukan per kategori') : T('Pengeluaran per kategori')}</h3>
    <div class="chips">
      ${chip('lap-tipe', TIPE.KELUAR, tipe === TIPE.KELUAR, T('Pengeluaran'))}
      ${chip('lap-tipe', TIPE.MASUK, tipe === TIPE.MASUK, T('Pemasukan'))}
      <span class="pemisah-chip" aria-hidden="true"></span>
      ${chip('lap-kategori', 'bulan', !setahun, esc(namaBulan(pilih)))}
      ${chip('lap-kategori', 'tahun', setahun, T('Setahun {tahun}', { tahun: S.tahun }))}
    </div>
    ${urut.length
      ? donatKategori(urut, total) + barBerperingkat(urut, total) + `<p class="info-kecil" style="margin-top:4px">${T('Ketuk kategori untuk melihat trennya & transaksinya.')}</p>`
      : kosong('🧾', tipe === TIPE.MASUK ? T('Belum ada pemasukan.') : T('Belum ada pengeluaran.'))}
  </section>`;
}

/** Lembar tren satu kategori: 12 bulan di tahun yang dilihat, garis anggaran, dan pintu ke transaksinya di Riwayat. */
function bukaTrenKategori(nama, tipe) {
  const th = S.tahun;
  const bulan = Array.from({ length: 12 }, (_, i) => th + '-' + String(i + 1).padStart(2, '0'));
  const nilai = bulan.map(k => kategoriRingkas(ringkasBulan(k), tipe)[nama] || 0);
  const pilih = S.bulan.slice(0, 4) === String(th) ? S.bulan : bulan[11];
  const kini = periodeSekarang();
  const selesai = nilai.filter((v, i) => bulan[i] < kini && adaIsi(ringkasBulan(bulan[i])));
  const rata = selesai.length ? Math.round(selesai.reduce((a, v) => a + v, 0) / selesai.length) : 0;
  const totalTahun = nilai.reduce((a, v) => a + v, 0);
  const kat = tipe === TIPE.KELUAR ? S.data.kategori.find(k => k.nama === nama && k.tipe === tipe) : null;
  const batas = kat && kat.anggaran > 0 ? kat.anggaran : 0;

  const W = 340, H = 170, kiri = 36, bawah = 22, atas = 8;
  const tinggi = H - bawah - atas;
  const skala = angkaBulat(Math.max(1, batas, ...nilai));
  const y = v => atas + tinggi - v / skala * tinggi;
  const lebarGrup = (W - kiri) / 12;
  const bw = Math.min(14, lebarGrup - 8);
  const kelas = tipe === TIPE.MASUK ? 'seri-1' : 'seri-2';
  const grafik = `<svg class="grafik" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('Tren {nama} per bulan', { nama: esc(namaT(nama)) })}">
    ${[skala / 2, skala].map(v => `<line class="grid" x1="${kiri}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="sumbu" x="${kiri - 6}" y="${y(v) + 3}" text-anchor="end">${rpPendek(v)}</text>`).join('')}
    <line class="dasar" x1="${kiri}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
    ${bulan.map((k, i) => {
      const cx = kiri + i * lebarGrup + lebarGrup / 2;
      const lewat = batas && nilai[i] > batas;
      return `${k === pilih ? `<rect class="pilih" x="${kiri + i * lebarGrup + 1}" y="${atas}" width="${lebarGrup - 2}" height="${tinggi}" rx="6"/>` : ''}
        ${batang(cx - bw / 2, y(nilai[i]), bw, y(0), lewat ? 'defisit' : kelas, i * 35)}
        <text class="sumbu ${k === pilih ? 'aktif' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${NAMA_BULAN_PENDEK[i]}</text>
        <rect class="hit" x="${kiri + i * lebarGrup}" y="0" width="${lebarGrup}" height="${H}"><title>${esc(namaBulan(k))}: ${rp(nilai[i])}</title></rect>`;
    }).join('')}
    ${batas ? `<line class="garis-batas" x1="${kiri}" x2="${W}" y1="${y(batas)}" y2="${y(batas)}"/>` : ''}
  </svg>`;
  const tile = (label, isi, ket) => `<div class="tile"><small>${label}</small><b>${isi}</b>${ket ? `<span>${ket}</span>` : ''}</div>`;
  const lewatKali = batas ? nilai.filter(v => v > batas).length : 0;
  bukaSheet(`${ikonKategori(nama, tipe)} ${namaT(nama)}`, `
    <div class="kpi" style="margin-bottom:10px">
      ${tile(esc(namaBulan(pilih)), rp(kategoriRingkas(ringkasBulan(pilih), tipe)[nama] || 0), batas ? T('anggaran {jumlah}', { jumlah: rp(batas) }) : '')}
      ${tile(T('Rata-rata per bulan'), rp(rata), selesai.length ? T('{n} periode selesai', { n: selesai.length }) : '')}
      ${tile(T('Setahun {tahun}', { tahun: th }), rp(totalTahun), batas ? (lewatKali ? T('lewat anggaran {n}×', { n: lewatKali }) : T('selalu dalam anggaran 👍')) : '')}
    </div>
    <div class="slide-grafik main" style="padding:0">${grafik}</div>
    ${batas ? `<p class="info-kecil" style="text-align:left;margin-top:6px">${T('Garis putus-putus = anggaran saat ini. Batang merah = lewat anggaran.')}</p>` : ''}
    <div class="aksi-form" style="flex-direction:column;gap:8px;margin-top:14px">
      <button type="button" class="btn btn-utama" data-aksi="lap-riwayat" data-nama="${esc(nama)}" data-tipe="${esc(tipe)}" data-rentang="periode" data-bulan="${esc(pilih)}">${T('Lihat transaksi {bulan}', { bulan: esc(namaBulan(pilih)) })}</button>
      <button type="button" class="btn" data-aksi="lap-riwayat" data-nama="${esc(nama)}" data-tipe="${esc(tipe)}" data-rentang="tahun" data-bulan="${esc(pilih)}">${T('Lihat transaksi setahun {tahun}', { tahun: th })}</button>
    </div>`);
}

/**
 * Laporan → Anggaran vs realisasi: tiap kategori beranggaran, 12 kotak kecil (aman / hampir / lewat) untuk
 * tahun yang dilihat, dan berapa kali lewat. Memakai anggaran yang berlaku sekarang (riwayat anggaran tidak disimpan).
 */
function kartuAnggaranLaporan(bulan, data, pilih) {
  const kat = S.data.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0);
  if (!kat.length) {
    return `<section class="kartu" style="padding:4px 16px">
      <button class="baris" data-aksi="atur-anggaran"><span class="ikon-bulat">🎯</span>
        <span class="isi"><b>${T('Anggaran vs realisasi')}</b><small>${T('Atur anggaran per kategori untuk melihat bulan mana yang kebablasan')}</small></span>
        <span class="panah">${svg('maju')}</span></button></section>`;
  }
  const kini = periodeSekarang();
  const baris = kat.map(k => {
    const sel = bulan.map((b, i) => {
      const v = data[i].kategori[k.nama] || 0;
      if (b > kini) return { b, v, st: 'nanti' };
      if (!adaIsi(data[i])) return { b, v, st: 'kosong' };
      return { b, v, st: v > k.anggaran ? 'lewat' : v >= k.anggaran * 0.8 ? 'hampir' : 'aman' };
    });
    const dihitung = sel.filter(s => s.st !== 'nanti' && s.st !== 'kosong');
    const lewat = dihitung.filter(s => s.st === 'lewat').length;
    const kiniV = ringkasBulan(pilih).kategori[k.nama] || 0;
    return { k, sel, lewat, n: dihitung.length, kiniV };
  }).sort((a, b) => b.lewat - a.lewat || b.kiniV / b.k.anggaran - a.kiniV / a.k.anggaran);
  const namaSt = { aman: T('aman'), hampir: T('hampir habis'), lewat: T('lewat anggaran'), kosong: T('belum ada data'), nanti: T('belum terjadi') };
  return `<section class="kartu">
    <h3>${T('Anggaran vs realisasi · {tahun}', { tahun: S.tahun })}</h3>
    <div class="daftar-anggaran-lap">${baris.map(x => `
      <button type="button" class="baris-anggaran-lap" data-aksi="tren-kategori" data-nama="${esc(x.k.nama)}" data-tipe="${esc(TIPE.KELUAR)}">
        <span class="ikon">${ilus(ikonKategori(x.k.nama, TIPE.KELUAR))}</span>
        <span class="isi"><b>${esc(namaT(x.k.nama))}</b>
          <small>${x.n ? (x.lewat ? T('Lewat {n} dari {m} bulan', { n: x.lewat, m: x.n }) : T('Aman {m} bulan 👍', { m: x.n })) : T('Belum ada data')}</small></span>
        <span class="nilai">${rp(x.kiniV)}<small>/ ${rp(x.k.anggaran)}</small></span>
        <span class="strip-anggaran" aria-hidden="true">${x.sel.map((s, i) => `<i class="${s.st} ${s.b === pilih ? 'dipilih' : ''}" title="${esc(NAMA_BULAN_PENDEK[i])}: ${rp(s.v)} · ${namaSt[s.st]}"></i>`).join('')}</span>
      </button>`).join('')}</div>
    <div class="legenda-anggaran">
      <i class="aman"></i><small>${T('aman')}</small><i class="hampir"></i><small>${T('≥80%')}</small><i class="lewat"></i><small>${T('lewat')}</small>
    </div>
    <p class="info-kecil" style="text-align:left;margin-top:6px">${T('Dibanding anggaran yang berlaku sekarang; tambahan sisa amplop tidak dihitung.')}</p>
  </section>`;
}

// ---------- Laporan: sorotan, donat kategori, pola belanja, transaksi terbesar ----------

/** Transaksi rinci hanya tersedia untuk periode yang sedang dimuat (S.data.bulan); periode lain cukup ringkasan bulanan. */
const trxLaporan = pilih => (S.data.bulan === pilih ? S.data.transaksi : null);
const WARNA_DONAT = ['#0E7C86', '#F5A524', '#2A78D6', '#E8553E', '#65A30D', '#94A3B8']; // teal dan amber merek lebih dulu, tanpa pink/ungu
const NAMA_HARI_SEMINGGU = [T('Sen'), T('Sel'), T('Rab'), T('Kam'), T('Jum'), T('Sab'), T('Min')];

/** Wawasan otomatis untuk periode terpilih, disusun dari yang paling berguna. */
function kartuSorotan(pilih) {
  const r = ringkasBulan(pilih);
  const trx = trxLaporan(pilih);
  const rentang = SERVER.rentangPeriode(pilih, S.data.mulaiPeriode || 1);
  const hari = hariIni();
  const akhir = rentang.akhir < hari ? rentang.akhir : hari;
  const jumlahHari = Math.max(1, Math.round((keTanggal(akhir) - keTanggal(rentang.awal)) / 864e5) + 1);
  const butir = [];
  const tambah = (ikon, judul, ket, kelas) => butir.push({ ikon, judul, ket, kelas: kelas || '' });

  if (r.keluar) tambah(svg('kalender'), T('{jumlah} per hari', { jumlah: rp(Math.round(r.keluar / jumlahHari)) }), T('Rata-rata pengeluaran selama {n} hari', { n: jumlahHari }));
  if (r.masuk) {
    const rasio = Math.round((r.masuk - r.keluar) / r.masuk * 100);
    tambah(svg(rasio >= 20 ? 'celengan' : rasio >= 0 ? 'senyum' : 'peringatan'), rasio >= 0 ? T('Tersisa {persen}% dari pemasukan', { persen: Math.abs(rasio) }) : T('Minus {persen}% dari pemasukan', { persen: Math.abs(rasio) }),
      rasio >= 20 ? T('Bagus! Di atas 20% yang biasa disarankan') : rasio >= 0 ? T('Coba sisihkan minimal 20% untuk ditabung') : T('Pengeluaran lebih besar dari pemasukan'),
      rasio >= 20 ? 'baik' : rasio < 0 ? 'buruk' : '');
  }
  const pb = bandingPeriode(pilih, 'lalu');
  if (pb.kini.keluar && pb.lalu.keluar) {
    const p = Math.round((pb.kini.keluar - pb.lalu.keluar) / pb.lalu.keluar * 100);
    const ket = pb.sebagian
      ? T('Dibanding {bulan} di hari ke-{n} yang sama ({jumlah})', { bulan: namaBulan(pb.bulanLalu), n: pb.hariKe, jumlah: rp(pb.lalu.keluar) })
      : T('Dibanding {bulan} ({jumlah})', { bulan: namaBulan(pb.bulanLalu), jumlah: rp(pb.lalu.keluar) });
    if (p) tambah(svg(p > 0 ? 'naik' : 'turun'), p > 0 ? T('Pengeluaran naik {persen}%', { persen: Math.abs(p) }) : T('Pengeluaran turun {persen}%', { persen: Math.abs(p) }), ket, p > 0 ? 'buruk' : 'baik');
  }
  const ramal = perkiraanAkhir(pilih);
  if (ramal) butir.unshift({ ikon: svg('ramal'), judul: T('Perkiraan akhir periode: {jumlah}', { jumlah: rp(ramal.nilai) }), ket: ramal.ket, kelas: ramal.kelas });
  const kat = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v)[0];
  if (kat && r.keluar) tambah(ilus(ikonKategori(kat.n, TIPE.KELUAR)), T('{nama} paling besar', { nama: esc(namaT(kat.n)) }), T('{jumlah} · {persen}% dari pengeluaran', { jumlah: rp(kat.v), persen: Math.round(kat.v / r.keluar * 100) }));
  if (trx) {
    const keluar = trx.filter(t => t.tipe === TIPE.KELUAR);
    const perHari = {};
    keluar.forEach(t => { perHari[t.tanggal] = (perHari[t.tanggal] || 0) + t.jumlah; });
    const boros = Object.keys(perHari).sort((a, b) => perHari[b] - perHari[a])[0];
    if (boros) tambah(svg('nyala'), T('Paling boros: {hari}', { hari: esc(labelHariPendek(boros)) }), T('{jumlah} dalam sehari', { jumlah: rp(perHari[boros]) }));
    const tanpa = jumlahHari - Object.keys(perHari).filter(t => t >= rentang.awal && t <= akhir).length;
    if (keluar.length && tanpa > 0) tambah(svg('tunas'), T('{n} hari tanpa pengeluaran', { n: tanpa }), T('Hari tanpa jajan bikin saldo awet'), 'baik');
  }
  if (!butir.length) return '';
  const ai = (S.ringkasAi || {})[pilih];
  const bisaAi = S.data.kunciGemini && S.data.kunciGemini.length;
  return `<section class="kartu">
    <div class="kepala-kartu"><h3>${T('✨ Sorotan · {bulan}', { bulan: esc(namaBulan(pilih)) })}</h3>
      <button type="button" class="chip chip-kilas" data-aksi="kilas-putar" data-bulan="${esc(pilih)}">${T('▶ Rapor bulanan')}</button></div>
    <div id="ringkas-ai">${ai ? kotakRingkasAi(ai, pilih) : ''}</div>
    <div class="sorotan">${butir.map(b => `
      <div class="butir-sorotan ${b.kelas}"><span class="ikon-sorotan">${b.ikon}</span>
        <span class="isi"><b>${b.judul}</b><small>${esc(b.ket)}</small></span></div>`).join('')}</div>
    ${bisaAi && !ai ? `<button type="button" class="tombol-tambah" style="margin-top:10px" data-aksi="ai-laporan" data-bulan="${esc(pilih)}">${T('✨ Jelaskan periode ini dengan AI')}</button>`
      : !bisaAi && !DEMO.aktif() ? `<button type="button" class="tombol-tambah" style="margin-top:10px" data-aksi="gemini">${T('✨ Aktifkan AI untuk penjelasan periode ini')}</button>` : ''}
  </section>`;
}

/**
 * Perkiraan pengeluaran di akhir periode berjalan, dari laju sejauh ini (mulai hari ke-5 supaya tidak liar).
 * Dibanding total anggaran kalau ada, kalau tidak dengan pemasukan periode ini.
 */
function perkiraanAkhir(pilih) {
  const st = S.data.setara;
  if (!st || st.bulan !== pilih || st.hariKe < 5) return null;
  const rentang = SERVER.rentangPeriode(pilih, S.data.mulaiPeriode || 1);
  const totalHari = Math.round((keTanggal(rentang.akhir) - keTanggal(rentang.awal)) / 864e5) + 1;
  if (st.hariKe >= totalHari || !st.ini.keluar) return null;
  const perHari = st.ini.keluar / st.hariKe;
  const nilai = Math.round(perHari * totalHari / 1000) * 1000;
  const anggaran = S.data.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0).reduce((a, k) => a + k.anggaran, 0);
  const masuk = ringkasBulan(pilih).masuk;
  const dasar = T('Kalau laju belanja tetap {jumlah}/hari', { jumlah: rp(Math.round(perHari)) });
  if (anggaran) {
    return { nilai, kelas: nilai > anggaran ? 'buruk' : 'baik',
      ket: dasar + ' · ' + (nilai > anggaran ? T('lewat {jumlah} dari total anggaran', { jumlah: rp(nilai - anggaran) }) : T('masih di bawah total anggaran {jumlah}', { jumlah: rp(anggaran) })) };
  }
  if (masuk) return { nilai, kelas: nilai > masuk ? 'buruk' : '', ket: dasar + ' · ' + (nilai > masuk ? T('melebihi pemasukan periode ini') : T('pemasukan periode ini {jumlah}', { jumlah: rp(masuk) })) };
  return { nilai, kelas: '', ket: dasar };
}

function kotakRingkasAi(teks, pilih) {
  return `<div class="ringkas-ai"><p>${esc(teks)}</p>
    <small>${T('✨ Ditulis AI Gemini dari angka ringkasan, bisa keliru.')}
      <button type="button" class="tombol-teks" data-aksi="ai-laporan" data-bulan="${esc(pilih)}" data-ulang="1">${T('Tulis ulang')}</button></small></div>`;
}

/** Angka ringkasan satu periode untuk dijelaskan AI. Catatan transaksi hanya dari 5 pengeluaran terbesar. */
function faktaLaporan(pilih) {
  const r = ringkasBulan(pilih);
  const pb = bandingPeriode(pilih, 'lalu');
  const pt = bandingPeriode(pilih, 'tahun');
  const atas = (o, n) => Object.keys(o || {}).map(k => ({ kategori: k, jumlah: o[k] })).sort((a, b) => b.jumlah - a.jumlah).slice(0, n);
  const trx = trxLaporan(pilih);
  const fakta = {
    periode: namaBulan(pilih),
    masihBerjalan: !!(S.data.setara && S.data.setara.bulan === pilih),
    hariKe: S.data.setara && S.data.setara.bulan === pilih ? S.data.setara.hariKe : undefined,
    pemasukan: r.masuk, pengeluaran: r.keluar, masukTabungan: r.ditabung,
    pengeluaranPerKategori: atas(r.kategori, 8),
    pemasukanPerKategori: atas(r.kategoriMasuk, 4),
    periodeLalu: { periode: namaBulan(pb.bulanLalu), pengeluaran: pb.lalu.keluar, hariYangSama: pb.sebagian, perKategori: atas(pb.lalu.kategori, 8) },
    tahunLalu: pt.lalu.keluar ? { periode: namaBulan(pt.bulanLalu), pengeluaran: pt.lalu.keluar, perKategori: atas(pt.lalu.kategori, 5) } : undefined,
    anggaran: S.data.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0).map(k => ({ kategori: k.nama, anggaran: k.anggaran, terpakai: r.kategori[k.nama] || 0 })),
  };
  const ramal = perkiraanAkhir(pilih);
  if (ramal) fakta.perkiraanPengeluaranAkhirPeriode = ramal.nilai;
  if (trx) {
    const keluar = trx.filter(t => t.tipe === TIPE.KELUAR);
    fakta.pengeluaranTerbesar = keluar.slice().sort((a, b) => b.jumlah - a.jumlah).slice(0, 5)
      .map(t => ({ tanggal: t.tanggal, kategori: t.kategori, jumlah: t.jumlah, catatan: t.catatan.slice(0, 40) }));
    const perHari = [0, 0, 0, 0, 0, 0, 0];
    keluar.forEach(t => { perHari[(keTanggal(t.tanggal).getDay() + 6) % 7] += t.jumlah; });
    fakta.pengeluaranPerHariSeminggu = { Senin: perHari[0], Selasa: perHari[1], Rabu: perHari[2], Kamis: perHari[3], Jumat: perHari[4], Sabtu: perHari[5], Minggu: perHari[6] };
    fakta.jumlahTransaksiPengeluaran = keluar.length;
  }
  return fakta;
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

/** Laporan: pintu ke Label & acara (#lebaran), dengan label di periode terpilih kalau ada. */
function kartuLabelLaporan(pilih) {
  const trx = trxLaporan(pilih);
  const daftar = trx ? ringkasLabel(trx).sort((a, b) => b.keluar - a.keluar).slice(0, 3) : [];
  return `<section class="kartu" style="padding:4px 16px">
    <button class="baris" data-aksi="buka-label">
      <span class="ikon-bulat">🏷️</span>
      <span class="isi"><b>${T('Label & acara')}</b><small>${daftar.length
        ? esc(NAMA_BULAN_PENDEK[Number(pilih.slice(5, 7)) - 1]) + ': ' + daftar.map(g => '#' + esc(g.label) + ' ' + rpPendek(g.keluar)).join(' · ')
        : T('Kumpulkan pengeluaran lintas kategori, mis. #lebaran')}</small></span>
      <span class="panah">${svg('maju')}</span>
    </button>
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
  const mode = S.lapBanding === 'tahun' ? 'tahun' : 'lalu';
  const pb = bandingPeriode(pilih, mode);
  const lalu = pb.bulanLalu;
  const a = pb.kini.kategori;
  const b = pb.lalu.kategori;
  const pilihan = `<div class="chips">
      <button class="chip ${mode === 'lalu' ? 'aktif' : ''}" data-aksi="lap-banding" data-mode="lalu">${T('Periode lalu')}</button>
      <button class="chip ${mode === 'tahun' ? 'aktif' : ''}" data-aksi="lap-banding" data-mode="tahun">${T('Sama, tahun lalu')}</button>
    </div>`;
  if (!pb.lalu.keluar && !adaIsi(ringkasBulan(lalu))) {
    return `<section class="kartu"><h3>${T('Dibanding {bulan}', { bulan: esc(namaBulan(lalu)) })}</h3>${pilihan}
      ${kosong('🗓️', T('Belum ada catatan di {bulan}.', { bulan: esc(namaBulan(lalu)) }))}</section>`;
  }
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
  const totKini = pb.kini.keluar;
  const totLalu = pb.lalu.keluar;
  return `<section class="kartu">
    <h3>${T('Dibanding {bulan}', { bulan: esc(namaBulan(lalu)) })}</h3>
    ${pilihan}
    ${pb.sebagian ? `<p class="info-kecil" style="text-align:left;margin:-6px 0 4px">${T('Periode ini baru berjalan {n} hari, jadi keduanya dihitung sampai hari ke-{n} saja.', { n: pb.hariKe })}</p>` : ''}
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

const semuaDompetSetup = () => DOMPET_UMUM.concat(S.setup.lain.map(n => [n, (typeof ILUSTRASI !== 'undefined' && ILUSTRASI.tebakMerek(n)) || '💳']));

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
    <button type="button" class="tombol-tambah" data-aksi="keluar">${DEMO.aktif() ? T('Akhiri mode coba') : T('Keluar dari {email}', { email: esc(S.data.user) })}</button>`;
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
  const baris = (aksi, ikon, judul, sub, attr = '') => `
      <button class="baris" data-aksi="${aksi}" ${attr}>
        <span class="ikon-bulat">${ikon}</span>
        <span class="isi"><b>${judul}</b><small>${sub}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`;
  const tautan = (href, ikon, judul, sub, baru) => `
      <a class="baris" href="${esc(href)}" ${baru ? 'target="_blank" rel="noopener"' : ''} style="color:inherit;text-decoration:none">
        <span class="ikon-bulat">${ikon}</span>
        <span class="isi"><b>${judul}</b><small>${sub}</small></span>
        <span class="panah">${svg('maju')}</span>
      </a>`;
  const rutin = daftarRutin();
  return `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Pengaturan')}</h1>
    </div>

    <h2 class="judul-bagian">${T('Profil')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${baris('ganti-avatar', htmlAvatar(d.user), esc(namaPendek(d.user)), T('Ganti avatar · pilih gambar atau unggah foto sendiri'))}
      ${d.lisensi && !DEMO.aktif() ? baris('versi-penuh', d.lisensi.aktif ? '⭐' : '🔓', T('Versi penuh'), ketVersiPenuh(d.lisensi)) : ''}
    </section>

    <h2 class="judul-bagian">${T('Keuangan')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${baris('atur-anggaran', '🎯', T('Anggaran bulanan'), T('Batas belanja per kategori'))}
      ${baris('kelola-rutin', '🔁', T('Tagihan & transaksi rutin'), rutin.length ? T('{n} rutin · berikutnya {nama}, {tanggal}', { n: rutin.length, nama: esc(rutin[0].nama), tanggal: esc(tanggalPendek(rutin[0].berikutnya)) }) : T('Listrik, internet, cicilan, SPP, gaji…'))}
      ${baris('kelola-kategori', '🏷️', T('Kelola kategori'), T('Tambah, ubah nama, atau hapus kategori'))}
      ${baris('atur-periode', '📅', T('Periode gajian'), (d.mulaiPeriode || 1) > 1 ? T('Mulai tanggal {tanggal} tiap bulan', { tanggal: d.mulaiPeriode }) : T('Bulan kalender (tanggal 1)'))}
      ${baris('buku', '📒', T('Buku keuangan'), esc(namaT(d.namaBuku || 'Keluarga')) + ((d.buku || []).length > 1 ? ' · ' + T('{n} buku', { n: d.buku.length }) : ' · ' + T('pisahkan pribadi, keluarga, usaha')))}
    </section>

    <h2 class="judul-bagian">${T('Keluarga & berbagi')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${baris('undang', '👨‍👩‍👧', T('Anggota keluarga'), T('Undang atau keluarkan akun Google lain'))}
      ${baris('aktivitas', '👥', T('Aktivitas keluarga'), T('Siapa mencatat, mengubah, atau menghapus apa'))}
      ${d.telegram.bot || d.telegram.pengguna.length ? baris('telegram', '💬', T('Bot Telegram'), (d.telegram.bot ? '@' + esc(d.telegram.bot) + ' · ' : '') + T('{n} akun terhubung', { n: d.telegram.pengguna.length })) : ''}
    </section>

    <h2 class="judul-bagian">${T('Data & AI')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${baris('gemini', '🤖', T('Fitur AI (Gemini)'), d.kunciGemini.length ? T('Aktif · struk, suara, laporan & bot lebih pintar') : T('Mati · aktifkan gratis untuk 6 fitur pintar'))}
      ${DEMO.aktif() ? '' : tautan(d.urlSpreadsheet, '📊', T('Buka spreadsheet'), T('Lihat semua data di Google Sheets'), true)}
      ${baris('cadangan', '💾', T('Unduh & cadangan data'), T('Simpan semua transaksi sebagai file Excel/CSV'))}
    </section>

    <h2 class="judul-bagian">${T('Tampilan & keamanan')}</h2>
    <section class="kartu" style="padding:4px 16px">
      <label class="baris baris-pilih">
        <span class="ikon-bulat">🌐</span>
        <span class="isi"><b>${BAHASA === 'en' ? 'Language · Bahasa' : 'Bahasa · Language'}</b><small>${T('Bahasa tampilan aplikasi di HP ini')}</small></span>
        <span class="pilih-kecil">${pilihBahasa()}</span>
      </label>
      ${BAHASA === 'id' ? `<label class="baris baris-pilih">
        <span class="ikon-bulat">💬</span>
        <span class="isi"><b>${T('Gaya bahasa')}</b><small>${GAYA === 'santai' ? T('Santai · menyapa dengan "kamu"') : T('Formal · menyapa dengan "Anda"')}</small></span>
        <span class="pilih-kecil">
          <select id="pilih-gaya" aria-label="${T('Gaya bahasa')}">${[['', T('Formal')], ['santai', T('Santai')]].map(([g, l]) =>
            `<option value="${g}" ${(GAYA === 'santai' ? 'santai' : '') === g ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </span>
      </label>` : ''}
      <div class="baris">
        <span class="ikon-bulat">${temaAktif() === 'dark' ? '🌙' : '☀️'}</span>
        <span class="isi"><b>${T('Tema')}</b><small>${temaDipilih() ? (temaDipilih() === 'dark' ? T('Tetap gelap') : T('Tetap terang')) : T('Ikut pengaturan HP')}</small></span>
        <span class="segmen segmen-kecil" role="group" aria-label="${T('Tema')}">${[['light', T('Terang')], ['dark', T('Gelap')]].map(([t, l]) =>
          `<button type="button" class="${temaAktif() === t ? 'aktif' : ''}" data-aksi="tema" data-t="${t}" aria-pressed="${temaAktif() === t}">${l}</button>`).join('')}</span>
      </div>
      ${layarLebar() || tampilanDipilih() ? `<label class="baris baris-pilih">
        <span class="ikon-bulat">${tampilanDipilih() === 'hp' ? '📱' : '🖥️'}</span>
        <span class="isi"><b>${T('Tampilan')}</b><small>${tampilanDipilih() === 'hp' ? T('Seperti di HP, di tengah layar') : T('Layar lebar dengan menu di samping')}</small></span>
        <span class="pilih-kecil">
          <select id="pilih-tampilan" aria-label="${T('Tampilan')}">${[['', T('Web')], ['hp', T('HP')]].map(([t, l]) =>
            `<option value="${t}" ${tampilanDipilih() === t ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </span>
      </label>` : ''}
      <label class="baris baris-pilih">
        <span class="ikon-bulat">🔠</span>
        <span class="isi"><b>${T('Ukuran tampilan')}</b><small>${T('Perbesar teks & tombol supaya lebih mudah dibaca')}</small></span>
        <span class="pilih-kecil">
          <select id="pilih-ukuran" aria-label="${T('Ukuran tampilan')}">${[['', T('Normal')], ['besar', T('Besar')], ['sangat', T('Sangat besar')]].map(([u, l]) =>
            `<option value="${u}" ${ukuranDipilih() === u ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </span>
      </label>
      ${baris('atur-pintasan', '⚡', T('Pintasan di Beranda'), pintasanDipilih().map(k => PINTASAN[k][1]).join(' · ') || T('Belum ada pintasan'))}
      ${baris('atur-menu', '🧭', T('Urutan menu'), tombolMenu().slice(0, 4).map(b => esc(b.textContent.trim())).join(' · '))}
      <button class="baris" data-aksi="samar" role="switch" aria-checked="${modeSamar()}">
        <span class="ikon-bulat">👁</span>
        <span class="isi"><b>${T('Sembunyikan nominal')}</b><small>${modeSamar() ? T('Angka disamarkan') : T('Samarkan angka saat HP dilihat orang lain')}</small></span>
        <span class="saklar ${modeSamar() ? 'nyala' : ''}" aria-hidden="true"></span>
      </button>
      ${baris('atur-kunci', '🔒', T('Kunci aplikasi'), kunciTersimpan() ? (kunciTersimpan().bio ? T('Aktif · PIN + sidik jari/wajah') : T('Aktif · PIN')) : T('Minta PIN saat aplikasi dibuka'))}
    </section>

    <h2 class="judul-bagian">${T('Bantuan')}</h2>
    <section class="kartu" style="padding:4px 16px">
      ${baris('tips', '💡', T('Tips & trik'), T('Fitur tersembunyi: ketik cepat, geser, tekan lama, label, bot'))}
      ${baris('tur', '🧭', T('Tur singkat aplikasi'), T('Cara cepat mencatat, suara, foto struk, dan gestur'))}
      ${baris('log-update', '🆕', T('Apa yang baru'), labelVersi() ? T('Riwayat pembaruan aplikasi · sekarang {versi}', { versi: labelVersi() }) : T('Riwayat pembaruan aplikasi'))}
      ${tautan('privasi.html', '🔐', T('Kebijakan privasi'), T('Data apa yang dipakai aplikasi ini'))}
    </section>
    ${kartuPasang()}

    <h2 class="judul-bagian">${T('Akun')}</h2>
    <section class="kartu kartu-akun">
      <div class="baris">
        <span class="ikon-bulat">👤</span>
        <span class="isi"><b>${esc(namaPendek(d.user))}</b><small>${esc(d.user)}</small></span>
      </div>
      <button type="button" class="btn btn-keluar" data-aksi="keluar">${T('Keluar dari akun')}</button>
      <p class="info-kecil">${T('Data yang tersimpan di HP ini ikut dihapus saat keluar. Data di Google Drive tetap aman.')}</p>
    </section>
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

/** Link undangan + nama pengundang (untuk sambutan "Sari mengajak Anda…" di layar masuk). */
const linkUndanganDari = link => link + (/[&#]dari=/.test(link) ? '' : '&dari=' + encodeURIComponent(namaPendek(S.data.user)));
/** Pesan WhatsApp siap kirim: ajakan + tagline + link undangan. */
const pesanUndangan = link => T('Yuk catat keuangan keluarga bareng di Dompet Keluarga, biar angka kita selalu sama. Uang keluarga akur, sampai gajian berikutnya. Buka link ini lalu masuk dengan akun Google yang aku undang: {link}', { link });

function formUndangan(idBuku, link) {
  link = linkUndanganDari(link);
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
      <button type="button" class="btn btn-wa" data-aksi="bagikan-wa-undangan">${T('💬 Kirim lewat WhatsApp')}</button>
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
    ${DEMO.aktif() ? '' : `<span class="label" style="margin-top:16px">${T('Cadangan otomatis')}</span>
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Sebulan sekali, salinan lengkap spreadsheet dibuat otomatis di Google Drive (folder <b>Dompet Keluarga › Cadangan</b>). 3 salinan terakhir disimpan.')}<br>
      <span id="info-cadangan">${teksCadangan(S.data.cadangan)}</span></p>
    <div class="aksi-form"><button type="button" class="btn btn-hapus" style="flex:1" data-aksi="cadangkan-sekarang">${T('Cadangkan sekarang')}</button></div>`}
    <span class="label" style="margin-top:16px">${T('Salah hapus atau salah ubah?')}</span>
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Google Sheets menyimpan riwayat perubahan. Buka spreadsheet di komputer, lalu <b>File → Histori versi → Lihat histori versi</b> untuk melihat atau memulihkan versi sebelumnya.')}</p>
    ${DEMO.aktif() ? '' : `<a class="btn btn-hapus" style="display:block;text-decoration:none;text-align:center" href="${esc(S.data.urlSpreadsheet)}" target="_blank" rel="noopener">${T('Buka spreadsheet')}</a>`}`);
}

/** Keterangan cadangan otomatis terakhir (data CADANGAN di Pengaturan). */
function teksCadangan(c, folder) {
  if (!c || !c.tgl) return T('Belum ada cadangan otomatis.');
  const siapa = c.oleh === S.data.user ? T('Anda') : namaPendek(c.oleh);
  return T('Terakhir: {tgl} oleh {siapa}', { tgl: tanggalPendek(c.tgl), siapa: esc(siapa) })
    + (folder ? ` · <a href="https://drive.google.com/drive/folders/${esc(folder)}" target="_blank" rel="noopener">${T('Buka folder')}</a>` : '');
}

let cadanganDicek = false;
/** Sekali per sesi: kalau cadangan terakhir buku ini sudah ≥ 30 hari, buat salinan baru di latar (diam-diam). */
function cadangkanNanti() {
  if (cadanganDicek || DEMO.aktif() || S.offline || !S.data || S.data.perluSetup) return;
  cadanganDicek = true;
  const c = S.data.cadangan || {};
  const hari = c.tgl ? Math.round((Date.parse(hariIni()) - Date.parse(c.tgl)) / 864e5) : Infinity;
  if (hari < 30) return;
  setTimeout(() => {
    SERVER.cadangkan(false).then(h => { if (!h.dilewati && S.data) S.data.cadangan = { tgl: h.tgl, oleh: h.oleh }; })
      .catch(e => console.warn('Cadangan otomatis gagal:', e));
  }, 15000);
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
