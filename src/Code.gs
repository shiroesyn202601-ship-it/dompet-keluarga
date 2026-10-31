/**
 * Dompet Keluarga — aplikasi keuangan keluarga berbasis Google Apps Script.
 * Script ini standalone: database-nya (spreadsheet) dibuat otomatis oleh aplikasi
 * saat pertama kali dibuka, lalu ID-nya disimpan di Script Properties.
 * Web app berjalan sebagai akun yang membukanya, jadi siapa pun yang diberi
 * akses Editor ke spreadsheet bisa memakai aplikasi ini.
 */

const TZ = 'Asia/Jakarta';
const TIPE = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', TRANSFER: 'Transfer' };

const TABEL = {
  transaksi: {
    nama: 'Transaksi',
    kolom: ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Kategori', 'Dompet', 'Dompet Tujuan', 'Catatan', 'Dibuat Oleh', 'Dibuat Pada', 'Diubah Pada'],
  },
  kategori: { nama: 'Kategori', kolom: ['Nama', 'Tipe', 'Ikon'] },
  dompet: { nama: 'Dompet', kolom: ['Nama', 'Ikon', 'Saldo Awal'] },
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

// ---------- Web app ----------

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dompet Keluarga')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
}

function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

// ---------- Setup (otomatis saat aplikasi pertama kali dibuka) ----------

const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Membuat spreadsheet database di Drive akun yang membuka aplikasi. Aman dipanggil berulang. */
function buatDatabase(emailPasangan) {
  const pasangan = teks_(emailPasangan);
  if (pasangan && !POLA_EMAIL.test(pasangan)) throw new Error('Format email pasangan tidak valid.');

  return denganKunci_(function () {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('SPREADSHEET_ID')) return db_().getUrl();

    const ss = SpreadsheetApp.create('Dompet Keluarga');
    ss.getSheets()[0].setName(TABEL.transaksi.nama);
    siapkanDatabase_(ss);
    if (pasangan) ss.addEditor(pasangan);
    props.setProperty('SPREADSHEET_ID', ss.getId());
    return ss.getUrl();
  });
}

/** Memberi akses Editor ke spreadsheet untuk anggota keluarga lain. */
function bagikanKe(email) {
  email = teks_(email);
  if (!POLA_EMAIL.test(email)) throw new Error('Format email tidak valid.');
  db_().addEditor(email);
  return true;
}

function siapkanDatabase_(ss) {
  ss.setSpreadsheetTimeZone(TZ);

  const trx = siapkanSheet_(ss, TABEL.transaksi);
  trx.getRange('B2:B').setNumberFormat('yyyy-mm-dd');
  trx.getRange('D2:D').setNumberFormat('#,##0');
  trx.getRange('J2:K').setNumberFormat('yyyy-mm-dd hh:mm');

  const kat = siapkanSheet_(ss, TABEL.kategori);
  if (kat.getLastRow() < 2) {
    kat.getRange(2, 1, KATEGORI_AWAL.length, 3).setValues(KATEGORI_AWAL);
  }

  const dom = siapkanSheet_(ss, TABEL.dompet);
  if (dom.getLastRow() < 2) {
    dom.getRange(2, 1, DOMPET_AWAL.length, 3).setValues(DOMPET_AWAL);
  }
  dom.getRange('C2:C').setNumberFormat('#,##0');
}

