/**
 * Kotak masukan di halaman Kebijakan Privasi (bagian Kontak): laporan masalah, kritik, saran pengembangan, saran fitur.
 * Dikirim ke bot (?api=1, aksi kirimMasukan) dan disimpan di tab "Masukan" spreadsheet admin bersama email & waktunya.
 * Pengguna melihat pesan yang pernah dikirimnya beserta balasan admin (emoji dan/atau pesan).
 * Login memakai sesi aplikasi yang sama (localStorage dk_sesi), jadi yang sudah masuk di aplikasi tidak perlu masuk lagi.
 */
(() => {
  const kotak = document.getElementById('masukan');
  if (!kotak) return;
  const URL_BOT = KONFIG.bayar && KONFIG.bayar.urlBot;
  const JENIS = [
    ['masalah', '🐞', 'Laporan masalah'],
    ['kritik', '🗣️', 'Kritik'],
    ['pengembangan', '🛠️', 'Saran pengembangan'],
    ['fitur', '✨', 'Saran fitur'],
  ];
  const namaJenis = k => (JENIS.find(j => j[0] === k) || JENIS[2]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const waktu = t => {
    const m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
    return m ? Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1] + ' · ' + m[4] : String(t || '');
  };

  let st = { jenis: '', pesan: '', daftar: null, galat: '', memuat: false, mengirim: false, perluMasuk: false };

  async function api(isi) {
    const token = GOOGLE.token();
    if (!token) { st.perluMasuk = true; throw new Error(''); }
    const r = await fetch(URL_BOT + '?api=1', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token }, isi)) });
    const j = await r.json();
    if (j.galat) {
      if (/Sesi login|Silakan masuk/.test(j.galat)) { st.perluMasuk = true; throw new Error(''); }
      throw new Error(j.galat);
    }
    return j;
  }

  function render() {
    const email = GOOGLE.email && GOOGLE.email();
    const masuk = GOOGLE.sudahMasuk() && !st.perluMasuk;
    if (!URL_BOT) { kotak.innerHTML = '<p class="mk-ket">Kotak masukan belum tersedia.</p>'; return; }
    if (!masuk) {
      kotak.innerHTML = `
        <div class="mk-masuk">
          <span class="mk-ikon" aria-hidden="true">💬</span>
          <b>Kirim laporan masalah, kritik, atau saran</b>
          <p>Masuk dengan akun Google dulu supaya admin tahu pesan ini dari siapa dan bisa membalasnya. Balasan admin tampil di sini.</p>
          <button type="button" class="mk-btn" data-mk="masuk">${email ? 'Masuk lagi sebagai ' + esc(email) : 'Masuk dengan Google'}</button>
          ${st.galat ? `<p class="mk-galat" role="alert">${esc(st.galat)}</p>` : ''}
        </div>`;
      return;
    }
    const sisa = 2000 - st.pesan.length;
    kotak.innerHTML = `
      <form class="mk-form" novalidate>
        <div class="mk-akun">Dikirim sebagai <b>${esc(email)}</b></div>
        <div class="mk-jenis" role="radiogroup" aria-label="Jenis masukan">
          ${JENIS.map(([k, ik, nama]) => `<button type="button" role="radio" aria-checked="${st.jenis === k}" class="${st.jenis === k ? 'aktif' : ''}" data-mk="jenis" data-jenis="${k}">
            <span aria-hidden="true">${ik}</span>${nama}</button>`).join('')}
        </div>
        <label class="mk-label" for="mk-pesan">Pesan</label>
        <textarea id="mk-pesan" rows="5" maxlength="2000" placeholder="${st.jenis === 'masalah' ? 'Ceritakan masalahnya: apa yang Anda lakukan, apa yang terjadi, dan di HP/browser apa.' : 'Tulis pesan Anda di sini…'}">${esc(st.pesan)}</textarea>
        <div class="mk-bawah">
          <small class="mk-ket">Email, pesan, dan waktu kirim disimpan di spreadsheet admin Dompet Keluarga, hanya untuk membalas dan memperbaiki aplikasi.</small>
          <small class="mk-sisa ${sisa < 100 ? 'hampir' : ''}" id="mk-sisa">${sisa}</small>
        </div>
        ${st.galat ? `<p class="mk-galat" role="alert">${esc(st.galat)}</p>` : ''}
        <button type="submit" class="mk-btn" ${st.mengirim ? 'disabled' : ''}>${st.mengirim ? '<span class="mk-putar" aria-hidden="true"></span>Mengirim…' : 'Kirim'}</button>
      </form>
      <div class="mk-riwayat">
        <h3>Pesan Anda ${st.memuat ? '<span class="mk-putar" aria-label="Memuat"></span>' : ''}</h3>
        ${daftarHtml()}
      </div>`;
    const ta = kotak.querySelector('#mk-pesan');
    ta.oninput = () => {
      st.pesan = ta.value;
      const s = kotak.querySelector('#mk-sisa');
      s.textContent = 2000 - ta.value.length;
      s.classList.toggle('hampir', 2000 - ta.value.length < 100);
    };
    kotak.querySelector('form').onsubmit = e => { e.preventDefault(); kirim(); };
  }

  function daftarHtml() {
    if (st.daftar === null) return st.memuat ? '<div class="mk-kerangka"></div><div class="mk-kerangka"></div>' : '';
    if (!st.daftar.length) return '<p class="mk-kosong">Belum ada pesan. Pesan yang Anda kirim dan balasan admin akan tampil di sini.</p>';
    return st.daftar.map(m => {
      const [, ik, nama] = namaJenis(m.jenis);
      const dibalas = m.emoji || m.balasan;
      return `<article class="mk-item">
        <div class="mk-item-kepala"><span class="mk-lencana">${ik} ${esc(nama)}</span><time>${esc(waktu(m.t))}</time></div>
        <p class="mk-isi">${esc(m.pesan)}</p>
        ${dibalas ? `<div class="mk-balasan">
            ${m.emoji ? `<span class="mk-emoji" role="img" aria-label="Reaksi admin">${esc(m.emoji)}</span>` : ''}
            <div><b>Admin</b>${m.balasan ? `<p>${esc(m.balasan)}</p>` : ''}<time>${esc(waktu(m.dibalas))}</time></div>
          </div>` : ''}
      </article>`;
    }).join('');
  }

  async function muat() {
    if (!GOOGLE.sudahMasuk()) return render();
    st.memuat = true;
    render();
    try {
      st.daftar = (await api({ aksi: 'masukanSaya' })).masukan || [];
    } catch (e) {
      if (e.message) st.galat = e.message;
    }
    st.memuat = false;
    render();
  }

  async function kirim() {
    st.galat = '';
    if (!st.jenis) { st.galat = 'Pilih jenis masukannya dulu.'; return render(); }
    if (st.pesan.trim().length < 5) { st.galat = 'Tulis pesannya dulu (minimal 5 huruf).'; return render(); }
    st.mengirim = true;
    render();
    try {
      const j = await api({ aksi: 'kirimMasukan', jenis: st.jenis, pesan: st.pesan });
      st.daftar = [j.masukan].concat(st.daftar || []);
      st.pesan = '';
      st.jenis = '';
      st.mengirim = false;
      render();
      const k = document.createElement('p');
      k.className = 'mk-terkirim';
      k.setAttribute('role', 'status');
      k.textContent = 'Terkirim. Terima kasih! Balasan admin akan tampil di bawah.';
      kotak.querySelector('form').after(k);
      setTimeout(() => k.remove(), 5000);
    } catch (e) {
      st.mengirim = false;
      if (e.message) st.galat = e.message;
      render();
    }
  }

  kotak.addEventListener('click', async e => {
    const el = e.target.closest('[data-mk]');
    if (!el) return;
    const aksi = el.dataset.mk;
    if (aksi === 'jenis') {
      st.jenis = el.dataset.jenis;
      st.galat = '';
      render();
      kotak.querySelector('#mk-pesan').focus();
      return;
    }
    if (aksi === 'masuk') {
      st.galat = '';
      try {
        el.disabled = true;
        await GOOGLE.masuk(false);
        st.perluMasuk = false;
        st.daftar = null;
        await muat();
      } catch (err) {
        st.galat = err.message;
        render();
      }
    }
  });

  muat();
})();
