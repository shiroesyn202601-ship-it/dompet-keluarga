// Catatan Keuanganku · Fitur tambahan: pintasan, tarik untuk memperbarui, transaksi dobel, detail, pilih banyak, label, tur, avatar, emas. Memulai aplikasi.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

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


// =====================================================================
// Detail transaksi, transaksi mirip, pilih banyak, label, kalender, tur
// =====================================================================

/** Cari transaksi dari semua data yang sedang dimuat (periode, filter lintas bulan, pencarian, label). */
function cariTrxId(id) {
  return S.data.transaksi.concat((S.cariData && S.cariData.transaksi) || [], S.hasilGlobal || [], semuaTrxCari || [])
    .find(t => t.id === id);
}

// ---------- 1. Peringatan transaksi mirip (dobel) ----------

/**
 * Transaksi lain di TANGGAL YANG SAMA dengan tipe, nominal, kategori (atau dompet asal-tujuan) sama: kemungkinan
 * tercatat dua kali. Transaksi serupa di hari-hari sebelumnya wajar (jajan rutin), jadi tidak diperingatkan.
 */
function trxMirip(f) {
  const tgl = f.tanggal || hariIni();
  return S.data.transaksi.find(t => t.id !== f.id && t.tanggal === tgl && t.tipe === f.tipe && t.jumlah === f.jumlah
    && (f.tipe === TIPE.TRANSFER ? t.dompet === f.dompet && t.dompetTujuan === f.dompetTujuan : t.kategori === f.kategori)) || null;
}

function htmlMirip(m) {
  const info = infoTrx(m);
  const siapa = m.oleh && m.oleh !== S.data.user ? namaPendek(m.oleh) : T('Anda');
  return `<div class="peringatan-mirip" role="alert">
    <span class="ikon-bulat">${ilus(info.ikon)}</span>
    <span class="isi"><b>${T('Sudah ada catatan {nama} yang sama di tanggal ini', { nama: esc(siapa) })}</b>
      <small>${esc(info.judul)} ${rp(m.jumlah)}${m.catatan ? ' · ' + esc(m.catatan) : ''}</small>
      <small>${T('Kalau memang transaksi yang berbeda, ketuk <b>Tetap simpan</b>.')}</small></span>
  </div>`;
}

// ---------- 2. Halaman detail transaksi ----------

let trxDetail = null;