function siapkanSheet_(ss, tabel) {
  const sh = ss.getSheetByName(tabel.nama) || ss.insertSheet(tabel.nama);
  sh.getRange(1, 1, 1, tabel.kolom.length).setValues([tabel.kolom]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

// ---------- API untuk halaman web ----------

function getData(bulan) {
  if (!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')) {
    return { perluSetup: true, user: emailUser_() };
  }
  const ss = db_();
  const d = semuaData_(ss);
  if (!/^\d{4}-\d{2}$/.test(bulan || '')) bulan = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');

  const saldo = {};
  d.dompet.forEach(function (w) { saldo[w.nama] = w.saldoAwal; });
  d.transaksi.forEach(function (t) {
    if (t.tipe === TIPE.MASUK) tambah_(saldo, t.dompet, t.jumlah);
    else if (t.tipe === TIPE.KELUAR) tambah_(saldo, t.dompet, -t.jumlah);
    else if (t.tipe === TIPE.TRANSFER) {
      tambah_(saldo, t.dompet, -t.jumlah);
      tambah_(saldo, t.dompetTujuan, t.jumlah);
    }
  });

  return {
    user: emailUser_(),
    urlSpreadsheet: ss.getUrl(),
    kunciGemini: kunciGemini_().map(samarkanKunci_),
    bulan: bulan,
    kategori: d.kategori,
    dompet: d.dompet.map(function (w) {
      return { nama: w.nama, ikon: w.ikon, saldoAwal: w.saldoAwal, saldo: saldo[w.nama] || 0 };
    }),
    transaksi: d.transaksi
      .filter(function (t) { return t.tanggal.slice(0, 7) === bulan; })
      .sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat); }),
  };
}

function simpanTransaksi(input) {
  const t = validasiTransaksi_(input);
  return denganKunci_(function () {
    const tabel = baca_(db_(), TABEL.transaksi);
    const sekarang = new Date();
    if (t.id) {
      const i = cariBaris_(tabel.rows, function (r) { return String(r[0]) === t.id; });
      const lama = tabel.rows[i];
      tabel.sh.getRange(i + 2, 1, 1, TABEL.transaksi.kolom.length).setValues([[
        t.id, t.tanggal, t.tipe, t.jumlah, aman_(t.kategori), aman_(t.dompet), aman_(t.dompetTujuan), aman_(t.catatan), lama[8], lama[9], sekarang,
      ]]);
    } else {
      t.id = Utilities.getUuid();
      tabel.sh.appendRow([
        t.id, t.tanggal, t.tipe, t.jumlah, aman_(t.kategori), aman_(t.dompet), aman_(t.dompetTujuan), aman_(t.catatan), emailUser_(), sekarang, sekarang,
      ]);
    }
    return t.id;
  });
}

function hapusTransaksi(id) {
  return denganKunci_(function () {
    const tabel = baca_(db_(), TABEL.transaksi);
    const i = cariBaris_(tabel.rows, function (r) { return String(r[0]) === String(id); });
    tabel.sh.deleteRow(i + 2);
    return true;
  });
}

/** input: { namaLama?, tipeLama?, nama, tipe, ikon } */
function simpanKategori(input) {
  const nama = teks_(input.nama);
  const tipe = String(input.tipe);
  if (!nama) throw new Error('Nama kategori wajib diisi.');
  if (tipe !== TIPE.MASUK && tipe !== TIPE.KELUAR) throw new Error('Tipe kategori tidak valid.');
  const ikon = teks_(input.ikon) || '🏷️';
  const namaLama = teks_(input.namaLama);
  const tipeLama = String(input.tipeLama || tipe);

  return denganKunci_(function () {
    const ss = db_();
    const kat = baca_(ss, TABEL.kategori);
    const sama = function (n, tp) { return function (r) { return String(r[0]) === n && String(r[1]) === tp; }; };
    const bentrok = kat.rows.findIndex(sama(nama, tipe));

    if (namaLama) {
      const i = cariBaris_(kat.rows, sama(namaLama, tipeLama));
      if (bentrok >= 0 && bentrok !== i) throw new Error('Kategori "' + nama + '" sudah ada.');
      kat.sh.getRange(i + 2, 1, 1, 3).setValues([[aman_(nama), tipe, ikon]]);
      if (namaLama !== nama || tipeLama !== tipe) {
        gantiDiTransaksi_(ss, function (r) {
          if (String(r[4]) === namaLama && String(r[2]) === tipeLama) { r[4] = nama; r[2] = tipe; return true; }
          return false;
        });
      }
    } else {
      if (bentrok >= 0) throw new Error('Kategori "' + nama + '" sudah ada.');
      kat.sh.appendRow([aman_(nama), tipe, ikon]);
    }
    return true;
  });
}

