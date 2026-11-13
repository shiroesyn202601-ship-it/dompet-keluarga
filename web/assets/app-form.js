// Dompet Keluarga · Lembar & form: transaksi, tampilan & keamanan, input cepat, rutin, aktivitas, pencarian, foto struk, dompet, kategori.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

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
    if (e.perluBayar) return false; // layar pembayaran sudah dibuka api()
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true); // kartu "Sesi login berakhir" sudah tampil
    return false;
  } finally {
    tombol.disabled = false;
    loading(false);
  }
}

/** Ikon umum yang ditampilkan dulu di pemilih ikon dompet (sebelum ubin merek). */
const IKON_DOMPET = ['💵', '👛', '🏦', '📱', '💳', '💰', '🐷', '🏪', '💼', '📈', '🎯', '🛡️'];
/** dompet: true → pemilih ikon dompet, dikelompokkan Umum · Bank · E-wallet · Kartu & investasi. */
function gridIkon(terpilih, dompet) {
  const tombol = i => `<button type="button" class="${i === terpilih ? 'aktif' : ''}" data-aksi="pilih-ikon" data-ikon="${esc(i)}" aria-label="${esc((typeof ILUSTRASI !== 'undefined' && ILUSTRASI.namaMerek(i)) || i)}">${ilus(i)}</button>`;
  if (!dompet || typeof ILUSTRASI === 'undefined' || !ILUSTRASI.merek) return `<div class="grid-ikon">${PILIHAN_IKON.map(tombol).join('')}</div>`;
  const m = ILUSTRASI.merek();
  return [[T('Umum'), IKON_DOMPET], [T('Bank'), m.bank], [T('E-wallet'), m.ewallet], [T('Kartu & investasi'), m.kartu]]
    .map(([judul, daftar]) => `<small class="sub-ikon">${judul}</small><div class="grid-ikon">${daftar.map(tombol).join('')}</div>`).join('');
}

// ---------- Form transaksi ----------

/** preset: isian awal untuk transaksi baru, mis. setor/tarik tabungan. */
function bukaFormTrx(t, preset, judul) {
  if (!t && terkunciBayar()) return bukaFormBayar(); // mengubah transaksi lama tetap boleh
  const sumberEmas = trxEmas(t) || trxEmas(Object.assign({ tipe: '' }, preset));
  if (sumberEmas) {
    const x = t || preset;
    const nama = adalahEmas(x.dompet) ? x.dompet : x.dompetTujuan;
    toast(t ? T('Transaksi emas tidak bisa diubah. Hapus transaksinya (gramnya ikut dikembalikan), lalu catat ulang dari detail emas.')
      : T('Emas dicatat dalam gram. Pakai Tambah gram / Kurangi gram di detail emas.'), true);
    const w = S.data.dompet.find(d => d.nama === nama);
    if (w && !t) return bukaDetailEmas(w);
    return;
  }
  const pertama = dompetBiasa()[0];
  F = t ? Object.assign({}, t) : Object.assign({
    tipe: TIPE.KELUAR, jumlah: 0, kategori: '', dompet: dompetIngatan(TIPE.KELUAR, '') || (pertama ? pertama.nama : ''), dompetTujuan: '',
    tanggal: hariIni(), catatan: '',
  }, preset);
  bukaSheet(t ? T('Ubah Transaksi') : judul || T('Catat Transaksi'), '<div id="form-trx"></div>');
  renderFormTrx();
  // Tidak fokus kalau form langsung diisi hasil struk (kartu konfirmasi muncul di atasnya, keyboard jangan terbuka).
  if (!t) setTimeout(() => F && !F.struk && !F.tanpaFokus && $('#f-jumlah') && $('#f-jumlah').focus(), 250);
}

