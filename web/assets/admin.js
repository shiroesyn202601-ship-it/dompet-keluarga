/**
 * Halaman admin lisensi (web/admin.html), bergaya sama dengan aplikasi Dompet Keluarga.
 *   - Dua tampilan yang bisa dipilih: Web (sidebar + isi lebar) dan Mobile (satu kolom + navigasi pil di bawah).
 *     Pilihan disimpan di HP / komputer ini (localStorage 'dk_admin_tampilan'); bawaan mengikuti lebar layar.
 *   - Pengajuan: kartu hero pendapatan, ringkasan per status (sekaligus filter), pencarian, kartu pengajuan + foto bukti,
 *     tombol Aktifkan / Tolak (dengan alasan) / Nonaktifkan, dan riwayat transaksi per buku.
 *   - Pengaturan penjualan: kapan ditagih, menu Versi penuh, harga, rekening tujuan (masing-masing boleh punya satu QRIS).
 *   - Setiap permintaan ke bot menampilkan garis progres di atas layar; tombol yang sedang bekerja menampilkan putaran + teks.
 * Semua data ada di bot (bot/Kode.gs → apiLisensi_); bot hanya melayani akun Google pemilik bot (atau ADMIN_EMAIL).
 * Sengaja tanpa terjemahan: halaman ini khusus pemilik.
 */