function hapusKategori(nama, tipe) {
  return denganKunci_(function () {
    const ss = db_();
    const dipakai = baca_(ss, TABEL.transaksi).rows.filter(function (r) {
      return String(r[4]) === nama && String(r[2]) === tipe;
    }).length;
    if (dipakai) throw new Error('Kategori ini dipakai di ' + dipakai + ' transaksi. Ubah dulu kategori transaksinya, atau ganti nama kategorinya saja.');
    const kat = baca_(ss, TABEL.kategori);
    const i = cariBaris_(kat.rows, function (r) { return String(r[0]) === nama && String(r[1]) === tipe; });
    kat.sh.deleteRow(i + 2);
    return true;
  });
}

/** input: { namaLama?, nama, ikon, saldoAwal } */
function simpanDompet(input) {
  const nama = teks_(input.nama);
  if (!nama) throw new Error('Nama dompet wajib diisi.');
  const ikon = teks_(input.ikon) || '👛';
  const saldoAwal = Math.round(Number(input.saldoAwal) || 0);
  const namaLama = teks_(input.namaLama);

  return denganKunci_(function () {
    const ss = db_();
    const dom = baca_(ss, TABEL.dompet);
    const bentrok = dom.rows.findIndex(function (r) { return String(r[0]) === nama; });

    if (namaLama) {
      const i = cariBaris_(dom.rows, function (r) { return String(r[0]) === namaLama; });
      if (bentrok >= 0 && bentrok !== i) throw new Error('Dompet "' + nama + '" sudah ada.');
      dom.sh.getRange(i + 2, 1, 1, 3).setValues([[aman_(nama), ikon, saldoAwal]]);
      if (namaLama !== nama) {
        gantiDiTransaksi_(ss, function (r) {
          let ubah = false;
          if (String(r[5]) === namaLama) { r[5] = nama; ubah = true; }
          if (String(r[6]) === namaLama) { r[6] = nama; ubah = true; }
          return ubah;
        });
      }
    } else {
      if (bentrok >= 0) throw new Error('Dompet "' + nama + '" sudah ada.');
      dom.sh.appendRow([aman_(nama), ikon, saldoAwal]);
    }
    return true;
  });
}

function hapusDompet(nama) {
  return denganKunci_(function () {
    const ss = db_();
    const dipakai = baca_(ss, TABEL.transaksi).rows.filter(function (r) {
      return String(r[5]) === nama || String(r[6]) === nama;
    }).length;
    if (dipakai) throw new Error('Dompet ini dipakai di ' + dipakai + ' transaksi, jadi tidak bisa dihapus.');
    const dom = baca_(ss, TABEL.dompet);
    const i = cariBaris_(dom.rows, function (r) { return String(r[0]) === nama; });
    dom.sh.deleteRow(i + 2);
    return true;
  });
}

// ---------- Baca foto struk (AI + OCR) ----------

/** Model bisa diganti tanpa ubah kode lewat Script Properties: GEMINI_MODEL. */
const MODEL_GEMINI = 'gemini-3.8-flash';

// Banyak kunci API disimpan sebagai JSON array di Script Properties: GEMINI_API_KEYS.
// Kunci dipakai bergiliran; kalau satu kena kuota/tidak valid, otomatis pindah ke kunci berikutnya.

