/**
 * Lapisan data: spreadsheet Google milik keluarga, diakses lewat Sheets API dari browser.
 * Pengganti Code.gs versi Apps Script; nama fungsinya sama supaya tampilan (app.js) tidak banyak berubah.
 *
 * Alamat spreadsheet tiap akun disimpan di Drive "appDataFolder" (tersembunyi, khusus aplikasi ini),
 * jadi tetap ketemu walaupun pindah HP. Kunci API Gemini disimpan di sheet "Pengaturan".
 */
const TIPE = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', TRANSFER: 'Transfer' };

const SERVER = (() => {
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  const TABEL = {
    transaksi: {
      nama: 'Transaksi',
      kolom: ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Dibuat Oleh', 'Dibuat Pada', 'Diubah Pada'],
    },
    kategori: { nama: 'Kategori', kolom: ['Nama', 'Tipe', 'Ikon'] },
    dompet: { nama: 'Dompet', kolom: ['Nama', 'Ikon', 'Saldo Awal'] },
    pengaturan: { nama: 'Pengaturan', kolom: ['Kunci', 'Nilai'] },
  };

  const KATEGORI_AWAL = [
    ['Makan & Minum', TIPE.KELUAR, '🍜'],
    ['Belanja Harian', TIPE.KELUAR, '🛒'],
    ['Transportasi', TIPE.KELUAR, '⛽'],
    ['Tagihan & Utilitas', TIPE.KELUAR, '💡'],
    ['Rumah Tangga', TIPE.KELUAR, '🏠'],
    ['Kesehatan', TIPE.KELUAR, '💊'],
    ['Pendidikan', TIPE.KELUAR, '📚'],
    ['Anak', TIPE.KELUAR, '👶'],
    ['Hiburan', TIPE.KELUAR, '🎬'],
    ['Pakaian', TIPE.KELUAR, '👕'],
    ['Sosial & Donasi', TIPE.KELUAR, '🤲'],
    ['Lainnya', TIPE.KELUAR, '📦'],
    ['Gaji', TIPE.MASUK, '💼'],
    ['Bonus', TIPE.MASUK, '🎁'],
    ['Usaha', TIPE.MASUK, '🏪'],
    ['Investasi', TIPE.MASUK, '📈'],
    ['Lainnya', TIPE.MASUK, '💰'],
  ];

  const DOMPET_AWAL = [
    ['Tunai', '💵', 0],
    ['Rekening Bank', '🏦', 0],
    ['E-Wallet', '📱', 0],
  ];

  const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  let dbId = null;      // ID spreadsheet yang sedang dipakai
  let idSheet = null;   // { "Transaksi": sheetId, ... } untuk hapus baris

  // ---------- Lokasi spreadsheet milik akun ini ----------

  const kunciLokal = () => 'dk_db_' + GOOGLE.email();

  async function cariIdDb_() {
    if (dbId) return dbId;
    let id = null;
    try { id = localStorage.getItem(kunciLokal()); } catch (e) { /* abaikan */ }
    if (!id) {
      const c = await bacaConfig_();
      id = c && c.spreadsheetId;
      if (id) simpanLokal_(id);
    }
    dbId = id || null;
    return dbId;
  }

  function simpanLokal_(id) {
    try {
      if (id) localStorage.setItem(kunciLokal(), id);
      else localStorage.removeItem(kunciLokal());
    } catch (e) { /* abaikan */ }
  }

  async function fileConfig_() {
    const q = encodeURIComponent("name='config.json'");
    const r = await GOOGLE.api(DRIVE + '/files?spaces=appDataFolder&fields=files(id)&q=' + q);
    return r.files.length ? r.files[0].id : null;
  }

  async function bacaConfig_() {
    const id = await fileConfig_();
    return id ? GOOGLE.api(DRIVE + '/files/' + id + '?alt=media') : null;
  }

  async function tulisConfig_(isi) {
    const id = await fileConfig_();
    if (id) return GOOGLE.api(UPLOAD + '/files/' + id + '?uploadType=media', { method: 'PATCH', json: isi });
    const blob = new Blob([JSON.stringify(isi)], { type: 'application/json' });
    return GOOGLE.api(UPLOAD + '/files?uploadType=multipart', Object.assign(
      { method: 'POST' }, GOOGLE.multipart({ name: 'config.json', parents: ['appDataFolder'] }, blob),
    ));
  }

  /** Memeriksa spreadsheet bisa dibuka & strukturnya benar, lalu menyimpannya sebagai milik akun ini. */
  async function pakaiDb_(id) {
    idSheet = await bacaIdSheet_(id);
    ['transaksi', 'kategori', 'dompet'].forEach(k => {
      if (!(TABEL[k].nama in idSheet)) {
        throw new Error('Spreadsheet ini bukan database Dompet Keluarga (sheet "' + TABEL[k].nama + '" tidak ada).');
      }
    });
    await pastikanPengaturan_(id);
    dbId = id;
    simpanLokal_(id);
    await tulisConfig_({ spreadsheetId: id });
  }

  async function bacaIdSheet_(id) {
    try {
      const r = await GOOGLE.api(SHEETS + '/' + id + '?fields=sheets.properties(sheetId,title)');
      const peta = {};
      r.sheets.forEach(s => { peta[s.properties.title] = s.properties.sheetId; });
      return peta;
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        const err = new Error('Akun ' + GOOGLE.email() + ' belum punya akses ke spreadsheet Dompet Keluarga. Minta pemilik mengundang akun ini dari menu Lainnya → Undang anggota keluarga.');
        err.tanpaAkses = true;
        throw err;
      }
      throw e;
    }
  }

  /** Spreadsheet dari versi Apps Script belum punya sheet Pengaturan. */
  async function pastikanPengaturan_(id) {
    const t = TABEL.pengaturan;
    if (t.nama in idSheet) return;
    const r = await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: { requests: [{ addSheet: { properties: { title: t.nama, gridProperties: { frozenRowCount: 1 } } } }] },
    });
    idSheet[t.nama] = r.replies[0].addSheet.properties.sheetId;
    await tulis_(id, "'" + t.nama + "'!A1", [t.kolom]);
  }

  async function db_() {
    const id = await cariIdDb_();
    if (!id) throw new Error('Spreadsheet belum dipilih. Muat ulang aplikasi.');
    if (!idSheet) {
      idSheet = await bacaIdSheet_(id);
      await pastikanPengaturan_(id);
    }
    return id;
  }

  const urlDb_ = id => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  const linkUndangan_ = id => location.origin + location.pathname + '#gabung=' + id;

  // ---------- Setup ----------

  /** Membuat spreadsheet database baru di Drive akun yang sedang login. */
  async function buatDatabase(emailPasangan) {
    const pasangan = teks_(emailPasangan);
    if (pasangan && !POLA_EMAIL.test(pasangan)) throw new Error('Format email pasangan tidak valid.');

    const urutan = [TABEL.transaksi, TABEL.kategori, TABEL.dompet, TABEL.pengaturan];
    const ss = await GOOGLE.api(SHEETS, {
      method: 'POST',
      json: {
        properties: { title: 'Dompet Keluarga', timeZone: 'Asia/Jakarta' },
        sheets: urutan.map((t, i) => ({ properties: { sheetId: i, title: t.nama, gridProperties: { frozenRowCount: 1 } } })),
      },
    });
    const id = ss.spreadsheetId;

    await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', {
      method: 'POST',
      json: {
        valueInputOption: 'RAW',
        data: [
          { range: "'" + TABEL.transaksi.nama + "'!A1", values: [TABEL.transaksi.kolom] },
          { range: "'" + TABEL.kategori.nama + "'!A1", values: [TABEL.kategori.kolom].concat(KATEGORI_AWAL) },
          { range: "'" + TABEL.dompet.nama + "'!A1", values: [TABEL.dompet.kolom].concat(DOMPET_AWAL) },
          { range: "'" + TABEL.pengaturan.nama + "'!A1", values: [TABEL.pengaturan.kolom] },
        ],
      },
    });

    const format = (sheetId, kolomAwal, kolomAkhir, type, pattern) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: kolomAwal, endColumnIndex: kolomAkhir },
        cell: { userEnteredFormat: { numberFormat: { type, pattern } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
    await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: {
        requests: urutan.map((t, i) => ({
          repeatCell: {
            range: { sheetId: i, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        })).concat([
          format(0, 1, 2, 'DATE', 'yyyy-mm-dd'),
          format(0, 3, 4, 'NUMBER', '#,##0'),
          format(0, 9, 11, 'DATE_TIME', 'yyyy-mm-dd hh:mm'),
          format(2, 2, 3, 'NUMBER', '#,##0'),
        ]),
      },
    });

    await pakaiDb_(id);
    if (pasangan) await bagikan_(id, pasangan);
    return urlDb_(id);
  }

  /** Memakai spreadsheet yang sudah ada (diundang pasangan, atau dari versi Apps Script). Menerima link atau ID. */
  async function hubungkanDatabase(linkAtauId) {
    const s = teks_(linkAtauId);
    const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
    if (!m) throw new Error('Link spreadsheet tidak dikenali. Salin link dari address bar saat spreadsheet terbuka.');
    await pakaiDb_(m[1]);
    return true;
  }

  /** Berhenti memakai spreadsheet ini di akun ini (spreadsheet-nya sendiri tidak dihapus). */
  async function lupakanDatabase() {
    dbId = null;
    idSheet = null;
    simpanLokal_(null);
    await tulisConfig_({});
    return true;
  }

  /** Memberi akses Editor ke anggota keluarga, lalu Google mengirim email berisi link undangan. */
  async function bagikanKe(email) {
    email = teks_(email);
    if (!POLA_EMAIL.test(email)) throw new Error('Format email tidak valid.');
    await bagikan_(await db_(), email);
    return true;
  }

  async function bagikan_(id, email) {
    const pesan = 'Ayo catat keuangan keluarga bareng di Dompet Keluarga. Buka link ini dan masuk dengan akun Google ini: ' + linkUndangan_(id);
    try {
      await GOOGLE.api(DRIVE + '/files/' + id + '/permissions?sendNotificationEmail=true&emailMessage=' + encodeURIComponent(pesan), {
        method: 'POST',
        json: { type: 'user', role: 'writer', emailAddress: email },
      });
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        throw new Error('Spreadsheet ini dibuat di luar aplikasi, jadi harus dibagikan manual: buka spreadsheet → Bagikan → isi email → Editor. Lalu kirim link undangan dari menu ini.');
      }
      throw e;
    }
  }

  // ---------- Data ----------

  async function getData(bulan) {
    if (!(await cariIdDb_())) return { perluSetup: true, user: GOOGLE.email() };
    const id = await db_();
    const [trx, kat, dom, set] = await bacaTabel_(id, ['transaksi', 'kategori', 'dompet', 'pengaturan']);
    const d = olahData_(trx, kat, dom);
    if (!/^\d{4}-\d{2}$/.test(bulan || '')) bulan = tanggalLokal_().slice(0, 7);

    const saldo = {};
    d.dompet.forEach(w => { saldo[w.nama] = w.saldoAwal; });
    d.transaksi.forEach(t => {
      if (t.tipe === TIPE.MASUK) tambah_(saldo, t.dompet, t.jumlah);
      else if (t.tipe === TIPE.KELUAR) tambah_(saldo, t.dompet, -t.jumlah);
      else if (t.tipe === TIPE.TRANSFER) {
        tambah_(saldo, t.dompet, -t.jumlah);
        tambah_(saldo, t.dompetTujuan, t.jumlah);
      }
    });

    return {
      user: GOOGLE.email(),
      urlSpreadsheet: urlDb_(id),
      linkUndangan: linkUndangan_(id),
      kunciGemini: kunciGemini_(set).map(samarkanKunci_),
      bulan,
      kategori: d.kategori,
      dompet: d.dompet.map(w => ({ nama: w.nama, ikon: w.ikon, saldoAwal: w.saldoAwal, saldo: saldo[w.nama] || 0 })),
      transaksi: d.transaksi
        .filter(t => t.tanggal.slice(0, 7) === bulan)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat)),
    };
  }

  async function simpanTransaksi(input) {
    const t = validasiTransaksi_(input);
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['transaksi']);
    const sekarang = serialSekarang_();
    if (t.id) {
      const i = cariBaris_(rows, r => String(r[0]) === t.id);
      const lama = rows[i];
      await tulis_(id, rangeBaris_(TABEL.transaksi, i), [[
        t.id, t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, lama[8], lama[9], sekarang,
      ]]);
    } else {
      t.id = crypto.randomUUID();
      await tambahBaris_(id, TABEL.transaksi, [[
        t.id, t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, GOOGLE.email(), sekarang, sekarang,
      ]]);
    }
    return t.id;
  }

  async function hapusTransaksi(idTrx) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['transaksi']);
    await hapusBaris_(id, TABEL.transaksi, cariBaris_(rows, r => String(r[0]) === String(idTrx)));
    return true;
  }

  /** input: { namaLama?, tipeLama?, nama, tipe, ikon } */
  async function simpanKategori(input) {
    const nama = teks_(input.nama);
    const tipe = String(input.tipe);
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    if (tipe !== TIPE.MASUK && tipe !== TIPE.KELUAR) throw new Error('Tipe kategori tidak valid.');
    const ikon = teks_(input.ikon) || '🏷️';
    const namaLama = teks_(input.namaLama);
    const tipeLama = String(input.tipeLama || tipe);

    const id = await db_();
    const [kat, trx] = await bacaTabel_(id, ['kategori', 'transaksi']);
    const sama = (n, tp) => r => String(r[0]) === n && String(r[1]) === tp;
    const bentrok = kat.findIndex(sama(nama, tipe));

    if (namaLama) {
      const i = cariBaris_(kat, sama(namaLama, tipeLama));
      if (bentrok >= 0 && bentrok !== i) throw new Error('Kategori "' + nama + '" sudah ada.');
      await tulis_(id, rangeBaris_(TABEL.kategori, i), [[nama, tipe, ikon]]);
      if (namaLama !== nama || tipeLama !== tipe) {
        await gantiDiTransaksi_(id, trx, r => {
          if (String(r[4]) === namaLama && String(r[2]) === tipeLama) { r[4] = nama; r[2] = tipe; return true; }
          return false;
        });
      }
    } else {
      if (bentrok >= 0) throw new Error('Kategori "' + nama + '" sudah ada.');
      await tambahBaris_(id, TABEL.kategori, [[nama, tipe, ikon]]);
    }
    return true;
  }

  async function hapusKategori(nama, tipe) {
    const id = await db_();
    const [kat, trx] = await bacaTabel_(id, ['kategori', 'transaksi']);
    const dipakai = trx.filter(r => String(r[4]) === nama && String(r[2]) === tipe).length;
    if (dipakai) throw new Error('Kategori ini dipakai di ' + dipakai + ' transaksi. Ubah dulu kategori transaksinya, atau ganti nama kategorinya saja.');
    await hapusBaris_(id, TABEL.kategori, cariBaris_(kat, r => String(r[0]) === nama && String(r[1]) === tipe));
    return true;
  }

  /** input: { namaLama?, nama, ikon, saldoAwal } */
  async function simpanDompet(input) {
    const nama = teks_(input.nama);
    if (!nama) throw new Error('Nama dompet wajib diisi.');
    const ikon = teks_(input.ikon) || '👛';
    const saldoAwal = Math.round(Number(input.saldoAwal) || 0);
    const namaLama = teks_(input.namaLama);

    const id = await db_();
    const [dom, trx] = await bacaTabel_(id, ['dompet', 'transaksi']);
    const bentrok = dom.findIndex(r => String(r[0]) === nama);

    if (namaLama) {
      const i = cariBaris_(dom, r => String(r[0]) === namaLama);
      if (bentrok >= 0 && bentrok !== i) throw new Error('Dompet "' + nama + '" sudah ada.');
      await tulis_(id, rangeBaris_(TABEL.dompet, i), [[nama, ikon, saldoAwal]]);
      if (namaLama !== nama) {
        await gantiDiTransaksi_(id, trx, r => {
          let ubah = false;
          if (String(r[5]) === namaLama) { r[5] = nama; ubah = true; }
          if (String(r[6]) === namaLama) { r[6] = nama; ubah = true; }
          return ubah;
        });
      }
    } else {
      if (bentrok >= 0) throw new Error('Dompet "' + nama + '" sudah ada.');
      await tambahBaris_(id, TABEL.dompet, [[nama, ikon, saldoAwal]]);
    }
    return true;
  }

  async function hapusDompet(nama) {
    const id = await db_();
    const [dom, trx] = await bacaTabel_(id, ['dompet', 'transaksi']);
    const dipakai = trx.filter(r => String(r[5]) === nama || String(r[6]) === nama).length;
    if (dipakai) throw new Error('Dompet ini dipakai di ' + dipakai + ' transaksi, jadi tidak bisa dihapus.');
    await hapusBaris_(id, TABEL.dompet, cariBaris_(dom, r => String(r[0]) === nama));
    return true;
  }

  // ---------- Kunci API Gemini (sheet Pengaturan) ----------

  async function tambahKunciGemini(kunci) {
    kunci = teks_(kunci);
    if (!/^[\w-]{20,}$/.test(kunci)) throw new Error('Format kunci API tidak valid.');
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const daftar = kunciGemini_(set);
    if (daftar.includes(kunci)) throw new Error('Kunci API ini sudah ada.');
    daftar.push(kunci);
    await simpanPengaturan_(id, set, 'GEMINI_API_KEYS', JSON.stringify(daftar));
    return true;
  }

  /** `samaran` adalah tampilan tersamar dari daftar (mis. "AIzaSy…x9Qk"). */
  async function hapusKunciGemini(samaran) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const daftar = kunciGemini_(set);
    const i = daftar.map(samarkanKunci_).indexOf(samaran);
    if (i < 0) throw new Error('Kunci API tidak ditemukan. Coba muat ulang.');
    daftar.splice(i, 1);
    await simpanPengaturan_(id, set, 'GEMINI_API_KEYS', JSON.stringify(daftar));
    return true;
  }

  function pengaturan_(rows) {
    const p = {};
    rows.forEach(r => { if (r[0] !== '') p[String(r[0])] = String(r[1]); });
    return p;
  }

  function kunciGemini_(rows) {
    try { return JSON.parse(pengaturan_(rows).GEMINI_API_KEYS || '[]'); } catch (e) { return []; }
  }

  async function simpanPengaturan_(id, rows, kunci, nilai) {
    const i = rows.findIndex(r => String(r[0]) === kunci);
    if (i >= 0) await tulis_(id, rangeBaris_(TABEL.pengaturan, i), [[kunci, nilai]]);
    else await tambahBaris_(id, TABEL.pengaturan, [[kunci, nilai]]);
  }

  function samarkanKunci_(k) {
    return k.slice(0, 6) + '…' + k.slice(-4);
  }

  // ---------- Baca struk ----------

  async function bacaStruk(base64, mime) {
    const id = await db_();
    const [kat, set] = await bacaTabel_(id, ['kategori', 'pengaturan']);
    return STRUK.baca(base64, mime, {
      kategori: kat.filter(r => r[0] !== '' && String(r[1]) === TIPE.KELUAR).map(r => String(r[0])),
      kunci: kunciGemini_(set),
      model: pengaturan_(set).GEMINI_MODEL,
    });
  }

  // ---------- Helper Sheets ----------

  const hurufKolom_ = n => String.fromCharCode(64 + n);
  const rangeTabel_ = t => "'" + t.nama + "'!A2:" + hurufKolom_(t.kolom.length);
  /** Baris data ke-i (0 = tepat di bawah header). */
  const rangeBaris_ = (t, i) => "'" + t.nama + "'!A" + (i + 2) + ':' + hurufKolom_(t.kolom.length) + (i + 2);

  /** Membaca beberapa tabel sekaligus. Tanggal dikembalikan sebagai angka serial Sheets. */
  async function bacaTabel_(id, nama) {
    const q = nama.map(k => 'ranges=' + encodeURIComponent(rangeTabel_(TABEL[k]))).join('&');
    const r = await GOOGLE.api(SHEETS + '/' + id + '/values:batchGet?' + q + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
    return r.valueRanges.map((vr, i) => {
      const n = TABEL[nama[i]].kolom.length;
      return (vr.values || []).map(row => {
        const isi = row.slice(0, n);
        while (isi.length < n) isi.push('');
        return isi;
      });
    });
  }

  // RAW: teks disimpan apa adanya, jadi "=..." tidak pernah dianggap rumus oleh Sheets.
  function tulis_(id, range, values) {
    return GOOGLE.api(SHEETS + '/' + id + '/values/' + encodeURIComponent(range) + '?valueInputOption=RAW', {
      method: 'PUT', json: { values },
    });
  }

  function tambahBaris_(id, tabel, values) {
    const range = encodeURIComponent("'" + tabel.nama + "'!A1");
    return GOOGLE.api(SHEETS + '/' + id + '/values/' + range + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST', json: { values },
    });
  }

  function hapusBaris_(id, tabel, i) {
    return GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: { requests: [{ deleteDimension: { range: { sheetId: idSheet[tabel.nama], dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } }] },
    });
  }

  async function gantiDiTransaksi_(id, rows, ubahBaris) {
    let ada = false;
    rows.forEach(r => { if (ubahBaris(r)) ada = true; });
    if (!ada) return;
    const t = TABEL.transaksi;
    await tulis_(id, "'" + t.nama + "'!A2:" + hurufKolom_(t.kolom.length) + (rows.length + 1), rows);
  }

  function olahData_(trx, kat, dom) {
    return {
      transaksi: trx.filter(r => r[0] !== '').map(r => ({
        id: String(r[0]),
        tanggal: dariSerial_(r[1]).slice(0, 10),
        tipe: String(r[2]),
        jumlah: Number(r[3]) || 0,
        kategori: String(r[4]),
        dompet: String(r[5]),
        dompetTujuan: String(r[6]),
        catatan: String(r[7]),
        oleh: String(r[8]),
        dibuat: dariSerial_(r[9]),
      })),
      kategori: kat.filter(r => r[0] !== '').map(r => ({ nama: String(r[0]), tipe: String(r[1]), ikon: String(r[2]) })),
      dompet: dom.filter(r => r[0] !== '').map(r => ({ nama: String(r[0]), ikon: String(r[1]), saldoAwal: Number(r[2]) || 0 })),
    };
  }

  // ---------- Tanggal (angka serial Sheets: jumlah hari sejak 30 Des 1899) ----------

  const EPOCH = Date.UTC(1899, 11, 30);

  function keSerial_(y, m, d, jam = 0, menit = 0, detik = 0) {
    return (Date.UTC(y, m - 1, d, jam, menit, detik) - EPOCH) / 864e5;
  }

  /** Serial → "yyyy-MM-ddTHH:mm:ss". Teks (data lama yang bukan tanggal) dikembalikan apa adanya. */
  function dariSerial_(v) {
    if (typeof v !== 'number') return String(v);
    return new Date(EPOCH + Math.round(v * 864e5)).toISOString().slice(0, 19);
  }

  function serialSekarang_() {
    const n = new Date();
    return keSerial_(n.getFullYear(), n.getMonth() + 1, n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds());
  }

  function tanggalLokal_() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- Helper umum ----------

  function validasiTransaksi_(x) {
    x = x || {};
    const tipe = String(x.tipe);
    if (![TIPE.MASUK, TIPE.KELUAR, TIPE.TRANSFER].includes(tipe)) throw new Error('Tipe transaksi tidak valid.');
    const jumlah = Math.round(Number(x.jumlah));
    if (!(jumlah > 0)) throw new Error('Jumlah harus lebih dari 0.');
    const m = String(x.tanggal || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error('Tanggal tidak valid.');
    const dompet = teks_(x.dompet);
    if (!dompet) throw new Error('Pilih dompet.');
    const dompetTujuan = tipe === TIPE.TRANSFER ? teks_(x.dompetTujuan) : '';
    if (tipe === TIPE.TRANSFER && (!dompetTujuan || dompetTujuan === dompet)) throw new Error('Pilih dompet tujuan yang berbeda.');
    const kategori = tipe === TIPE.TRANSFER ? '' : teks_(x.kategori);
    if (tipe !== TIPE.TRANSFER && !kategori) throw new Error('Pilih kategori.');

    return {
      id: teks_(x.id),
      tanggal: keSerial_(Number(m[1]), Number(m[2]), Number(m[3])),
      tipe,
      jumlah,
      kategori,
      dompet,
      dompetTujuan,
      catatan: teks_(x.catatan).slice(0, 500),
    };
  }

  function cariBaris_(rows, cocok) {
    const i = rows.findIndex(cocok);
    if (i < 0) throw new Error('Data tidak ditemukan. Mungkin sudah diubah atau dihapus orang lain — coba muat ulang.');
    return i;
  }

  function teks_(v) {
    return String(v == null ? '' : v).trim();
  }

  function tambah_(obj, kunci, n) {
    if (kunci) obj[kunci] = (obj[kunci] || 0) + n;
  }

  return {
    getData, buatDatabase, hubungkanDatabase, lupakanDatabase, bagikanKe,
    simpanTransaksi, hapusTransaksi, simpanKategori, hapusKategori, simpanDompet, hapusDompet,
    tambahKunciGemini, hapusKunciGemini, bacaStruk,
    uji: { keSerial_, dariSerial_, validasiTransaksi_, olahData_ },
  };
})();
