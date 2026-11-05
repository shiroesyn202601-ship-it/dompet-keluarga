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
    // Ulang: '' | Mingguan | Bulanan | Tahunan. Warna: kunci warna di kalender (lihat WARNA_CATATAN di app.js).
    catatan: {
      nama: 'Catatan',
      kolom: ['ID', 'Tanggal', 'Judul', 'Isi', 'Pengingat', 'Ulang', 'Warna', 'Dibuat Oleh', 'Dibuat Pada'],
    },
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
   * config.json di appDataFolder: { spreadsheetId (buku aktif), buku: [{ id, nama }], folderStruk }.
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
        throw new Error('Spreadsheet ini bukan database Dompet Keluarga (sheet "' + TABEL[k].nama + '" tidak ada).');
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
        const err = new Error('Aplikasi belum diizinkan membuka spreadsheet Dompet Keluarga dengan akun ' + GOOGLE.email() +
          '. Ketuk "Pilih spreadsheet", lalu pilih file Dompet Keluarga. Kalau file-nya tidak muncul, berarti akun ini belum diundang: minta pemilik mengundang dari ⚙️ → Undang anggota keluarga.');
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
    for (const t of [TABEL.pengaturan, TABEL.rutin, TABEL.catatan]) {
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
      } catch (e) {
        // Sheet tambahan yang lebih baru (Catatan) tidak wajib: anggota "hanya lihat" tetap bisa membuka buku.
        if (t !== TABEL.catatan) throw e;
        console.warn('Sheet Catatan tidak bisa dibuat:', e);
      }
    }

    await lindungiSheet_(id);

    const q = [TABEL.kategori, TABEL.dompet, TABEL.transaksi].map(x => 'ranges=' + encodeURIComponent("'" + x.nama + "'!A1:Z1")).join('&');
    const [kat, dom, trx] = (await GOOGLE.api(SHEETS + '/' + id + '/values:batchGet?' + q)).valueRanges.map(v => (v.values || [[]])[0]);
    const data = [];
    const format = [];
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
    if (!id) throw new Error('Spreadsheet belum dipilih. Muat ulang aplikasi.');
    if (!idSheet) {
      idSheet = await bacaIdSheet_(id);
      await pastikanStruktur_(id);
    }
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
    if (anggota && !POLA_EMAIL.test(anggota)) throw new Error('Format email anggota keluarga tidak valid.');
    const barisDompet = [];
    (dompet || []).forEach(w => {
      const nama = teks_(w.nama).slice(0, 40);
      if (!nama) return;
      if (barisDompet.some(r => r[0].toLowerCase() === nama.toLowerCase())) throw new Error('Dompet "' + nama + '" dobel.');
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
    if (!m) throw new Error('Link spreadsheet tidak dikenali. Salin link dari address bar saat spreadsheet terbuka.');
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
    if (!(c.buku || []).some(b => b.id === idBuku)) throw new Error('Buku ini tidak ada di daftar buku Anda.');
    return idBuku;
  }

  /** Memberi akses Editor ke anggota keluarga, lalu Google mengirim email berisi link undangan. idBuku kosong = buku aktif. */
  async function bagikanKe(email, idBuku) {
    email = teks_(email);
    if (!POLA_EMAIL.test(email)) throw new Error('Format email tidak valid.');
    await bagikan_(await idBuku_(idBuku), email);
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
        throw new Error('Spreadsheet ini tidak bisa dibagikan dari aplikasi (mungkin dibuat di luar aplikasi, atau Anda bukan pemiliknya). Bagikan manual: buka spreadsheet → Bagikan → isi email → Editor. Lalu kirim link undangan dari menu ini.');
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
    if (email && email === String(GOOGLE.email() || '').toLowerCase()) throw new Error('Tidak bisa mengeluarkan akun sendiri.');
    try {
      await GOOGLE.api(DRIVE + '/files/' + id + '/permissions/' + encodeURIComponent(idIzin), { method: 'DELETE' });
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        throw new Error('Akses anggota ini tidak bisa dicabut dari akun Anda (biasanya hanya pemilik spreadsheet yang bisa). Minta pemiliknya, atau buka spreadsheet → Bagikan.');
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
    const [trx, kat, dom, set, rut, cat] = await bacaTabel_(id, ['transaksi', 'kategori', 'dompet', 'pengaturan', 'rutin'].concat(adaCatatan ? ['catatan'] : []));
    const d = olahData_(trx, kat, dom);
    const mulai = mulaiPeriode_(set);
    if (!/^\d{4}-\d{2}$/.test(bulan || '')) bulan = periodeDari_(tanggalLokal_(), mulai);

    const saldo = {};
    const jenis = {};
    d.dompet.forEach(w => { saldo[w.nama] = w.saldoAwal; jenis[w.nama] = w.jenis; });

    // Ringkasan per periode untuk laporan: { 'yyyy-mm': { masuk, keluar, ditabung, kategori: {nama: n}, oleh: {email: n} } }
    const bulanan = {};
    d.transaksi.forEach(t => {
      const b = periodeDari_(t.tanggal, mulai);
      const r = bulanan[b] || (bulanan[b] = { masuk: 0, keluar: 0, ditabung: 0, kategori: {}, oleh: {} });
      if (t.tipe === TIPE.MASUK) {
        tambah_(saldo, t.dompet, t.jumlah);
        r.masuk += t.jumlah;
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
      kunciGemini: kunciGemini_(set).map(samarkanKunci_),
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
      cepat: kebiasaan_(d.transaksi),
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

  async function simpanMulaiPeriode(n) {
    n = Math.round(Number(n));
    if (!(n >= 1 && n <= 28)) throw new Error('Pilih tanggal 1 sampai 28.');
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
    })).filter(c => /^\d{4}-\d{2}-\d{2}$/.test(c.tanggal));
  }

  /** input: { id?, tanggal 'yyyy-mm-dd', judul, isi, pengingat (bool), ulang, warna }. */
  async function simpanCatatan(input) {
    const judul = teks_(input.judul).slice(0, 80);
    if (!judul) throw new Error('Isi judul catatannya dulu.');
    const tanggal = teks_(input.tanggal);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error('Pilih tanggalnya dulu.');
    const ulang = ULANG_CATATAN.includes(String(input.ulang || '')) ? String(input.ulang || '') : '';
    const id = await db_();
    if (!(TABEL.catatan.nama in idSheet)) throw new Error('Buku ini belum bisa menyimpan catatan (butuh akses Editor ke spreadsheet).');
    const idCatatan = teks_(input.id) || crypto.randomUUID();
    const baris = [idCatatan, serialTanggal_(tanggal), judul, teks_(input.isi).slice(0, 2000), input.pengingat ? 'Ya' : '', ulang,
      teks_(input.warna).slice(0, 12), GOOGLE.email(), serialSekarang_()];
    const [rows] = await bacaTabel_(id, ['catatan']);
    const i = input.id ? rows.findIndex(r => String(r[0]) === idCatatan) : -1;
    if (i >= 0) {
      baris[7] = rows[i][7] || baris[7]; // pencatat & waktu dibuat tidak berubah saat diubah
      baris[8] = rows[i][8] || baris[8];
      await tulis_(id, rangeBaris_(TABEL.catatan, i), [baris]);
    } else {
      await tambahBaris_(id, TABEL.catatan, [baris]);
    }
    return idCatatan;
  }

  async function hapusCatatan(idCatatan) {
    const id = await db_();
    const [rows] = await bacaTabel_(id, ['catatan']);
    await hapusBaris_(id, TABEL.catatan, cariBaris_(rows, r => String(r[0]) === String(idCatatan)));
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
    const nama = teks_(input.nama).slice(0, 60) || t.catatan || t.kategori || 'Transfer';
    const ulang = String(input.ulang);
    if (!ULANG.includes(ulang)) throw new Error('Pilih jarak pengulangan.');
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
    if (t.id) {
      // Baris dicari lewat ID sesaat sebelum menulis, dan hanya kolom yang berubah yang ditulis
      // (Dibuat Oleh/Pada tidak disentuh), supaya perubahan orang lain di saat bersamaan tidak tertimpa.
      // Foto diunggah dulu, supaya baris tidak bergeser selama menunggu unggahan.
      const lampiran = input.lampiranData ? await unggahStruk_(input.lampiranData, input.tanggal) : null;
      const baris = cariBaris_(await daftarId_(id), x => x === t.id) + 2;
      const lampiranLama = lampiran || input.hapusLampiran ? (await bacaBarisTransaksi_(id, baris))[11] : '';
      const data = [
        { range: "'" + tbl.nama + "'!B" + baris + ':H' + baris, values: [[t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan]] },
        { range: "'" + tbl.nama + "'!K" + baris, values: [[sekarang]] },
      ];
      if (lampiran || input.hapusLampiran) data.push({ range: "'" + tbl.nama + "'!L" + baris, values: [[lampiran || '']] });
      await GOOGLE.api(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data } });
      if (lampiranLama && lampiranLama !== lampiran) await buangLampiran_(lampiranLama); // foto lama diganti/dihapus
    } else {
      t.id = teks_(input.idBaru) || crypto.randomUUID();
      if (input.idBaru && (await daftarId_(id)).includes(t.id)) return t.id;
      const lampiran = input.lampiranData ? await unggahStruk_(input.lampiranData, input.tanggal) : '';
      await tambahBaris_(id, tbl, [[
        t.id, t.tanggal, t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, GOOGLE.email(), sekarang, sekarang, lampiran,
      ]]);
      if (input.dariRutin) await majukanRutin(input.dariRutin);
      if (ULANG.includes(input.ulang)) {
        const tgl = String(input.tanggal);
        await simpanRutin(Object.assign({}, input, { id: '', nama: '', berikutnya: tanggalBerikut_(tgl, tgl, input.ulang) }));
      }
    }
    return t.id;
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
    if (!nama) throw new Error('Isi nama bukunya, mis. Usaha atau Pribadi.');
    await buatDatabase('', [{ nama: 'Tunai', ikon: '💵', saldoAwal: 0 }], nama);
    return true;
  }

  /** Menghapus buku dari daftar di akun ini (spreadsheet-nya sendiri tidak dihapus). */
  async function lupakanBuku(id) {
    if (id === dbId) throw new Error('Buku yang sedang dibuka tidak bisa dilupakan. Pindah ke buku lain dulu.');
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
    if (id === dbId) throw new Error('Buku yang sedang dibuka tidak bisa dihapus. Pindah ke buku lain dulu.');
    await idBuku_(id);
    const f = await GOOGLE.api(DRIVE + '/files/' + encodeURIComponent(id) + '?fields=name,ownedByMe');
    if (!f.ownedByMe) throw new Error('Hanya pemilik buku yang bisa menghapusnya.');
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
        if (!['transaksi', 'kategori', 'dompet'].every(k => ada.has(TABEL[k].nama))) throw new Error('"' + judul + '" bukan buku Dompet Keluarga');
        if (sudahDihapus_(judul)) throw new Error('"' + judul + '" sudah dihapus pemiliknya');
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

  // ---------- Lampiran foto struk (Google Drive) ----------

  let idFolderStruk = null;

  /** Folder "Dompet Keluarga - Struk" milik akun ini; dibuat sekali, ID-nya disimpan di config appData. */
  async function folderStruk_() {
    if (idFolderStruk) return idFolderStruk;
    const c = (await bacaConfig_()) || {};
    if (c.folderStruk) {
      try {
        const f = await GOOGLE.api(DRIVE + '/files/' + c.folderStruk + '?fields=id,trashed');
        if (!f.trashed) return (idFolderStruk = f.id);
      } catch (e) { /* terhapus → buat baru */ }
    }
    const f = await GOOGLE.api(DRIVE + '/files?fields=id', {
      method: 'POST', json: { name: 'Dompet Keluarga - Struk', mimeType: 'application/vnd.google-apps.folder' },
    });
    await tulisConfig_(Object.assign(c, { folderStruk: f.id }));
    return (idFolderStruk = f.id);
  }

  /**
   * Mengunggah foto (base64 JPEG) ke folder struk, lalu membagikannya (hanya lihat, tanpa email) ke semua akun
   * yang punya akses ke spreadsheet keluarga, supaya anggota lain bisa membukanya. Hasil: ID file Drive.
   */
  async function unggahStruk_(base64, tanggal) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const meta = { name: 'Struk ' + teks_(tanggal) + '.jpg', mimeType: 'image/jpeg', parents: [await folderStruk_()] };
    const f = await GOOGLE.api(UPLOAD + '/files?uploadType=multipart&fields=id', Object.assign({ method: 'POST' }, GOOGLE.multipart(meta, blob)));
    try {
      const izin = await GOOGLE.api(DRIVE + '/files/' + dbId + '/permissions?fields=permissions(type,emailAddress)');
      const saya = String(GOOGLE.email()).toLowerCase();
      for (const p of izin.permissions || []) {
        if (p.type !== 'user' || !p.emailAddress || p.emailAddress.toLowerCase() === saya) continue;
        await GOOGLE.api(DRIVE + '/files/' + f.id + '/permissions?sendNotificationEmail=false', {
          method: 'POST', json: { type: 'user', role: 'reader', emailAddress: p.emailAddress },
        });
      }
    } catch (e) {
      console.warn('Foto struk tidak bisa dibagikan ke anggota lain:', e); // fotonya tetap tersimpan untuk pengunggah
    }
    return f.id;
  }

  /** Mengembalikan isi baris yang dihapus, untuk "Urungkan" (kembalikanTransaksi). Fotonya ikut ke Sampah Drive. */
  async function hapusTransaksi(idTrx) {
    const id = await db_();
    const i = cariBaris_(await daftarId_(id), x => x === String(idTrx));
    const baris = await bacaBarisTransaksi_(id, i + 2);
    await hapusBaris_(id, TABEL.transaksi, i);
    await buangLampiran_(baris[11]);
    return baris;
  }

  /** baris: hasil hapusTransaksi. Ditambah lagi apa adanya (pencatat & waktu asli tetap), foto diambil dari Sampah. */
  async function kembalikanTransaksi(baris) {
    const id = await db_();
    if (!Array.isArray(baris) || !baris[0]) throw new Error('Data transaksi tidak lengkap.');
    if ((await daftarId_(id)).includes(String(baris[0]))) return true;
    await tambahBaris_(id, TABEL.transaksi, [baris.slice(0, TABEL.transaksi.kolom.length)]);
    await buangLampiran_(baris[11], false);
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
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    if (tipe !== TIPE.MASUK && tipe !== TIPE.KELUAR) throw new Error('Tipe kategori tidak valid.');
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
      if (bentrok >= 0 && bentrok !== i) throw new Error('Kategori "' + nama + '" sudah ada.');
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
      if (bentrok >= 0) throw new Error('Kategori "' + nama + '" sudah ada.');
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
    if (dipakai) throw new Error('Kategori ini dipakai di ' + dipakai + ' transaksi. Ubah dulu kategori transaksinya, atau ganti nama kategorinya saja.');
    const rutin = rut.filter(r => String(r[4]) === nama && String(r[2]) === tipe).length;
    if (rutin) throw new Error('Kategori ini dipakai di ' + rutin + ' tagihan rutin. Ubah atau hapus dulu tagihan rutinnya.');
    await hapusBaris_(id, TABEL.kategori, cariBaris_(kat, r => String(r[0]) === nama && String(r[1]) === tipe));
    return true;
  }

  /** input: { namaLama?, nama, ikon, saldoAwal, jenis?, target?, tenggat? } — target 0 = tabungan tanpa batas. */
  async function simpanDompet(input) {
    const nama = teks_(input.nama);
    const jenis = JENIS_KHUSUS.includes(input.jenis) ? input.jenis : JENIS.DOMPET;
    if (!nama) throw new Error('Nama ' + (jenis === JENIS.UTANG ? 'orang' : jenis.toLowerCase()) + ' wajib diisi.');
    const ikon = teks_(input.ikon) || { [JENIS.TABUNGAN]: '🐷', [JENIS.UTANG]: '🤝', [JENIS.ASET]: '💎' }[jenis] || '👛';
    const saldoAwal = Math.round(Number(input.saldoAwal) || 0);
    const namaLama = teks_(input.namaLama);
    let target = '';
    let tenggat = '';
    if (jenis === JENIS.TABUNGAN || jenis === JENIS.UTANG) {
      if (jenis === JENIS.TABUNGAN) target = Math.max(0, Math.round(Number(input.target) || 0)) || '';
      const m = teks_(input.tenggat).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (teks_(input.tenggat) && !m) throw new Error('Tanggal target tidak valid.');
      if (m) tenggat = keSerial_(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    const baris = [nama, ikon, saldoAwal, jenis, target, tenggat];

    const id = await db_();
    const [dom, trx] = await bacaTabel_(id, ['dompet', 'transaksi']);
    const bentrok = dom.findIndex(r => String(r[0]) === nama);

    if (namaLama) {
      const i = cariBaris_(dom, r => String(r[0]) === namaLama);
      if (bentrok >= 0 && bentrok !== i) throw new Error('Dompet "' + nama + '" sudah ada.');
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
      if (bentrok >= 0) throw new Error('Dompet "' + nama + '" sudah ada.');
      await tambahBaris_(id, TABEL.dompet, [baris]);
    }
    return true;
  }

  async function hapusDompet(nama) {
    const id = await db_();
    const [dom, trx, rut] = await bacaTabel_(id, ['dompet', 'transaksi', 'rutin']);
    const dipakai = trx.filter(r => String(r[5]) === nama || String(r[6]) === nama).length;
    if (dipakai) throw new Error('Dompet ini dipakai di ' + dipakai + ' transaksi, jadi tidak bisa dihapus.');
    const rutin = rut.filter(r => String(r[5]) === nama || String(r[6]) === nama).length;
    if (rutin) throw new Error('Dompet ini dipakai di ' + rutin + ' tagihan rutin. Ubah atau hapus dulu tagihan rutinnya.');
    await hapusBaris_(id, TABEL.dompet, cariBaris_(dom, r => String(r[0]) === nama));
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
    if (!peserta.length) throw new Error('Tambahkan minimal satu orang yang ikut patungan.');
    const nama = peserta.map(p => p.nama.toLowerCase());
    if (new Set(nama).size !== nama.length) throw new Error('Ada nama yang dobel.');
    if (peserta.reduce((a, p) => a + p.jumlah, 0) + bagianSaya !== Math.round(Number(input.total) || 0)) {
      throw new Error('Jumlah semua bagian belum sama dengan total.');
    }
    // Periksa semuanya dulu, supaya tidak ada yang tercatat setengah jalan.
    validasiTransaksi_({ tipe: TIPE.TRANSFER, jumlah: 1, dompet: input.dompet, dompetTujuan: '_', tanggal: input.tanggal });
    if (bagianSaya) validasiTransaksi_({ tipe: TIPE.KELUAR, jumlah: bagianSaya, kategori: input.kategori, dompet: input.dompet, tanggal: input.tanggal });
    const [dom] = await bacaTabel_(await db_(), ['dompet']);
    const bentrok = peserta.find(p => dom.some(r => String(r[0]).toLowerCase() === p.nama.toLowerCase() && String(r[3]) !== JENIS.UTANG));
    if (bentrok) throw new Error('Nama "' + bentrok.nama + '" sudah dipakai dompet/tabungan. Pakai nama lain, mis. "' + bentrok.nama + ' (teman)".');

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
    if (!nama) throw new Error('Isi nama orangnya.');
    if (!['piutang', 'utang'].includes(input.arah)) throw new Error('Pilih: meminjamkan atau meminjam.');
    const id = await db_();
    const [dom] = await bacaTabel_(id, ['dompet']);
    const ada = dom.find(r => String(r[0]).toLowerCase() === nama.toLowerCase());
    if (ada && String(ada[3]) !== JENIS.UTANG) {
      throw new Error('Nama "' + ada[0] + '" sudah dipakai dompet/tabungan. Pakai nama lain, mis. "' + nama + ' (teman)".');
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
        throw new Error('Spreadsheet ini tidak bisa dibagikan ke bot dari akun Anda. Minta pemilik spreadsheet menghubungkan bot lebih dulu.');
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

  // ---------- Baca struk ----------

  async function bacaStruk(base64, mime) {
    // Pengaturan dibaca bersamaan dengan OCR (STRUK.baca langsung mulai OCR), tidak bergantian.
    const opsi = db_().then(id => bacaTabel_(id, ['kategori', 'pengaturan'])).then(([kat, set]) => ({
      kategori: kat.filter(r => r[0] !== '' && String(r[1]) === TIPE.KELUAR).map(r => String(r[0])),
      kunci: kunciGemini_(set),
      model: pengaturan_(set).GEMINI_MODEL,
    }));
    return STRUK.baca(base64, mime, opsi);
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
    getData, buatDatabase, hubungkanDatabase, lupakanDatabase, bagikanKe, daftarAnggota, keluarkanAnggota, buatBuku, lupakanBuku, hapusBuku, tambahBuku,
    simpanTransaksi, hapusTransaksi, kembalikanTransaksi, simpanKategori, hapusKategori, simpanAnggaran, simpanDompet, hapusDompet,
    simpanRutin, hapusRutin, majukanRutin, simpanCatatan, hapusCatatan, tanggalBerikut: tanggalBerikut_, catatUtang, catatPatungan,
    simpanMulaiPeriode, periodeDari: periodeDari_, rentangPeriode: rentangPeriode_, cariTransaksi,
    tambahKunciGemini, hapusKunciGemini, bacaStruk, buatKodeTelegram, putuskanTelegram,
    uji: { keSerial_, dariSerial_, validasiTransaksi_, olahData_ },
  };
})();
