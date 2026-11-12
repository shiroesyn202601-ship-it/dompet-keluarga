/**
 * Halaman admin lisensi (web/admin.html): ringkasan, daftar permintaan aktivasi versi penuh beserta foto bukti transfer,
 * pencarian, dan tombol Aktifkan / Tolak (dengan alasan) / Nonaktifkan. Semua data ada di bot (bot/Kode.gs → apiLisensi_,
 * tersimpan di spreadsheet "Pengajuan Aktivasi"); bot hanya melayani akun Google pemilik bot (atau Script Property ADMIN_EMAIL).
 * Sengaja tanpa terjemahan: halaman ini khusus pemilik.
 */
(() => {
  const BOT = (KONFIG.bayar || {}).urlBot;
  const HARGA = Number((KONFIG.bayar || {}).harga) || 0;
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
  const ALASAN = [
    'Nominal transfer tidak sesuai (harus ' + rupiah(HARGA) + ')',
    'Transfer belum masuk ke rekening penjual',
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
  };

  let daftar = [];
  let tab = 'menunggu';
  let cari = '';
  let galat = '';
  let info = { admin: '', sheet: '' };
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
    if (!token) { tampilMasuk('Sesi login sudah habis. Masuk lagi.'); throw new Error('Sesi login habis'); }
    let j;
    try {
      const r = await fetch(BOT + '?api=1', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token }, isi)) });
      j = await r.json();
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke bot. Periksa koneksi internet.');
    }
    if (j.galat) throw new Error(j.galat);
    return j;
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
      galat = '';
      bilah();
      render();
    } catch (e) {
      if (/bukan admin|Sesi login/i.test(e.message)) return tampilMasuk(e.message);
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
      kabar(e.message);
    }
    memuat[id] = false;
    gambarUlangBukti(id);
  }

  // ---------- Tampilan ----------

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
    const jumlah = s => daftar.filter(r => r.status === s).length;
    const q = cari.trim().toLowerCase();
    const tampil = daftar.filter(r => (!tab || r.status === tab) && (!q || [r.email, r.buku, r.id].some(x => String(x).toLowerCase().includes(q))));
    const tile = (k, label, nilai, warna) => `<button class="tile ${tab === k ? 'dipilih' : ''}" data-aksi="tab" data-tab="${k}">
      <small><span class="titik" style="background:${warna}"></span>${label}</small><b>${nilai}</b></button>`;
    $('#isi').innerHTML = `
      ${galat ? `<div class="galat">${esc(galat)}</div>` : ''}
      <section class="ringkasan">
        ${Object.keys(STATUS).map(k => tile(k, STATUS[k].label, jumlah(k), STATUS[k].warna)).join('')}
        <div class="tile uang"><small>💰 Perkiraan pendapatan</small><b>${rupiah(jumlah('aktif') * HARGA)}</b></div>
      </section>
      <div class="alat">
        <div class="segmen">${[['menunggu', 'Menunggu'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['ditolak', 'Ditolak'], ['', 'Semua']].map(([k, l]) =>
          `<button class="${tab === k ? 'aktif' : ''}" data-aksi="tab" data-tab="${k}">${l}<span class="n">${k ? jumlah(k) : daftar.length}</span></button>`).join('')}</div>
        <label class="cari"><span>🔍</span><input id="cari" type="search" placeholder="Cari email, nama buku, atau kode buku" value="${esc(cari)}" autocomplete="off"></label>
      </div>
      ${tampil.length ? `<div class="daftar">${tampil.map(r => `
        <article class="kartu" data-id="${esc(r.id)}">
          ${htmlBukti(r)}
          <div class="isi">
            <div class="atas">
              <div style="min-width:0"><div class="email">${esc(r.email)}</div>
                <div class="meta">${esc(r.buku)} · <span title="${esc(tanggal(r.t))}">${esc(relatif(r.t))}</span></div></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status] ? STATUS[r.status].ikon + ' ' + STATUS[r.status].label : esc(r.status)}</span>
            </div>
            <div class="kode" title="Kode buku (ID spreadsheet)"><span>${esc(r.id)}</span><button data-aksi="salin" data-id="${esc(r.id)}">Salin</button></div>
            ${r.status === 'ditolak' && r.alasan ? `<div class="alasan">Alasan: ${esc(r.alasan)}</div>` : ''}
            ${r.diubah && r.diubah !== r.t ? `<div class="meta" style="margin-top:6px">Diubah ${esc(relatif(r.diubah))}</div>` : ''}
            <div class="aksi">${htmlAksi(r)}</div>
          </div>
        </article>`).join('')}</div>`
      : `<div class="kosong-besar">${q ? '🔍' : tab === 'menunggu' ? '🎉' : '📭'}<b>${q ? 'Tidak ada yang cocok' : tab === 'menunggu' ? 'Semua sudah diproses' : 'Belum ada'}</b>
          ${q ? 'Coba kata kunci lain.' : tab === 'menunggu' ? 'Tidak ada permintaan yang menunggu konfirmasi.' : 'Belum ada pengajuan dengan status ini.'}</div>`}`;
    const kotak = $('#cari');
    kotak.oninput = () => { cari = kotak.value; const pos = kotak.selectionStart; render(); const k = $('#cari'); k.focus(); k.setSelectionRange(pos, pos); };
    // Bukti yang menunggu langsung dimuat (paling banyak 6), supaya bisa dicek tanpa mengetuk satu per satu.
    if (tab === 'menunggu') tampil.filter(r => r.ada_foto && foto[r.id] === undefined).slice(0, 6).forEach(r => muatFoto(r.id));
  }

  // ---------- Dialog ----------

  const PILIHAN = {
    aktif: { ikon: '✅', latar: 'var(--ok-bg)', judul: 'Aktifkan versi penuh?', tombol: 'Aktifkan', kelas: 'btn-hijau', selesai: 'Versi penuh diaktifkan ✔',
      isi: 'Pastikan transfer ' + rupiah(HARGA) + ' sudah masuk. Versi penuh langsung aktif untuk seluruh keluarga di buku ini saat aplikasinya dibuka.' },
    nonaktif: { ikon: '⛔', latar: 'var(--info-bg)', judul: 'Nonaktifkan versi penuh?', tombol: 'Nonaktifkan', kelas: 'btn-merah', selesai: 'Versi penuh dinonaktifkan',
      isi: 'Buku ini kembali ke versi gratis saat aplikasinya dibuka lagi. Bisa diaktifkan lagi kapan saja.' },
    ditolak: { ikon: '❌', latar: 'var(--bad-bg)', judul: 'Tolak permintaan ini?', tombol: 'Tolak', kelas: 'btn-merah', selesai: 'Permintaan ditolak',
      isi: 'Pilih alasannya. Alasan ini yang akan dilihat pembeli di aplikasi, lalu mereka bisa mengirim ulang bukti.' },
  };

  /** Dialog konfirmasi. Hasil: null (batal), atau { alasan } (kosong selain tolak). */
  function konfirmasi(status, r) {
    const p = PILIHAN[status];
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
            ${ALASAN.map((a, i) => `<label><input type="radio" name="alasan" value="${esc(a)}" ${i ? '' : 'checked'}><span>${esc(a)}</span></label>`).join('')}
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
    if (aksi === 'keluar') { GOOGLE.keluar(); daftar = []; return tampilMasuk(''); }
    if (aksi === 'muat') { el.disabled = true; await muat(); return kabar('Data diperbarui'); }
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
    if (aksi === 'atur') {
      const r = daftar.find(x => x.id === el.dataset.id);
      const status = el.dataset.status;
      const jawab = await konfirmasi(status, r);
      if (!jawab) return;
      el.disabled = true;
      try {
        await api({ aksi: 'atur', id: el.dataset.id, status, alasan: jawab.alasan });
        if (r) Object.assign(r, { status, alasan: status === 'ditolak' ? jawab.alasan : '', diubah: new Date().toISOString() });
        galat = '';
        kabar(PILIHAN[status].selesai);
      } catch (err) {
        galat = err.message;
      }
      render();
    }
  });

  if (tokenSaya()) muat();
  else tampilMasuk(GOOGLE.email() ? 'Sesi login sudah habis. Masuk lagi.' : '');
})();
