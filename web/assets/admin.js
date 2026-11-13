/**
 * Halaman admin lisensi (web/admin.html):
 *   - Pengajuan: ringkasan per status (sekaligus filter), pencarian, kartu pengajuan + foto bukti transfer,
 *     tombol Aktifkan / Tolak (dengan alasan) / Nonaktifkan.
 *   - Pengaturan penjualan: kapan ditagih (jumlah transaksi / periode gajian / mana yang lebih dulu), harga,
 *     rekening tujuan (boleh lebih dari satu, masing-masing boleh punya satu QRIS). Dipakai aplikasi & bot (lihat jual_ di bot/Kode.gs).
 * Semua data ada di bot (bot/Kode.gs → apiLisensi_); bot hanya melayani akun Google pemilik bot (atau ADMIN_EMAIL).
 * Sengaja tanpa terjemahan: halaman ini khusus pemilik.
 */
(() => {
  const BOT = (KONFIG.bayar || {}).urlBot;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
  const STATUS = {
    menunggu: { label: 'Menunggu', ikon: '⏳', warna: 'var(--warn)' },
    aktif: { label: 'Aktif', ikon: '✅', warna: 'var(--ok)' },
    nonaktif: { label: 'Nonaktif', ikon: '⛔', warna: 'var(--info)' },
    ditolak: { label: 'Ditolak', ikon: '❌', warna: 'var(--bad)' },
  };
  /** Alasan penolakan siap pilih; teks inilah yang dilihat pembeli di layar Versi penuh. */
  const daftarAlasan = () => [
    'Nominal transfer tidak sesuai (harus ' + rupiah(jual.harga) + ')',
    'Transfer belum masuk ke rekening admin',
    'Foto bukti tidak jelas atau terpotong',
    'Nomor tujuan transfer salah',
    'Bukti transfer sudah pernah dipakai untuk buku lain',
  ];

  /** Ikon garis sederhana (warna mengikuti teks). */
  const svg = d => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IKON = {
    tabel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
    muat: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>'),
    akun: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    keluar: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5M15 12H4"/>'),
    atur: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    kembali: svg('<path d="M15 18l-6-6 6-6"/>'),
  };

  let daftar = [];
  let tab = 'menunggu';
  let cari = '';
  let galat = '';
  let sesiHabis = false; // token login habis / ditolak bot: kotak galat diberi tombol "Masuk lagi"
  const PESAN_SESI = 'Sesi login sudah habis. Masuk lagi untuk melanjutkan; layar ini tetap seperti semula.';
  let layar = 'pengajuan'; // 'pengajuan' | 'pengaturan'
  let info = { admin: '', sheet: '' };
  let jual = { aturan: 'transaksi', batasTransaksi: 450, batasPeriode: 3, harga: Number((KONFIG.bayar || {}).harga) || 0, rekening: [], selaluTampil: true };
  // Salinan pengaturan yang sedang diubah. Tiap rekening: { bank, nomor, atasNama, qris (punya QRIS tersimpan),
  // asal (nomor urut rekening tersimpan, -1 = baru), baru (data URL QRIS yang dipilih, '' = dihapus, null = tidak diubah) }.
  let formJual = null;
  let qrisTersimpan = {}; // nomor urut rekening tersimpan → data URL QRIS-nya (dimuat saat layar Pengaturan dibuka)
  const foto = {};      // id buku → data URL bukti ('' = gagal dimuat)
  const memuat = {};    // id buku → sedang dimuat

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
    try {
      const r = await fetch(BOT + '?api=1', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token }, isi)) });
      j = await r.json();
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke bot. Periksa koneksi internet.');
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
      ? `<div class="galat galat-sesi"><span>${esc(galat)}</span><button type="button" class="btn-utama" data-aksi="masuk-lagi">Masuk lagi</button></div>`
      : `<div class="galat">${esc(galat)}</div>`;
  }

  /** Masuk lagi dengan akun yang sama (tanpa pilihan akun), lalu data dimuat ulang tanpa meninggalkan layar ini. */
  async function masukLagi(tombol) {
    tombol.disabled = true;
    try {
      await GOOGLE.masuk(false);
      sesiHabis = false;
      galat = '';
      if (layar === 'pengaturan') bacaForm();
      await muat();
      kabar('Berhasil masuk lagi ✔');
    } catch (e) {
      tombol.disabled = false;
      kabar(e.message);
    }
  }

  // ---------- Masuk ----------

  function tampilMasuk(pesan) {
    $('#bilah').hidden = true;
    $('#isi').innerHTML = `
      <div class="masuk">
        <img src="ikon/logo.svg" alt="">
        <h1>Admin Lisensi</h1>
        <p>Kelola permintaan aktivasi versi penuh Dompet Keluarga. Masuk dengan <b>akun Google pemilik bot</b>.</p>
        ${pesan ? `<div class="galat" style="text-align:left">${esc(pesan)}</div>` : ''}
        <button class="btn-utama" data-aksi="masuk">Masuk dengan Google</button>
      </div>`;
  }

  async function masuk() {
    try {
      await GOOGLE.masuk(true); // selalu tampilkan pilihan akun
      await muat();
    } catch (e) {
      tampilMasuk(e.message);
    }
  }

  function bilah() {
    const a = info.admin || '';
    $('#bilah').hidden = false;
    $('#akun').innerHTML = `
      <span class="chip-akun" title="${esc(a)}"><span class="inisial">${esc((a[0] || '?').toUpperCase())}</span><span>${esc(a)}</span></span>
      <button class="ikon-btn ${layar === 'pengaturan' ? 'nyala' : ''}" data-aksi="pengaturan" title="Pengaturan penjualan" aria-label="Pengaturan penjualan">${IKON.atur}</button>
      ${info.sheet ? `<a class="ikon-btn" href="${esc(info.sheet)}" target="_blank" rel="noopener" title="Buka spreadsheet pengajuan" aria-label="Buka spreadsheet pengajuan">${IKON.tabel}</a>` : ''}
      <button class="ikon-btn" data-aksi="muat" title="Muat ulang" aria-label="Muat ulang">${IKON.muat}</button>
      <button class="ikon-btn" data-aksi="ganti" title="Ganti akun" aria-label="Ganti akun">${IKON.akun}</button>
      <button class="ikon-btn" data-aksi="keluar" title="Keluar" aria-label="Keluar">${IKON.keluar}</button>`;
  }

  // ---------- Data ----------

  async function muat() {
    if (!BOT) return tampilMasuk('URL bot (bayar.urlBot) belum diisi di web/assets/config.js.');
    if (!daftar.length) {
      $('#isi').innerHTML = '<div class="ringkasan">' + '<div class="kerangka" style="height:72px"></div>'.repeat(5) + '</div><div class="daftar">'
        + '<div class="kerangka"></div>'.repeat(4) + '</div>';
    }
    try {
      const j = await api({ aksi: 'daftar' });
      daftar = j.daftar || [];
      info = { admin: j.admin, sheet: j.sheet };
      if (j.jual) jual = j.jual;
      galat = '';
      bilah();
      render();
    } catch (e) {
      if (e.sesi) return;
      if (/bukan admin/i.test(e.message)) return tampilMasuk(e.message);
      galat = e.message;
      render();
    }
  }

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
    if (!r.ada_foto) return '<div class="bukti kosong">Tanpa foto</div>';
    if (foto[r.id]) return `<div class="bukti ada" data-aksi="perbesar" data-id="${esc(r.id)}" title="Perbesar"><img src="${esc(foto[r.id])}" alt="Bukti transfer"></div>`;
    if (memuat[r.id]) return '<div class="bukti">Memuat…</div>';
    if (foto[r.id] === '') return `<div class="bukti" data-aksi="foto" data-id="${esc(r.id)}">Gagal memuat<br>Ketuk untuk coba lagi</div>`;
    return `<div class="bukti" data-aksi="foto" data-id="${esc(r.id)}">🖼<br>Lihat bukti<br>transfer</div>`;
  }

  function gambarUlangBukti(id) {
    const el = document.querySelector(`.kartu[data-id="${CSS.escape(id)}"] .bukti`);
    const r = daftar.find(x => x.id === id);
    if (el && r) el.outerHTML = htmlBukti(r);
  }

  function htmlAksi(r) {
    const b = (status, kelas, label) => `<button class="${kelas}" data-aksi="atur" data-status="${status}" data-id="${esc(r.id)}">${label}</button>`;
    if (r.status === 'menunggu') return b('aktif', 'btn-hijau', '✓ Aktifkan') + b('ditolak', 'btn-lembut-merah', '✕ Tolak');
    if (r.status === 'aktif') return b('nonaktif', 'btn-kedua', '⛔ Nonaktifkan');
    return b('aktif', 'btn-hijau', '✓ Aktifkan');
  }

  function render() {
    bilah();
    if (layar === 'pengaturan') return renderPengaturan();
    const jumlah = s => daftar.filter(r => !s || r.status === s).length;
    const pendapatan = daftar.filter(r => r.status === 'aktif').reduce((a, r) => a + (Number(r.harga) || jual.harga), 0);
    const q = cari.trim().toLowerCase();
    const tampil = daftar.filter(r => (!tab || r.status === tab) && (!q || [r.email, r.buku, r.id].some(x => String(x).toLowerCase().includes(q))));
    // Kotak ringkasan sekaligus filter (tidak ada tab terpisah supaya tidak dobel).
    const tile = (k, label, warna, sub) => `<button class="tile ${tab === k ? 'dipilih' : ''}" data-aksi="tab" data-tab="${k}" aria-pressed="${tab === k}">
      <small>${warna ? `<span class="titik" style="background:${warna}"></span>` : ''}${label}</small><b>${jumlah(k)}</b>${sub ? `<em>${sub}</em>` : ''}</button>`;
    $('#isi').innerHTML = `
      ${kotakGalat()}
      <section class="ringkasan">
        ${tile('menunggu', 'Menunggu', STATUS.menunggu.warna)}
        ${tile('aktif', 'Aktif', STATUS.aktif.warna, '💰 ' + rupiah(pendapatan))}
        ${tile('nonaktif', 'Nonaktif', STATUS.nonaktif.warna)}
        ${tile('ditolak', 'Ditolak', STATUS.ditolak.warna)}
        ${tile('', 'Semua', '')}
      </section>
      <label class="cari"><span>🔍</span><input id="kotak-cari" name="cari-pengajuan-admin" type="search" placeholder="Cari email, nama buku, atau kode buku" autocomplete="off" spellcheck="false"></label>
      ${tampil.length ? `<div class="daftar">${tampil.map(r => `
        <article class="kartu" data-id="${esc(r.id)}">
          ${htmlBukti(r)}
          <div class="isi">
            <div class="atas">
              <div style="min-width:0"><div class="email">${esc(r.email)}</div>
                <div class="meta">${esc(r.buku)} · <span title="${esc(tanggal(r.t))}">${esc(relatif(r.t))}</span></div></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status] ? STATUS[r.status].ikon + ' ' + STATUS[r.status].label : esc(r.status)}</span>
            </div>
            ${r.harga ? `<div class="harga-aju" title="Harga versi penuh saat bukti transfer dikirim">💰 <b>${rupiah(r.harga)}</b> <small>harga saat pengajuan${
              Number(r.harga) !== Number(jual.harga) ? ' · sekarang ' + rupiah(jual.harga) : ''}</small></div>` : ''}
            <div class="kode" title="Kode buku (ID spreadsheet)"><span>${esc(r.id)}</span><button data-aksi="salin" data-id="${esc(r.id)}">Salin</button></div>
            ${r.status === 'ditolak' && r.alasan ? `<div class="alasan">Alasan: ${esc(r.alasan)}</div>` : ''}
            ${r.diubah && r.diubah !== r.t ? `<div class="meta" style="margin-top:6px">Diubah ${esc(relatif(r.diubah))}</div>` : ''}
            <div class="aksi">${htmlAksi(r)}<button class="btn-kedua tombol-riwayat" data-aksi="riwayat" data-id="${esc(r.id)}">🕘 Riwayat${r.riwayat ? ' (' + r.riwayat + ')' : ''}</button></div>
          </div>
        </article>`).join('')}</div>`
      : `<div class="kosong-besar">${q ? '🔍' : tab === 'menunggu' ? '🎉' : '📭'}<b>${q ? 'Tidak ada yang cocok' : tab === 'menunggu' ? 'Semua sudah diproses' : 'Belum ada'}</b>
          ${q ? 'Coba kata kunci lain.' : tab === 'menunggu' ? 'Tidak ada permintaan yang menunggu konfirmasi.' : 'Belum ada pengajuan dengan status ini.'}</div>`}`;
    // Nilai diisi lewat JS (bukan atribut value) supaya isian otomatis browser tidak ikut menimpa.
    const kotak = $('#kotak-cari');
    kotak.value = cari;
    kotak.oninput = () => { cari = kotak.value; const pos = kotak.selectionStart; render(); const k = $('#kotak-cari'); k.focus(); k.setSelectionRange(pos, pos); };
    // Bukti yang menunggu langsung dimuat (paling banyak 6), supaya bisa dicek tanpa mengetuk satu per satu.
    if (tab === 'menunggu') tampil.filter(r => r.ada_foto && foto[r.id] === undefined).slice(0, 6).forEach(r => muatFoto(r.id));
  }

  // ---------- Tampilan: pengaturan penjualan ----------

  function bukaPengaturan() {
    layar = 'pengaturan';
    formJual = JSON.parse(JSON.stringify(jual));
    formJual.rekening = formJual.rekening.map((r, i) => Object.assign(r, { asal: i, baru: null }));
    if (!formJual.rekening.length) formJual.rekening.push(rekeningKosong());
    qrisTersimpan = {};
    render();
    jual.rekening.forEach((r, i) => {
      if (!r.qris) return;
      api({ aksi: 'lihatQris', rek: i }).then(j => {
        qrisTersimpan[i] = j.qris || '';
        // Gambar dipasang langsung (tanpa render ulang) supaya ketikan yang sedang berlangsung tidak terganggu.
        const kotak = document.querySelector('.qris-pratinjau[data-asal="' + i + '"]');
        if (kotak && layar === 'pengaturan') kotak.innerHTML = j.qris ? '<img src="' + esc(j.qris) + '" alt="QRIS">' : 'Gagal dimuat';
      }).catch(e => kabar(e.message));
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

  function renderPengaturan() {
    const f = formJual;
    const pakaiTrx = f.aturan !== 'periode', pakaiPer = f.aturan !== 'transaksi';
    $('#isi').innerHTML = `
      <div class="judul-layar">
        <button class="ikon-btn" data-aksi="kembali" aria-label="Kembali ke pengajuan">${IKON.kembali}</button>
        <div><h1>Pengaturan penjualan</h1><p>Berlaku untuk semua pengguna aplikasi & bot Telegram.</p></div>
      </div>
      ${kotakGalat()}
      <form id="form-jual" class="form-jual" autocomplete="off">
        <section class="panel">
          <h2>Kapan pengguna ditagih</h2>
          <p class="bantu">Selama masa gratis pengguna bebas mencatat. Setelah lewat, pencatatan transaksi baru dikunci sampai versi penuh dibeli.</p>
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

        <section class="panel">
          <h2>Menu "Versi penuh" di aplikasi</h2>
          <label class="saklar">
            <span><b>Selalu tampilkan</b><small>${f.selaluTampil !== false
              ? 'Aktif: menu ⚙️ → Versi penuh selalu terlihat, termasuk selama masa gratis.'
              : 'Mati: menu ⚙️ → Versi penuh baru muncul setelah syarat "Kapan pengguna ditagih" terpenuhi (masa gratis habis).'}</small></span>
            <input type="checkbox" id="selalu-tampil" role="switch" ${f.selaluTampil !== false ? 'checked' : ''}><i aria-hidden="true"></i>
          </label>
        </section>

        <section class="panel">
          <h2>Harga versi penuh</h2>
          <p class="bantu">Sekali bayar, berlaku seumur hidup untuk satu buku (seluruh keluarga).</p>
          <label class="isian"><span>Harga</span><span class="dengan-satuan depan"><em>Rp</em><input id="harga" inputmode="numeric" value="${esc(Number(f.harga || 0).toLocaleString('id-ID'))}"></span></label>
        </section>

        <section class="panel">
          <h2>Rekening tujuan & QRIS</h2>
          <p class="bantu">Ditampilkan ke pembeli di layar Versi penuh. Bisa bank atau e-wallet, maksimal 5. Setiap rekening boleh punya satu QRIS (opsional).</p>
          <div id="daftar-rekening">${f.rekening.map((r, i) => {
            const g = gambarQris(r), ada = punyaQris(r);
            return `
            <div class="rekening-baris">
              <div class="rekening-isian">
                <input data-f="bank" placeholder="Bank / e-wallet (mis. BCA, DANA)" value="${esc(r.bank)}" maxlength="40">
                <input data-f="nomor" placeholder="Nomor rekening / HP" value="${esc(r.nomor)}" maxlength="40" inputmode="numeric">
                <input data-f="atasNama" placeholder="Atas nama (opsional)" value="${esc(r.atasNama)}" maxlength="60">
                <button type="button" class="ikon-btn hapus" data-aksi="hapus-rekening" data-i="${i}" aria-label="Hapus rekening" ${f.rekening.length < 2 ? 'disabled' : ''}>✕</button>
              </div>
              <div class="qris">
                <div class="qris-pratinjau" ${r.baru === null && r.qris ? `data-asal="${r.asal}"` : ''}>${g ? `<img src="${esc(g)}" alt="QRIS">` : ada ? 'Memuat…' : 'Tanpa QRIS'}</div>
                <div class="qris-aksi">
                  <label class="btn-kedua tombol-file"><input type="file" class="file-qris" data-i="${i}" accept="image/*" hidden>${ada ? 'Ganti QRIS' : 'Unggah QRIS'}</label>
                  ${ada ? `<button type="button" class="btn-lembut-merah" data-aksi="hapus-qris" data-i="${i}">Hapus QRIS</button>` : ''}
                </div>
              </div>
            </div>`; }).join('')}</div>
          ${f.rekening.length < 5 ? '<button type="button" class="btn-kedua" data-aksi="tambah-rekening">+ Tambah rekening</button>' : ''}
        </section>

        <div class="simpan-bar">
          <button type="button" class="btn-kedua" data-aksi="kembali">Batal</button>
          <button type="button" class="btn-utama" data-aksi="simpan-jual">Simpan pengaturan</button>
        </div>
      </form>`;
    $('#form-jual').onchange = e => {
      if (e.target.name === 'aturan' || e.target.id === 'selalu-tampil') { bacaForm(); render(); }
      if (e.target.id === 'harga') { bacaForm(); e.target.value = formJual.harga.toLocaleString('id-ID'); }
    };
    document.querySelectorAll('.file-qris').forEach(inp => {
      inp.onchange = async e => {
        e.stopPropagation();
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const gambar = await kecilkanQris(file);
          bacaForm();
          formJual.rekening[Number(inp.dataset.i)].baru = gambar;
          render();
        } catch (err) { kabar(err.message); }
      };
    });
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
    tombol.disabled = true;
    try {
      const rekening = rek.map(r => ({ bank: r.bank, nomor: r.nomor, atasNama: r.atasNama,
        qrisAsal: r.baru === null && r.qris ? r.asal : -1, qrisBaru: r.baru || '' }));
      const j = await api({ aksi: 'simpanJual', jual: Object.assign({}, f, { rekening }) });
      jual = j.jual;
      galat = '';
      layar = 'pengajuan';
      kabar('Pengaturan penjualan disimpan ✔');
      render();
    } catch (e) {
      tombol.disabled = false;
      if (e.sesi) return;
      galat = e.message;
      render();
    }
  }

  // ---------- Dialog ----------

  const pilihan = () => ({
    aktif: { ikon: '✅', latar: 'var(--ok-bg)', judul: 'Aktifkan versi penuh?', tombol: 'Aktifkan', kelas: 'btn-hijau', selesai: 'Versi penuh diaktifkan ✔',
      isi: 'Pastikan transfer ' + rupiah(jual.harga) + ' sudah masuk. Versi penuh langsung aktif untuk seluruh keluarga di buku ini saat aplikasinya dibuka.' },
    nonaktif: { ikon: '⛔', latar: 'var(--info-bg)', judul: 'Nonaktifkan versi penuh?', tombol: 'Nonaktifkan', kelas: 'btn-merah', selesai: 'Versi penuh dinonaktifkan',
      isi: 'Pencatatan transaksi baru di buku ini langsung dikunci saat aplikasinya dibuka lagi. Bisa diaktifkan lagi kapan saja.' },
    ditolak: { ikon: '❌', latar: 'var(--bad-bg)', judul: 'Tolak permintaan ini?', tombol: 'Tolak', kelas: 'btn-merah', selesai: 'Permintaan ditolak',
      isi: 'Pilih alasannya. Alasan ini yang akan dilihat pembeli di aplikasi, lalu mereka bisa mengirim ulang bukti.' },
  });

  /** Dialog konfirmasi. Hasil: null (batal), atau { alasan } (kosong selain tolak). */
  function konfirmasi(status, r) {
    const p = pilihan()[status];
    const kotak = $('#dialog');
    const tolak = status === 'ditolak';
    kotak.innerHTML = `
      <div class="dialog">
        <div class="ikon" style="background:${p.latar}">${p.ikon}</div>
        <h2>${p.judul}</h2>
        <p>${p.isi}</p>
        ${r ? `<div class="siapa"><b>${esc(r.email)}</b><span>Buku ${esc(r.buku)} · dikirim ${esc(tanggal(r.t))}</span></div>` : ''}
        ${tolak ? `
          <div class="pilihan">
            ${daftarAlasan().map((a, i) => `<label><input type="radio" name="alasan" value="${esc(a)}" ${i ? '' : 'checked'}><span>${esc(a)}</span></label>`).join('')}
            <label><input type="radio" name="alasan" value=""><span>Lainnya (tulis sendiri)</span></label>
          </div>
          <textarea id="alasan-lain" maxlength="300" placeholder="Tulis alasannya…" hidden></textarea>
          <div class="pratinjau">Yang dilihat pembeli:<div id="pratinjau-alasan"></div></div>` : ''}
        <div class="tombol-dialog">
          <button class="btn-kedua" data-jawab="0">Batal</button>
          <button class="${p.kelas}" data-jawab="1">${p.tombol}</button>
        </div>
      </div>`;
    kotak.hidden = false;
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
      const selesai = jawab => {
        kotak.hidden = true;
        kotak.onclick = kotak.oninput = null;
        document.removeEventListener('keydown', tombolKeyboard);
        ok(jawab ? { alasan: alasan().trim() } : null);
      };
      const tombolKeyboard = e => { if (e.key === 'Escape') selesai(false); };
      document.addEventListener('keydown', tombolKeyboard);
      kotak.onclick = e => {
        e.stopPropagation();
        const radio = e.target.closest('input[name="alasan"]');
        if (radio) {
          segarkan();
          if (!radio.value) setTimeout(() => kotak.querySelector('#alasan-lain').focus(), 0);
          return;
        }
        const b = e.target.closest('[data-jawab]');
        if (b && !b.disabled) selesai(b.dataset.jawab === '1');
        else if (e.target === kotak) selesai(false); // ketuk di luar kotak = batal
      };
    });
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
      const label = tombol.textContent;
      tombol.disabled = true;
      tombol.textContent = 'Memuat foto…';
      try {
        fotoRiwayat[idFile] = (await api({ aksi: 'fotoFile', foto: idFile })).foto;
      } catch (e) {
        if (!e.sesi) kabar(e.message);
        return;
      } finally {
        tombol.disabled = false;
        tombol.textContent = label;
      }
    }
    img.src = fotoRiwayat[idFile];
    besar.hidden = false;
  }

  async function bukaRiwayat(r) {
    const kotak = $('#dialog');
    const isi = daftarRiwayat => `
      <div class="dialog dialog-riwayat" role="dialog" aria-label="Riwayat transaksi">
        <div class="kepala-riwayat"><h2>Riwayat transaksi</h2><button class="ikon-btn" data-tutup aria-label="Tutup">✕</button></div>
        <div class="siapa"><b>${esc(r.email || '(tanpa email)')}</b><span>Buku ${esc(r.buku || '-')} · ${esc(r.id)}</span></div>
        ${daftarRiwayat === null ? '<div class="kerangka" style="height:160px"></div>'
          : !daftarRiwayat.length ? '<p class="kosong-riwayat">Belum ada riwayat untuk buku ini.</p>'
          : `<ol class="linimasa">${daftarRiwayat.map(x => `
            <li style="--warna:${WARNA_PERISTIWA(x.peristiwa)}">
              <span class="titik-lm" aria-hidden="true"></span>
              <div class="lm-isi">
                <div class="lm-kepala"><b>${esc(x.peristiwa)}</b><small>${esc(tanggal(x.t))}${x.oleh ? ' · oleh ' + esc(x.oleh) : ''}</small></div>
                ${rincian(x)}
                ${kirimBukti(x) && idFoto(x.link) ? `<button type="button" class="lm-bukti" data-foto="${esc(idFoto(x.link))}">🖼 Lihat bukti transfer</button>` : ''}
              </div>
            </li>`).join('')}</ol>`}
      </div>`;
    kotak.innerHTML = isi(null);
    kotak.hidden = false;
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
    if (aksi === 'masuk' || aksi === 'ganti') return masuk();
    if (aksi === 'masuk-lagi') return masukLagi(el);
    // Token hampir / baru saja habis: diperpanjang diam-diam saat halaman diketuk (seperti di aplikasi).
    const segar = GOOGLE.segarkanKalauPerlu && GOOGLE.segarkanKalauPerlu();
    if (segar) { const ok = await segar; if (ok && sesiHabis) { sesiHabis = false; galat = ''; } }
    if (aksi === 'keluar') { GOOGLE.keluar(); daftar = []; return tampilMasuk(''); }
    if (aksi === 'muat') { el.disabled = true; await muat(); if (!sesiHabis) kabar('Data diperbarui'); return; }
    if (aksi === 'pengaturan') { galat = ''; return layar === 'pengaturan' ? (layar = 'pengajuan', render()) : bukaPengaturan(); }
    if (aksi === 'kembali') { galat = ''; layar = 'pengajuan'; return render(); }
    if (aksi === 'tambah-rekening') { bacaForm(); formJual.rekening.push(rekeningKosong()); render(); return; }
    if (aksi === 'hapus-rekening') { bacaForm(); formJual.rekening.splice(Number(el.dataset.i), 1); return render(); }
    if (aksi === 'hapus-qris') { bacaForm(); formJual.rekening[Number(el.dataset.i)].baru = ''; return render(); }
    if (aksi === 'simpan-jual') return simpanJual(el);
    if (aksi === 'tab') { tab = el.dataset.tab; return render(); }
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
      const jawab = await konfirmasi(status, r);
      if (!jawab) return;
      el.disabled = true;
      try {
        await api({ aksi: 'atur', id: el.dataset.id, status, alasan: jawab.alasan });
        if (r) Object.assign(r, { status, alasan: status === 'ditolak' ? jawab.alasan : '', diubah: new Date().toISOString(), riwayat: (r.riwayat || 0) + 1 });
        galat = '';
        kabar(pilihan()[status].selesai);
      } catch (err) {
        if (err.sesi) return;
        galat = err.message;
      }
      render();
    }
  });

  if (tokenSaya()) muat();
  else tampilMasuk(GOOGLE.email() ? 'Sesi login sudah habis. Masuk lagi.' : '');
})();