(() => {
  const BOT = (KONFIG.bayar || {}).urlBot;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
  const STATUS = {
    menunggu: { label: 'Menunggu', warna: 'var(--warn)' },
    aktif: { label: 'Aktif', warna: 'var(--ok)' },
    nonaktif: { label: 'Nonaktif', warna: 'var(--info)' },
    ditolak: { label: 'Ditolak', warna: 'var(--bad)' },
  };
  /** Alasan penolakan siap pilih; teks inilah yang dilihat pembeli di layar Versi penuh. */
  const daftarAlasan = () => [
    'Nominal transfer tidak sesuai (harus ' + rupiah(jual.harga) + ')',
    'Transfer belum masuk ke rekening admin',
    'Foto bukti tidak jelas atau terpotong',
    'Nomor tujuan transfer salah',
    'Bukti transfer sudah pernah dipakai untuk buku lain',
  ];

  /** Ikon garis (gaya sama dengan aplikasi: svg.ik). */
  const ik = d => '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IKON = {
    pesan: ik('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    kotakMasuk: ik('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    atur: ik('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
    akun: ik('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    tabel: ik('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
    muat: ik('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>'),
    keluar: ik('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5M15 12H4"/>'),
    ganti: ik('<path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>'),
    web: ik('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    hp: ik('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
    matahari: ik('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    bulan: ik('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    cari: ik('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    jam: ik('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    cek: ik('<path d="M20 6 9 17l-5-5"/>'),
    silang: ik('<path d="M18 6 6 18M6 6l12 12"/>'),
    larang: ik('<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>'),
    semua: ik('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    gambar: ik('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
    riwayat: ik('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    kalender: ik('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    mata: ik('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    label: ik('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    bank: ik('<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 3 2 8h20z"/>'),
    kembali: ik('<path d="M15 18l-6-6 6-6"/>'),
    tambah: ik('<path d="M12 5v14M5 12h14"/>'),
    sampah: ik('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
    unggah: ik('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
    salin: ik('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  };
  const IKON_STATUS = { menunggu: IKON.jam, aktif: IKON.cek, nonaktif: IKON.larang, ditolak: IKON.silang, '': IKON.semua };

  let daftar = [];
  let tab = 'menunggu';
  let cari = '';
  let galat = '';
  let sesiHabis = false; // token login habis / ditolak bot: kotak galat diberi tombol "Masuk lagi"
  const PESAN_SESI = 'Sesi login sudah habis. Masuk lagi untuk melanjutkan; layar ini tetap seperti semula.';
  let layar = 'pengajuan'; // 'pengajuan' | 'pengaturan' | 'masukan'
  // Masukan pengguna (dari halaman Kebijakan Privasi → Kontak). null = belum dimuat.
  let masukan = null;
  let emojiMasukan = ['👍', '❤️', '🙏', '😄', '🔧', '✅', '👀', '🎉'];
  let tabMasukan = 'belum'; // '' | 'belum' | jenis
  let cariMasukan = '';
  const ubahBalasan = {}; // id masukan → sedang mengubah balasan yang sudah ada
  const JENIS_MASUKAN = { masalah: ['🐞', 'Laporan masalah'], kritik: ['🗣️', 'Kritik'], pengembangan: ['🛠️', 'Saran pengembangan'], fitur: ['✨', 'Saran fitur'] };
  let info = { admin: '', sheet: '' };
  let dimuat = false;   // daftar sudah pernah dimuat (sebelum itu tampil kerangka)
  let jual = { aturan: 'transaksi', batasTransaksi: 450, batasPeriode: 3, harga: Number((KONFIG.bayar || {}).harga) || 0, rekening: [], selaluTampil: true };
  // Salinan pengaturan yang sedang diubah. Tiap rekening: { bank, nomor, atasNama, qris (punya QRIS tersimpan),
  // asal (nomor urut rekening tersimpan, -1 = baru), baru (data URL QRIS yang dipilih, '' = dihapus, null = tidak diubah) }.
  let formJual = null;
  let qrisTersimpan = {}; // nomor urut rekening tersimpan → data URL QRIS-nya (dimuat saat layar Pengaturan dibuka)
  const foto = {};      // id buku → data URL bukti ('' = gagal dimuat)
  const memuat = {};    // id buku → sedang dimuat

  // ---------- Tampilan Web / Mobile ----------

  const KUNCI_TAMPILAN = 'dk_admin_tampilan';
  const tampilanBawaan = () => (window.innerWidth >= 900 ? 'web' : 'mobile');
  let tampilan = (() => { try { return localStorage.getItem(KUNCI_TAMPILAN) || ''; } catch (e) { return ''; } })() || tampilanBawaan();
  function pasangTampilan(m, simpan) {
    tampilan = m;
    document.body.classList.toggle('mode-web', m === 'web');
    document.body.classList.toggle('mode-mobile', m !== 'web');
    if (simpan) { try { localStorage.setItem(KUNCI_TAMPILAN, m); } catch (e) { /* abaikan */ } }
  }
  pasangTampilan(tampilan);
  // ---------- Tema terang / gelap ----------

  const KUNCI_TEMA = 'dk_admin_tema';
  const temaGelap = () => (document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  function gantiTema() {
    const baru = temaGelap() ? 'light' : 'dark';
    document.documentElement.dataset.theme = baru;
    try { localStorage.setItem(KUNCI_TEMA, baru); } catch (e) { /* abaikan */ }
    return baru;
  }
  const tombolTema = () => {
    const g = temaGelap();
    return `<button type="button" class="ikon-btn tombol-tema" data-aksi="tema" title="${g ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}"
      aria-label="${g ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}">${g ? IKON.matahari : IKON.bulan}</button>`;
  };

  const pilihMode = () => `<div class="baris-tampilan">
    <div class="pilih-mode" role="group" aria-label="Tampilan">
      <button type="button" class="${tampilan === 'web' ? 'aktif' : ''}" data-aksi="mode" data-mode="web" aria-pressed="${tampilan === 'web'}">${IKON.web}<span class="teks">Web</span></button>
      <button type="button" class="${tampilan !== 'web' ? 'aktif' : ''}" data-aksi="mode" data-mode="mobile" aria-pressed="${tampilan !== 'web'}">${IKON.hp}<span class="teks">Mobile</span></button>
    </div>${tombolTema()}</div>`;

  // ---------- Penanda memuat ----------

  let permintaanJalan = 0;
  const tandaSibuk = n => { permintaanJalan = Math.max(0, permintaanJalan + n); document.body.classList.toggle('sibuk', permintaanJalan > 0); };
  /** Tombol sedang bekerja: putaran + teks (mis. "Mengaktifkan…"). Hasil: fungsi untuk mengembalikannya. */
  function sibuk(tombol, teks) {
    if (!tombol) return () => {};
    const asli = tombol.innerHTML;
    tombol.disabled = true;
    tombol.setAttribute('aria-busy', 'true');
    if (tombol.classList.contains('ikon-btn')) tombol.classList.add('memuat');
    else tombol.innerHTML = '<span class="putar" aria-hidden="true"></span>' + esc(teks || 'Memuat…');
    return () => {
      if (!tombol.isConnected) return;
      tombol.disabled = false;
      tombol.removeAttribute('aria-busy');
      tombol.classList.remove('memuat');
      tombol.innerHTML = asli;
    };
  }

  // ---------- Komunikasi dengan bot ----------

  /** Token login; google.js versi lama (dari cache aplikasi) belum punya GOOGLE.token, jadi dibaca langsung dari sesi. */
  function tokenSaya() {
    if (typeof GOOGLE.token === 'function') return GOOGLE.token();
    try {
      const s = JSON.parse(localStorage.getItem(window.KUNCI_SESI || 'dk_sesi'));
      return s && s.token && Date.now() < s.kadaluarsa ? s.token : null;
    } catch (e) { return null; }
  }

  async function api(isi) {
    const token = tokenSaya();
    if (!token) throw tandaiSesiHabis();
    let j;
    tandaSibuk(1);
    try {
      const r = await fetch(BOT + '?api=1', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token }, isi)) });
      j = await r.json();
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke bot. Periksa koneksi internet.');
    } finally {
      tandaSibuk(-1);
    }
    if (j.galat) throw /sesi login/i.test(j.galat) ? tandaiSesiHabis() : new Error(j.galat);
    return j;
  }

  /** Sesi habis: tampilkan kotak "Masuk lagi" di layar yang sedang terbuka (belum pernah masuk → layar masuk). */
  function tandaiSesiHabis() {
    if (layar === 'pengaturan') bacaForm(); // isian yang sedang diketik tidak hilang
    sesiHabis = true;
    galat = PESAN_SESI;
    if (info.admin) render();
    else tampilMasuk(PESAN_SESI);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // kotak Masuk lagi ada di atas
    const e = new Error(PESAN_SESI);
    e.sesi = true;
    return e;
  }

  /** Kotak galat; untuk sesi habis diberi tombol Masuk lagi. */
  function kotakGalat() {
    if (!galat) return '';
    return sesiHabis
      ? `<div class="galat galat-sesi"><span>${esc(galat)}</span><button type="button" class="btn btn-utama kecil" data-aksi="masuk-lagi">Masuk lagi</button></div>`
      : `<div class="galat">${esc(galat)}</div>`;
  }

  /** Masuk lagi dengan akun yang sama (tanpa pilihan akun), lalu data dimuat ulang tanpa meninggalkan layar ini. */
  async function masukLagi(tombol) {
    const pulih = sibuk(tombol, 'Masuk…');
    try {
      await GOOGLE.masuk(false);
      sesiHabis = false;
      galat = '';
      if (layar === 'pengaturan') bacaForm();
      await muat();
      kabar('Berhasil masuk lagi ✔');
    } catch (e) {
      pulih();
      kabar(e.message);
    }
  }

  // ---------- Masuk ----------

  function tampilMasuk(pesan) {
    $('#app').hidden = true;
    const l = $('#layar-masuk');
    l.hidden = false;
    l.innerHTML = `
      <div style="position:fixed;top:14px;right:14px">${tombolTema().replace('tombol-tema', '')}</div>
      <div class="kotak-masuk">
        <div class="hero">
          <img src="ikon/logo.svg" alt="">
          <h1>Admin Lisensi</h1>
          <p>Kelola aktivasi versi penuh Dompet Keluarga</p>
        </div>
        <div class="badan">
          ${pesan ? `<div class="galat" style="margin:0">${esc(pesan)}</div>` : ''}
          <button class="btn btn-utama" data-aksi="masuk">Masuk dengan Google</button>
          <small style="color:var(--muted);text-align:center">Gunakan <b>akun Google pemilik bot</b> (atau email di ADMIN_EMAIL).</small>
        </div>
      </div>`;
  }

  async function masuk(tombol) {
    const pulih = sibuk(tombol, 'Membuka Google…');
    try {
      await GOOGLE.masuk(true); // selalu tampilkan pilihan akun
      await muat();
    } catch (e) {
      pulih();
      tampilMasuk(e.message);
    }
  }

  // ---------- Kerangka: sidebar, kepala, navigasi bawah ----------

  const jumlahMenunggu = () => daftar.filter(r => r.status === 'menunggu').length;
  const belumDibalas = () => (masukan || []).filter(m => !m.dibalas).length;
  const inisial = () => esc(((info.admin || '?')[0] || '?').toUpperCase());

  function kerangka() {
    $('#layar-masuk').hidden = true;
    $('#app').hidden = false;
    const n = jumlahMenunggu();
    const lencana = n ? `<span class="lencana">${n}</span>` : '';
    const nb = belumDibalas();
    const lencanaMasukan = nb ? `<span class="lencana">${nb}</span>` : '';
    // Sidebar (mode web)
    $('#samping').innerHTML = `
      <div class="merek"><img src="ikon/logo.svg" alt=""><div><b>Admin Lisensi</b><small>Dompet Keluarga</small></div></div>
      <button class="nav-item ${layar === 'pengajuan' ? 'aktif' : ''}" data-aksi="ke" data-layar="pengajuan">${IKON.kotakMasuk}<span class="teks">Pengajuan</span>${lencana}</button>
      <button class="nav-item ${layar === 'masukan' ? 'aktif' : ''}" data-aksi="ke" data-layar="masukan">${IKON.pesan}<span class="teks">Masukan</span>${lencanaMasukan}</button>
      <button class="nav-item ${layar === 'pengaturan' ? 'aktif' : ''}" data-aksi="ke" data-layar="pengaturan">${IKON.atur}<span class="teks">Pengaturan penjualan</span></button>
      ${info.sheet ? `<a class="nav-item" href="${esc(info.sheet)}" target="_blank" rel="noopener">${IKON.tabel}<span class="teks">Spreadsheet</span></a>` : ''}
      <div class="bawah">
        ${pilihMode()}
        <div class="kartu-akun"><span class="avatar">${inisial()}</span><span class="isi"><b title="${esc(info.admin)}">${esc(info.admin)}</b><small>Admin</small></span>
          <button class="ikon-btn" data-aksi="akun" title="Akun" aria-label="Akun">${IKON.akun}</button></div>
      </div>`;
    // Kepala halaman
    const judul = layar === 'masukan' ? ['Masukan pengguna', masukan === null ? 'Memuat data…' : nb ? nb + ' belum dibalas' : 'Semua sudah dibalas']
      : layar === 'pengaturan' ? [tampilan === 'web' ? 'Pengaturan penjualan' : 'Pengaturan', 'Penjualan · berlaku untuk aplikasi & bot'] : ['Pengajuan aktivasi', !dimuat ? 'Memuat data…' : n ? n + ' menunggu konfirmasi' : 'Semua sudah diproses'];
    $('#kepala').innerHTML = `
      <div class="judul"><img src="ikon/logo.svg" alt=""><div style="min-width:0"><small>${esc(judul[1])}</small><h1>${esc(judul[0])}</h1></div></div>
      <div class="kepala-kanan">
        <button class="ikon-btn" data-aksi="mode" data-mode="${tampilan === 'web' ? 'mobile' : 'web'}" title="Ganti ke tampilan ${tampilan === 'web' ? 'Mobile' : 'Web'}"
          aria-label="Ganti ke tampilan ${tampilan === 'web' ? 'Mobile' : 'Web'}">${tampilan === 'web' ? IKON.hp : IKON.web}</button>
        ${tombolTema().replace('tombol-tema', '')}
        <button class="ikon-btn ${!dimuat ? 'memuat' : ''}" data-aksi="muat" title="Muat ulang" aria-label="Muat ulang">${IKON.muat}</button>
      </div>`;
    // Navigasi bawah (mode mobile)
    $('#navbawah').innerHTML = `
      <button class="${layar === 'pengajuan' ? 'aktif' : ''}" data-aksi="ke" data-layar="pengajuan">${IKON.kotakMasuk}<span>Pengajuan</span>${lencana}</button>
      <button class="${layar === 'masukan' ? 'aktif' : ''}" data-aksi="ke" data-layar="masukan">${IKON.pesan}<span>Masukan</span>${lencanaMasukan}</button>
      <button class="${layar === 'pengaturan' ? 'aktif' : ''}" data-aksi="ke" data-layar="pengaturan">${IKON.atur}<span>Pengaturan</span></button>
      <button data-aksi="akun">${IKON.akun}<span>Akun</span></button>`;
  }

  // ---------- Data ----------

  async function muat() {
    if (!BOT) return tampilMasuk('URL bot (bayar.urlBot) belum diisi di web/assets/config.js.');
    if (!dimuat) { kerangka(); $('#isi').innerHTML = kerangkaMemuat(); }
    try {
      const [j, m] = await Promise.all([api({ aksi: 'daftar' }), api({ aksi: 'daftarMasukan' }).catch(e => (e.sesi ? Promise.reject(e) : { galatMasukan: e.message }))]);
      daftar = j.daftar || [];
      if (m.galatMasukan) kabar('Masukan belum bisa dimuat: ' + m.galatMasukan);
      else { masukan = m.masukan || []; if (m.emoji && m.emoji.length) emojiMasukan = m.emoji; }
      info = { admin: j.admin, sheet: j.sheet };
      if (j.jual) jual = j.jual;
      galat = '';
      dimuat = true;
      render();
    } catch (e) {
      if (e.sesi) return;
      if (/bukan admin/i.test(e.message)) return tampilMasuk(e.message);
      galat = e.message;
      render();
    }
  }

  const kerangkaMemuat = () => `
    <div class="kerangka" style="height:190px;margin-bottom:18px"></div>
    <div class="kerangka" style="height:44px;border-radius:14px;margin-bottom:14px"></div>
    <div class="daftar">${'<div class="kerangka" style="height:180px"></div>'.repeat(4)}</div>`;

  async function muatFoto(id) {
    if (foto[id] || memuat[id]) return;
    memuat[id] = true;
    gambarUlangBukti(id);
    try {
      foto[id] = (await api({ aksi: 'foto', id })).foto;
    } catch (e) {
      foto[id] = '';
      if (!e.sesi) kabar(e.message);
    }
    memuat[id] = false;
    gambarUlangBukti(id);
  }

  // ---------- Tampilan: pengajuan ----------

  /** Waktu dari bot ditulis dalam WIB tanpa zona ("2026-11-12 18:33"); yang ditulis halaman ini berformat ISO (UTC). */
  const keWaktu = s => {
    const t = String(s || '').trim().replace(' ', 'T');
    return new Date(/Z$|[+-]\d\d:\d\d$/.test(t) ? t : t + '+07:00');
  };
  const tanggal = s => {
    const d = keWaktu(s);
    return isNaN(d) ? String(s || '') : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
  };
  const relatif = s => {
    const d = keWaktu(s);
    if (isNaN(d)) return String(s || '');
    const m = Math.round((Date.now() - d) / 6e4);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' menit lalu';
    if (m < 1440) return Math.round(m / 60) + ' jam lalu';
    if (m < 10080) return Math.round(m / 1440) + ' hari lalu';
    return tanggal(s);
  };

  function htmlBukti(r) {
    if (!r.ada_foto) return `<div class="bukti">${IKON.gambar}Tanpa foto</div>`;
    if (foto[r.id]) return `<button type="button" class="bukti ada" data-aksi="perbesar" data-id="${esc(r.id)}" title="Perbesar" aria-label="Perbesar bukti transfer"><img src="${esc(foto[r.id])}" alt=""></button>`;
    if (memuat[r.id]) return '<div class="bukti memuat" role="status" aria-label="Memuat foto"><span class="putar" style="color:var(--muted)"></span></div>';
    if (foto[r.id] === '') return `<button type="button" class="bukti" data-aksi="foto" data-id="${esc(r.id)}">${IKON.muat}Gagal memuat<br>Coba lagi</button>`;
    return `<button type="button" class="bukti" data-aksi="foto" data-id="${esc(r.id)}">${IKON.gambar}Lihat bukti</button>`;
  }

  function gambarUlangBukti(id) {
    const el = document.querySelector(`.kartu[data-id="${CSS.escape(id)}"] .bukti`);
    const r = daftar.find(x => x.id === id);
    if (el && r) el.outerHTML = htmlBukti(r);
  }

  function htmlAksi(r) {
    const b = (status, kelas, ikon, label) => `<button class="btn kecil ${kelas}" data-aksi="atur" data-status="${status}" data-id="${esc(r.id)}">${ikon}${label}</button>`;
    if (r.status === 'menunggu') return b('aktif', 'btn-hijau', '', 'Aktifkan') + b('ditolak', 'btn-lembut-merah', '', 'Tolak');
    if (r.status === 'aktif') return b('nonaktif', 'btn-kedua', '', 'Nonaktifkan');
    return b('aktif', 'btn-hijau', '', 'Aktifkan');
  }

  function render() {
    kerangka();
    if (layar === 'pengaturan') return renderPengaturan();
    if (layar === 'masukan') return renderMasukan();
    const jumlah = s => daftar.filter(r => !s || r.status === s).length;
    const aktif = daftar.filter(r => r.status === 'aktif');
    const pendapatan = aktif.reduce((a, r) => a + (Number(r.harga) || jual.harga), 0);
    const q = cari.trim().toLowerCase();
    const tampil = daftar.filter(r => (!tab || r.status === tab) && (!q || [r.email, r.buku, r.id].some(x => String(x).toLowerCase().includes(q))));
    // Ringkasan jumlah per status ada di kartu hero; penyaringnya cukup chip di bawahnya (tidak dobel).
    $('#isi').innerHTML = `
      ${kotakGalat()}
      <section class="hero hero-ringkas">
        <div class="hero-uang">
          <small>Pendapatan versi penuh</small>
          <span class="besar angka">${rupiah(pendapatan)}</span>
          <span class="chip-hero">${IKON.label} Harga sekarang ${rupiah(jual.harga)}</span>
        </div>
        <div class="hero-angka">${['menunggu', 'aktif', 'nonaktif', 'ditolak'].map(k => `
          <div style="--warna:${STATUS[k].warna}"><span class="titik-hero"></span><small>${STATUS[k].label}</small><b class="angka">${jumlah(k)}</b></div>`).join('')}</div>
      </section>
      <div class="alat">
        <div class="chip-filter" role="group" aria-label="Filter status">
          ${[['', 'Semua'], ['menunggu', 'Menunggu'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['ditolak', 'Ditolak']].map(([k, l]) =>
            `<button class="chip ${tab === k ? 'aktif' : ''}" data-aksi="tab" data-tab="${k}" aria-pressed="${tab === k}">${l} <i>${jumlah(k)}</i></button>`).join('')}
        </div>
        <label class="cari">${IKON.cari}<input id="kotak-cari" name="cari-pengajuan-admin" type="search" placeholder="Cari email, nama buku, atau kode buku" autocomplete="off" spellcheck="false"></label>
      </div>
      ${tampil.length ? `<div class="daftar">${tampil.map((r, i) => `
        <article class="kartu" data-id="${esc(r.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
          ${htmlBukti(r)}
          <div class="isi">
            <div class="atas">
              <div style="min-width:0"><div class="email">${esc(r.email || '(tanpa email)')}</div>
                <div class="meta">${esc(r.buku || '-')} · <span title="${esc(tanggal(r.t))}">${esc(relatif(r.t))}</span></div></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status] ? STATUS[r.status].label : esc(r.status)}</span>
            </div>
            ${r.harga ? `<div class="harga-aju" title="Harga versi penuh saat bukti transfer dikirim"><b class="angka">${rupiah(r.harga)}</b><small>harga saat pengajuan${
              Number(r.harga) !== Number(jual.harga) ? ' · sekarang ' + rupiah(jual.harga) : ''}</small></div>` : ''}
            <div class="kode" title="Kode buku (ID spreadsheet)"><span>${esc(r.id)}</span><button data-aksi="salin" data-id="${esc(r.id)}">Salin</button></div>
            ${r.status === 'ditolak' && r.alasan ? `<div class="alasan">Alasan: ${esc(r.alasan)}</div>` : ''}
            ${r.diubah && r.diubah !== r.t ? `<div class="meta" style="margin-top:6px">Diubah ${esc(relatif(r.diubah))}</div>` : ''}
            <div class="aksi">${htmlAksi(r)}<button class="btn kecil btn-garis ke-kanan" data-aksi="riwayat" data-id="${esc(r.id)}">${IKON.riwayat.replace('class="ik"', 'class="ik" style="width:16px;height:16px"')}Riwayat${r.riwayat ? ' (' + r.riwayat + ')' : ''}</button></div>
          </div>
        </article>`).join('')}</div>`
      : `<div class="kosong-besar"><div class="ik-besar">${q ? IKON.cari : tab === 'menunggu' ? IKON.cek : IKON.kotakMasuk}</div>
          <b>${q ? 'Tidak ada yang cocok' : tab === 'menunggu' ? 'Semua sudah diproses' : 'Belum ada'}</b>
          ${q ? 'Coba kata kunci lain.' : tab === 'menunggu' ? 'Tidak ada permintaan yang menunggu konfirmasi.' : 'Belum ada pengajuan dengan status ini.'}</div>`}`;
    // Nilai diisi lewat JS (bukan atribut value) supaya isian otomatis browser tidak ikut menimpa.
    const kotak = $('#kotak-cari');
    kotak.value = cari;
    kotak.oninput = () => { cari = kotak.value; const pos = kotak.selectionStart; render(); const k = $('#kotak-cari'); k.focus(); k.setSelectionRange(pos, pos); };
    // Bukti yang menunggu langsung dimuat (paling banyak 6), supaya bisa dicek tanpa mengetuk satu per satu.
    if (tab === 'menunggu') tampil.filter(r => r.ada_foto && foto[r.id] === undefined).slice(0, 6).forEach(r => muatFoto(r.id));
  }

  // ---------- Tampilan: masukan pengguna ----------

  function htmlBalasan(m) {
    const ubah = ubahBalasan[m.id] || !m.dibalas;
    if (!ubah) {
      return `<div class="mk-balasan">
          ${m.emoji ? `<span class="mk-emoji" role="img" aria-label="Reaksi">${esc(m.emoji)}</span>` : ''}
          <div class="mk-balasan-isi"><b>Balasan admin</b>${m.balasan ? `<p>${esc(m.balasan)}</p>` : ''}
            <small>${esc(relatif(m.dibalas))}${m.oleh ? ' · ' + esc(m.oleh) : ''}</small></div>
          <button type="button" class="btn kecil btn-garis" data-aksi="ubah-balasan" data-id="${esc(m.id)}">Ubah</button>
        </div>`;
    }
    return `<div class="mk-tulis" data-id="${esc(m.id)}">
        <div class="mk-emoji-pilih" role="group" aria-label="Reaksi emoji">
          ${emojiMasukan.map(x => `<button type="button" class="${m.emoji === x ? 'aktif' : ''}" data-aksi="pilih-emoji" data-emoji="${esc(x)}" aria-pressed="${m.emoji === x}">${esc(x)}</button>`).join('')}
        </div>
        <textarea rows="2" maxlength="2000" placeholder="Tulis balasan (opsional kalau sudah memilih emoji)…" aria-label="Balasan">${esc(m.balasan)}</textarea>
        <div class="mk-tulis-aksi">
          ${m.dibalas ? `<button type="button" class="btn kecil btn-lembut-merah" data-aksi="hapus-balasan" data-id="${esc(m.id)}">Hapus balasan</button>
            <button type="button" class="btn kecil btn-kedua ke-kanan" data-aksi="batal-balasan" data-id="${esc(m.id)}">Batal</button>` : ''}
          <button type="button" class="btn kecil btn-utama ${m.dibalas ? '' : 'ke-kanan'}" data-aksi="kirim-balasan" data-id="${esc(m.id)}">${IKON.pesan.replace('class="ik"', 'class="ik" style="width:16px;height:16px"')}Kirim balasan</button>
        </div>
      </div>`;
  }

  function renderMasukan() {
    if (masukan === null) { $('#isi').innerHTML = kotakGalat() + kerangkaMemuat(); return; }
    const semua = masukan;
    const jumlah = k => semua.filter(m => (!k ? true : k === 'belum' ? !m.dibalas : m.jenis === k)).length;
    const q = cariMasukan.trim().toLowerCase();
    const tampil = semua.filter(m => (!tabMasukan || (tabMasukan === 'belum' ? !m.dibalas : m.jenis === tabMasukan))
      && (!q || [m.email, m.pesan, m.balasan].some(x => String(x || '').toLowerCase().includes(q))));
    $('#isi').innerHTML = `
      ${kotakGalat()}
      <div class="alat">
        <div class="chip-filter" role="group" aria-label="Filter masukan">
          ${[['belum', 'Belum dibalas'], ['', 'Semua']].concat(Object.keys(JENIS_MASUKAN).map(k => [k, JENIS_MASUKAN[k][0] + ' ' + JENIS_MASUKAN[k][1]])).map(([k, l]) =>
            `<button class="chip ${tabMasukan === k ? 'aktif' : ''}" data-aksi="tab-masukan" data-tab="${k}" aria-pressed="${tabMasukan === k}">${l} <i>${jumlah(k)}</i></button>`).join('')}
        </div>
        <label class="cari">${IKON.cari}<input id="cari-masukan" name="cari-masukan-admin" type="search" placeholder="Cari email atau isi pesan" autocomplete="off" spellcheck="false"></label>
      </div>
      ${tampil.length ? `<div class="daftar daftar-masukan">${tampil.map((m, i) => `
        <article class="kartu kartu-masukan ${m.dibalas ? '' : 'baru'}" data-masukan="${esc(m.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
          <div class="atas">
            <div style="min-width:0"><div class="email">${esc(m.email)}</div>
              <div class="meta"><span title="${esc(tanggal(m.t))}">${esc(tanggal(m.t))}</span></div></div>
            <span class="status jenis-${esc(m.jenis)}">${(JENIS_MASUKAN[m.jenis] || JENIS_MASUKAN.pengembangan).join(' ')}</span>
          </div>
          <p class="mk-pesan">${esc(m.pesan)}</p>
          ${htmlBalasan(m)}
        </article>`).join('')}</div>`
      : `<div class="kosong-besar"><div class="ik-besar">${q ? IKON.cari : tabMasukan === 'belum' ? IKON.cek : IKON.pesan}</div>
          <b>${q ? 'Tidak ada yang cocok' : tabMasukan === 'belum' ? 'Semua sudah dibalas' : 'Belum ada masukan'}</b>
          ${q ? 'Coba kata kunci lain.' : 'Masukan dikirim pengguna dari halaman Kebijakan Privasi → Kontak.'}</div>`}`;
    const kotak = $('#cari-masukan');
    kotak.value = cariMasukan;
    kotak.oninput = () => { cariMasukan = kotak.value; const pos = kotak.selectionStart; render(); const k = $('#cari-masukan'); k.focus(); k.setSelectionRange(pos, pos); };
  }

  /** Kirim / hapus balasan satu masukan. hapus: emoji & pesan dikosongkan. */
  async function kirimBalasan(id, tombol, hapus) {
    const m = (masukan || []).find(x => x.id === id);
    const tulis = document.querySelector(`.mk-tulis[data-id="${CSS.escape(id)}"]`);
    if (!m || !tulis) return;
    const pilih = tulis.querySelector('.mk-emoji-pilih .aktif');
    const emoji = hapus ? '' : pilih ? pilih.dataset.emoji : '';
    const balasan = hapus ? '' : tulis.querySelector('textarea').value.trim();
    if (!hapus && !emoji && !balasan) return kabar('Pilih emoji atau tulis balasan dulu.');
    const pulih = sibuk(tombol, hapus ? 'Menghapus…' : 'Mengirim…');
    try {
      const j = await api({ aksi: 'balasMasukan', id, emoji, balasan });
      Object.assign(m, j.masukan);
      delete ubahBalasan[id];
      kabar(hapus ? 'Balasan dihapus' : 'Balasan terkirim ✔');
      render();
    } catch (e) {
      pulih();
      if (!e.sesi) kabar(e.message);
    }
  }

  // ---------- Tampilan: pengaturan penjualan ----------

  function bukaPengaturan() {
    layar = 'pengaturan';
    formJual = JSON.parse(JSON.stringify(jual));
    formJual.rekening = formJual.rekening.map((r, i) => Object.assign(r, { asal: i, baru: null }));
    if (!formJual.rekening.length) formJual.rekening.push(rekeningKosong());
    qrisTersimpan = {};
    render();
    window.scrollTo(0, 0);
    jual.rekening.forEach((r, i) => {
      if (!r.qris) return;
      api({ aksi: 'lihatQris', rek: i }).then(j => {
        qrisTersimpan[i] = j.qris || '';
        // Gambar dipasang langsung (tanpa render ulang) supaya ketikan yang sedang berlangsung tidak terganggu.
        if (layar !== 'pengaturan') return;
        document.querySelectorAll('[data-asal="' + i + '"]').forEach(kotak => { kotak.innerHTML = j.qris ? '<img src="' + esc(j.qris) + '" alt="QRIS">' : 'Gagal dimuat'; });
      }).catch(e => { if (!e.sesi) kabar(e.message); });
    });
  }

  const rekeningKosong = () => ({ bank: '', nomor: '', atasNama: '', qris: false, asal: -1, baru: null });
  const punyaQris = r => (r.baru !== null ? !!r.baru : r.qris);
  const gambarQris = r => (r.baru !== null ? r.baru : r.qris ? qrisTersimpan[r.asal] || '' : '');

  /** Isian form → formJual (dipanggil sebelum render ulang supaya ketikan tidak hilang). */
  function bacaForm() {
    if (layar !== 'pengaturan' || !$('#form-jual')) return;
    const pilih = document.querySelector('input[name="aturan"]:checked');
    formJual.aturan = pilih ? pilih.value : formJual.aturan;
    formJual.batasTransaksi = Number($('#batas-transaksi').value) || 0;
    formJual.batasPeriode = Number($('#batas-periode').value) || 0;
    formJual.harga = Number(String($('#harga').value).replace(/\D/g, '')) || 0;
    formJual.selaluTampil = $('#selalu-tampil').checked;
    formJual.rekening = Array.from(document.querySelectorAll('.rekening-baris')).map((b, i) => Object.assign({}, formJual.rekening[i], {
      bank: b.querySelector('[data-f="bank"]').value.trim(), nomor: b.querySelector('[data-f="nomor"]').value.trim(), atasNama: b.querySelector('[data-f="atasNama"]').value.trim(),
    }));
  }

  const kepalaPanel = (ikon, judul, bantu) => `<div class="panel-kepala"><span class="ik-bulat">${ikon}</span><div><h2>${judul}</h2>${bantu ? `<p class="bantu">${bantu}</p>` : ''}</div></div>`;

  function renderPengaturan() {
    if (!formJual) { formJual = JSON.parse(JSON.stringify(jual)); formJual.rekening = formJual.rekening.map((r, i) => Object.assign(r, { asal: i, baru: null })); }
    const f = formJual;
    const pakaiTrx = f.aturan !== 'periode', pakaiPer = f.aturan !== 'transaksi';
    $('#isi').innerHTML = `
      ${kotakGalat()}
      <form id="form-jual" class="form-jual" autocomplete="off">
        <section class="panel">
          ${kepalaPanel(IKON.kalender, 'Kapan pengguna ditagih', 'Selama masa gratis pengguna bebas mencatat. Setelah lewat, pencatatan transaksi baru dikunci sampai versi penuh dibeli.')}
          <div class="opsi-aturan">
            ${[['transaksi', 'Setelah jumlah transaksi', 'Dihitung dari jumlah baris di sheet Transaksi buku itu.'],
              ['periode', 'Setelah jumlah periode gajian', 'Dihitung sejak buku dibuat, mengikuti tanggal gajian buku itu.'],
              ['keduanya', 'Mana yang lebih dulu', 'Dikunci begitu salah satu batas tercapai.']].map(([k, l, ket]) => `
              <label class="opsi"><input type="radio" name="aturan" value="${k}" ${f.aturan === k ? 'checked' : ''}><span><b>${l}</b><small>${ket}</small></span></label>`).join('')}
          </div>
          <div class="dua">
            <label class="isian ${pakaiTrx ? '' : 'redup'}"><span>Batas transaksi gratis</span>
              <span class="dengan-satuan"><input id="batas-transaksi" type="number" min="1" max="100000" inputmode="numeric" value="${esc(f.batasTransaksi)}" ${pakaiTrx ? '' : 'disabled'}><em>transaksi</em></span></label>
            <label class="isian ${pakaiPer ? '' : 'redup'}"><span>Batas periode gratis</span>
              <span class="dengan-satuan"><input id="batas-periode" type="number" min="1" max="120" inputmode="numeric" value="${esc(f.batasPeriode)}" ${pakaiPer ? '' : 'disabled'}><em>periode gajian</em></span></label>
          </div>
        </section>

        <div style="display:grid;gap:14px;align-content:start">
          <section class="panel">
            ${kepalaPanel(IKON.label, 'Harga versi penuh', 'Sekali bayar, berlaku seumur hidup untuk satu buku (seluruh keluarga).')}
            <label class="isian"><span>Harga</span><span class="dengan-satuan depan"><em>Rp</em><input id="harga" inputmode="numeric" value="${esc(Number(f.harga || 0).toLocaleString('id-ID'))}"></span></label>
          </section>
          <section class="panel">
            ${kepalaPanel(IKON.mata, 'Menu "Versi penuh" di aplikasi')}
            <label class="saklar">
              <span><b>Selalu tampilkan</b><small>${f.selaluTampil !== false
                ? 'Aktif: menu ⚙️ → Versi penuh selalu terlihat, termasuk selama masa gratis.'
                : 'Mati: menu ⚙️ → Versi penuh baru muncul setelah syarat "Kapan pengguna ditagih" terpenuhi (masa gratis habis).'}</small></span>
              <input type="checkbox" id="selalu-tampil" role="switch" ${f.selaluTampil !== false ? 'checked' : ''}><i aria-hidden="true"></i>
            </label>
          </section>
        </div>

        <section class="panel lebar">
          ${kepalaPanel(IKON.bank, 'Rekening tujuan & QRIS', 'Ditampilkan ke pembeli di layar Versi penuh. Bisa bank atau e-wallet, maksimal 5. Setiap rekening boleh punya satu QRIS (opsional).')}
          <div class="rekening-daftar">
            <div class="rekening-judul" aria-hidden="true"><span>Bank / e-wallet</span><span>Nomor rekening / HP</span><span>Atas nama</span><span>QRIS</span><span></span></div>
            ${f.rekening.map((r, i) => {
            const g = gambarQris(r), ada = punyaQris(r);
            return `
            <div class="rekening-baris">
              <div class="rekening-isian">
                <input data-f="bank" name="rek-bank-${i}" autocomplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" aria-label="Bank / e-wallet" placeholder="Bank / e-wallet (mis. BCA, DANA)" value="${esc(r.bank)}" maxlength="40">
                <input data-f="nomor" name="rek-nomor-${i}" autocomplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" aria-label="Nomor rekening / HP" placeholder="Nomor rekening / HP" value="${esc(r.nomor)}" maxlength="40" inputmode="numeric">
                <input data-f="atasNama" name="rek-atas-nama-${i}" autocomplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" aria-label="Atas nama" placeholder="Atas nama (opsional)" value="${esc(r.atasNama && r.atasNama !== 'null' ? r.atasNama : '')}" maxlength="60">
                <button type="button" class="ikon-btn hapus" data-aksi="hapus-rekening" data-i="${i}" aria-label="Hapus rekening" title="Hapus rekening" ${f.rekening.length < 2 ? 'disabled' : ''}>${IKON.sampah}</button>
              </div>
              <div class="qris">
                ${ada ? `<button type="button" class="qris-pratinjau" data-aksi="buka-qris" data-i="${i}" ${r.baru === null && r.qris ? `data-asal="${r.asal}"` : ''}
                    title="Lihat, ganti, atau hapus QRIS" aria-label="Lihat, ganti, atau hapus QRIS ${esc(r.bank)}">${g ? `<img src="${esc(g)}" alt="">` : '<span class="putar" style="color:var(--muted)"></span>'}</button>`
                  : `<label class="qris-pratinjau qris-kosong" title="Unggah QRIS"><input type="file" class="file-qris" data-i="${i}" accept="image/*" hidden>${IKON.unggah}<span>Unggah</span></label>`}
              </div>
            </div>`; }).join('')}</div>
          ${f.rekening.length < 5 ? `<button type="button" class="btn btn-garis" style="margin-top:12px" data-aksi="tambah-rekening">${IKON.tambah}Tambah rekening</button>` : ''}
        </section>

        <div class="simpan-bar lebar">
          <button type="button" class="btn btn-kedua" data-aksi="kembali">Batal</button>
          <button type="button" class="btn btn-utama" data-aksi="simpan-jual">Simpan pengaturan</button>
        </div>
      </form>`;
    $('#form-jual').onchange = e => {
      if (e.target.name === 'aturan' || e.target.id === 'selalu-tampil') { bacaForm(); render(); }
      if (e.target.id === 'harga') { bacaForm(); e.target.value = formJual.harga.toLocaleString('id-ID'); }
    };
    document.querySelectorAll('#form-jual .file-qris').forEach(inp => pasangFileQris(inp));
  }

  /** Input file QRIS: gambar diperkecil lalu dipasang di rekening ke-i (tersimpan saat Simpan pengaturan ditekan). */
  function pasangFileQris(inp, sesudah) {
    inp.onchange = async e => {
      e.stopPropagation();
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const gambar = await kecilkanQris(file);
        if (sesudah) sesudah();
        bacaForm();
        formJual.rekening[Number(inp.dataset.i)].baru = gambar;
        render();
      } catch (err) { kabar(err.message); }
    };
  }

  /** Overlay QRIS: gambar besar + tombol Ganti & Hapus. */
  function bukaQris(i) {
    bacaForm();
    const r = formJual.rekening[i];
    const g = gambarQris(r);
    const kotak = bukaLapis(`
      <div class="dialog dialog-qris">
        <div class="kepala-dialog"><h2>QRIS ${esc(r.bank || 'rekening')}</h2><button class="ikon-btn" data-tutup aria-label="Tutup">${IKON.silang}</button></div>
        <div class="qris-besar" ${r.baru === null && r.qris ? `data-asal="${r.asal}"` : ''}>${g ? `<img src="${esc(g)}" alt="QRIS ${esc(r.bank)}">` : '<span class="putar" style="color:var(--muted)"></span>'}</div>
        ${r.nomor ? `<p class="qris-info">${esc(r.bank)} · ${esc(r.nomor)}${r.atasNama ? ' · a.n. ' + esc(r.atasNama) : ''}</p>` : ''}
        <div class="tombol-dialog">
          <button type="button" class="btn btn-lembut-merah" data-qris-hapus>${IKON.sampah}Hapus QRIS</button>
          <label class="btn btn-utama tombol-file"><input type="file" class="file-qris" data-i="${i}" accept="image/*" hidden>${IKON.unggah}Ganti QRIS</label>
        </div>
        <p class="bantu" style="text-align:center;margin-top:10px">Perubahan tersimpan setelah menekan <b>Simpan pengaturan</b>.</p>
      </div>`, true);
    const tutup = () => { kotak.hidden = true; kotak.onclick = null; document.removeEventListener('keydown', escQris); };
    const escQris = e => { if (e.key === 'Escape') tutup(); };
    document.addEventListener('keydown', escQris);
    pasangFileQris(kotak.querySelector('.file-qris'), tutup);
    kotak.onclick = e => {
      e.stopPropagation();
      if (e.target === kotak || e.target.closest('[data-tutup]')) return tutup();
      if (e.target.closest('[data-qris-hapus]')) {
        tutup();
        formJual.rekening[i].baru = '';
        render();
        kabar('QRIS dihapus · tekan Simpan pengaturan');
      }
    };
  }

  /** Gambar QRIS diperkecil (sisi terpanjang ≤ 1000 px) tanpa mengaburkan kotak-kotaknya. */
  function kecilkanQris(file) {
    return new Promise((ok, gagal) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Gambar tidak bisa dibuka. Pilih file JPG/PNG.')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const skala = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * skala);
        c.height = Math.round(img.naturalHeight * skala);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = skala < 1;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const png = c.toDataURL('image/png');
        ok(png.length < 1.5e6 ? png : c.toDataURL('image/jpeg', 0.92));
      };
      img.src = url;
    });
  }

  async function simpanJual(tombol) {
    bacaForm();
    const f = formJual;
    const rek = f.rekening.filter(r => r.bank || r.nomor || r.atasNama || punyaQris(r));
    const salah = f.aturan !== 'periode' && !(f.batasTransaksi >= 1) ? 'Isi batas transaksi gratis (minimal 1).'
      : f.aturan !== 'transaksi' && !(f.batasPeriode >= 1) ? 'Isi batas periode gratis (minimal 1).'
      : !(f.harga >= 1000) ? 'Isi harga (minimal Rp1.000).'
      : rek.some(r => !r.bank || !r.nomor) ? 'Setiap rekening wajib berisi nama bank/e-wallet dan nomornya.'
      : !rek.length ? 'Isi minimal satu rekening.' : '';
    if (salah) { galat = salah; render(); window.scrollTo(0, 0); return; }
    const pulih = sibuk(tombol, 'Menyimpan…');
    try {
      const rekening = rek.map(r => ({ bank: r.bank, nomor: r.nomor, atasNama: r.atasNama,
        qrisAsal: r.baru === null && r.qris ? r.asal : -1, qrisBaru: r.baru || '' }));
      const j = await api({ aksi: 'simpanJual', jual: Object.assign({}, f, { rekening }) });
      jual = j.jual;
      galat = '';
      layar = 'pengajuan';
      formJual = null;
      kabar('Pengaturan penjualan disimpan ✔');
      render();
    } catch (e) {
      pulih();
      if (e.sesi) return;
      galat = e.message;
      render();
      window.scrollTo(0, 0);
    }
  }

  // ---------- Dialog ----------

  const pilihan = () => ({
    aktif: { ikon: IKON.cek, warna: 'var(--ok)', latar: 'var(--ok-bg)', judul: 'Aktifkan versi penuh?', tombol: 'Aktifkan', proses: 'Mengaktifkan…', kelas: 'btn-hijau', selesai: 'Versi penuh diaktifkan ✔',
      isi: 'Pastikan transfer ' + rupiah(jual.harga) + ' sudah masuk. Versi penuh langsung aktif untuk seluruh keluarga di buku ini saat aplikasinya dibuka.' },
    nonaktif: { ikon: IKON.larang, warna: 'var(--info)', latar: 'var(--info-bg)', judul: 'Nonaktifkan versi penuh?', tombol: 'Nonaktifkan', proses: 'Menonaktifkan…', kelas: 'btn-merah', selesai: 'Versi penuh dinonaktifkan',
      isi: 'Pencatatan transaksi baru di buku ini langsung dikunci saat aplikasinya dibuka lagi. Bisa diaktifkan lagi kapan saja.' },
    ditolak: { ikon: IKON.silang, warna: 'var(--bad)', latar: 'var(--bad-bg)', judul: 'Tolak permintaan ini?', tombol: 'Tolak', proses: 'Menolak…', kelas: 'btn-merah', selesai: 'Permintaan ditolak',
      isi: 'Pilih alasannya. Alasan ini yang akan dilihat pembeli di aplikasi, lalu mereka bisa mengirim ulang bukti.' },
  });

  /** Lapisan dialog; di mode mobile tampil sebagai lembar dari bawah. */
  function bukaLapis(html, lembar) {
    const kotak = $('#dialog');
    kotak.classList.toggle('lembar', !!lembar);
    kotak.innerHTML = html;
    kotak.hidden = false;
    return kotak;
  }

  /**
   * Dialog konfirmasi. kerjakan(alasan) dijalankan saat tombol utama ditekan; selama itu tombolnya menampilkan putaran,
   * dan dialog baru tertutup setelah selesai. Hasil: true kalau berhasil, false kalau batal / gagal.
   */
  function konfirmasi(status, r, kerjakan) {
    const p = pilihan()[status];
    const tolak = status === 'ditolak';
    const kotak = bukaLapis(`
      <div class="dialog">
        <div class="ikon" style="background:${p.latar};color:${p.warna}">${p.ikon}</div>
        <h2>${p.judul}</h2>
        <p>${p.isi}</p>
        ${r ? `<div class="siapa"><b>${esc(r.email)}</b><span>Buku ${esc(r.buku)} · dikirim ${esc(tanggal(r.t))}${r.harga ? ' · ' + rupiah(r.harga) : ''}</span></div>` : ''}
        ${tolak ? `
          <div class="pilihan">
            ${daftarAlasan().map((a, i) => `<label><input type="radio" name="alasan" value="${esc(a)}" ${i ? '' : 'checked'}><span>${esc(a)}</span></label>`).join('')}
            <label><input type="radio" name="alasan" value=""><span>Lainnya (tulis sendiri)</span></label>
          </div>
          <textarea id="alasan-lain" maxlength="300" placeholder="Tulis alasannya…" hidden></textarea>
          <div class="pratinjau">Yang dilihat pembeli:<div id="pratinjau-alasan"></div></div>` : ''}
        <div class="tombol-dialog">
          <button class="btn btn-kedua" data-jawab="0">Batal</button>
          <button class="btn ${p.kelas}" data-jawab="1">${p.tombol}</button>
        </div>
      </div>`, true);
    const alasan = () => {
      if (!tolak) return '';
      const pilih = kotak.querySelector('input[name="alasan"]:checked');
      return pilih && pilih.value ? pilih.value : kotak.querySelector('#alasan-lain').value;
    };
    const segarkan = () => {
      if (!tolak) return;
      kotak.querySelector('#alasan-lain').hidden = !!kotak.querySelector('input[name="alasan"]:checked').value;
      const a = alasan().trim();
      kotak.querySelector('#pratinjau-alasan').textContent = '❌ Bukti transfer ditolak. Alasan: ' + (a || '…');
      kotak.querySelector('[data-jawab="1"]').disabled = !a;
    };
    segarkan();
    kotak.oninput = segarkan;
    kotak.querySelector('[data-jawab="1"]').focus();
    return new Promise(ok => {
      let bekerja = false;
      const selesai = hasil => {
        kotak.hidden = true;
        kotak.onclick = kotak.oninput = null;
        document.removeEventListener('keydown', tombolKeyboard);
        ok(hasil);
      };
      const tombolKeyboard = e => { if (e.key === 'Escape' && !bekerja) selesai(false); };
      document.addEventListener('keydown', tombolKeyboard);
      kotak.onclick = async e => {
        e.stopPropagation();
        if (bekerja) return;
        const radio = e.target.closest('input[name="alasan"]');
        if (radio) {
          segarkan();
          if (!radio.value) setTimeout(() => kotak.querySelector('#alasan-lain').focus(), 0);
          return;
        }
        const b = e.target.closest('[data-jawab]');
        if (b && !b.disabled && b.dataset.jawab === '1') {
          bekerja = true;
          kotak.querySelector('[data-jawab="0"]').disabled = true;
          const pulih = sibuk(b, p.proses);
          try {
            await kerjakan(alasan().trim());
            selesai(true);
          } catch (err) {
            bekerja = false;
            pulih();
            kotak.querySelector('[data-jawab="0"]').disabled = false;
            if (err.sesi) return selesai(false);
            kabar(err.message);
          }
        } else if (b && !b.disabled) selesai(false);
        else if (e.target === kotak) selesai(false); // ketuk di luar kotak = batal
      };
    });
  }

  /** Lembar akun (mode mobile; di mode web isinya ada di sidebar). */
  function bukaAkun() {
    const kotak = bukaLapis(`
      <div class="dialog">
        <div class="kepala-dialog"><h2>Akun</h2><button class="ikon-btn" data-tutup aria-label="Tutup">${IKON.silang}</button></div>
        <div class="kartu-akun" style="margin-bottom:14px"><span class="avatar">${inisial()}</span><span class="isi"><b>${esc(info.admin)}</b><small>Admin</small></span></div>
        <div class="menu-akun">
          <h3>Tampilan</h3>
          ${pilihMode()}
          <h3>Lainnya</h3>
          ${info.sheet ? `<a class="nav-item" href="${esc(info.sheet)}" target="_blank" rel="noopener">${IKON.tabel}<span class="teks">Buka spreadsheet pengajuan</span></a>` : ''}
          <button class="nav-item" data-aksi="ganti">${IKON.ganti}<span class="teks">Ganti akun Google</span></button>
          <button class="nav-item bahaya" data-aksi="keluar">${IKON.keluar}<span class="teks">Keluar</span></button>
        </div>
      </div>`, true);
    const tutup = () => { kotak.hidden = true; kotak.onclick = null; document.removeEventListener('keydown', escAkun); };
    const escAkun = e => { if (e.key === 'Escape') tutup(); };
    document.addEventListener('keydown', escAkun);
    // Tombol di dalam lembar ditangani pendengar klik utama (data-aksi); lembar ditutup setelahnya.
    kotak.onclick = e => {
      if (e.target === kotak || e.target.closest('[data-tutup]')) { e.stopPropagation(); tutup(); return; }
      if (e.target.closest('[data-aksi], a')) setTimeout(() => { if (!e.target.closest('[data-aksi="mode"], [data-aksi="tema"]')) tutup(); else bukaAkun(); }, 0);
    };
  }

  // ---------- Riwayat transaksi satu buku ----------

  const WARNA_PERISTIWA = p => (/^Diaktifkan/.test(p) ? STATUS.aktif.warna : /^Ditolak/.test(p) ? STATUS.ditolak.warna
    : /^Dinonaktifkan/.test(p) ? STATUS.nonaktif.warna : /^Bukti/.test(p) ? STATUS.menunggu.warna : 'var(--muted)');

  // Rincian harga/aturan/rekening & foto hanya di kejadian kirim bukti; keputusan (aktif/tolak/nonaktif) cukup alasannya.
  const kirimBukti = x => /^Bukti/.test(x.peristiwa);
  const rincian = x => {
    if (!kirimBukti(x)) return x.alasan ? '<div class="lm-alasan">' + esc(x.alasan) + '</div>' : '';
    const baris = [x.harga && ['Harga', '<b>' + rupiah(x.harga) + '</b>'], x.aturan && ['Masa gratis', esc(x.aturan)],
      x.rekening && ['Rekening', esc(x.rekening)]].filter(Boolean);
    return baris.length ? '<dl>' + baris.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>' : '';
  };

  const idFoto = link => (String(link || '').match(/\/file\/d\/([\w-]+)/) || [])[1] || '';
  const fotoRiwayat = {}; // ID file → data URL

  /** Foto bukti dari riwayat dibuka di lightbox (di atas dialog riwayat), tanpa ke Google Drive. */
  async function lihatFoto(idFile, tombol) {
    const besar = $('#foto-besar'), img = besar.querySelector('img');
    if (!fotoRiwayat[idFile]) {
      const pulih = sibuk(tombol, 'Memuat foto…');
      try {
        fotoRiwayat[idFile] = (await api({ aksi: 'fotoFile', foto: idFile })).foto;
      } catch (e) {
        if (!e.sesi) kabar(e.message);
        return;
      } finally {
        pulih();
      }
    }
    img.src = fotoRiwayat[idFile];
    besar.hidden = false;
  }

  async function bukaRiwayat(r) {
    const isi = daftarRiwayat => `
      <div class="dialog" role="dialog" aria-label="Riwayat transaksi" style="max-width:540px">
        <div class="kepala-dialog"><h2>Riwayat transaksi</h2><button class="ikon-btn" data-tutup aria-label="Tutup">${IKON.silang}</button></div>
        <div class="siapa"><b>${esc(r.email || '(tanpa email)')}</b><span>Buku ${esc(r.buku || '-')} · ${esc(r.id)}</span></div>
        ${daftarRiwayat === null ? '<div class="kerangka" style="height:84px;margin-bottom:10px"></div>'.repeat(3)
          : !daftarRiwayat.length ? '<p class="kosong-riwayat">Belum ada riwayat untuk buku ini.</p>'
          : `<ol class="linimasa">${daftarRiwayat.map(x => `
            <li style="--warna:${WARNA_PERISTIWA(x.peristiwa)}">
              <span class="titik-lm" aria-hidden="true"></span>
              <div class="lm-isi">
                <div class="lm-kepala"><b>${esc(x.peristiwa)}</b><small>${esc(tanggal(x.t))}${x.oleh ? ' · oleh ' + esc(x.oleh) : ''}</small></div>
                ${rincian(x)}
                ${kirimBukti(x) && idFoto(x.link) ? `<button type="button" class="lm-bukti" data-foto="${esc(idFoto(x.link))}">${IKON.gambar}Lihat bukti transfer</button>` : ''}
              </div>
            </li>`).join('')}</ol>`}
      </div>`;
    const kotak = bukaLapis(isi(null), true);
    const tutup = () => { kotak.hidden = true; kotak.onclick = null; document.removeEventListener('keydown', esc_); };
    const esc_ = e => {
      if (e.key !== 'Escape') return;
      if (!$('#foto-besar').hidden) $('#foto-besar').hidden = true;
      else tutup();
    };
    document.addEventListener('keydown', esc_);
    kotak.onclick = e => {
      e.stopPropagation();
      const f = e.target.closest('[data-foto]');
      if (f) return lihatFoto(f.dataset.foto, f);
      if (e.target === kotak || e.target.closest('[data-tutup]')) tutup();
    };
    try {
      const j = await api({ aksi: 'riwayat', id: r.id });
      if (!kotak.hidden) kotak.innerHTML = isi(j.riwayat || []);
    } catch (e) {
      tutup();
      if (!e.sesi) kabar(e.message);
    }
  }

  let jedaKabar = 0;
  function kabar(teks) {
    const k = $('#kabar');
    k.textContent = teks;
    k.hidden = false;
    clearTimeout(jedaKabar);
    jedaKabar = setTimeout(() => { k.hidden = true; }, 2600);
  }

  // ---------- Aksi ----------

  document.addEventListener('click', async e => {
    if (e.target.closest('#foto-besar')) { $('#foto-besar').hidden = true; return; }
    const el = e.target.closest('[data-aksi]');
    if (!el) return;
    const aksi = el.dataset.aksi;
    if (aksi === 'masuk' || aksi === 'ganti') return masuk(aksi === 'masuk' ? el : null);
    if (aksi === 'masuk-lagi') return masukLagi(el);
    if (aksi === 'mode') {
      if (layar === 'pengaturan') bacaForm();
      pasangTampilan(el.dataset.mode, true);
      if (info.admin) render();
      return kabar('Tampilan ' + (tampilan === 'web' ? 'Web' : 'Mobile'));
    }
    if (aksi === 'akun') return bukaAkun();
    if (aksi === 'tema') {
      const baru = gantiTema();
      if (layar === 'pengaturan') bacaForm();
      if (info.admin) render();
      else tampilMasuk('');
      return kabar(baru === 'dark' ? 'Mode gelap' : 'Mode terang');
    }
    // Token hampir / baru saja habis: diperpanjang diam-diam saat halaman diketuk (seperti di aplikasi).
    const segar = GOOGLE.segarkanKalauPerlu && GOOGLE.segarkanKalauPerlu();
    if (segar) { const ok = await segar; if (ok && sesiHabis) { sesiHabis = false; galat = ''; } }
    if (aksi === 'keluar') { GOOGLE.keluar(); daftar = []; info = { admin: '', sheet: '' }; dimuat = false; return tampilMasuk(''); }
    if (aksi === 'muat') {
      if (layar === 'pengaturan') bacaForm();
      const pulih = sibuk(el);
      await muat();
      pulih();
      if (!sesiHabis && !galat) kabar('Data diperbarui');
      return;
    }
    if (aksi === 'ke') {
      galat = '';
      if (el.dataset.layar === 'pengaturan') return layar === 'pengaturan' ? undefined : bukaPengaturan();
      if (el.dataset.layar === 'masukan') { layar = 'masukan'; formJual = null; render(); return window.scrollTo(0, 0); }
      layar = 'pengajuan';
      formJual = null;
      render();
      return window.scrollTo(0, 0);
    }
    if (aksi === 'kembali') { galat = ''; layar = 'pengajuan'; formJual = null; return render(); }
    if (aksi === 'tambah-rekening') { bacaForm(); formJual.rekening.push(rekeningKosong()); render(); return; }
    if (aksi === 'hapus-rekening') { bacaForm(); formJual.rekening.splice(Number(el.dataset.i), 1); return render(); }
    if (aksi === 'buka-qris') return bukaQris(Number(el.dataset.i));
    if (aksi === 'simpan-jual') return simpanJual(el);
    if (aksi === 'tab') { tab = el.dataset.tab; return render(); }
    if (aksi === 'tab-masukan') { tabMasukan = el.dataset.tab; return render(); }
    if (aksi === 'pilih-emoji') {
      // Dipilih langsung di DOM (tanpa render ulang) supaya ketikan balasan tidak hilang; ketuk lagi = batal pilih.
      const nyala = !el.classList.contains('aktif');
      el.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('aktif'); b.setAttribute('aria-pressed', 'false'); });
      if (nyala) { el.classList.add('aktif'); el.setAttribute('aria-pressed', 'true'); }
      return;
    }
    if (aksi === 'ubah-balasan') { ubahBalasan[el.dataset.id] = true; return render(); }
    if (aksi === 'batal-balasan') { delete ubahBalasan[el.dataset.id]; return render(); }
    if (aksi === 'kirim-balasan') return kirimBalasan(el.dataset.id, el, false);
    if (aksi === 'hapus-balasan') return kirimBalasan(el.dataset.id, el, true);
    if (aksi === 'foto') { delete foto[el.dataset.id]; return muatFoto(el.dataset.id); }
    if (aksi === 'perbesar') {
      $('#foto-besar img').src = foto[el.dataset.id];
      $('#foto-besar').hidden = false;
      return;
    }
    if (aksi === 'salin') {
      try { await navigator.clipboard.writeText(el.dataset.id); kabar('Kode buku disalin'); } catch (err) { kabar(el.dataset.id); }
      return;
    }
    if (aksi === 'riwayat') { const r = daftar.find(x => x.id === el.dataset.id); if (r) bukaRiwayat(r); return; }
    if (aksi === 'atur') {
      const r = daftar.find(x => x.id === el.dataset.id);
      const status = el.dataset.status;
      const ok = await konfirmasi(status, r, async alasan => {
        await api({ aksi: 'atur', id: el.dataset.id, status, alasan });
        if (r) Object.assign(r, { status, alasan: status === 'ditolak' ? alasan : '', diubah: new Date().toISOString(), riwayat: (r.riwayat || 0) + 1 });
      });
      if (!ok) return;
      galat = '';
      kabar(pilihan()[status].selesai);
      render();
    }
  });

  if (tokenSaya()) muat();
  else tampilMasuk(GOOGLE.email() ? 'Sesi login sudah habis. Masuk lagi.' : '');
})();