/** #lebaran di catatan ditebalkan. */
function catatanBerlabel(teks) {
  return esc(teks).replace(/#([\p{L}\p{N}_-]{2,30})/gu, '<b class="label-trx">#$1</b>');
}

function bukaDetailTrx(t) {
  if (!t) return;
  trxDetail = t;
  F = null;
  const info = infoTrx(t);
  const baris = (label, nilai) => nilai ? `<div class="baris-detail"><span>${label}</span><b>${nilai}</b></div>` : '';
  const riwayat = (S.data.log || []).filter(x => x.idTrx === t.id);
  const foto = t.lampiran ? fotoLampiranHp(t.lampiran, t.id) : '';
  bukaSheet(T('Detail transaksi'), `
    <div class="detail-trx">
      <div class="detail-kepala">
        <span class="ikon-bulat besar">${ilus(info.ikon)}</span>
        <b class="detail-judul">${esc(info.judul)}</b>
        <div class="detail-nominal ${info.kelas}">${info.tanda}${rp(t.jumlah)}</div>
        ${t.catatan ? `<p class="detail-catatan">${catatanBerlabel(t.catatan)}</p>` : ''}
      </div>
      ${t.lampiran ? `<button type="button" class="detail-foto" data-aksi="lihat-foto-trx" data-id="${esc(t.id)}" aria-label="${T('Lihat foto struk')}">
        ${foto ? `<img src="${foto}" alt="">` : `<span class="muat-foto-kecil" id="detail-foto-muat">${T('Memuat foto…')}</span>`}
      </button>` : ''}
      <div class="kartu-detail">
        ${baris(T('Tanggal'), esc(keTanggal(t.tanggal).toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))}
        ${t.tipe === TIPE.TRANSFER
          ? baris(T('Dari → ke'), esc(namaT(t.dompet) + ' → ' + namaT(t.dompetTujuan)))
          : baris(T('Kategori'), esc(namaT(t.kategori))) + baris(T('Dompet'), esc(namaT(t.dompet)))}
        ${baris(T('Dicatat oleh'), esc(t.oleh ? (t.oleh === S.data.user ? T('Anda') : namaPendek(t.oleh)) : ''))}
        ${baris(T('Dicatat pada'), esc(t.dibuat ? waktuRelatif(t.dibuat) : ''))}
      </div>
      ${riwayat.length ? `<h4 class="judul-kecil">${T('Riwayat perubahan')}</h4>
        <div class="daftar-aktivitas">${riwayat.map(x => `
          <div class="baris-aktivitas ${x.aksi}">
            <span class="ikon-aksi">${ikonAksi[x.aksi] || '•'}</span>
            <span class="isi">${htmlAvatar(x.oleh, 'mini')} <b>${esc(x.oleh === S.data.user ? T('Anda') : namaPendek(x.oleh))}</b> ${kataAksi[x.aksi] || esc(x.aksi)}
              <small>${esc(x.ringkasan)}</small></span>
            <small class="waktu">${esc(waktuRelatif(x.waktu))}</small>
          </div>`).join('')}</div>` : ''}
      <div class="aksi-detail">
        <button type="button" class="btn btn-hapus" data-aksi="hapus-trx-detail">${T('Hapus')}</button>
        <button type="button" class="btn btn-kedua" data-aksi="duplikat-trx">${T('Duplikat')}</button>
        <button type="button" class="btn btn-utama" data-aksi="ubah-trx-detail">${T('Ubah')}</button>
      </div>
    </div>`);
  if (t.lampiran && !foto) {
    muatFotoLampiran(t.lampiran).then(url => {
      const el = $('#detail-foto-muat');
      if (el && trxDetail === t) el.outerHTML = `<img src="${url}" alt="">`;
    }, () => {
      const el = $('#detail-foto-muat');
      if (el) el.textContent = T('📎 Ketuk untuk membuka foto di Google Drive');
    });
  }
}

// ---------- 5. Pilih banyak di Riwayat ----------

let abaikanKlikSampai = 0;
document.addEventListener('click', e => {
  if (Date.now() < abaikanKlikSampai) { e.stopPropagation(); e.preventDefault(); }
}, true);

function mulaiPilih(id) {
  if (S.tab !== 'riwayat' || S.pilih) return;
  S.pilih = new Set([id]);
  getar();
  render();
}

function trxDipilih() {
  return Array.from(S.pilih || []).map(cariTrxId).filter(Boolean);
}

function barPilih() {
  if (!S.pilih) return '';
  const daftar = trxDipilih();
  const keluar = total(daftar, TIPE.KELUAR), masuk = total(daftar, TIPE.MASUK);
  return `<div class="bar-pilih" role="toolbar" aria-label="${T('Transaksi terpilih')}">
    <div class="atas-pilih">
      <button type="button" class="tombol-ikon" data-aksi="batal-pilih" aria-label="${T('Batal memilih')}">✕</button>
      <span class="isi"><b>${T('{n} dipilih', { n: daftar.length })}</b><small>${[keluar ? '−' + rp(keluar) : '', masuk ? '+' + rp(masuk) : ''].filter(Boolean).join(' · ')}</small></span>
      <button type="button" class="tombol-teks" data-aksi="pilih-semua">${T('Pilih semua')}</button>
    </div>
    <div class="tombol-pilih">
      <button type="button" data-aksi="pilih-kategori-banyak" ${daftar.length ? '' : 'disabled'}>🏷️ ${T('Kategori')}</button>
      <button type="button" data-aksi="pilih-dompet-banyak" ${daftar.length ? '' : 'disabled'}>👛 ${T('Dompet')}</button>
      <button type="button" class="hapus" data-aksi="hapus-banyak" ${daftar.length ? '' : 'disabled'}>🗑 ${T('Hapus')}</button>
    </div>
  </div>`;
}

let trxTerhapusBanyak = null;

// ---------- 6. Label / acara (#lebaran di catatan) ----------

const POLA_LABEL = /#([\p{L}\p{N}_-]{2,30})/gu;
function labelDari(teks) {
  return Array.from(new Set([...String(teks || '').matchAll(POLA_LABEL)].map(m => m[1].toLowerCase())));
}

/** Label yang pernah dipakai, terbaru dulu (untuk chip di form). */
function labelTerakhir() {
  const urut = [];
  (semuaTrxCari || S.data.transaksi).forEach(t => labelDari(t.catatan).forEach(l => { if (!urut.includes(l)) urut.push(l); }));
  return urut;
}

function chipLabelForm() {
  const ada = labelDari(F.catatan);
  const daftar = labelTerakhir().filter(l => !ada.includes(l)).slice(0, 6);
  return `<div class="chips chip-label">${daftar.map(l =>
    `<button type="button" class="chip" data-aksi="tambah-label" data-label="${esc(l)}">#${esc(l)}</button>`).join('')}
    <button type="button" class="chip chip-label-baru" data-aksi="tambah-label" data-label="">＃ ${T('Label')}</button></div>`;
}

/** Ringkasan semua label dari semua transaksi: [{ label, keluar, masuk, n, awal, akhir, trx }] terbaru dulu. */
function ringkasLabel(semua) {
  const grup = {};
  semua.forEach(t => labelDari(t.catatan).forEach(l => {
    const g = grup[l] || (grup[l] = { label: l, keluar: 0, masuk: 0, n: 0, awal: t.tanggal, akhir: t.tanggal, trx: [] });
    if (t.tipe === TIPE.KELUAR) g.keluar += t.jumlah;
    if (t.tipe === TIPE.MASUK) g.masuk += t.jumlah;
    g.n++;
    g.trx.push(t);
    if (t.tanggal < g.awal) g.awal = t.tanggal;
    if (t.tanggal > g.akhir) g.akhir = t.tanggal;
  }));
  return Object.values(grup).sort((a, b) => b.akhir.localeCompare(a.akhir));
}

function meterLabel(g) {
  const batas = (S.data.anggaranLabel || {})[g.label];
  if (!batas) return '';
  const s = statusAnggaran(g.keluar, batas);
  return `<div class="meter-label ${s.kelas}"><div class="bar"><i style="width:${Math.min(100, g.keluar / batas * 100)}%"></i></div>
    <small>${s.teks} · ${T('anggaran {jumlah}', { jumlah: rp(batas) })}</small></div>`;
}

async function bukaLabel() {
  bukaSheet(T('Label & acara'), KERANGKA_DAFTAR);
  if (!semuaTrxCari) {
    try { semuaTrxCari = await api('cariTransaksi', '', ''); } catch (e) { /* offline: periode ini saja */ }
  }
  if ($('#sheet-judul').textContent !== T('Label & acara')) return;
  const daftar = ringkasLabel(semuaTrxCari || S.data.transaksi);
  const rentang = g => g.awal === g.akhir ? tanggalPendek(g.awal) : tanggalPendek(g.awal) + ' – ' + tanggalPendek(g.akhir);
  $('#sheet-isi').innerHTML = `
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Tulis <b>#label</b> di catatan transaksi untuk mengumpulkan pengeluaran lintas kategori, mis. <b>#lebaran</b>, <b>#liburanbali</b>, <b>#renovasi</b>.')}</p>
    ${daftar.length ? `<div class="daftar-label">${daftar.map(g => `
      <button type="button" class="item-label" data-aksi="buka-satu-label" data-label="${esc(g.label)}">
        <span class="isi"><b>#${esc(g.label)}</b><small>${T('{n} transaksi', { n: g.n })} · ${esc(rentang(g))}</small>${meterLabel(g)}</span>
        <span class="nominal keluar">${rp(g.keluar)}</span>
      </button>`).join('')}</div>`
    : kosong('🏷️', T('Belum ada label. Coba tulis "Tiket kereta #mudik" di catatan transaksi.'))}
    ${!semuaTrxCari ? `<p class="info-kecil">${T('Offline: hanya dari periode ini.')}</p>` : ''}`;
}

function bukaSatuLabel(label) {
  const g = ringkasLabel(semuaTrxCari || S.data.transaksi).find(x => x.label === label);
  if (!g) return bukaLabel();
  const perKategori = {};
  g.trx.filter(t => t.tipe === TIPE.KELUAR).forEach(t => { perKategori[t.kategori] = (perKategori[t.kategori] || 0) + t.jumlah; });
  const urut = Object.keys(perKategori).map(n => ({ ikon: ikonKategori(n, TIPE.KELUAR), nama: namaT(n), nilai: perKategori[n] })).sort((a, b) => b.nilai - a.nilai);
  const batas = (S.data.anggaranLabel || {})[label] || 0;
  bukaSheet('#' + label, `
    <button type="button" class="tombol-teks" style="padding-left:0;margin-top:-6px" data-aksi="buka-label">${svg('kembali')} ${T('Semua label')}</button>
    <div class="kpi" style="margin:6px 0 12px">
      <div class="tile"><small>${T('Pengeluaran')}</small><b>${rp(g.keluar)}</b><span>${T('{n} transaksi', { n: g.n })}</span></div>
      ${g.masuk ? `<div class="tile"><small>${T('Pemasukan')}</small><b>${rp(g.masuk)}</b></div>` : ''}
    </div>
    ${meterLabel(g)}
    <div class="grup-form" style="margin-top:12px">
      <label class="label" for="anggaran-label">${T('Anggaran untuk #{label} (opsional)', { label: esc(label) })}</label>
      <div style="display:flex;gap:8px">
        <input class="field input-rp" id="anggaran-label" inputmode="numeric" placeholder="${T('mis. 5.000.000')}" value="${batas ? formatAngka(batas) : ''}">
        <button type="button" class="btn btn-utama" style="flex:none" data-aksi="simpan-anggaran-label" data-label="${esc(label)}">${T('Simpan')}</button>
      </div>
    </div>
    ${urut.length > 1 ? `<h4 class="judul-kecil">${T('Per kategori')}</h4><section class="kartu" style="padding:8px 14px">${barBerperingkat(urut, g.keluar)}</section>` : ''}
    <h4 class="judul-kecil">${T('Transaksi')}</h4>
    <section class="kartu" style="padding:4px 14px">${g.trx.map(itemTrx).join('')}</section>`);
}

// ---------- 7. Kalender di Riwayat ----------

function htmlKalenderRiwayat(trx) {
  const r = SERVER.rentangPeriode(S.bulan, S.data.mulaiPeriode || 1);
  const hari = [];
  for (let d = keTanggal(r.awal); tanggalIso(d) <= r.akhir; d.setDate(d.getDate() + 1)) hari.push(tanggalIso(d));
  const keluar = {}, masuk = {};
  trx.forEach(t => {
    if (t.tipe === TIPE.KELUAR) keluar[t.tanggal] = (keluar[t.tanggal] || 0) + t.jumlah;
    if (t.tipe === TIPE.MASUK) masuk[t.tanggal] = (masuk[t.tanggal] || 0) + t.jumlah;
  });
  const maks = Math.max(1, ...Object.values(keluar));
  const pilih = S.hariKalender && hari.includes(S.hariKalender) ? S.hariKalender : (hari.includes(hariIni()) ? hariIni() : '');
  const kosongAwal = (keTanggal(hari[0]).getDay() + 6) % 7; // Senin = kolom pertama
  const sel = tgl => {
    const k = keluar[tgl] || 0;
    const tingkat = k ? Math.min(4, 1 + Math.floor(k / maks * 3.999)) : 0;
    return `<button type="button" class="hari-kal t${tingkat} ${tgl === pilih ? 'pilih' : ''} ${tgl === hariIni() ? 'ini' : ''} ${tgl > hariIni() ? 'nanti' : ''}"
      data-aksi="pilih-hari-kal" data-tgl="${tgl}" aria-label="${esc(labelTanggal(tgl))}${k ? ': ' + rp(k) : ''}">
      <span>${+tgl.slice(8)}</span>${k ? `<small>${rpPendek(k)}</small>` : masuk[tgl] ? '<i class="titik-masuk"></i>' : ''}</button>`;
  };
  const daftarHari = pilih ? trx.filter(t => t.tanggal === pilih) : [];
  return `<section class="kartu kalender-riwayat">
      <div class="kal-hari">${NAMA_HARI_PENDEK.map(h => `<span>${h}</span>`).join('')}</div>
      <div class="kal-grid">${'<span></span>'.repeat(kosongAwal)}${hari.map(sel).join('')}</div>
      <div class="kal-legenda"><span>${T('Hemat')}</span><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i><span>${T('Boros')}</span></div>
    </section>
    ${pilih ? `<div class="grup-tanggal"><span>${esc(labelTanggal(pilih))}</span><span>${daftarHari.length ? rp(total(daftarHari, TIPE.MASUK) - total(daftarHari, TIPE.KELUAR)) : ''}</span></div>
      <section class="kartu daftar-hari-kal" style="padding:4px 16px">${daftarHari.length ? daftarHari.map(itemTrx).join('') : kosong('🌤️', T('Tidak ada transaksi di hari ini.'))}</section>` : ''}`;
}

// ---------- 8. Perbandingan dengan periode lalu di hari yang sama ----------

function barisPembanding() {
  const p = S.data.pembanding;
  if (!p || !p.lalu || S.bulan !== S.data.bulan) return '';
  const persen = Math.round((p.ini - p.lalu) / p.lalu * 100);
  const isi = { hari: p.hariKe, persen: Math.abs(persen), ini: rp(p.ini), lalu: rp(p.lalu) };
  const teks = persen <= -3 ? T('📉 Sampai hari ke-{hari}, pengeluaran <b>{persen}% lebih hemat</b> dari periode lalu ({ini} vs {lalu})', isi)
    : persen >= 3 ? T('📈 Sampai hari ke-{hari}, pengeluaran <b>{persen}% lebih banyak</b> dari periode lalu ({ini} vs {lalu})', isi)
    : T('⚖️ Sampai hari ke-{hari}, pengeluaran mirip periode lalu ({ini} vs {lalu})', isi);
  return `<div class="baris-banding ${persen <= -3 ? 'hemat' : persen >= 3 ? 'boros' : ''}">${teks}</div>`;
}

// ---------- 9. Tur singkat untuk anggota baru ----------

const SLIDE_TUR = [
  ['✍️', T('Catat dalam hitungan detik'), T('Ketuk ＋ untuk mencatat. Transaksi yang sering diulang muncul sebagai tombol sekali ketuk di Beranda.')],
  ['🎙️', T('Cukup ucapkan'), T('Ketuk ikon mic di form, lalu bicara, mis. "beli bensin 30 ribu pakai tunai kemarin". Bisa beberapa transaksi sekaligus.')],
  ['🧾', T('Foto struknya'), T('Foto struk belanja atau bukti transfer: nominal & kategori terisi otomatis, fotonya ikut tersimpan sebagai lampiran.')],
  ['👆', T('Geser & tekan lama'), T('Di Riwayat: geser kiri untuk hapus, geser kanan untuk catat lagi, tekan lama untuk memilih banyak transaksi sekaligus.')],
];
let tur = null;

function bukaTur() {
  tur = { i: 0 };
  let el = $('#tur');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tur';
    el.className = 'tur';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
  }
  el.hidden = false;
  gambarTur();
}

function gambarTur() {
  const el = $('#tur');
  if (!el || !tur) return;
  const [ikon, judul, teks] = SLIDE_TUR[tur.i];
  const akhir = tur.i === SLIDE_TUR.length - 1;
  el.setAttribute('aria-label', judul);
  el.innerHTML = `<div class="kartu-tur" style="--i:${tur.i}">
    <div class="ilus-tur">${ikon}</div>
    <h2>${judul}</h2>
    <p>${teks}</p>
    <div class="titik-tur">${SLIDE_TUR.map((_, i) => `<i class="${i === tur.i ? 'aktif' : ''}"></i>`).join('')}</div>
    <div class="aksi-tur">
      ${akhir ? '<span></span>' : `<button type="button" class="tombol-teks" data-aksi="tur-tutup">${T('Lewati')}</button>`}
      <button type="button" class="btn btn-utama" data-aksi="${akhir ? 'tur-tutup' : 'tur-lanjut'}">${akhir ? T('Mulai pakai') : T('Lanjut')}</button>
    </div>
  </div>`;
  setTimeout(() => { const b = el.querySelector('.btn-utama'); if (b) b.focus(); }, 50);
}

function tutupTur() {
  const el = $('#tur');
  if (!el || el.hidden) return false;
  el.hidden = true;
  tur = null;
  tulisHp('dk_tur_tunda', null);
  return true;
}

/** Dipanggil setelah data tampil: tur ditunda sampai setup/gabung selesai. */
function cekTur() {
  if (bacaHp('dk_tur_tunda') && S.data && !S.data.perluSetup && $('#sheet').hidden && !tur) setTimeout(bukaTur, 600);
}

Object.assign(AKSI, {
  'lihat-foto-trx': el => {
    const t = cariTrxId(el.dataset.id) || trxDetail;
    if (t && t.lampiran) lihatLampiranDrive(t.lampiran, t.id);
  },
  'ubah-trx-detail': () => { const t = trxDetail; if (t) bukaFormTrx(t); },
  'duplikat-trx': () => {
    const t = trxDetail;
    if (!t) return;
    bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet, dompetTujuan: t.dompetTujuan,
      catatan: t.catatan, tanggal: hariIni() }, T('Duplikat transaksi'));
  },
  'hapus-trx-detail': el => {
    const t = trxDetail;
    if (!t) return;
    kirim(el, 'hapusTransaksi', [t.id], baris => {
      trxTerhapus = baris;
      toast(T('Transaksi dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-hapus' });
    });
  },
  'filter-lampiran': () => { S.filter = Object.assign({}, S.filter, { lampiran: !S.filter.lampiran }); render(); },
  'batal-pilih': () => { S.pilih = null; render(); },
  'pilih-semua': () => {
    const semua = (S.trxTampil || []).map(t => t.id);
    S.pilih = semua.every(id => S.pilih.has(id)) ? new Set() : new Set(semua);
    render();
  },
  'pilih-kategori-banyak': () => {
    const daftar = trxDipilih();
    const tipe = Array.from(new Set(daftar.map(t => t.tipe)));
    if (tipe.length !== 1 || tipe[0] === TIPE.TRANSFER) return toast(T('Ganti kategori hanya untuk transaksi bertipe sama (semua pengeluaran atau semua pemasukan).'), true);
    bukaSheet(T('Ganti kategori {n} transaksi', { n: daftar.length }), `<div class="grid-pilih">${S.data.kategori.filter(k => k.tipe === tipe[0]).map(k =>
      `<button type="button" class="pilihan" data-aksi="terapkan-banyak" data-k="kategori" data-nama="${esc(k.nama)}"><span>${ilus(k.ikon)}</span>${esc(namaT(k.nama))}</button>`).join('')}</div>`);
  },
  'pilih-dompet-banyak': () => {
    const daftar = trxDipilih();
    if (daftar.some(trxEmas)) return toast(T('Transaksi emas tidak bisa dipindah dompetnya. Lepas pilihan transaksi emas dulu.'), true);
    bukaSheet(T('Ganti dompet {n} transaksi', { n: daftar.length }), `
      ${daftar.some(t => t.tipe === TIPE.TRANSFER) ? `<p class="info-kecil" style="text-align:left;margin-top:0">${T('Untuk transfer, yang diganti dompet asalnya.')}</p>` : ''}
      <div class="grid-pilih">${dompetBiasa().map(w =>
        `<button type="button" class="pilihan" data-aksi="terapkan-banyak" data-k="dompet" data-nama="${esc(w.nama)}"><span>${ilus(w.ikon)}</span>${esc(namaT(w.nama))}</button>`).join('')}</div>`);
  },
  'terapkan-banyak': el => {
    const ids = Array.from(S.pilih || []);
    if (!ids.length) return tutupSheet();
    kirim(el, 'ubahBanyak', [ids, { [el.dataset.k]: el.dataset.nama }], n => {
      S.pilih = null;
      render();
      toast(T('{n} transaksi diperbarui ✔', { n }));
    });
  },
  'hapus-banyak': el => {
    const ids = Array.from(S.pilih || []);
    if (!ids.length) return;
    kirim(el, 'hapusBanyak', [ids], baris => {
      trxTerhapusBanyak = baris;
      S.pilih = null;
      render();
      toast(T('{n} transaksi dihapus', { n: baris.length }), false, { label: T('Urungkan'), aksi: 'urungkan-hapus-banyak' });
    });
  },
  'urungkan-hapus-banyak': el => {
    const baris = trxTerhapusBanyak;
    trxTerhapusBanyak = null;
    $('#toast').hidden = true;
    if (baris) kirim(el, 'kembalikanBanyak', [baris], T('Transaksi dikembalikan'));
  },
  'tambah-label': el => {
    bacaFieldTrx();
    let l = el.dataset.label;
    const input = $('#f-catatan');
    if (!l) {
      F.catatan = (F.catatan ? F.catatan.trimEnd() + ' ' : '') + '#';
      renderFormTrx();
      const i = $('#f-catatan');
      if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      return;
    }
    if (input) F.catatan = (F.catatan ? F.catatan.trimEnd() + ' ' : '') + '#' + l;
    renderFormTrx();
  },
  'buka-label': () => bukaLabel(),
  'buka-satu-label': el => bukaSatuLabel(el.dataset.label),
  'simpan-anggaran-label': el => {
    const label = el.dataset.label;
    kirim(el, 'simpanAnggaranLabel', [label, angka($('#anggaran-label').value)], T('Anggaran #{label} tersimpan ✔', { label }))
      .then(ok => { if (ok) bukaSatuLabel(label); });
  },
  'mode-riwayat': () => { S.modeRiwayat = S.modeRiwayat === 'kalender' ? 'daftar' : 'kalender'; tulisHp('dk_mode_riwayat', S.modeRiwayat); render(); },
  'pilih-hari-kal': el => { S.hariKalender = el.dataset.tgl; render(); },
  'tur': () => bukaTur(),
  'tips': () => bukaTips(),
  'tur-lanjut': () => { if (tur) { tur.i = Math.min(SLIDE_TUR.length - 1, tur.i + 1); gambarTur(); } },
  'tur-tutup': () => tutupTur(),
});

// Tekan lama (atau klik kanan di komputer) pada transaksi di Riwayat = mulai memilih banyak.
document.addEventListener('contextmenu', e => {
  const kotak = e.target.closest && e.target.closest('.trx-geser');
  if (!kotak || S.tab !== 'riwayat') return;
  e.preventDefault();
  if (e.pointerType === 'mouse' || !('ontouchstart' in window)) mulaiPilih(kotak.querySelector('.trx').dataset.id);
});

// ---------- Avatar: pilihan gambar bawaan atau foto sendiri ----------
// Disimpan di sheet Pengaturan buku ini (kunci "AVATAR:<email>"), jadi ikut ke HP lain & terlihat oleh anggota keluarga.
// Tanpa avatar: huruf pertama nama seperti sebelumnya.

/** Gambar bawaan per kelompok: [id (huruf a–z saja), emoji, warna latar]. */
const KELOMPOK_AVATAR = [
  [T('Orang'), [
    ['wanita', '👩', '#e11d48'], ['pria', '👨', '#0284c7'], ['hijab', '🧕', '#059669'], ['sorban', '👳‍♂️', '#0f766e'],
    ['jenggot', '🧔', '#92400e'], ['keritingwanita', '👩‍🦱', '#c026d3'], ['keritingpria', '👨‍🦱', '#4338ca'], ['pirang', '👱‍♀️', '#d97706'],
    ['nenek', '👵', '#9333ea'], ['kakek', '👴', '#4f46e5'], ['anak', '🧒', '#f59e0b'], ['anakperempuan', '👧', '#ec4899'],
    ['bayi', '👶', '#f472b6'], ['pelajar', '🧑‍🎓', '#1d4ed8'], ['guru', '🧑‍🏫', '#16a34a'], ['dokter', '🧑‍⚕️', '#0891b2'],
    ['koki', '🧑‍🍳', '#dc2626'], ['petani', '🧑‍🌾', '#65a30d'], ['kantor', '🧑‍💼', '#334155'], ['teknisi', '🧑‍🔧', '#ea580c'],
    ['programmer', '🧑‍💻', '#6366f1'], ['seniman', '🧑‍🎨', '#db2777'], ['polisi', '👮', '#1e40af'], ['pilot', '🧑‍✈️', '#0369a1'],
  ]],
  [T('Ekspresi'), [
    ['senyum', '😊', '#f59e0b'], ['keren', '😎', '#0ea5e9'], ['kutubuku', '🤓', '#8b5cf6'],
    ['malaikat', '😇', '#38bdf8'], ['sayang', '🥰', '#f43f5e'], ['peluk', '🤗', '#f97316'],
  ]],
  [T('Hewan'), [
    ['kucing', '🐱', '#f59e0b'], ['anjing', '🐶', '#b45309'], ['rubah', '🦊', '#ea580c'], ['panda', '🐼', '#475569'],
    ['koala', '🐨', '#64748b'], ['singa', '🦁', '#d97706'], ['harimau', '🐯', '#f97316'], ['kelinci', '🐰', '#ec4899'],
    ['beruang', '🐻', '#92400e'], ['beruangkutub', '🐻‍❄️', '#0284c7'], ['penguin', '🐧', '#0ea5e9'], ['burunghantu', '🦉', '#7c3aed'],
    ['monyet', '🐵', '#a16207'], ['katak', '🐸', '#16a34a'], ['anakayam', '🐥', '#eab308'], ['sapi', '🐮', '#57534e'],
    ['hamster', '🐹', '#c2410c'], ['serigala', '🐺', '#475569'],
  ]],
];
const AVATAR_BAWAAN = KELOMPOK_AVATAR.flatMap(k => k[1]);
const avatarDari = email => ((S.data && S.data.avatar) || {})[email] || null;

/** Avatar seseorang (foto / gambar bawaan / huruf pertama). kelas: '' | 'besar' | 'mini'. */
function htmlAvatar(email, kelas = '') {
  const a = avatarDari(email);
  if (a && a.f && /^data:image\//.test(a.f)) return `<span class="avatar avatar-foto ${kelas}" aria-hidden="true"><img src="${esc(a.f)}" alt=""></span>`;
  const b = a && a.p && AVATAR_BAWAAN.find(x => x[0] === a.p);
  if (b) return `<span class="avatar avatar-emoji ${kelas}" style="--av:${b[2]}" aria-hidden="true">${b[1]}</span>`;
  return `<span class="avatar ${kelas}" aria-hidden="true">${esc(namaPendek(email).charAt(0))}</span>`;
}

function htmlPilihAvatar() {
  const a = avatarDari(S.data.user);
  return `<div class="avatar-pratinjau">${htmlAvatar(S.data.user, 'besar')}
      <div><b>${esc(namaPendek(S.data.user))}</b><small>${T('Terlihat juga oleh anggota keluarga di buku ini.')}</small></div></div>
    <div class="aksi-form" style="margin:0 0 16px">
      <label class="btn btn-kedua tombol-unggah-avatar">${T('📷 Unggah foto')}<input type="file" id="avatar-file" accept="image/*" hidden></label>
      ${a ? `<button type="button" class="btn btn-hapus" data-aksi="avatar-reset">${T('Pakai inisial')}</button>` : ''}
    </div>
    ${KELOMPOK_AVATAR.map(([judul, daftar]) => `<span class="label label-avatar">${judul}</span>
    <div class="grid-avatar">${daftar.map(([id, e, w]) => `<button type="button" class="${a && a.p === id ? 'aktif' : ''}" data-aksi="avatar-pilih" data-id="${id}"
      style="--av:${w}" aria-pressed="${!!(a && a.p === id)}" aria-label="${e}"><span aria-hidden="true">${e}</span></button>`).join('')}</div>`).join('')}`;
}
function bukaGantiAvatar() {
  bukaSheet(T('Ganti avatar'), `<div id="isi-avatar">${htmlPilihAvatar()}</div>`);
}

/** Foto → persegi tengah, diperkecil sampai muat di satu sel spreadsheet (≤ 40.000 karakter). */
function fotoAvatar(file) {
  return new Promise((ok, gagal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error(T('Gambar tidak bisa dibuka. Coba foto lain (format JPG/PNG).'))); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
      const c = document.createElement('canvas');
      let hasil = '';
      for (const [sisi, mutu] of [[192, 0.85], [160, 0.8], [128, 0.75], [96, 0.7]]) {
        c.width = c.height = sisi;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, sisi, sisi);
        g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, sisi, sisi);
        hasil = c.toDataURL('image/jpeg', mutu);
        if (hasil.length <= 40000) break;
      }
      ok(hasil);
    };
    img.src = url;
  });
}

/** nilai: { p: id gambar bawaan } | { f: data URL foto } | null (kembali ke huruf pertama). */
async function simpanAvatar(nilai) {
  if (S.offline || !navigator.onLine) return toast(T('Butuh sinyal untuk mengganti avatar.'), true);
  loading(true);
  try {
    await api('simpanAvatar', nilai);
    const semua = Object.assign({}, S.data.avatar);
    if (nilai) semua[S.data.user] = nilai; else delete semua[S.data.user];
    S.data.avatar = semua;
    tulisLokal('data', S.data);
    getarHalus([12]);
    toast(T('Avatar diganti ✔'));
    if ($('#isi-avatar')) $('#isi-avatar').innerHTML = htmlPilihAvatar();
    render();
  } catch (e) {
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
  } finally {
    loading(false);
  }
}

Object.assign(AKSI, {
  'ganti-avatar': () => bukaGantiAvatar(),
  'avatar-pilih': el => simpanAvatar({ p: el.dataset.id }),
  'avatar-reset': () => simpanAvatar(null),
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'avatar-file' || !e.target.files || !e.target.files[0]) return;
  const file = e.target.files[0];
  e.target.value = '';
  try {
    await simpanAvatar({ f: await fotoAvatar(file) });
  } catch (err) {
    toast(pesanError(err), true);
  }
});

// ---------- Emas: berat (gram) + platform, nilainya dari harga hari ini ----------
// Harga per gram diambil dari logam-mulia-api (github.com/iamutaki/logam-mulia-api, publik & gratis) sekali sehari, lalu
// disimpan di HP dan di spreadsheet (Pengaturan HARGA_EMAS, dipakai bersama keluarga; bot juga memperbaruinya tiap pagi).
// Kalau sudah ada yang mengambil hari ini, aplikasi tidak menghubungi sumber harga lagi. Kalau sumbernya mati, harga
// terakhir tetap dipakai (dengan tanggalnya); platform "Lainnya" (atau yang belum tersedia) memakai harga yang diisi sendiri.
// Istilah dari sisi pengguna: harga BELI = harga saat kita membeli (sellPrice penjual), harga JUAL = buyback (buybackPrice).

const API_HARGA_EMAS = 'https://logam-mulia-api.iamutaki.workers.dev/api/prices/';
/** [id, nama tampil, sumber di API] */
const PLATFORM_EMAS = [
  ['pegadaian', 'Pegadaian', 'pegadaian'], ['bsi', 'BSI', 'bankbsi'], ['antam', 'Antam', 'anekalogam'], ['galeri24', 'Galeri 24', 'galeri24'],
  ['sampoerna', 'Sampoerna Gold', 'sampoernagold'], ['treasury', 'Treasury', 'treasury'], ['pluang', 'Pluang', 'pluang'], ['lainnya', T('Lainnya||platform'), ''],
];
const platformEmas = id => PLATFORM_EMAS.find(p => p[0] === id) || PLATFORM_EMAS[PLATFORM_EMAS.length - 1];
const namaPlatformEmas = id => platformEmas(id)[1];
const infoEmas = w => ((S.data && S.data.emas) || {})[w.nama] || null;
const formatGram = g => T('{gram} gram', { gram: (Number(g) || 0).toLocaleString(LOKAL, { maximumFractionDigits: 4 }) });
const angkaGram = s => { const n = parseFloat(String(s || '').trim().replace(',', '.')); return Number.isFinite(n) ? n : 0; };

const KUNCI_HARGA_EMAS = 'dk_harga_emas_platform';
const kapanDiambil = h => String((h && (h.diambil || h.tgl)) || '');
/** Harga di HP digabung dengan harga bersama di spreadsheet; per platform dipakai yang paling baru diambil. */
function cacheHargaEmas() {
  let c = {};
  try { c = JSON.parse(bacaHp(KUNCI_HARGA_EMAS)) || {}; } catch (e) { /* kosong */ }
  const bersama = (S.data && S.data.hargaEmas) || {};
  Object.keys(bersama).forEach(k => { if (bersama[k] && bersama[k].beli && kapanDiambil(bersama[k]) > kapanDiambil(c[k])) c[k] = bersama[k]; });
  return c;
}
/** Harga per gram untuk satu detail emas: { beli, jual, waktu?, manual? } atau null. */
function hargaEmasUntuk(e) {
  const c = platformEmas(e.platform)[2] ? cacheHargaEmas()[e.platform] : null;
  if (c && c.beli) return c;
  if (e.hargaBeli || e.hargaJual) return { beli: e.hargaBeli || 0, jual: e.hargaJual || 0, manual: true };
  return null;
}
/** Nilai sekarang = berat × harga jual (buyback); kalau buyback tidak ada, pakai harga beli. null = harga belum ada. */
function nilaiDariEmas(e) {
  const h = hargaEmasUntuk(e);
  const perGram = h ? (h.jual || h.beli) : 0;
  return perGram ? Math.round(e.gram * perGram) : null;
}
function nilaiAset(w) {
  const e = infoEmas(w);
  const n = e ? nilaiDariEmas(e) : null;
  return n === null ? w.saldo : n;
}
/** Harga emas per gram untuk zakat: harga beli dari cache (Antam/Pegadaian dulu). */
function hargaEmasAcuan() {
  const c = cacheHargaEmas();
  const x = ['antam', 'pegadaian', 'bsi', 'galeri24'].map(k => c[k]).find(h => h && h.beli);
  return x ? x.beli : 0;
}

let hargaEmasJalan = null;
const hargaEmasDicoba = new Set(); // platform yang sudah dicoba hari ini (gagal pun), supaya tidak mengulang terus
/** Ambil harga hari ini untuk platform-platform ini. paksa = abaikan cache. Hasil: true kalau semuanya berhasil. */
async function muatHargaEmas(ids, paksa) {
  if (hargaEmasJalan) await hargaEmasJalan.catch(() => {});
  const cache = cacheHargaEmas();
  const perlu = Array.from(new Set(ids)).filter(id => platformEmas(id)[2]
    && (paksa || (kapanDiambil(cache[id]) !== hariIni() && !hargaEmasDicoba.has(id + hariIni()))));
  if (!perlu.length || !navigator.onLine) return !perlu.length;
  const baruDiambil = {};
  hargaEmasJalan = Promise.all(perlu.map(async id => {
    hargaEmasDicoba.add(id + hariIni());
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(API_HARGA_EMAS + platformEmas(id)[2], { signal: ctrl.signal });
      const j = await r.json();
      const baris = (j && j.success && Array.isArray(j.data) ? j.data : [])
        .filter(x => x.material === 'gold' && Number(x.sellPrice) > 0 && Number(x.weight) > 0);
      const x = baris.find(b => Number(b.weight) === 1) || baris.sort((a, b) => a.weight - b.weight)[0];
      if (!x) return false;
      const beli = Math.round(x.sellPrice / x.weight), jual = Math.round((Number(x.buybackPrice) || 0) / x.weight);
      if (beli < 300000 || beli > 50000000) return false; // angka tidak masuk akal: abaikan
      const c = cacheHargaEmas();
      c[id] = { beli, jual, tgl: String(x.recordedDate || hariIni()).slice(0, 10), diambil: hariIni(), waktu: Date.now() };
      tulisHp(KUNCI_HARGA_EMAS, JSON.stringify(c));
      baruDiambil[id] = c[id];
      return true;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(t);
    }
  }));
  try { return (await hargaEmasJalan).every(Boolean); } finally {
    hargaEmasJalan = null;
    // Dibagikan ke keluarga lewat spreadsheet (di latar; gagal tidak apa-apa, harga tetap ada di HP ini).
    if (Object.keys(baruDiambil).length && S.data && !S.offline) {
      S.data.hargaEmas = Object.assign({}, S.data.hargaEmas, baruDiambil);
      SERVER.simpanHargaEmas(baruDiambil).catch(e => console.warn('Harga emas tidak tersimpan di spreadsheet:', e));
    }
  }
}
/** Dipanggil saat daftar aset digambar: ambil harga yang belum diperbarui hari ini, lalu gambar ulang. */
function perbaruiHargaEmasNanti() {
  const ids = daftarAset().map(infoEmas).filter(Boolean).map(e => e.platform);
  if (ids.length) {
    setTimeout(async () => {
      const sebelum = JSON.stringify(cacheHargaEmas());
      await muatHargaEmas(ids);
      if (JSON.stringify(cacheHargaEmas()) !== sebelum && S.tab === 'dompet' && $('#sheet').hidden) render();
    }, 50);
  }
  return '';
}

function keteranganHargaEmas(h, platform) {
  if (!h) return T('Harga {platform} belum tersedia.', { platform: namaPlatformEmas(platform) });
  if (h.manual) return T('Harga diisi sendiri');
  const kapan = h.tgl === hariIni() ? T('hari ini') : tanggalPendek(h.tgl);
  return T('Harga {platform} {kapan}', { platform: namaPlatformEmas(platform), kapan });
}

function htmlFormEmas() {
  const e = F.emas;
  return `<div class="grup-form">
      <span class="label">${T('Jenis aset')}</span>
      <div class="chips"><button type="button" class="chip ${F.modeEmas ? 'aktif' : ''}" data-aksi="jenis-aset" data-v="emas">${T('🪙 Emas')}</button>
        <button type="button" class="chip ${F.modeEmas ? '' : 'aktif'}" data-aksi="jenis-aset" data-v="lain">${T('💎 Aset lain')}</button></div>
    </div>
    <div id="d-emas" ${F.modeEmas ? '' : 'hidden'}>
      <div class="grup-form">
        <span class="label">${T('Platform')}</span>
        <div class="chips" style="flex-wrap:wrap">${PLATFORM_EMAS.map(([id, nama]) => `<button type="button" class="chip ${e.platform === id ? 'aktif' : ''}" data-aksi="emas-platform" data-v="${id}">${esc(nama)}</button>`).join('')}</div>
      </div>
      <div class="grup-form">
        <label class="label" for="d-gram">${T('Berat (gram)')}</label>
        <input class="field" id="d-gram" inputmode="decimal" autocomplete="off" placeholder="${T('mis. 5,25')}" value="${e.gram ? String(e.gram).replace('.', ',') : ''}">
      </div>
      <div id="d-harga-emas">${htmlHargaFormEmas()}</div>
      <div class="grup-form">
        <label class="label" for="d-modal">${T('Total modal (opsional)')}</label>
        <input class="field input-rp" id="d-modal" inputmode="numeric" placeholder="0" value="${formatAngka(e.modal)}">
        <p class="info-kecil" style="text-align:left">${T('Total uang yang sudah dipakai untuk membeli emas ini, supaya untung/ruginya terlihat.')}</p>
      </div>
    </div>`;
}
/** Bagian harga di form: harga hari ini dari platform, atau isian harga sendiri kalau belum tersedia / platform Lainnya. */
function htmlHargaFormEmas(memuat) {
  const e = Object.assign({}, F.emas, { hargaBeli: 0, hargaJual: 0 });
  const h = platformEmas(e.platform)[2] ? hargaEmasUntuk(e) : null;
  if (memuat && !h) return `<p class="info-kecil" style="text-align:left">${T('Mengambil harga {platform}…', { platform: namaPlatformEmas(e.platform) })}</p>`;
  if (h) {
    return `<div class="kotak-harga-emas">
      <div class="baris-rincian"><span>${T('Harga beli /gram')}</span><b>${rp(h.beli)}</b></div>
      <div class="baris-rincian"><span>${T('Harga jual (buyback) /gram')}</span><b>${h.jual ? rp(h.jual) : '—'}</b></div>
      <div class="baris-rincian"><span>${T('Nilai sekarang')}</span><b id="d-nilai-emas">${htmlNilaiFormEmas()}</b></div>
      <small>${esc(keteranganHargaEmas(h, e.platform))}</small></div>`;
  }
  const lain = e.platform === 'lainnya';
  return `<p class="info-kecil" style="text-align:left">${lain ? T('Isi harga per gram dari platform Anda.') : T('Harga {platform} belum bisa diambil. Isi sendiri dulu; nanti diperbarui otomatis kalau sudah tersedia.', { platform: namaPlatformEmas(e.platform) })}</p>
    <div class="dua-kolom">
      <div class="grup-form"><label class="label" for="d-hbeli">${T('Harga beli /gram')}</label><input class="field input-rp" id="d-hbeli" inputmode="numeric" placeholder="0" value="${formatAngka(F.emas.hargaBeli)}"></div>
      <div class="grup-form"><label class="label" for="d-hjual">${T('Harga jual /gram')}</label><input class="field input-rp" id="d-hjual" inputmode="numeric" placeholder="0" value="${formatAngka(F.emas.hargaJual)}"></div>
    </div>
    <p class="info-kecil" style="text-align:left">${T('Nilai sekarang')}: <b id="d-nilai-emas">${htmlNilaiFormEmas()}</b></p>`;
}
function bacaFormEmas() {
  const v = id => ($(id) ? $(id).value : '');
  return {
    platform: F.emas.platform,
    gram: $('#d-gram') ? angkaGram(v('#d-gram')) : F.emas.gram || 0,
    modal: $('#d-modal') ? angka(v('#d-modal')) : F.emas.modal || 0,
    hargaBeli: $('#d-hbeli') ? angka(v('#d-hbeli')) : F.emas.hargaBeli || 0,
    hargaJual: $('#d-hjual') ? angka(v('#d-hjual')) : F.emas.hargaJual || 0,
  };
}
function htmlNilaiFormEmas() {
  const e = $('#d-gram') ? bacaFormEmas() : F.emas;
  const n = e.gram > 0 ? nilaiDariEmas(e) : null;
  return n === null ? '—' : rp(n);
}
async function gambarHargaFormEmas(ambil) {
  const el = $('#d-harga-emas');
  if (!el || !F) return;
  Object.assign(F.emas, bacaFormEmas());
  el.innerHTML = htmlHargaFormEmas(ambil && navigator.onLine);
  if (!ambil) return;
  const platform = F.emas.platform;
  await muatHargaEmas([platform]);
  if (F && F.emas && F.emas.platform === platform && $('#d-harga-emas')) {
    Object.assign(F.emas, bacaFormEmas());
    $('#d-harga-emas').innerHTML = htmlHargaFormEmas(false);
  }
}
document.addEventListener('input', e => {
  if (!F || !F.modeEmas || !['d-gram', 'd-hbeli', 'd-hjual'].includes(e.target.id)) return;
  if ($('#d-nilai-emas')) $('#d-nilai-emas').innerHTML = htmlNilaiFormEmas();
});

function htmlRiwayatEmas(e) {
  const r = (e.riwayat || []).slice(-8).reverse();
  if (!r.length) return '';
  return `<h4 class="sub-laporan">${T('Riwayat berat')}</h4>${r.map(x => `
    <div class="baris-rincian"><span>${x.gram > 0 ? '＋' : '−'} ${esc(formatGram(Math.abs(x.gram)))}<small class="ket-riwayat-emas">${esc(tanggalPendek(x.tgl))}${x.dompet ? ' · ' + esc(namaT(x.dompet)) : ' · ' + T('tanpa catat uang')}</small></span>
      <span>${x.rp ? rp(x.rp) : '—'}</span></div>`).join('')}`;
}

/** Form tambah (beli) / kurangi (jual) gram. Harga total diisi otomatis dari harga hari ini, bisa diubah. */
let ME = null;
function bukaMutasiEmas(w, arah) {
  const e = infoEmas(w);
  if (!e) return;
  const beli = arah === 'beli';
  ME = { nama: w.nama, beli, dompet: dompetBiasa()[0] ? dompetBiasa()[0].nama : '', rpManual: false };
  const pilihanDompet = dompetBiasa().concat(daftarTabungan());
  bukaSheet(beli ? T('Tambah emas') : T('Kurangi emas'), `
    <p class="info-kecil" style="text-align:left;margin-top:0">${esc(w.nama)} · ${T('sekarang {gram}', { gram: esc(formatGram(e.gram)) })}</p>
    <div class="grup-form">
      <label class="label" for="me-gram">${beli ? T('Tambah berapa gram') : T('Kurangi berapa gram')}</label>
      <input class="field" id="me-gram" inputmode="decimal" autocomplete="off" placeholder="${T('mis. 5,25')}">
    </div>
    <div class="grup-form">
      <label class="label" for="me-rp">${beli ? T('Harga total dibayar') : T('Uang yang diterima')}</label>
      <input class="field input-rp" id="me-rp" inputmode="numeric" autocomplete="off" placeholder="0">
      <p class="info-kecil" style="text-align:left" id="me-ket">${esc(keteranganMutasiEmas())}</p>
    </div>
    <div class="grup-form">
      <span class="label">${beli ? T('Dibayar dari') : T('Uangnya masuk ke')}</span>
      <div class="grid-pilih">${pilihanDompet.map(d => `<button type="button" class="pilihan ${d.nama === ME.dompet ? 'aktif' : ''}" data-aksi="me-dompet" data-nama="${esc(d.nama)}"><span>${ilus(d.ikon)}</span>${esc(namaT(d.nama))}</button>`).join('')}
        <button type="button" class="pilihan" data-aksi="me-dompet" data-nama=""><span>🎁</span>${T('Tanpa catat uang')}</button></div>
      <p class="info-kecil" style="text-align:left">${beli ? T('Uang dicatat sebagai transfer dari dompet ke emas ini, jadi tidak dihitung sebagai pengeluaran.') : T('Uang dicatat sebagai transfer dari emas ini ke dompet, jadi tidak dihitung sebagai pemasukan.')}</p>
    </div>
    <div class="grup-form">
      <label class="label" for="me-tgl">${T('Tanggal')}</label>
      <input class="field" id="me-tgl" type="date" value="${hariIni()}" max="${hariIni()}">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-mutasi-emas">${T('Simpan')}</button></div>`);
  setTimeout(() => $('#me-gram') && $('#me-gram').focus(), 250);
}
function keteranganMutasiEmas() {
  const w = ME && S.data.dompet.find(d => d.nama === ME.nama);
  const h = w && hargaEmasUntuk(infoEmas(w));
  const perGram = h ? (ME.beli ? h.beli : (h.jual || h.beli)) : 0;
  return perGram ? T('Otomatis dari harga {jenis} hari ini {harga}/gram. Ubah kalau harga sebenarnya beda.', { jenis: ME.beli ? T('beli') : T('jual'), harga: rp(perGram) })
    : T('Isi harga totalnya.');
}
document.addEventListener('input', e => {
  if (!ME) return;
  if (e.target.id === 'me-rp') ME.rpManual = !!e.target.value;
  if (e.target.id !== 'me-gram' || ME.rpManual) return;
  const w = S.data.dompet.find(d => d.nama === ME.nama);
  const h = w && hargaEmasUntuk(infoEmas(w));
  const perGram = h ? (ME.beli ? h.beli : (h.jual || h.beli)) : 0;
  const g = angkaGram(e.target.value);
  if ($('#me-rp')) $('#me-rp').value = perGram && g > 0 ? formatAngka(Math.round(g * perGram)) : '';
});

/** Lembar detail emas: berat, harga beli & jual hari ini, nilai, dan untung/rugi terhadap modal. */
function bukaDetailEmas(w) {
  const e = infoEmas(w);
  if (!e) return bukaFormDompet(w);
  const h = hargaEmasUntuk(e);
  const nilaiJual = h && (h.jual || h.beli) ? Math.round(e.gram * (h.jual || h.beli)) : null;
  const nilaiBeli = h && h.beli ? Math.round(e.gram * h.beli) : null;
  const selisih = h && h.beli && h.jual ? Math.round((h.beli - h.jual) / h.beli * 1000) / 10 : null;
  const untung = e.modal && nilaiJual !== null ? nilaiJual - e.modal : null;
  const b = (label, nilai, kelas) => `<div class="baris-rincian"><span>${label}</span><b class="${kelas || ''}">${nilai}</b></div>`;
  bukaSheet(esc(w.nama), `
    <div class="ringkas-tabungan">
      <span class="ikon-bulat">${ilus(w.ikon)}</span>
      <div><small>${T('Nilai jual sekarang')}</small><b>${nilaiJual !== null ? rp(nilaiJual) : rp(w.saldo)}</b></div>
    </div>
    ${b(T('Berat'), esc(formatGram(e.gram)))}
    ${b(T('Platform'), esc(namaPlatformEmas(e.platform)))}
    <h4 class="sub-laporan">${esc(keteranganHargaEmas(h, e.platform))}</h4>
    ${h ? `
      ${b(T('Harga beli /gram'), rp(h.beli))}
      ${b(T('Harga jual (buyback) /gram'), h.jual ? rp(h.jual) : '—')}
      ${selisih !== null ? b(T('Selisih beli–jual'), selisih.toLocaleString(LOKAL) + '%') : ''}
      ${b(T('Kalau dijual sekarang'), nilaiJual !== null ? rp(nilaiJual) : '—')}
      ${b(T('Kalau dibeli sekarang'), nilaiBeli !== null ? rp(nilaiBeli) : '—')}` : `<p class="info-kecil" style="text-align:left">${T('Ketuk Perbarui harga, atau isi harga sendiri lewat Ubah.')}</p>`}
    ${e.modal ? `<h4 class="sub-laporan">${T('Untung / rugi')}</h4>
      ${b(T('Total modal'), rp(e.modal))}
      ${untung !== null ? b(untung >= 0 ? T('Untung') : T('Rugi'), (untung >= 0 ? '+' : '−') + rp(Math.abs(untung)) + ' (' + (Math.round(untung / e.modal * 1000) / 10).toLocaleString(LOKAL) + '%)', untung >= 0 ? 'masuk' : 'keluar') : ''}` : ''}
    <p class="info-kecil" style="text-align:left">${T('Harga beli = harga saat Anda membeli; harga jual = harga buyback saat Anda menjual. Sumber: data publik harga emas, bisa berbeda sedikit dengan aplikasi platform.')}</p>
    <div class="aksi-form" style="margin-bottom:10px">
      <button type="button" class="btn btn-kedua" data-aksi="mutasi-emas" data-arah="jual" data-nama="${esc(w.nama)}" ${e.gram > 0 ? '' : 'disabled'}>${T('− Kurangi gram')}</button>
      <button type="button" class="btn btn-utama" data-aksi="mutasi-emas" data-arah="beli" data-nama="${esc(w.nama)}">${T('＋ Tambah gram')}</button>
    </div>
    ${htmlRiwayatEmas(e)}
    <div class="aksi-form">
      ${platformEmas(e.platform)[2] ? `<button type="button" class="btn btn-kedua" data-aksi="perbarui-harga-emas" data-nama="${esc(w.nama)}">${T('🔄 Perbarui harga')}</button>` : ''}
      <button type="button" class="btn btn-hapus" data-aksi="ubah-emas" data-nama="${esc(w.nama)}">${T('Ubah')}</button>
    </div>`);
  if (platformEmas(e.platform)[2] && (!h || h.tgl !== hariIni())) {
    muatHargaEmas([e.platform]).then(ok => { if (ok && !$('#sheet').hidden && $('#sheet').textContent.includes(w.nama)) bukaDetailEmas(w); });
  }
}

if (ukuranDipilih()) document.documentElement.dataset.ukuran = ukuranDipilih();
// Dimulai setelah semua skrip (termasuk muda.js yang menambah fitur ke AKSI, PINTASAN, render) selesai dimuat.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
else mulai();
