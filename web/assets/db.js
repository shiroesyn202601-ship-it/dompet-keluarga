/**
 * Lapisan data: spreadsheet Google milik keluarga, diakses lewat Sheets API dari browser.
 * Pengganti Code.gs versi Apps Script; nama fungsinya sama supaya tampilan (app.js) tidak banyak berubah.
 *
 * Alamat spreadsheet tiap akun disimpan di Drive "appDataFolder" (tersembunyi, khusus aplikasi ini),
 * jadi tetap ketemu walaupun pindah HP. Kunci API Gemini disimpan di sheet "Pengaturan".
 */
const TIPE = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', TRANSFER: 'Transfer' };
/**
 * Tabungan adalah dompet khusus: diisi/ditarik lewat transaksi Transfer, punya target opsional.
 * Utang juga dompet khusus, satu per orang: saldo positif = orang itu berutang ke kita (piutang),
 * negatif = kita berutang ke dia. Pinjam-meminjam & pelunasan dicatat sebagai Transfer, jadi tidak
 * dihitung sebagai pemasukan/pengeluaran. Kolom Tenggat dipakai sebagai jatuh tempo.
 * Aset (emas, reksadana, properti…) juga dompet khusus: nilainya diperbarui manual ("Nilai sekarang"),
 * dan pembelian dari rekening bisa dicatat sebagai Transfer ke aset itu. Dipakai untuk kekayaan bersih.
 */
const JENIS = { DOMPET: 'Dompet', TABUNGAN: 'Tabungan', UTANG: 'Utang', ASET: 'Aset' };
const JENIS_KHUSUS = [JENIS.TABUNGAN, JENIS.UTANG, JENIS.ASET];