function renderFormTrx() {
  const kategori = S.data.kategori.filter(k => k.tipe === F.tipe);
  // Tabungan hanya muncul untuk Transfer (setor/tarik); pemasukan & pengeluaran memakai dompet biasa.
  const pilihDompet = (aksi, terpilih, termasukTabungan) => `<div class="grid-pilih">${S.data.dompet
    // Orang (utang-piutang) hanya muncul kalau sedang terpilih, mis. saat mencatat pelunasan.
    .filter(w => w.jenis === JENIS.DOMPET || (termasukTabungan && (w.jenis === JENIS.TABUNGAN || (w.jenis === JENIS.ASET && !adalahEmas(w.nama)))) || w.nama === terpilih).map(w =>
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

    <label class="input-jumlah">
      <span>Rp</span>
      <input id="f-jumlah" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="${T('Jumlah')}"
        value="${F.jumlah ? new Intl.NumberFormat('id-ID').format(F.jumlah) : ''}">
    </label>
    ${F.struk ? infoStruk(F.struk) : ''}

    ${!rutin && !F.id && !F.dariRutin && !F.strukJob && !F.struk && F.tipe !== TIPE.TRANSFER ? bagianCepat() : ''}

    ${F.strukJob ? `
      <div class="struk-proses" role="status"><span class="spinner kecil"></span>
        <span><b>${T('Membaca struk…')} <span class="detik" data-detik="${F.strukJob}"></span></b>
          <small class="tahap-struk" data-tahap="${F.strukJob}">${esc((ANTRIAN.find(j => j.id === F.strukJob) || {}).tahap || '')}</small>
          <small>${T('Isi lain boleh diisi dulu, atau tutup form ini. Hasilnya tetap muncul di bawah layar.')}</small></span></div>`
    : !F.id && !rutin && !F.struk && F.tipe === TIPE.KELUAR ? `
      <div class="chips chips-struk" aria-label="${T('Isi otomatis dari foto struk')}">
        <button type="button" class="chip" data-aksi="foto-struk" data-kamera="1">📷 ${T('Foto struk')}</button>
        <button type="button" class="chip" data-aksi="foto-struk">🖼️ ${T('Dari galeri')}</button>
      </div>` : ''}

    ${F.tipe !== TIPE.TRANSFER ? `
      <div class="grup-form">
        <span class="label">${T('Kategori')}</span>
        <div class="grid-pilih">${urutKategori(kategori).map(k =>
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
      ${rutin ? inputTanggal('f-tanggal', F.tanggal) : pilihTanggalCepat()}
    </div>

    ${rutin ? bagianUlang(rutin, berikutUlang) : ''}

    <div class="grup-form">
      <label class="label" for="f-catatan">${T('Catatan (opsional)')}</label>
      <input class="field" id="f-catatan" maxlength="500" list="f-saran" autocomplete="off" placeholder="${T('mis. Belanja bulanan di Indomaret')}" value="${esc(F.catatan)}">
      <datalist id="f-saran">${kebiasaan().saran.filter(s => s.tipe === F.tipe).map(s => `<option value="${esc(s.catatan)}">`).join('')}</datalist>
    </div>

    ${rutin ? '' : bagianOpsiLain(bolehUlang, berikutUlang)}

    ${F.oleh ? `<p class="info-kecil">${T('Dicatat oleh {nama}', { nama: esc(namaPendek(F.oleh)) })}</p>` : ''}
    ${F.mirip && !F.id ? htmlMirip(F.mirip) : ''}
    <div class="aksi-form">
      ${rutin
        ? `${F.idRutin ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-rutin">${T('Hapus')}</button>` : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-rutin">${T('Simpan')}</button>`
        : `${F.id ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-trx">${T('Hapus')}</button>` : ''}
           <button type="button" class="btn btn-utama" data-aksi="simpan-trx">${F.mirip && !F.id ? T('Tetap simpan') : T('Simpan')}</button>`}
    </div>`;
}

/** Hari ini · Kemarin · Pilih tanggal. Input tanggal tetap ada di halaman (dibaca bacaFieldTrx), disembunyikan kalau tidak perlu. */
function pilihTanggalCepat() {
  const kini = hariIni();
  const d = keTanggal(kini); d.setDate(d.getDate() - 1);
  const kemarin = tanggalIso(d);
  const tgl = F.tanggal || kini;
  const lain = F.tanggalPilih || (tgl !== kini && tgl !== kemarin);
  const chip = (nilai, label, aktif) => `<button type="button" class="chip ${aktif ? 'aktif' : ''}" data-aksi="f-tanggal-cepat" data-nilai="${nilai}" aria-pressed="${aktif}">${label}</button>`;
  return `<div class="chips chips-tanggal">
      ${chip(kini, T('Hari ini'), !lain && tgl === kini)}
      ${chip(kemarin, T('Kemarin'), !lain && tgl === kemarin)}
      ${chip('pilih', lain ? '📅 ' + esc(tanggalPendek(tgl)) : '📅 ' + T('Pilih tanggal'), lain)}
    </div>
    <div class="tanggal-lain" ${lain ? '' : 'hidden'}>${inputTanggal('f-tanggal', tgl)}</div>`;
}

function bagianUlang(rutin, berikutUlang) {
  return `
    <div class="grup-form">
      <span class="label">🔁 ${rutin ? T('Berulang') : T('Ulangi (tagihan rutin)')}</span>
      <div class="chips">${(rutin ? [] : [['', T('Tidak||ulang')]]).concat([['Bulanan', T('Tiap bulan')], ['Mingguan', T('Tiap minggu')], ['Tahunan', T('Tiap tahun')]]).map(([u, l]) =>
        `<button type="button" class="chip ${(F.ulang || '') === u ? 'aktif' : ''}" data-aksi="f-ulang" data-ulang="${u}">${l}</button>`).join('')}</div>
      ${berikutUlang ? `<p class="info-kecil" style="text-align:left">${T('Muncul lagi di Beranda menjelang {tanggal}, tinggal ketuk untuk mencatat.', { tanggal: esc(tanggalPendek(berikutUlang)) })}</p>` : ''}
    </div>`;
}

/**
 * Isian yang jarang dipakai (ulangi tiap bulan, label acara, lampiran foto, patungan) dilipat di bawah "Opsi lain",
 * supaya form untuk pengeluaran sehari-hari pendek. Terbuka sendiri kalau salah satunya sudah terisi.
 */
function bagianOpsiLain(bolehUlang, berikutUlang) {
  const patungan = !F.id && !F.dariRutin && F.tipe === TIPE.KELUAR;
  const terisi = !!(F.ulang || F.lampiran || F.lampiranData || labelDari(F.catatan || '').length);
  const buka = F.opsiLain || terisi;
  const isi = [bolehUlang && T('ulangi'), T('label'), T('foto'), patungan && T('patungan')].filter(Boolean).join(' · ');
  if (!buka) {
    return `<button type="button" class="tombol-opsi-lain" data-aksi="f-opsi-lain" aria-expanded="false">
      <span>＋ ${T('Opsi lain')}</span><small>${isi}</small></button>`;
  }
  return `
    <div class="opsi-lain">
      <button type="button" class="tombol-opsi-lain buka" data-aksi="f-opsi-lain" aria-expanded="true" ${terisi ? 'disabled' : ''}>
        <span>${T('Opsi lain')}</span><small>${terisi ? '' : T('Sembunyikan')}</small></button>
      ${bolehUlang ? bagianUlang(false, berikutUlang) : ''}
      <div class="grup-form"><span class="label">${T('Label acara')}</span>${chipLabelForm()}</div>
      ${bagianLampiran()}
      ${patungan ? `<button type="button" class="tombol-teks" style="display:block;margin:-4px 0 8px;padding-left:0" data-aksi="buka-patungan">👥 ${T('Dibayar bareng teman? Bagi tagihan (patungan)')}</button>` : ''}
    </div>`;
}

/** Kategori yang paling sering dipakai di HP ini & periode ini tampil lebih dulu; "Lainnya" selalu terakhir. */
function urutKategori(daftar) {
  let simpan = {};
  try { simpan = JSON.parse(bacaHp('dk_pakai_kategori')) || {}; } catch (e) { /* abaikan */ }
  const skor = {};
  S.data.transaksi.forEach(t => { const k = t.tipe + '|' + t.kategori; skor[k] = (skor[k] || 0) + 1; });
  const nilai = k => (k.nama === 'Lainnya' ? -1 : (skor[k.tipe + '|' + k.nama] || 0) + (simpan[k.tipe + '|' + k.nama] || 0));
  return daftar.map((k, i) => ({ k, i, n: nilai(k) })).sort((a, b) => b.n - a.n || a.i - b.i).map(x => x.k);
}

/** Setelah transaksi baru disimpan: catat kategori yang dipakai & dompet terakhir per kategori (per HP). */
function catatPemakaian(t) {
  if (!t || t.id || t.tipe === TIPE.TRANSFER) return;
  try {
    const pakai = JSON.parse(bacaHp('dk_pakai_kategori')) || {};
    const k = t.tipe + '|' + t.kategori;
    pakai[k] = Math.min(999, (pakai[k] || 0) + 1);
    tulisHp('dk_pakai_kategori', JSON.stringify(pakai));
    const dompet = JSON.parse(bacaHp('dk_dompet_kategori')) || {};
    dompet[k] = t.dompet;
    tulisHp('dk_dompet_kategori', JSON.stringify(dompet));
    tulisHp('dk_dompet_terakhir', t.dompet);
  } catch (e) { /* abaikan */ }
}
/** Dompet yang terakhir dipakai untuk kategori ini (atau terakhir dipakai sama sekali), kalau masih ada. */
function dompetIngatan(tipe, kategori) {
  let nama = '';
  try { nama = (kategori && (JSON.parse(bacaHp('dk_dompet_kategori')) || {})[tipe + '|' + kategori]) || (!kategori && bacaHp('dk_dompet_terakhir')) || ''; } catch (e) { /* abaikan */ }
  return nama && dompetBiasa().some(w => w.nama === nama) ? nama : '';
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
/** '' = belum memilih (ikut perangkat, bawaan), 'light', atau 'dark'. Dipasang awal di index.html supaya tidak berkedip. */
const temaDipilih = () => bacaHp('dk_tema') || '';
/** Tema yang sedang tampil: pilihan pengguna (Terang/Gelap), atau ikut tema perangkat selama belum memilih. */
const temaAktif = () => temaDipilih() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
/** Ukuran tampilan: '' (normal) | 'besar' | 'sangat' — seluruh aplikasi diperbesar (zoom), bukan hanya huruf. */
const ukuranDipilih = () => bacaHp('dk_ukuran') || '';
function aturUkuran(u) {
  tulisHp('dk_ukuran', u || null);
  if (u) document.documentElement.dataset.ukuran = u;
  else delete document.documentElement.dataset.ukuran;
}
/** Di PC (layar ≥ 960px): '' = tampilan web (sidebar, dua kolom), 'hp' = tampilan HP di tengah layar. Dipasang awal di index.html. */
const tampilanDipilih = () => bacaHp('dk_tampilan') || '';
const layarLebar = () => matchMedia('(min-width: 960px)').matches;
function aturTampilan(t) {
  tulisHp('dk_tampilan', t || null);
  if (t) document.documentElement.dataset.tampilan = t;
  else delete document.documentElement.dataset.tampilan;
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
  keHalamanAwal();
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
  if (h.dompet && (F.tipe === TIPE.TRANSFER ? dompetTransfer() : dompetBiasa()).some(w => w.nama === h.dompet)) { F.dompet = h.dompet; F.dompetDipilih = true; }
  else if (h.kategori && !F.dompetDipilih && F.tipe !== TIPE.TRANSFER) F.dompet = dompetIngatan(F.tipe, F.kategori) || F.dompet;
  if (h.dompetTujuan && F.tipe === TIPE.TRANSFER && dompetTransfer().some(w => w.nama === h.dompetTujuan)) F.dompetTujuan = h.dompetTujuan;
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
    <button type="button" class="tombol-tambah" style="margin-top:4px" data-aksi="cek-beli">${T('🤔 Mau beli sesuatu? Cek dulu di sini')}</button>
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
        <span class="isi">${htmlAvatar(x.oleh, 'mini')} <b>${esc(x.oleh === S.data.user ? T('Anda') : namaPendek(x.oleh))}</b> ${kataAksi[x.aksi] || esc(x.aksi)}
          <small>${esc(x.ringkasan)}</small></span>
        <small class="waktu">${esc(waktuRelatif(x.waktu))}</small>
      </div>`).join('') || kosong('👥', T('Belum ada aktivitas.'))}</div>`);
  if (S.tab === 'beranda') render();
}

// ---------- Cari fitur & Tips (fitur yang tidak kelihatan) ----------

/**
 * Fitur yang bisa ditemukan lewat 🔍: [ikon, judul, kata kunci (Indonesia + Inggris), aksi, tab?].
 * Judul ikut dicocokkan, jadi kata kunci cukup berisi sinonim.
 */
const FITUR = [
  ['🎯', T('Anggaran bulanan'), 'anggaran budget batas limit amplop envelope', 'atur-anggaran'],
  ['🔁', T('Tagihan & transaksi rutin'), 'tagihan rutin langganan cicilan listrik internet spp gaji berulang recurring bill subscription', 'kelola-rutin'],
  ['🏷️', T('Kelola kategori'), 'kategori category', 'kelola-kategori'],
  ['📅', T('Periode gajian'), 'periode gajian tanggal gaji payday salary period', 'atur-periode'],
  ['📒', T('Buku keuangan'), 'buku pribadi usaha bisnis book business personal', 'buku'],
  ['👨‍👩‍👧', T('Anggota keluarga'), 'anggota undang keluarga pasangan istri suami share invite member family', 'undang'],
  ['👥', T('Aktivitas keluarga'), 'aktivitas log siapa riwayat perubahan activity', 'aktivitas'],
  ['💬', T('Bot Telegram'), 'telegram bot chat', 'telegram'],
  ['🤖', T('Fitur AI (Gemini)'), 'gemini ai struk kunci api receipt key suara bot pintar baca struk lebih akurat', 'gemini'],
  ['💾', T('Unduh & cadangan data'), 'unduh cadangan backup excel csv ekspor export download', 'cadangan'],
  ['🌙', T('Tema'), 'tema gelap terang dark light mode theme', 'tab', 'lainnya'],
  ['🌐', 'Bahasa · Language', 'bahasa inggris language english', 'tab', 'lainnya'],
  ['🔠', T('Ukuran tampilan'), 'ukuran huruf besar font size zoom', 'tab', 'lainnya'],
  ['🔒', T('Kunci aplikasi'), 'kunci pin sidik jari wajah lock fingerprint', 'atur-kunci'],
  ['👁', T('Sembunyikan nominal'), 'samar sembunyi privasi hide privacy', 'samar'],
  ['⚡', T('Pintasan di Beranda'), 'pintasan shortcut tombol beranda', 'atur-pintasan'],
  ['🐷', T('Tambah tabungan'), 'tabungan target menabung savings goal', 'tambah-tabungan'],
  ['🤝', T('Catat utang / piutang'), 'utang piutang pinjam hutang debt loan', 'tambah-utang'],
  ['💎', T('Tambah aset'), 'aset emas reksadana kendaraan kekayaan asset gold net worth', 'tambah-aset'],
  ['🕌', T('Hitung zakat'), 'zakat maal penghasilan', 'buka-zakat'],
  ['🔁', T('Transfer'), 'transfer pindah saldo antar dompet', 'cepat-transfer'],
  ['🧾', T('Foto struk'), 'foto struk kamera receipt scan', 'cepat-struk'],
  ['📝', T('Catatan'), 'catatan kalender daftar belanja tugas pengingat notes calendar todo reminder', 'kalender'],
  ['🕋', T('Sholat'), 'sholat jadwal kiblat adzan prayer qibla', 'sholat'],
  ['📊', T('Laporan'), 'laporan grafik statistik report chart', 'tab', 'laporan'],
  ['👛', T('Dompet & Tabungan'), 'dompet saldo bank e-wallet wallet balance', 'tab', 'dompet'],
  ['💡', T('Tips & trik'), 'tips trik bantuan cara help how', 'tips'],
  ['🧭', T('Tur singkat aplikasi'), 'tur panduan tutorial tour guide', 'tur'],
  ['🆕', T('Apa yang baru'), 'baru update versi changelog new', 'log-update'],
];
function cariFitur(q) {
  const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
  return FITUR.filter(f => (f[0] !== '💬' || S.data.telegram.bot || S.data.telegram.pengguna.length)
    && kata.every(k => (f[1] + ' ' + f[2]).toLowerCase().includes(k))).slice(0, 5);
}
function htmlFitur(daftar) {
  if (!daftar.length) return '';
  return `<h4 class="sub-laporan">⚙️ ${T('Fitur')}</h4>` + daftar.map(([ikon, judul, , aksi, tab]) => `
    <button type="button" class="baris baris-fitur" data-aksi="${aksi}" ${tab ? `data-tab="${tab}"` : ''}>
      <span class="ikon-bulat">${ikon}</span><span class="isi"><b>${judul}</b></span><span class="panah">${svg('maju')}</span>
    </button>`).join('');
}

/** Tips & trik: gestur dan fitur yang tidak kelihatan dari tampilan, masing-masing dengan tombol "Coba". */
function bukaTips() {
  const ada = S.data.telegram.bot || S.data.telegram.pengguna.length;
  const tips = [
    ['⚡', T('Ketik cepat'), T('Di form catat, ketik <b>bakso 25rb gopay</b> lalu Enter: nominal, kategori, dan dompet terisi sendiri. Bisa juga <b>gaji 5jt bca</b> atau <b>kemarin bensin 30rb</b>.'), 'tambah-trx'],
    ['🎤', T('Catat dengan suara'), T('Ketuk mic lalu bicara, mis. <i>"makan siang 35 ribu pakai tunai, parkir 5 ribu"</i>. Beberapa transaksi sekaligus juga bisa.'), PengenalSuara ? 'cepat-suara' : ''],
    ['👆', T('Geser transaksi'), T('Geser ke <b>kiri</b> untuk hapus (bisa diurungkan), ke <b>kanan</b> untuk mencatat lagi hari ini.'), 'tab', 'riwayat'],
    ['✋', T('Tekan lama di Riwayat'), T('Tekan lama satu transaksi untuk memilih banyak sekaligus, lalu ganti kategori/dompet atau hapus bersamaan.'), 'tab', 'riwayat'],
    ['#️⃣', T('Label acara'), T('Tulis <b>#lebaran</b> atau <b>#liburan</b> di catatan transaksi. Totalnya lintas kategori muncul di Laporan, dan bisa diberi anggaran sendiri.'), ''],
    ['⚡', T('Sekali ketuk'), T('Transaksi yang sering diulang (kopi, parkir, bensin) muncul sebagai tombol di Beranda. Sekali ketuk langsung tercatat hari ini.'), ''],
    ['📅', T('Kalender di Riwayat'), T('Ketuk ikon kalender di Riwayat untuk melihat pengeluaran per hari. Salah tanggal? Tekan lama transaksi di bawah kalender lalu seret ke hari yang benar.'), 'tab', 'riwayat'],
    ['📎', T('Foto lampiran'), T('Ketuk 📎 di Riwayat untuk melihat foto struk. Filter <b>Ada lampiran</b> menampilkan semua transaksi berfoto.'), ''],
    ['👥', T('Patungan'), T('Di form pengeluaran, buka <b>Opsi lain → Bagi tagihan</b>. Bagian Anda jadi pengeluaran, bagian teman jadi piutang.'), ''],
    ['📨', T('Anggaran amplop'), T('Centang Amplop di sebuah kategori supaya sisa anggaran bulan ini menambah anggaran bulan depan.'), 'atur-anggaran'],
    ['🔍', T('Cari apa saja'), T('Ikon 🔍 di Beranda mencari transaksi semua bulan, catatan, dan fitur aplikasi, mis. ketik "zakat" atau "tema gelap".'), 'cari-global'],
    ['👁', T('Samarkan angka'), T('Ketuk ikon mata di kartu saldo saat HP dilihat orang lain.'), ''],
    ada ? ['💬', T('Bot Telegram'), T('Catat cukup dengan chat ke bot, mis. <i>bensin 30rb pakai gopay</i>, atau kirim foto struknya.'), 'telegram'] : null,
  ].filter(Boolean);
  bukaSheet(T('Tips & Trik'), `<div class="daftar-tips">${tips.map(([ikon, judul, isi, aksi, tab]) => `
    <div class="tip">
      <span class="ikon-bulat">${ikon}</span>
      <div class="isi"><b>${judul}</b><p>${isi}</p>
        ${aksi ? `<button type="button" class="tombol-teks" data-aksi="${aksi}" ${tab ? `data-tab="${tab}"` : ''}>${T('Coba')} ›</button>` : ''}</div>
    </div>`).join('')}</div>`);
}

// ---------- Pencarian global (transaksi semua bulan + catatan) ----------
let semuaTrxCari = null; // dimuat sekali saat pencarian pertama
function bukaCariGlobal() {
  S.hasilGlobal = [];
  bukaSheet(T('Cari'), `
    <div class="kotak-cari-global"><input class="field" id="cari-global" type="search" enterkeyhint="search" autocomplete="off"
      placeholder="${T('mis. arisan, bpjs, 25000, zakat')}"></div>
    <div id="hasil-global"><p class="info-kecil">${T('Cari di semua transaksi (semua bulan), catatan, dan fitur aplikasi (mis. anggaran, zakat, tema gelap).')}</p></div>`);
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
  const catatan = daftarCatatan().filter(c => (c.judul + ' ' + polosMd(c.isi)).toLowerCase().includes(q)).slice(0, 10);
  const fitur = htmlFitur(cariFitur(q));
  if (!semuaTrxCari) {
    kotak.innerHTML = fitur + KERANGKA_DAFTAR;
    try { semuaTrxCari = await api('cariTransaksi', '', ''); } catch (e) { semuaTrxCari = null; }
    if (!$('#hasil-global')) return;
  }
  const sumber = semuaTrxCari || S.data.transaksi;
  const trx = sumber.filter(cocokTrx).slice(0, 40);
  S.hasilGlobal = trx;
  $('#hasil-global').innerHTML = fitur + (catatan.length ? `<h4 class="sub-laporan">📝 ${T('Catatan ({n})', { n: catatan.length })}</h4>` + catatan.map(c => `
      <button type="button" class="kal-item" data-aksi="ubah-catatan" data-id="${esc(c.id)}" style="--w:${warnaCatatan(c.warna)}">
        <span class="isi"><b>${esc(c.judul)}</b><small>${c.tanggal ? esc(labelHariPendek(c.tanggal)) : '📌 ' + T('Tanpa tanggal')}${c.isi ? ' · ' + esc(polosMd(c.isi).replace(/\[( |x)\] ?/gi, '').slice(0, 80)) : ''}</small></span>
      </button>`).join('') : '')
    + (trx.length ? `<h4 class="sub-laporan">💳 ${T('Transaksi ({n})', { n: trx.length + (trx.length === 40 ? '+' : '') })}</h4>` + trx.map(t => {
      const tgl = `<small class="tgl-cari">${esc(labelHariPendek(t.tanggal))}</small>`;
      return tgl + itemTrx(t);
    }).join('') : '')
    + (!fitur && !catatan.length && !trx.length ? kosong('🔍', T('Tidak ditemukan.')) : '')
    + (!semuaTrxCari ? `<p class="info-kecil">${T('Offline: hanya mencari di periode ini.')}</p>` : '');
}
document.addEventListener('input', e => {
  if (e.target.id !== 'cari-global') return;
  clearTimeout(timerCari);
  timerCari = setTimeout(() => jalankanCariGlobal(e.target.value), 250);
});

// Form dompet: mengetik "BCA", "GoPay Ayah", dst. langsung memilih ubin mereknya (kecuali ikon sudah dipilih sendiri).
document.addEventListener('input', e => {
  if (e.target.id !== 'd-nama' || !F || F.jenis !== JENIS.DOMPET || F.ikonDipilih || typeof ILUSTRASI === 'undefined') return;
  const m = ILUSTRASI.tebakMerek(e.target.value);
  const ikon = m || (F.ikonTebakan ? '👛' : F.ikon); // tebakan sebelumnya tidak cocok lagi → kembali ke ikon umum
  if (ikon === F.ikon) return;
  F.ikon = ikon;
  F.ikonTebakan = !!m;
  document.querySelectorAll('.grid-ikon button').forEach(b => b.classList.toggle('aktif', b.dataset.ikon === ikon));
});

// ---------- Petunjuk sekali lihat (fitur yang tidak kelihatan: geser, mic, sekali ketuk) ----------
let petunjukTampil = false;
function petunjukSekali(kunci, sasaran, teks) {
  if (!sasaran || petunjukTampil || bacaHp('dk_petunjuk_' + kunci)) return false;
  if ($('#ringkas-suara') && !$('#ringkas-suara').hidden) return false; // kartu konfirmasi sedang terbuka
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
  t.kabarUnggah = p => {
    job.persen = p;
    const el = document.querySelector('[data-persen="' + job.id + '"]');
    if (el) el.textContent = teksUnggah(job);
    const bar = document.querySelector('[data-bar-unggah="' + job.id + '"]');
    if (bar) bar.style.width = p + '%';
  };
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
  if ((h.barang || []).length && !hargaBukuIni()) {
    const f = F;
    muatRiwayatHarga().then(() => { if (F === f && $('#form-trx') && HARGA && HARGA.length) { bacaFieldTrx(); renderFormTrx(); } });
  }
}

function hapusJob(id) {
  const i = ANTRIAN.findIndex(j => j.id === Number(id));
  if (i >= 0) ANTRIAN.splice(i, 1);
  renderAntrian();
}

function getar() {
  try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* abaikan */ }
}

function teksUnggah(j) {
  if (j.persen == null) return T('Menyiapkan foto…');
  return j.persen >= 100 ? T('Menyimpan ke spreadsheet…') : T('Mengunggah foto {persen}%', { persen: j.persen });
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
        isi = `<b>${T('Menyimpan {judul}', { judul })} <span class="detik" data-detik="${j.id}"></span></b><small><span data-persen="${j.id}">${teksUnggah(j)}</span> · ${T('boleh lanjut pakai aplikasi')}</small>
          <span class="bar-unggah"><i data-bar-unggah="${j.id}" style="width:${j.persen || 0}%"></i></span>`;
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
  return `<div style="margin:-8px 0 16px">${pilihan}<p class="info-kecil" style="text-align:left;margin-top:0">${statusStruk(h)}</p>${peringatan}${tombolPecahStruk(h)}${htmlBarangStruk(h)}</div>`;
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

/**
 * Fitur yang memakai AI Gemini: [ikon, judul, keadaan tanpa AI ('mati' | 'terbatas'), keterangan].
 * Ditampilkan di ⚙️ → Fitur AI dan di ajakan saat memakai fitur AI (ajakAiDulu di app-fitur.js).
 */
const FITUR_AI = () => [
  ['kamera', T('Baca foto struk dengan akurat'), 'terbatas', T('Toko, kategori, tanggal, dan tiap barang terbaca. Tanpa AI hanya nominal & tanggal yang ditebak.')],
  ['laporan', T('Riwayat harga barang'), 'mati', T('Harga tiap barang di struk tercatat, jadi tahu kapan dan di mana lebih murah.')],
  ['ramal', T('Penjelasan laporan'), 'mati', T('Ringkasan periode dalam bahasa sehari-hari, lengkap dengan saran hemat.')],
  ['tas', T('Pendapat AI di "{fitur}"', { fitur: T('Cek beli') }), 'mati', T('Saran sebelum belanja, dengan menimbang keuangan Anda bulan ini.')],
  ['mic', T('Catat & tulis catatan dengan suara'), 'mati', T('"Kemarin bensin 30 ribu sama parkir 5 ribu" langsung jadi dua transaksi bertanggal benar. Juga untuk menulis catatan.')],
  ['obrolan', T('Bot Telegram yang pintar'), 'mati', T('Kirim pesan suara, tanya "bulan ini habis berapa?", atau ngobrol bebas.')],
];
function daftarFiturAi(aktif) {
  return `<ul class="fitur-ai">${FITUR_AI().map(([ikon, judul, tanpa, ket]) => `
    <li><span class="ik-bulat">${svg(ikon)}</span><span class="isi"><b>${judul}</b><small>${ket}</small></span>
      <em class="status-ai ${aktif ? 'aktif' : tanpa}">${aktif ? T('Aktif') : tanpa === 'mati' ? T('Mati') : T('Terbatas')}</em></li>`).join('')}</ul>`;
}

/**
 * ⚙️ → Fitur AI. ajak = dibuka saat memakai fitur AI (buku belum punya kunci): ada tombol "Lanjut tanpa AI" & "Jangan tampilkan lagi".
 * ajak === 'suara' = fitur suara diketuk tanpa kunci (suaraButuhAi): wajib AI, jadi tanpa pilihan lanjut tanpa AI.
 * Cukup satu kunci. Kunci cadangan (dipakai bergiliran saat kuota habis) disembunyikan di bagian lipat.
 */
function bukaFormGemini(ajak) {
  const wajib = ajak === 'suara';
  const daftar = S.data.kunciGemini;
  const isian = (label, tombol) => `
    <div class="grup-form">
      <label class="label" for="g-kunci">${label}</label>
      <input class="field" id="g-kunci" type="password" autocomplete="off" placeholder="AIza…">
    </div>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="simpan-gemini">${tombol}</button></div>`;
  bukaSheet(wajib ? T('Fitur suara butuh AI') : ajak ? T('Aktifkan AI, gratis') : T('Fitur AI (Gemini)'), `
    ${wajib && !daftar.length ? `<p class="kotak-wajib-ai">${T('Catat dan tulis dengan suara memakai <b>AI Gemini</b> untuk memahami ucapan Anda. Aktifkan dulu: gratis, sekitar 2 menit, lalu ketuk 🎤 lagi.')}</p>` : ''}
    <p style="margin-top:0">${daftar.length
      ? T('AI Gemini <b>aktif untuk seluruh keluarga</b>, termasuk bot Telegram. Fitur di bawah ini sudah bisa dipakai.')
      : T('Dompet Keluarga jadi jauh lebih pintar dengan <b>AI Gemini dari Google</b>. Gratis, sekitar 2 menit, dan cukup sekali untuk seluruh keluarga, termasuk bot Telegram.')}</p>
    ${daftarFiturAi(daftar.length)}
    ${daftar.length ? '' : `<h4 class="sub-laporan">${T('Cara mengaktifkan')}</h4>`}
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
    <p class="info-kecil" style="text-align:left">${T('Kunci disimpan di spreadsheet keluarga, jadi otomatis dipakai semua anggota, dan <b>bisa dilihat semua anggota</b> yang membuka spreadsheet. Pakai kunci gratis khusus untuk aplikasi ini, jangan kunci yang terhubung ke penagihan (billing).')}</p>
    <p class="info-kecil" style="text-align:left">${T('Yang dikirim ke Gemini hanya yang diperlukan fitur itu (mis. foto struk). Pada kunci gratis, Google dapat memakai isi permintaan untuk meningkatkan layanannya. <a href="privasi.html">Selengkapnya</a>')}</p>
    ${wajib && !daftar.length ? `<div class="aksi-form">
      <button type="button" class="btn btn-kedua" data-aksi="tutup-sheet">${T('Nanti saja')}</button>
    </div>` : ajak && !daftar.length ? `<div class="aksi-form">
      <button type="button" class="btn btn-kedua" data-aksi="ajak-ai-lanjut">${lanjutTanpaAi ? T('Lanjut tanpa AI') : T('Nanti saja')}</button>
    </div>
    <button type="button" class="tombol-teks" style="display:block;margin:4px auto 0" data-aksi="ajak-ai-tolak">${T('Jangan tampilkan lagi')}</button>` : ''}`);
}

// ---------- Versi penuh (pembayaran) ----------

/**
 * Layar beli versi penuh: transfer manual ke rekening pemilik, foto bukti diunggah dari sini, lalu pemilik menekan
 * Aktifkan di halaman admin (web/admin.html) dan versi penuh terpasang sendiri saat aplikasi dimuat
 * (lihat docs/PEMILIK.md → Versi penuh & pembayaran).
 */
let buktiBayar = null; // data URL JPEG bukti transfer yang dipilih, belum dikirim
/** Kalimat masa gratis sesuai aturan penjualan (jumlah transaksi / periode gajian / mana yang lebih dulu). */
function teksMasaGratis(l) {
  const trx = T('<b>{n} transaksi</b>', { n: l.batas }), per = T('<b>{n} periode gajian</b> pertama', { n: l.batasPeriode });
  const batas = l.aturan === 'periode' ? per : l.aturan === 'keduanya' ? T('{a} atau {b}, mana yang lebih dulu', { a: trx, b: per }) : trx;
  if (l.habis) return T('Masa gratis berlaku untuk {batas}, dan sudah habis. Semua data tetap aman dan tetap bisa dilihat, diubah, dan diunduh.', { batas });
  const posisi = [l.aturan !== 'periode' ? T('{terpakai} transaksi terpakai', { terpakai: l.terpakai }) : '',
    l.aturan !== 'transaksi' ? T('sekarang periode ke-{k}', { k: l.periodeKe }) : ''].filter(Boolean).join(', ');
  return T('Masa gratis berlaku untuk {batas}. Saat ini: {posisi}.', { batas, posisi });
}

function bukaFormBayar() {
  const l = S.data && S.data.lisensi;
  if (!l) return;
  if (l.aktif) {
    return bukaSheet(T('Versi penuh'), `
      <p style="margin-top:0">${T('✅ <b>Versi penuh aktif</b> untuk buku ini, tanpa batas transaksi untuk seluruh keluarga, termasuk lewat bot Telegram. Terima kasih sudah mendukung Dompet Keluarga!')}</p>
      <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="tutup-sheet">${T('Tutup')}</button></div>`);
  }
  buktiBayar = null;
  const menunggu = l.permintaan === 'menunggu';
  // Kartu status aktivasi. Status diperiksa sendiri tiap layar ini dibuka, dan tiap 30 detik selama menunggu (lihat perbaruiFormBayar).
  const IKON_STATUS = {
    menunggu: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ditolak: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    nonaktif: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    belum: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  };
  const jenis = ['menunggu', 'ditolak', 'nonaktif'].includes(l.permintaan) ? l.permintaan : 'belum';
  const status = {
    menunggu: { judul: T('Menunggu konfirmasi admin'), isi: T('Bukti transfer sudah terkirim. Versi penuh aktif sendiri setelah dikonfirmasi, tanpa perlu apa-apa.') },
    ditolak: { judul: T('Bukti transfer ditolak'), isi: T('Perbaiki lalu kirim ulang bukti transfernya di bawah.') },
    nonaktif: { judul: T('Versi penuh dinonaktifkan admin'), isi: T('Kirim bukti transfer kalau ingin mengaktifkannya lagi.') },
    belum: { judul: T('Belum mengajukan aktivasi'), isi: T('Sudah transfer dan mengirim bukti dari HP lain? Statusnya diperiksa otomatis setiap layar ini dibuka.') },
  }[jenis];
  const kabar = `
    <section class="status-aktivasi ${jenis}" role="status">
      <div class="sa-kepala">
        <span class="sa-ikon" aria-hidden="true"><svg viewBox="0 0 24 24">${IKON_STATUS[jenis]}</svg></span>
        <span class="sa-judul"><small>${T('Status aktivasi')}</small><b>${status.judul}</b></span>
      </div>
      ${jenis === 'ditolak' && l.alasan ? `<div class="sa-alasan"><small>${T('Alasan dari admin')}</small>${esc(l.alasan)}</div>` : ''}
      <p class="sa-ket">${status.isi}</p>
    </section>`;
  // Setiap rekening boleh punya satu QRIS, ditampilkan tepat di bawah rekeningnya.
  const rekening = (l.rekening || []).map((r, i) => `
        <div class="baris">
          <span class="ikon-bulat">${/dana|ovo|gopay|shopee|linkaja|jago|flip/i.test(r.bank) ? '📱' : '🏦'}</span>
          <span class="isi"><b>${esc(r.bank)} ${esc(r.nomor)}</b>${r.atasNama ? `<small>${T('a.n. {nama}', { nama: esc(r.atasNama) })}</small>` : ''}</span>
          <button type="button" class="tombol-teks" data-aksi="salin-rekening" data-nomor="${esc(r.nomor)}">${T('Salin')}</button>
        </div>${r.qris ? `
        <div class="kotak-qris" data-rek="${i}" style="text-align:center;margin:4px 0 12px">
          <small style="display:block;color:var(--muted);margin-bottom:6px">${T('Atau scan QRIS:')}</small>
          <img class="gambar-qris" alt="QRIS ${esc(r.bank)}" hidden style="width:220px;max-width:100%;border-radius:12px;background:#fff;padding:8px">
          <div class="memuat-qris info-kecil">${T('Memuat QRIS…')}</div>
          <a class="unduh-qris tombol-teks" hidden download="QRIS-${esc(r.bank.replace(/[^\w-]+/g, '-'))}.png" style="display:block">${T('Simpan gambar QRIS')}</a>
        </div>` : ''}`).join('');
  bukaSheet(T('Beli versi penuh'), `${kabar}
    <p style="margin-top:0">${teksMasaGratis(l)}</p>
    <p>${T('Versi penuh: <b>{harga}</b>, sekali bayar untuk selamanya. Tanpa batas transaksi untuk seluruh keluarga di buku ini, termasuk lewat bot Telegram.', { harga: rp(l.harga) })}</p>
    <ol class="panduan" style="padding-left:20px;margin-bottom:16px">
      <li>${T('Transfer <b>{harga}</b> ke:', { harga: rp(l.harga) })}${rekening}
      </li>
      <li>${T('Pilih foto atau screenshot bukti transfer, lalu ketuk <b>Kirim bukti</b>.')}
        <label class="btn btn-kedua" style="display:block;margin:8px 0;text-align:center;cursor:pointer">
          <input type="file" id="bukti-bayar" accept="image/*" hidden>${menunggu ? T('📷 Ganti foto bukti') : T('📷 Pilih foto bukti transfer')}
        </label>
        <img id="pratinjau-bukti" alt="" hidden style="display:block;max-width:100%;max-height:240px;margin:0 auto 8px;border-radius:12px">
        <button type="button" class="btn btn-utama" style="display:block;width:100%" data-aksi="kirim-bukti" id="tombol-kirim-bukti" disabled>${T('Kirim bukti')}</button>
      </li>
      <li>${T('Admin mengecek transfernya. Setelah dikonfirmasi, versi penuh <b>aktif sendiri</b> untuk seluruh keluarga saat aplikasi dibuka lagi.')}</li>
    </ol>`);
  jadwalCekBayar();
  document.querySelectorAll('.kotak-qris[data-rek]').forEach(kotak => {
    const gagal = () => { kotak.querySelector('.memuat-qris').textContent = T('QRIS belum bisa dimuat. Pakai rekening di atas, atau coba lagi nanti.'); };
    SERVER.ambilQris(kotak.dataset.rek).then(data => {
      if (!data) return gagal();
      const img = kotak.querySelector('.gambar-qris'), unduh = kotak.querySelector('.unduh-qris');
      img.src = unduh.href = data;
      img.hidden = unduh.hidden = false;
      kotak.querySelector('.memuat-qris').hidden = true;
    }).catch(gagal);
  });
  $('#bukti-bayar').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      buktiBayar = await kecilkanBukti(file);
      const img = $('#pratinjau-bukti');
      img.src = buktiBayar;
      img.hidden = false;
      $('#tombol-kirim-bukti').disabled = false;
    } catch (err) {
      toast(pesanError(err), true);
    }
  });
}

