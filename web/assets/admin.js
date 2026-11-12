/**
 * Halaman admin lisensi (web/admin.html): daftar permintaan aktivasi versi penuh beserta foto bukti transfer,
 * dengan tombol Aktifkan / Tolak / Nonaktifkan. Semua data ada di bot (bot/Kode.gs → apiLisensi_); bot hanya
 * melayani akun Google pemilik bot (atau Script Property ADMIN_EMAIL). Sengaja tanpa terjemahan: halaman ini khusus pemilik.
 */
(() => {
  const BOT = (KONFIG.bayar || {}).urlBot;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NAMA = { menunggu: 'Menunggu', aktif: 'Aktif', ditolak: 'Ditolak', nonaktif: 'Nonaktif' };
  const TAB = [['menunggu', 'Menunggu'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['ditolak', 'Ditolak'], ['', 'Semua']];
  let daftar = [];
  let tab = 'menunggu';
  let galat = '';
  const foto = {}; // id buku → data URL bukti (sudah dimuat)

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

  function tampilMasuk(pesan) {
    $('#tombol-atas').innerHTML = '';
    $('#akun').textContent = 'Dompet Keluarga · permintaan aktivasi versi penuh';
    $('#isi').innerHTML = `
      ${pesan ? `<div class="galat">${esc(pesan)}</div>` : ''}
      <div class="kartu pesan">
        <p>Masuk dengan <b>akun Google pemilik bot</b> (akun yang dipakai di Google Apps Script).</p>
        <button class="utama" id="masuk">Masuk dengan Google</button>
      </div>`;
    $('#masuk').onclick = () => masuk(true); // selalu tampilkan pilihan akun
  }

  async function masuk(ganti) {
    try {
      await GOOGLE.masuk(ganti);
      await muat();
    } catch (e) {
      tampilMasuk(e.message);
    }
  }

  async function muat() {
    if (!BOT) return tampilMasuk('URL bot (bayar.urlBot) belum diisi di web/assets/config.js.');
    $('#isi').innerHTML = '<p class="pesan">Memuat…</p>';
    try {
      const j = await api({ aksi: 'daftar' });
      daftar = j.daftar || [];
      galat = '';
      $('#akun').textContent = 'Masuk sebagai ' + j.admin;
      $('#tombol-atas').innerHTML = '<button class="teks" id="segarkan">↻ Muat ulang</button><button class="teks" id="ganti">Ganti akun</button>';
      $('#segarkan').onclick = muat;
      $('#ganti').onclick = () => masuk(true);
      render();
    } catch (e) {
      if (/bukan admin|Sesi login/i.test(e.message)) return tampilMasuk(e.message);
      galat = e.message;
      render();
    }
  }

  const tanggal = s => {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T'));
    return isNaN(d) ? s : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  function tombolUntuk(r) {
    const b = (aksi, kelas, label) => `<button class="${kelas}" data-atur="${aksi}" data-id="${esc(r.id)}">${label}</button>`;
    if (r.status === 'menunggu') return b('aktif', 'utama', '✅ Aktifkan') + b('ditolak', 'bahaya', '❌ Tolak');
    if (r.status === 'aktif') return b('nonaktif', 'bahaya', '⛔ Nonaktifkan');
    return b('aktif', 'utama', '✅ Aktifkan');
  }

  function render() {
    const jumlah = s => daftar.filter(r => !s || r.status === s).length;
    const tampil = daftar.filter(r => !tab || r.status === tab);
    $('#isi').innerHTML = `
      ${galat ? `<div class="galat">${esc(galat)}</div>` : ''}
      <div class="tab">${TAB.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'aktif' : ''}">${l} (${jumlah(k)})</button>`).join('')}</div>
      ${tampil.length ? tampil.map(r => `
        <div class="kartu">
          <div class="baris1">
            <div><b>${esc(r.email)}</b><div class="ket">Buku: ${esc(r.buku)} · dikirim ${esc(tanggal(r.t))}</div>
              <div class="ket">Kode buku: ${esc(r.id)}</div></div>
            <span class="chip ${esc(r.status)}">${NAMA[r.status] || esc(r.status)}</span>
          </div>
          ${foto[r.id] ? `<img class="bukti" src="${esc(foto[r.id])}" alt="Bukti transfer" data-besar="${esc(r.id)}">` : ''}
          <div class="aksi">
            ${r.ada_foto && !foto[r.id] ? `<button class="kedua" data-foto="${esc(r.id)}">🖼 Lihat bukti transfer</button>` : ''}
            ${tombolUntuk(r)}
          </div>
        </div>`).join('') : `<p class="kosong">${tab === 'menunggu' ? 'Tidak ada permintaan yang menunggu. 🎉' : 'Belum ada.'}</p>`}`;
  }

  document.addEventListener('click', async e => {
    const el = e.target.closest('button, img[data-besar], #besar');
    if (!el) return;
    if (el.id === 'besar') { el.hidden = true; return; }
    if (el.dataset.besar) {
      $('#besar img').src = foto[el.dataset.besar];
      $('#besar').hidden = false;
      return;
    }
    if (el.dataset.tab !== undefined) { tab = el.dataset.tab; render(); return; }
    if (el.dataset.foto) {
      el.disabled = true;
      el.textContent = 'Memuat foto…';
      try {
        foto[el.dataset.foto] = (await api({ aksi: 'foto', id: el.dataset.foto })).foto;
        render();
      } catch (err) {
        galat = err.message;
        render();
      }
      return;
    }
    if (el.dataset.atur) {
      const r = daftar.find(x => x.id === el.dataset.id);
      const status = el.dataset.atur;
      if (!(await konfirmasi(status, r))) return;
      el.disabled = true;
      try {
        await api({ aksi: 'atur', id: el.dataset.id, status });
        if (r) r.status = status;
        galat = '';
        kabar(PILIHAN[status].selesai);
      } catch (err) {
        galat = err.message;
      }
      render();
    }
  });

  const PILIHAN = {
    aktif: { ikon: '✅', judul: 'Aktifkan versi penuh?', tombol: 'Aktifkan', kelas: 'ok-hijau', selesai: 'Versi penuh diaktifkan ✔',
      isi: 'Pastikan transfer Rp' + Number((KONFIG.bayar || {}).harga || 0).toLocaleString('id-ID') + ' sudah masuk. Versi penuh langsung aktif untuk seluruh keluarga di buku ini saat aplikasinya dibuka.' },
    ditolak: { ikon: '❌', judul: 'Tolak permintaan ini?', tombol: 'Tolak', kelas: 'ok-merah', selesai: 'Permintaan ditolak',
      isi: 'Pembeli akan melihat bahwa bukti transfernya ditolak dan diminta mengirim ulang.' },
    nonaktif: { ikon: '⛔', judul: 'Nonaktifkan versi penuh?', tombol: 'Nonaktifkan', kelas: 'ok-merah', selesai: 'Versi penuh dinonaktifkan',
      isi: 'Buku ini kembali ke versi gratis paling lambat 6 jam lagi. Bisa diaktifkan lagi kapan saja.' },
  };

  /** Dialog konfirmasi (pengganti confirm()). Hasil: true kalau pemilik menekan tombol utama. */
  function konfirmasi(status, r) {
    const p = PILIHAN[status];
    const kotak = $('#dialog');
    kotak.innerHTML = `
      <div class="kotak-dialog">
        <div class="ikon-dialog ${status}">${p.ikon}</div>
        <h2 id="judul-dialog">${p.judul}</h2>
        <p>${p.isi}</p>
        ${r ? `<div class="ringkas"><b>${esc(r.email)}</b><span>Buku ${esc(r.buku)} · dikirim ${esc(tanggal(r.t))}</span></div>` : ''}
        <div class="tombol-dialog">
          <button class="kedua" data-jawab="0">Batal</button>
          <button class="${p.kelas}" data-jawab="1">${p.tombol}</button>
        </div>
      </div>`;
    kotak.hidden = false;
    kotak.querySelector('[data-jawab="1"]').focus();
    return new Promise(ok => {
      const selesai = jawab => {
        kotak.hidden = true;
        kotak.onclick = null;
        document.removeEventListener('keydown', tombolKeyboard);
        ok(jawab);
      };
      const tombolKeyboard = e => { if (e.key === 'Escape') selesai(false); };
      document.addEventListener('keydown', tombolKeyboard);
      kotak.onclick = e => {
        e.stopPropagation();
        const b = e.target.closest('[data-jawab]');
        if (b) selesai(b.dataset.jawab === '1');
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

  if (GOOGLE.sudahMasuk()) muat();
  else tampilMasuk(GOOGLE.email() ? 'Sesi login sudah habis. Masuk lagi.' : '');
})();