function tambahKunciGemini(kunci) {
  db_(); // hanya akun yang punya akses ke spreadsheet yang boleh mengubah
  kunci = teks_(kunci);
  if (!/^[\w-]{20,}$/.test(kunci)) throw new Error('Format kunci API tidak valid.');
  return denganKunci_(function () {
    const daftar = kunciGemini_();
    if (daftar.indexOf(kunci) >= 0) throw new Error('Kunci API ini sudah ada.');
    daftar.push(kunci);
    simpanDaftarKunci_(daftar);
    return true;
  });
}

/** `samaran` adalah tampilan tersamar dari daftar (mis. "AIzaSy…x9Qk"), supaya kunci asli tidak pernah dikirim ke browser. */
function hapusKunciGemini(samaran) {
  db_();
  return denganKunci_(function () {
    const daftar = kunciGemini_();
    const i = daftar.map(samarkanKunci_).indexOf(samaran);
    if (i < 0) throw new Error('Kunci API tidak ditemukan. Coba muat ulang.');
    daftar.splice(i, 1);
    simpanDaftarKunci_(daftar);
    return true;
  });
}

function kunciGemini_() {
  const props = PropertiesService.getScriptProperties();
  let daftar = [];
  try { daftar = JSON.parse(props.getProperty('GEMINI_API_KEYS') || '[]'); } catch (e) { daftar = []; }
  const lama = props.getProperty('GEMINI_API_KEY'); // dari versi sebelumnya (satu kunci)
  if (lama && daftar.indexOf(lama) < 0) daftar.unshift(lama);
  return daftar;
}

function simpanDaftarKunci_(daftar) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('GEMINI_API_KEYS', JSON.stringify(daftar));
  props.deleteProperty('GEMINI_API_KEY');
}

function samarkanKunci_(k) {
  return k.slice(0, 6) + '…' + k.slice(-4);
}

/**
 * Menjalankan beberapa permintaan Gemini sekaligus. Mulai dari kunci giliran berikutnya;
 * permintaan yang gagal karena kuota/kunci diulang dengan kunci lain.
 * Mengembalikan array sejajar dengan `permintaan`: objek hasil, atau Error.
 */
function jalankanGemini_(daftar, model, permintaan, skema) {
  const props = PropertiesService.getScriptProperties();
  const mulai = (Number(props.getProperty('GEMINI_GILIRAN')) || 0) % daftar.length;
  props.setProperty('GEMINI_GILIRAN', String((mulai + 1) % daftar.length));

  const hasil = [];
  let sisa = permintaan.map(function (_, i) { return i; });
  for (let n = 0; n < daftar.length && sisa.length; n++) {
    const kunci = daftar[(mulai + n) % daftar.length];
    let jawaban;
    try {
      jawaban = UrlFetchApp.fetchAll(sisa.map(function (i) { return mintaGemini_(kunci, model, permintaan[i].parts, skema); }));
    } catch (e) {
      console.error('Gemini tidak bisa dihubungi: ' + e);
      sisa.forEach(function (i) { hasil[i] = new Error('Gemini terlalu lama menjawab atau tidak bisa dihubungi'); });
      break;
    }
    const ulang = [];
    jawaban.forEach(function (res, j) {
      const i = sisa[j];
      try {
        hasil[i] = bacaJawabanGemini_(res);
        console.log(permintaan[i].sumber + ' memakai kunci ' + samarkanKunci_(kunci));
      } catch (e) {
        hasil[i] = e;
        if (e.gantiKunci) {
          console.warn(permintaan[i].sumber + ': kunci ' + samarkanKunci_(kunci) + ' gagal (' + e.message + '), coba kunci lain');
          ulang.push(i);
        }
      }
    });
    sisa = ulang;
  }
  return hasil;
}

/**
 * Membaca foto struk secara berlapis, lalu hasilnya dicocokkan:
 *   1. "AI foto"  : Gemini membaca gambar langsung.
 *   2. "OCR + AI" : gambar → teks (OCR Google Drive) → teks disimpulkan Gemini.
 *   3. "OCR"      : teks OCR yang sama dibaca dengan aturan biasa (tanpa AI).
 * Mengembalikan { jumlah, tanggal, kategori, catatan, yakin, pilihanJumlah, lapis }.
 */