const SERVER = (() => {
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  const TABEL = {
    transaksi: {
      nama: 'Transaksi',
      // Lampiran = ID file foto struk di Google Drive (folder "Dompet Keluarga - Struk" milik pencatat).
      kolom: ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Dibuat Oleh', 'Dibuat Pada', 'Diubah Pada', 'Lampiran'],
    },
    // Bawa Sisa = 'Ya': anggaran "amplop", sisa/kelebihan periode lalu ikut dihitung (lihat batasAnggaran di app.js).
    kategori: { nama: 'Kategori', kolom: ['Nama', 'Tipe', 'Ikon', 'Anggaran', 'Bawa Sisa'] },
    dompet: { nama: 'Dompet', kolom: ['Nama', 'Ikon', 'Saldo Awal', 'Jenis', 'Target', 'Tenggat'] },
    pengaturan: { nama: 'Pengaturan', kolom: ['Kunci', 'Nilai'] },
    // Tagihan & transaksi rutin. Mulai = tanggal patokan (hari ke-berapa), Berikutnya = jatuh tempo berikutnya.
    rutin: {
      nama: 'Rutin',
      kolom: ['ID', 'Nama', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Ulang', 'Mulai', 'Berikutnya'],
    },
    // Catatan & pengingat (kalender). Pengingat = 'Ya' → muncul sebagai overlay saat aplikasi dibuka di tanggalnya.
    // Ulang: '' | Mingguan | Bulanan | Tahunan. Warna: kunci warna di kalender (lihat WARNA_CATATAN di app-catatan.js).
    // Sematkan / Arsip ('Ya' / '') khusus catatan tanpa tanggal (Papan catatan); Diubah Pada = urutan di Papan.
    catatan: {
      nama: 'Catatan',
      kolom: ['ID', 'Tanggal', 'Judul', 'Isi', 'Pengingat', 'Ulang', 'Warna', 'Dibuat Oleh', 'Dibuat Pada', 'Sematkan', 'Arsip', 'Diubah Pada'],
    },
    // Riwayat perubahan oleh anggota: ubah / hapus / kembalikan transaksi (pencatatan baru sudah tercatat di Dibuat Oleh).
    log: { nama: 'Log', kolom: ['Waktu', 'Oleh', 'Aksi', 'Ringkasan', 'ID Transaksi'] },
    // Riwayat harga barang dari struk (aplikasi & bot Telegram). Harga = per satuan; Jumlah = banyaknya (atau kg).
    // Baris yang transaksinya sudah dihapus diabaikan saat dibaca (lihat riwayatHarga).
    harga: { nama: 'Harga', kolom: ['Tanggal', 'Toko', 'Barang', 'Harga', 'Jumlah', 'ID Transaksi', 'Dibuat Oleh'] },
  };
  const ULANG = ['Bulanan', 'Mingguan', 'Tahunan'];

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
    ['Tunai', '💵', 0, JENIS.DOMPET],
    ['Rekening Bank', '🏦', 0, JENIS.DOMPET],
    ['E-Wallet', '📱', 0, JENIS.DOMPET],
  ];

  const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  let dbId = null;      // ID spreadsheet yang sedang dipakai (= buku aktif)
  let judulDb = '';     // judul spreadsheet itu, mis. "Dompet Keluarga - Usaha"
  let idSheet = null;   // { "Transaksi": sheetId, ... } untuk hapus baris
  let terlindungi = new Set(); // nama sheet yang sudah diberi proteksi peringatan
  const PROTEKSI = 'Dompet Keluarga: dikelola aplikasi';

  // ---------- Lokasi spreadsheet milik akun ini ----------

  const kunciLokal = () => 'dk_db_' + GOOGLE.email();

  /** Ganti akun (keluar lalu masuk akun lain tanpa muat ulang) → lupakan semua yang tersimpan di memori. */
  let akun = null;
  function pastikanAkun_() {
    if (akun === GOOGLE.email()) return;
    akun = GOOGLE.email();
    dbId = null;
    idSheet = null;
    config = null;
    idFolderStruk = null;
    janjiInduk = null;
    sudahRapi = {};
  }

  async function cariIdDb_() {
    pastikanAkun_();
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

  /**
   * config.json di appDataFolder: { spreadsheetId (buku aktif), buku: [{ id, nama }], folderInduk, folderStruk }.
   * Disalin di memori (`config`); selalu mengembalikan salinan supaya aman diubah pemanggil.
   */
  let config = null;
  async function bacaConfig_() {
    pastikanAkun_();
    if (!config) {
      const id = await fileConfig_();
      config = (id && (await GOOGLE.api(DRIVE + '/files/' + id + '?alt=media'))) || {};
    }
    return JSON.parse(JSON.stringify(config));
  }

  async function tulisConfig_(isi) {
    config = JSON.parse(JSON.stringify(isi));
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
        throw new Error(T('Spreadsheet ini bukan database Dompet Keluarga (sheet "{sheet}" tidak ada).', { sheet: TABEL[k].nama }));
      }
    });
    await pastikanStruktur_(id);
    dbId = id;
    simpanLokal_(id);
    // Jadikan buku aktif & masukkan ke daftar buku (buku sebelumnya tetap ada di daftar). Folder struk dll. tetap.
    const c = await bacaConfig_();
    await tulisConfig_(Object.assign(c, { spreadsheetId: id, buku: daftarBukuDengan_(c, id) }));
  }

  async function bacaIdSheet_(id) {
    try {
      const r = await GOOGLE.api(SHEETS + '/' + id + '?fields=properties.title,sheets(properties(sheetId,title),protectedRanges(description))');
      judulDb = (r.properties && r.properties.title) || 'Dompet Keluarga';
      const peta = {};
      terlindungi = new Set();
      r.sheets.forEach(s => {
        peta[s.properties.title] = s.properties.sheetId;
        if ((s.protectedRanges || []).some(p => p.description === PROTEKSI)) terlindungi.add(s.properties.title);
      });
      return peta;
    } catch (e) {
      // Dengan scope drive.file, spreadsheet yang dibagikan orang lain baru bisa dibuka setelah dipilih lewat Google Picker.
      if (e.status === 403 || e.status === 404) {
        const err = new Error(T('Aplikasi belum diizinkan membuka spreadsheet Dompet Keluarga dengan akun {email}. Ketuk "Pilih spreadsheet", lalu pilih file Dompet Keluarga. Kalau file-nya tidak muncul, berarti akun ini belum diundang: minta pemilik mengundang dari ⚙️ → Undang anggota keluarga.',
          { email: GOOGLE.email() }));
        err.tanpaAkses = true;
        err.idDb = id;
        throw err;
      }
      throw e;
    }
  }

  /**
   * Menyusulkan struktur versi terbaru ke spreadsheet lama: sheet Pengaturan & Rutin,
   * kolom Anggaran (Kategori), serta kolom Jenis/Target/Tenggat (Dompet).
   */
  async function pastikanStruktur_(id) {
    for (const t of [TABEL.pengaturan, TABEL.rutin, TABEL.catatan, TABEL.log, TABEL.harga]) {
      if (t.nama in idSheet) continue;
      try {
        const r = await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
          method: 'POST',
          json: { requests: [{ addSheet: { properties: { title: t.nama, gridProperties: { frozenRowCount: 1 } } } }] },
        });
        idSheet[t.nama] = r.replies[0].addSheet.properties.sheetId;
        await tulis_(id, "'" + t.nama + "'!A1", [t.kolom]);
        if (t === TABEL.rutin) await formatRutin_(id, idSheet[t.nama]);
        if (t === TABEL.catatan) await formatCatatan_(id, idSheet[t.nama]);
        if (t === TABEL.harga) {
          await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', { method: 'POST', json: { requests: [
            formatKolom_(idSheet[t.nama], 0, 1, 'DATE', 'yyyy-mm-dd'), formatKolom_(idSheet[t.nama], 3, 4, 'NUMBER', '#,##0'),
          ] } });
        }
      } catch (e) {
        // Sheet tambahan yang lebih baru (Catatan, Log, Harga) tidak wajib: anggota "hanya lihat" tetap bisa membuka buku.
        if (t !== TABEL.catatan && t !== TABEL.log && t !== TABEL.harga) throw e;
        console.warn('Sheet ' + t.nama + ' tidak bisa dibuat:', e);
      }
    }

    await lindungiSheet_(id);

    const adaLog = TABEL.log.nama in idSheet;
    const adaCatatan = TABEL.catatan.nama in idSheet;
    const q = [TABEL.kategori, TABEL.dompet, TABEL.transaksi].concat(adaLog ? [TABEL.log] : [], adaCatatan ? [TABEL.catatan] : [])
      .map(x => 'ranges=' + encodeURIComponent("'" + x.nama + "'!A1:Z1")).join('&');
    const kepala = (await GOOGLE.api(SHEETS + '/' + id + '/values:batchGet?' + q)).valueRanges.map(v => (v.values || [[]])[0]);
    const [kat, dom, trx] = kepala;
    const lg = adaLog ? kepala[3] : [];
    const cat = adaCatatan ? kepala[adaLog ? 4 : 3] : [];
    const data = [];
    const format = [];
    if (adaCatatan && cat.length < TABEL.catatan.kolom.length) {
      data.push({ range: "'" + TABEL.catatan.nama + "'!A1", values: [TABEL.catatan.kolom] }); // kolom Sematkan, Arsip, Diubah Pada
      format.push(formatKolom_(idSheet[TABEL.catatan.nama], 11, 12, 'DATE_TIME', 'yyyy-mm-dd hh:mm'));
    }
    if (adaLog && lg.length < TABEL.log.kolom.length) {
      data.push({ range: "'" + TABEL.log.nama + "'!A1", values: [TABEL.log.kolom] }); // kolom ID Transaksi
    }
    if (trx.length < TABEL.transaksi.kolom.length) {
      data.push({ range: "'" + TABEL.transaksi.nama + "'!A1", values: [TABEL.transaksi.kolom] }); // kolom Lampiran
    }
    if (kat.length < TABEL.kategori.kolom.length) {
      data.push({ range: "'" + TABEL.kategori.nama + "'!A1", values: [TABEL.kategori.kolom] });
      format.push(formatKolom_(idSheet[TABEL.kategori.nama], 3, 4, 'NUMBER', '#,##0'));
    }
    if (dom.length < TABEL.dompet.kolom.length) {
      data.push({ range: "'" + TABEL.dompet.nama + "'!A1", values: [TABEL.dompet.kolom] });
      format.push(formatKolom_(idSheet[TABEL.dompet.nama], 4, 5, 'NUMBER', '#,##0'), formatKolom_(idSheet[TABEL.dompet.nama], 5, 6, 'DATE', 'yyyy-mm-dd'));
    }
    if (!data.length) return;
    await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
    if (format.length) await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', { method: 'POST', json: { requests: format } });
  }

  /**
   * Proteksi "hanya peringatan": orang yang mengedit langsung di Google Sheets mendapat peringatan dulu
   * (aplikasi membaca kolom berdasarkan posisi). Aplikasi, bot, dan API tidak terhalang.
   */
  async function lindungiSheet_(id) {
    const requests = Object.values(TABEL).filter(t => t.nama in idSheet && !terlindungi.has(t.nama)).map(t => ({
      addProtectedRange: { protectedRange: { range: { sheetId: idSheet[t.nama] }, description: PROTEKSI, warningOnly: true } },
    }));
    if (!requests.length) return;
    try {
      await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', { method: 'POST', json: { requests } });
      Object.values(TABEL).forEach(t => terlindungi.add(t.nama));
    } catch (e) {
      console.warn('Proteksi sheet dilewati:', e); // tidak wajib; jangan menghalangi pemakaian
    }
  }

  function formatCatatan_(id, sheetId) {
    return GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
          formatKolom_(sheetId, 1, 2, 'DATE', 'yyyy-mm-dd'),
          formatKolom_(sheetId, 8, 9, 'DATE_TIME', 'yyyy-mm-dd hh:mm'),
          formatKolom_(sheetId, 11, 12, 'DATE_TIME', 'yyyy-mm-dd hh:mm'),
        ],
      },
    });
  }

  function formatRutin_(id, sheetId) {
    return GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
          formatKolom_(sheetId, 3, 4, 'NUMBER', '#,##0'),
          formatKolom_(sheetId, 9, 11, 'DATE', 'yyyy-mm-dd'),
        ],
      },
    });
  }

  function formatKolom_(sheetId, kolomAwal, kolomAkhir, type, pattern) {
    return {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: kolomAwal, endColumnIndex: kolomAkhir },
        cell: { userEnteredFormat: { numberFormat: { type, pattern } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    };
  }

  async function db_() {
    const id = await cariIdDb_();
    if (!id) throw new Error(T('Spreadsheet belum dipilih. Muat ulang aplikasi.'));
    if (!idSheet) {
      idSheet = await bacaIdSheet_(id);
      await pastikanStruktur_(id);
    }
    if (!sudahRapi[id]) { sudahRapi[id] = true; rapikanFolder_(id); }
    return id;
  }

  const urlDb_ = id => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  const linkUndangan_ = id => location.origin + location.pathname + '#gabung=' + id;

  // ---------- Setup ----------

  /**
   * Membuat spreadsheet database baru di Drive akun yang sedang login.
   * dompet: [{ nama, ikon, saldoAwal }] pilihan pengguna saat setup; kosong → dompet bawaan.
   */
  async function buatDatabase(emailAnggota, dompet, namaBuku) {
    const anggota = teks_(emailAnggota);
    if (anggota && !POLA_EMAIL.test(anggota)) throw new Error(T('Format email anggota keluarga tidak valid.'));
    const barisDompet = [];
    (dompet || []).forEach(w => {
      const nama = teks_(w.nama).slice(0, 40);
      if (!nama) return;
      if (barisDompet.some(r => r[0].toLowerCase() === nama.toLowerCase())) throw new Error(T('Dompet "{nama}" dobel.', { nama }));
      barisDompet.push([nama, teks_(w.ikon) || '👛', Math.round(Number(w.saldoAwal) || 0), JENIS.DOMPET]);
    });

    const urutan = [TABEL.transaksi, TABEL.kategori, TABEL.dompet, TABEL.pengaturan];
    const ss = await GOOGLE.api(SHEETS, {
      method: 'POST',
      json: {
        properties: { title: 'Dompet Keluarga' + (teks_(namaBuku) ? ' - ' + teks_(namaBuku).slice(0, 40) : ''), timeZone: 'Asia/Jakarta' },
        sheets: urutan.map((t, i) => ({ properties: { sheetId: i, title: t.nama, gridProperties: { frozenRowCount: 1 } } })),
      },
    });
    const id = ss.spreadsheetId;
    await masukkanKeInduk_(id);

    await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', {
      method: 'POST',
      json: {
        valueInputOption: 'RAW',
        data: [
          { range: "'" + TABEL.transaksi.nama + "'!A1", values: [TABEL.transaksi.kolom] },
          { range: "'" + TABEL.kategori.nama + "'!A1", values: [TABEL.kategori.kolom].concat(KATEGORI_AWAL) },
          { range: "'" + TABEL.dompet.nama + "'!A1", values: [TABEL.dompet.kolom].concat(barisDompet.length ? barisDompet : DOMPET_AWAL) },
          { range: "'" + TABEL.pengaturan.nama + "'!A1", values: [TABEL.pengaturan.kolom] },
        ],
      },
    });

    const format = formatKolom_;
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
          format(1, 3, 4, 'NUMBER', '#,##0'),
          format(2, 2, 3, 'NUMBER', '#,##0'),
          format(2, 4, 5, 'NUMBER', '#,##0'),
          format(2, 5, 6, 'DATE', 'yyyy-mm-dd'),
        ]),
      },
    });

    await pakaiDb_(id);
    if (anggota) await bagikan_(id, anggota);
    return urlDb_(id);
  }

  /** Memakai spreadsheet yang sudah ada (diundang anggota keluarga, atau dari versi Apps Script). Menerima link atau ID. */
  async function hubungkanDatabase(linkAtauId) {
    const s = teks_(linkAtauId);
    const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
    if (!m) throw new Error(T('Link spreadsheet tidak dikenali. Salin link dari address bar saat spreadsheet terbuka.'));
    await pakaiDb_(m[1]);
    return true;
  }

  /** Berhenti memakai spreadsheet ini di akun ini (spreadsheet-nya sendiri tidak dihapus). */
  async function lupakanDatabase() {
    dbId = null;
    idSheet = null;
    simpanLokal_(null);
    await tulisConfig_(Object.assign((await bacaConfig_()) || {}, { spreadsheetId: '' }));
    return true;
  }

  /**
   * Buku yang dikelola anggotanya: idBuku kosong = buku aktif; selain itu harus ada di daftar buku akun ini,
   * supaya fungsi anggota tidak dipakai untuk file Drive lain.
   */
  async function idBuku_(idBuku) {
    if (!idBuku) return db_();
    const c = (await bacaConfig_()) || {};
    if (!(c.buku || []).some(b => b.id === idBuku)) throw new Error(T('Buku ini tidak ada di daftar buku Anda.'));
    return idBuku;
  }

  /** Memberi akses Editor ke anggota keluarga, lalu Google mengirim email berisi link undangan. idBuku kosong = buku aktif. */
  async function bagikanKe(email, idBuku) {
    email = teks_(email);
    if (!POLA_EMAIL.test(email)) throw new Error(T('Format email tidak valid.'));
    await bagikan_(await idBuku_(idBuku), email);
    return true;
  }

  async function bagikan_(id, email) {
    const dari = typeof namaPendek === 'function' && GOOGLE.email() ? '&dari=' + encodeURIComponent(namaPendek(GOOGLE.email())) : '';
    const pesan = T('Ayo catat keuangan keluarga bareng di Dompet Keluarga. Buka link ini dan masuk dengan akun Google ini: {link}', { link: linkUndangan_(id) + dari });
    try {
      await GOOGLE.api(DRIVE + '/files/' + id + '/permissions?sendNotificationEmail=true&emailMessage=' + encodeURIComponent(pesan), {
        method: 'POST',
        json: { type: 'user', role: 'writer', emailAddress: email },
      });
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        throw new Error(T('Spreadsheet ini tidak bisa dibagikan dari aplikasi (mungkin dibuat di luar aplikasi, atau Anda bukan pemiliknya). Bagikan manual: buka spreadsheet → Bagikan → isi email → Editor. Lalu kirim link undangan dari menu ini.'));
      }
      throw e;
    }
  }

  /** Akun yang punya akses ke spreadsheet buku ini: [{ id (ID izin Drive), email, nama, peran: owner|writer|reader }]. */
  async function daftarAnggota(idBuku) {
    const r = await GOOGLE.api(DRIVE + '/files/' + (await idBuku_(idBuku)) + '/permissions?fields=permissions(id,type,role,emailAddress,displayName)');
    return (r.permissions || []).filter(p => p.type === 'user')
      .map(p => ({ id: p.id, email: p.emailAddress || '', nama: p.displayName || '', peran: p.role }));
  }

  /**
   * Mencabut akses satu anggota: spreadsheet, foto struk buku ini yang diunggah akun ini, dan akun Telegram-nya
   * (bot berjalan sebagai pemilik, jadi tanpa ini anggota yang dikeluarkan masih bisa mencatat lewat bot).
   */
  async function keluarkanAnggota(idIzin, email, idBuku) {
    const id = await idBuku_(idBuku);
    email = teks_(email).toLowerCase();
    if (email && email === String(GOOGLE.email() || '').toLowerCase()) throw new Error(T('Tidak bisa mengeluarkan akun sendiri.'));
    try {
      await GOOGLE.api(DRIVE + '/files/' + id + '/permissions/' + encodeURIComponent(idIzin), { method: 'DELETE' });
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        throw new Error(T('Akses anggota ini tidak bisa dicabut dari akun Anda (biasanya hanya pemilik spreadsheet yang bisa). Minta pemiliknya, atau buka spreadsheet → Bagikan.'));
      }
      throw e;
    }
    const [trx, set] = await bacaTabel_(id, ['transaksi', 'pengaturan']);
    const pengguna = bacaJson_(pengaturan_(set).TELEGRAM_PENGGUNA, {});
    const sisa = {};
    Object.keys(pengguna).forEach(k => { if (String(pengguna[k].email || '').toLowerCase() !== email) sisa[k] = pengguna[k]; });
    if (Object.keys(sisa).length !== Object.keys(pengguna).length) {
      await simpanPengaturan_(id, set, 'TELEGRAM_PENGGUNA', JSON.stringify(sisa));
      await cabutRobotKalauKosong_(id, sisa);
    }
    if (email) await cabutLampiran_(trx.map(r => teks_(r[11])).filter(Boolean), email);
    return true;
  }

  /** Mencabut izin lihat foto-foto ini dari satu email. Foto milik anggota lain dilewati (bukan hak akun ini). */
  async function cabutLampiran_(daftar, email) {
    const antre = Array.from(new Set(daftar));
    const kerja = async () => {
      for (let f = antre.shift(); f; f = antre.shift()) {
        try {
          const r = await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(f) + '/permissions?fields=permissions(id,emailAddress)');
          for (const p of r.permissions || []) {
            if (String(p.emailAddress || '').toLowerCase() === email) {
              await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(f) + '/permissions/' + p.id, { method: 'DELETE' });
            }
          }
        } catch (e) { /* bukan milik akun ini / sudah dihapus */ }
      }
    };
    await Promise.all([kerja(), kerja(), kerja(), kerja()]); // 4 sekaligus supaya tidak lama
  }

  // ---------- Data ----------

  /**
   * bulan: kunci periode 'yyyy-mm' (bulan tempat periode dimulai); kosong = periode yang sedang berjalan.
   * Kalau tanggal mulai periode (gajian) = 25, periode '2026-10' = 25 Okt – 24 Nov 2026.
   */
  async function getData(bulan) {
    if (!(await cariIdDb_())) return { perluSetup: true, user: GOOGLE.email() };
    const id = await db_();
    const adaCatatan = TABEL.catatan.nama in idSheet;
    const adaLog = TABEL.log.nama in idSheet;
    const tabel = ['transaksi', 'kategori', 'dompet', 'pengaturan', 'rutin'].concat(adaCatatan ? ['catatan'] : [], adaLog ? ['log'] : []);
    const isi = await bacaTabel_(id, tabel);
    const [trx, kat, dom, set, rut] = isi;
    const cat = adaCatatan ? isi[tabel.indexOf('catatan')] : [];
    const lg = adaLog ? isi[tabel.indexOf('log')] : [];
    const d = olahData_(trx, kat, dom);
    const mulai = mulaiPeriode_(set);
    if (!/^\d{4}-\d{2}$/.test(bulan || '')) bulan = periodeDari_(tanggalLokal_(), mulai);

    const saldo = {};
    const jenis = {};
    d.dompet.forEach(w => { saldo[w.nama] = w.saldoAwal; jenis[w.nama] = w.jenis; });

    // Ringkasan per periode untuk laporan:
    // { 'yyyy-mm': { masuk, keluar, ditabung, kategori: {nama: n} (pengeluaran), kategoriMasuk: {nama: n}, oleh: {email: n} } }
    const bulanan = {};
    d.transaksi.forEach(t => {
      const b = periodeDari_(t.tanggal, mulai);
      const r = bulanan[b] || (bulanan[b] = { masuk: 0, keluar: 0, ditabung: 0, kategori: {}, kategoriMasuk: {}, oleh: {} });
      if (t.tipe === TIPE.MASUK) {
        tambah_(saldo, t.dompet, t.jumlah);
        r.masuk += t.jumlah;
        tambah_(r.kategoriMasuk, t.kategori, t.jumlah);
      } else if (t.tipe === TIPE.KELUAR) {
        tambah_(saldo, t.dompet, -t.jumlah);
        r.keluar += t.jumlah;
        tambah_(r.kategori, t.kategori, t.jumlah);
        tambah_(r.oleh, t.oleh || '?', t.jumlah);
      } else if (t.tipe === TIPE.TRANSFER) {
        tambah_(saldo, t.dompet, -t.jumlah);
        tambah_(saldo, t.dompetTujuan, t.jumlah);
        if (jenis[t.dompetTujuan] === JENIS.TABUNGAN) r.ditabung += t.jumlah;
        if (jenis[t.dompet] === JENIS.TABUNGAN) r.ditabung -= t.jumlah;
      }
    });

    return {
      user: GOOGLE.email(),
      urlSpreadsheet: urlDb_(id),
      linkUndangan: linkUndangan_(id),
      kunciGemini: (kunciAi = kunciGemini_(set), modelAi = pengaturan_(set).GEMINI_MODEL, kunciAi.map(samarkanKunci_)),
      namaBuku: namaBuku_(judulDb),
      buku: await daftarBuku_(id),
      spreadsheetId: id,
      telegram: infoTelegram_(set),
      bulan,
      mulaiPeriode: mulai,
      kategori: d.kategori,
      dompet: d.dompet.map(w => Object.assign({}, w, { saldo: saldo[w.nama] || 0 })),
      rutin: olahRutin_(rut),
      catatan: adaCatatan ? olahCatatan_(cat) : [],
      bisaCatatan: adaCatatan,
      log: lg.filter(r => r[0] !== '' && String(r[2]) !== 'galat').slice(-200).map(r => ({ waktu: dariSerial_(r[0]), oleh: String(r[1]), aksi: String(r[2]), ringkasan: String(r[3]), idTrx: String(r[4] || '') })).reverse(),
      pembanding: pembanding_(d.transaksi, bulan, mulai),
      setara: setara_(d.transaksi, mulai),
      anggaranLabel: anggaranLabel_(set),
      cadangan: bacaJson_(pengaturan_(set).CADANGAN, {}),
      cepat: kebiasaan_(d.transaksi),
      saranRutin: saranRutin_(d.transaksi, olahRutin_(rut)),
      setoranTabungan: setoranTabungan_(d.transaksi, d.dompet),
      jejak: jejak_(d.transaksi, d.dompet),
      tantangan: bacaJson_(pengaturan_(set).TANTANGAN, {}),
      avatar: avatar_(set),
      emas: bacaJson_(pengaturan_(set).EMAS, {}),
      hargaEmas: bacaJson_(pengaturan_(set).HARGA_EMAS, {}),
      bulanan,
      transaksi: d.transaksi
        .filter(t => periodeDari_(t.tanggal, mulai) === bulan)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat)),
    };
  }

  /**
   * Semua transaksi dalam rentang 'yyyy-mm-dd' (inklusif; kosong = tanpa batas), terbaru dulu.
   * Dipakai Riwayat untuk mencari lintas bulan; dibaca saat dibutuhkan saja supaya getData tetap ringan.
   */
  async function cariTransaksi(dari, sampai) {
    const id = await db_();
    const [trx] = await bacaTabel_(id, ['transaksi']);
    return olahData_(trx, [], []).transaksi
      .filter(t => (!dari || t.tanggal >= dari) && (!sampai || t.tanggal <= sampai))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat));
  }

  // ---------- Input cepat: kebiasaan mencatat ----------

  /**
   * Dari transaksi 120 hari terakhir:
   *   favorit: transaksi yang sering diulang (≥2×), dengan nominal & dompet yang paling sering → tombol satu ketuk.
   *   saran: catatan yang pernah dipakai beserta kategori terakhirnya → saran saat mengetik catatan.
   */
  /**
   * Transaksi yang tampaknya rutin bulanan tapi belum dijadikan tagihan rutin: catatan sama, muncul di ≥ 3 dari
   * 4 bulan terakhir, nominal mirip (±15% dari median), dan tanggalnya berdekatan. Maksimal 3 saran.
   */
  function saranRutin_(semua, rutin) {
    const kini = new Date();
    const bulan = [0, 1, 2, 3].map(n => { const d = new Date(kini.getFullYear(), kini.getMonth() - n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
    const median = a => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
    const sudah = rutin.map(r => r.nama.toLowerCase().trim());
    const grup = {};
    semua.filter(t => t.tipe !== TIPE.TRANSFER && t.catatan && bulan.includes(t.tanggal.slice(0, 7))).forEach(t => {
      const k = t.tipe + '|' + t.catatan.toLowerCase().trim();
      (grup[k] = grup[k] || []).push(t);
    });
    return Object.keys(grup).map(k => {
      const daftar = grup[k];
      const perBulan = {};
      daftar.forEach(t => { (perBulan[t.tanggal.slice(0, 7)] = perBulan[t.tanggal.slice(0, 7)] || []).push(t); });
      const bulanAda = Object.keys(perBulan);
      if (bulanAda.length < 3 || daftar.length > bulanAda.length + 1) return null; // jajan harian bukan tagihan
      const jumlah = median(daftar.map(t => t.jumlah));
      if (!jumlah || daftar.some(t => Math.abs(t.jumlah - jumlah) > jumlah * 0.15)) return null;
      const hari = daftar.map(t => Number(t.tanggal.slice(8, 10)));
      const hariMed = median(hari);
      if (hari.some(h => Math.abs(h - hariMed) > 5)) return null;
      const contoh = daftar.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
      if (sudah.includes(contoh.catatan.toLowerCase().trim())) return null;
      return { kunci: k, nama: contoh.catatan, tipe: contoh.tipe, jumlah, kategori: contoh.kategori, dompet: contoh.dompet, hari: hariMed, kali: bulanAda.length };
    }).filter(Boolean).sort((a, b) => b.kali - a.kali || b.jumlah - a.jumlah).slice(0, 3);
  }

  /** Rata-rata setoran bersih (setor − tarik) per bulan ke tiap tabungan, dari 3 bulan kalender terakhir. */
  function setoranTabungan_(semua, dompet) {
    const tabungan = dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama);
    const kini = new Date();
    const batas = new Date(kini.getFullYear(), kini.getMonth() - 3, 1).toISOString().slice(0, 10);
    const hasil = {};
    tabungan.forEach(n => {
      const bersih = semua.filter(t => t.tipe === TIPE.TRANSFER && t.tanggal >= batas && (t.dompetTujuan === n || t.dompet === n))
        .reduce((a, t) => a + (t.dompetTujuan === n ? t.jumlah : -t.jumlah), 0);
      hasil[n] = Math.round(bersih / 3);
    });
    return hasil;
  }

  /**
   * Jejak harian 400 hari terakhir untuk streak mencatat & tantangan: { 'yyyy-mm-dd': { n, k, m?, kat?, tab?, tabO? } }
   *   n   : jumlah transaksi yang tanggalnya ATAU waktu dicatatnya jatuh di hari itu (hari "mencatat")
   *   k   : total pengeluaran bertanggal hari itu; kat: { kategori: jumlah } pengeluarannya
   *   m   : total pemasukan bertanggal hari itu (tantangan "sisihkan % pemasukan")
   *   tab : { namaTabungan: setoran − penarikan } bertanggal hari itu; tabO: { namaTabungan: { email: jumlah } } per anggota
   * Hanya hari yang ada isinya yang disimpan, supaya ringan disimpan di HP.
   */
  function jejak_(semua, dompet) {
    const d = new Date(); d.setDate(d.getDate() - 400);
    const batas = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tabungan = new Set(dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama));
    const j = {};
    const hari = tgl => j[tgl] || (j[tgl] = { n: 0, k: 0 });
    semua.forEach(t => {
      if (t.tanggal >= batas) {
        const h = hari(t.tanggal);
        h.n++;
        if (t.tipe === TIPE.KELUAR) {
          h.k += t.jumlah;
          tambah_(h.kat || (h.kat = {}), t.kategori, t.jumlah);
        } else if (t.tipe === TIPE.MASUK) {
          h.m = (h.m || 0) + t.jumlah;
        } else if (t.tipe === TIPE.TRANSFER && tabungan.has(t.dompetTujuan) !== tabungan.has(t.dompet)) {
          const masuk = tabungan.has(t.dompetTujuan);
          const nama = masuk ? t.dompetTujuan : t.dompet, jumlah = masuk ? t.jumlah : -t.jumlah;
          tambah_(h.tab || (h.tab = {}), nama, jumlah);
          const tabO = h.tabO || (h.tabO = {});
          tambah_(tabO[nama] || (tabO[nama] = {}), t.oleh || '', jumlah);
        }
      }
      const dicatat = String(t.dibuat || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dicatat) && dicatat !== t.tanggal && dicatat >= batas) hari(dicatat).n++;
    });
    return j;
  }

  /**
   * Tantangan & tanda "hari tanpa belanja" (sheet Pengaturan, kunci TANTANGAN, JSON; dipakai bersama satu buku).
   * ubah(isi) mengubah isi terbaru dari spreadsheet (dibaca ulang dulu supaya isian anggota lain tidak tertimpa).
   */
  async function ubahTantangan(ubah) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const isi = bacaJson_(pengaturan_(set).TANTANGAN, {});
    const baru = ubah(isi) || isi;
    await simpanPengaturan_(id, set, 'TANTANGAN', JSON.stringify(baru));
    return baru;
  }

  function kebiasaan_(semua) {
    const batas = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    const terbaru = semua.filter(t => t.tipe !== TIPE.TRANSFER && t.tanggal >= batas)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat));
    const terbanyak = daftar => {
      const n = {};
      daftar.forEach(x => { n[x] = (n[x] || 0) + 1; });
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    };

    const grup = {};
    terbaru.forEach(t => {
      const k = [t.tipe, t.kategori, t.catatan.trim().toLowerCase()].join('|');
      (grup[k] = grup[k] || []).push(t);
    });
    const favorit = Object.keys(grup).filter(k => grup[k].length >= 2)
      .sort((a, b) => grup[b].length - grup[a].length).slice(0, 6)
      .map(k => {
        const g = grup[k];
        return {
          tipe: g[0].tipe, kategori: g[0].kategori, catatan: g[0].catatan.trim(),
          jumlah: Number(terbanyak(g.map(t => t.jumlah))), dompet: terbanyak(g.map(t => t.dompet)), kali: g.length,
        };
      });

    const saran = [];
    const sudah = {};
    terbaru.forEach(t => {
      const c = t.catatan.trim();
      if (!c || c.length > 60 || sudah[c.toLowerCase()] || saran.length >= 80) return;
      sudah[c.toLowerCase()] = 1;
      saran.push({ catatan: c, tipe: t.tipe, kategori: t.kategori });
    });
    return { favorit, saran };
  }

  // ---------- Periode gajian ----------

  /** Tanggal mulai periode (1–28) dari sheet Pengaturan; 1 = bulan kalender biasa. */
  function mulaiPeriode_(rows) {
    const n = Math.round(Number(pengaturan_(rows).MULAI_PERIODE) || 1);
    return Math.min(28, Math.max(1, n));
  }

  /** Kunci periode 'yyyy-mm' untuk tanggal 'yyyy-mm-dd': sebelum tanggal mulai → masih periode bulan lalu. */
  function periodeDari_(tgl, mulai) {
    const [y, m, d] = String(tgl).split('-').map(Number);
    if (!mulai || mulai <= 1 || d >= mulai) return String(tgl).slice(0, 7);
    return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
  }

  /** { awal, akhir } ('yyyy-mm-dd', inklusif) untuk kunci periode. */
  function rentangPeriode_(k, mulai) {
    const [y, m] = k.split('-').map(Number);
    const iso = (Y, M, D) => Y + '-' + String(M).padStart(2, '0') + '-' + String(D).padStart(2, '0');
    if (!mulai || mulai <= 1) return { awal: iso(y, m, 1), akhir: iso(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()) };
    const akhir = new Date(Date.UTC(y, m, mulai - 1)); // bulan berikutnya, sehari sebelum tanggal mulai
    return { awal: iso(y, m, mulai), akhir: iso(akhir.getUTCFullYear(), akhir.getUTCMonth() + 1, akhir.getUTCDate()) };
  }

  async function aturRekapTelegram(nyala) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    await simpanPengaturan_(id, set, 'REKAP_TELEGRAM', nyala ? 'Nyala' : 'Mati');
    return true;
  }

  async function aturPengingatTelegram(nyala) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    await simpanPengaturan_(id, set, 'PENGINGAT_TELEGRAM', nyala ? 'Nyala' : 'Mati');
    return true;
  }

  async function simpanMulaiPeriode(n) {
    n = Math.round(Number(n));
    if (!(n >= 1 && n <= 28)) throw new Error(T('Pilih tanggal 1 sampai 28.'));
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    await simpanPengaturan_(id, set, 'MULAI_PERIODE', String(n));
    return true;
  }

  // ---------- Catatan & pengingat ----------

  const ULANG_CATATAN = ['', 'Mingguan', 'Bulanan', 'Tahunan'];

  function olahCatatan_(rows) {
    return rows.filter(r => r[0] !== '').map(r => ({
      id: String(r[0]),
      tanggal: dariSerial_(r[1]).slice(0, 10),
      judul: String(r[2]),
      isi: String(r[3]),
      pengingat: String(r[4]) === 'Ya',
      ulang: ULANG_CATATAN.includes(String(r[5])) ? String(r[5]) : '',
      warna: String(r[6] || ''),
      oleh: String(r[7]),
      // Papan catatan (khusus tanpa tanggal): disematkan di atas, diarsipkan disembunyikan, urut terakhir diubah.
      sematkan: !r[1] && String(r[9]) === 'Ya',
      arsip: !r[1] && String(r[10]) === 'Ya',
      diubah: dariSerial_(r[11] || r[8]),
    })).filter(c => c.tanggal === '' || /^\d{4}-\d{2}-\d{2}$/.test(c.tanggal)); // '' = catatan tanpa tanggal
  }

  /**
   * input: { id?, tanggal 'yyyy-mm-dd' atau '' (tanpa tanggal), judul, isi, pengingat (bool), ulang, warna, sematkan?, arsip? }.
   * sematkan/arsip yang tidak diisi = tetap seperti sebelumnya; catatan bertanggal selalu tanpa keduanya.
   */
  async function simpanCatatan(input) {
    const judul = teks_(input.judul).slice(0, 80);
    if (!judul) throw new Error(T('Isi judul catatannya dulu.'));
    const tanggal = teks_(input.tanggal);
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error(T('Pilih tanggalnya dulu.'));
    // Tanpa tanggal: tidak bisa diingatkan atau diulang.
    const ulang = tanggal && ULANG_CATATAN.includes(String(input.ulang || '')) ? String(input.ulang || '') : '';
    const id = await db_();
    if (!(TABEL.catatan.nama in idSheet)) throw new Error(T('Buku ini belum bisa menyimpan catatan (butuh akses Editor ke spreadsheet).'));
    const idCatatan = teks_(input.id) || crypto.randomUUID();
    const baris = [idCatatan, tanggal ? serialTanggal_(tanggal) : '', judul, teks_(input.isi).slice(0, 2000), tanggal && input.pengingat ? 'Ya' : '', ulang,
      teks_(input.warna).slice(0, 12), GOOGLE.email(), serialSekarang_(), '', '', serialSekarang_()];
    const [rows] = await bacaTabel_(id, ['catatan']);
    const i = input.id ? rows.findIndex(r => String(r[0]) === idCatatan) : -1;
    const bendera = (nilai, lama) => tanggal ? '' : nilai === undefined ? (String(lama) === 'Ya' ? 'Ya' : '') : nilai ? 'Ya' : '';
    baris[9] = bendera(input.sematkan, i >= 0 ? rows[i][9] : '');
    baris[10] = bendera(input.arsip, i >= 0 ? rows[i][10] : '');
    if (i >= 0) {
      baris[7] = rows[i][7] || baris[7]; // pencatat & waktu dibuat tidak berubah saat diubah
      baris[8] = rows[i][8] || baris[8];
      await tulis_(id, rangeBaris_(TABEL.catatan, i), [baris]);
    } else {
      await tambahBaris_(id, TABEL.catatan, [baris]);
    }
    return idCatatan;
  }

  /** Sematkan / arsipkan catatan tanpa tanggal langsung dari Papan. ubah: { sematkan?, arsip? } (bool). */
  async function aturCatatan(idCatatan, ubah) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['catatan']);
    const i = cariBaris_(rows, r => String(r[0]) === String(idCatatan));
    const baris = rows[i].slice();
    if (baris[1]) return idCatatan; // catatan bertanggal tidak punya sematkan/arsip
    if ('sematkan' in ubah) baris[9] = ubah.sematkan ? 'Ya' : '';
    if ('arsip' in ubah) baris[10] = ubah.arsip ? 'Ya' : '';
    if (ubah.arsip) baris[9] = ''; // diarsipkan = lepas dari sematan (seperti Google Keep)
    baris[11] = serialSekarang_();
    await tulis_(id, rangeBaris_(TABEL.catatan, i), [baris]);
    return idCatatan;
  }

  /** Mengembalikan baris yang dihapus (untuk tombol Urungkan, lihat kembalikanCatatan). */
  async function hapusCatatan(idCatatan) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['catatan']);
    const i = cariBaris_(rows, r => String(r[0]) === String(idCatatan));
    const baris = rows[i];
    await hapusBaris_(id, TABEL.catatan, i);
    return baris;
  }

  async function kembalikanCatatan(baris) {
    const id = await db_();
    if (!Array.isArray(baris) || !baris[0]) throw new Error(T('Data catatan tidak lengkap.'));
    const [rows] = await bacaTabel_(id, ['catatan']);
    if (rows.some(r => String(r[0]) === String(baris[0]))) return true;
    await tambahBaris_(id, TABEL.catatan, [baris.slice(0, TABEL.catatan.kolom.length)]);
    return true;
  }

  // ---------- Tagihan & transaksi rutin ----------

  function olahRutin_(rows) {
    return rows.filter(r => r[0] !== '').map(r => ({
      id: String(r[0]),
      nama: String(r[1]),
      tipe: String(r[2]),
      jumlah: Number(r[3]) || 0,
      kategori: String(r[4]),
      dompet: String(r[5]),
      dompetTujuan: String(r[6]),
      catatan: String(r[7]),
      ulang: ULANG.includes(String(r[8])) ? String(r[8]) : 'Bulanan',
      mulai: dariSerial_(r[9]).slice(0, 10),
      berikutnya: dariSerial_(r[10]).slice(0, 10),
    })).sort((a, b) => a.berikutnya.localeCompare(b.berikutnya));
  }

  /**
   * Jatuh tempo setelah `berikut` ('yyyy-mm-dd'). Bulanan/tahunan berpatokan pada tanggal di `mulai`,
   * jadi tagihan tanggal 31 jatuh di 28/29 Feb lalu kembali ke 31 Maret (tidak bergeser terus).
   */
  function tanggalBerikut_(berikut, mulai, ulang) {
    const [y, m, d] = berikut.split('-').map(Number);
    const iso = (Y, M, D) => Y + '-' + String(M).padStart(2, '0') + '-' + String(D).padStart(2, '0');
    if (ulang === 'Mingguan') {
      const t = new Date(Date.UTC(y, m - 1, d + 7));
      return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    }
    let Y = y, M = m;
    if (ulang === 'Tahunan') Y++;
    else if (++M > 12) { M = 1; Y++; }
    const patokan = Number(String(mulai).slice(8, 10)) || d;
    return iso(Y, M, Math.min(patokan, new Date(Date.UTC(Y, M, 0)).getUTCDate()));
  }

  const serialTanggal_ = s => { const [y, m, d] = s.split('-').map(Number); return keSerial_(y, m, d); };

  /**
   * input: { id?, nama, tipe, jumlah, kategori, dompet, dompetTujuan, catatan, ulang, berikutnya }.
   * `berikutnya` sekaligus jadi patokan tanggal untuk periode-periode selanjutnya.
   */
  async function simpanRutin(input) {
    const t = validasiTransaksi_(Object.assign({}, input, { tanggal: input.berikutnya }));
    await cekJenisDompet_(await db_(), t);
    const nama = teks_(input.nama).slice(0, 60) || t.catatan || t.kategori || 'Transfer';
    const ulang = String(input.ulang);
    if (!ULANG.includes(ulang)) throw new Error(T('Pilih jarak pengulangan.'));
    const id = await db_();
    const baris = [t.id || crypto.randomUUID(), nama, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, ulang, t.tanggal, t.tanggal];
    if (t.id) {
      const [rows] = await bacaTabel_(id, ['rutin']);
      await tulis_(id, rangeBaris_(TABEL.rutin, cariBaris_(rows, r => String(r[0]) === t.id)), [baris]);
    } else {
      await tambahBaris_(id, TABEL.rutin, [baris]);
    }
    return baris[0];
  }

  async function hapusRutin(idRutin) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['rutin']);
    await hapusBaris_(id, TABEL.rutin, cariBaris_(rows, r => String(r[0]) === String(idRutin)));
    return true;
  }

  /** Memajukan jatuh tempo ke periode berikutnya (setelah dibayar, atau "lewati kali ini"). */
  async function majukanRutin(idRutin) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['rutin']);
    const i = rows.findIndex(r => String(r[0]) === String(idRutin));
    if (i < 0) return false; // sudah dihapus orang lain: transaksinya tetap tersimpan
    const r = olahRutin_([rows[i]])[0];
    await tulis_(id, "'" + TABEL.rutin.nama + "'!K" + (i + 2), [[serialTanggal_(tanggalBerikut_(r.berikutnya, r.mulai, r.ulang))]]);
    return true;
  }

  /**
   * input.idBaru (opsional): ID yang sudah dibuat di HP untuk transaksi antrean offline.
   * Kalau ID itu sudah ada di sheet (kiriman sebelumnya sampai tapi jawabannya hilang), tidak ditambah lagi.
   * input.dariRutin (opsional): ID rutin yang dibayar dengan transaksi ini → jatuh temponya dimajukan.
   * input.ulang (opsional, transaksi baru): 'Bulanan' | 'Mingguan' | 'Tahunan' → sekalian dibuatkan rutin.
   */
  async function simpanTransaksi(input) {
    const t = validasiTransaksi_(input);
    const id = await db_();
    const sekarang = serialSekarang_();
    const tbl = TABEL.transaksi;
    const aturan = await cekJenisDompet_(id, t, { izinEmas: !t.id && input.izinEmas === true });
    if (t.id) {
      // Baris dicari lewat ID sesaat sebelum menulis, dan hanya kolom yang berubah yang ditulis
      // (Dibuat Oleh/Pada tidak disentuh), supaya perubahan orang lain di saat bersamaan tidak tertimpa.
      // Foto diunggah dulu, supaya baris tidak bergeser selama menunggu unggahan.
      const lampiran = input.lampiranData ? await unggahStruk_(input.lampiranData, input.tanggal, input.kabarUnggah) : null;
      const baris = cariBaris_(await daftarId_(id), x => x === t.id) + 2;
      const lama = await bacaBarisTransaksi_(id, baris); // untuk log perubahan & foto lama
      if (String(lama[2]) === TIPE.TRANSFER && (aturan.adalahEmas(String(lama[5])) || aturan.adalahEmas(String(lama[6])))) {
        throw new Error(T('Transaksi emas tidak bisa diubah. Hapus transaksinya (gramnya ikut dikembalikan), lalu catat ulang dari detail emas.'));
      }
      const lampiranLama = lampiran || input.hapusLampiran ? lama[11] : '';
      const data = [
        { range: "'" + tbl.nama + "'!B" + baris + ':H' + baris, values: [[t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan]] },
        { range: "'" + tbl.nama + "'!K" + baris, values: [[sekarang]] },
      ];
      if (lampiran || input.hapusLampiran) data.push({ range: "'" + tbl.nama + "'!L" + baris, values: [[lampiran || '']] });
      await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
      const beda = [];
      if (Number(lama[3]) !== t.jumlah) beda.push(rpLog_(lama[3]) + ' → ' + rpLog_(t.jumlah));
      if (String(lama[4]) !== t.kategori && t.kategori) beda.push('kategori ' + lama[4] + ' → ' + t.kategori);
      if (String(lama[5]) !== t.dompet) beda.push('dompet ' + lama[5] + ' → ' + t.dompet);
      if (Number(lama[1]) !== t.tanggal) beda.push('tanggal ' + dariSerial_(lama[1]).slice(0, 10) + ' → ' + dariSerial_(t.tanggal).slice(0, 10));
      if (String(lama[7] || '') !== t.catatan) beda.push('catatan diubah');
      // Pekerjaan sampingan dijalankan bersamaan supaya simpan tidak menunggu satu per satu.
      await Promise.all([
        lampiran ? bagikanStruk_(lampiran) : null,
        lampiranLama && lampiranLama !== lampiran ? buangLampiran_(lampiranLama) : null, // foto lama diganti/dihapus
        beda.length ? catatLog_(id, 'ubah', (t.kategori || t.tipe) + ' ' + rpLog_(t.jumlah) + ': ' + beda.join(', '), t.id) : null,
      ]);
    } else {
      t.id = teks_(input.idBaru) || crypto.randomUUID();
      if (input.idBaru && (await daftarId_(id)).includes(t.id)) return t.id;
      const lampiran = input.lampiranData ? await unggahStruk_(input.lampiranData, input.tanggal, input.kabarUnggah) : '';
      await tambahBaris_(id, tbl, [[
        t.id, t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, GOOGLE.email(), sekarang, sekarang, lampiran,
      ]]);
      if (lampiran) await bagikanStruk_(lampiran);
      if (input.struk) await catatHarga_(id, t, input.struk);
      if (input.dariRutin) await majukanRutin(input.dariRutin);
      if (ULANG.includes(input.ulang)) {
        const tgl = String(input.tanggal);
        await simpanRutin(Object.assign({}, input, { id: '', nama: '', berikutnya: tanggalBerikut_(tgl, tgl, input.ulang) }));
      }
    }
    return t.id;
  }

  // ---------- Riwayat harga barang ----------

  /** Barang dari hasil baca struk dicatat ke sheet Harga. Tidak wajib: gagal → transaksi tetap tersimpan. */
  async function catatHarga_(id, t, struk) {
    const barang = (struk && Array.isArray(struk.barang) ? struk.barang : []).filter(x => x && teks_(x.nama) && Number(x.harga) > 0);
    if (!barang.length || !(TABEL.harga.nama in idSheet)) return;
    const toko = teks_(struk.toko).slice(0, 60) || teks_(t.catatan).split(/\s+-\s+/)[0].slice(0, 60);
    try {
      await tambahBaris_(id, TABEL.harga, barang.slice(0, 60).map(x => [
        t.tanggal, toko, teks_(x.nama).slice(0, 60), Math.round(Number(x.harga)), Number(x.jumlah) || 1, t.id, GOOGLE.email(),
      ]));
      hargaCache = null;
    } catch (e) {
      console.warn('Riwayat harga tidak tersimpan:', e);
    }
  }

  let hargaCache = null; // { id, waktu, data }: dibaca ulang paling cepat tiap 60 detik atau setelah mencatat struk

  /**
   * Semua catatan harga, terbaru dulu: [{ tanggal, toko, nama, harga, jumlah, idTrx, oleh }].
   * Baris yang transaksinya sudah dihapus diabaikan (kalau transaksinya dikembalikan, barangnya ikut muncul lagi).
   */
  async function riwayatHarga(segar) {
    const id = await db_();
    if (!(TABEL.harga.nama in idSheet)) return [];
    if (!segar && hargaCache && hargaCache.id === id && Date.now() - hargaCache.waktu < 60000) return hargaCache.data;
    const [[rows], ada] = await Promise.all([bacaTabel_(id, ['harga']), daftarId_(id)]);
    const idAda = new Set(ada);
    const data = rows.filter(r => r[2] !== '' && Number(r[3]) > 0 && (!r[5] || idAda.has(String(r[5])))).map(r => ({
      tanggal: dariSerial_(r[0]).slice(0, 10), toko: String(r[1]), nama: String(r[2]), harga: Number(r[3]),
      jumlah: Number(r[4]) || 1, idTrx: String(r[5]), oleh: String(r[6]),
    })).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    hargaCache = { id, waktu: Date.now(), data };
    return data;
  }

  // ---------- Beberapa buku keuangan ----------
  // Satu buku = satu spreadsheet. Daftarnya di config appData, jadi ikut ke HP lain.

  /** "Dompet Keluarga - Usaha" → "Usaha"; "Dompet Keluarga" → "Keluarga". */
  function namaBuku_(judul) {
    const j = teks_(judul) || 'Dompet Keluarga';
    if (/^Dompet Keluarga$/i.test(j)) return 'Keluarga';
    return j.replace(/^Dompet Keluarga\s*[-–:]\s*/i, '') || j;
  }

  /** Daftar buku di config + buku `id` (dengan judul terbaru), tanpa dobel; buku aktif lama tetap ada. */
  function daftarBukuDengan_(c, id) {
    const buku = (c.buku || []).filter(b => b.id !== id);
    if (c.spreadsheetId && c.spreadsheetId !== id && !buku.some(b => b.id === c.spreadsheetId)) {
      buku.push({ id: c.spreadsheetId, nama: 'Keluarga' });
    }
    const lama = (c.buku || []).findIndex(b => b.id === id);
    const ini = { id, nama: namaBuku_(judulDb) };
    if (lama >= 0) buku.splice(Math.min(lama, buku.length), 0, ini); // urutan tetap
    else buku.push(ini);
    return buku;
  }

  /** Untuk getData: daftar buku dengan tanda aktif; config diperbarui kalau buku ini belum tercatat atau judulnya berubah. */
  async function daftarBuku_(id) {
    const c = await bacaConfig_();
    const ada = (c.buku || []).find(b => b.id === id);
    if (!ada || ada.nama !== namaBuku_(judulDb)) {
      c.buku = daftarBukuDengan_(c, id);
      try { await tulisConfig_(c); } catch (e) { console.warn('Daftar buku tidak tersimpan:', e); }
    }
    return (c.buku || []).map(b => ({ id: b.id, nama: b.nama, aktif: b.id === id, linkUndangan: linkUndangan_(b.id) }));
  }

  /** Buku baru (spreadsheet baru) dengan satu dompet Tunai, langsung jadi buku aktif. */
  async function buatBuku(nama) {
    nama = teks_(nama);
    if (!nama) throw new Error(T('Isi nama bukunya, mis. Usaha atau Pribadi.'));
    await buatDatabase('', [{ nama: 'Tunai', ikon: '💵', saldoAwal: 0 }], nama);
    return true;
  }

  /** Menghapus buku dari daftar di akun ini (spreadsheet-nya sendiri tidak dihapus). */
  async function lupakanBuku(id) {
    if (id === dbId) throw new Error(T('Buku yang sedang dibuka tidak bisa dilupakan. Pindah ke buku lain dulu.'));
    const c = await bacaConfig_();
    c.buku = (c.buku || []).filter(b => b.id !== id);
    await tulisConfig_(c);
    return true;
  }

  /** Akhiran nama file spreadsheet buku yang sudah dihapus pemiliknya. */
  const AKHIRAN_DIHAPUS = ' - deleted';
  const sudahDihapus_ = judul => /\s-\s*deleted$/i.test(teks_(judul));

  /**
   * Hanya pemilik: buku dilepas dari daftar, dan file spreadsheet di Google Drive TIDAK dihapus, hanya diberi
   * akhiran " - deleted" (data tetap bisa dipulihkan dari Drive).
   */
  async function hapusBuku(id) {
    if (id === dbId) throw new Error(T('Buku yang sedang dibuka tidak bisa dihapus. Pindah ke buku lain dulu.'));
    await idBuku_(id);
    const f = await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(id) + '?fields=name,ownedByMe');
    if (!f.ownedByMe) throw new Error(T('Hanya pemilik buku yang bisa menghapusnya.'));
    if (!sudahDihapus_(f.name)) {
      await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(id) + '?fields=id', { method: 'PATCH', json: { name: f.name + AKHIRAN_DIHAPUS } });
    }
    return lupakanBuku(id);
  }

  /**
   * "Cek undangan": buku yang dipilih lewat Google Picker dimasukkan ke daftar buku akun ini, tanpa dibuka.
   * Hasil per file: { id, nama } kalau berhasil, atau { id, pesan } kalau dilewati.
   */
  async function tambahBuku(ids) {
    const c = (await bacaConfig_()) || {};
    c.buku = c.buku || [];
    const hasil = [];
    for (const id of [].concat(ids || []).slice(0, 10)) {
      try {
        const r = await GOOGLE.api(SHEETS + '/' + encodeURIComponent(id) + '?fields=properties.title,sheets.properties.title');
        const judul = (r.properties && r.properties.title) || '';
        const ada = new Set((r.sheets || []).map(s => s.properties.title));
        if (!['transaksi', 'kategori', 'dompet'].every(k => ada.has(TABEL[k].nama))) throw new Error(T('"{judul}" bukan buku Dompet Keluarga', { judul }));
        if (sudahDihapus_(judul)) throw new Error(T('"{judul}" sudah dihapus pemiliknya', { judul }));
        const nama = namaBuku_(judul);
        if (!c.buku.some(b => b.id === id)) c.buku.push({ id, nama });
        hasil.push({ id, nama });
      } catch (e) {
        hasil.push({ id, pesan: e.message });
      }
    }
    if (hasil.some(h => !h.pesan)) await tulisConfig_(c);
    return hasil;
  }

  // ---------- Folder induk "Dompet Keluarga" di Google Drive ----------
  // Semua file aplikasi milik akun ini dikumpulkan di satu folder:
  //   Dompet Keluarga/
  //     Dompet Keluarga (spreadsheet buku), Dompet Keluarga - Usaha, ...
  //     Foto Struk/ (lampiran transaksi)
  // Spreadsheet milik orang lain (anggota yang diundang) tidak bisa dipindah; tetap di "Shared with me".

  const MIME_FOLDER = 'application/vnd.google-apps.folder';
  let janjiInduk = null;   // dibagi bersama supaya panggilan bersamaan tidak membuat folder dobel
  let sudahRapi = {};      // ID spreadsheet yang sudah dicek sesi ini
  let idFolderStruk = null;

  /** Folder yang ID-nya tersimpan di config (kunci), atau dibuat baru kalau belum ada / sudah dibuang. */
  async function folderConfig_(kunci, nama, induk) {
    const c = (await bacaConfig_()) || {};
    if (c[kunci]) {
      try {
        const f = await GOOGLE.api(DRIVE + '/files/' + c[kunci] + '?fields=id,trashed');
        if (!f.trashed) return f.id;
      } catch (e) { /* terhapus → buat baru */ }
    }
    const f = await GOOGLE.api(DRIVE + '/files?fields=id', {
      method: 'POST', json: Object.assign({ name: nama, mimeType: MIME_FOLDER }, induk ? { parents: [induk] } : {}),
    });
    const baru = await bacaConfig_(); // dibaca lagi: config mungkin berubah selama menunggu
    baru[kunci] = f.id;
    await tulisConfig_(baru);
    return f.id;
  }

  function folderInduk_() {
    if (!janjiInduk) janjiInduk = folderConfig_('folderInduk', 'Dompet Keluarga').catch(e => { janjiInduk = null; throw e; });
    return janjiInduk;
  }

  /** Memindahkan file milik akun ini ke folder induk (nama: ganti nama sekalian). Gagal diabaikan. */
  async function masukkanKeInduk_(idFile, nama) {
    try {
      const induk = await folderInduk_();
      const f = await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(idFile) + '?fields=parents,ownedByMe,name');
      if (!f.ownedByMe) return;
      const sudah = (f.parents || []).includes(induk);
      if (sudah && (!nama || f.name === nama)) return;
      const q = sudah ? '' : '&addParents=' + induk + ((f.parents || []).length ? '&removeParents=' + f.parents.join(',') : '');
      await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(idFile) + '?fields=id' + q, { method: 'PATCH', json: nama ? { name: nama } : {} });
    } catch (e) {
      console.warn('File tidak bisa dipindah ke folder Dompet Keluarga:', e);
    }
  }

  /** Sekali per sesi, di latar: spreadsheet aktif & folder foto struk lama dipindah ke folder induk. */
  async function rapikanFolder_(idDb) {
    try {
      await masukkanKeInduk_(idDb);
      const c = await bacaConfig_();
      if (c.folderStruk) await masukkanKeInduk_(c.folderStruk, 'Foto Struk');
    } catch (e) { /* tidak penting */ }
  }

  // ---------- Cadangan otomatis ----------
  // Sebulan sekali, salinan spreadsheet dibuat di folder "Dompet Keluarga › Cadangan" milik akun yang pertama membuka
  // aplikasi setelah jatuh tempo. Kunci CADANGAN di Pengaturan ({ tgl, oleh }) dipakai bersama satu buku supaya anggota
  // lain tidak ikut membuat salinan. Per buku disimpan SIMPAN_CADANGAN salinan terbaru; yang lebih lama ke Sampah.

  const JEDA_CADANGAN_HARI = 30;
  const SIMPAN_CADANGAN = 3;
  const selisihHari_ = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
    - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

  /** paksa: buat sekarang walau belum jatuh tempo. Hasil: { tgl, oleh, folder?, dilewati? }. */
  async function cadangkan(paksa) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const lama = bacaJson_(pengaturan_(set).CADANGAN, {});
    const kini = tanggalLokal_();
    if (!paksa && /^\d{4}-\d{2}-\d{2}$/.test(lama.tgl || '') && selisihHari_(lama.tgl, kini) < JEDA_CADANGAN_HARI) {
      return Object.assign({ dilewati: true }, lama);
    }
    const baru = { tgl: kini, oleh: GOOGLE.email() };
    await simpanPengaturan_(id, set, 'CADANGAN', JSON.stringify(baru)); // ditandai dulu, supaya anggota lain tidak ikut membuat
    try {
      const folder = await folderConfig_('folderCadangan', 'Cadangan', await folderInduk_());
      await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(id) + '/copy?fields=id', {
        method: 'POST',
        json: { name: (judulDb || 'Dompet Keluarga') + ' · cadangan ' + kini, parents: [folder], appProperties: { cadanganDari: id } },
      });
      // Simpan beberapa yang terbaru saja (hanya salinan buku ini, buatan aplikasi ini).
      const q = encodeURIComponent("'" + folder + "' in parents and trashed=false and appProperties has { key='cadanganDari' and value='" + id + "' }");
      const r = await GOOGLE.api(DRIVE + '/files?fields=files(id,createdTime)&orderBy=createdTime%20desc&pageSize=50&q=' + q);
      await Promise.all((r.files || []).slice(SIMPAN_CADANGAN).map(f => buangLampiran_(f.id)));
      return Object.assign({ folder }, baru);
    } catch (e) {
      // Gagal: tanda dikembalikan supaya dicoba lagi lain kali.
      try { const [s2] = await bacaTabel_(id, ['pengaturan']); await simpanPengaturan_(id, s2, 'CADANGAN', JSON.stringify(lama)); } catch (x) { /* abaikan */ }
      throw e;
    }
  }

  // ---------- Lampiran foto struk (Google Drive) ----------

  /** Folder "Foto Struk" di dalam folder induk; dibuat sekali, ID-nya disimpan di config appData. */
  async function folderStruk_() {
    if (idFolderStruk) return idFolderStruk;
    const c = await bacaConfig_();
    const lama = c.folderStruk;
    const id = await folderConfig_('folderStruk', 'Foto Struk', await folderInduk_());
    if (id === lama) await masukkanKeInduk_(id, 'Foto Struk'); // folder versi lama ("Dompet Keluarga - Struk")
    return (idFolderStruk = id);
  }

  /** Mengunggah foto (base64 JPEG) ke folder struk. Hasil: ID file Drive. Dibagikan terpisah lewat bagikanStruk_. */
  async function unggahStruk_(base64, tanggal, kemajuan) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const meta = { name: 'Struk ' + teks_(tanggal) + '.jpg', mimeType: 'image/jpeg', parents: [await folderStruk_()] };
    const f = await GOOGLE.api(UPLOAD + '/files?uploadType=multipart&fields=id', Object.assign({ method: 'POST', kemajuan }, GOOGLE.multipart(meta, blob)));
    return f.id;
  }

  /**
   * Membagikan foto (hanya lihat, tanpa email) ke semua akun yang punya akses ke spreadsheet keluarga,
   * supaya anggota lain bisa membukanya. Semua anggota dikirim bersamaan. Gagal tidak menggagalkan simpan.
   */
  async function bagikanStruk_(idFile) {
    try {
      const izin = await GOOGLE.api(DRIVE + '/files/' + dbId + '/permissions?fields=permissions(type,emailAddress)');
      const saya = String(GOOGLE.email()).toLowerCase();
      await Promise.all((izin.permissions || [])
        .filter(p => p.type === 'user' && p.emailAddress && p.emailAddress.toLowerCase() !== saya)
        .map(p => GOOGLE.api(DRIVE + '/files/' + idFile + '/permissions?sendNotificationEmail=false', {
          method: 'POST', json: { type: 'user', role: 'reader', emailAddress: p.emailAddress },
        }).catch(e => console.warn('Foto struk tidak bisa dibagikan ke ' + p.emailAddress + ':', e))));
    } catch (e) {
      console.warn('Foto struk tidak bisa dibagikan ke anggota lain:', e); // fotonya tetap tersimpan untuk pengunggah
    }
  }

  /** Isi foto lampiran (Blob) langsung lewat API Drive, supaya bisa dilihat di aplikasi tanpa membuka drive.google.com. */
  async function ambilLampiran(idFile) {
    return GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(teks_(idFile)) + '?alt=media', { blob: true });
  }

  /** Mengembalikan isi baris yang dihapus, untuk "Urungkan" (kembalikanTransaksi). Fotonya ikut ke Sampah Drive. */
  async function hapusTransaksi(idTrx) {
    const id = await db_();
    const i = cariBaris_(await daftarId_(id), x => x === String(idTrx));
    const baris = await bacaBarisTransaksi_(id, i + 2);
    await hapusBaris_(id, TABEL.transaksi, i);
    await buangLampiran_(baris[11]);
    await catatLog_(id, 'hapus', ringkasBaris_(baris), baris[0]);
    await lepasMutasiEmas_(id, [baris]);
    return baris;
  }

  // ---------- Emas: berat dalam gram ----------
  // EMAS[nama] = { gram, platform, modal?, hargaBeli?, hargaJual?, riwayat?: [{ id, tgl, gram (±), rp, dompet }] }.
  // Gram hanya berubah lewat form emas (simpanDompet) atau mutasiEmas; transaksi rupiahnya transfer dompet ↔ emas.

  const bulat4_ = n => Math.round(n * 10000) / 10000;

  /**
   * Tambah (gram > 0, beli) atau kurangi (gram < 0, jual) emas. input: { nama, gram, rp, dompet?, tanggal }.
   * Dengan dompet: dicatat transfer rupiah dompet → emas (beli) / emas → dompet (jual). Tanpa dompet: hanya gramnya.
   */
  async function mutasiEmas(input) {
    const nama = teks_(input.nama);
    const delta = bulat4_(Number(input.gram) || 0);
    const rp = Math.max(0, Math.round(Number(input.rp) || 0));
    const dompet = teks_(input.dompet);
    const tanggal = teks_(input.tanggal);
    if (!delta) throw new Error(T('Isi berat emasnya dalam gram (lebih dari 0).'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error(T('Tanggal tidak valid.'));
    const id = await db_();
    const [dom, set0] = await bacaTabel_(id, ['dompet', 'pengaturan']);
    const e0 = bacaJson_(pengaturan_(set0).EMAS, {})[nama];
    if (!e0 || String((dom.find(r => String(r[0]) === nama) || [])[3]) !== JENIS.ASET) throw new Error(T('Data emas tidak ditemukan. Coba muat ulang.'));
    if (delta < 0 && -delta > e0.gram + 1e-9) throw new Error(T('Emasnya hanya {gram} gram.', { gram: String(e0.gram).replace('.', ',') }));
    if (dompet) {
      const j = String((dom.find(r => String(r[0]) === dompet) || [])[3] || '');
      if (j !== JENIS.DOMPET && j !== JENIS.TABUNGAN) throw new Error(T('Pilih dompet biasa atau tabungan.'));
      if (!rp) throw new Error(T('Isi harga totalnya, atau pilih "Tanpa catat uang".'));
    }
    const g = String(Math.abs(delta)).replace('.', ',');
    const idTrx = dompet && rp ? await simpanTransaksi({
      tipe: TIPE.TRANSFER, jumlah: rp, tanggal, izinEmas: true,
      dompet: delta > 0 ? dompet : nama, dompetTujuan: delta > 0 ? nama : dompet,
      catatan: (delta > 0 ? 'Beli emas ' : 'Jual emas ') + g + ' gram',
    }) : '';
    // Baca ulang sesaat sebelum menulis, supaya isian anggota lain tidak tertimpa.
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const peta = bacaJson_(pengaturan_(set).EMAS, {});
    const e = peta[nama] || e0;
    const gramLama = Number(e.gram) || 0;
    const modal = Number(e.modal) || 0;
    e.gram = bulat4_(Math.max(0, gramLama + delta));
    if (modal || delta > 0) e.modal = Math.max(0, Math.round(delta > 0 ? modal + rp : gramLama ? modal * (1 + delta / gramLama) : 0)) || undefined;
    e.riwayat = (e.riwayat || []).concat([{ id: idTrx || crypto.randomUUID(), tgl: tanggal, gram: delta, rp, dompet: dompet || '' }]).slice(-60);
    peta[nama] = e;
    await simpanPengaturan_(id, set, 'EMAS', JSON.stringify(peta));
    return true;
  }

  /** Transaksi emas dihapus → gramnya (dan modal) dikembalikan. Isian riwayat yang dilepas dititipkan di baris[12] untuk Urungkan. */
  async function lepasMutasiEmas_(id, daftarBaris) {
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const peta = bacaJson_(pengaturan_(set).EMAS, {});
    let ubah = false;
    daftarBaris.forEach(b => {
      const nama = [String(b[5]), String(b[6])].find(n => peta[n] && (peta[n].riwayat || []).some(r => r.id === String(b[0])));
      if (!nama) return;
      const e = peta[nama];
      const r = e.riwayat.find(x => x.id === String(b[0]));
      e.riwayat = e.riwayat.filter(x => x !== r);
      e.gram = bulat4_(Math.max(0, (Number(e.gram) || 0) - r.gram));
      if (r.gram > 0 && e.modal) e.modal = Math.max(0, Math.round(e.modal - r.rp)) || undefined;
      b[TABEL.transaksi.kolom.length] = JSON.stringify({ nama, r });
      ubah = true;
    });
    if (ubah) await simpanPengaturan_(id, set, 'EMAS', JSON.stringify(peta));
  }

  /**
   * Harga emas per gram terbaru, dipakai bersama satu buku (Pengaturan HARGA_EMAS): { platform: { beli, jual, tgl, diambil } }.
   * Ditulis aplikasi setelah berhasil mengambil harga, dan oleh bot setiap pagi. Yang lebih baru (diambil) yang dipakai.
   */
  async function simpanHargaEmas(peta) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const isi = bacaJson_(pengaturan_(set).HARGA_EMAS, {});
    let ubah = false;
    Object.keys(peta || {}).forEach(k => {
      const h = peta[k];
      if (!/^[a-z0-9]{2,20}$/.test(k) || !h || !(Number(h.beli) > 0)) return;
      const baru = { beli: Math.round(h.beli), jual: Math.round(Number(h.jual) || 0), tgl: teks_(h.tgl).slice(0, 10), diambil: teks_(h.diambil).slice(0, 10) };
      if (isi[k] && String(isi[k].diambil || '') >= baru.diambil) return;
      isi[k] = baru;
      ubah = true;
    });
    if (ubah) await simpanPengaturan_(id, set, 'HARGA_EMAS', JSON.stringify(isi));
    return isi;
  }

  /** Kebalikan lepasMutasiEmas_ (dipanggil saat transaksinya dikembalikan). */
  async function pulihkanMutasiEmas_(id, daftarBaris) {
    const titipan = daftarBaris.map(b => bacaJson_(b[TABEL.transaksi.kolom.length], null)).filter(x => x && x.nama && x.r);
    if (!titipan.length) return;
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const peta = bacaJson_(pengaturan_(set).EMAS, {});
    titipan.forEach(({ nama, r }) => {
      const e = peta[nama];
      if (!e || (e.riwayat || []).some(x => x.id === r.id)) return;
      e.gram = bulat4_((Number(e.gram) || 0) + r.gram);
      if (r.gram > 0) e.modal = Math.round((Number(e.modal) || 0) + r.rp) || undefined;
      e.riwayat = (e.riwayat || []).concat([r]).slice(-60);
    });
    await simpanPengaturan_(id, set, 'EMAS', JSON.stringify(peta));
  }

  /** Rupiah ringkas untuk log: 25000 → "Rp25.000". */
  const rpLog_ = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  /** Baris transaksi mentah → "Belanja Rp250.000 · Indomaret (12 Nov)". */
  function ringkasBaris_(b) {
    const tgl = dariSerial_(b[1]).slice(0, 10);
    const judul = String(b[2]) === TIPE.TRANSFER ? 'Transfer ' + b[5] + ' → ' + b[6] : String(b[4] || b[2]);
    return judul + ' ' + rpLog_(b[3]) + (b[7] ? ' · ' + String(b[7]).slice(0, 40) : '') + ' (' + tgl + ')';
  }
  /** Tulis satu baris log; gagal (mis. akses hanya lihat / sheet belum ada) tidak menggagalkan aksi utamanya. */
  async function catatLog_(id, aksi, ringkasan, idTrx) {
    if (!(TABEL.log.nama in idSheet)) return;
    try {
      await tambahBaris_(id, TABEL.log, [[serialSekarang_(), GOOGLE.email(), aksi, String(ringkasan).slice(0, 200), teks_(idTrx)]]);
    } catch (e) { console.warn('Log tidak tercatat:', e); }
  }

  /** Error JavaScript dari HP pengguna (lihat laporGalat di app.js), dicatat ke sheet Log dengan Aksi "galat". */
  async function catatGalat(pesan) {
    const id = await db_();
    await catatLog_(id, 'galat', pesan);
    return true;
  }

  // ---------- Ubah / hapus banyak transaksi sekaligus (Riwayat: pilih banyak) ----------

  /** ubah: { kategori } atau { dompet }. Hanya kolom itu (+ Diubah Pada) yang ditulis; posisi baris dicari lewat ID. */
  async function ubahBanyak(ids, ubah) {
    const id = await db_();
    const daftar = await daftarId_(id);
    const tbl = TABEL.transaksi;
    const kolom = ubah.kategori ? 'E' : 'F';
    const nilai = teks_(ubah.kategori || ubah.dompet);
    if (!nilai) throw new Error(T('Pilih kategori atau dompetnya dulu.'));
    if (ubah.dompet) {
      // Ganti dompet asal: tidak boleh ke aset/orang, tidak boleh jadi transfer ke dompet yang sama, dan transaksi emas tidak ikut.
      const [trx, dom, set] = await bacaTabel_(id, ['transaksi', 'dompet', 'pengaturan']);
      const jenisBaru = String((dom.find(r => String(r[0]) === nilai) || [])[3] || JENIS.DOMPET);
      if (jenisBaru === JENIS.ASET || jenisBaru === JENIS.UTANG) throw new Error(T('Pilih dompet biasa atau tabungan.'));
      const emas = bacaJson_(pengaturan_(set).EMAS, {});
      const dipilih = trx.filter(r => ids.map(String).includes(String(r[0])));
      if (dipilih.some(r => String(r[2]) === TIPE.TRANSFER && String(r[6]) === nilai)) {
        throw new Error(T('Ada transfer yang tujuannya {nama}, jadi akan jadi transfer ke dompet yang sama. Lepas pilihan transfer itu dulu.', { nama: nilai }));
      }
      if (dipilih.some(r => emas[String(r[5])] || emas[String(r[6])])) throw new Error(T('Transaksi emas tidak bisa dipindah dompetnya. Lepas pilihan transaksi emas dulu.'));
    }
    const sekarang = serialSekarang_();
    const data = [];
    ids.forEach(x => {
      const i = daftar.indexOf(String(x));
      if (i < 0) return;
      data.push({ range: "'" + tbl.nama + "'!" + kolom + (i + 2), values: [[nilai]] }, { range: "'" + tbl.nama + "'!K" + (i + 2), values: [[sekarang]] });
    });
    if (!data.length) throw new Error(T('Data tidak ditemukan. Mungkin sudah diubah atau dihapus orang lain — coba muat ulang.'));
    await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
    await catatLog_(id, 'ubah', (data.length / 2) + ' transaksi: ' + (ubah.kategori ? 'kategori → ' : 'dompet → ') + nilai);
    return data.length / 2;
  }

  /** Menghapus beberapa transaksi sekaligus. Hasil: baris-baris aslinya, untuk "Urungkan" (kembalikanBanyak). */
  async function hapusBanyak(ids) {
    const id = await db_();
    const daftar = await daftarId_(id);
    const indeks = ids.map(x => daftar.indexOf(String(x))).filter(i => i >= 0).sort((a, b) => b - a);
    if (!indeks.length) throw new Error(T('Data tidak ditemukan. Mungkin sudah diubah atau dihapus orang lain — coba muat ulang.'));
    const baris = await Promise.all(indeks.map(i => bacaBarisTransaksi_(id, i + 2)));
    // Dari bawah ke atas, supaya nomor baris yang belum dihapus tidak bergeser.
    await GOOGLE.api(SHEETS + '/' + id + ':batchUpdate', {
      method: 'POST',
      json: { requests: indeks.map(i => ({ deleteDimension: { range: { sheetId: idSheet[TABEL.transaksi.nama], dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } })) },
    });
    await Promise.all(baris.map(b => buangLampiran_(b[11])));
    await lepasMutasiEmas_(id, baris);
    await catatLog_(id, 'hapus', baris.length + ' transaksi: ' + baris.slice(0, 3).map(ringkasBaris_).join('; ') + (baris.length > 3 ? '; …' : ''));
    return baris;
  }

  async function kembalikanBanyak(daftarBaris) {
    const id = await db_();
    const ada = await daftarId_(id);
    const baru = (daftarBaris || []).filter(b => Array.isArray(b) && b[0] && !ada.includes(String(b[0])));
    if (!baru.length) return true;
    await tambahBaris_(id, TABEL.transaksi, baru.map(b => b.slice(0, TABEL.transaksi.kolom.length)));
    await Promise.all(baru.map(b => buangLampiran_(b[11], false)));
    await pulihkanMutasiEmas_(id, baru);
    await catatLog_(id, 'kembalikan', baru.length + ' transaksi');
    return true;
  }

  // ---------- Label / acara (#lebaran di catatan) ----------

  function anggaranLabel_(set) {
    try { return JSON.parse(pengaturan_(set).ANGGARAN_LABEL || '{}') || {}; } catch (e) { return {}; }
  }

  /** Anggaran untuk satu label (huruf kecil, tanpa #); 0 = hapus anggarannya. */
  async function simpanAnggaranLabel(label, jumlah) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const semua = anggaranLabel_(set);
    const k = teks_(label).replace(/^#/, '').toLowerCase();
    if (!k) throw new Error(T('Label tidak valid.'));
    if (Number(jumlah) > 0) semua[k] = Math.round(Number(jumlah)); else delete semua[k];
    await simpanPengaturan_(id, set, 'ANGGARAN_LABEL', JSON.stringify(semua));
    return true;
  }

  /**
   * Pengeluaran periode berjalan sampai hari ini vs periode lalu sampai hari ke-N yang sama.
   * Hanya untuk periode berjalan; null kalau periode lalu belum ada pengeluaran.
   */
  function pembanding_(semua, bulan, mulai) {
    const kini = tanggalLokal_();
    if (periodeDari_(kini, mulai) !== bulan) return null;
    const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const iso = t => new Date(t).toISOString().slice(0, 10);
    const r = rentangPeriode_(bulan, mulai);
    const hari = Math.round((ms(kini) - ms(r.awal)) / 864e5);
    const [y, m] = bulan.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    const lalu = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    const rl = rentangPeriode_(lalu, mulai);
    const batas = iso(Math.min(ms(rl.awal) + hari * 864e5, ms(rl.akhir)));
    let ini = 0, sebelum = 0, sebelumPenuh = 0;
    semua.forEach(t => {
      if (t.tipe !== TIPE.KELUAR) return;
      if (t.tanggal >= r.awal && t.tanggal <= kini) ini += t.jumlah;
      if (t.tanggal >= rl.awal && t.tanggal <= rl.akhir) { sebelumPenuh += t.jumlah; if (t.tanggal <= batas) sebelum += t.jumlah; }
    });
    if (!sebelumPenuh) return null;
    return { hariKe: hari + 1, ini, lalu: sebelum, bulanLalu: lalu };
  }

  /**
   * Untuk Laporan: periode berjalan (sampai hari ini) dibanding periode lalu dan periode yang sama tahun lalu,
   * masing-masing hanya sampai hari ke-N yang sama, supaya periode yang baru berjalan tidak dibandingkan dengan
   * periode yang sudah penuh. { bulan, hariKe, ini, lalu, tahunLalu }; tiap bagian { bulan, batas, keluar, kategori }.
   */
  function setara_(semua, mulai) {
    const kini = tanggalLokal_();
    const bulan = periodeDari_(kini, mulai);
    const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const iso = t => new Date(t).toISOString().slice(0, 10);
    const hari = Math.round((ms(kini) - ms(rentangPeriode_(bulan, mulai).awal)) / 864e5);
    const [y, m] = bulan.split('-').map(Number);
    const kunci = (Y, M) => { const d = new Date(Date.UTC(Y, M - 1, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
    const bagian = k => {
      const r = rentangPeriode_(k, mulai);
      return { bulan: k, awal: r.awal, batas: iso(Math.min(ms(r.awal) + hari * 864e5, ms(r.akhir))), keluar: 0, kategori: {} };
    };
    const hasil = { bulan, hariKe: hari + 1, ini: bagian(bulan), lalu: bagian(kunci(y, m - 1)), tahunLalu: bagian(kunci(y - 1, m)) };
    const isi = [hasil.ini, hasil.lalu, hasil.tahunLalu];
    semua.forEach(t => {
      if (t.tipe !== TIPE.KELUAR) return;
      isi.forEach(b => {
        if (t.tanggal < b.awal || t.tanggal > b.batas) return;
        b.keluar += t.jumlah;
        tambah_(b.kategori, t.kategori, t.jumlah);
      });
    });
    isi.forEach(b => { delete b.awal; });
    return hasil;
  }

  /** baris: hasil hapusTransaksi. Ditambah lagi apa adanya (pencatat & waktu asli tetap), foto diambil dari Sampah. */
  async function kembalikanTransaksi(baris) {
    const id = await db_();
    if (!Array.isArray(baris) || !baris[0]) throw new Error(T('Data transaksi tidak lengkap.'));
    if ((await daftarId_(id)).includes(String(baris[0]))) return true;
    await tambahBaris_(id, TABEL.transaksi, [baris.slice(0, TABEL.transaksi.kolom.length)]);
    await catatLog_(id, 'kembalikan', ringkasBaris_(baris), baris[0]);
    await buangLampiran_(baris[11], false);
    await pulihkanMutasiEmas_(id, [baris]);
    return true;
  }

  /** Satu baris Transaksi (nomor baris sheet), nilai mentah supaya bisa ditulis ulang persis. */
  async function bacaBarisTransaksi_(id, nomor) {
    const n = TABEL.transaksi.kolom.length;
    const range = "'" + TABEL.transaksi.nama + "'!A" + nomor + ':L' + nomor;
    const r = await GOOGLE.api(SHEETS + '/' + id + '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
    const isi = ((r.values || [])[0] || []).slice(0, n);
    while (isi.length < n) isi.push('');
    return isi;
  }

  /**
   * Memindahkan foto lampiran ke Sampah Drive (buang = false: mengambilnya kembali).
   * Gagal diabaikan: foto milik anggota lain tidak bisa dibuang, dan perubahan di sheet sudah terjadi.
   */
  async function buangLampiran_(idFile, buang = true) {
    if (!teks_(idFile)) return;
    try {
      await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(teks_(idFile)), { method: 'PATCH', json: { trashed: buang } });
    } catch (e) { /* lihat di atas */ }
  }

  /** Kolom ID transaksi saja (cepat dibaca), urut sesuai baris data. */
  async function daftarId_(id) {
    const r = await GOOGLE.api(SHEETS + '/' + id + '/values/' + encodeURIComponent("'" + TABEL.transaksi.nama + "'!A2:A") + '?majorDimension=COLUMNS');
    return ((r.values || [])[0] || []).map(String);
  }

  /** input: { namaLama?, tipeLama?, nama, tipe, ikon, anggaran? } — anggaran bulanan, hanya untuk pengeluaran. */
  async function simpanKategori(input) {
    const nama = teks_(input.nama);
    const tipe = String(input.tipe);
    if (!nama) throw new Error(T('Nama kategori wajib diisi.'));
    if (tipe !== TIPE.MASUK && tipe !== TIPE.KELUAR) throw new Error(T('Tipe kategori tidak valid.'));
    const ikon = teks_(input.ikon) || '🏷️';
    const anggaran = tipe === TIPE.KELUAR ? Math.max(0, Math.round(Number(input.anggaran) || 0)) || '' : '';
    const namaLama = teks_(input.namaLama);
    const tipeLama = String(input.tipeLama || tipe);

    const id = await db_();
    const [kat, trx] = await bacaTabel_(id, ['kategori', 'transaksi']);
    const sama = (n, tp) => r => String(r[0]) === n && String(r[1]) === tp;
    const bentrok = kat.findIndex(sama(nama, tipe));

    if (namaLama) {
      const i = cariBaris_(kat, sama(namaLama, tipeLama));
      if (bentrok >= 0 && bentrok !== i) throw new Error(T('Kategori "{nama}" sudah ada.', { nama }));
      // Form yang tidak mengirim anggaran tidak boleh menghapus anggaran yang sudah ada.
      const anggaranTetap = 'anggaran' in input ? anggaran : (tipe === TIPE.KELUAR ? kat[i][3] : '');
      await tulis_(id, rangeBaris_(TABEL.kategori, i), [[nama, tipe, ikon, anggaranTetap]]);
      if (namaLama !== nama || tipeLama !== tipe) {
        const ganti = r => {
          if (String(r[4]) === namaLama && String(r[2]) === tipeLama) { r[4] = nama; r[2] = tipe; return true; }
          return false;
        };
        await gantiDiTransaksi_(id, trx, ganti);
        await gantiDiRutin_(id, ganti);
      }
    } else {
      if (bentrok >= 0) throw new Error(T('Kategori "{nama}" sudah ada.', { nama }));
      await tambahBaris_(id, TABEL.kategori, [[nama, tipe, ikon, anggaran]]);
    }
    return true;
  }

  /** peta: { "nama kategori pengeluaran": anggaran bulanan } — 0 berarti tanpa anggaran. */
  /** amplop (opsional): { "nama kategori": true } → sisa anggaran dibawa ke periode berikutnya (kolom Bawa Sisa). */
  async function simpanAnggaran(peta, amplop) {
    const id = await db_();
    const [kat] = await bacaTabel_(id, ['kategori']);
    const punya = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
    let ada = false;
    kat.forEach(r => {
      if (String(r[1]) !== TIPE.KELUAR) return;
      if (punya(peta, r[0])) { r[3] = Math.max(0, Math.round(Number(peta[r[0]]) || 0)) || ''; ada = true; }
      if (punya(amplop, r[0])) { r[4] = amplop[r[0]] ? 'Ya' : ''; ada = true; }
    });
    if (!ada) return true;
    const t = TABEL.kategori;
    await tulis_(id, "'" + t.nama + "'!A2:" + hurufKolom_(t.kolom.length) + (kat.length + 1), kat);
    return true;
  }

  async function hapusKategori(nama, tipe) {
    const id = await db_();
    const [kat, trx, rut] = await bacaTabel_(id, ['kategori', 'transaksi', 'rutin']);
    const dipakai = trx.filter(r => String(r[4]) === nama && String(r[2]) === tipe).length;
    if (dipakai) throw new Error(T('Kategori ini dipakai di {n} transaksi. Ubah dulu kategori transaksinya, atau ganti nama kategorinya saja.', { n: dipakai }));
    const rutin = rut.filter(r => String(r[4]) === nama && String(r[2]) === tipe).length;
    if (rutin) throw new Error(T('Kategori ini dipakai di {n} tagihan rutin. Ubah atau hapus dulu tagihan rutinnya.', { n: rutin }));
    await hapusBaris_(id, TABEL.kategori, cariBaris_(kat, r => String(r[0]) === nama && String(r[1]) === tipe));
    return true;
  }

  /** input: { namaLama?, nama, ikon, saldoAwal, jenis?, target?, tenggat? } — target 0 = tabungan tanpa batas. */
  async function simpanDompet(input) {
    const nama = teks_(input.nama);
    const jenis = JENIS_KHUSUS.includes(input.jenis) ? input.jenis : JENIS.DOMPET;
    if (!nama) throw new Error(jenis === JENIS.UTANG ? T('Nama orang wajib diisi.') : jenis === JENIS.TABUNGAN ? T('Nama tabungan wajib diisi.')
      : jenis === JENIS.ASET ? T('Nama aset wajib diisi.') : T('Nama dompet wajib diisi.'));
    const ikon = teks_(input.ikon) || { [JENIS.TABUNGAN]: '🐷', [JENIS.UTANG]: '🤝', [JENIS.ASET]: '💎' }[jenis] || '👛';
    const saldoAwal = Math.round(Number(input.saldoAwal) || 0);
    const namaLama = teks_(input.namaLama);
    let target = '';
    let tenggat = '';
    if (jenis === JENIS.TABUNGAN || jenis === JENIS.UTANG) {
      if (jenis === JENIS.TABUNGAN) target = Math.max(0, Math.round(Number(input.target) || 0)) || '';
      const m = teks_(input.tenggat).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (teks_(input.tenggat) && !m) throw new Error(T('Tanggal target tidak valid.'));
      if (m) tenggat = keSerial_(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    const baris = [nama, ikon, saldoAwal, jenis, target, tenggat];

    const id = await db_();
    const [dom, trx] = await bacaTabel_(id, ['dompet', 'transaksi']);
    const bentrok = dom.findIndex(r => String(r[0]) === nama);

    if (namaLama) {
      const i = cariBaris_(dom, r => String(r[0]) === namaLama);
      if (bentrok >= 0 && bentrok !== i) throw new Error(T('Dompet "{nama}" sudah ada.', { nama }));
      await tulis_(id, rangeBaris_(TABEL.dompet, i), [baris]);
      if (namaLama !== nama) {
        const ganti = r => {
          let ubah = false;
          if (String(r[5]) === namaLama) { r[5] = nama; ubah = true; }
          if (String(r[6]) === namaLama) { r[6] = nama; ubah = true; }
          return ubah;
        };
        await gantiDiTransaksi_(id, trx, ganti);
        await gantiDiRutin_(id, ganti);
      }
    } else {
      if (bentrok >= 0) throw new Error(T('Dompet "{nama}" sudah ada.', { nama }));
      await tambahBaris_(id, TABEL.dompet, [baris]);
    }
    if (jenis === JENIS.ASET) await simpanInfoEmas_(id, nama, namaLama, input.emas);
    return true;
  }

  /**
   * Detail aset emas (sheet Pengaturan, kunci EMAS, JSON { namaAset: { gram, platform, modal?, hargaBeli?, hargaJual? } }).
   * emas kosong = aset biasa (detailnya dihapus). Nama lama ikut dipindah saat aset diganti nama.
   */
  async function simpanInfoEmas_(id, nama, namaLama, emas) {
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const peta = bacaJson_(pengaturan_(set).EMAS, {});
    const sebelum = JSON.stringify(peta);
    if (namaLama && namaLama !== nama && peta[namaLama]) { peta[nama] = Object.assign({}, peta[namaLama], peta[nama]); delete peta[namaLama]; }
    const gram = Math.round(Number(emas && emas.gram) * 10000) / 10000;
    if (emas && gram > 0 && gram <= 100000) {
      const rupiah = v => Math.max(0, Math.round(Number(v) || 0)) || undefined;
      peta[nama] = { gram, platform: /^[a-z0-9]{1,20}$/.test(String(emas.platform)) ? String(emas.platform) : 'lainnya',
        modal: rupiah(emas.modal), hargaBeli: rupiah(emas.hargaBeli), hargaJual: rupiah(emas.hargaJual),
        riwayat: ((peta[nama] || peta[namaLama] || {}).riwayat) || undefined };
    } else if (emas) {
      throw new Error(T('Isi berat emasnya dalam gram (lebih dari 0).'));
    } else {
      delete peta[nama];
    }
    const sesudah = JSON.stringify(peta);
    if (sesudah !== sebelum) await simpanPengaturan_(id, set, 'EMAS', sesudah);
  }

  async function hapusDompet(nama) {
    const id = await db_();
    const [dom, trx, rut] = await bacaTabel_(id, ['dompet', 'transaksi', 'rutin']);
    const dipakai = trx.filter(r => String(r[5]) === nama || String(r[6]) === nama).length;
    if (dipakai) throw new Error(T('Dompet ini dipakai di {n} transaksi, jadi tidak bisa dihapus.', { n: dipakai }));
    const rutin = rut.filter(r => String(r[5]) === nama || String(r[6]) === nama).length;
    if (rutin) throw new Error(T('Dompet ini dipakai di {n} tagihan rutin. Ubah atau hapus dulu tagihan rutinnya.', { n: rutin }));
    await hapusBaris_(id, TABEL.dompet, cariBaris_(dom, r => String(r[0]) === nama));
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const emas = bacaJson_(pengaturan_(set).EMAS, {});
    if (emas[nama]) { delete emas[nama]; await simpanPengaturan_(id, set, 'EMAS', JSON.stringify(emas)); }
    return true;
  }

  // ---------- Patungan ----------

  /**
   * Kita membayar dulu untuk bersama. Bagian kita dicatat sebagai pengeluaran; bagian tiap orang dicatat
   * sebagai piutang (uang keluar dari dompet yang sama ke orang itu), jadi total keluar dompet = total tagihan.
   * input: { total, bagianSaya, kategori, dompet, tanggal, catatan, peserta: [{ nama, jumlah }] }
   */
  async function catatPatungan(input) {
    const peserta = (input.peserta || []).map(p => ({ nama: teks_(p.nama), jumlah: Math.round(Number(p.jumlah) || 0) }))
      .filter(p => p.nama && p.jumlah > 0);
    const bagianSaya = Math.max(0, Math.round(Number(input.bagianSaya) || 0));
    if (!peserta.length) throw new Error(T('Tambahkan minimal satu orang yang ikut patungan.'));
    const nama = peserta.map(p => p.nama.toLowerCase());
    if (new Set(nama).size !== nama.length) throw new Error(T('Ada nama yang dobel.'));
    if (peserta.reduce((a, p) => a + p.jumlah, 0) + bagianSaya !== Math.round(Number(input.total) || 0)) {
      throw new Error(T('Jumlah semua bagian belum sama dengan total.'));
    }
    // Periksa semuanya dulu, supaya tidak ada yang tercatat setengah jalan.
    validasiTransaksi_({ tipe: TIPE.TRANSFER, jumlah: 1, dompet: input.dompet, dompetTujuan: '_', tanggal: input.tanggal });
    if (bagianSaya) validasiTransaksi_({ tipe: TIPE.KELUAR, jumlah: bagianSaya, kategori: input.kategori, dompet: input.dompet, tanggal: input.tanggal });
    const [dom] = await bacaTabel_(await db_(), ['dompet']);
    const bentrok = peserta.find(p => dom.some(r => String(r[0]).toLowerCase() === p.nama.toLowerCase() && String(r[3]) !== JENIS.UTANG));
    if (bentrok) throw new Error(T('Nama "{nama}" sudah dipakai dompet/tabungan. Pakai nama lain, mis. "{nama} (teman)".', { nama: bentrok.nama }));

    const catatan = teks_(input.catatan);
    if (bagianSaya) {
      await simpanTransaksi({ tipe: TIPE.KELUAR, jumlah: bagianSaya, kategori: input.kategori, dompet: input.dompet, tanggal: input.tanggal,
        catatan: catatan ? catatan + ' (bagian saya, patungan)' : 'Bagian saya, patungan' });
    }
    for (const p of peserta) {
      await catatUtang({ nama: p.nama, arah: 'piutang', jumlah: p.jumlah, dompet: input.dompet, tanggal: input.tanggal,
        catatan: 'Patungan' + (catatan ? ': ' + catatan : '') });
    }
    return true;
  }

  // ---------- Utang & piutang ----------

  /**
   * Mencatat pinjaman. arah 'piutang' = kita meminjamkan (uang keluar dari `dompet` ke orang itu),
   * 'utang' = kita meminjam (uang masuk dari orang itu ke `dompet`). Orang baru otomatis dibuatkan barisnya.
   * input: { nama, arah, jumlah, dompet, tanggal, tenggat?, catatan? }
   */
  async function catatUtang(input) {
    const nama = teks_(input.nama).slice(0, 40);
    if (!nama) throw new Error(T('Isi nama orangnya.'));
    if (!['piutang', 'utang'].includes(input.arah)) throw new Error(T('Pilih: meminjamkan atau meminjam.'));
    const id = await db_();
    const [dom] = await bacaTabel_(id, ['dompet']);
    const ada = dom.find(r => String(r[0]).toLowerCase() === nama.toLowerCase());
    if (ada && String(ada[3]) !== JENIS.UTANG) {
      throw new Error(T('Nama "{lama}" sudah dipakai dompet/tabungan. Pakai nama lain, mis. "{nama} (teman)".', { lama: ada[0], nama }));
    }
    const orang = ada ? String(ada[0]) : nama;
    const keOrang = input.arah === 'piutang';
    const trx = {
      tipe: TIPE.TRANSFER, jumlah: input.jumlah, tanggal: input.tanggal, catatan: input.catatan,
      dompet: keOrang ? input.dompet : orang, dompetTujuan: keOrang ? orang : input.dompet,
    };
    validasiTransaksi_(trx); // periksa dulu sebelum membuat baris orang baru
    if (!ada) {
      await simpanDompet({ nama: orang, jenis: JENIS.UTANG, saldoAwal: 0, tenggat: input.tenggat });
    } else if (teks_(input.tenggat)) {
      await simpanDompet({ namaLama: orang, nama: orang, jenis: JENIS.UTANG, ikon: String(ada[1]), saldoAwal: Number(ada[2]) || 0, tenggat: input.tenggat });
    }
    return simpanTransaksi(trx);
  }

  // ---------- Kunci API Gemini (sheet Pengaturan) ----------

  async function tambahKunciGemini(kunci) {
    kunci = teks_(kunci);
    if (!/^[\w-]{20,}$/.test(kunci)) throw new Error(T('Format kunci API tidak valid.'));
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const daftar = kunciGemini_(set);
    if (daftar.includes(kunci)) throw new Error(T('Kunci API ini sudah ada.'));
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
    if (i < 0) throw new Error(T('Kunci API tidak ditemukan. Coba muat ulang.'));
    daftar.splice(i, 1);
    await simpanPengaturan_(id, set, 'GEMINI_API_KEYS', JSON.stringify(daftar));
    return true;
  }

  function pengaturan_(rows) {
    const p = {};
    rows.forEach(r => { if (r[0] !== '') p[String(r[0])] = String(r[1]); });
    return p;
  }

  /** Avatar per anggota dari kunci "AVATAR:<email>": { email: { p } | { f } }. */
  function avatar_(rows) {
    const p = pengaturan_(rows), hasil = {};
    Object.keys(p).forEach(k => {
      if (!k.startsWith('AVATAR:')) return;
      const v = bacaJson_(p[k], null);
      if (v && (v.p || v.f)) hasil[k.slice(7)] = v;
    });
    return hasil;
  }

  /** nilai: { p: id gambar bawaan } | { f: data URL JPEG/PNG/WebP ≤ 45.000 karakter } | null (hapus). */
  async function simpanAvatar(nilai) {
    let isi = '';
    if (nilai && typeof nilai.p === 'string' && /^[a-z]{1,20}$/.test(nilai.p)) isi = JSON.stringify({ p: nilai.p });
    else if (nilai && typeof nilai.f === 'string' && nilai.f.length <= 45000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(nilai.f)) isi = JSON.stringify({ f: nilai.f });
    else if (nilai) throw new Error(T('Gambar avatar tidak valid atau terlalu besar.'));
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    await simpanPengaturan_(id, set, 'AVATAR:' + GOOGLE.email(), isi);
    return true;
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

  // ---------- Bot Telegram (sheet Pengaturan, dibaca juga oleh bot di folder bot/) ----------

  function bacaJson_(teks, cadangan) {
    try { return JSON.parse(teks || '') || cadangan; } catch (e) { return cadangan; }
  }

  /**
   * Bot bersama (web/assets/config.js: botTelegram + emailBot): satu bot untuk semua pengguna. Spreadsheet
   * dibagikan ke email akun robot bot saat menghubungkan. Tanpa itu: bot khusus pemilik (SPREADSHEET_ID).
   */
  function botBersama_() {
    const k = typeof KONFIG !== 'undefined' ? KONFIG : {};
    return k.botTelegram && k.emailBot ? { nama: k.botTelegram, email: String(k.emailBot).toLowerCase() } : null;
  }

  function infoTelegram_(rows) {
    const p = pengaturan_(rows);
    const pengguna = bacaJson_(p.TELEGRAM_PENGGUNA, {});
    const bersama = botBersama_();
    return {
      bot: (bersama && bersama.nama) || p.TELEGRAM_BOT || '',
      bersama: !!bersama,
      pengguna: Object.keys(pengguna).map(id => Object.assign({ id }, pengguna[id])),
      pengingat: p.PENGINGAT_TELEGRAM !== 'Mati', // pengingat harian dari bot (lihat bot/Kode.gs → kirimPengingatHarian)
      rekap: p.REKAP_TELEGRAM !== 'Mati',          // rekap bulanan di awal periode
    };
  }

  /** ID izin Drive akun robot di spreadsheet ini, atau '' kalau belum dibagikan. */
  async function izinRobot_(id, email) {
    const r = await GOOGLE.api(DRIVE + '/files/' + id + '/permissions?fields=permissions(id,emailAddress)');
    const p = (r.permissions || []).find(x => String(x.emailAddress || '').toLowerCase() === email);
    return p ? p.id : '';
  }

  /** Membagikan spreadsheet (Editor, tanpa email) ke akun robot bot bersama, kalau belum. */
  async function bagikanKeRobot_(id) {
    const bot = botBersama_();
    if (!bot || await izinRobot_(id, bot.email)) return;
    try {
      await GOOGLE.api(DRIVE + '/files/' + id + '/permissions?sendNotificationEmail=false', {
        method: 'POST', json: { type: 'user', role: 'writer', emailAddress: bot.email },
      });
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        throw new Error(T('Spreadsheet ini tidak bisa dibagikan ke bot dari akun Anda. Minta pemilik spreadsheet menghubungkan bot lebih dulu.'));
      }
      throw e;
    }
  }

  /** Akun Telegram terakhir di buku ini diputus → akses akun robot dicabut. Gagal diabaikan. */
  async function cabutRobotKalauKosong_(id, pengguna) {
    const bot = botBersama_();
    if (!bot || Object.keys(pengguna).length) return;
    try {
      const idIzin = await izinRobot_(id, bot.email);
      if (idIzin) await GOOGLE.api(DRIVE + '/files/' + id + '/permissions/' + idIzin, { method: 'DELETE' });
    } catch (e) { /* bot tetap ditolak karena TELEGRAM_PENGGUNA sudah kosong */ }
  }

  /** Kode 6 karakter, berlaku 15 menit, untuk menautkan akun Telegram ke akun Google yang sedang login. */
  async function buatKodeTelegram() {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const p = pengaturan_(set);
    const daftar = bacaJson_(p.TELEGRAM_KODE, {});
    Object.keys(daftar).forEach(k => { if (daftar[k].sampai < Date.now()) delete daftar[k]; });
    const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const acak = crypto.getRandomValues(new Uint8Array(6));
    const kode = Array.from(acak, b => huruf[b % huruf.length]).join('');
    daftar[kode] = { email: GOOGLE.email(), sampai: Date.now() + 15 * 60 * 1000 };
    await bagikanKeRobot_(id);
    await simpanPengaturan_(id, set, 'TELEGRAM_KODE', JSON.stringify(daftar));
    // Bot bersama perlu tahu spreadsheet-nya: /start <ID spreadsheet>_<kode> (maks. 64 karakter, cukup).
    return { kode, muatan: botBersama_() ? id + '_' + kode : kode };
  }

  async function putuskanTelegram(idTelegram) {
    const id = await db_();
    const [set] = await bacaTabel_(id, ['pengaturan']);
    const pengguna = bacaJson_(pengaturan_(set).TELEGRAM_PENGGUNA, {});
    delete pengguna[idTelegram];
    await simpanPengaturan_(id, set, 'TELEGRAM_PENGGUNA', JSON.stringify(pengguna));
    await cabutRobotKalauKosong_(id, pengguna);
    return true;
  }

  // ---------- Memahami kalimat suara dengan Gemini ----------

  let kunciAi = [];   // kunci Gemini asli, diingat saat getData (yang dikirim ke tampilan hanya versi samaran)
  let modelAi = '';

  /**
   * Kalimat lisan → { transaksi: [{ tipe, jumlah, kategori, dompet, dompetTujuan, tanggal, catatan }] } (bisa lebih dari satu).
   * konteks: { hariIni 'yyyy-mm-dd', kategori: [{nama, tipe}], dompet: [nama], tabungan: [nama] }.
   * null kalau belum ada kunci Gemini. Hasil tetap divalidasi lagi di aplikasi.
   */
  async function pahamiKalimat(teks, konteks) {
    if (!kunciAi.length) {
      const [set] = await bacaTabel_(await db_(), ['pengaturan']);
      kunciAi = kunciGemini_(set);
      modelAi = pengaturan_(set).GEMINI_MODEL;
    }
    if (!kunciAi.length) return null;
    const hari = new Date(konteks.hariIni + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const daftar = tipe => konteks.kategori.filter(k => k.tipe === tipe).map(k => k.nama).join(', ') || '-';
    const prompt = [
      'Kamu membantu mencatat keuangan keluarga Indonesia. Ubah kalimat lisan di bawah menjadi daftar transaksi.',
      'Satu kalimat bisa berisi beberapa transaksi ("bakso 25rb, parkir 5rb, bensin 30rb pakai gopay" = 3 transaksi). Maksimal 8.',
      'Dompet atau tanggal yang disebut sekali berlaku untuk semua transaksi di kalimat itu, kecuali disebut lain.',
      'Hari ini ' + hari + ' (' + konteks.hariIni + ').',
      'Aturan:',
      '- tipe: "Pengeluaran", "Pemasukan", atau "Transfer" (memindahkan uang antar dompet sendiri, termasuk setor/tarik tabungan, top up e-wallet, tarik tunai).',
      '- jumlah: rupiah, bilangan bulat tanpa titik. "dua puluh lima ribu"=25000, "1,5 juta"/"satu setengah juta"=1500000, "sejuta"=1000000,',
      '  gopek=500, seceng=1000, goceng=5000, ceban=10000, gocap=50000, cepek=100000. Isi 0 kalau tidak disebut.',
      '- kategori: salin persis salah satu dari daftar sesuai tipe. Kosongkan untuk Transfer atau kalau tidak cocok.',
      '- dompet: salin persis dari daftar dompet. Pengeluaran = dompet pembayar, Pemasukan = dompet penerima, Transfer = dompet asal. Kosongkan kalau tidak disebut.',
      '- dompetTujuan: hanya untuk Transfer, salin persis dari daftar dompet atau tabungan. Selain itu kosong.',
      '- tanggal: yyyy-mm-dd, hitung dari hari ini. "kemarin" = 1 hari lalu; "Sabtu minggu lalu" = hari Sabtu di minggu sebelumnya (minggu = Senin–Minggu);',
      '  "Sabtu lalu" = Sabtu terakhir sebelum hari ini; "tanggal 1 bulan kemarin" = tanggal 1 bulan sebelumnya; "tanggal 3" = tanggal 3 bulan ini (atau bulan lalu kalau belum lewat).',
      '  Kalau tidak disebut, pakai hari ini.',
      '- catatan: deskripsi singkat 1–5 kata untuk apa (huruf besar di awal), tanpa nominal, nama dompet, atau kata waktu. Kosong kalau tidak ada.',
      'Kategori Pengeluaran: ' + daftar('Pengeluaran'),
      'Kategori Pemasukan: ' + daftar('Pemasukan'),
      'Dompet: ' + (konteks.dompet.join(', ') || '-'),
      'Tabungan: ' + (konteks.tabungan.join(', ') || '-'),
      'Kalimat: "' + String(teks).slice(0, 400).replace(/"/g, "'") + '"',
    ].join('\n');
    const item = {
      type: 'OBJECT',
      properties: {
        tipe: { type: 'STRING', enum: ['Pengeluaran', 'Pemasukan', 'Transfer'] },
        jumlah: { type: 'INTEGER' },
        kategori: { type: 'STRING' },
        dompet: { type: 'STRING' },
        dompetTujuan: { type: 'STRING' },
        tanggal: { type: 'STRING' },
        catatan: { type: 'STRING' },
      },
      required: ['tipe', 'jumlah', 'kategori', 'dompet', 'dompetTujuan', 'tanggal', 'catatan'],
    };
    const skema = { type: 'OBJECT', properties: { transaksi: { type: 'ARRAY', items: item } }, required: ['transaksi'] };
    return STRUK.tanyaAI([{ text: prompt }], skema, kunciAi, modelAi);
  }

  /**
   * Ringkasan Laporan satu periode dalam 2–4 kalimat, ditulis AI dari angka ringkasan (bukan daftar transaksi).
   * null kalau belum ada kunci Gemini. bahasa: 'id' | 'en'.
   */
  async function ringkasLaporan(fakta, bahasa) {
    if (!kunciAi.length) {
      const [set] = await bacaTabel_(await db_(), ['pengaturan']);
      kunciAi = kunciGemini_(set);
      modelAi = pengaturan_(set).GEMINI_MODEL;
    }
    if (!kunciAi.length) return null;
    const prompt = [
      bahasa === 'en'
        ? 'You help an Indonesian family understand their finances. Write in plain, warm English.'
        : 'Kamu membantu keluarga Indonesia memahami keuangannya. Tulis dalam bahasa Indonesia yang santai dan hangat.',
      'Dari data ringkasan di bawah, tulis 2–4 kalimat pendek: apa yang paling menonjol periode ini, penyebab yang paling mungkin',
      '(sebut kategori, hari, atau transaksi yang relevan beserta nominalnya), lalu satu saran praktis.',
      'Jangan mengarang angka yang tidak ada di data. Kalau periode masih berjalan, jangan menyimpulkan seolah sudah selesai.',
      'Nominal ditulis seperti Rp25.000. Tanpa salam pembuka, tanpa daftar berpoin, tanpa markdown.',
      'Data (JSON): ' + JSON.stringify(fakta).slice(0, 6000),
    ].join('\n');
    const skema = { type: 'OBJECT', properties: { ringkasan: { type: 'STRING' } }, required: ['ringkasan'] };
    const r = await STRUK.tanyaAI([{ text: prompt }], skema, kunciAi, modelAi);
    return r && r.ringkasan ? String(r.ringkasan).trim() : null;
  }

  /** Pendapat AI untuk "Cek sebelum beli": fakta = angka yang sudah dihitung aplikasi. null kalau tanpa kunci Gemini. */
  async function saranBeli(fakta, bahasa, santai) {
    if (!kunciAi.length) {
      const [set] = await bacaTabel_(await db_(), ['pengaturan']);
      kunciAi = kunciGemini_(set);
      modelAi = pengaturan_(set).GEMINI_MODEL;
    }
    if (!kunciAi.length) return null;
    const prompt = [
      bahasa === 'en'
        ? 'You are a friendly money coach for young Indonesian adults and newly married couples. Write in plain, warm English.'
        : santai
          ? 'Kamu teman yang paham keuangan untuk anak muda & pasangan baru di Indonesia. Tulis dalam bahasa Indonesia santai (pakai "kamu"), hangat, tidak menggurui.'
          : 'Anda penasihat keuangan yang ramah untuk anak muda & pasangan baru di Indonesia. Tulis dalam bahasa Indonesia yang sopan dan hangat (pakai "Anda").',
      'Seseorang ingin membeli barang di bawah ini. Dari data, tulis 2–3 kalimat pendek: layak dibeli sekarang atau tidak, alasannya',
      '(pakai angka dari data), lalu satu saran praktis (mis. tunggu gajian, menabung dulu, cari yang lebih murah, hindari paylater/cicilan berbunga).',
      'Jangan mengarang angka yang tidak ada di data. Nominal ditulis seperti Rp25.000. Tanpa salam pembuka, tanpa daftar berpoin, tanpa markdown.',
      'Data (JSON): ' + JSON.stringify(fakta).slice(0, 4000),
    ].join('\n');
    const skema = { type: 'OBJECT', properties: { saran: { type: 'STRING' } }, required: ['saran'] };
    const r = await STRUK.tanyaAI([{ text: prompt }], skema, kunciAi, modelAi);
    return r && r.saran ? String(r.saran).trim() : null;
  }

  // ---------- Baca struk ----------

  /** tambahan (opsional): { base64Ai, kabar } — lihat STRUK.baca. */
  async function bacaStruk(base64, mime, tambahan) {
    // Pengaturan dibaca bersamaan dengan OCR (STRUK.baca langsung mulai OCR), tidak bergantian.
    const opsi = db_().then(id => bacaTabel_(id, ['kategori', 'pengaturan'])).then(([kat, set]) => ({
      kategori: kat.filter(r => r[0] !== '' && String(r[1]) === TIPE.KELUAR).map(r => String(r[0])),
      kunci: kunciGemini_(set),
      model: pengaturan_(set).GEMINI_MODEL,
    }));
    return STRUK.baca(base64, mime, opsi, tambahan);
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

  /**
   * Mengganti nama kategori/dompet di transaksi. Hanya baris yang berubah yang ditulis, dan posisinya
   * dicari ulang lewat ID sesaat sebelum menulis, jadi transaksi yang baru ditambah/dihapus orang lain aman.
   */
  async function gantiDiTransaksi_(id, rows, ubahBaris) {
    const berubah = rows.filter(r => ubahBaris(r));
    if (!berubah.length) return;
    const t = TABEL.transaksi;
    const posisi = {};
    (await daftarId_(id)).forEach((x, i) => { posisi[x] = i; });
    const data = berubah.filter(r => String(r[0]) in posisi)
      .map(r => ({ range: rangeBaris_(t, posisi[String(r[0])]), values: [r] }));
    if (data.length) await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
  }

  /** Sama seperti gantiDiTransaksi_, untuk sheet Rutin (posisi kolom Tipe/Kategori/Dompet/Tujuan sama). */
  async function gantiDiRutin_(id, ubahBaris) {
    const [rows] = await bacaTabel_(id, ['rutin']);
    const data = [];
    rows.forEach((r, i) => { if (ubahBaris(r)) data.push({ range: rangeBaris_(TABEL.rutin, i), values: [r] }); });
    if (data.length) await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
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
        lampiran: String(r[11] || ''),
      })),
      kategori: kat.filter(r => r[0] !== '').map(r => ({
        nama: String(r[0]), tipe: String(r[1]), ikon: String(r[2]), anggaran: Number(r[3]) || 0, bawaSisa: String(r[4]) === 'Ya',
      })),
      dompet: dom.filter(r => r[0] !== '').map(r => ({
        nama: String(r[0]),
        ikon: String(r[1]),
        saldoAwal: Number(r[2]) || 0,
        jenis: JENIS_KHUSUS.includes(String(r[3])) ? String(r[3]) : JENIS.DOMPET,
        target: Number(r[4]) || 0,
        tenggat: r[5] === '' ? '' : dariSerial_(r[5]).slice(0, 10),
      })),
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

/**
   * Aturan jenis dompet (dibaca dari sheet Dompet & Pengaturan EMAS):
   *  - Pemasukan/pengeluaran hanya dari dompet biasa atau tabungan (bukan aset, bukan orang utang-piutang).
   *  - Emas dicatat dalam gram, jadi tidak boleh ikut transfer rupiah biasa; tambah/kurangi lewat mutasiEmas
   *    (izinEmas). Transaksi emas yang sudah ada juga tidak boleh diubah (hapus → gramnya dikembalikan).
   */
  async function cekJenisDompet_(id, t, opsi = {}) {
    const [dom, set] = await bacaTabel_(id, ['dompet', 'pengaturan']);
    const jenis = {};
    dom.forEach(r => { if (r[0] !== '') jenis[String(r[0])] = String(r[3]) || JENIS.DOMPET; });
    const emas = bacaJson_(pengaturan_(set).EMAS, {});
    const adalahEmas = n => !!emas[n] && jenis[n] === JENIS.ASET;
    const pesanEmas = T('Emas dicatat dalam gram, jadi tidak bisa ditransfer seperti uang. Buka emasnya di Dompet, lalu pakai Tambah gram / Kurangi gram.');
    if (t.tipe === TIPE.TRANSFER) {
      if ((adalahEmas(t.dompet) || adalahEmas(t.dompetTujuan)) && !opsi.izinEmas) throw new Error(pesanEmas);
    } else {
      const j = jenis[t.dompet];
      if (j === JENIS.ASET || j === JENIS.UTANG) {
        throw new Error(j === JENIS.ASET ? T('Pemasukan/pengeluaran tidak bisa dicatat di aset. Pakai dompet atau tabungan.')
          : T('Pemasukan/pengeluaran tidak bisa dicatat di orang utang-piutang. Pakai dompet atau tabungan.'));
      }
    }
    return { adalahEmas, emas, set };
  }

  function validasiTransaksi_(x) {
    x = x || {};
    const tipe = String(x.tipe);
    if (![TIPE.MASUK, TIPE.KELUAR, TIPE.TRANSFER].includes(tipe)) throw new Error(T('Tipe transaksi tidak valid.'));
    const jumlah = Math.round(Number(x.jumlah));
    if (!(jumlah > 0)) throw new Error(T('Jumlah harus lebih dari 0.'));
    const m = String(x.tanggal || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error(T('Tanggal tidak valid.'));
    const dompet = teks_(x.dompet);
    if (!dompet) throw new Error(T('Pilih dompet.'));
    const dompetTujuan = tipe === TIPE.TRANSFER ? teks_(x.dompetTujuan) : '';
    if (tipe === TIPE.TRANSFER && (!dompetTujuan || dompetTujuan === dompet)) throw new Error(T('Pilih dompet tujuan yang berbeda.'));
    const kategori = tipe === TIPE.TRANSFER ? '' : teks_(x.kategori);
    if (tipe !== TIPE.TRANSFER && !kategori) throw new Error(T('Pilih kategori.'));

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
    if (i < 0) throw new Error(T('Data tidak ditemukan. Mungkin sudah diubah atau dihapus orang lain — coba muat ulang.'));
    return i;
  }

  function teks_(v) {
    return String(v == null ? '' : v).trim();
  }

  function tambah_(obj, kunci, n) {
    if (kunci) obj[kunci] = (obj[kunci] || 0) + n;
  }

  return {
    getData, buatDatabase, hubungkanDatabase, lupakanDatabase, bagikanKe, daftarAnggota, keluarkanAnggota, buatBuku, lupakanBuku, hapusBuku, tambahBuku,
    simpanTransaksi, hapusTransaksi, kembalikanTransaksi, ubahBanyak, hapusBanyak, kembalikanBanyak, simpanAnggaranLabel, simpanKategori, hapusKategori, simpanAnggaran, simpanDompet, hapusDompet,
    simpanRutin, hapusRutin, majukanRutin, simpanCatatan, aturCatatan, hapusCatatan, kembalikanCatatan, tanggalBerikut: tanggalBerikut_, catatUtang, catatPatungan,
    simpanMulaiPeriode, simpanAvatar, mutasiEmas, simpanHargaEmas, catatGalat, riwayatHarga, cadangkan, aturPengingatTelegram, aturRekapTelegram, periodeDari: periodeDari_, rentangPeriode: rentangPeriode_, cariTransaksi,
    tambahKunciGemini, hapusKunciGemini, bacaStruk, pahamiKalimat, ringkasLaporan, saranBeli, ubahTantangan, ambilLampiran, buatKodeTelegram, putuskanTelegram,
    uji: { keSerial_, dariSerial_, validasiTransaksi_, olahData_, jejak_ },
  };
})();
