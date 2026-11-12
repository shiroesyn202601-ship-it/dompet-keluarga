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

  async function api(isi) {
    const token = GOOGLE.token();
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
    $('#masuk').onclick = () => masuk(false);
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
      const kata = { aktif: 'Aktifkan versi penuh untuk', nonaktif: 'Nonaktifkan versi penuh untuk', ditolak: 'Tolak permintaan dari' }[el.dataset.atur];
      if (!confirm(kata + ' ' + (r ? r.email + ' (buku ' + r.buku + ')' : 'buku ini') + '?')) return;
      el.disabled = true;
      try {
        await api({ aksi: 'atur', id: el.dataset.id, status: el.dataset.atur });
        if (r) r.status = el.dataset.atur;
        galat = '';
      } catch (err) {
        galat = err.message;
      }
      render();
    }
  });

  if (GOOGLE.sudahMasuk()) muat();
  else tampilMasuk(GOOGLE.email() ? 'Sesi login sudah habis. Masuk lagi.' : '');
})();