function bacaStruk(base64, mime) {
  const ss = db_();
  if (!/^image\/(jpeg|png|webp)$/.test(String(mime))) throw new Error('Format gambar tidak didukung.');
  const props = PropertiesService.getScriptProperties();
  const daftarKunci = kunciGemini_();
  const model = props.getProperty('GEMINI_MODEL') || MODEL_GEMINI;
  const kategori = baca_(ss, TABEL.kategori).rows
    .filter(function (r) { return r[0] !== '' && String(r[1]) === TIPE.KELUAR; })
    .map(function (r) { return String(r[0]); });
  const hariIni = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  console.log('bacaStruk: model ' + model + ', ukuran gambar ' + Math.round(String(base64).length * 0.75 / 1024) + ' KB');

  const hasil = [];   // { sumber, jumlah, tanggal, kategori, catatan }
  const gagal = [];   // pesan error per lapis, untuk pesan akhir

  // Lapis OCR dulu, karena teksnya dipakai lapis 2 dan 3.
  let teksOcr = '';
  try {
    teksOcr = ocrDrive_(base64, mime);
    console.log('bacaStruk: teks OCR\n' + teksOcr.slice(0, 3000));
    const aturan = tebakDariTeks_(teksOcr, hariIni);
    if (aturan.jumlah) hasil.push(Object.assign({ sumber: 'OCR' }, aturan));
  } catch (e) {
    console.error('bacaStruk: OCR gagal: ' + e);
    gagal.push('OCR gagal');
  }

  // Lapis AI: foto langsung dan teks OCR dikirim bersamaan.
  if (daftarKunci.length) {
    const skema = skemaStruk_(kategori);
    const permintaan = [{ sumber: 'AI foto', parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: petunjukStruk_('gambar', hariIni) }] }];
    if (teksOcr.trim()) {
      permintaan.push({ sumber: 'OCR + AI', parts: [{ text: petunjukStruk_('teks', hariIni) + '\n\nTeks OCR:\n"""\n' + teksOcr.slice(0, 8000) + '\n"""' }] });
    }
    jalankanGemini_(daftarKunci, model, permintaan, skema).forEach(function (h, i) {
      try {
        if (h instanceof Error) throw h;
        console.log('bacaStruk: ' + permintaan[i].sumber + ' → ' + JSON.stringify(h));
        const jumlah = Math.round(Number(h.jumlah) || 0);
        if (jumlah > 0) {
          hasil.push({
            sumber: permintaan[i].sumber,
            jumlah: jumlah,
            tanggal: tanggalWajar_(h.tanggal, hariIni),
            kategori: kategori.indexOf(h.kategori) >= 0 ? h.kategori : '',
            catatan: teks_(h.catatan).slice(0, 120),
          });
        }
      } catch (e) {
        console.error('bacaStruk: ' + permintaan[i].sumber + ' gagal: ' + e.message);
        gagal.push(e.message);
      }
    });
  }

  if (!hasil.length) {
    const alasan = gagal.filter(function (g) { return /Kunci API|Kuota/.test(g); })[0];
    throw new Error(alasan || 'Total belanja tidak ditemukan di gambar. Coba foto ulang dengan lebih terang dan lurus.');
  }
  return gabungHasilStruk_(hasil);
}

