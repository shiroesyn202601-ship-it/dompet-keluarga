/**
 * Login Google (Google Identity Services) dan pemanggil REST API Google langsung dari browser.
 * Token akses berlaku ±1 jam dan disimpan di localStorage supaya tidak perlu login ulang setiap buka.
 *
 * Hanya memakai scope non-sensitif, supaya aplikasi bisa dipakai siapa saja tanpa layar
 * "Google hasn't verified this app". Akibatnya aplikasi hanya bisa membuka spreadsheet yang
 * dibuatnya sendiri, atau yang dipilih pengguna lewat Google Picker (pilihSpreadsheet).
 */
const GOOGLE = (() => {
  const IZIN = [
    'https://www.googleapis.com/auth/drive.file',   // spreadsheet keluarga, berbagi & OCR (hanya file buatan/pilihan aplikasi ini)
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
    // Kalau aplikasi dibuka saat offline, script login di index.html gagal dimuat; muat ulang sekarang.
    // (readyState 'complete' = script asli sudah selesai dicoba, jadi tidak dimuat dobel.)
    if (document.readyState === 'complete' && !(window.google && google.accounts) && !document.querySelector('script[data-gis-ulang]')) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.dataset.gisUlang = '1';
      s.onerror = () => s.remove();
      document.head.appendChild(s);
    }
    return new Promise((ok, gagal) => {
      const mulai = Date.now();
      (function cek() {
        if (window.google && google.accounts && google.accounts.oauth2) ok();
        else if (Date.now() - mulai > 15000) gagal(new Error('Layanan login Google tidak bisa dimuat. Periksa koneksi internet.'));
        else setTimeout(cek, 100);
      })();
    });
  }

  /**
   * Harus dipanggil dari ketukan tombol, karena membuka jendela login Google.
   * Akun yang pernah masuk langsung dipakai lagi (jendela hanya berkedip); pilihAkun: true untuk ganti akun.
   */
  async function masuk(pilihAkun) {
    if (!KONFIG.clientId || /^ISI_/.test(KONFIG.clientId)) throw new Error('Client ID Google belum diisi di web/assets/config.js.');
    await tungguGis();
    const resp = await new Promise((ok, gagal) => {
      google.accounts.oauth2.initTokenClient({
        client_id: KONFIG.clientId,
        scope: SCOPE,
        // Hanya izin di atas; izin lama (mis. scope spreadsheets versi sebelumnya) tidak ikut terbawa.
        include_granted_scopes: false,
        callback: r => (r.error ? gagal(new Error(r.error_description || r.error)) : ok(r)),
        error_callback: e => gagal(new Error(e.type === 'popup_closed' ? 'Login dibatalkan.' : 'Login gagal: ' + (e.message || e.type))),
      }).requestAccessToken(pilihAkun ? { prompt: 'select_account' } : { prompt: '', hint: sesi && sesi.email });
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
   * Token tinggal < 20 menit, atau sudah habis tapi akunnya masih diingat → minta token baru diam-diam
   * (jendela Google hanya berkedip), supaya pengguna tidak perlu menekan "Lanjutkan sebagai …".
   * Harus dipanggil dari ketukan pengguna (syarat popup browser).
   * Hasil: Promise berisi email kalau berhasil (null kalau gagal), atau undefined kalau tidak perlu.
   */
  const SEGARKAN_MS = 20 * 60 * 1000;
  let sedangSegarkan = false;
  function segarkanKalauPerlu() {
    if (sedangSegarkan || !navigator.onLine || !(sesi && sesi.email)) return;
    if (sudahMasuk() && sesi.kadaluarsa - Date.now() > SEGARKAN_MS) return;
    sedangSegarkan = true;
    return masuk()
      .catch(() => null) // gagal: nanti tetap muncul kartu "Sesi login berakhir" seperti biasa
      .finally(() => { sedangSegarkan = false; });
  }

  /**
   * fetch ke API Google dengan token. Opsi tambahan:
   *   json: objek yang dikirim sebagai body JSON
   *   teks: true untuk mengembalikan teks, bukan JSON
   *   blob: true untuk mengembalikan isi file (Blob), mis. foto lampiran
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
      const err = new Error('Tidak bisa terhubung ke Google. Periksa koneksi internet.');
      err.jaringan = true; // dipakai app.js untuk mode offline & antrean transaksi
      throw err;
    }
    if (res.status === 401) {
      sesi.kadaluarsa = 0;
      tulisSesi(sesi);
      throw new PerluMasuk('Sesi login sudah habis. Silakan masuk lagi.');
    }
    if (!res.ok) {
      let pesan = '';
      try { pesan = (await res.json()).error.message; } catch (e) { /* bukan JSON */ }
      const err = new Error(terjemahkan(res.status, pesan));
      err.status = res.status;
      err.asli = pesan; // pesan asli Google (Inggris), untuk console
      if (pesan) console.warn('Google API ' + res.status + ': ' + pesan);
      throw err;
    }
    if (opsi.teks) return res.text();
    if (opsi.blob) return res.blob();
    return res.status === 204 ? null : res.json();
  }

  /** Pesan kesalahan Google yang umum → bahasa Indonesia; selain itu pesan aslinya dipakai. */
  const TERJEMAHAN = [
    [/storage quota|storageQuotaExceeded/i, 'Penyimpanan Google Drive Anda penuh. Kosongkan sebagian di drive.google.com lalu coba lagi.'],
    [/above the limit|cells in the workbook/i, 'Spreadsheet sudah mencapai batas ukuran Google. Buat buku baru di ⚙️ → Buku keuangan.'],
    [/insufficient (permission|authentication)/i, 'Izin Google belum lengkap. Keluar, lalu masuk lagi dan centang semua akses yang diminta.'],
    [/unable to parse range/i, 'Susunan spreadsheet berubah (mungkin nama sheet diganti). Kembalikan nama sheet aslinya, lalu coba lagi.'],
  ];
  function terjemahkan(status, pesan) {
    const cocok = TERJEMAHAN.find(([pola]) => pola.test(pesan));
    if (cocok) return cocok[1];
    if (status === 429 || /rate ?limit|quota/i.test(pesan)) return 'Terlalu banyak permintaan ke Google dalam waktu singkat. Tunggu sebentar, lalu coba lagi.';
    if (status >= 500) return 'Layanan Google sedang gangguan. Coba lagi beberapa saat lagi.';
    if (status === 403) return 'Anda tidak punya akses untuk tindakan ini. Minta pemilik spreadsheet memberi akses Editor.';
    if (status === 404) return 'File tidak ditemukan di Google Drive. Mungkin sudah dihapus atau dipindahkan.';
    return pesan || 'Terjadi kesalahan di Google (kode ' + status + '). Coba lagi.';
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

  // ---------- Google Picker ----------

  let pickerSiap = null;
  function muatPicker() {
    if (!pickerSiap) {
      pickerSiap = new Promise((ok, gagal) => {
        const s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js';
        s.onload = () => gapi.load('picker', { callback: ok, onerror: gagal });
        s.onerror = gagal;
        document.head.appendChild(s);
      }).catch(() => {
        pickerSiap = null;
        throw new Error('Pemilih file Google tidak bisa dimuat. Periksa koneksi internet.');
      });
    }
    return pickerSiap;
  }

  /**
   * Pengguna memilih spreadsheet lewat Google Picker; sejak itu aplikasi boleh membukanya (scope drive.file).
   * idFile: tampilkan hanya file itu (link undangan / izin ulang).
   * opsi.undangan: hanya spreadsheet yang dibagikan orang lain ke akun ini ("Cek undangan").
   * opsi.banyak: boleh memilih beberapa sekaligus → hasilnya array ID (kosong kalau dibatalkan).
   * Tanpa opsi.banyak: ID file, atau null kalau dibatalkan.
   */
  async function pilihSpreadsheet(idFile, opsi = {}) {
    if (!sudahMasuk()) throw new PerluMasuk('Sesi login sudah habis. Silakan masuk lagi.');
    await muatPicker();
    const P = google.picker;
    const view = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST);
    if (idFile) view.setFileIds(idFile);
    else if (opsi.undangan) view.setOwnedByMe(false);
    const judul = idFile ? 'Ketuk spreadsheet Dompet Keluarga, lalu Pilih'
      : opsi.undangan ? (opsi.banyak ? 'Buku yang dibagikan ke Anda · pilih satu atau beberapa' : 'Buku yang dibagikan ke Anda')
      : 'Pilih spreadsheet Dompet Keluarga';
    return new Promise(ok => {
      const b = new P.PickerBuilder()
        .setOAuthToken(sesi.token)
        .setAppId(KONFIG.clientId.split('-')[0]) // nomor project Google Cloud
        .setLocale('id')
        .setTitle(judul)
        .addView(view)
        .setCallback(d => {
          const aksi = d[P.Response.ACTION];
          if (aksi === P.Action.PICKED) {
            const id = d[P.Response.DOCUMENTS].map(x => x[P.Document.ID]);
            ok(opsi.banyak ? id : id[0]);
          } else if (aksi === P.Action.CANCEL) ok(opsi.banyak ? [] : null);
        });
      if (opsi.banyak) b.enableFeature(P.Feature.MULTISELECT_ENABLED);
      if (KONFIG.pickerApiKey) b.setDeveloperKey(KONFIG.pickerApiKey);
      b.build().setVisible(true);
    });
  }

  return { masuk, keluar, sudahMasuk, segarkanKalauPerlu, email: () => sesi && sesi.email, api, multipart, pilihSpreadsheet, PerluMasuk };
})();