/**
 * Layar Versi penuh baru dibuka: harga, rekening, QRIS, dan status diambil ulang dari bot di belakang layar, lalu
 * layarnya digambar ulang kalau ada yang berubah (kecuali pembeli sudah memilih foto bukti).
 */
async function perbaruiFormBayar() {
  if (DEMO.aktif() || !S.data || !S.data.lisensi) return;
  try {
    const l = await SERVER.segarkanLisensi();
    if (!l) return;
    const berubah = JSON.stringify(l) !== JSON.stringify(S.data.lisensi);
    S.data.lisensi = l;
    tulisLokal('data', S.data);
    if (!berubah) return jadwalCekBayar();
    render();
    if ($('#sheet').hidden || !$('#bukti-bayar') || buktiBayar) return;
    if (l.aktif) { tutupSheet(); await muat(); return toast(T('Versi penuh aktif. Terima kasih! 🎉')); }
    bukaFormBayar();
  } catch (e) { jadwalCekBayar(); /* tetap memakai data terakhir */ }
}

/** Selama layar Versi penuh terbuka dan bukti transfer menunggu konfirmasi, status diperiksa ulang tiap 30 detik. */
let jedaCekBayar = null;
function jadwalCekBayar() {
  clearTimeout(jedaCekBayar);
  jedaCekBayar = setTimeout(() => {
    if (!$('#sheet').hidden && $('#bukti-bayar') && S.data && S.data.lisensi && S.data.lisensi.permintaan === 'menunggu') perbaruiFormBayar();
  }, 30000);
}