/** Mencocokkan hasil semua lapis: total yang paling banyak disepakati menang. */
function gabungHasilStruk_(hasil) {
  const URUTAN = ['AI foto', 'OCR + AI', 'OCR'];
  hasil.sort(function (a, b) { return URUTAN.indexOf(a.sumber) - URUTAN.indexOf(b.sumber); });

  const grup = [];
  hasil.forEach(function (h) {
    const g = grup.filter(function (x) { return x.jumlah === h.jumlah; })[0];
    if (g) g.sumber.push(h.sumber);
    else grup.push({ jumlah: h.jumlah, sumber: [h.sumber] });
  });
  // Paling banyak suara dulu; kalau seri, urutan prioritas lapis (sudah terurut) dipertahankan.
  grup.sort(function (a, b) { return b.sumber.length - a.sumber.length; });

  // Field lain diambil dari lapis yang totalnya menang dulu, baru dari lapis lain.
  const menang = grup[0].sumber;
  const urut = hasil.filter(function (x) { return menang.indexOf(x.sumber) >= 0; })
    .concat(hasil.filter(function (x) { return menang.indexOf(x.sumber) < 0; }));
  const ambil = function (field) {
    const h = urut.filter(function (x) { return x[field]; })[0];
    return h ? h[field] : '';
  };
  return {
    jumlah: grup[0].jumlah,
    tanggal: ambil('tanggal'),
    kategori: ambil('kategori'),
    catatan: ambil('catatan'),
    yakin: grup[0].sumber.length >= 2,
    pilihanJumlah: grup,
    lapis: hasil.map(function (h) { return h.sumber; }),
  };
}

function petunjukStruk_(bentuk, hariIni) {
  return [
    bentuk === 'gambar'
      ? 'Ini gambar bukti belanja dari Indonesia: bisa struk cetak yang difoto (mungkin miring, buram, atau ada bayangan), nota tulisan tangan, atau screenshot pembelian online.'
      : 'Ini teks hasil OCR dari bukti belanja di Indonesia. Teksnya bisa berantakan dan ada salah baca, misalnya O/0, l/1, S/5, B/8.',
    'Isi:',
    '- jumlah: total akhir yang dibayar dalam rupiah, bilangan bulat tanpa titik/koma (setelah diskon dan pajak, bukan uang tunai yang diberikan atau kembalian).',
    '  Jika tidak ada tulisan total, jumlahkan harga semua barang. Isi 0 hanya jika ini sama sekali bukan bukti belanja.',
    '  Di Indonesia titik adalah pemisah ribuan, jadi "25.000" = 25000. Tulisan tangan "25" atau "25rb" pada nota biasanya berarti 25000.',
    '- tanggal: tanggal transaksi format yyyy-mm-dd. Kosongkan jika tidak ada. Hari ini ' + hariIni + '.',
    '- kategori: pilih satu yang paling cocok dari daftar.',
    '- catatan: nama toko lalu ringkasan barang, maksimal 80 karakter. Contoh: "Indomaret - susu, roti, sabun".',
  ].join('\n');
}

function skemaStruk_(kategori) {
  return {
    type: 'OBJECT',
    properties: {
      jumlah: { type: 'INTEGER' },
      tanggal: { type: 'STRING' },
      kategori: kategori.length ? { type: 'STRING', enum: kategori } : { type: 'STRING' },
      catatan: { type: 'STRING' },
    },
    required: ['jumlah', 'tanggal', 'kategori', 'catatan'],
  };
}

function mintaGemini_(kunci, model, parts, skema) {
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': kunci },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: skema },
    }),
  };
}

function bacaJawabanGemini_(res) {
  const kode = res.getResponseCode();
  if (kode !== 200) {
    console.error('Gemini HTTP ' + kode + ' ' + res.getContentText().slice(0, 1000));
    let pesan = '';
    try { pesan = JSON.parse(res.getContentText()).error.message; } catch (e) { pesan = res.getContentText().slice(0, 200); }
    let err;
    if (kode === 400 && /API key/i.test(pesan)) err = new Error('Kunci API Gemini tidak valid. Periksa lagi di menu Lainnya.');
    else if (kode === 429) err = new Error('Kuota semua kunci Gemini sedang habis. Coba lagi nanti, atau tambah kunci lain di menu Lainnya.');
    else if (kode === 403) err = new Error('Kunci API Gemini ditolak (403). Periksa lagi di menu Lainnya.');
    else err = new Error('Gemini error ' + kode + ': ' + pesan);
    err.gantiKunci = kode === 429 || kode === 403 || (kode === 400 && /API key/i.test(pesan));
    throw err;
  }
  try {
    const parts = JSON.parse(res.getContentText()).candidates[0].content.parts;
    return JSON.parse(parts.map(function (p) { return p.text || ''; }).join(''));
  } catch (e) {
    console.error('Jawaban Gemini tidak bisa dibaca: ' + res.getContentText().slice(0, 2000));
    throw new Error('Jawaban Gemini tidak bisa dibaca.');
  }
}

