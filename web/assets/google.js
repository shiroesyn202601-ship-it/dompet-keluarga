/**
 * Login Google (Google Identity Services) dan pemanggil REST API Google langsung dari browser.
 * Token akses berlaku ±1 jam dan disimpan di localStorage supaya tidak perlu login ulang setiap buka.
 */
const GOOGLE = (() => {
  const IZIN = [
    'https://www.googleapis.com/auth/spreadsheets', // baca/tulis spreadsheet keluarga
    'https://www.googleapis.com/auth/drive.file',   // berbagi spreadsheet & OCR (hanya file buatan aplikasi ini)
    'https://www.googleapis.com/auth/drive.appdata', // menyimpan alamat spreadsheet milik akun ini
  ];
  const SCOPE = ['openid', 'email'].concat(IZIN).join(' ');
  const SIMPAN = 'dk_sesi';

  class PerluMasuk extends Error {}

  let sesi = bacaSesi(); // { token, kadaluarsa, email }

  function bacaSesi() {
    try { return JSON.parse(localStorage.getItem(SIMPAN)) || null; } catch (e) { return null; }
  }
  function tulisSesi(s) {
    try {
      if (s) localStorage.setItem(SIMPAN, JSON.stringify(s));
      else localStorage.removeItem(SIMPAN);
    } catch (e) { /* mode privat: sesi hanya di memori */ }
  }

  function tungguGis() {
    return new Promise((ok, gagal) => {
      const mulai = Date.now();
      (function cek() {
        if (window.google && google.accounts && google.accounts.oauth2) ok();
        else if (Date.now() - mulai > 15000) gagal(new Error('Layanan login Google tidak bisa dimuat. Periksa koneksi internet.'));
        else setTimeout(cek, 100);
      })();
    });
  }

  /** Harus dipanggil dari ketukan tombol, karena membuka jendela login Google. */
  async function masuk() {
    if (!KONFIG.clientId || /^ISI_/.test(KONFIG.clientId)) throw new Error('Client ID Google belum diisi di web/assets/config.js.');
    await tungguGis();
    const resp = await new Promise((ok, gagal) => {
      google.accounts.oauth2.initTokenClient({
        client_id: KONFIG.clientId,
        scope: SCOPE,
        callback: r => (r.error ? gagal(new Error(r.error_description || r.error)) : ok(r)),
        error_callback: e => gagal(new Error(e.type === 'popup_closed' ? 'Login dibatalkan.' : 'Login gagal: ' + (e.message || e.type))),
      }).requestAccessToken({ prompt: '', hint: sesi && sesi.email });
    });
    if (!google.accounts.oauth2.hasGrantedAllScopes(resp, ...IZIN)) {
      throw new Error('Izin belum lengkap. Masuk lagi dan centang semua akses yang diminta.');
    }
    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + resp.access_token },
    }).then(r => r.json());
    sesi = { token: resp.access_token, kadaluarsa: Date.now() + (Number(resp.expires_in) - 60) * 1000, email: info.email };
    tulisSesi(sesi);
    return sesi.email;
  }

  function keluar() {
    if (sesi && sesi.token && window.google && google.accounts) google.accounts.oauth2.revoke(sesi.token, () => {});
    sesi = null;
    tulisSesi(null);
  }

  function sudahMasuk() {
    return !!(sesi && sesi.token && Date.now() < sesi.kadaluarsa);
  }

  /**
   * fetch ke API Google dengan token. Opsi tambahan:
   *   json: objek yang dikirim sebagai body JSON
   *   teks: true untuk mengembalikan teks, bukan JSON
   */
  async function api(url, opsi = {}) {
    if (!sudahMasuk()) throw new PerluMasuk('Sesi login sudah habis. Silakan masuk lagi.');
    const headers = Object.assign({ Authorization: 'Bearer ' + sesi.token }, opsi.headers);
    let body = opsi.body;
    if (opsi.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opsi.json);
    }
    let res;
    try {
      res = await fetch(url, { method: opsi.method || 'GET', headers, body });
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke Google. Periksa koneksi internet.');
    }
    if (res.status === 401) {
      sesi.kadaluarsa = 0;
      tulisSesi(sesi);
      throw new PerluMasuk('Sesi login sudah habis. Silakan masuk lagi.');
    }
    if (!res.ok) {
      let pesan = '';
      try { pesan = (await res.json()).error.message; } catch (e) { /* bukan JSON */ }
      const err = new Error(pesan || 'Google API error ' + res.status);
      err.status = res.status;
      throw err;
    }
    if (opsi.teks) return res.text();
    return res.status === 204 ? null : res.json();
  }

  /** Body multipart/related untuk upload Drive: metadata JSON + isi file. */
  function multipart(metadata, blob) {
    const batas = 'dk' + Math.random().toString(36).slice(2);
    return {
      headers: { 'Content-Type': 'multipart/related; boundary=' + batas },
      body: new Blob([
        '--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        '\r\n--' + batas + '\r\nContent-Type: ' + (blob.type || 'application/octet-stream') + '\r\n\r\n',
        blob,
        '\r\n--' + batas + '--',
      ]),
    };
  }

  return { masuk, keluar, sudahMasuk, email: () => sesi && sesi.email, api, multipart, PerluMasuk };
})();
