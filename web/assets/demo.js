/**
 * Mode coba: aplikasi bisa dipakai tanpa akun Google, berisi data contoh satu keluarga.
 *
 * Cara kerjanya: fungsi GOOGLE.api diganti "Google tiruan" yang menyimpan spreadsheet & file Drive di memori
 * (disalin ke localStorage supaya bertahan saat aplikasi dimuat ulang). db.js dan app.js tidak tahu bedanya,
 * jadi semua fitur (catat, ubah, hapus, anggaran, laporan, tabungan, buku baru, catatan…) berjalan seperti biasa.
 * Fitur yang benar-benar butuh Google (foto struk, undang anggota, bot Telegram, Google Picker, kunci aplikasi)
 * ditahan di app.js (lihat AKSI_BUTUH_AKUN).
 *
 * Masuk: ketuk "Coba dulu tanpa akun" di layar masuk, atau buka alamat aplikasi dengan ?coba (dipakai tentang.html).
 * Keluar: "Pakai sungguhan" di bilah atas, atau ⚙️ → Akhiri mode coba. Semua data contoh dihapus dari HP.
 */
const DEMO = (() => {
  const KUNCI = 'dk_demo';       // '1' = mode coba aktif di HP ini
  const KUNCI_DB = 'dk_demo_db'; // isi Google tiruan (spreadsheet, file, izin)
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const MIME_SHEET = 'application/vnd.google-apps.spreadsheet';
  const EMAIL = 'sari@coba.invalid';      // .invalid: domain cadangan, tidak pernah ada pemiliknya
  const EMAIL_PASANGAN = 'andi@coba.invalid';

  let nyala = false;
  const VERSI_CONTOH = 3; // naikkan kalau data contoh ditambah fitur baru
  let st = null;          // { email, n, ss: { id: { sheets: [{ sheetId, title, rows, lindung }] } }, files: { id: {...} }, izin: { id: [...] } }
  const isiFoto = new Map(); // foto lampiran (Blob) hanya di memori; tidak muat di localStorage
  let asli = null;        // fungsi GOOGLE yang asli, dipasang lagi saat mode coba berakhir

  try { nyala = localStorage.getItem(KUNCI) === '1'; } catch (e) { /* mode privat */ }

  function simpan() {
    try { localStorage.setItem(KUNCI_DB, JSON.stringify(st)); } catch (e) { /* penuh / mode privat: tetap jalan di memori */ }
  }
  function bacaSimpanan() {
    try { return JSON.parse(localStorage.getItem(KUNCI_DB)); } catch (e) { return null; }
  }

  function acakId(n) {
    const huruf = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < n; i++) s += huruf[Math.floor(Math.random() * huruf.length)];
    return s;
  }

  function galat(status, pesan) {
    const e = new Error(pesan);
    e.status = status;
    return e;
  }
  const tidakAda = () => galat(404, T('File tidak ditemukan di Google Drive. Mungkin sudah dihapus atau dipindahkan.'));

  // ---------- Sheets tiruan ----------

  /** Huruf kolom → indeks 0. */
  const kolom = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

  /** "'Transaksi'!A2:L" → { nama, r1, c1, r2, c2 } (indeks 0; Infinity = sampai ujung). */
  function urai(range) {
    const m = String(range).match(/^(?:'((?:[^']|'')+)'|([^!]+))(?:!(.*))?$/);
    if (!m) throw galat(400, T('Susunan spreadsheet berubah (mungkin nama sheet diganti). Kembalikan nama sheet aslinya, lalu coba lagi.'));
    const nama = m[1] ? m[1].replace(/''/g, "'") : m[2];
    const sel = m[3] || '';
    const p = sel.match(/^([A-Z]*)(\d*)(:([A-Z]*)(\d*))?$/) || [];
    const c1 = p[1] ? kolom(p[1]) : 0;
    const r1 = p[2] ? Number(p[2]) - 1 : 0;
    let c2 = Infinity;
    let r2 = Infinity;
    if (p[3]) {
      if (p[4]) c2 = kolom(p[4]);
      if (p[5]) r2 = Number(p[5]) - 1;
    } else if (sel) {
      if (p[1]) c2 = c1;
      if (p[2]) r2 = r1;
    }
    return { nama, r1, c1, r2, c2 };
  }

  function sheetDari(ss, nama) {
    const sh = ss.sheets.find(s => s.title === nama);
    if (!sh) throw galat(400, T('Susunan spreadsheet berubah (mungkin nama sheet diganti). Kembalikan nama sheet aslinya, lalu coba lagi.'));
    return sh;
  }

  const kosong = v => v === '' || v === null || v === undefined;

  /** Membaca seperti Sheets API: sel & baris kosong di ujung dibuang, hasil kosong = tanpa `values`. */
  function bacaRange(ss, range, perKolom) {
    const r = urai(range);
    const sh = sheetDari(ss, r.nama);
    const out = [];
    for (let i = r.r1; i <= Math.min(r.r2, sh.rows.length - 1); i++) {
      const isi = (sh.rows[i] || []).slice(r.c1, r.c2 === Infinity ? undefined : r.c2 + 1).map(v => (kosong(v) ? '' : v));
      while (isi.length && kosong(isi[isi.length - 1])) isi.pop();
      out.push(isi);
    }
    while (out.length && !out[out.length - 1].length) out.pop();
    let values = out;
    if (perKolom) {
      values = [];
      out.forEach((row, i) => row.forEach((v, j) => {
        values[j] = values[j] || [];
        values[j][i] = v;
      }));
      values = values.map(k => Array.from(k, v => (v === undefined ? '' : v)));
    }
    const hasil = { range, majorDimension: perKolom ? 'COLUMNS' : 'ROWS' };
    if (values.length) hasil.values = values;
    return hasil;
  }

  function tulisDi(sh, r1, c1, values) {
    values.forEach((row, i) => {
      while (sh.rows.length <= r1 + i) sh.rows.push([]);
      const t = sh.rows[r1 + i];
      row.forEach((v, j) => {
        if (v === null || v === undefined) return; // null = sel dilewati (seperti Sheets API)
        while (t.length < c1 + j) t.push('');
        t[c1 + j] = v;
      });
    });
  }

  function tulisRange(ss, range, values) {
    const r = urai(range);
    tulisDi(sheetDari(ss, r.nama), r.r1, r.c1, values || []);
  }

  function tambahDi(ss, range, values) {
    const r = urai(range);
    const sh = sheetDari(ss, r.nama);
    let akhir = sh.rows.length;
    while (akhir > 0 && !(sh.rows[akhir - 1] || []).some(v => !kosong(v))) akhir--;
    sh.rows.length = akhir;
    tulisDi(sh, akhir, r.c1, values || []);
    return { updates: { updatedRange: "'" + sh.title + "'!A" + (akhir + 1), updatedRows: (values || []).length } };
  }

  function metaSpreadsheet(id) {
    const ss = st.ss[id];
    return {
      spreadsheetId: id,
      properties: { title: (st.files[id] && st.files[id].name) || 'Dompet Keluarga' },
      sheets: ss.sheets.map(s => ({
        properties: { sheetId: s.sheetId, title: s.title },
        protectedRanges: s.lindung ? [{ description: s.lindung }] : [],
      })),
    };
  }

  function buatSpreadsheet(json) {
    const id = 'coba-' + acakId(28);
    st.ss[id] = {
      sheets: ((json && json.sheets) || [{ properties: { title: 'Sheet1' } }]).map((s, i) => ({
        sheetId: s.properties.sheetId !== undefined ? s.properties.sheetId : i, title: s.properties.title, rows: [], lindung: '',
      })),
    };
    st.files[id] = { name: (json && json.properties && json.properties.title) || 'Dompet Keluarga', mimeType: MIME_SHEET, parents: [] };
    st.izin[id] = [{ id: 'izin-' + acakId(8), type: 'user', role: 'owner', emailAddress: st.email, displayName: namaDari(st.email) }];
    return metaSpreadsheet(id);
  }

  function batchUpdate(ss, requests) {
    return {
      replies: (requests || []).map(q => {
        if (q.addSheet) {
          const p = q.addSheet.properties || {};
          const sheetId = p.sheetId !== undefined ? p.sheetId : Math.max(-1, ...ss.sheets.map(s => s.sheetId)) + 1;
          ss.sheets.push({ sheetId, title: p.title, rows: [], lindung: '' });
          return { addSheet: { properties: { sheetId, title: p.title } } };
        }
        if (q.deleteDimension) {
          const r = q.deleteDimension.range;
          const sh = ss.sheets.find(s => s.sheetId === r.sheetId);
          if (sh && r.dimension === 'ROWS') sh.rows.splice(r.startIndex, r.endIndex - r.startIndex);
          return {};
        }
        if (q.addProtectedRange) {
          const p = q.addProtectedRange.protectedRange;
          const sh = ss.sheets.find(s => s.sheetId === p.range.sheetId);
          if (sh) sh.lindung = p.description || 'ya';
          return { addProtectedRange: { protectedRange: p } };
        }
        return {}; // format sel dll.: tidak ada artinya di tiruan
      }),
    };
  }

  function sheets(u, metode, json) {
    const jalur = u.pathname.replace(/^\/v4\/spreadsheets\/?/, '');
    if (!jalur) {
      if (metode !== 'POST') throw galat(400, 'Metode tidak didukung');
      return buatSpreadsheet(json);
    }
    const m = jalur.match(/^([^/:]+)(.*)$/);
    const id = decodeURIComponent(m[1]);
    const sisa = m[2];
    const ss = st.ss[id];
    if (!ss || (st.files[id] && st.files[id].trashed)) throw tidakAda();
    if (!sisa && metode === 'GET') return metaSpreadsheet(id);
    if (sisa === ':batchUpdate') return batchUpdate(ss, json.requests);
    if (sisa === '/values:batchGet') {
      const perKolom = u.searchParams.get('majorDimension') === 'COLUMNS';
      return { spreadsheetId: id, valueRanges: u.searchParams.getAll('ranges').map(r => bacaRange(ss, r, perKolom)) };
    }
    if (sisa === '/values:batchUpdate') {
      (json.data || []).forEach(d => tulisRange(ss, d.range, d.values));
      return { spreadsheetId: id, totalUpdatedCells: 0 };
    }
    if (sisa.startsWith('/values/')) {
      let range = sisa.slice('/values/'.length);
      const tambah = range.endsWith(':append');
      if (tambah) range = range.slice(0, -':append'.length);
      range = decodeURIComponent(range);
      if (tambah) return tambahDi(ss, range, json.values);
      if (metode === 'PUT') {
        tulisRange(ss, range, json.values);
        return { spreadsheetId: id, updatedRange: range };
      }
      return bacaRange(ss, range, u.searchParams.get('majorDimension') === 'COLUMNS');
    }
    throw galat(400, 'Permintaan Sheets tidak dikenal: ' + sisa);
  }

  // ---------- Drive tiruan ----------

  function infoFile(id) {
    const f = st.files[id];
    return { id, name: f.name, mimeType: f.mimeType || '', parents: (f.parents || []).slice(), trashed: !!f.trashed, ownedByMe: true };
  }

  function drive(u, metode, json, opsi) {
    const jalur = u.pathname.replace(/^\/drive\/v3\/files\/?/, '').split('/').map(decodeURIComponent);
    const [id, bagian, idIzin] = jalur;
    if (!id) {
      if (metode === 'POST') { // folder baru
        const idBaru = 'coba-' + acakId(20);
        st.files[idBaru] = { name: json.name, mimeType: json.mimeType || '', parents: json.parents || [] };
        return { id: idBaru };
      }
      const nama = ((u.searchParams.get('q') || '').match(/name\s*=\s*'([^']*)'/) || [])[1];
      const appData = u.searchParams.get('spaces') === 'appDataFolder';
      const files = Object.keys(st.files)
        .filter(k => !st.files[k].trashed && !!st.files[k].appData === appData && (nama === undefined || st.files[k].name === nama))
        .map(k => ({ id: k, name: st.files[k].name }));
      return { files };
    }
    const f = st.files[id];
    if (!f) throw tidakAda();
    if (bagian === 'permissions') {
      const daftar = st.izin[id] || (st.izin[id] = []);
      if (metode === 'GET') return { permissions: daftar };
      if (metode === 'POST') {
        const ada = daftar.find(p => p.emailAddress && json.emailAddress && p.emailAddress.toLowerCase() === json.emailAddress.toLowerCase());
        if (ada) return ada;
        const p = Object.assign({ id: 'izin-' + acakId(8), displayName: namaDari(json.emailAddress || '') }, json);
        daftar.push(p);
        return p;
      }
      if (metode === 'DELETE') {
        st.izin[id] = daftar.filter(p => p.id !== idIzin);
        return null;
      }
    }
    if (bagian === 'export') throw galat(400, T('Baca foto struk butuh akun Google.'));
    if (metode === 'DELETE') {
      delete st.files[id];
      isiFoto.delete(id);
      return null;
    }
    if (metode === 'PATCH') {
      if (json && json.name !== undefined) f.name = json.name;
      if (json && json.trashed !== undefined) f.trashed = !!json.trashed;
      const tambah = u.searchParams.get('addParents');
      const buang = u.searchParams.get('removeParents');
      if (buang) f.parents = (f.parents || []).filter(p => !buang.split(',').includes(p));
      if (tambah) f.parents = (f.parents || []).concat(tambah.split(','));
      return infoFile(id);
    }
    if (u.searchParams.get('alt') === 'media') {
      if (opsi.blob) {
        const b = isiFoto.get(id);
        if (!b) throw tidakAda();
        return b;
      }
      return f.isi ? JSON.parse(f.isi) : null;
    }
    return infoFile(id);
  }

  async function unggah(u, metode, opsi, json) {
    const id = decodeURIComponent(u.pathname.replace(/^\/upload\/drive\/v3\/files\/?/, ''));
    if (id && metode === 'PATCH') { // isi config.json diganti
      if (!st.files[id]) throw tidakAda();
      st.files[id].isi = JSON.stringify(json);
      return infoFile(id);
    }
    const kiriman = opsi.body || {};
    const meta = kiriman.meta || {};
    if (meta.mimeType === 'application/vnd.google-apps.document') throw galat(400, T('Baca foto struk butuh akun Google.'));
    const idBaru = 'coba-' + acakId(20);
    const parents = meta.parents || [];
    st.files[idBaru] = { name: meta.name || 'file', mimeType: meta.mimeType || '', parents: parents.filter(p => p !== 'appDataFolder') };
    if (parents.includes('appDataFolder')) {
      st.files[idBaru].appData = true;
      st.files[idBaru].isi = kiriman.blob ? await kiriman.blob.text() : '{}';
    } else if (kiriman.blob) {
      isiFoto.set(idBaru, kiriman.blob);
    }
    return { id: idBaru };
  }

  /** Pengganti GOOGLE.api: perilaku & bentuk jawaban sama dengan REST API Google yang dipakai db.js. */
  async function api(url, opsi = {}) {
    await new Promise(ok => setTimeout(ok, 40)); // sedikit jeda supaya animasi memuat tetap wajar
    const u = new URL(url);
    const metode = (opsi.method || 'GET').toUpperCase();
    const json = opsi.json !== undefined ? JSON.parse(JSON.stringify(opsi.json)) : undefined;
    let hasil;
    if (url.startsWith(SHEETS)) hasil = sheets(u, metode, json);
    else if (url.startsWith(UPLOAD)) hasil = await unggah(u, metode, opsi, json);
    else if (url.startsWith(DRIVE)) hasil = drive(u, metode, json, opsi);
    else throw galat(400, 'Alamat tidak dikenal di mode coba: ' + url);
    if (metode !== 'GET') simpan();
    if (opsi.kemajuan) opsi.kemajuan(100);
    if (hasil instanceof Blob) return hasil;
    return hasil == null ? null : JSON.parse(JSON.stringify(hasil));
  }

  /** Body unggahan untuk tiruan: metadata & isi dibiarkan terpisah (tidak perlu dirakit jadi multipart). */
  function multipart(meta, blob) {
    return { headers: {}, body: { meta, blob } };
  }

  // ---------- Data contoh ----------

  function namaDari(email) {
    const n = String(email).split('@')[0];
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  /** Angka acak yang sama tiap kali dibuat (mulberry32), supaya data contoh selalu terlihat wajar. */
  function pembangkit(benih) {
    let a = benih >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const EPOCH = Date.UTC(1899, 11, 30);
  const serial = (d, jam = 0) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5 + jam / 24;
  const geser = (d, hari) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + hari);

  const KOLOM = {
    Transaksi: ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Dibuat Oleh', 'Dibuat Pada', 'Diubah Pada', 'Lampiran'],
    Kategori: ['Nama', 'Tipe', 'Ikon', 'Anggaran', 'Bawa Sisa'],
    Dompet: ['Nama', 'Ikon', 'Saldo Awal', 'Jenis', 'Target', 'Tenggat'],
    Pengaturan: ['Kunci', 'Nilai'],
    Rutin: ['ID', 'Nama', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Ulang', 'Mulai', 'Berikutnya'],
    Catatan: ['ID', 'Tanggal', 'Judul', 'Isi', 'Pengingat', 'Ulang', 'Warna', 'Dibuat Oleh', 'Dibuat Pada', 'Sematkan', 'Arsip', 'Diubah Pada'],
    Log: ['Waktu', 'Oleh', 'Aksi', 'Ringkasan', 'ID Transaksi'],
  };

  function buatContoh() {
    const en = typeof BAHASA !== 'undefined' && BAHASA === 'en';
    const L = (id, inggris) => (en ? inggris : id);
    const acak = pembangkit(20261109);
    const antara = (a, b, bulat = 1000) => Math.round((a + acak() * (b - a)) / bulat) * bulat;
    const pilih = daftar => daftar[Math.floor(acak() * daftar.length)];
    let n = 1;
    const idTrx = () => 'coba-' + (n++).toString(36).padStart(4, '0') + acakId(12);

    const MASUK = 'Pemasukan';
    const KELUAR = 'Pengeluaran';
    const TRANSFER = 'Transfer';
    const SAYA = EMAIL;
    const DIA = EMAIL_PASANGAN;
    const DARURAT = L('Dana Darurat', 'Emergency Fund');
    const LIBURAN = L('Liburan Bali', 'Bali Trip');
    const PEMINJAM = 'Joko';
    const EMAS = L('Emas Antam', 'Gold');

    const sekarang = new Date();
    const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    const jamSekarang = sekarang.getHours() + sekarang.getMinutes() / 60;
    const awal = new Date(hariIni.getFullYear(), hariIni.getMonth() - 3, 1);

    const trx = [];
    const catat = (d, tipe, jumlah, kategori, dompet, tujuan, catatan, oleh, jam) => {
      let j = jam === undefined ? 7 + acak() * 14 : jam;
      if (+d === +hariIni) j = Math.max(0, Math.min(j, jamSekarang - 0.2));
      const dibuat = serial(d, j);
      const baris = [idTrx(), serial(d), tipe, jumlah, kategori, dompet, tujuan || '', catatan, oleh, dibuat, dibuat, ''];
      trx.push(baris);
      return baris;
    };
    const keluar = (d, jumlah, kategori, dompet, catatan, oleh, jam) => catat(d, KELUAR, jumlah, kategori, dompet, '', catatan, oleh, jam);
    const masuk = (d, jumlah, kategori, dompet, catatan, oleh, jam) => catat(d, MASUK, jumlah, kategori, dompet, '', catatan, oleh, jam);

    // Tagihan & transaksi rutin: dicatat tiap bulan sebelum hari ini; jatuh tempo berikutnya ≥ hari ini.
    // Catatan transaksinya = nama rutin, supaya kartu "Sepertinya rutin" tidak menyarankannya lagi (db.js → saranRutin_).
    const hariBpjs = Math.min(geser(hariIni, 3).getDate(), 28);
    const RUTIN = [
      { nama: L('Gaji bulanan', 'Monthly salary'), tipe: MASUK, jumlah: 9500000, kategori: 'Gaji', dompet: 'BCA', hari: 1, oleh: SAYA },
      { nama: L('Setor dana darurat', 'Emergency fund deposit'), tipe: TRANSFER, jumlah: 1000000, dompet: 'BCA', tujuan: DARURAT, hari: 2, oleh: SAYA },
      { nama: L('Token listrik', 'Electricity'), tipe: KELUAR, jumlah: 480000, kategori: 'Tagihan & Utilitas', dompet: 'BCA', hari: 5, oleh: SAYA, naikTurun: true },
      { nama: L('Internet rumah', 'Home internet'), tipe: KELUAR, jumlah: 385000, kategori: 'Tagihan & Utilitas', dompet: 'BCA', hari: 8, oleh: SAYA },
      { nama: L('SPP sekolah Kakak', 'School fees'), tipe: KELUAR, jumlah: 750000, kategori: 'Pendidikan', dompet: 'BCA', hari: 10, oleh: DIA },
      { nama: L('Arisan RT', 'Savings club'), tipe: KELUAR, jumlah: 200000, kategori: 'Sosial & Donasi', dompet: 'Tunai', hari: 14, oleh: DIA },
      { nama: L('Iuran BPJS', 'Health insurance'), tipe: KELUAR, jumlah: 300000, kategori: 'Kesehatan', dompet: 'BCA', hari: hariBpjs, oleh: SAYA },
    ];

    const C = {
      sayur: [L('Sayur & lauk di pasar', 'Vegetables & groceries at the market'), L('Belanja di warung', 'Corner shop groceries'), L('Beras 5 kg', 'Rice 5 kg'), L('Buah-buahan', 'Fruit')],
      makan: [
        [L('Kopi susu', 'Iced coffee'), 18, 32, 'GoPay', SAYA],
        [L('Bakso', 'Meatball soup'), 25, 40, 'Tunai', SAYA],
        [L('Makan siang kantor', 'Office lunch'), 28, 50, 'GoPay', SAYA],
        [L('Martabak manis', 'Sweet martabak'), 45, 70, 'Tunai', DIA],
        [L('GoFood ayam geprek', 'Food delivery'), 45, 80, 'GoPay', DIA],
      ],
      anak: [[L('Popok', 'Diapers'), 130, 180], [L('Susu formula', 'Formula milk'), 150, 230], [L('Vitamin anak', 'Kids vitamins'), 60, 110]],
      hiburan: [[L('Nonton bioskop', 'Cinema'), 100, 160], [L('Main ke taman bermain', 'Playground outing'), 75, 150], [L('Kolam renang', 'Swimming pool'), 60, 100]],
      rumah: [[L('Gas LPG', 'Cooking gas'), 25, 25, 'Tunai'], [L('Sabun & deterjen', 'Soap & detergent'), 40, 90, 'BCA'], [L('Galon air minum', 'Drinking water'), 20, 22, 'Tunai']],
    };

    for (let d = new Date(awal); d <= hariIni; d = geser(d, 1)) {
      const tgl = d.getDate();
      const lalu = d < hariIni;
      const akhirPekan = d.getDay() === 0 || d.getDay() === 6;
      const bulanKe = (d.getFullYear() - awal.getFullYear()) * 12 + d.getMonth() - awal.getMonth();

      if (lalu) {
        RUTIN.forEach(r => {
          if (r.hari !== tgl) return;
          const jumlah = r.naikTurun ? antara(r.jumlah - 40000, r.jumlah + 40000) : r.jumlah;
          catat(d, r.tipe, jumlah, r.kategori || '', r.dompet, r.tujuan, r.nama, r.oleh, 8 + acak() * 3);
        });
        if (tgl === 3) catat(d, TRANSFER, 400000, '', 'BCA', 'GoPay', L('Isi saldo GoPay', 'GoPay top-up'), SAYA);
        if (tgl === 2 || tgl === 16) catat(d, TRANSFER, 1500000, '', 'BCA', 'Tunai', L('Tarik tunai', 'Cash withdrawal'), DIA);
        if (tgl === 4) keluar(d, antara(550000, 750000), 'Belanja Harian', 'BCA', L('Belanja bulanan di supermarket', 'Monthly supermarket run'), SAYA);
        if (tgl === 15) masuk(d, antara(2000000, 3000000, 50000), 'Usaha', 'Mandiri', L('Hasil jualan kue', 'Cake sales'), DIA);
        if (tgl === 20) catat(d, TRANSFER, 500000, '', 'Mandiri', LIBURAN, L('Nabung liburan', 'Holiday savings'), DIA);
        if (bulanKe === 1 && tgl === 22) {
          keluar(d, 850000, 'Transportasi', 'BCA', L('Tiket kereta #liburan', 'Train tickets #holiday'), SAYA);
          keluar(d, 1200000, 'Hiburan', 'BCA', L('Hotel #liburan', 'Hotel #holiday'), SAYA);
          keluar(geser(d, 2), 300000, 'Belanja Harian', 'Tunai', L('Oleh-oleh #liburan', 'Souvenirs #holiday'), DIA);
        }
      }

      // Pengeluaran harian
      const sebelum = trx.length;
      if (acak() < 0.65) {
        const ket = pilih(C.sayur);
        keluar(d, ket === C.sayur[2] ? antara(65000, 80000) : antara(45000, 160000), 'Belanja Harian', acak() < 0.7 ? 'Tunai' : 'BCA', ket, DIA);
      }
      if (acak() < 0.6) {
        const [ket, a, b, dompet, oleh] = pilih(C.makan);
        keluar(d, antara(a * 1000, b * 1000, 500), 'Makan & Minum', dompet, ket, oleh);
      }
      if (akhirPekan && acak() < 0.5) keluar(d, antara(150000, 300000), 'Makan & Minum', 'BCA', L('Makan keluarga di luar', 'Family dinner out'), SAYA, 19);
      if (acak() < 0.25) keluar(d, antara(30000, 45000), 'Transportasi', 'Tunai', L('Bensin motor', 'Motorbike fuel'), SAYA);
      if (acak() < 0.12) keluar(d, antara(15000, 35000, 500), 'Transportasi', 'GoPay', L('Ojek online', 'Ride-hailing'), DIA);
      if (acak() < 0.2) keluar(d, 5000, 'Transportasi', 'Tunai', L('Parkir', 'Parking'), SAYA);
      if (acak() < 0.14) {
        const [ket, a, b] = pilih(C.anak);
        keluar(d, antara(a * 1000, b * 1000), 'Anak', 'BCA', ket, DIA);
      }
      if (!akhirPekan && acak() < 0.3) keluar(d, antara(10000, 20000), 'Anak', 'Tunai', L('Jajan Kakak', 'Pocket money'), DIA, 7);
      if (akhirPekan && acak() < 0.35) {
        const [ket, a, b] = pilih(C.hiburan);
        keluar(d, antara(a * 1000, b * 1000), 'Hiburan', 'BCA', ket, SAYA);
      }
      if (acak() < 0.12) {
        const [ket, a, b, dompet] = pilih(C.rumah);
        keluar(d, antara(a * 1000, b * 1000), 'Rumah Tangga', dompet, ket, DIA);
      }
      if (acak() < 0.03) keluar(d, antara(35000, 250000), 'Kesehatan', 'Tunai', pilih([L('Obat flu', 'Cold medicine'), L('Periksa ke dokter', 'Doctor visit')]), DIA);
      if (acak() < 0.025) keluar(d, antara(120000, 300000), 'Pakaian', 'BCA', pilih([L('Baju anak', 'Kids clothes'), L('Sepatu sekolah', 'School shoes')]), DIA);
      if (acak() < 0.05) keluar(d, antara(20000, 50000), 'Sosial & Donasi', 'Tunai', L('Sumbangan masjid', 'Mosque donation'), SAYA);
      // Tiga minggu terakhir selalu ada catatan, supaya streak 🔥 terlihat.
      if (trx.length === sebelum && d >= geser(hariIni, -21)) {
        keluar(d, antara(18000, 30000, 500), 'Makan & Minum', 'GoPay', L('Kopi susu', 'Iced coffee'), SAYA);
      }
    }

    // Emas (dalam gram): beli 1 gram 40 hari lalu, dibayar dari BCA.
    const beliEmas = catat(geser(hariIni, -40), TRANSFER, 2390000, '', 'BCA', EMAS, L('Beli emas 1 gram', 'Bought 1 gram of gold'), SAYA, 10);

    // Piutang: teman meminjam, jatuh tempo 10 hari lagi.
    catat(geser(hariIni, -12), TRANSFER, 500000, '', 'BCA', PEMINJAM, L('Pinjam untuk servis motor', 'Loan for motorbike repair'), SAYA);

    trx.sort((a, b) => a[9] - b[9]);

    // Saldo awal dompet dibuat cukup supaya saldo tidak pernah minus.
    const DOMPET = [
      ['Tunai', '💵', 300000, 'Dompet', '', ''],
      ['BCA', '🏦', 3000000, 'Dompet', '', ''],
      ['Mandiri', '🏦', 1000000, 'Dompet', '', ''],
      ['GoPay', '📱', 50000, 'Dompet', '', ''],
      [DARURAT, '🛟', 6000000, 'Tabungan', 20000000, ''],
      [LIBURAN, '🏝️', 1500000, 'Tabungan', 8000000, serial(new Date(hariIni.getFullYear(), hariIni.getMonth() + 7, 1))],
      [PEMINJAM, '🤝', 0, 'Utang', '', serial(geser(hariIni, 10))],
      [EMAS, '🪙', 12500000, 'Aset', '', ''],
    ];
    const jalan = {};
    const terendah = {};
    trx.forEach(r => {
      const ubah = (nama, n) => {
        jalan[nama] = (jalan[nama] || 0) + n;
        terendah[nama] = Math.min(terendah[nama] || 0, jalan[nama]);
      };
      if (r[2] === MASUK) ubah(r[5], r[3]);
      else if (r[2] === KELUAR) ubah(r[5], -r[3]);
      else { ubah(r[5], -r[3]); ubah(r[6], r[3]); }
    });
    DOMPET.forEach(w => {
      if (w[3] === 'Dompet' && terendah[w[0]] < 0) w[2] += Math.ceil(-terendah[w[0]] / 100000) * 100000;
    });

    const KATEGORI = [
      ['Makan & Minum', KELUAR, '🍜', 1200000, ''],
      ['Belanja Harian', KELUAR, '🛒', 2500000, 'Ya'],
      ['Transportasi', KELUAR, '⛽', 500000, ''],
      ['Tagihan & Utilitas', KELUAR, '💡', 1400000, ''],
      ['Rumah Tangga', KELUAR, '🏠', 400000, ''],
      ['Kesehatan', KELUAR, '💊', 500000, ''],
      ['Pendidikan', KELUAR, '📚', 800000, ''],
      ['Anak', KELUAR, '👶', 900000, ''],
      ['Hiburan', KELUAR, '🎬', 500000, ''],
      ['Pakaian', KELUAR, '👕', '', ''],
      ['Sosial & Donasi', KELUAR, '🤲', 300000, ''],
      ['Lainnya', KELUAR, '📦', '', ''],
      ['Gaji', MASUK, '💼', '', ''],
      ['Bonus', MASUK, '🎁', '', ''],
      ['Usaha', MASUK, '🏪', '', ''],
      ['Investasi', MASUK, '📈', '', ''],
      ['Lainnya', MASUK, '💰', '', ''],
    ];

    const rutin = RUTIN.map(r => {
      const mulai = new Date(awal.getFullYear(), awal.getMonth(), r.hari);
      const bulanIni = new Date(hariIni.getFullYear(), hariIni.getMonth(), r.hari);
      const berikut = bulanIni >= hariIni ? bulanIni : new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, r.hari);
      return [idTrx(), r.nama, r.tipe, r.jumlah, r.kategori || '', r.dompet, r.tujuan || '', r.nama, 'Bulanan', serial(mulai), serial(berikut)];
    });

    const kini = serial(hariIni, jamSekarang);
    const catatan = [
      [idTrx(), serial(hariIni), L('Belanja mingguan', 'Weekly shopping'),
        L('[ ] Telur 1 kg\n[ ] Minyak goreng 2 L\n[x] Beras 5 kg\n[ ] Sabun cuci piring', '[ ] Eggs 1 kg\n[ ] Cooking oil 2 L\n[x] Rice 5 kg\n[ ] Dish soap'),
        '', '', 'hijau', DIA, kini],
      [idTrx(), serial(geser(hariIni, 5)), L('Bayar pajak motor', 'Pay motorbike tax'), L('Bawa STNK & KTP', 'Bring vehicle registration & ID'), 'Ya', '', 'merah', SAYA, kini],
      [idTrx(), serial(geser(hariIni, 12)), L('Ulang tahun Kakak', "Kakak's birthday"), L('Pesan kue di toko langganan', 'Order a cake'), 'Ya', 'Tahunan', 'ungu', DIA, kini],
      [idTrx(), '', L('Ide kado & rencana belanja', 'Gift ideas & shopping plans'),
        L('[ ] Sepatu sekolah Kakak\n[ ] Rak buku\n[x] Blender', '[ ] School shoes\n[ ] Bookshelf\n[x] Blender'), '', '', 'kuning', SAYA, kini, 'Ya', '', kini],
      // Papan catatan (tanpa tanggal): disematkan, biasa, dan satu yang diarsipkan.
      [idTrx(), '', L('Password Wi-Fi rumah', 'Home Wi-Fi password'), L('Nama: RumahKita_5G\nSandi: tanya Ibu 😄', 'Name: OurHome_5G\nPassword: ask Mom 😄'),
        '', '', 'biru', DIA, kini, 'Ya', '', kini],
      [idTrx(), '', L('Resep sambal Ibu', "Mom's chili sauce"), L('Cabai rawit 15, bawang merah 5, tomat 1, terasi bakar sedikit, garam & gula secukupnya. Ulek kasar, siram minyak panas.',
        'Bird’s eye chili 15, shallots 5, tomato 1, a little toasted shrimp paste, salt & sugar to taste. Grind coarsely, pour hot oil over it.'), '', '', 'merah', DIA, kini, '', '', kini],
      [idTrx(), '', L('Rencana liburan akhir tahun', 'Year-end holiday plan'),
        L('[x] Pilih tujuan: Yogyakarta\n[ ] Pesan tiket kereta\n[ ] Cari penginapan dekat Malioboro\n[ ] Sisihkan Rp500rb/bulan', '[x] Pick a destination: Yogyakarta\n[ ] Book train tickets\n[ ] Find a stay near Malioboro\n[ ] Set aside Rp500k/month'),
        '', '', 'hijau', SAYA, kini, '', '', kini],
      [idTrx(), '', L('Ukuran baju anak', "Kids' clothing sizes"), L('Kakak: M (atasan), 30 (celana)\nAdik: S, sepatu 28', 'Kakak: M (tops), 30 (pants)\nAdik: S, shoes 28'),
        '', '', 'ungu', SAYA, kini, '', '', kini],
      [idTrx(), '', L('Nomor penting', 'Important numbers'), L('Tukang listrik Pak Joko · 0812-xxxx-1234\nBengkel langganan · 0813-xxxx-5678', 'Electrician Mr. Joko · 0812-xxxx-1234\nGarage · 0813-xxxx-5678'),
        '', '', 'polos', DIA, kini, '', '', kini],
      [idTrx(), '', L('Daftar belanja bulan lalu', "Last month's shopping list"), L('[x] Gas elpiji\n[x] Galon\n[x] Popok', '[x] LPG gas\n[x] Water gallon\n[x] Diapers'),
        '', '', 'kuning', DIA, kini, '', 'Ya', kini],
    ];

    const diubah = trx.filter(r => r[2] === KELUAR && r[4] === 'Belanja Harian' && r[1] < serial(hariIni)).pop();
    const log = diubah ? [[serial(geser(hariIni, -1), 20.2), DIA, 'ubah',
      'Belanja Harian Rp' + new Intl.NumberFormat('id-ID').format(diubah[3]) + ': ' + L('catatan diubah', 'note changed'), diubah[0]]] : [];

    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const pengaturan = [
      ['EMAS', JSON.stringify({ [EMAS]: {
        gram: 6, platform: 'antam', modal: 13390000, hargaBeli: 2470000, hargaJual: 2430000,
        riwayat: [{ id: beliEmas[0], tgl: iso(geser(hariIni, -40)), gram: 1, rp: 2390000, dompet: 'BCA' }],
      } })],
      ['TANTANGAN', JSON.stringify({
        aktif: [
          { id: 'coba-t1', jenis: '52', mulai: iso(geser(hariIni, -20)), oleh: SAYA, unit: 50000, pola: 'tetap', tabungan: LIBURAN, sumber: 'BCA' },
          { id: 'coba-t2', jenis: 'batas', mulai: iso(geser(hariIni, -9)), oleh: DIA, kategori: 'Makan & Minum', batas: 800000, minggu: 4 },
          { id: 'coba-t3', jenis: 'bebas', mulai: iso(geser(hariIni, -10)), oleh: SAYA, nama: L('Olahraga', 'Exercise'), ikon: '🏃', per: 3, hari: 30,
            cek: [-10, -8, -5, -3].map(n => iso(geser(hariIni, n))) },
        ],
        selesai: [
          { id: 'coba-t0', jenis: 'hemat', judul: L('5 hari tanpa belanja', '5 no-spend days'), mulai: iso(geser(hariIni, -75)), selesai: iso(geser(hariIni, -46)), hasil: 'berhasil', cfg: { target: 5, hari: 30 } },
        ],
        hariKosong: [],
      })],
      ['AVATAR:' + DIA, JSON.stringify({ p: 'pria' })],
    ];

    const idDb = 'coba-' + acakId(28);
    const lembar = (title, sheetId, rows) => ({ sheetId, title, rows: [KOLOM[title]].concat(rows), lindung: 'Dompet Keluarga: dikelola aplikasi' });
    const s = {
      versi: VERSI_CONTOH,
      email: SAYA,
      ss: {
        [idDb]: {
          sheets: [
            lembar('Transaksi', 0, trx),
            lembar('Kategori', 1, KATEGORI),
            lembar('Dompet', 2, DOMPET),
            lembar('Pengaturan', 3, pengaturan),
            lembar('Rutin', 4, rutin),
            lembar('Catatan', 5, catatan),
            lembar('Log', 6, log),
          ],
        },
      },
      files: {
        [idDb]: { name: 'Dompet Keluarga', mimeType: MIME_SHEET, parents: [] },
        'coba-config': { name: 'config.json', appData: true, isi: JSON.stringify({ spreadsheetId: idDb, buku: [{ id: idDb, nama: 'Keluarga' }] }) },
      },
      izin: {
        [idDb]: [
          { id: 'izin-saya', type: 'user', role: 'owner', emailAddress: SAYA, displayName: namaDari(SAYA) },
          { id: 'izin-pasangan', type: 'user', role: 'writer', emailAddress: DIA, displayName: namaDari(DIA) },
        ],
      },
    };
    return s;
  }

  // ---------- Pasang / lepas ----------

  function pasang() {
    if (!asli) {
      asli = {};
      ['masuk', 'keluar', 'sudahMasuk', 'segarkanKalauPerlu', 'email', 'api', 'multipart', 'pilihSpreadsheet'].forEach(k => { asli[k] = GOOGLE[k]; });
    }
    Object.assign(GOOGLE, {
      sudahMasuk: () => true,
      email: () => st.email,
      api,
      multipart,
      segarkanKalauPerlu: () => undefined,
      masuk: async () => st.email,
      keluar: () => selesai(),
      pilihSpreadsheet: async () => { throw new Error(T('Fitur ini memakai akun Google Anda, jadi baru bisa dipakai setelah masuk. Data contoh di mode coba tidak ikut dipindahkan.')); },
    });
  }

  /** Mulai mode coba dengan data contoh yang baru. */
  function mulai() {
    st = buatContoh();
    nyala = true;
    try { localStorage.setItem(KUNCI, '1'); } catch (e) { /* mode privat: hanya selama halaman terbuka */ }
    simpan();
    pasang();
  }

  /** Akhiri mode coba: data contoh & salinannya di HP dihapus, login Google yang asli dipasang lagi. */
  function selesai() {
    const email = st && st.email;
    nyala = false;
    st = null;
    isiFoto.clear();
    try {
      localStorage.removeItem(KUNCI);
      localStorage.removeItem(KUNCI_DB);
      if (email) Object.keys(localStorage).filter(k => k.includes(email)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* abaikan */ }
    if (asli) Object.assign(GOOGLE, asli);
  }

  if (nyala) {
    const lama = bacaSimpanan();
    st = lama && lama.versi === VERSI_CONTOH ? lama : buatContoh();
    if (st !== lama) simpan();
    pasang();
  }

  return { aktif: () => nyala, mulai, selesai };
})();