/** Gambar → teks memakai OCR bawaan Google Drive. File sementara langsung dihapus. */
function ocrDrive_(base64, mime) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, 'struk');
  const file = Drive.Files.create({ name: 'Dompet Keluarga - OCR sementara', mimeType: MimeType.GOOGLE_DOCS }, blob, { ocrLanguage: 'id' });
  try {
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '/export?mimeType=text/plain', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) throw new Error('export HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
    return res.getContentText().replace(/^﻿/, '');
  } finally {
    try { Drive.Files.remove(file.id); } catch (e) { console.warn('Gagal menghapus file OCR sementara: ' + e); }
  }
}

/** Membaca total & tanggal dari teks OCR dengan aturan biasa (tanpa AI). */
function tebakDariTeks_(teks, hariIni) {
  const baris = teks.split(/\r?\n/).map(function (b) { return b.trim(); }).filter(Boolean);
  const TOTAL = /(grand\s*total|total|jumlah|tagihan|harus\s*dibayar|amount\s*due)/i;
  const BUKAN = /(sub\s*-?\s*total|total\s*(item|qty|diskon|hemat|potongan)|kembali|change|tunai|cash|ppn|pajak|tax|disc)/i;

  let jumlah = 0;
  baris.forEach(function (b, i) {
    if (!TOTAL.test(b) || BUKAN.test(b)) return;
    // Nominal bisa di baris yang sama, atau di baris berikutnya kalau OCR memisahkannya.
    const n = nominalTerbesar_(b) || nominalTerbesar_(baris[i + 1] || '');
    if (n > jumlah) jumlah = n;
  });

  let tanggal = '';
  baris.some(function (b) {
    tanggal = tanggalWajar_(cariTanggal_(b), hariIni);
    return !!tanggal;
  });
  return { jumlah: jumlah, tanggal: tanggal, kategori: '', catatan: '' };
}

function nominalTerbesar_(s) {
  const cocok = String(s).match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?/g) || [];
  return cocok.reduce(function (maks, angka) {
    const n = Number(angka.replace(/[.,]\d{2}$/, '').replace(/\D/g, '')) || 0;
    return n >= 100 && n < 1e10 && n > maks ? n : maks;
  }, 0);
}

function cariTanggal_(s) {
  const BULAN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  const dua = function (n) { return String(n).padStart(2, '0'); };
  const tahun = function (y) { return y.length === 2 ? '20' + y : y; };
  let m = s.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if (m) return m[1] + '-' + dua(m[2]) + '-' + dua(m[3]);
  m = s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/);
  if (m) return tahun(m[3]) + '-' + dua(m[2]) + '-' + dua(m[1]);
  m = s.match(/\b(\d{1,2})\s*[-\s]\s*([a-z]{3})[a-z]*\.?\s*[-\s]\s*(\d{4}|\d{2})\b/i);
  if (m && BULAN[m[2].toLowerCase()]) return tahun(m[3]) + '-' + dua(BULAN[m[2].toLowerCase()]) + '-' + dua(m[1]);
  return '';
}

/** Tanggal dianggap wajar jika formatnya benar, ada di kalender, dan tidak lebih dari hari ini. */
function tanggalWajar_(s, hariIni) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '';
  return s <= hariIni && s >= '2000-01-01' ? s : '';
}