/**
 * Foto / screenshot bukti transfer diperkecil sebelum dikirim, supaya penyimpanan admin tidak cepat penuh, tapi nominal,
 * nama, dan tanggalnya tetap terbaca: sisi terpanjang ±1600 px (screenshot HP tetap tajam), WebP (JPEG kalau browser
 * tidak bisa), mutu diturunkan bertahap sampai ±200 KB. Hasil: data URL.
 */
function kecilkanBukti(file) {
  return new Promise((ok, gagal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error(T('Gambar tidak bisa dibuka. Coba foto lain (format JPG/PNG).'))); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      const gambar = (sisi, mutu) => {
        const k = Math.min(1, sisi / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; // screenshot PNG transparan tidak berubah hitam
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const webp = c.toDataURL('image/webp', mutu);
        return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', mutu);
      };
      const BATAS = 200 * 1024 * 4 / 3; // ±200 KB (panjang teks base64)
      let hasil = '';
      for (const [sisi, mutu] of [[1600, 0.8], [1600, 0.7], [1400, 0.65], [1200, 0.6], [1000, 0.55]]) {
        hasil = gambar(sisi, mutu);
        if (hasil.length <= BATAS) break;
      }
      ok(hasil);
    };
    img.src = url;
  });
}

/** Mengirim bukti transfer yang dipilih di layar Beli versi penuh. */
async function kirimBuktiBayar(tombol) {
  if (!buktiBayar) return toast(T('Pilih foto bukti transfernya dulu.'), true);
  tombol.disabled = true;
  loading(true);
  try {
    const status = await api('mintaAktivasi', buktiBayar);
    if (status === 'aktif') {
      await muat();
      tutupSheet();
      return toast(T('Versi penuh aktif. Terima kasih! 🎉'));
    }
    S.data.lisensi.permintaan = 'menunggu';
    tulisLokal('data', S.data);
    bukaFormBayar();
    render();
    toast(T('Bukti terkirim ✔ Versi penuh aktif sendiri setelah dikonfirmasi admin.'));
  } catch (e) {
    tombol.disabled = false;
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
  } finally {
    loading(false);
  }
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
  const emas = aset && w ? infoEmas(w) : null;
  F = {
    modeEmas: aset && (w ? !!emas : true), emas: Object.assign({ platform: 'pegadaian' }, emas),
    namaLama: w ? w.nama : '', ikon: w ? w.ikon : (tab ? '🐷' : aset ? '🪙' : '👛'), jenis, // aset baru dimulai sebagai emas
    saldoAwal: w ? w.saldoAwal : 0, mutasi: w ? w.saldo - w.saldoAwal : 0, saldoTampil,
    // Ikon khusus yang sudah dipilih (bukan ikon umum / ubin merek) tidak ditimpa tebakan dari nama.
    ikonDipilih: !!w && !IKON_UMUM_DOMPET.includes(w.ikon || '') && !(typeof ILUSTRASI !== 'undefined' && ILUSTRASI.namaMerek(w.ikon)),
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
      <input class="field" id="d-nama" maxlength="40" placeholder="${tab ? T('mis. Dana Darurat, Liburan, Umroh') : aset ? T('mis. Emas Pegadaian, Reksadana, Motor') : T('mis. BCA, GoPay, Celengan')}" value="${esc(w ? w.nama : '')}">
    </div>
    ${aset ? htmlFormEmas() : ''}
    <div class="grup-form" id="d-grup-saldo" ${aset && F.modeEmas ? 'hidden' : ''}>
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
    <div class="grup-form"><span class="label">${T('Ikon')}</span>${gridIkon(F.ikon, jenis === JENIS.DOMPET)}</div>
    <div class="aksi-form">
      ${w ? `<button type="button" class="btn btn-hapus" data-aksi="hapus-dompet">${T('Hapus')}</button>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="simpan-dompet">${T('Simpan')}</button>
    </div>`);
  if (aset && F.modeEmas) gambarHargaFormEmas(true); // ambil harga hari ini platform terpilih
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
        <span class="isi isi-anggaran"><b>${esc(namaT(k.nama))}</b>
          <span class="opsi-anggaran">${saran[k.nama] ? `<button type="button" class="saran-anggaran" data-aksi="pakai-saran-anggaran" data-nama="${esc(k.nama)}" data-n="${saran[k.nama].batas}" title="${T('Rata-rata 3 bulan: {jumlah}', { jumlah: rp(saran[k.nama].rata) })}">💡 ${T('Saran {jumlah}', { jumlah: rpPendek(saran[k.nama].batas) })}</button>` : ''}
          <label class="amplop"><input type="checkbox" class="input-amplop" data-nama="${esc(k.nama)}" ${k.bawaSisa ? 'checked' : ''}> 📨 ${T('Amplop')}</label></span></span>
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