// ---------- Helper ----------

function db_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Database belum dibuat. Muat ulang aplikasi untuk membuatnya.');
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Akun ' + emailUser_() + ' belum punya akses. Minta pemilik mengundang akun ini dari menu Lainnya → Undang anggota keluarga.');
  }
}

function baca_(ss, tabel) {
  const sh = ss.getSheetByName(tabel.nama);
  if (!sh) throw new Error('Sheet "' + tabel.nama + '" tidak ditemukan. Jangan mengubah nama sheet di spreadsheet.');
  const n = sh.getLastRow() - 1;
  return { sh: sh, rows: n > 0 ? sh.getRange(2, 1, n, tabel.kolom.length).getValues() : [] };
}

function semuaData_(ss) {
  return {
    transaksi: baca_(ss, TABEL.transaksi).rows
      .filter(function (r) { return r[0] !== ''; })
      .map(function (r) {
        return {
          id: String(r[0]),
          tanggal: tanggal_(r[1]),
          tipe: String(r[2]),
          jumlah: Number(r[3]) || 0,
          kategori: String(r[4]),
          dompet: String(r[5]),
          dompetTujuan: String(r[6]),
          catatan: String(r[7]),
          oleh: String(r[8]),
          dibuat: r[9] instanceof Date ? Utilities.formatDate(r[9], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(r[9]),
        };
      }),
    kategori: baca_(ss, TABEL.kategori).rows
      .filter(function (r) { return r[0] !== ''; })
      .map(function (r) { return { nama: String(r[0]), tipe: String(r[1]), ikon: String(r[2]) }; }),
    dompet: baca_(ss, TABEL.dompet).rows
      .filter(function (r) { return r[0] !== ''; })
      .map(function (r) { return { nama: String(r[0]), ikon: String(r[1]), saldoAwal: Number(r[2]) || 0 }; }),
  };
}

function gantiDiTransaksi_(ss, ubahBaris) {
  const tabel = baca_(ss, TABEL.transaksi);
  let ada = false;
  tabel.rows.forEach(function (r) { if (ubahBaris(r)) ada = true; });
  if (!ada) return;
  const aman = tabel.rows.map(function (r) {
    return r.map(function (v) { return typeof v === 'string' ? aman_(v) : v; });
  });
  tabel.sh.getRange(2, 1, aman.length, TABEL.transaksi.kolom.length).setValues(aman);
}

function validasiTransaksi_(x) {
  x = x || {};
  const tipe = String(x.tipe);
  if ([TIPE.MASUK, TIPE.KELUAR, TIPE.TRANSFER].indexOf(tipe) < 0) throw new Error('Tipe transaksi tidak valid.');
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
    tanggal: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    tipe: tipe,
    jumlah: jumlah,
    kategori: kategori,
    dompet: dompet,
    dompetTujuan: dompetTujuan,
    catatan: teks_(x.catatan).slice(0, 500),
  };
}

function cariBaris_(rows, cocok) {
  const i = rows.findIndex(cocok);
  if (i < 0) throw new Error('Data tidak ditemukan. Mungkin sudah diubah atau dihapus orang lain — coba muat ulang.');
  return i;
}

function denganKunci_(fn) {
  const kunci = LockService.getScriptLock();
  kunci.waitLock(15000);
  try {
    return fn();
  } finally {
    kunci.releaseLock();
  }
}

function teks_(v) {
  return String(v == null ? '' : v).trim();
}

/** Teks yang diawali "=", "+", "-", "@" diberi tanda kutip supaya tidak dianggap rumus oleh Sheets. */
function aman_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function tanggal_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v).slice(0, 10);
}

function tambah_(obj, kunci, n) {
  if (kunci) obj[kunci] = (obj[kunci] || 0) + n;
}

function emailUser_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
}
