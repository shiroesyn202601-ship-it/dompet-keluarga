/**
 * Dompet Keluarga — bot Telegram (Google Apps Script).
 *
 * Bot ini membaca & menulis spreadsheet keluarga yang sama dengan aplikasi web.
 * Pesan bebas ("makan bakso 25rb pakai gopay") diterjemahkan Gemini menjadi perintah,
 * foto struk dibaca berlapis (AI foto, OCR + AI, OCR).
 *
 * Satu bot bisa melayani banyak keluarga: tiap akun Telegram tertaut ke spreadsheet keluarganya
 * (lihat bagian Data). Script Properties:
 *   TELEGRAM_TOKEN  — wajib, token dari @BotFather
 *   SA_KEY          — isi file JSON kunci service account ("akun robot"); spreadsheet yang dibagikan
 *                     aplikasi ke email akun ini bisa dipakai lewat bot (banyak keluarga)
 *   SPREADSHEET_ID  — opsional, mode lama: satu spreadsheet yang dibuka dengan akun pemilik
 *                     (paling tidak salah satu dari SA_KEY / SPREADSHEET_ID harus diisi)
 *   WEBAPP_URL      — opsional, kalau URL web app tidak terdeteksi otomatis
 *   LISENSI_KUNCI   — opsional, kunci rahasia (PEM) untuk membuat kode aktivasi versi penuh; kosong = batas
 *                     transaksi gratis tidak berlaku di bot (lihat docs/PEMILIK.md → Versi penuh & pembayaran)
 *   ADMIN_TELEGRAM  — ID Telegram pemilik (boleh beberapa, pisahkan koma) yang boleh memakai /lunas
 *   URL_APLIKASI    — opsional, alamat aplikasi web untuk link aktivasi (bawaan: GitHub Pages repo ini)
 * Indeks tautan disimpan otomatis sebagai tg_<id Telegram> = ID spreadsheet.
 *
 * Setelah deploy sebagai web app, jalankan pasangWebhook() sekali dari editor.
 */

const TZ = 'Asia/Jakarta';
const TIPE = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', TRANSFER: 'Transfer' };
/** Utang: satu "dompet" per orang; saldo positif = dia berutang ke kita, negatif = kita berutang (lihat web/assets/db.js). */
const JENIS = { DOMPET: 'Dompet', TABUNGAN: 'Tabungan', UTANG: 'Utang', ASET: 'Aset' };
const MODEL_GEMINI = 'gemini-3.8-flash';
/** Untuk memahami pesan chat: model ringan supaya bot cepat membalas. */
const MODEL_CEPAT = 'gemini-flash-lite-latest';
/** Dicoba berurutan kalau model utama sedang sibuk (5xx) atau tidak tersedia. */
const MODEL_CADANGAN = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
/**
 * Telegram berhenti menunggu webhook sekitar 1 menit, lalu menahan pesan berikutnya.
 * Setelah batas ini, AI tidak dicoba lagi supaya bot tetap sempat membalas.
 */
const BATAS_AI_MS = 35000;
/**
 * Anggaran "thinking" Gemini (token). Menerjemahkan pesan cukup tanpa berpikir supaya cepat;
 * pertanyaan/analisis tetap diberi sedikit ruang berpikir supaya hitungannya benar.
 */
const PIKIR_PERINTAH = 0;
const PIKIR_TANYA = 1024;
const PIKIR_STRUK = 1024; // OCR + AI: teks OCR berantakan, cukup untuk menjumlah barang tanpa berpikir panjang
const PIKIR_STRUK_FOTO = 512; // AI foto: nominal biasanya terbaca langsung dari gambar, jadi lebih hemat supaya cepat
let mulaiProses_ = Date.now();
const KOLOM_TRANSAKSI = 11;
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const NAMA_BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const BANTUAN = [
  '<b>Dompet Keluarga</b> — catat keuangan cukup dengan chat 💬',
  '',
  '<b>Catat</b>',
  '• <i>makan bakso 25rb</i>',
  '• <i>bensin 30rb pakai gopay, parkir 5rb</i>',
  '• <i>gaji masuk 8jt ke rekening bank</i>',
  '• <i>setor dana darurat 500rb dari bank</i>',
  '• <i>kemarin beli popok 120rb</i>',
  '• kirim <b>foto struk</b> 📸 (barang & harganya ikut tercatat)',
  '• kirim <b>pesan suara</b> 🎤, mis. <i>"bensin tiga puluh ribu pakai gopay"</i>',
  '',
  '<b>Ubah / hapus</b>',
  '• <i>yang terakhir ubah jadi 30rb</i>',
  '• <i>hapus transaksi bakso tadi</i>',
  '',
  '<b>Lihat</b>',
  '/saldo · /ringkasan · /anggaran · /terakhir',
  '',
  '<b>Tanya apa saja</b>',
  '• <i>bulan ini aku boros di mana?</i>',
  '• <i>bandingkan belanja bulan ini sama bulan lalu</i>',
  '• <i>aman nggak kalau beli HP 3 juta bulan ini?</i>',
  '• <i>kalau nabung 500rb sebulan, kapan dana darurat penuh?</i>',
  '• <i>catat makan 40rb, terus sisa anggaran makan berapa?</i>',
  '• <i>emasku sekarang berapa gram, untung nggak?</i>',
  '• <i>beras biasanya beli berapa? paling murah di mana?</i>',
  '',
  '<b>Ngobrol bebas</b> — seperti chat ke Gemini',
  '• <i>hari ini tanggal berapa?</i>',
  '• <i>resep sop ayam untuk 4 orang</i>',
  '• <i>kalau 2 porsi saja?</i> (bot ingat obrolan ±1 jam terakhir)',
].join('\n');

// ======================================================================
// Setup (dijalankan dari editor Apps Script)
// ======================================================================

/** Menghubungkan bot ke web app ini. Jalankan sekali setelah deploy (dan setiap ganti token). */
function pasangWebhook() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TELEGRAM_TOKEN')) throw new Error('Isi dulu Script Property TELEGRAM_TOKEN (dari @BotFather).');
  if (!p.getProperty('SA_KEY') && !p.getProperty('SPREADSHEET_ID')) {
    throw new Error('Isi Script Property SA_KEY (banyak keluarga, lihat docs/PEMILIK.md) atau SPREADSHEET_ID (satu keluarga).');
  }
  // Memastikan akses benar sebelum memasang webhook.
  if (p.getProperty('SA_KEY')) tokenRobot_();
  if (p.getProperty('SPREADSHEET_ID')) {
    pakaiSpreadsheet_(p.getProperty('SPREADSHEET_ID'));
    pengaturan_();
  }

  const url = p.getProperty('WEBAPP_URL') || ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) {
    throw new Error('URL web app tidak ditemukan. Deploy dulu (Deploy → New deployment → Web app), lalu salin URL /exec ke Script Property WEBAPP_URL.');
  }
  let rahasia = p.getProperty('WEBHOOK_SECRET');
  if (!rahasia) {
    rahasia = Utilities.getUuid().replace(/-/g, '');
    p.setProperty('WEBHOOK_SECRET', rahasia);
  }

  hentikanPolling_();
  const r = tg_('setWebhook', { url: url + '?rahasia=' + rahasia, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  if (!r.ok) throw new Error('setWebhook gagal: ' + r.description);
  tg_('setMyCommands', {
    commands: [
      { command: 'saldo', description: 'Saldo semua dompet & tabungan' },
      { command: 'ringkasan', description: 'Ringkasan bulan ini' },
      { command: 'anggaran', description: 'Status anggaran bulan ini' },
      { command: 'terakhir', description: 'Transaksi terakhir' },
      { command: 'bantuan', description: 'Cara memakai bot' },
    ],
  });
  const saya = tg_('getMe', {}).result;
  if (p.getProperty('SPREADSHEET_ID')) simpanPengaturan_('TELEGRAM_BOT', saya.username);
  Logger.log('✅ Bot @' + saya.username + ' terpasang ke ' + url);
  if (p.getProperty('SA_KEY')) {
    Logger.log("Isi web/assets/config.js lalu push: botTelegram: '" + saya.username + "', emailBot: '" + akunRobot_().client_email + "'");
  }
}

/** Cadangan kalau webhook bermasalah: bot mengecek pesan baru setiap 1 menit. */
function modePolling() {
  tg_('deleteWebhook', {});
  hentikanPolling_();
  ScriptApp.newTrigger('ambilPesan').timeBased().everyMinutes(1).create();
  Logger.log('✅ Mode polling aktif (pesan dicek tiap 1 menit). Jalankan pasangWebhook() untuk kembali ke webhook.');
}

function ambilPesan() {
  const p = PropertiesService.getScriptProperties();
  const offset = Number(p.getProperty('POLLING_OFFSET')) || 0;
  const r = tg_('getUpdates', { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  (r.result || []).forEach(u => {
    prosesAman_(u);
    p.setProperty('POLLING_OFFSET', String(u.update_id + 1));
  });
}

function hentikanPolling_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'ambilPesan')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/** Diagnosa: lihat status webhook di Execution log. */
function cekWebhook() {
  Logger.log(JSON.stringify(tg_('getWebhookInfo', {}).result, null, 2));
}

// ======================================================================
// Penerima pesan
// ======================================================================

function doPost(e) {
  // ?api=1: permintaan aktivasi dari aplikasi & halaman admin (web/admin.html), bukan dari Telegram.
  if (e && e.parameter && e.parameter.api) {
    let hasil;
    try {
      hasil = apiLisensi_(JSON.parse(e.postData.contents));
    } catch (err) {
      console.warn('api lisensi: ' + err.message);
      hasil = { galat: err.message };
    }
    return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
  }
  const rahasia = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (rahasia && e && e.parameter && e.parameter.rahasia === rahasia && e.postData) {
    try {
      prosesAman_(JSON.parse(e.postData.contents));
    } catch (err) {
      console.error('doPost: ' + err);
    }
  }
  // HtmlService (bukan ContentService) supaya tidak dijawab dengan redirect.
  return HtmlService.createHtmlOutput('ok');
}

/**
 * ?lisensi=<ID spreadsheet> → { status, alasan, dicabut, kode }, dipakai aplikasi web (tanyaBot_ di web/assets/db.js).
 * Spreadsheet "Pengajuan Aktivasi" adalah satu-satunya sumber kebenaran: status = isi kolom Status baris buku itu
 * ('menunggu' | 'aktif' | 'ditolak' | 'nonaktif'), atau '' kalau bukunya tidak ada di sheet (= belum versi penuh).
 * dicabut = bukan 'aktif' (untuk aplikasi versi lama); kode = kode aktivasi kalau 'aktif'. Tidak membuka data apa pun.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const json = isi => ContentService.createTextOutput(JSON.stringify(isi)).setMimeType(ContentService.MimeType.JSON);
  // ?jual=1 → pengaturan penjualan untuk aplikasi (harga, rekening, kapan ditagih); ?qris=1&rek=<i> → gambar QRIS rekening ke-i.
  if (p.jual) return json(jualPublik_());
  if (p.qris) return json({ qris: gambarQris_(p.rek) });
  const id = String(p.lisensi || '');
  if (id) {
    let isi = { galat: 'ID tidak valid' };
    if (/^[\w-]{20,100}$/.test(id)) {
      const aju = statusPengajuan_(id);
      if (aju.galat) isi = { galat: 'Status belum bisa dibaca. Coba lagi nanti.' }; // aplikasi memakai jawaban terakhirnya
      else {
        const aktif = aju.status === 'aktif';
        isi = { status: aju.status, alasan: aju.alasan, dicabut: !aktif, kode: aktif && properti_('LISENSI_KUNCI') ? tandaTanganLisensi_(id) : '' };
      }
    }
    return ContentService.createTextOutput(JSON.stringify(isi)).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutput('Bot Dompet Keluarga aktif.');
}

/** Telegram bisa mengirim ulang update yang sama; setiap update_id hanya diproses sekali. */
function prosesAman_(update) {
  const cache = CacheService.getScriptCache();
  const kunci = 'upd_' + update.update_id;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  const sudah = cache.get(kunci);
  if (!sudah) cache.put(kunci, '1', 21600);
  lock.releaseLock();
  if (sudah) return;
  mulaiProses_ = Date.now();

  const chatId = update.message ? update.message.chat.id : update.callback_query && update.callback_query.message.chat.id;
  try {
    if (update.callback_query) prosesTombol_(update.callback_query);
    else if (update.message) prosesPesan_(update.message);
  } catch (err) {
    console.error(err && err.stack || err);
    if (chatId) kirim_(chatId, '⚠️ Maaf, ada kesalahan: ' + html_(err.message || String(err)));
  }
  waktu_('selesai');
}

/** Log lama proses sejak update diterima, untuk mencari langkah yang lambat (lihat Executions). */
function waktu_(langkah) {
  console.log('⏱ ' + langkah + ': ' + (Date.now() - mulaiProses_) + ' ms');
}

function prosesPesan_(m) {
  const chatId = m.chat.id;
  const teks = (m.text || m.caption || '').trim();

  // Penautan akun: /start <ID spreadsheet>_<KODE> (tombol di aplikasi), /hubungkan …, atau KODE saja (mode lama).
  // Pemilik boleh menempel pesan berisi baris "/lunas …" di tengahnya: baris itu juga dikenali.
  if (/^\/urlbot(?:@\w+)?$/i.test(teks) && adminTelegram_(m.from.id)) {
    const url = properti_('WEBAPP_URL') || ScriptApp.getService().getUrl();
    return kirim_(chatId, url ? 'URL web app bot (isi ke <code>bayar.urlBot</code> di web/assets/config.js):\n\n<code>' + html_(url) + '</code>'
      : '⚠️ Bot belum di-deploy sebagai web app (Deploy → New deployment → Web app).');
  }
  // Pembelian versi penuh: tombol di aplikasi membuka /start bayar_<ID buku>, lalu pembeli mengirim foto bukti transfer.
  const bayar = teks.match(/^\/start(?:@\w+)?\s+bayar_([\w-]{20,})$/i);
  if (bayar) return mulaiBayar_(m, bayar[1]);
  const tunggu = bayarTertunda_(m.chat.id);
  if (tunggu && tunggu.tahap === 'foto' && !/^\//.test(teks)) return terimaBukti_(m, tunggu);
  const lisensi = teks.match(/^\/(lunas|batal|pulihkan)(?:@\w+)?(?:\s|$)/i)
    || (adminTelegram_(m.from.id) && teks.match(/^\/(lunas)(?:@\w+)?\s/im));
  if (lisensi) return prosesLisensi_(m, lisensi[1].toLowerCase(), teks); // khusus pemilik, tanpa buku

  const tautan = teks.match(/^\/(?:start|hubungkan)(?:@\w+)?\s+(?:([A-Za-z0-9_-]{20,})_)?([A-Z0-9]{6})$/i);
  if (tautan) return hubungkan_(m, tautan[1] || properti_('SPREADSHEET_ID'), tautan[2].toUpperCase());

  const foto = m.photo || (m.document && /^image\//.test(m.document.mime_type || ''));
  const suara = m.voice || m.audio || (m.document && /^audio\//.test(m.document.mime_type || '') ? m.document : null);
  // Dikirim bersamaan dengan membaca data: status "mengetik" (pesan bebas / suara), atau
  // pesan "Membaca struk…" + info file foto (foto), supaya tidak menunggu satu per satu.
  let lain = [];
  if (suara && !foto) {
    lain = [
      permintaanTg_('sendChatAction', { chat_id: chatId, action: 'typing' }),
      permintaanTg_('getFile', { file_id: suara.file_id }),
    ];
  } else if (foto) {
    lain = [
      permintaanTg_('sendMessage', { chat_id: chatId, text: '⏳ Membaca struk…', parse_mode: 'HTML' }),
      permintaanTg_('getFile', { file_id: m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id }),
    ];
  } else if (teks && !/^\//.test(teks)) {
    lain = [permintaanTg_('sendChatAction', { chat_id: chatId, action: 'typing' })];
  }
  // Foto: sheet Transaksi baru dibaca bersamaan dengan AI (lihat prosesFoto_), bukan di awal.
  const buka = bukaUntuk_(m.from.id, chatId, lain, !!foto);
  waktu_('data dimuat');
  if (!buka) return;
  const { d, pengguna } = buka;
  const balasanTg = buka.lain.map(jsonTg_);
  if (!kuotaHarianCukup_()) {
    const pesan = '⏳ Batas ' + BATAS_PESAN_HARIAN + ' pesan per hari untuk buku ini sudah tercapai. Lanjut besok, atau catat lewat aplikasi.';
    if (foto && balasanTg[0].ok) return ubahPesan_(chatId, balasanTg[0].result.message_id, pesan);
    return kirim_(chatId, pesan);
  }

  if (foto) return prosesFoto_(m, pengguna, d, balasanTg[0], balasanTg[1]);
  if (suara) return prosesSuara_(m, suara, pengguna, d, balasanTg[1]);
  if (!teks) return;

  const perintah = teks.match(/^\/(\w+)/);
  if (perintah) {
    const c = perintah[1].toLowerCase();
    if (c === 'start' || c === 'bantuan' || c === 'help') return kirim_(chatId, 'Halo ' + html_(pengguna.nama) + '! ' + BANTUAN);
    if (c === 'saldo') return kirim_(chatId, teksSaldo_(d));
    if (c === 'ringkasan') return kirim_(chatId, teksRingkasan_(d, bulanIni_()));
    if (c === 'anggaran') return kirim_(chatId, teksAnggaran_(d, bulanIni_()));
    if (c === 'terakhir') return kirim_(chatId, teksRiwayat_(d, ''));
    return kirim_(chatId, BANTUAN);
  }

  prosesTeksBebas_(chatId, teks, pengguna, d);
}

/**
 * Kode penautan dibuat aplikasi di sheet Pengaturan spreadsheet itu sendiri (TELEGRAM_KODE), jadi
 * mengetahui ID spreadsheet saja tidak cukup untuk menautkan diri ke keuangan orang lain.
 */
function hubungkan_(m, idSheet, kode) {
  if (!idSheet) {
    return kirim_(m.chat.id, '❌ Kodenya tidak lengkap. Buka aplikasi → ⚙️ → Bot Telegram, lalu ketuk <b>Buka Telegram & hubungkan</b>.');
  }
  pakaiSpreadsheet_(idSheet);
  let p;
  try {
    p = pengaturan_();
  } catch (err) {
    if (err.status !== 403 && err.status !== 404) throw err;
    return kirim_(m.chat.id, '❌ Bot belum bisa membuka spreadsheet ini. Ulangi dari aplikasi: ⚙️ → Bot Telegram → Hubungkan akun Telegram saya.');
  }
  let daftarKode = {};
  try { daftarKode = JSON.parse(p.TELEGRAM_KODE || '{}'); } catch (e) { daftarKode = {}; }
  const k = daftarKode[kode];
  if (!k || k.sampai < Date.now()) {
    return kirim_(m.chat.id, '❌ Kode tidak valid atau sudah kedaluwarsa. Buat kode baru dari aplikasi: ⚙️ → Bot Telegram.');
  }
  delete daftarKode[kode];
  simpanPengaturan_('TELEGRAM_KODE', JSON.stringify(daftarKode));

  const pengguna = penggunaTelegram_(p);
  const nama = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || k.email.split('@')[0];
  pengguna[m.from.id] = { email: k.email, nama, username: m.from.username || '' };
  simpanPengaturan_('TELEGRAM_PENGGUNA', JSON.stringify(pengguna));
  // Satu akun Telegram = satu buku: tautan sebelumnya (kalau ada) diganti.
  if (!modeLama_() || properti_('tg_' + m.from.id)) catatIndeks_(m.from.id, idSheet);
  kirim_(m.chat.id, '✅ Terhubung sebagai <b>' + html_(k.email) + '</b>.\n\n' + BANTUAN);
}

// ======================================================================
// Teks bebas → perintah (Gemini)
// ======================================================================

function prosesTeksBebas_(chatId, teks, pengguna, d) {
  const kunci = kunciGemini_(d.pengaturan);
  const terakhir = d.transaksi.slice().sort((a, b) => b.dibuat.localeCompare(a.dibuat)).slice(0, 8);

  // Pesan sederhana yang kategorinya jelas ("bakso 25rb") langsung dicatat tanpa menunggu AI.
  const cepat = jalurCepat_(teks, d);
  if (cepat) {
    console.log('Jalur cepat: ' + JSON.stringify(cepat));
    return jalankanPerintah_(d, chatId, cepat, terakhir, pengguna, '', '', teks);
  }
  // Pertanyaan murni langsung dijawab dengan data lengkap: satu panggilan AI, bukan dua.
  // Termasuk pertanyaan lanjutan ("kalau 2 porsi?") selama obrolan tanya-jawab masih berjalan.
  if (kunci.length && (pertanyaanMurni_(teks) || (obrolan_(chatId).length && pertanyaanLanjutan_(teks)))) {
    console.log('Pertanyaan langsung');
    return kirim_(chatId, jawabTanya_(d, pengguna, teks, chatId));
  }

  let hasil;
  let tambahan = '';
  if (kunci.length) {
    const model = d.pengaturan.GEMINI_MODEL_CEPAT || MODEL_CEPAT;
    const jawaban = jalankanGemini_(kunci, model, [{ sumber: 'perintah', pikir: PIKIR_PERINTAH, parts: [{ text: petunjukPerintah_(d, terakhir, pengguna, teks, chatId) }] }], skemaPerintah_())[0];
    waktu_('AI menerjemahkan pesan');
    if (jawaban instanceof Error) {
      // AI sedang tidak bisa dipakai: pesan sederhana ("bakso 25rb") tetap dicatat tanpa AI.
      console.warn('AI gagal, pakai tebakan sederhana: ' + jawaban.message);
      hasil = tebakSederhana_(teks, d);
      if (hasil.perintah[0].aksi === 'tidak_jelas') throw jawaban;
      tambahan = '\n\n<i>ℹ️ AI sedang tidak tersedia (' + html_(jawaban.message) + '), jadi dicatat dengan cara sederhana. Periksa kategorinya.</i>';
    } else {
      hasil = jawaban;
      // Model kadang tidak mengisi jumlah; lengkapi dari nominal yang tertulis di pesan.
      const catat = (hasil.perintah || []).filter(x => x && x.aksi === 'catat');
      const nominal = semuaNominal_(teks);
      if (catat.length === nominal.length) {
        catat.forEach((x, i) => { if (!(Number(x.jumlah) > 0)) x.jumlah = nominal[i]; });
      }
    }
  } else {
    hasil = tebakSederhana_(teks, d);
  }
  console.log('Perintah: ' + JSON.stringify(hasil));

  const daftar = (hasil.perintah || []).filter(x => x && x.aksi);
  if (kunci.length && !tambahan && (!daftar.length || daftar.every(x => x.aksi === 'tidak_jelas'))) {
    tg_('sendChatAction', { chat_id: chatId, action: 'typing' });
    return kirim_(chatId, jawabTanya_(d, pengguna, teks, chatId));
  }
  if (!daftar.length || daftar.every(x => x.aksi === 'tidak_jelas')) {
    return kirim_(chatId, htmlTerbatas_(hasil.balasan || 'Maaf, saya belum paham. Contoh: "makan bakso 25rb".') + '\n\nKetik /bantuan untuk contoh lain.');
  }
  // Komentar AI ditempel di konfirmasi catat yang terakhir.
  const iCatatTerakhir = daftar.map(x => x.aksi).lastIndexOf('catat');
  daftar.forEach((x, i) => {
    const ekstra = (i === iCatatTerakhir && hasil.komentar ? '\n\n💬 ' + htmlTerbatas_(hasil.komentar) : '') + tambahan;
    jalankanPerintah_(d, chatId, x, terakhir, pengguna, hasil.balasan, ekstra, teks);
  });
}

function jalankanPerintah_(d, chatId, x, terakhir, pengguna, balasan, tambahan, pesanAsli) {
  const ref = r => {
    const i = Number(String(r || '').replace(/\D/g, '')) - 1;
    return terakhir[i] || null;
  };
  switch (x.aksi) {
    case 'catat': {
      if (kuotaPenuh_(d)) return kirim_(chatId, pesanKunci_());
      const t = siapkanTransaksi_(d, x, pengguna);
      const id = tambahTransaksi_(t, pengguna.email);
      d.transaksi.push(Object.assign({ id, oleh: pengguna.email, dibuat: sekarangIso_() }, t, { tanggal: t.tanggal }));
      return kirim_(chatId, '✅ <b>Tercatat</b>\n' + ringkasTransaksi_(d, t) + peringatanAnggaran_(d, t) + (tambahan || ''),
        [[{ text: '↩️ Batalkan', callback_data: 'batal:' + id }]]);
    }
    case 'ubah': {
      const lama = ref(x.ref);
      if (!lama) return kirim_(chatId, '❓ Transaksi yang mau diubah tidak ditemukan.');
      const baru = siapkanTransaksi_(d, Object.assign({}, lama, bersihkan_(x)), pengguna);
      ubahTransaksi_(lama.id, baru);
      return kirim_(chatId, '✏️ <b>Diubah</b>\n' + ringkasTransaksi_(d, baru));
    }
    case 'hapus': {
      const t = ref(x.ref);
      if (!t) return kirim_(chatId, '❓ Transaksi yang mau dihapus tidak ditemukan.');
      return kirim_(chatId, '🗑️ Hapus transaksi ini?\n' + ringkasTransaksi_(d, t),
        [[{ text: '🗑️ Ya, hapus', callback_data: 'hapus:' + t.id }, { text: 'Tidak', callback_data: 'x' }]]);
    }
    case 'saldo': return kirim_(chatId, teksSaldo_(d));
    case 'ringkasan': return kirim_(chatId, teksRingkasan_(d, /^\d{4}-\d{2}$/.test(x.bulan || '') ? x.bulan : bulanIni_()));
    case 'anggaran': return kirim_(chatId, teksAnggaran_(d, bulanIni_()));
    case 'riwayat': return kirim_(chatId, teksRiwayat_(d, /^\d{4}-\d{2}$/.test(x.bulan || '') ? x.bulan : ''));
    case 'bantuan': return kirim_(chatId, BANTUAN);
    case 'tanya':
      tg_('sendChatAction', { chat_id: chatId, action: 'typing' });
      return kirim_(chatId, jawabTanya_(d, pengguna, x.pertanyaan || pesanAsli, chatId));
    case 'ngobrol':
      catatObrolan_(chatId, pesanAsli, balasan || 'Siap! 😊');
      return kirim_(chatId, htmlTerbatas_(balasan || 'Siap! 😊'));
    default: return kirim_(chatId, htmlTerbatas_(balasan || 'Maaf, saya belum paham.') + '\n\nKetik /bantuan untuk contoh.');
  }
}

/**
 * Menjawab pertanyaan/analisis bebas dengan data keuangan terbaru (termasuk transaksi
 * yang baru dicatat dari pesan yang sama). Angka diambil dari ringkasan yang dihitung kode.
 */
function jawabTanya_(d, pengguna, pertanyaan, chatId) {
  const kunci = kunciGemini_(d.pengaturan);
  if (!kunci.length) return 'Untuk tanya-jawab, AI perlu diaktifkan dulu: tambahkan kunci Gemini di aplikasi (⚙️ → Fitur AI (Gemini)).';
  const riwayat = obrolan_(chatId);
  const prompt = [
    'Kamu asisten AI serba bisa di bot Telegram "Dompet Keluarga" yang ramah, jujur, dan praktis, seperti ngobrol dengan Gemini. Kamu sedang chat dengan ' + pengguna.nama + '.',
    'Sekarang ' + tglPanjang_(hariIni_()) + ' ' + hariIni_().slice(0, 4) + ', pukul ' + Utilities.formatDate(new Date(), TZ, 'HH:mm') + ' WIB.',
    'Jawab dalam bahasa Indonesia santai dan langsung ke inti.',
    '- Pertanyaan tentang keuangan keluarga ini (saldo, pengeluaran, anggaran, tabungan, emas, utang, rencana beli): gunakan HANYA angka dari DATA KEUANGAN di bawah;',
    '  boleh menghitung (selisih, persen, perkiraan) tapi jangan mengarang data. Kalau datanya tidak cukup, katakan terus terang dan sarankan cara mencatatnya. Maksimal 6 kalimat atau poin.',
    '- Pertanyaan atau obrolan di luar keuangan (pengetahuan umum, tanggal & hari, resep, tips, terjemahan, ide, hitung-hitungan, curhat): jawab dengan pengetahuanmu',
    '  seperti asisten AI biasa. Jangan menolak hanya karena tidak ada di data keuangan, dan jangan mengaitkannya ke keuangan kalau tidak diminta.',
    '  Panjang menyesuaikan: obrolan singkat 1–3 kalimat; resep atau penjelasan boleh lengkap (bahan & langkah bernomor), maksimal ±2.500 karakter.',
    '- Untuk hal yang bisa berubah setelah pengetahuanmu (berita, harga pasar selain data di bawah, cuaca), katakan bahwa kamu tidak bisa memastikan kondisi terkini.',
    '- Pakai PERCAKAPAN SEBELUMNYA supaya nyambung (mis. "yang tadi", "kalau 2 porsi?").',
    '- Pertanyaan harga barang ("beras biasanya berapa?", "minyak termurah di mana?", "telur naik nggak?"): pakai RIWAYAT HARGA BARANG (kalau ada di bawah).',
    '  Sebutkan harga, toko, dan tanggalnya. Nama barang boleh dicocokkan secara longgar (mis. "minyak" cocok dengan "Minyak Bimoli 2L").',
    '  Kalau barangnya belum pernah tercatat, katakan terus terang dan sarankan memfoto struk belanjanya supaya tercatat.',
    'FORMAT (dibaca di Telegram, jadi harus rapi dan mudah dipindai):',
    '- Pakai baris baru. Jawaban lebih dari 2 kalimat dipecah jadi paragraf pendek atau daftar, dipisah satu baris kosong antar bagian.',
    '- Judul bagian di barisnya sendiri dan ditebalkan, mis. <b>Bahan-bahan</b>, <b>Cara membuat</b>.',
    '- Daftar (bahan, pilihan, poin) satu butir per baris diawali "• ". Langkah berurutan satu langkah per baris: "1. ", "2. ", dst.',
    '- Boleh <b>tebal</b> untuk angka atau hal penting. Jangan pakai markdown (**, #, tabel) atau tag HTML selain <b> dan <i>. Tulis rupiah seperti Rp25.000.',
    '- Langsung jawab tanpa pembuka panjang; jangan mengulang pertanyaan.',
    '',
    'DATA KEUANGAN:',
    konteksKeuangan_(d),
    '',
    POLA_TANYA_HARGA.test(pertanyaan + ' ' + riwayat.map(x => x.q).join(' ')) ? konteksHarga_(d) + '\n' : '',
    riwayat.length ? 'PERCAKAPAN SEBELUMNYA (terlama dulu):\n' + riwayat.map(x => 'Pengguna: ' + x.q + '\nKamu: ' + x.a).join('\n') + '\n' : '',
    'PESAN PENGGUNA: """' + pertanyaan + '"""',
  ].join('\n');
  const model = d.pengaturan.GEMINI_MODEL_TANYA || 'gemini-flash-latest';
  const h = jalankanGemini_(kunci, model, [{ sumber: 'tanya', pikir: PIKIR_TANYA, parts: [{ text: prompt }] }], null)[0];
  waktu_('AI menjawab pertanyaan');
  if (h instanceof Error) return '⚠️ ' + html_(h.message) + '. Sementara itu, coba /ringkasan atau /anggaran.';
  const jawaban = rapikanJawaban_(h.jawaban || 'Maaf, saya belum bisa menjawab itu.');
  catatObrolan_(chatId, pertanyaan, jawaban);
  return htmlTerbatas_(jawaban);
}

/**
 * Jawaban AI → teks rapi untuk Telegram: markdown diubah (**tebal**, # judul, * / - daftar), dan kalau AI tetap
 * mengirim satu paragraf panjang, daftar bernomor & judul "Bahan:" / "Cara membuat:" dipecah ke baris sendiri.
 */
function rapikanJawaban_(s) {
  let t = String(s || '').replace(/\r/g, '').trim();
  t = t.replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^\*(?!\s)(.+?)\*$/gm, '<b>$1</b>');
  if (t.length > 250 && (t.match(/\n/g) || []).length < 2) {
    t = t
      .replace(/\s*(<b>)?((?:Bahan(?:-bahan)?|Bumbu(?: halus)?|Cara (?:membuat|memasak|membuatnya)|Langkah(?:-langkah)?|Tips|Catatan|Kesimpulan)(?:<\/b>)?\s*:)/gi, '\n\n$1$2')
      .replace(/([.:;!?)])\s+(\d{1,2})\.\s+(?=\S)/g, '$1\n$2. ')
      .replace(/;\s+(?=[a-z0-9½¼¾])/gi, '\n• ')
      .replace(/(:)\s+(?=\d+(?:[\s,]|[.,]\d)|[0-9½¼¾]+\s*(?:gram|g|kg|buah|siung|batang|sdm|sdt|liter|ml|butir|potong|lembar)\b)/gi, '$1\n• ');
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// Ingatan obrolan singkat per chat (CacheService, 1 jam): 6 tanya-jawab terakhir, supaya "yang tadi" nyambung.
const BATAS_OBROLAN = 6;
function obrolan_(chatId) {
  if (!chatId) return [];
  try { return JSON.parse(CacheService.getScriptCache().get('obrolan_' + chatId) || '[]'); } catch (e) { return []; }
}
function catatObrolan_(chatId, q, a) {
  if (!chatId) return;
  try {
    const isi = obrolan_(chatId).concat([{ q: String(q || '').slice(0, 400), a: String(a || '').replace(/<\/?[bi]>/g, '').slice(0, 600) }]).slice(-BATAS_OBROLAN);
    CacheService.getScriptCache().put('obrolan_' + chatId, JSON.stringify(isi), 3600);
  } catch (e) { /* ingatan tidak penting */ }
}

/** Ringkasan data untuk AI: semua angka dihitung di sini supaya AI tidak salah menjumlah. */
function konteksKeuangan_(d) {
  const s = nilaiSekarang_(d);
  const emas = infoEmas_(d);
  const ini = bulanIni_();
  const lalu = bulanSebelum_(ini);
  const a = ringkasBulan_(d, ini);
  const b = ringkasBulan_(d, lalu);
  const tigaBulan = [1, 2, 3].map(n => { let x = ini; for (let i = 0; i < n; i++) x = bulanSebelum_(x); return ringkasBulan_(d, x).keluar; });
  const nama = email => email.split('@')[0];
  const { hariKe, jumlahHari } = posisiPeriode_();

  const kategoriBulanIni = d.kategori.filter(k => k.tipe === TIPE.KELUAR && (a.per[k.nama] || k.anggaran)).map(k => {
    const pakai = a.per[k.nama] || 0;
    return '- ' + k.nama + ': ' + rp_(pakai) + (k.anggaran ? ' (anggaran ' + rp_(k.anggaran) + ', terpakai ' + Math.round(pakai / k.anggaran * 100) + '%, sisa ' + rp_(k.anggaran - pakai) + ')' : '');
  });
  return [
    'Hari ini ' + hariIni_() + ' (hari ke-' + hariKe + ' dari ' + jumlahHari + ' hari periode ini).'
      + (mulaiPeriode_ > 1 ? ' "Bulan" di data ini = periode gajian yang mulai tanggal ' + mulaiPeriode_ + '.' : ''),
    'Saldo dompet: ' + d.dompet.filter(w => w.jenis === JENIS.DOMPET).map(w => w.nama + ' ' + rp_(s[w.nama])).join(', ')
      + '. Total ' + rp_(d.dompet.filter(w => w.jenis === JENIS.DOMPET).reduce((x, w) => x + s[w.nama], 0)) + '.',
    'Tabungan: ' + (d.dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama + ' ' + rp_(s[w.nama])
      + (w.target ? ' dari target ' + rp_(w.target) + (w.tenggat ? ' (tenggat ' + w.tenggat + ')' : '') : ' (tanpa target)')).join('; ') || 'belum ada') + '.',
    'Utang-piutang: ' + (d.dompet.filter(w => w.jenis === JENIS.UTANG && s[w.nama]).map(w => w.nama
      + (s[w.nama] > 0 ? ' berutang ke kita ' + rp_(s[w.nama]) : ': kita berutang ' + rp_(-s[w.nama]))
      + (w.tenggat ? ' (jatuh tempo ' + w.tenggat + ')' : '')).join('; ') || 'tidak ada') + '.',
    'Aset: ' + (d.dompet.filter(w => w.jenis === JENIS.ASET && !emas[w.nama]).map(w => w.nama + ' ' + rp_(s[w.nama])).join(', ') || (Object.keys(emas).length ? '(selain emas) tidak ada' : 'belum ada'))
      + '.' + (Object.keys(emas).length ? '\nEmas (dicatat dalam gram; nilainya dari harga hari ini):\n' + Object.keys(emas).map(n => '- ' + teksEmasUntukAi_(n, emas[n])).join('\n')
        + '\nTotal emas: ' + gram_(Object.keys(emas).reduce((x, n) => x + emas[n].gram, 0)) + '.' : '')
      + ' Kekayaan bersih (semua dompet, tabungan, aset, piutang − utang): ' + rp_(d.dompet.reduce((x, w) => x + (s[w.nama] || 0), 0)) + '.',
    '',
    'BULAN INI (' + namaBulan_(ini) + '): pemasukan ' + rp_(a.masuk) + ', pengeluaran ' + rp_(a.keluar) + ', selisih ' + rp_(a.masuk - a.keluar) + '.',
    'Pengeluaran per kategori bulan ini:',
    kategoriBulanIni.join('\n') || '- (belum ada)',
    '',
    'BULAN LALU (' + namaBulan_(lalu) + '): pemasukan ' + rp_(b.masuk) + ', pengeluaran ' + rp_(b.keluar) + '.',
    'Per kategori bulan lalu: ' + (Object.keys(b.per).map(n => n + ' ' + rp_(b.per[n])).join(', ') || '(belum ada)') + '.',
    'Pengeluaran 3 bulan sebelumnya (terbaru dulu): ' + tigaBulan.map(rp_).join(', ') + '.',
    '',
    'Transaksi bulan ini (terbaru dulu, maks 25):',
    a.trx.slice().sort((x, y) => y.tanggal.localeCompare(x.tanggal) || y.dibuat.localeCompare(x.dibuat)).slice(0, 25)
      .map(t => '- ' + t.tanggal + ' ' + t.tipe + ' ' + rp_(t.jumlah) + ' ' + (t.tipe === TIPE.TRANSFER ? t.dompet + ' → ' + t.dompetTujuan : t.kategori)
        + (t.catatan ? ' (' + t.catatan + ')' : '') + (t.oleh ? ' oleh ' + nama(t.oleh) : '')).join('\n') || '- (belum ada)',
  ].join('\n');
}

/**
 * Konteks ringkas untuk menerjemahkan pesan: cukup untuk komentar singkat setelah mencatat
 * (anggaran, berapa kali jajan serupa, banding bulan lalu). Prompt pendek = AI menjawab lebih cepat.
 */
function konteksRingkas_(d) {
  const ini = bulanIni_();
  const a = ringkasBulan_(d, ini);
  const b = ringkasBulan_(d, bulanSebelum_(ini));
  const { hariKe, jumlahHari } = posisiPeriode_();
  const baris = d.kategori.filter(k => k.tipe === TIPE.KELUAR && (a.per[k.nama] || b.per[k.nama] || k.anggaran)).map(k => {
    const pakai = a.per[k.nama] || 0;
    return '- ' + k.nama + ': ' + rp_(pakai) + ' (' + (a.kali[k.nama] || 0) + 'x)'
      + (k.anggaran ? ', anggaran ' + rp_(k.anggaran) + ' terpakai ' + Math.round(pakai / k.anggaran * 100) + '%' : '')
      + ', bulan lalu ' + rp_(b.per[k.nama] || 0);
  });
  return [
    'Hari ke-' + hariKe + ' dari ' + jumlahHari + ' hari periode ini. Pengeluaran bulan ini ' + rp_(a.keluar) + ', bulan lalu ' + rp_(b.keluar) + '.',
    'Pengeluaran per kategori bulan ini:',
    baris.join('\n') || '- (belum ada)',
  ].join('\n');
}

/** Transaksi, total, dan pengeluaran per kategori (jumlah & berapa kali) dalam satu periode. */
function ringkasBulan_(d, b) {
  const trx = d.transaksi.filter(t => periode_(t.tanggal) === b);
  const per = {};
  const kali = {};
  trx.filter(t => t.tipe === TIPE.KELUAR).forEach(t => {
    per[t.kategori] = (per[t.kategori] || 0) + t.jumlah;
    kali[t.kategori] = (kali[t.kategori] || 0) + 1;
  });
  return {
    trx,
    per,
    kali,
    masuk: trx.filter(t => t.tipe === TIPE.MASUK).reduce((a, t) => a + t.jumlah, 0),
    keluar: trx.filter(t => t.tipe === TIPE.KELUAR).reduce((a, t) => a + t.jumlah, 0),
  };
}

/** Hari ke-berapa di periode berjalan (periode bisa mulai tanggal gajian, bukan tanggal 1). */
function posisiPeriode_() {
  const [th, bl] = bulanIni_().split('-').map(Number);
  const awal = new Date(th, bl - 1, mulaiPeriode_);
  return {
    jumlahHari: Math.round((new Date(th, bl, mulaiPeriode_) - awal) / 864e5),
    hariKe: Math.round((keTanggal_(hariIni_()) - awal) / 864e5) + 1,
  };
}

function bulanSebelum_(b) {
  const [y, m] = b.split('-').map(Number);
  return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
}

/** Teks dari AI: semua di-escape, lalu hanya <b>/<i> yang seimbang yang dikembalikan. */
function htmlTerbatas_(s) {
  let t = html_(String(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')).replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>');
  const seimbang = tag => (t.match(new RegExp('<' + tag + '>', 'g')) || []).length === (t.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  if (!seimbang('b') || !seimbang('i')) t = t.replace(/<\/?(b|i)>/g, '');
  return t;
}

/** Ambil hanya field yang diisi Gemini (untuk "ubah"). */
function bersihkan_(x) {
  const o = {};
  ['tipe', 'jumlah', 'kategori', 'dompet', 'dompetTujuan', 'tanggal', 'catatan'].forEach(k => {
    if (x[k] !== undefined && x[k] !== null && x[k] !== '' && x[k] !== 0) o[k] = x[k];
  });
  return o;
}

function petunjukPerintah_(d, terakhir, pengguna, pesan, chatId) {
  const hariIni = hariIni_();
  const riwayat = obrolan_(chatId);
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
  const nama = tp => d.kategori.filter(k => k.tipe === tp).map(k => k.nama).join(', ');
  return [
    'Kamu asisten pencatat keuangan keluarga "Dompet Keluarga". Terjemahkan pesan pengguna menjadi perintah JSON.',
    'Hari ini ' + hari + ', ' + hariIni + '. Pengguna: ' + pengguna.nama + '.',
    'Kategori pengeluaran: ' + nama(TIPE.KELUAR),
    'Kategori pemasukan: ' + nama(TIPE.MASUK),
    'Dompet: ' + d.dompet.filter(w => w.jenis === JENIS.DOMPET).map(w => w.nama).join(', '),
    'Tabungan: ' + (d.dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama).join(', ') || '(belum ada)'),
    'Aset/investasi (beli = Transfer dari dompet ke aset): ' + (d.dompet.filter(w => w.jenis === JENIS.ASET).map(w => w.nama).join(', ') || '(belum ada)'),
    'Transaksi terakhir (ref | tanggal | tipe | jumlah | kategori | dompet → tujuan | catatan):',
    terakhir.map((t, i) => 'T' + (i + 1) + ' | ' + t.tanggal + ' | ' + t.tipe + ' | ' + t.jumlah + ' | ' + t.kategori + ' | ' + t.dompet
      + (t.dompetTujuan ? ' → ' + t.dompetTujuan : '') + ' | ' + t.catatan).join('\n') || '(belum ada)',
    '',
    'Aturan:',
    '- Selalu isi jumlah (rupiah bulat). Untuk aksi selain "catat"/"ubah", atau jika nominal tidak berubah, isi 0.',
    '- "catat": transaksi baru. jumlah dalam rupiah bulat: 25rb/25k = 25000, 1,5jt = 1500000, goceng = 5000, ceban = 10000, gopek = 500.',
    '  tipe Pengeluaran, kecuali jelas pemasukan (gaji, terima, dapat, bonus) atau perpindahan uang antar dompet/setor/tarik tabungan (tipe Transfer: isi dompet asal & dompetTujuan).',
    '  kategori: pilih yang paling cocok dari daftar sesuai tipe (kosongkan untuk Transfer). dompet: isi hanya jika disebut, pakai nama persis dari daftar.',
    '  tanggal yyyy-mm-dd hanya jika disebut (kemarin, tgl 5, Senin lalu). catatan: deskripsi singkat, mis. "bakso", "bensin motor".',
    '- Satu pesan bisa berisi beberapa transaksi → beberapa perintah.',
    '- "ubah": ubah transaksi yang sudah ada. ref = T1 untuk yang paling terakhir, atau pilih yang cocok dengan deskripsi. Isi hanya field yang berubah.',
    '- "hapus": isi ref.',
    '- "saldo", "ringkasan" (isi bulan yyyy-mm jika disebut), "riwayat", "anggaran": hanya untuk permintaan laporan standar (mis. "/saldo", "lihat ringkasan").',
    '- "tanya": pertanyaan APA PUN yang butuh jawaban: tentang keuangan (mis. "boros di mana?", "bandingkan dengan bulan lalu", "aman beli HP 3jt?",',
    '  "emasku berapa gram?") MAUPUN di luar keuangan (mis. "hari ini tanggal berapa", "resep sop ayam", "arti kata X", "ide kado", "terjemahkan ini").',
    '  Isi pertanyaan dengan pertanyaan lengkapnya. Jangan pakai "tidak_jelas" untuk pertanyaan di luar keuangan.',
    '  Kalau pesan berisi catat sekaligus pertanyaan, buat "catat" dulu lalu "tanya".',
    '- "ngobrol": hanya sapaan, terima kasih, atau basa-basi pendek → isi balasan dengan jawaban ramah dan natural (1–2 kalimat). Pertanyaan atau curhat yang butuh jawaban → "tanya".',
    '- "bantuan": jika pengguna bertanya cara memakai bot.',
    '- "tidak_jelas": hanya jika benar-benar tidak bisa dipahami; isi balasan dengan pertanyaan klarifikasi yang ramah.',
    '- komentar: jika ada "catat", boleh isi 1 kalimat singkat yang relevan dan bermanfaat berdasarkan DATA (mis. anggaran kategori itu hampir habis,',
    '  sudah beberapa kali jajan serupa bulan ini, pengeluaran lebih hemat dari bulan lalu). Santai dan tidak menggurui. Kosongkan jika tidak ada yang menarik.',
    '  Jangan mengulang rincian transaksi; rincian sudah ditampilkan sistem.',
    '',
    'RINGKASAN BULAN INI (sebelum pesan ini diproses):',
    konteksRingkas_(d),
    '',
    riwayat.length ? 'OBROLAN SEBELUMNYA (terlama dulu). Pesan yang melanjutkan obrolan ini (mis. "kalau 2 porsi?", "yang kedua gimana?", "lanjut") → "tanya":\n'
      + riwayat.map(x => 'Pengguna: ' + x.q + '\nBot: ' + String(x.a).slice(0, 200)).join('\n') + '\n' : '',
    'Pesan: """' + pesan + '"""',
  ].join('\n');
}

function skemaPerintah_() {
  return {
    type: 'OBJECT',
    properties: {
      perintah: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            aksi: { type: 'STRING', enum: ['catat', 'ubah', 'hapus', 'saldo', 'ringkasan', 'riwayat', 'anggaran', 'tanya', 'ngobrol', 'bantuan', 'tidak_jelas'] },
            tipe: { type: 'STRING', enum: [TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER] },
            jumlah: { type: 'INTEGER' },
            kategori: { type: 'STRING' },
            dompet: { type: 'STRING' },
            dompetTujuan: { type: 'STRING' },
            tanggal: { type: 'STRING' },
            catatan: { type: 'STRING' },
            ref: { type: 'STRING' },
            bulan: { type: 'STRING' },
            pertanyaan: { type: 'STRING' },
          },
          required: ['aksi', 'jumlah'],
        },
      },
      balasan: { type: 'STRING' },
      komentar: { type: 'STRING' },
    },
    required: ['perintah'],
  };
}

const POLA_NOMINAL = /(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?\b/gi;

/** "25rb" → 25000, "1,5jt" → 1500000, "25.000" → 25000. */
function nominal_(angka, satuan) {
  let n = Number(angka.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
  const s = (satuan || '').toLowerCase();
  if (s === 'rb' || s === 'ribu' || s === 'k') n *= 1000;
  if (s === 'jt' || s === 'juta') n *= 1e6;
  return Math.round(n);
}

/** Semua nominal uang di pesan, urut kemunculan. Angka kecil tanpa satuan (jumlah barang) diabaikan. */
function semuaNominal_(teks) {
  const hasil = [];
  let m;
  POLA_NOMINAL.lastIndex = 0;
  while ((m = POLA_NOMINAL.exec(teks))) {
    const n = nominal_(m[1], m[2]);
    if (m[2] || n >= 100) hasil.push(n);
  }
  return hasil;
}

/** Tanpa AI: "bakso 25rb" / "25rb bakso" dicatat sebagai pengeluaran. */
function tebakSederhana_(teks, d) {
  POLA_NOMINAL.lastIndex = 0;
  const m = POLA_NOMINAL.exec(teks);
  if (!m) return { perintah: [{ aksi: 'tidak_jelas' }], balasan: 'Sebutkan nominalnya, mis. "bakso 25rb". (AI belum aktif: tambahkan kunci Gemini di aplikasi.)' };
  const n = nominal_(m[1], m[2]);
  const catatan = teks.replace(m[0], '').replace(/\s+/g, ' ').trim();
  const masuk = /\b(gaji|terima|dapat|bonus|masuk)\b/i.test(teks);
  const tipe = masuk ? TIPE.MASUK : TIPE.KELUAR;
  const kat = d.kategori.find(k => k.tipe === tipe && catatan.toLowerCase().indexOf(k.nama.toLowerCase().split(' ')[0]) >= 0);
  return { perintah: [{ aksi: 'catat', tipe, jumlah: Math.round(n), kategori: kat ? kat.nama : '', catatan }] };
}

/** Kata yang membuat pesan perlu dipahami AI (ubah/hapus, tanggal, dompet, pemasukan, beberapa transaksi, dll.). */
const BUTUH_AI = /\b(ubah|ganti|edit|hapus|batal|batalkan|transfer|pindah|setor|tarik|dari|ke|kemarin|kmrn|lusa|tgl|tanggal|lalu|minggu|senin|selasa|rabu|kamis|jumat|sabtu|utang|hutang|pinjam|pinjem|terima|dapat|dapet|masuk|gaji|bonus|jual|refund|kembalian|patungan|bagi|berdua|bertiga|dan|terus|pakai|pake|via|per|tiap)\b/;

/**
 * Pengeluaran sangat sederhana ("bakso 25rb", "parkir 5rb") dicatat tanpa AI supaya instan.
 * Hanya kalau persis satu nominal, catatannya pendek, dan tepat satu kelompok kategori cocok;
 * selain itu null (diserahkan ke AI).
 */
function jalurCepat_(teks, d) {
  const kecil = teks.toLowerCase();
  if (/[?\n]/.test(teks) || BUTUH_AI.test(kecil)) return null;
  if (d.dompet.some(w => kecil.indexOf(w.nama.toLowerCase()) >= 0)) return null;
  const nominal = semuaNominal_(teks);
  if (nominal.length !== 1 || (teks.match(POLA_NOMINAL) || []).length !== 1) return null;

  const catatan = teks.replace(POLA_NOMINAL, ' ').replace(/\s+/g, ' ').trim();
  if (!catatan || catatan.split(' ').length > 4) return null;
  const kata = ' ' + kecil.replace(/[^a-z0-9 ]/g, ' ') + ' ';
  const grup = KATA_KATEGORI.filter(g => new RegExp('\\b(?:' + g[0].source + ')\\b').test(kata));
  if (grup.length !== 1 || /gaji|bonus/.test(grup[0][1][0])) return null;
  const k = d.kategori.find(k => k.tipe === TIPE.KELUAR && grup[0][1].some(w => k.nama.toLowerCase().indexOf(w) >= 0));
  if (!k) return null;
  return { aksi: 'catat', tipe: TIPE.KELUAR, jumlah: nominal[0], kategori: k.nama, catatan };
}

/**
 * Pesan yang jelas berupa pertanyaan/analisis tanpa transaksi untuk dicatat. Pesan campuran
 * ("catat makan 40rb, sisa anggaran berapa?") tetap lewat penerjemah supaya dicatat dulu.
 */
/** "kalau 2 porsi?", "yang kedua?", "terus?", "lanjut" — pendek, tanpa kata perintah & tanpa nominal rupiah. */
function pertanyaanLanjutan_(teks) {
  const kecil = teks.toLowerCase().trim();
  if (kecil.split(/\s+/).length > 12) return false;
  if (/\b(catat|ubah|ganti|edit|hapus|batal|batalkan|beli|bayar|gaji|transfer|setor|tarik)\b/.test(kecil)) return false;
  if (/\d\s*(rb|ribu|k|jt|juta)\b|rp\s*\d/.test(kecil)) return false;
  return /\?\s*$/.test(kecil) || /^(kalau|kalo|terus|lalu|lanjut|yang|bagaimana|gimana|kenapa|apa|berapa|bisa|boleh|coba|jelaskan|contoh|misal|selain)\b/.test(kecil);
}

function pertanyaanMurni_(teks) {
  const kecil = teks.toLowerCase();
  if (/\b(catat|ubah|ganti|edit|hapus|batal|batalkan|tadi)\b/.test(kecil)) return false;
  // Andaian boleh menyebut nominal: "aman nggak beli HP 3 juta?", "kalau nabung 500rb sebulan, kapan…?"
  if (/\?\s*$/.test(kecil) && /\b(kalau|kalo|seandainya|misal|misalnya|aman|cukup)\b/.test(kecil)) return true;
  // Tanya harga barang: "beras biasanya beli berapa?", "harga minyak termurah di mana".
  if (!semuaNominal_(teks).length && /\b(harga|termurah|termahal|biasanya)\b/.test(kecil) && (/\?\s*$/.test(kecil) || /\b(berapa|mana|naik|turun)\b/.test(kecil))) return true;
  if (semuaNominal_(teks).length || /\b(beli|bayar)\b/.test(kecil)) return false;
  if (kecil.split(/\s+/).length < 3) return false;
  return /\?\s*$/.test(kecil)
    || /^(berapa|kapan|gimana|bagaimana|apa|apakah|kenapa|mengapa|kok|bandingkan|banding|analisis|analisa|saran|tips|cek)\b/.test(kecil)
    || /\b(boros|hemat|aman (nggak|ngga|ga|gak|tidak)|cukup (nggak|ngga|ga|gak|tidak)|sisa anggaran|rata-rata|dibanding)\b/.test(kecil);
}

// ======================================================================
// Foto struk
// ======================================================================

/** `jTunggu`, `jFile`: jawaban sendMessage "Membaca struk…" dan getFile yang dikirim bersamaan dengan memuat data. */
function prosesFoto_(m, pengguna, d, jTunggu, jFile) {
  const chatId = m.chat.id;
  const tunggu = jTunggu && jTunggu.ok ? jTunggu.result : kirim_(chatId, '⏳ Membaca struk…').result;
  const info = jFile && jFile.ok ? jFile.result
    : tg_('getFile', { file_id: m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id }).result;
  if (!info || !info.file_path) return ubahPesan_(chatId, tunggu.message_id, '❌ Foto tidak bisa diunduh dari Telegram. Coba kirim ulang.');
  const blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + properti_('TELEGRAM_TOKEN') + '/' + info.file_path).getBlob();
  const mime = /\.png$/i.test(info.file_path) ? 'image/png' : 'image/jpeg';
  waktu_('foto diunduh');

  const kategori = d.kategori.filter(k => k.tipe === TIPE.KELUAR).map(k => k.nama);
  // Transaksi baru dibutuhkan sesudah struk terbaca (dompet default & peringatan anggaran),
  // jadi dibaca bersamaan dengan AI foto supaya waktunya tertutup oleh waktu AI.
  const ekstra = { minta: [mintaTransaksi_(), mintaHarga_()], jawaban: null };
  let h;
  try {
    h = bacaStruk_(Utilities.base64Encode(blob.getBytes()), mime, kategori, kunciGemini_(d.pengaturan), d.pengaturan.GEMINI_MODEL || MODEL_GEMINI, ekstra);
  } catch (err) {
    return ubahPesan_(chatId, tunggu.message_id, '❌ ' + html_(err.message));
  }
  d.transaksi = olahJawabanTransaksi_(ekstra.jawaban ? ekstra.jawaban[0] : UrlFetchApp.fetchAll([mintaTransaksi_()])[0]);
  const hargaLama = olahHarga_(ekstra.jawaban ? ekstra.jawaban[1] : null, d.transaksi);
  waktu_('transaksi siap');
  if (kuotaPenuh_(d)) return ubahPesan_(chatId, tunggu.message_id, pesanKunci_());

  // Keterangan foto bisa menyebut dompet ("pakai gopay") atau catatan tambahan.
  const ket = (m.caption || '').trim();
  const dompet = d.dompet.find(w => ket && ket.toLowerCase().indexOf(w.nama.toLowerCase()) >= 0);
  const t = siapkanTransaksi_(d, {
    tipe: TIPE.KELUAR, jumlah: h.jumlah, kategori: h.kategori, tanggal: h.tanggal,
    dompet: dompet ? dompet.nama : '', catatan: [h.catatan, dompet ? '' : ket].filter(Boolean).join(' · '),
  }, pengguna);
  const id = tambahTransaksi_(t, pengguna.email);
  const infoBarang = h.barang.length && catatHarga_(t, id, h, pengguna.email) ? teksBarangStruk_(h.barang, hargaLama, t.tanggal) : '';
  // Supaya peringatan anggaran di bawah ikut menghitung struk ini.
  d.transaksi.push(Object.assign({ id, oleh: pengguna.email, dibuat: sekarangIso_() }, t));

  const tombol = [];
  // Kalau lapis-lapis tidak sepakat, tampilkan pilihan nominal (sama seperti di aplikasi).
  if (h.pilihanJumlah.length > 1) {
    tombol.push(h.pilihanJumlah.slice(0, 3).map(p => ({ text: (p.jumlah === t.jumlah ? '✓ ' : '') + rp_(p.jumlah), callback_data: 'jml:' + id + ':' + p.jumlah })));
  }
  tombol.push([{ text: '↩️ Batalkan', callback_data: 'batal:' + id }]);
  const status = h.yakin
    ? '✅ Total cocok di ' + h.pilihanJumlah[0].sumber.length + ' cara baca'
    : '⚠️ Hasil kurang pasti (' + h.lapis.join(', ') + '). Periksa totalnya' + (h.pilihanJumlah.length > 1 ? ', atau pilih di bawah.' : '.');
  ubahPesan_(chatId, tunggu.message_id, '🧾 <b>Struk tercatat</b>\n' + ringkasTransaksi_(d, t) + '\n<i>' + status + '</i>'
    + peringatanAnggaran_(d, t) + infoBarang + '\n\nSalah? Balas mis. <i>"yang terakhir ubah jadi 45rb"</i>.', tombol);
}

// ======================================================================
// Riwayat harga barang (sheet "Harga", sama dengan aplikasi)
// ======================================================================

const KOLOM_HARGA = ['Tanggal', 'Toko', 'Barang', 'Harga', 'Jumlah', 'ID Transaksi', 'Dibuat Oleh'];
const kunciBarang_ = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Permintaan baca sheet Harga (bisa ikut dikirim bersamaan dengan permintaan lain). */
function mintaHarga_() {
  return sheetsApi_('/values/' + range_("'Harga'!A2:G") + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
}

/**
 * Jawaban mintaHarga_ → [{ tanggal, toko, nama, harga, jumlah, idTrx }] terbaru dulu. Sheet belum ada / gagal → [].
 * transaksi: baris yang transaksinya sudah dihapus diabaikan (sama dengan aplikasi).
 */
function olahHarga_(res, transaksi) {
  if (!res || res.getResponseCode() !== 200) return [];
  const ada = {};
  (transaksi || []).forEach(t => { ada[t.id] = true; });
  return rapikanBaris_(JSON.parse(res.getContentText() || '{}').values, KOLOM_HARGA.length)
    .filter(r => r[2] !== '' && Number(r[3]) > 0 && (!transaksi || !r[5] || ada[String(r[5])]))
    .map(r => ({ tanggal: tgl_(r[0]), toko: String(r[1]), nama: String(r[2]), harga: Number(r[3]), jumlah: Number(r[4]) || 1, idTrx: String(r[5]) }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Riwayat harga untuk tanya-jawab, dibaca sekali per pesan. */
function riwayatHarga_(d) {
  if (d.harga_) return d.harga_;
  let res = null;
  try { res = UrlFetchApp.fetchAll([mintaHarga_()])[0]; } catch (e) { console.warn('Riwayat harga tidak bisa dibaca: ' + e); }
  return (d.harga_ = olahHarga_(res, d.transaksi));
}

/** Barang struk dicatat ke sheet Harga (dibuat kalau belum ada). Tidak wajib: gagal → transaksi tetap tercatat. */
function catatHarga_(t, idTrx, struk, email) {
  const toko = struk.toko || String(t.catatan || '').split(/\s+-\s+/)[0].slice(0, 60);
  const values = struk.barang.map(x => [keSerial_(t.tanggal), toko, x.nama, x.harga, x.jumlah, idTrx, email]);
  const tambah = () => sheets_('/values/' + range_("'Harga'!A1") + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', jsonSheets_('post', { values }));
  try {
    tambah();
    return true;
  } catch (e) {
    if (e.status !== 400) { console.warn('Riwayat harga tidak tersimpan: ' + e.message); return false; }
  }
  // 400 = sheet Harga belum ada (buku belum dibuka dengan aplikasi versi baru): buat dulu, sama seperti aplikasi.
  try {
    const r = sheets_(':batchUpdate', jsonSheets_('post', { requests: [{ addSheet: { properties: { title: 'Harga', gridProperties: { frozenRowCount: 1 } } } }] }));
    const sheetId = r.replies[0].addSheet.properties.sheetId;
    const format = (awal, type, pattern) => ({ repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: awal, endColumnIndex: awal + 1 },
      cell: { userEnteredFormat: { numberFormat: { type, pattern } } }, fields: 'userEnteredFormat.numberFormat',
    } });
    sheets_(':batchUpdate', jsonSheets_('post', { requests: [format(0, 'DATE', 'yyyy-mm-dd'), format(3, 'NUMBER', '#,##0')] }));
    sheets_('/values/' + range_("'Harga'!A1") + '?valueInputOption=RAW', jsonSheets_('put', { values: [KOLOM_HARGA] }));
    tambah();
    return true;
  } catch (e) {
    console.warn('Sheet Harga tidak bisa dibuat: ' + e.message);
    return false;
  }
}

/** "🏷️ 8 barang masuk riwayat harga. Harga berubah: • Minyak 2L Rp38.000 🔺Rp2.500 (terakhir Rp35.500 di Alfamart, 3 Okt)". */
function teksBarangStruk_(barang, lama, tanggal) {
  const berubah = [];
  barang.forEach(x => {
    const k = kunciBarang_(x.nama);
    const p = lama.find(y => kunciBarang_(y.nama) === k && y.tanggal <= tanggal);
    if (!p || p.harga === x.harga) return;
    berubah.push('• ' + html_(x.nama) + ' <b>' + rp_(x.harga) + '</b> ' + (x.harga > p.harga ? '🔺' : '🔻') + rp_(Math.abs(x.harga - p.harga))
      + ' <i>(terakhir ' + rp_(p.harga) + (p.toko ? ' di ' + html_(p.toko) : '') + ', ' + tglPendek_(p.tanggal) + ')</i>');
  });
  return '\n\n🏷️ ' + barang.length + ' barang masuk riwayat harga' + (berubah.length
    ? '. Harga berubah dari pembelian terakhir:\n' + berubah.slice(0, 6).join('\n') + (berubah.length > 6 ? '\n• … dan ' + (berubah.length - 6) + ' lainnya' : '')
    : '.');
}

/** Pertanyaan yang kemungkinan butuh riwayat harga ("beras biasanya berapa?", "minyak termurah di mana?"). */
const POLA_TANYA_HARGA = /harga|murah|mahal|naik|turun|toko|beli|belanja|biasanya|struk|indomaret|alfamart|superindo|hypermart|transmart|lotte|pasar|warung/i;

/** Ringkasan riwayat harga per barang untuk AI (paling banyak 150 barang yang terakhir dibeli). */
function konteksHarga_(d) {
  const daftar = riwayatHarga_(d);
  if (!daftar.length) return 'RIWAYAT HARGA BARANG: belum ada (barang & harga tercatat otomatis saat struk belanja difoto, di aplikasi atau dikirim ke bot ini).';
  const per = {};
  const urut = [];
  daftar.forEach(x => {
    const k = kunciBarang_(x.nama);
    if (!per[k]) { per[k] = []; urut.push(k); }
    per[k].push(x);
  });
  const baris = urut.slice(0, 150).map(k => {
    const b = per[k];
    const akhir = b[0];
    const di = x => rp_(x.harga) + (x.toko ? ' di ' + x.toko : '') + ' (' + x.tanggal + ')';
    if (b.length === 1) return '- ' + akhir.nama + ': ' + di(akhir);
    const murah = b.reduce((a, x) => (x.harga < a.harga ? x : a));
    const rata = Math.round(b.reduce((a, x) => a + x.harga, 0) / b.length);
    return '- ' + akhir.nama + ': terakhir ' + di(akhir) + '; termurah ' + di(murah) + '; rata-rata ' + rp_(rata) + '; ' + b.length + '× beli';
  });
  return 'RIWAYAT HARGA BARANG (dari struk; harga per satuan, terbaru dulu):\n' + baris.join('\n');
}

// ======================================================================
// Pesan suara (voice note) → teks → diproses seperti pesan biasa
// ======================================================================

const BATAS_SUARA_DETIK = 90;
const PETUNJUK_SUARA = [
  'Tuliskan persis apa yang diucapkan di rekaman suara ini. Bahasanya Indonesia, mungkin bercampur bahasa daerah atau Inggris.',
  'Ini pesan ke bot pencatat keuangan keluarga, jadi biasanya berisi catatan pengeluaran/pemasukan, perintah ubah/hapus, atau pertanyaan.',
  'Aturan:',
  '- Nominal uang ditulis singkat dengan angka seperti saat chat: "tiga puluh ribu" → "30rb", "dua ratus lima puluh ribu" → "250rb", "satu setengah juta" → "1,5jt", "lima belas ribu lima ratus" → "15.500".',
  '- Bilangan lain juga pakai angka ("dua porsi" → "2 porsi", "tanggal lima" → "tanggal 5").',
  '- Nama dompet / aplikasi ditulis seperti biasa (GoPay, OVO, DANA, ShopeePay, BCA, BRI, Mandiri).',
  '- Jangan menjawab, menambah, atau menjelaskan apa pun. Keluarkan HANYA transkripnya dalam satu baris, tanpa tanda kutip.',
  '- Kalau tidak ada ucapan yang jelas, keluarkan persis: (tidak jelas)',
].join('\n');

/** jFile: jawaban getFile yang dikirim bersamaan dengan memuat data. */
function prosesSuara_(m, suara, pengguna, d, jFile) {
  const chatId = m.chat.id;
  const kunci = kunciGemini_(d.pengaturan);
  if (!kunci.length) {
    return kirim_(chatId, '🎤 Untuk pesan suara, AI perlu diaktifkan dulu: tambahkan kunci Gemini di aplikasi (⚙️ → Fitur AI (Gemini)). Sementara itu, ketik saja, mis. <i>bensin 30rb</i>.');
  }
  if ((suara.duration || 0) > BATAS_SUARA_DETIK) {
    return kirim_(chatId, '🎤 Pesan suaranya terlalu panjang (maks ' + BATAS_SUARA_DETIK + ' detik). Coba lebih singkat, mis. <i>"bensin tiga puluh ribu pakai gopay"</i>.');
  }
  const info = jFile && jFile.ok ? jFile.result : tg_('getFile', { file_id: suara.file_id }).result;
  if (!info || !info.file_path) return kirim_(chatId, '❌ Pesan suara tidak bisa diunduh dari Telegram. Coba kirim ulang.');
  const blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + properti_('TELEGRAM_TOKEN') + '/' + info.file_path).getBlob();
  const mime = m.voice ? 'audio/ogg' : (suara.mime_type || 'audio/mpeg');
  waktu_('suara diunduh');

  const model = d.pengaturan.GEMINI_MODEL_SUARA || 'gemini-flash-latest';
  const h = jalankanGemini_(kunci, model, [{
    sumber: 'suara', pikir: 0, parts: [{ inlineData: { mimeType: mime, data: Utilities.base64Encode(blob.getBytes()) } }, { text: PETUNJUK_SUARA }],
  }], null)[0];
  waktu_('suara ditranskrip');
  if (h instanceof Error) return kirim_(chatId, '⚠️ Pesan suara belum bisa dibaca: ' + html_(h.message) + '. Coba lagi, atau ketik saja.');
  const teks = String(h.jawaban || '').replace(/\s+/g, ' ').replace(/^["“'«]+|["”'»]+$/g, '').trim();
  if (!teks || /^\(?tidak jelas\)?\.?$/i.test(teks)) {
    return kirim_(chatId, '🎤 Maaf, suaranya kurang jelas. Coba ulangi di tempat yang lebih tenang, atau ketik saja, mis. <i>bensin 30rb</i>.');
  }
  // Transkrip ditampilkan dulu, supaya kalau salah dengar pengguna langsung tahu.
  tg_('sendMessage', { chat_id: chatId, text: '🎤 <i>' + html_(teks.slice(0, 500)) + '</i>', parse_mode: 'HTML', reply_to_message_id: m.message_id });
  prosesTeksBebas_(chatId, teks.slice(0, 1000), pengguna, d);
}

// ======================================================================
// Tombol (callback)
// ======================================================================

function prosesTombol_(q) {
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;
  const keputusan = String(q.data || '').match(/^(lns|tlk):(-?\d+)$/);
  if (keputusan) return putuskanBayar_(q, keputusan[1], keputusan[2]); // admin memeriksa bukti transfer
  const buka = bukaUntuk_(q.from.id, null);
  if (!buka) return tg_('answerCallbackQuery', { callback_query_id: q.id, text: 'Akun belum terhubung.' });
  const d = buka.d;
  const [aksi, id, nilai] = String(q.data || '').split(':');
  tg_('answerCallbackQuery', { callback_query_id: q.id });

  if (aksi === 'x') return ubahPesan_(chatId, msgId, 'Oke, tidak jadi.');
  if (aksi === 'batal' || aksi === 'hapus') {
    const ok = hapusTransaksi_(id);
    return ubahPesan_(chatId, msgId, ok ? (aksi === 'batal' ? '↩️ Dibatalkan, transaksi dihapus.' : '🗑️ Transaksi dihapus.') : 'Transaksi sudah tidak ada.');
  }
  if (aksi === 'jml') {
    const lama = d.transaksi.find(t => t.id === id);
    if (!lama) return ubahPesan_(chatId, msgId, 'Transaksi sudah tidak ada.');
    const baru = Object.assign({}, lama, { jumlah: Number(nilai) });
    ubahTransaksi_(id, baru);
    return ubahPesan_(chatId, msgId, '✏️ <b>Total diperbarui</b>\n' + ringkasTransaksi_(d, baru), [[{ text: '↩️ Batalkan', callback_data: 'batal:' + id }]]);
  }
}

// ======================================================================
// Data (spreadsheet keluarga)
// ======================================================================

/**
 * Satu bot melayani banyak keluarga. Spreadsheet tujuan dicari per akun Telegram: indeks `tg_<id>` di
 * Script Properties (diisi saat menautkan), atau SPREADSHEET_ID (mode lama, satu keluarga).
 * Semua akses lewat Sheets REST API dengan token:
 *   - akun pemilik (ScriptApp) untuk SPREADSHEET_ID, atau kalau akun robot belum diatur;
 *   - akun robot (service account, Script Property SA_KEY) untuk spreadsheet lain. Akun robot hanya bisa
 *     membuka spreadsheet yang dibagikan aplikasi ke emailnya (⚙️ → Bot Telegram → Hubungkan).
 */
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';
/** Tanggal disimpan sebagai angka serial Sheets (hari sejak 30 Des 1899), sama seperti aplikasi web. */
const EPOCH_SERIAL = Date.UTC(1899, 11, 30);
/** Batas pesan per spreadsheet per hari (selain mode lama), supaya kuota Apps Script cukup untuk semua. */
const BATAS_PESAN_HARIAN = 300;
let idSs_ = ''; // spreadsheet yang sedang dilayani di eksekusi ini
let isiProperti_ = null;

/** Script Properties dibaca sekali per eksekusi. */
function properti_(kunci) {
  if (!isiProperti_) isiProperti_ = PropertiesService.getScriptProperties().getProperties();
  return isiProperti_[kunci];
}

function pakaiSpreadsheet_(id) {
  idSs_ = String(id || '');
}

function idSpreadsheet_() {
  if (!idSs_) throw new Error('Spreadsheet belum diketahui.');
  return idSs_;
}

function modeLama_() {
  return !!idSs_ && idSs_ === properti_('SPREADSHEET_ID');
}

/** Spreadsheet untuk akun Telegram ini ('' = belum terhubung). */
function spreadsheetUntuk_(idTelegram) {
  return properti_('tg_' + idTelegram) || properti_('SPREADSHEET_ID') || '';
}

/** idSheet kosong = hapus tautan. */
function catatIndeks_(idTelegram, idSheet) {
  const p = PropertiesService.getScriptProperties();
  if (idSheet) p.setProperty('tg_' + idTelegram, idSheet);
  else p.deleteProperty('tg_' + idTelegram);
  if (isiProperti_) {
    if (idSheet) isiProperti_['tg_' + idTelegram] = idSheet;
    else delete isiProperti_['tg_' + idTelegram];
  }
}

/**
 * Membuka spreadsheet milik akun Telegram ini dan memastikan akunnya masih tertaut di sana
 * (TELEGRAM_PENGGUNA). Spreadsheet adalah sumber kebenaran: diputus dari aplikasi / akses bot dicabut
 * → indeks ikut dihapus. Hasil: { d, pengguna }, atau null kalau tidak bisa (chatId sudah diberi tahu).
 */
function bukaUntuk_(idTelegram, chatId, lain, tanpaTransaksi) {
  const idSheet = spreadsheetUntuk_(idTelegram);
  if (!idSheet) {
    belumTerhubung_(chatId);
    return null;
  }
  pakaiSpreadsheet_(idSheet);
  let d;
  const balasanLain = [];
  try {
    d = muatData_(lain, balasanLain, tanpaTransaksi);
  } catch (err) {
    if (err.status !== 403 && err.status !== 404) throw err;
    if (properti_('tg_' + idTelegram)) catatIndeks_(idTelegram, '');
    if (chatId) kirim_(chatId, '⚠️ ' + html_(err.message));
    return null;
  }
  const pengguna = penggunaTelegram_(d.pengaturan)[idTelegram];
  if (!pengguna) {
    if (properti_('tg_' + idTelegram)) catatIndeks_(idTelegram, '');
    belumTerhubung_(chatId);
    return null;
  }
  return { d, pengguna, lain: balasanLain };
}

function belumTerhubung_(chatId) {
  if (!chatId) return;
  kirim_(chatId, [
    '👋 Halo! Akun Telegram ini belum terhubung ke <b>Dompet Keluarga</b>.',
    '',
    'Buka aplikasi Dompet Keluarga → ⚙️ → <b>Bot Telegram</b> → <b>Hubungkan akun Telegram saya</b>, lalu ketuk <b>Buka Telegram & hubungkan</b>.',
  ].join('\n'));
}

/** Pesan untuk spreadsheet ini hari ini masih di bawah batas? (perkiraan, lewat cache) */
function kuotaHarianCukup_() {
  if (modeLama_()) return true;
  const cache = CacheService.getScriptCache();
  const kunci = 'n_' + idSs_ + '_' + hariIni_();
  const n = (Number(cache.get(kunci)) || 0) + 1;
  cache.put(kunci, String(n), 26 * 3600);
  return n <= BATAS_PESAN_HARIAN;
}

function tokenAkses_() {
  if (modeLama_() || !properti_('SA_KEY')) return ScriptApp.getOAuthToken();
  return tokenRobot_();
}

/** Token akun robot: JWT bertanda tangan RS256 ditukar ke token OAuth, di-cache ±55 menit. */
function tokenRobot_() {
  const cache = CacheService.getScriptCache();
  const ada = cache.get('token_robot');
  if (ada) return ada;
  const sa = akunRobot_();
  const b64 = s => Utilities.base64EncodeWebSafe(s).replace(/=+$/, '');
  const kini = Math.floor(Date.now() / 1000);
  const isi = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: kini, exp: kini + 3600,
  }));
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: isi + '.' + b64(Utilities.computeRsaSha256Signature(isi, sa.private_key)) },
  });
  const j = JSON.parse(res.getContentText());
  if (!j.access_token) throw new Error('Token akun robot gagal: ' + (j.error_description || j.error || res.getResponseCode()));
  cache.put('token_robot', j.access_token, 3300);
  return j.access_token;
}

/** Isi Script Property SA_KEY (file JSON kunci service account). */
function akunRobot_() {
  try {
    const sa = JSON.parse(properti_('SA_KEY'));
    if (sa.client_email && sa.private_key) return sa;
  } catch (e) { /* di bawah */ }
  throw new Error('Script Property SA_KEY harus berisi seluruh isi file JSON kunci service account.');
}

function sheetsApi_(jalur, opsi) {
  return Object.assign({
    url: SHEETS_API + idSpreadsheet_() + jalur,
    headers: { Authorization: 'Bearer ' + tokenAkses_() },
    muteHttpExceptions: true,
  }, opsi || {});
}

/** Satu permintaan Sheets API. Gagal → Error dengan .status (403/404 = bot tidak punya akses). */
function sheets_(jalur, opsi) {
  return jawabanSheets_(UrlFetchApp.fetchAll([sheetsApi_(jalur, opsi)])[0]);
}

function jsonSheets_(metode, payload) {
  return { method: metode, contentType: 'application/json', payload: JSON.stringify(payload) };
}

function jawabanSheets_(res) {
  const kode = res.getResponseCode();
  if (kode === 200) return JSON.parse(res.getContentText() || '{}');
  let pesan = '';
  try { pesan = JSON.parse(res.getContentText()).error.message; } catch (e) { /* bukan JSON */ }
  console.warn('Sheets API ' + kode + ': ' + pesan);
  const err = new Error(kode === 403 || kode === 404
    ? 'Bot tidak lagi punya akses ke spreadsheet ini. Hubungkan ulang dari aplikasi: ⚙️ → Bot Telegram.'
    : 'Google Sheets sedang bermasalah (kode ' + kode + '). Coba lagi sebentar lagi.');
  err.status = kode;
  throw err;
}

function range_(r) {
  return encodeURIComponent(r);
}

const TABEL_BACA = [['Transaksi', KOLOM_TRANSAKSI], ['Kategori', 4], ['Dompet', 6], ['Pengaturan', 2]];

/**
 * Semua data dalam satu permintaan Sheets API. `lain` (opsional): permintaan lain (mis. ke Telegram) yang
 * dikirim bersamaan; jawabannya dimasukkan ke array `balasanLain`, urut sama dengan `lain`.
 * `tanpaTransaksi`: sheet Transaksi (yang terbesar) tidak dibaca; d.transaksi kosong sampai diisi
 * lewat mintaTransaksi_ / olahJawabanTransaksi_ (dipakai alur foto supaya tidak menunggu di awal).
 */
function muatData_(lain, balasanLain, tanpaTransaksi) {
  const tabel = tanpaTransaksi ? TABEL_BACA.slice(1) : TABEL_BACA;
  const ranges = tabel.map(t => 'ranges=' + range_("'" + t[0] + "'!A2:" + String.fromCharCode(64 + t[1]))).join('&');
  const minta = [sheetsApi_('/values:batchGet?' + ranges + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')]
    .concat(lain || []);
  const semua = UrlFetchApp.fetchAll(minta);
  if (balasanLain) semua.slice(1).forEach(r => balasanLain.push(r));
  const j = jawabanSheets_(semua[0]);
  const isi = j.valueRanges.map((vr, i) => rapikanBaris_(vr.values, tabel[i][1]));
  return olahData_(tanpaTransaksi ? [[]].concat(isi) : isi);
}

/** Baris dari Sheets API dipotong/ditambal supaya panjangnya tepat `kolom`. */
function rapikanBaris_(values, kolom) {
  return (values || []).map(r => {
    const isi = r.slice(0, kolom);
    while (isi.length < kolom) isi.push('');
    return isi;
  });
}

/** Permintaan baca sheet Transaksi saja (bisa ikut dikirim bersamaan dengan permintaan lain). */
function mintaTransaksi_() {
  return sheetsApi_('/values/' + range_("'Transaksi'!A2:" + String.fromCharCode(64 + KOLOM_TRANSAKSI))
    + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
}

/** Jawaban mintaTransaksi_ → daftar transaksi seperti d.transaksi. */
function olahJawabanTransaksi_(res) {
  return olahTransaksi_(rapikanBaris_(jawabanSheets_(res).values, KOLOM_TRANSAKSI));
}

function olahTransaksi_(trx) {
  return trx.filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), tanggal: tgl_(r[1]), tipe: String(r[2]), jumlah: Number(r[3]) || 0, kategori: String(r[4]),
    dompet: String(r[5]), dompetTujuan: String(r[6]), catatan: String(r[7]), oleh: String(r[8]),
    dibuat: tglWaktu_(r[9]),
  }));
}

function olahData_([trx, kat, dom, set]) {
  const transaksi = olahTransaksi_(trx);
  const kategori = kat.filter(r => r[0] !== '').map(r => ({
    nama: String(r[0]), tipe: String(r[1]), ikon: String(r[2]), anggaran: Number(r[3]) || 0,
  }));
  const dompet = dom.filter(r => r[0] !== '').map(r => ({
    nama: String(r[0]), ikon: String(r[1]), saldoAwal: Number(r[2]) || 0,
    jenis: [JENIS.TABUNGAN, JENIS.UTANG, JENIS.ASET].indexOf(String(r[3])) >= 0 ? String(r[3]) : JENIS.DOMPET, target: Number(r[4]) || 0,
    tenggat: r[5] === '' ? '' : tgl_(r[5]),
  }));
  const pengaturan = {};
  set.forEach(r => { if (r[0] !== '') pengaturan[String(r[0])] = String(r[1]); });
  mulaiPeriode_ = Math.min(28, Math.max(1, Math.round(Number(pengaturan.MULAI_PERIODE) || 1)));
  return { transaksi, kategori, dompet, pengaturan };
}

function barisPengaturan_() {
  return sheets_('/values/' + range_("'Pengaturan'!A2:B")).values || [];
}

function pengaturan_() {
  const p = {};
  barisPengaturan_().forEach(r => { if (r[0] !== '') p[String(r[0])] = String(r[1] == null ? '' : r[1]); });
  return p;
}

function simpanPengaturan_(kunci, nilai) {
  const i = barisPengaturan_().findIndex(r => String(r[0]) === kunci);
  if (i >= 0) sheets_('/values/' + range_("'Pengaturan'!B" + (i + 2)) + '?valueInputOption=RAW', jsonSheets_('put', { values: [[nilai]] }));
  else sheets_('/values/' + range_("'Pengaturan'!A1") + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', jsonSheets_('post', { values: [[kunci, nilai]] }));
}

/** `p`: muatData_().pengaturan atau pengaturan_(). */
function penggunaTelegram_(p) {
  try { return JSON.parse(p.TELEGRAM_PENGGUNA || '{}'); } catch (e) { return {}; }
}

function kunciGemini_(p) {
  try { return JSON.parse(p.GEMINI_API_KEYS || '[]'); } catch (e) { return []; }
}

function samarkanKunci_(k) {
  return k.slice(0, 6) + '…' + k.slice(-4);
}

/** Melengkapi & memvalidasi transaksi dari hasil AI. Melempar Error dengan pesan yang bisa dibaca pengguna. */
function siapkanTransaksi_(d, x, pengguna) {
  const tipe = [TIPE.MASUK, TIPE.KELUAR, TIPE.TRANSFER].indexOf(x.tipe) >= 0 ? x.tipe : TIPE.KELUAR;
  const jumlah = Math.round(Number(x.jumlah) || 0);
  if (!(jumlah > 0)) throw new Error('Nominalnya belum jelas. Contoh: "makan bakso 25rb".');

  // Aturan sama dengan aplikasi: pemasukan/pengeluaran hanya dompet biasa/tabungan; emas (dalam gram) tidak ikut transfer.
  let emas = {};
  try { emas = JSON.parse((d.pengaturan && d.pengaturan.EMAS) || '{}') || {}; } catch (e) { emas = {}; }
  const bolehUntuk = w => w && (tipe === TIPE.TRANSFER ? !(emas[w.nama] && w.jenis === JENIS.ASET) : w.jenis === JENIS.DOMPET || w.jenis === JENIS.TABUNGAN);
  const cariSemua = n => d.dompet.find(w => w.nama.toLowerCase() === String(n || '').toLowerCase());
  const cariDompet = n => { const w = cariSemua(n); return bolehUntuk(w) ? w : null; };
  const biasa = d.dompet.filter(w => w.jenis === JENIS.DOMPET);
  const pesanEmas = 'Emas dicatat dalam gram, jadi tidak bisa ditransfer lewat bot. Tambah atau kurangi emas dari aplikasi (Dompet → emas → Tambah gram).';
  if (tipe === TIPE.TRANSFER && [x.dompet, x.dompetTujuan].some(n => { const w = cariSemua(n); return w && !bolehUntuk(w); })) throw new Error(pesanEmas);
  // Dompet default: yang terakhir dipakai pengguna ini untuk tipe yang sama, atau dompet pertama.
  const terakhir = d.transaksi.filter(t => t.oleh === pengguna.email && t.tipe === tipe && cariDompet(t.dompet))
    .sort((a, b) => b.dibuat.localeCompare(a.dibuat))[0];
  const dompet = cariDompet(x.dompet) || (terakhir && cariDompet(terakhir.dompet)) || biasa[0];
  if (!dompet) throw new Error('Belum ada dompet. Buat dompet dulu di aplikasi.');

  let kategori = '';
  let dompetTujuan = '';
  if (tipe === TIPE.TRANSFER) {
    const tujuan = cariDompet(x.dompetTujuan);
    if (!tujuan || tujuan.nama === dompet.nama) throw new Error('Untuk transfer, sebutkan dompet asal dan tujuannya (mis. "dari bank ke tunai").');
    dompetTujuan = tujuan.nama;
  } else {
    const daftar = d.kategori.filter(k => k.tipe === tipe);
    const k = cocokKategori_(daftar, x.kategori, x.catatan) || daftar.find(k => k.nama === 'Lainnya') || daftar[0];
    if (!k) throw new Error('Belum ada kategori ' + tipe.toLowerCase() + '.');
    kategori = k.nama;
  }
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal || '') && x.tanggal <= hariIni_() ? x.tanggal : hariIni_();
  return { tipe, jumlah, kategori, dompet: dompet.nama, dompetTujuan, tanggal, catatan: String(x.catatan || '').trim().slice(0, 500) };
}

/** Kata kunci → kata yang biasanya ada di nama kategori bawaan. */
const KATA_KATEGORI = [
  [/makan|minum|bakso|nasi|mie|kopi|jajan|resto|warung|sarapan|cemilan|snack|gofood|grabfood|shopeefood/, ['makan']],
  [/bensin|parkir|ojek|ojol|grab|gojek|tol|bus|kereta|krl|angkot|taksi|servis motor|servis mobil/, ['transport']],
  [/listrik|pln|pdam|air|internet|wifi|pulsa|kuota|token|bpjs|tagihan|cicilan/, ['tagihan']],
  [/belanja|sayur|indomaret|alfamart|pasar|supermarket|sabun|beras|minyak|gas|galon/, ['belanja', 'rumah']],
  [/obat|dokter|apotek|klinik|rumah sakit|vitamin/, ['kesehatan']],
  [/sekolah|spp|buku|kursus|les|kuliah/, ['pendidikan']],
  [/popok|pampers|susu anak|mainan|anak/, ['anak']],
  [/film|nonton|netflix|spotify|game|liburan|wisata/, ['hiburan']],
  [/baju|celana|sepatu|kaos|jaket|pakaian/, ['pakaian']],
  [/sedekah|zakat|infaq|infak|kondangan|sumbangan|donasi/, ['sosial']],
  [/gaji|upah|honor/, ['gaji']],
  [/bonus|thr/, ['bonus']],
];

/** Mencari kategori yang paling cocok dari nama (hasil AI) atau catatannya; null kalau tidak ada. */
function cocokKategori_(daftar, nama, catatan) {
  const norm = s => String(s || '').toLowerCase().replace(/&|\bdan\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = norm(nama);
  if (n) {
    const k = daftar.find(k => norm(k.nama) === n)
      || daftar.find(k => norm(k.nama).indexOf(n) >= 0 || n.indexOf(norm(k.nama)) >= 0)
      || daftar.find(k => norm(k.nama).split(' ').some(w => w.length > 3 && n.split(' ').indexOf(w) >= 0));
    if (k && k.nama !== 'Lainnya') return k;
  }
  const teks = norm(nama + ' ' + (catatan || ''));
  for (let i = 0; i < KATA_KATEGORI.length; i++) {
    if (!KATA_KATEGORI[i][0].test(teks)) continue;
    const k = daftar.find(k => KATA_KATEGORI[i][1].some(w => norm(k.nama).indexOf(w) >= 0));
    if (k) return k;
  }
  return null;
}

// ======================================================================
// Versi penuh: batas transaksi gratis & kode aktivasi (sama dengan web/assets/db.js)
// ======================================================================

const URL_APLIKASI = 'https://shiroesyn202601-ship-it.github.io/dompet-keluarga/';

/**
 * Pengaturan penjualan (diubah pemilik di admin.html → Pengaturan penjualan), Script Property JUAL:
 *   aturan: 'transaksi' (setelah batasTransaksi baris Transaksi) | 'periode' (setelah batasPeriode periode gajian
 *           sejak buku mulai dipakai, Pengaturan MULAI_PAKAI) | 'keduanya' (mana yang lebih dulu)
 *   harga, rekening: [{ bank, nomor, atasNama }], qris: ID file gambar QRIS di folder Admin ('' = tidak ada).
 * Bawaan di bawah dipakai selama pemilik belum menyimpan pengaturan.
 */
const JUAL_BAWAAN = { aturan: 'transaksi', batasTransaksi: 450, batasPeriode: 3, harga: 30000, rekening: [{ bank: 'DANA', nomor: '087873369841', atasNama: '', qris: '' }],
  selaluTampil: true }; // false = menu Versi penuh di aplikasi baru muncul setelah masa gratis habis

/** Pengaturan penjualan; tiap rekening boleh punya satu QRIS (qris = ID file gambarnya di folder Admin). */
function jual_() {
  let isi = {};
  try { isi = JSON.parse(properti_('JUAL') || '{}') || {}; } catch (e) { /* pakai bawaan */ }
  const j = Object.assign({}, JUAL_BAWAAN, isi);
  j.rekening = (j.rekening || []).map(r => ({ bank: r.bank || '', nomor: r.nomor || '', atasNama: r.atasNama || '', qris: r.qris || '' }));
  if (j.qris && j.rekening.length && !j.rekening[0].qris) j.rekening[0].qris = j.qris; // QRIS lama (satu untuk semua) → rekening pertama
  delete j.qris;
  return j;
}

/** Yang boleh diketahui siapa saja (aplikasi): tanpa ID file QRIS (rekening[i].qris = true/false). */
function jualPublik_() {
  const j = jual_();
  const rekening = j.rekening.map(r => ({ bank: r.bank, nomor: r.nomor, atasNama: r.atasNama, qris: !!r.qris }));
  return { aturan: j.aturan, batasTransaksi: j.batasTransaksi, batasPeriode: j.batasPeriode, harga: j.harga, rekening, qris: rekening.some(r => r.qris),
    selaluTampil: j.selaluTampil !== false };
}

/**
 * baru.rekening[i] = { bank, nomor, atasNama, qrisAsal (nomor urut rekening lama yang QRIS-nya dipertahankan, -1 = tidak),
 * qrisBaru (data URL gambar QRIS baru, '' = tidak ada) }. QRIS lama yang tidak dipakai lagi dihapus dari Drive.
 */
function simpanJual_(baru) {
  const b = baru || {};
  const bulat = (v, min, maks, nama) => {
    const n = Math.round(Number(v));
    if (!(n >= min && n <= maks)) throw new Error(nama + ' harus angka ' + min.toLocaleString('id-ID') + '–' + maks.toLocaleString('id-ID') + '.');
    return n;
  };
  if (['transaksi', 'periode', 'keduanya'].indexOf(b.aturan) < 0) throw new Error('Pilih kapan pengguna ditagih.');
  const lama = jual_();
  const isian = (Array.isArray(b.rekening) ? b.rekening : []).slice(0, 5).map(r => ({
    bank: teks_(r && r.bank).slice(0, 40), nomor: teks_(r && r.nomor).slice(0, 40), atasNama: teks_(r && r.atasNama).slice(0, 60),
    asal: lama.rekening[Number(r && r.qrisAsal)] ? lama.rekening[Number(r.qrisAsal)].qris : '', gambar: String((r && r.qrisBaru) || ''),
  })).filter(r => r.bank || r.nomor || r.gambar);
  if (isian.some(r => !r.bank || !r.nomor)) throw new Error('Setiap rekening wajib berisi nama bank/e-wallet dan nomornya.');
  if (!isian.length) throw new Error('Isi minimal satu rekening.');
  const gambar = isian.map(r => r.gambar && gambarQrisSah_(r.gambar)); // diperiksa semua dulu sebelum ada yang diunggah
  const hasil = {
    aturan: b.aturan,
    batasTransaksi: b.aturan === 'periode' ? lama.batasTransaksi : bulat(b.batasTransaksi, 1, 100000, 'Batas transaksi'),
    batasPeriode: b.aturan === 'transaksi' ? lama.batasPeriode : bulat(b.batasPeriode, 1, 120, 'Batas periode'),
    harga: bulat(b.harga, 1000, 100000000, 'Harga'),
    selaluTampil: b.selaluTampil !== false,
    rekening: isian.map((r, i) => ({ bank: r.bank, nomor: r.nomor, atasNama: r.atasNama, qris: gambar[i] ? unggahQris_(gambar[i], r.bank) : r.asal })),
  };
  simpanProp_('JUAL', JSON.stringify(hasil));
  const dipakai = hasil.rekening.map(r => r.qris);
  lama.rekening.forEach(r => {
    if (r.qris && dipakai.indexOf(r.qris) < 0) { try { apiPemilik_('https://www.googleapis.com/drive/v3/files/' + r.qris, { method: 'delete' }); } catch (e) { /* sudah tidak ada */ } }
  });
  return hasil;
}

/** Data URL PNG/JPEG/WebP → { mime, isi (base64) }; selain itu galat. */
function gambarQrisSah_(gambar) {
  const m = String(gambar).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Gambar QRIS tidak valid.');
  if (m[2].length > 4e6) throw new Error('Gambar QRIS terlalu besar.');
  return { mime: 'image/' + m[1], isi: m[2] };
}

/** Gambar QRIS diunggah ke folder Admin; hasil: ID file. */
function unggahQris_(g, bank) {
  const batas = 'dk' + Utilities.getUuid().replace(/-/g, '');
  const meta = JSON.stringify({ name: 'QRIS ' + (bank || 'pembayaran'), mimeType: g.mime, parents: [folderAdmin_()] });
  return apiPemilik_('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + batas,
    payload: Utilities.newBlob('--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
      + '\r\n--' + batas + '\r\nContent-Type: ' + g.mime + '\r\n\r\n').getBytes()
      .concat(Utilities.base64Decode(g.isi), Utilities.newBlob('\r\n--' + batas + '--').getBytes()),
  }).id;
}

/** Gambar QRIS rekening ke-i (0, 1, …) sebagai data URL ('' kalau tidak ada); di-cache 6 jam (dibuka banyak pembeli). */
function gambarQris_(i) {
  const r = jual_().rekening[Number(i) || 0];
  if (!r || !r.qris) return '';
  const cache = CacheService.getScriptCache();
  const ada = cache.get('qris_' + r.qris);
  if (ada) return ada;
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + r.qris + '?alt=media', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return '';
  const blob = res.getBlob();
  const data = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (data.length < 90000) cache.put('qris_' + r.qris, data, 21600); // batas ukuran isi CacheService ±100 KB
  return data;
}

/** Berapa periode gajian sudah lewat sejak buku mulai dipakai (0 = masih periode pertama). */
function periodeLewat_(d) {
  const mulai = /^\d{4}-\d{2}-\d{2}$/.test(d.pengaturan.MULAI_PAKAI || '') ? d.pengaturan.MULAI_PAKAI
    : d.transaksi.reduce((a, t) => (t.tanggal && t.tanggal < a ? t.tanggal : a), hariIni_());
  const k = s => { const [y, m] = periode_(s).split('-').map(Number); return y * 12 + m; };
  return Math.max(0, k(hariIni_()) - k(mulai));
}

/** Masa gratis buku ini sudah habis menurut aturan penjualan? */
function masaGratisHabis_(d) {
  const j = jual_();
  const trx = d.transaksi.length >= j.batasTransaksi;
  const per = periodeLewat_(d) >= j.batasPeriode;
  return j.aturan === 'transaksi' ? trx : j.aturan === 'periode' ? per : trx || per;
}

const PESAN_BATAS_GRATIS = '🔒 Masa gratis untuk buku ini sudah habis, jadi transaksi baru belum bisa dicatat.\n\n'
  + 'Beli versi penuh (sekali bayar) di aplikasi Dompet Keluarga: ⚙️ → <b>Versi penuh</b>. Data lama tetap aman dan bisa dilihat.';

/**
 * Kode aktivasi = tanda tangan RSA-SHA256 atas "DK1:<ID spreadsheet>" (base64url tanpa '='). PKCS#1 v1.5
 * selalu menghasilkan tanda tangan yang sama, jadi bot cukup membuat ulang lalu membandingkan; aplikasi web
 * memeriksanya dengan kunci publik di config.js. Kunci boleh ditempel dengan atau tanpa baris baru.
 */
function tandaTanganLisensi_(idSheet) {
  const kunci = String(properti_('LISENSI_KUNCI') || '');
  const isi = kunci.replace(/-----[^-]+-----/g, '').replace(/\\n|\s/g, '');
  if (!isi) return '';
  const pem = '-----BEGIN PRIVATE KEY-----\n' + isi.match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n';
  return Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature('DK1:' + idSheet, pem)).replace(/=+$/, '');
}

/** Pesan saat pencatatan dikunci: dinonaktifkan admin, atau batas gratis tercapai. */
function pesanKunci_() {
  return statusPengajuan_(idSpreadsheet_()).status === 'nonaktif'
    ? '⛔ Versi penuh buku ini dinonaktifkan admin, jadi transaksi baru belum bisa dicatat.\n\n'
      + 'Aktifkan lagi di aplikasi Dompet Keluarga: ⚙️ → <b>Versi penuh</b>. Data lama tetap aman dan bisa dilihat.'
    : PESAN_BATAS_GRATIS;
}

/**
 * true = pencatatan baru dikunci. Sumber kebenaran: spreadsheet Pengajuan Aktivasi. Aktif → bebas; Nonaktif → dikunci
 * berapa pun kuotanya; tidak ada di sheet (atau Menunggu/Ditolak) → bebas selama masa gratis. Sheet tidak terbaca →
 * kode aktivasi terakhir di sheet Pengaturan buku dipakai sebagai cadangan. Tanpa LISENSI_KUNCI batas tidak berlaku.
 */
function kuotaPenuh_(d) {
  if (!properti_('LISENSI_KUNCI') || modeLama_()) return false;
  const id = idSpreadsheet_();
  const aju = statusPengajuan_(id);
  if (aju.status === 'aktif') return false;
  if (aju.status === 'nonaktif') return true;
  if (!masaGratisHabis_(d)) return false;
  return !aju.galat || String(d.pengaturan.LISENSI || '') !== tandaTanganLisensi_(id);
}

/** Daftar lama (Script Property LISENSI_DICABUT) dari sebelum spreadsheet jadi sumber kebenaran; dipindah sekali oleh pindahkanDicabut_. */
function daftarDicabut_() {
  return String(properti_('LISENSI_DICABUT') || '').split(/[\s,]+/).filter(Boolean);
}

function simpanDicabut_(daftar) {
  const nilai = daftar.filter((x, i) => x && daftar.indexOf(x) === i).join(',');
  PropertiesService.getScriptProperties().setProperty('LISENSI_DICABUT', nilai);
  if (isiProperti_) isiProperti_.LISENSI_DICABUT = nilai;
}

/**
 * Perintah pemilik (ADMIN_TELEGRAM), dengan kode buku = ID spreadsheet (terlihat di bukti transfer yang diteruskan bot)
 * (boleh menempel seluruh pesannya setelah perintah):
 *   /lunas <kode buku>    — status buku di spreadsheet Pengajuan Aktivasi jadi Aktif (baris dibuat kalau belum ada),
 *                           lalu membuat pesan untuk diteruskan ke pembeli;
 *   /batal <kode buku>    — status jadi Nonaktif: pencatatan baru dikunci (bot ±1 menit, aplikasi ±10 menit);
 *   /pulihkan <kode buku> — status kembali Aktif.
 */
function adminTelegram_(idTelegram) {
  return String(properti_('ADMIN_TELEGRAM') || '').split(/[\s,]+/).filter(Boolean).indexOf(String(idTelegram)) >= 0;
}

function prosesLisensi_(m, perintah, teks) {
  const chatId = m.chat.id;
  if (!adminTelegram_(m.from.id)) {
    return kirim_(chatId, 'Perintah ini khusus pemilik aplikasi.\n\nID Telegram Anda: <code>' + m.from.id + '</code>');
  }
  if (!properti_('LISENSI_KUNCI')) return kirim_(chatId, '⚠️ Script Property <b>LISENSI_KUNCI</b> belum diisi, jadi lisensi belum bisa diatur.');
  // Kode buku = token panjang terakhir sesudah perintahnya (pesan WA tempelan: baris "/lunas <kode>").
  const sesudah = teks.slice(teks.search(new RegExp('^\\/' + perintah, 'im')) + perintah.length + 1);
  const calon = sesudah.match(/[\w-]{25,}/g) || [];
  const id = calon[calon.length - 1];
  if (!id) return kirim_(chatId, 'Format: <code>/' + perintah + ' KODE_BUKU</code>\nKode buku (ID spreadsheet) ada di bukti transfer yang diteruskan bot, baris "Buku:".');
  const kode = '<code>' + html_(id) + '</code>';
  siapkanRiwayat_();
  const lama = permintaan_(id);
  if (perintah === 'batal') {
    if (!lama || lama.status !== 'aktif') return kirim_(chatId, 'ℹ️ Buku ' + kode + ' memang tidak sedang aktif di spreadsheet Pengajuan Aktivasi.');
    aturLisensi_(id, 'nonaktif', '');
    return kirim_(chatId, '🚫 Versi penuh buku ' + kode + ' dinonaktifkan. Pencatatan baru dikunci (bot ±1 menit, aplikasi ±10 menit).\n\n'
      + 'Salah? Kirim <code>/pulihkan ' + html_(id) + '</code>.');
  }
  if (perintah === 'pulihkan' && (!lama || lama.status !== 'nonaktif')) return kirim_(chatId, 'ℹ️ Buku ' + kode + ' memang tidak sedang dinonaktifkan.');
  aktifkanBuku_(id, lama);
  if (perintah === 'pulihkan') return kirim_(chatId, '✅ Versi penuh buku ' + kode + ' aktif lagi.');
  kirim_(chatId, '✅ Buku ' + kode + ' sudah Aktif di spreadsheet. Salin pesan di bawah ini lalu kirim ke pembeli.');
  return kirim_(chatId, pesanAktivasi_(id));
}

/** Status buku jadi Aktif di spreadsheet (baris baru kalau belum ada, mis. dari /lunas atau tombol Lunas di Telegram). */
function aktifkanBuku_(id, lama) {
  const sekarang = sekarangIso_();
  if (lama) return aturLisensi_(id, 'aktif', '');
  const baru = { email: '', buku: '', t: sekarang, status: 'aktif', foto: '', diubah: sekarang, harga: jual_().harga };
  simpanPermintaan_(id, baru);
  catatRiwayat_(id, baru, PERISTIWA_STATUS.aktif, 'Telegram', '');
  return { ok: true, status: 'aktif' };
}

/** Pesan untuk pembeli setelah versi penuh diaktifkan (siap dikirim / diteruskan). Tanpa kode: status diambil dari spreadsheet. */
function pesanAktivasi_() {
  return html_('Terima kasih sudah membeli Dompet Keluarga versi penuh! 🎉\n\n'
    + 'Versi penuh sudah aktif untuk seluruh keluarga di buku itu. Buka aplikasi Dompet Keluarga; kalau belum berubah, '
    + 'buka ⚙️ → Versi penuh.');
}

// ---------- Pembelian lewat bot: pembeli kirim bukti transfer, pemilik menekan ✅ Lunas / ❌ Tolak ----------
// Status per chat pembeli disimpan di Script Property byr_<chat id> = { id (buku), tahap: 'foto' | 'cek', nama }.

function bayarTertunda_(chatId) {
  try { return JSON.parse(properti_('byr_' + chatId) || 'null'); } catch (e) { return null; }
}

function simpanBayar_(chatId, isi) {
  const p = PropertiesService.getScriptProperties();
  if (isi) p.setProperty('byr_' + chatId, JSON.stringify(isi));
  else p.deleteProperty('byr_' + chatId);
  if (isiProperti_) {
    if (isi) isiProperti_['byr_' + chatId] = JSON.stringify(isi);
    else delete isiProperti_['byr_' + chatId];
  }
}

function daftarAdmin_() {
  return String(properti_('ADMIN_TELEGRAM') || '').split(/[\s,]+/).filter(Boolean);
}

function mulaiBayar_(m, idBuku) {
  const chatId = m.chat.id;
  if (!daftarAdmin_().length || !properti_('LISENSI_KUNCI')) {
    return kirim_(chatId, '⚠️ Pembayaran lewat bot belum disiapkan admin. Coba lagi nanti.');
  }
  if (statusPengajuan_(idBuku).status === 'nonaktif') return kirim_(chatId, '⚠️ Versi penuh buku ini dinonaktifkan admin. Hubungi admin.');
  const nama = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') + (m.from.username ? ' (@' + m.from.username + ')' : '');
  simpanBayar_(chatId, { id: idBuku, tahap: 'foto', nama });
  kirim_(chatId, [
    '⭐ <b>Beli Dompet Keluarga versi penuh</b>',
    '',
    'Sudah transfer? Kirim <b>foto / screenshot bukti transfer</b> ke chat ini.',
    'Setelah dicek, link aktivasi dikirim ke sini.',
  ].join('\n'));
}

/** Foto bukti diteruskan ke semua admin beserta tombol keputusan. */
function terimaBukti_(m, tunggu) {
  const chatId = m.chat.id;
  const foto = m.photo ? m.photo[m.photo.length - 1].file_id : m.document && /^image\//.test(m.document.mime_type || '') ? m.document.file_id : '';
  if (!foto) return kirim_(chatId, '📸 Kirim <b>foto atau screenshot</b> bukti transfernya ya, bukan teks.');
  const keterangan = '💰 <b>Bukti transfer versi penuh</b>\nDari: ' + html_(tunggu.nama || String(chatId))
    + '\nBuku: <code>' + html_(tunggu.id) + '</code>' + (m.caption ? '\nPesan: ' + html_(m.caption.slice(0, 300)) : '')
    + '\n\nCek mutasi rekening, lalu pilih:';
  const tombol = [[{ text: '✅ Lunas', callback_data: 'lns:' + chatId }, { text: '❌ Tolak', callback_data: 'tlk:' + chatId }]];
  const metode = m.photo ? 'sendPhoto' : 'sendDocument';
  let terkirim = 0;
  daftarAdmin_().forEach(a => {
    const r = tg_(metode, { chat_id: a, [m.photo ? 'photo' : 'document']: foto, caption: keterangan, parse_mode: 'HTML', reply_markup: { inline_keyboard: tombol } });
    if (r.ok) terkirim++;
  });
  if (!terkirim) return kirim_(chatId, '⚠️ Bukti belum bisa diteruskan ke admin. Coba kirim ulang sebentar lagi.');
  simpanBayar_(chatId, Object.assign({}, tunggu, { tahap: 'cek' }));
  kirim_(chatId, '✅ Bukti transfer diterima dan sedang dicek. Link aktivasi akan dikirim ke chat ini setelah pembayaran dikonfirmasi.');
}

/** aksi 'lns' (lunas) / 'tlk' (tolak) untuk pembeli dengan chat id `idPembeli`. */
function putuskanBayar_(q, aksi, idPembeli) {
  const ubah = teks => tg_('editMessageCaption', { // keputusan ditulis di keterangan foto, tombolnya hilang
    chat_id: q.message.chat.id, message_id: q.message.message_id, caption: teks, parse_mode: 'HTML',
  });
  if (!adminTelegram_(q.from.id)) return tg_('answerCallbackQuery', { callback_query_id: q.id, text: 'Khusus pemilik aplikasi.' });
  tg_('answerCallbackQuery', { callback_query_id: q.id });
  const tunggu = bayarTertunda_(idPembeli);
  const asal = String(q.message.caption || '').split('\n\n')[0];
  if (!tunggu) return ubah(html_(asal) + '\n\nℹ️ Permintaan ini sudah diproses sebelumnya.');
  simpanBayar_(idPembeli, null);
  if (aksi === 'tlk') {
    kirim_(idPembeli, '❌ Maaf, pembayaranmu belum bisa dikonfirmasi. Pastikan nominal dan tujuan transfernya benar, lalu ketuk lagi tombol <b>Kirim bukti lewat Telegram</b> di aplikasi (⚙️ → Versi penuh).');
    return ubah(html_(asal) + '\n\n❌ <b>Ditolak</b> oleh ' + html_(q.from.first_name || 'admin') + '.');
  }
  aktifkanBuku_(tunggu.id, permintaan_(tunggu.id));
  const r = kirim_(idPembeli, pesanAktivasi_(tunggu.id));
  ubah(html_(asal) + (r && r.ok ? '\n\n✅ <b>Lunas.</b> Pembeli sudah diberi tahu.' : '\n\n⚠️ Lunas, tapi pembeli belum bisa diberi tahu. Kirim manual: /lunas ' + html_(tunggu.id)));
}

// ---------- Permintaan aktivasi lewat aplikasi + halaman admin (web/admin.html) ----------
// Pembeli mengunggah bukti transfer dari aplikasi; pemilik membuka admin.html, melihat buktinya, lalu menekan
// Aktifkan / Nonaktifkan / Tolak. Semuanya ada di Google Drive akun pemilik bot:
//   Dompet keluarga / Admin /  ← foto-foto bukti transfer
//   Dompet keluarga / Admin / Pengajuan Aktivasi (spreadsheet) ← satu baris per buku, kolom KOLOM_AJU
// ID folder & spreadsheet disimpan di Script Property ADMIN_FOLDER / ADMIN_SHEET (dibuat otomatis saat pertama dipakai).
// Status di spreadsheet: Menunggu | Aktif | Ditolak | Nonaktif (boleh diubah langsung di sheet; terbaca dalam ±5 menit).
// Admin = ADMIN_EMAIL (pisahkan koma), bawaan: email pemilik bot.

/** Client ID OAuth aplikasi web (sama dengan KONFIG.clientId di web/assets/config.js; bukan rahasia). */
const CLIENT_ID_APLIKASI = '669221737081-jerp2njdv8dqibrvndei3sefolm4b1d5.apps.googleusercontent.com';
const NAMA_FOLDER_UTAMA = 'Dompet keluarga';
const NAMA_FOLDER_ADMIN = 'Admin';
const NAMA_SHEET_AJU = 'Pengajuan Aktivasi';
const TAB_AJU = 'Pengajuan';
const KOLOM_AJU = ['Dikirim', 'Email', 'Nama Buku', 'Kode Buku', 'Status', 'Bukti Transfer', 'Diubah', 'Alasan', 'Harga'];
/** Versi susunan kolom sheet; naikkan kalau KOLOM_AJU berubah supaya baris judul sheet lama ikut diperbarui. */
const VERSI_SHEET_AJU = '3';
const STATUS_AJU = { menunggu: 'Menunggu', aktif: 'Aktif', ditolak: 'Ditolak', nonaktif: 'Nonaktif' };

/** Drive / Sheets REST dengan akun pemilik bot. Gagal → Error dengan .status. */
function apiPemilik_(url, opsi) {
  const res = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, opsi || {}, {
    headers: Object.assign({ Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, (opsi || {}).headers || {}),
  }));
  const kode = res.getResponseCode();
  if (kode >= 300) {
    const err = new Error('Google ' + kode + ': ' + res.getContentText().slice(0, 200));
    err.status = kode;
    throw err;
  }
  const teks = res.getContentText();
  return teks ? JSON.parse(teks) : {};
}

function buatFolder_(nama, induk) {
  return apiPemilik_('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ name: nama, mimeType: 'application/vnd.google-apps.folder', parents: induk ? [induk] : undefined }),
  }).id;
}

/** File/folder milik bot masih ada (tidak terhapus / di Sampah)? */
function masihAda_(id) {
  if (!id) return false;
  try { return !apiPemilik_('https://www.googleapis.com/drive/v3/files/' + id + '?fields=trashed').trashed; } catch (e) { return false; }
}

function simpanProp_(kunci, nilai) {
  PropertiesService.getScriptProperties().setProperty(kunci, nilai);
  if (isiProperti_) isiProperti_[kunci] = nilai;
}

/** Folder "Dompet keluarga/Admin" (dibuat sekali). */
function folderAdmin_() {
  let id = properti_('ADMIN_FOLDER');
  if (masihAda_(id)) return id;
  id = buatFolder_(NAMA_FOLDER_ADMIN, buatFolder_(NAMA_FOLDER_UTAMA));
  simpanProp_('ADMIN_FOLDER', id);
  return id;
}

/** Spreadsheet "Pengajuan Aktivasi" di folder Admin (dibuat sekali; pengajuan lama di Script Properties ikut dipindah). */
let idSheetAju_ = '';
function sheetAju_() {
  if (idSheetAju_) return idSheetAju_;
  let id = properti_('ADMIN_SHEET');
  if (masihAda_(id)) {
    if (properti_('ADMIN_SHEET_V') !== VERSI_SHEET_AJU) {
      apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + range_(TAB_AJU + '!A1') + '?valueInputOption=RAW', {
        method: 'put', contentType: 'application/json', payload: JSON.stringify({ values: [KOLOM_AJU] }),
      });
      simpanProp_('ADMIN_SHEET_V', VERSI_SHEET_AJU);
    }
    return (idSheetAju_ = id);
  }
  return denganKunci_(() => {
    isiProperti_ = null;
    id = properti_('ADMIN_SHEET');
    if (masihAda_(id)) return (idSheetAju_ = id);
    const folder = folderAdmin_();
    id = apiPemilik_('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ name: NAMA_SHEET_AJU, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folder] }),
    }).id;
    const sheet = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + '?fields=sheets.properties.sheetId').sheets[0].properties.sheetId;
    const kolom = (awal, akhir, px) => ({ updateDimensionProperties: { range: { sheetId: sheet, dimension: 'COLUMNS', startIndex: awal, endIndex: akhir }, properties: { pixelSize: px }, fields: 'pixelSize' } });
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [
        { updateSheetProperties: { properties: { sheetId: sheet, title: TAB_AJU, gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
        { repeatCell: { range: { sheetId: sheet, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        { setDataValidation: { range: { sheetId: sheet, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 }, rule: {
          condition: { type: 'ONE_OF_LIST', values: Object.keys(STATUS_AJU).map(k => ({ userEnteredValue: STATUS_AJU[k] })) }, showCustomUi: true, strict: true } } },
        kolom(0, 1, 140), kolom(1, 2, 220), kolom(2, 3, 150), kolom(3, 4, 330), kolom(4, 5, 100), kolom(5, 6, 330), kolom(6, 7, 140), kolom(7, 8, 320), kolom(8, 9, 100),
      ] }),
    });
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + range_(TAB_AJU + '!A1') + '?valueInputOption=RAW', {
      method: 'put', contentType: 'application/json', payload: JSON.stringify({ values: [KOLOM_AJU] }),
    });
    const baris = [];
    // Pindahan: pengajuan versi sebelumnya (Script Property req_<ID>) + fotonya dipindah ke folder Admin.
    const semua = PropertiesService.getScriptProperties().getProperties();
    Object.keys(semua).filter(k => /^req_/.test(k)).forEach(k => {
      let r = {};
      try { r = JSON.parse(semua[k]); } catch (e) { return; }
      if (r.foto) {
        try {
          const lama = (apiPemilik_('https://www.googleapis.com/drive/v3/files/' + r.foto + '?fields=parents').parents || []).join(',');
          apiPemilik_('https://www.googleapis.com/drive/v3/files/' + r.foto + '?addParents=' + folder + (lama ? '&removeParents=' + lama : ''), {
            method: 'patch', contentType: 'application/json', payload: '{}',
          });
        } catch (e) { console.warn('Foto ' + r.foto + ' tidak bisa dipindah: ' + e.message); }
      }
      baris.push(selAju_(k.slice(4), r));
    });
    if (baris.length) {
      apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ requests: [{ appendCells: { sheetId: sheet, rows: baris, fields: 'userEnteredValue,textFormatRuns' } }] }),
      });
    }
    simpanProp_('ADMIN_SHEET', id);
    simpanProp_('ADMIN_SHEET_V', VERSI_SHEET_AJU);
    Object.keys(semua).filter(k => /^req_/.test(k)).forEach(k => PropertiesService.getScriptProperties().deleteProperty(k));
    return (idSheetAju_ = id);
  });
}

const waktuAju_ = iso => String(iso || '').replace('T', ' ').slice(0, 16);
const linkFoto_ = id => (id ? 'https://drive.google.com/file/d/' + id + '/view' : '');
const idFoto_ = link => (String(link || '').match(/\/file\/d\/([\w-]+)/) || [])[1] || '';

function barisAju_(id, r) {
  return [waktuAju_(r.t), r.email || '', r.buku || '', id, STATUS_AJU[r.status] || STATUS_AJU.menunggu, linkFoto_(r.foto), waktuAju_(r.diubah),
    r.status === 'ditolak' ? String(r.alasan || '').slice(0, 300) : '', r.harga ? String(r.harga) : ''];
}

/**
 * Satu baris untuk Sheets batchUpdate. Semua isian ditulis sebagai teks (isian dari pembeli tidak pernah jadi rumus);
 * kolom Bukti Transfer diberi hyperlink sungguhan ke fotonya di Drive, jadi bisa langsung diklik di spreadsheet.
 */
function selAju_(id, r) {
  return { values: barisAju_(id, r).map((v, i) => (i === 5 && v
    ? { userEnteredValue: { stringValue: v }, textFormatRuns: [{ startIndex: 0, format: { link: { uri: v } } }] }
    : { userEnteredValue: { stringValue: String(v) }, textFormatRuns: [] })) };
}

/** sheetId tab Pengajuan (untuk batchUpdate). */
let tabAju_ = null;
function idTabAju_() {
  if (tabAju_ !== null) return tabAju_;
  const s = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + '?fields=sheets.properties(sheetId,title)').sheets || [];
  return (tabAju_ = ((s.find(x => x.properties.title === TAB_AJU) || s[0]).properties.sheetId));
}

/** Semua baris pengajuan: [{ id, email, buku, t, status (huruf kecil), foto (ID file), diubah, alasan, harga (saat pengajuan), baris (nomor baris sheet) }]. */
function semuaPengajuan_() {
  pindahkanDicabut_();
  const j = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + '/values/' + range_(TAB_AJU + '!A2:I'));
  return (j.values || []).map((r, i) => ({
    t: String(r[0] || ''), email: String(r[1] || ''), buku: String(r[2] || ''), id: String(r[3] || '').trim(),
    status: String(r[4] || '').trim().toLowerCase() || 'menunggu', foto: idFoto_(r[5]), diubah: String(r[6] || ''), alasan: String(r[7] || ''),
    harga: Number(String(r[8] || '').replace(/\D/g, '')) || 0, baris: i + 2,
  })).filter(r => r.id);
}

/**
 * Sekali saja: buku di daftar lama LISENSI_DICABUT yang di sheet masih "Aktif" ditulis jadi "Nonaktif", lalu daftar
 * itu dikosongkan. Sejak itu hanya kolom Status di spreadsheet yang menentukan.
 */
function pindahkanDicabut_() {
  const lama = daftarDicabut_();
  if (!lama.length) return;
  simpanDicabut_([]); // dikosongkan dulu supaya pemanggilan di bawah tidak masuk ke sini lagi
  const j = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + '/values/' + range_(TAB_AJU + '!A2:H'));
  const sheetId = idTabAju_();
  const ubah = (j.values || []).map((r, i) => ({ r, baris: i + 2 }))
    .filter(x => lama.indexOf(String(x.r[3] || '').trim()) >= 0 && String(x.r[4] || '').trim().toLowerCase() === 'aktif');
  if (!ubah.length) return;
  apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + ':batchUpdate', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ requests: ubah.map(x => ({ updateCells: {
      rows: [{ values: [{ userEnteredValue: { stringValue: STATUS_AJU.nonaktif } }] }], fields: 'userEnteredValue',
      start: { sheetId, rowIndex: x.baris - 1, columnIndex: 4 } } })) }),
  });
  ubah.forEach(x => CacheService.getScriptCache().remove('st_' + String(x.r[3]).trim()));
}

// ---- Riwayat (tab "Riwayat" di spreadsheet Pengajuan Aktivasi) ----
// Satu baris per kejadian, tidak pernah diubah / dihapus aplikasi: bukti dikirim (ulang), diaktifkan, ditolak, dinonaktifkan.
// Harga = harga versi penuh saat pembeli mengirim bukti; Aturan & Rekening = pengaturan penjualan saat kejadian itu.
const TAB_RIWAYAT = 'Riwayat';
const KOLOM_RIWAYAT = ['Waktu', 'Kode Buku', 'Email', 'Nama Buku', 'Peristiwa', 'Harga', 'Aturan Masa Gratis', 'Rekening Tujuan', 'Bukti Transfer', 'Alasan', 'Oleh'];
const PERISTIWA_STATUS = { aktif: 'Diaktifkan', nonaktif: 'Dinonaktifkan', ditolak: 'Ditolak' };

/** sheetId tab Riwayat; dibuat (beserta catatan awal dari pengajuan yang sudah ada) kalau belum ada. */
let tabRiwayat_ = null;
function idTabRiwayat_() {
  if (tabRiwayat_ !== null) return tabRiwayat_;
  const id = sheetAju_();
  const ada = (apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + '?fields=sheets.properties(sheetId,title)').sheets || [])
    .find(x => x.properties.title === TAB_RIWAYAT);
  if (ada) {
    tabRiwayat_ = ada.properties.sheetId;
    if (properti_('RIWAYAT_V') !== '2') rapikanRiwayatLama_(id, tabRiwayat_);
    return tabRiwayat_;
  }
  return denganKunci_(() => {
    const sid = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB_RIWAYAT, gridProperties: { frozenRowCount: 1 } } } }] }),
    }).replies[0].addSheet.properties.sheetId;
    const lebar = [140, 330, 220, 150, 150, 100, 260, 300, 330, 260, 200];
    // Pengajuan yang sudah ada sebelum riwayat dicatat: disusun ulang jadi "Bukti dikirim" + keputusannya.
    const awal = [].concat(...semuaPengajuan_().map(barisAwal_)).map(selRiwayat_);
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [
        { updateCells: { start: { sheetId: sid, rowIndex: 0, columnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
          rows: [{ values: KOLOM_RIWAYAT.map(k => ({ userEnteredValue: { stringValue: k }, userEnteredFormat: { textFormat: { bold: true } } })) }] } },
      ].concat(lebar.map((px, i) => ({ updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } })))
        .concat(awal.length ? [{ appendCells: { sheetId: sid, rows: awal, fields: 'userEnteredValue,textFormatRuns' } }] : []) }),
    });
    simpanProp_('RIWAYAT_V', '2');
    return (tabRiwayat_ = sid);
  });
}

/** Waktu file dibuat di Drive (WIB, "yyyy-MM-dd HH:mm"); '' kalau tidak bisa dibaca. Dipakai untuk waktu kirim bukti lama. */
function waktuFile_(idFile) {
  if (!idFile) return '';
  try {
    const t = apiPemilik_('https://www.googleapis.com/drive/v3/files/' + idFile + '?fields=createdTime').createdTime;
    return t ? Utilities.formatDate(new Date(t), TZ, 'yyyy-MM-dd HH:mm') : '';
  } catch (e) { return ''; }
}

/** Pengajuan yang tercatat sebelum ada riwayat → baris "Bukti dikirim" (+ keputusannya kalau sudah diputuskan). */
function barisAwal_(r) {
  const link = linkFoto_(r.foto), harga = r.harga ? String(r.harga) : '';
  const baris = [[waktuFile_(r.foto) || waktuAju_(r.t), r.id, r.email, r.buku, 'Bukti dikirim', harga, '', '', link, '', r.email]];
  if (PERISTIWA_STATUS[r.status]) {
    baris.push([waktuAju_(r.diubah || r.t), r.id, r.email, r.buku, PERISTIWA_STATUS[r.status], harga, '', '', link, r.status === 'ditolak' ? r.alasan || '' : '', '']);
  }
  return baris;
}

/** Sekali saja: baris "Status awal: …" dari versi sebelumnya dipecah jadi "Bukti dikirim" + keputusannya. */
function rapikanRiwayatLama_(idSheet, sid) {
  try {
    denganKunci_(() => {
      const nilai = (apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + idSheet + '/values/' + range_(TAB_RIWAYAT + '!A2:K')).values || [])
        .map(r => KOLOM_RIWAYAT.map((_, i) => String(r[i] || '')));
      if (nilai.some(r => /^Status awal: /.test(r[4]))) {
        const label = {};
        Object.keys(STATUS_AJU).forEach(k => { label[STATUS_AJU[k]] = k; });
        const baru = [].concat(...nilai.map(r => {
          const m = r[4].match(/^Status awal: (.+)$/);
          if (!m) return [r];
          const st = label[m[1]] || 'menunggu';
          return barisAwal_({ id: r[1], email: r[2], buku: r[3], harga: r[5], foto: idFoto_(r[8]), t: r[0], diubah: r[0], status: st, alasan: r[9] });
        }));
        apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + idSheet + ':batchUpdate', {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({ requests: [
            { deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: 1, endIndex: 1 + nilai.length } } },
            { appendCells: { sheetId: sid, rows: baru.map(selRiwayat_), fields: 'userEnteredValue,textFormatRuns' } },
          ] }),
        });
      }
      simpanProp_('RIWAYAT_V', '2');
    });
  } catch (e) {
    console.warn('Riwayat lama belum bisa dirapikan: ' + e.message);
  }
}

/** Tab Riwayat dipastikan ada SEBELUM pengajuan diubah, supaya catatan awalnya memakai keadaan lama. */
function siapkanRiwayat_() {
  try { idTabRiwayat_(); } catch (e) { console.warn('Riwayat belum bisa disiapkan: ' + e.message); }
}

/** Baris riwayat untuk Sheets batchUpdate: semua teks, kolom Bukti Transfer (indeks 8) diberi hyperlink. */
function selRiwayat_(nilai) {
  return { values: nilai.map((v, i) => (i === 8 && v
    ? { userEnteredValue: { stringValue: String(v) }, textFormatRuns: [{ startIndex: 0, format: { link: { uri: String(v) } } }] }
    : { userEnteredValue: { stringValue: String(v == null ? '' : v) }, textFormatRuns: [] })) };
}

function ringkasAturan_(j) {
  const trx = j.batasTransaksi + ' transaksi', per = j.batasPeriode + ' periode gajian';
  return j.aturan === 'transaksi' ? 'Gratis ' + trx : j.aturan === 'periode' ? 'Gratis ' + per : 'Gratis ' + trx + ' atau ' + per + ' (mana yang lebih dulu)';
}
function ringkasRekening_(j) {
  return j.rekening.map(r => r.bank + ' ' + r.nomor + (r.atasNama ? ' a.n. ' + r.atasNama : '') + (r.qris ? ' (+QRIS)' : '')).join('; ');
}

/** Mencatat satu kejadian. Gagal mencatat tidak menggagalkan aksinya (hanya peringatan di log). */
function catatRiwayat_(id, r, peristiwa, oleh, alasan) {
  try {
    const j = jual_();
    const sid = idTabRiwayat_();
    const baris = selRiwayat_([waktuAju_(sekarangIso_()), id, r.email || '', r.buku || '', peristiwa, String(r.harga || j.harga),
      ringkasAturan_(j), ringkasRekening_(j), linkFoto_(r.foto), alasan || '', oleh || '']);
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [{ appendCells: { sheetId: sid, rows: [baris], fields: 'userEnteredValue,textFormatRuns' } }] }),
    });
  } catch (e) {
    console.warn('Riwayat tidak tercatat: ' + e.message);
  }
}

/** Semua baris riwayat: [{ t, id, email, buku, peristiwa, harga, aturan, rekening, link, alasan, oleh }]. */
function semuaRiwayat_() {
  try {
    idTabRiwayat_();
    const j = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + '/values/' + range_(TAB_RIWAYAT + '!A2:K'));
    return (j.values || []).map(r => ({ t: String(r[0] || ''), id: String(r[1] || '').trim(), email: String(r[2] || ''), buku: String(r[3] || ''),
      peristiwa: String(r[4] || ''), harga: Number(String(r[5] || '').replace(/\D/g, '')) || 0, aturan: String(r[6] || ''), rekening: String(r[7] || ''),
      link: String(r[8] || ''), alasan: String(r[9] || ''), oleh: String(r[10] || '') })).filter(r => r.id);
  } catch (e) {
    console.warn('Riwayat tidak terbaca: ' + e.message);
    return [];
  }
}

/** Riwayat satu buku, terbaru dulu. */
function riwayatBuku_(id) {
  return semuaRiwayat_().map((r, i) => Object.assign(r, { i })).filter(r => r.id === id)
    .sort((a, b) => (a.t === b.t ? b.i - a.i : a.t < b.t ? 1 : -1)).map(r => { delete r.i; return r; });
}

// ---- Masukan (tab "Masukan" di spreadsheet Pengajuan Aktivasi) ----
// Dikirim pengguna dari halaman Kebijakan Privasi → Kontak (harus masuk Google, jadi emailnya pasti).
// Admin membalas dari admin.html (emoji dan/atau pesan); pengguna melihat balasannya di halaman yang sama.
const TAB_MASUKAN = 'Masukan';
const KOLOM_MASUKAN = ['ID', 'Waktu', 'Email', 'Jenis', 'Pesan', 'Emoji', 'Balasan', 'Dibalas', 'Oleh'];
const JENIS_MASUKAN = { masalah: 'Laporan masalah', kritik: 'Kritik', pengembangan: 'Saran pengembangan', fitur: 'Saran fitur' };
const EMOJI_MASUKAN = ['👍', '❤️', '🙏', '😄', '🔧', '✅', '👀', '🎉'];
const MAKS_MASUKAN_HARIAN = 10;

/** sheetId tab Masukan (dibuat sekali beserta judul kolomnya). */
let tabMasukan_ = null;
function idTabMasukan_() {
  if (tabMasukan_ !== null) return tabMasukan_;
  const id = sheetAju_();
  const cari = () => ((apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + '?fields=sheets.properties(sheetId,title)').sheets || [])
    .find(x => x.properties.title === TAB_MASUKAN) || null);
  const ada = cari();
  if (ada) return (tabMasukan_ = ada.properties.sheetId);
  return denganKunci_(() => {
    const lagi = cari();
    if (lagi) return (tabMasukan_ = lagi.properties.sheetId);
    const sid = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB_MASUKAN, gridProperties: { frozenRowCount: 1 } } } }] }),
    }).replies[0].addSheet.properties.sheetId;
    const lebar = [120, 140, 220, 150, 420, 70, 320, 140, 200];
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + id + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [
        { updateCells: { start: { sheetId: sid, rowIndex: 0, columnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
          rows: [{ values: KOLOM_MASUKAN.map(k => ({ userEnteredValue: { stringValue: k }, userEnteredFormat: { textFormat: { bold: true } } })) }] } },
      ].concat(lebar.map((px, i) => ({ updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } }))) }),
    });
    return (tabMasukan_ = sid);
  });
}

/** Semua masukan: [{ id, t, email, jenis (kunci), pesan, emoji, balasan, dibalas, oleh, baris }], terbaru dulu. */
function semuaMasukan_() {
  idTabMasukan_();
  const label = {};
  Object.keys(JENIS_MASUKAN).forEach(k => { label[JENIS_MASUKAN[k]] = k; });
  const j = apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + '/values/' + range_(TAB_MASUKAN + '!A2:I'));
  return (j.values || []).map((r, i) => ({
    id: String(r[0] || '').trim(), t: String(r[1] || ''), email: String(r[2] || '').trim().toLowerCase(),
    jenis: label[String(r[3] || '').trim()] || 'pengembangan', pesan: String(r[4] || ''), emoji: String(r[5] || ''),
    balasan: String(r[6] || ''), dibalas: String(r[7] || ''), oleh: String(r[8] || ''), baris: i + 2,
  })).filter(r => r.id).reverse();
}

const publikMasukan_ = r => ({ id: r.id, t: r.t, jenis: r.jenis, pesan: r.pesan, emoji: r.emoji, balasan: r.balasan, dibalas: r.dibalas });

function kirimMasukan_(akun, b) {
  const jenis = String(b.jenis || '');
  if (!JENIS_MASUKAN[jenis]) throw new Error('Pilih jenis masukannya.');
  const pesan = String(b.pesan || '').replace(/\r\n?/g, '\n').trim();
  if (pesan.length < 5) throw new Error('Tulis pesannya dulu (minimal 5 huruf).');
  if (pesan.length > 2000) throw new Error('Pesannya terlalu panjang (maksimal 2.000 huruf).');
  idTabMasukan_(); // dibuat di luar kunci di bawah (kuncinya tidak bisa dipakai bertumpuk)
  const baru = denganKunci_(() => {
    const kemarin = Utilities.formatDate(new Date(Date.now() - 864e5), TZ, 'yyyy-MM-dd HH:mm');
    const milik = semuaMasukan_().filter(r => r.email === akun.email);
    if (milik.filter(r => r.t > kemarin).length >= MAKS_MASUKAN_HARIAN) throw new Error('Sudah ' + MAKS_MASUKAN_HARIAN + ' pesan dalam 24 jam. Coba lagi besok, ya.');
    const r = { id: Utilities.getUuid().slice(0, 8), t: waktuAju_(sekarangIso_()), email: akun.email, jenis, pesan, emoji: '', balasan: '', dibalas: '' };
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [{ appendCells: { sheetId: idTabMasukan_(), fields: 'userEnteredValue',
        rows: [{ values: [r.id, r.t, r.email, JENIS_MASUKAN[jenis], pesan, '', '', '', ''].map(v => ({ userEnteredValue: { stringValue: v } })) }] } }] }),
    });
    return r;
  });
  try {
    daftarAdmin_().forEach(a => kirim_(a, '💬 <b>' + html_(JENIS_MASUKAN[jenis]) + '</b> dari ' + html_(akun.email) + '\n\n' + html_(pesan.slice(0, 600))
      + '\n\nBalas di halaman admin: ' + html_((properti_('URL_APLIKASI') || URL_APLIKASI) + 'admin.html')));
  } catch (e) { console.warn('Kabar masukan ke admin gagal: ' + e.message); }
  return { masukan: publikMasukan_(baru) };
}

function masukanSaya_(akun) {
  return { email: akun.email, masukan: semuaMasukan_().filter(r => r.email === akun.email).map(publikMasukan_) };
}

/** Admin membalas: emoji (salah satu EMOJI_MASUKAN atau kosong) dan/atau pesan. Keduanya kosong = balasan dihapus. */
function balasMasukan_(b, oleh) {
  const emoji = String(b.emoji || '');
  if (emoji && EMOJI_MASUKAN.indexOf(emoji) < 0) throw new Error('Emoji tidak dikenal.');
  const balasan = String(b.balasan || '').replace(/\r\n?/g, '\n').trim().slice(0, 2000);
  idTabMasukan_();
  return denganKunci_(() => {
    const r = semuaMasukan_().find(x => x.id === String(b.id || ''));
    if (!r) throw new Error('Masukan tidak ditemukan (mungkin baris di spreadsheet sudah dihapus).');
    const dibalas = emoji || balasan ? waktuAju_(sekarangIso_()) : '';
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [{ updateCells: { start: { sheetId: idTabMasukan_(), rowIndex: r.baris - 1, columnIndex: 5 }, fields: 'userEnteredValue',
        rows: [{ values: [emoji, balasan, dibalas, dibalas ? oleh : ''].map(v => ({ userEnteredValue: { stringValue: v } })) }] } }] }),
    });
    return { masukan: Object.assign(r, { emoji, balasan, dibalas, oleh: dibalas ? oleh : '' }) };
  });
}

function permintaan_(id) {
  return semuaPengajuan_().filter(r => r.id === id).pop() || null;
}

/** Ditulis ke baris buku itu (atau baris baru). */
function simpanPermintaan_(id, isi) {
  denganKunci_(() => {
    const ada = permintaan_(id);
    const sheetId = idTabAju_();
    const baris = selAju_(id, isi);
    const fields = 'userEnteredValue,textFormatRuns';
    apiPemilik_('https://sheets.googleapis.com/v4/spreadsheets/' + sheetAju_() + ':batchUpdate', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ requests: [ada
        ? { updateCells: { rows: [baris], fields, start: { sheetId, rowIndex: ada.baris - 1, columnIndex: 0 } } }
        : { appendCells: { sheetId, rows: [baris], fields } }] }),
    });
  });
  CacheService.getScriptCache().remove('st_' + id);
}

/**
 * Status satu buku untuk doGet & bot: { status, alasan }, status '' = tidak ada di spreadsheet. Di-cache 1 menit supaya
 * ringan (perubahan langsung di sheet, termasuk menghapus baris, terbaca paling lambat semenit). Sheet tidak terbaca →
 * { galat: true } (tidak di-cache).
 */
function statusPengajuan_(id) {
  const cache = CacheService.getScriptCache();
  const ada = cache.get('st_' + id);
  if (ada !== null) { try { return JSON.parse(ada); } catch (e) { /* format lama: baca ulang */ } }
  let r;
  try { r = permintaan_(id) || {}; } catch (e) { console.warn('Status pengajuan: ' + e.message); return { status: '', alasan: '', galat: true }; }
  const hasil = { status: r.status || '', alasan: r.status === 'ditolak' ? r.alasan || '' : '' };
  cache.put('st_' + id, JSON.stringify(hasil), 60);
  return hasil;
}

/** Token Google dari aplikasi → { email }. Hanya token yang dibuat untuk aplikasi ini (client ID sama) yang diterima. */
function akunGoogle_(token) {
  if (!token) throw new Error('Silakan masuk dengan akun Google dulu.');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  const j = res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : {};
  if (!j.email || (j.aud !== CLIENT_ID_APLIKASI && j.azp !== CLIENT_ID_APLIKASI)) throw new Error('Sesi login sudah habis. Muat ulang halaman lalu masuk lagi.');
  return { email: String(j.email).toLowerCase() };
}

/** Email pemilik bot (akun yang men-deploy), dari Drive "about" dengan token bot sendiri; disimpan sehari. */
function emailPemilik_() {
  const cache = CacheService.getScriptCache();
  const ada = cache.get('email_pemilik');
  if (ada) return ada;
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  const email = res.getResponseCode() === 200 ? String(JSON.parse(res.getContentText()).user.emailAddress || '').toLowerCase() : '';
  if (email) cache.put('email_pemilik', email, 21600);
  return email;
}

function adminWeb_(email) {
  const daftar = String(properti_('ADMIN_EMAIL') || emailPemilik_()).toLowerCase().split(/[\s,]+/).filter(Boolean);
  return daftar.indexOf(email) >= 0;
}

function apiLisensi_(b) {
  const akun = akunGoogle_(b && b.token);
  if (b.aksi === 'kirimMasukan') return kirimMasukan_(akun, b);
  if (b.aksi === 'masukanSaya') return masukanSaya_(akun);
  siapkanRiwayat_();
  if (b.aksi === 'minta') return mintaAktivasi_(akun, b);
  if (!adminWeb_(akun.email)) throw new Error('Akun ' + akun.email + ' bukan admin. Masuk dengan akun Google pemilik bot.');
  if (b.aksi === 'simpanJual') { simpanJual_(b.jual); return { jual: jualPublik_() }; }
  if (b.aksi === 'lihatQris') return { qris: gambarQris_(b.rek) };
  if (b.aksi === 'daftar') return { jual: jualPublik_(), daftar: daftarPermintaan_(), admin: akun.email, sheet: 'https://docs.google.com/spreadsheets/d/' + sheetAju_() + '/edit' };
  if (b.aksi === 'foto') return { foto: fotoBukti_(String(b.id || '')) };
  if (b.aksi === 'atur') return aturLisensi_(String(b.id || ''), String(b.status || ''), String(b.alasan || '').trim(), akun.email);
  if (b.aksi === 'riwayat') return { riwayat: riwayatBuku_(String(b.id || '')) };
  if (b.aksi === 'fotoFile') return { foto: fotoFile_(String(b.foto || '')) };
  if (b.aksi === 'daftarMasukan') return { masukan: semuaMasukan_(), emoji: EMOJI_MASUKAN };
  if (b.aksi === 'balasMasukan') return balasMasukan_(b, akun.email);
  throw new Error('Aksi tidak dikenal.');
}

/** Pembeli mengirim bukti transfer untuk buku `b.id`. Akun pengirim harus bisa membuka spreadsheet itu. */
function mintaAktivasi_(akun, b) {
  const id = String(b.id || '');
  if (!/^[\w-]{20,100}$/.test(id)) throw new Error('Kode buku tidak valid.');
  if (!properti_('LISENSI_KUNCI')) throw new Error('Pembayaran belum disiapkan admin. Coba lagi nanti.');
  const lama = permintaan_(id);
  if (lama && lama.status === 'aktif') return { status: 'aktif' };
  const foto = String(b.foto || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!foto) throw new Error('Lampirkan foto bukti transfer.');
  if (foto[2].length > 4e6) throw new Error('Fotonya terlalu besar. Pilih foto lain.');
  const cek = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name', {
    headers: { Authorization: 'Bearer ' + b.token }, muteHttpExceptions: true,
  });
  if (cek.getResponseCode() !== 200) throw new Error('Buku keuangan ini tidak bisa dibuka dari akun Anda.');
  const nama = String(JSON.parse(cek.getContentText()).name || '').replace(/^Dompet Keluarga\s*-?\s*/, '') || 'Keluarga';

  const mime = 'image/' + foto[1];
  const batas = 'dk' + Utilities.getUuid().replace(/-/g, '');
  const meta = JSON.stringify({ name: 'Bukti transfer - ' + akun.email + ' - ' + nama, mimeType: mime, parents: [folderAdmin_()] });
  const unggah = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + batas, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: Utilities.newBlob('--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
      + '\r\n--' + batas + '\r\nContent-Type: ' + mime + '\r\n\r\n').getBytes()
      .concat(Utilities.base64Decode(foto[2]), Utilities.newBlob('\r\n--' + batas + '--').getBytes()),
  });
  if (unggah.getResponseCode() !== 200) throw new Error('Foto belum bisa disimpan. Coba lagi sebentar lagi.');
  // Foto lama tidak dihapus: tetap bisa dibuka dari tab Riwayat.
  const sekarang = sekarangIso_();
  const baru = { email: akun.email, buku: nama.slice(0, 60), t: sekarang, status: 'menunggu', foto: JSON.parse(unggah.getContentText()).id, diubah: sekarang, harga: jual_().harga };
  simpanPermintaan_(id, baru);
  catatRiwayat_(id, baru, lama ? 'Bukti dikirim ulang' : 'Bukti dikirim', akun.email, '');
  daftarAdmin_().forEach(a => kirim_(a, '🔔 <b>Permintaan aktivasi baru</b>\n' + html_(akun.email) + ' · buku ' + html_(nama)
    + '\n\nBuka halaman admin: ' + html_((properti_('URL_APLIKASI') || URL_APLIKASI) + 'admin.html')));
  return { status: 'menunggu' };
}

function daftarPermintaan_() {
  const n = {};
  semuaRiwayat_().forEach(x => { n[x.id] = (n[x.id] || 0) + 1; });
  return semuaPengajuan_().map(r => ({ id: r.id, email: r.email, buku: r.buku, t: r.t, diubah: r.diubah, ada_foto: !!r.foto, alasan: r.alasan,
    status: r.status, link: linkFoto_(r.foto), harga: r.harga, riwayat: n[r.id] || 0 })).sort((x, y) => String(y.t).localeCompare(String(x.t)));
}

/** Foto bukti mana pun di folder Admin (dari riwayat), sebagai data URL. File di luar folder itu ditolak. */
function fotoFile_(idFile) {
  if (!/^[\w-]{10,}$/.test(idFile)) throw new Error('Foto tidak valid.');
  let induk = [];
  try { induk = apiPemilik_('https://www.googleapis.com/drive/v3/files/' + idFile + '?fields=parents').parents || []; } catch (e) { /* tidak ada */ }
  if (induk.indexOf(folderAdmin_()) < 0) throw new Error('Foto bukti tidak bisa dibuka (mungkin sudah dihapus dari Drive).');
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + idFile + '?alt=media', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Foto bukti tidak bisa dibuka (mungkin sudah dihapus dari Drive).');
  const blob = res.getBlob();
  return 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function fotoBukti_(id) {
  const r = permintaan_(id);
  if (!r || !r.foto) throw new Error('Foto bukti tidak ada.');
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + r.foto + '?alt=media', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Foto bukti tidak bisa dibuka (mungkin sudah dihapus dari Drive).');
  const blob = res.getBlob();
  return 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/**
 * status: 'aktif' (versi penuh terbuka di aplikasi pembeli), 'nonaktif' (dikunci), 'ditolak'. Hanya ditulis ke spreadsheet.
 * alasan: wajib untuk 'ditolak'; ditampilkan ke pembeli di layar Versi penuh.
 */
function aturLisensi_(id, status, alasan, oleh) {
  if (['aktif', 'nonaktif', 'ditolak'].indexOf(status) < 0) throw new Error('Status tidak dikenal.');
  if (status === 'ditolak' && !alasan) throw new Error('Pilih alasan penolakannya.');
  const r = permintaan_(id);
  if (!r) throw new Error('Permintaan tidak ditemukan.');
  simpanPermintaan_(id, Object.assign(r, { status, alasan: status === 'ditolak' ? alasan.slice(0, 300) : '', diubah: sekarangIso_() }));
  catatRiwayat_(id, r, PERISTIWA_STATUS[status], oleh || 'Telegram', status === 'ditolak' ? alasan : '');
  return { ok: true, status };
}

/** Ditambah lewat Sheets API (RAW: teks tidak pernah dianggap rumus), sama seperti aplikasi web. */
function tambahTransaksi_(t, email) {
  const id = Utilities.getUuid();
  const sekarang = keSerial_(sekarangIso_());
  sheets_('/values/' + range_("'Transaksi'!A1") + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', jsonSheets_('post', {
    values: [[id, keSerial_(t.tanggal), t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan, email, sekarang, sekarang]],
  }));
  return id;
}

/** Nomor baris sheet (2, 3, …) transaksi ini, dicari ulang sesaat sebelum menulis; 0 kalau sudah tidak ada. */
function barisTransaksi_(id) {
  const kolom = ((sheets_('/values/' + range_("'Transaksi'!A2:A") + '?majorDimension=COLUMNS').values || [])[0] || []).map(String);
  const i = kolom.indexOf(String(id));
  return i < 0 ? 0 : i + 2;
}

function ubahTransaksi_(id, t) {
  denganKunci_(() => {
    const n = barisTransaksi_(id);
    if (!n) throw new Error('Transaksi sudah tidak ada.');
    sheets_('/values:batchUpdate', jsonSheets_('post', {
      valueInputOption: 'RAW',
      data: [
        { range: "'Transaksi'!B" + n + ':H' + n, values: [[keSerial_(t.tanggal), t.tipe, t.jumlah, t.kategori, t.dompet, t.dompetTujuan, t.catatan]] },
        { range: "'Transaksi'!K" + n, values: [[keSerial_(sekarangIso_())]] },
      ],
    }));
  });
}

function hapusTransaksi_(id) {
  return denganKunci_(() => {
    const n = barisTransaksi_(id);
    if (!n) return false;
    const sh = (sheets_('?fields=' + range_('sheets.properties(sheetId,title)')).sheets || []).find(s => s.properties.title === 'Transaksi');
    sheets_(':batchUpdate', jsonSheets_('post', {
      requests: [{ deleteDimension: { range: { sheetId: sh.properties.sheetId, dimension: 'ROWS', startIndex: n - 1, endIndex: n } } }],
    }));
    return true;
  });
}

function saldo_(d) {
  const s = {};
  d.dompet.forEach(w => { s[w.nama] = w.saldoAwal; });
  const tambah = (k, n) => { if (k in s) s[k] += n; };
  d.transaksi.forEach(t => {
    if (t.tipe === TIPE.MASUK) tambah(t.dompet, t.jumlah);
    else if (t.tipe === TIPE.KELUAR) tambah(t.dompet, -t.jumlah);
    else if (t.tipe === TIPE.TRANSFER) { tambah(t.dompet, -t.jumlah); tambah(t.dompetTujuan, t.jumlah); }
  });
  return s;
}

// ======================================================================
// Teks balasan
// ======================================================================

function ikonKategori_(d, t) {
  if (t.tipe === TIPE.TRANSFER) {
    const tab = d.dompet.find(w => w.jenis === JENIS.TABUNGAN && (w.nama === t.dompetTujuan || w.nama === t.dompet));
    return tab ? tab.ikon : '🔁';
  }
  const k = d.kategori.find(k => k.nama === t.kategori && k.tipe === t.tipe);
  return k ? k.ikon : '🏷️';
}

function ringkasTransaksi_(d, t) {
  const tanda = t.tipe === TIPE.MASUK ? '+' : t.tipe === TIPE.KELUAR ? '−' : '';
  const judul = t.tipe === TIPE.TRANSFER ? t.dompet + ' → ' + t.dompetTujuan : t.kategori;
  return ikonKategori_(d, t) + ' ' + html_(judul) + '  <b>' + tanda + rp_(t.jumlah) + '</b>\n'
    + '<i>' + [t.tipe === TIPE.TRANSFER ? 'Transfer' : t.dompet, tglPendek_(t.tanggal), t.catatan].filter(Boolean).map(html_).join(' · ') + '</i>';
}

function peringatanAnggaran_(d, t) {
  if (t.tipe !== TIPE.KELUAR) return '';
  const k = d.kategori.find(k => k.tipe === TIPE.KELUAR && k.nama === t.kategori && k.anggaran > 0);
  if (!k) return '';
  const bulan = periode_(t.tanggal);
  const pakai = d.transaksi.filter(x => x.tipe === TIPE.KELUAR && x.kategori === k.nama && periode_(x.tanggal) === bulan)
    .reduce((a, x) => a + x.jumlah, 0);
  const persen = Math.round(pakai / k.anggaran * 100);
  if (pakai > k.anggaran) return '\n\n⛔ Anggaran ' + html_(k.nama) + ' lewat ' + rp_(pakai - k.anggaran) + ' (' + persen + '%)';
  if (persen >= 80) return '\n\n⚠️ Anggaran ' + html_(k.nama) + ' sudah ' + persen + '% · sisa ' + rp_(k.anggaran - pakai);
  return '\n\n🎯 Anggaran ' + html_(k.nama) + ': ' + persen + '% · sisa ' + rp_(k.anggaran - pakai);
}

function teksSaldo_(d) {
  const s = nilaiSekarang_(d);
  const emas = infoEmas_(d);
  const baris = jenis => d.dompet.filter(w => w.jenis === jenis).map(w => String(w.ikon).replace(/^(\p{Extended_Pictographic}️?)[A-Za-z].*$/u, '$1') + ' ' + html_(w.nama) + ': '
    + (emas[w.nama] ? gram_(emas[w.nama].gram) + ' · ' : '') + '<b>' + (emas[w.nama] && emas[w.nama].nilai === null ? 'harga belum ada' : rp_(s[w.nama])) + '</b>'
    + (w.target ? ' / ' + rp_(w.target) + ' (' + Math.floor(Math.max(0, s[w.nama]) / w.target * 100) + '%)' : ''));
  const dompet = baris(JENIS.DOMPET);
  const tabungan = baris(JENIS.TABUNGAN);
  const aset = baris(JENIS.ASET);
  const total = d.dompet.filter(w => w.jenis === JENIS.DOMPET).reduce((a, w) => a + s[w.nama], 0);
  const utang = d.dompet.filter(w => w.jenis === JENIS.UTANG && s[w.nama]).map(w => '🤝 ' + html_(w.nama) + ': '
    + (s[w.nama] > 0 ? 'berutang ke Anda <b>' + rp_(s[w.nama]) + '</b>' : 'Anda berutang <b>' + rp_(-s[w.nama]) + '</b>'));
  // Kekayaan bersih = semua dompet, tabungan, aset, dan piutang dikurangi utang (sama dengan aplikasi).
  const bersih = d.dompet.reduce((a, w) => a + (s[w.nama] || 0), 0);
  return ['💰 <b>Saldo dompet: ' + rp_(total) + '</b>', dompet.join('\n')]
    .concat(tabungan.length ? ['', '🐷 <b>Tabungan</b>', tabungan.join('\n')] : [])
    .concat(aset.length ? ['', '💎 <b>Aset</b>', aset.join('\n')] : [])
    .concat(utang.length ? ['', '🤝 <b>Utang & piutang</b>', utang.join('\n')] : [])
    .concat(aset.length || utang.length ? ['', '📈 Kekayaan bersih: <b>' + rp_(bersih) + '</b>'] : []).join('\n');
}

function teksRingkasan_(d, bulan) {
  const trx = d.transaksi.filter(t => periode_(t.tanggal) === bulan);
  const masuk = trx.filter(t => t.tipe === TIPE.MASUK).reduce((a, t) => a + t.jumlah, 0);
  const keluar = trx.filter(t => t.tipe === TIPE.KELUAR).reduce((a, t) => a + t.jumlah, 0);
  const per = {};
  trx.filter(t => t.tipe === TIPE.KELUAR).forEach(t => { per[t.kategori] = (per[t.kategori] || 0) + t.jumlah; });
  const top = Object.keys(per).sort((a, b) => per[b] - per[a]).slice(0, 5)
    .map(n => ikonKategori_(d, { tipe: TIPE.KELUAR, kategori: n }) + ' ' + html_(n) + ': ' + rp_(per[n]) + ' (' + Math.round(per[n] / keluar * 100) + '%)');
  return [
    '📊 <b>Ringkasan ' + namaBulan_(bulan) + '</b>',
    '⬇️ Pemasukan: <b>' + rp_(masuk) + '</b>',
    '⬆️ Pengeluaran: <b>' + rp_(keluar) + '</b>',
    '= Selisih: <b>' + rp_(masuk - keluar) + '</b>',
  ].concat(top.length ? ['', '<b>Pengeluaran terbesar</b>'].concat(top) : ['', 'Belum ada pengeluaran.']).join('\n');
}

function teksAnggaran_(d, bulan) {
  const daftar = d.kategori.filter(k => k.tipe === TIPE.KELUAR && k.anggaran > 0);
  if (!daftar.length) return '🎯 Belum ada anggaran. Atur di aplikasi: Beranda → Anggaran.';
  const pakai = n => d.transaksi.filter(t => t.tipe === TIPE.KELUAR && t.kategori === n && periode_(t.tanggal) === bulan).reduce((a, t) => a + t.jumlah, 0);
  return ['🎯 <b>Anggaran ' + namaBulan_(bulan) + '</b>'].concat(daftar.map(k => {
    const p = pakai(k.nama);
    const persen = Math.round(p / k.anggaran * 100);
    const tanda = p > k.anggaran ? '⛔' : persen >= 80 ? '⚠️' : '✅';
    return tanda + ' ' + k.ikon + ' ' + html_(k.nama) + ': ' + rp_(p) + ' / ' + rp_(k.anggaran) + ' (' + persen + '%)';
  })).join('\n');
}

function teksRiwayat_(d, bulan) {
  const trx = d.transaksi.filter(t => !bulan || periode_(t.tanggal) === bulan)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat)).slice(0, 10);
  if (!trx.length) return 'Belum ada transaksi.';
  return ['🧾 <b>Transaksi terakhir' + (bulan ? ' ' + namaBulan_(bulan) : '') + '</b>']
    .concat(trx.map(t => {
      const tanda = t.tipe === TIPE.MASUK ? '+' : t.tipe === TIPE.KELUAR ? '−' : '';
      return ikonKategori_(d, t) + ' ' + tglPendek_(t.tanggal) + ' · ' + html_(t.tipe === TIPE.TRANSFER ? t.dompet + ' → ' + t.dompetTujuan : t.kategori)
        + ' <b>' + tanda + rp_(t.jumlah) + '</b>' + (t.catatan ? ' · <i>' + html_(t.catatan) + '</i>' : '');
    })).join('\n');
}

// ======================================================================
// Telegram API
// ======================================================================

/** Permintaan Telegram untuk UrlFetchApp.fetchAll (bisa dikirim bersamaan dengan permintaan lain). */
function permintaanTg_(metode, data) {
  return {
    url: 'https://api.telegram.org/bot' + properti_('TELEGRAM_TOKEN') + '/' + metode,
    method: 'post', contentType: 'application/json', payload: JSON.stringify(data || {}), muteHttpExceptions: true,
  };
}

function tg_(metode, data) {
  const j = jsonTg_(UrlFetchApp.fetchAll([permintaanTg_(metode, data)])[0]);
  if (!j.ok) console.error('Telegram ' + metode + ': ' + j.description);
  return j;
}

/** Jawaban Telegram dari UrlFetchApp → objek { ok, result, description }. */
function jsonTg_(res) {
  try { return JSON.parse(res.getContentText()); } catch (e) { return { ok: false, description: 'HTTP ' + res.getResponseCode() }; }
}

function kirim_(chatId, teks, tombol) {
  teks = String(teks || '');
  if (teks.length > 3900) {
    const bagian = [];
    let sisa = teks;
    while (sisa.length > 3900) {
      let potong = sisa.lastIndexOf('\n', 3900);
      if (potong < 1500) potong = 3900;
      bagian.push(sisa.slice(0, potong));
      sisa = sisa.slice(potong).replace(/^\n+/, '');
    }
    bagian.push(sisa);
    let r;
    bagian.forEach((b, i) => { r = kirim_(chatId, b, i === bagian.length - 1 ? tombol : null); });
    return r;
  }
  const data = {
    chat_id: chatId, text: teks, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: tombol ? { inline_keyboard: tombol } : undefined,
  };
  const r = tg_('sendMessage', data);
  // Format HTML ditolak (mis. teks AI yang aneh) → kirim ulang sebagai teks polos.
  if (!r.ok && /parse entities/i.test(r.description || '')) {
    return tg_('sendMessage', Object.assign(data, { parse_mode: undefined, text: teksPolos_(teks) }));
  }
  return r;
}

function teksPolos_(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function ubahPesan_(chatId, msgId, teks, tombol) {
  return tg_('editMessageText', {
    chat_id: chatId, message_id: msgId, text: teks, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: tombol ? { inline_keyboard: tombol } : undefined,
  });
}

// ======================================================================
// Helper
// ======================================================================

function rp_(n) {
  return (n < 0 ? '−Rp' : 'Rp') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function html_(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function hariIni_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** Periode yang sedang berjalan (mengikuti tanggal gajian, lihat periode_). */
function bulanIni_() {
  return periode_(hariIni_());
}

/**
 * Tanggal mulai periode gajian dari sheet Pengaturan (MULAI_PERIODE, 1–28), diisi oleh muatData_.
 * Kunci periode = bulan tempat periode dimulai, sama seperti aplikasi web (web/assets/db.js).
 */
let mulaiPeriode_ = 1;
function periode_(tgl) {
  const [y, m, d] = String(tgl).split('-').map(Number);
  if (mulaiPeriode_ <= 1 || d >= mulaiPeriode_) return String(tgl).slice(0, 7);
  return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
}

function sekarangIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function tgl_(v) {
  return tglWaktu_(v).slice(0, 10);
}

/** Isi sel (Date dari SpreadsheetApp, angka serial dari Sheets API, atau teks) → "yyyy-MM-ddTHH:mm:ss". */
function tglWaktu_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss");
  if (typeof v === 'number') return new Date(EPOCH_SERIAL + Math.round(v * 864e5)).toISOString().slice(0, 19);
  return String(v);
}

/** "yyyy-MM-dd" atau "yyyy-MM-ddTHH:mm:ss" (jam Jakarta) → angka serial Sheets. */
function keSerial_(s) {
  const [y, m, d, jam, menit, detik] = s.split(/[-T:]/).map(Number);
  return (Date.UTC(y, m - 1, d, jam || 0, menit || 0, detik || 0) - EPOCH_SERIAL) / 864e5;
}

function keTanggal_(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function tglPendek_(s) {
  if (s === hariIni_()) return 'hari ini';
  const [, m, d] = s.split('-').map(Number);
  return d + ' ' + NAMA_BULAN[m - 1];
}

function namaBulan_(b) {
  const [y, m] = b.split('-').map(Number);
  if (mulaiPeriode_ <= 1) return NAMA_BULAN_PANJANG[m - 1] + ' ' + y;
  const akhir = new Date(y, m, mulaiPeriode_ - 1); // bulan berikutnya, sehari sebelum tanggal mulai
  return mulaiPeriode_ + ' ' + NAMA_BULAN[m - 1] + ' – ' + akhir.getDate() + ' ' + NAMA_BULAN[akhir.getMonth()] + ' ' + akhir.getFullYear();
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

// ======================================================================
// Baca struk berlapis & Gemini (sama dengan versi aplikasi)
// ======================================================================

/**
 * Menjalankan beberapa permintaan Gemini sekaligus. Mulai dari kunci giliran berikutnya;
 * permintaan yang gagal karena kuota/kunci diulang dengan kunci lain, dan yang gagal karena
 * model sedang sibuk/tidak tersedia diulang dengan model cadangan.
 * Mengembalikan array sejajar dengan `permintaan`: objek hasil, atau Error.
 * `ikut` (opsional): { minta: [permintaan UrlFetchApp lain] } yang ikut dikirim bersamaan di putaran
 * pertama; jawabannya ditaruh di ikut.jawaban (tetap null kalau putaran itu gagal total).
 */
function jalankanGemini_(daftar, model, permintaan, skema, ikut) {
  const props = PropertiesService.getScriptProperties();
  const mulai = (Number(props.getProperty('GEMINI_GILIRAN')) || 0) % daftar.length;
  props.setProperty('GEMINI_GILIRAN', String((mulai + 1) % daftar.length));
  const model2 = [model].concat(MODEL_CADANGAN.filter(function (m) { return m !== model; }));

  const hasil = [];
  let sisa = permintaan.map(function (_, i) { return i; });
  for (let mi = 0; mi < model2.length && sisa.length; mi++) {
    if (mi > 0) Utilities.sleep(500);
    const lainModel = [];
    for (let n = 0; n < daftar.length && sisa.length; n++) {
      if (Date.now() - mulaiProses_ > BATAS_AI_MS) {
        sisa.concat(lainModel).forEach(function (i) { hasil[i] = new Error('Gemini terlalu lama menjawab'); });
        return hasil;
      }
      const kunci = daftar[(mulai + n) % daftar.length];
      let jawaban;
      try {
        const minta = sisa.map(function (i) { return mintaGemini_(kunci, model2[mi], permintaan[i].parts, skema, permintaan[i].pikir); });
        const sertakan = ikut && ikut.minta && !ikut.terkirim ? ikut.minta : [];
        if (ikut) ikut.terkirim = true;
        jawaban = UrlFetchApp.fetchAll(minta.concat(sertakan));
        if (sertakan.length) ikut.jawaban = jawaban.splice(minta.length);
      } catch (e) {
        console.error('Gemini tidak bisa dihubungi: ' + e);
        sisa.forEach(function (i) { hasil[i] = new Error('Gemini terlalu lama menjawab atau tidak bisa dihubungi'); });
        return hasil;
      }
      const ulang = [];
      jawaban.forEach(function (res, j) {
        const i = sisa[j];
        try {
          try {
            hasil[i] = bacaJawabanGemini_(res, !skema);
          } catch (e) {
            if (!e.argumen || permintaan[i].pikir == null || /pro/i.test(model2[mi])) throw e;
            console.warn(permintaan[i].sumber + ': ' + model2[mi] + ' menolak permintaan (' + e.message + '), ulang tanpa pengaturan thinking');
            hasil[i] = bacaJawabanGemini_(UrlFetchApp.fetchAll([mintaGemini_(kunci, model2[mi], permintaan[i].parts, skema, null)])[0], !skema);
          }
          console.log(permintaan[i].sumber + ' memakai ' + model2[mi] + ', kunci ' + samarkanKunci_(kunci));
        } catch (e) {
          hasil[i] = e;
          if (e.gantiKunci) {
            console.warn(permintaan[i].sumber + ': kunci ' + samarkanKunci_(kunci) + ' gagal (' + e.message + '), coba kunci lain');
            ulang.push(i);
          } else if (e.gantiModel || e.argumen) {
            console.warn(permintaan[i].sumber + ': ' + model2[mi] + ' gagal (' + e.message + '), coba model cadangan');
            lainModel.push(i);
          }
        }
      });
      sisa = ulang;
    }
    sisa = lainModel;
  }
  return hasil;
}

/**
 * Membaca foto struk secara berlapis, lalu hasilnya dicocokkan:
 *   1. "AI foto"  : Gemini membaca gambar langsung.
 *   2. "OCR"      : gambar → teks (OCR Google Drive) → dibaca dengan aturan biasa (tanpa AI).
 *   3. "OCR + AI" : teks OCR yang sama disimpulkan Gemini — hanya cadangan kalau AI foto tidak memberi nominal.
 * AI foto tidak butuh teks OCR, jadi AI foto dan unggahan OCR dikirim bersamaan.
 * Mengembalikan { jumlah, tanggal, kategori, catatan, toko, barang, yakin, pilihanJumlah, lapis }.
 */
function bacaStruk_(base64, mime, kategori, daftarKunci, model, ekstra) {
  if (!/^image\/(jpeg|png|webp)$/.test(String(mime))) throw new Error('Format gambar tidak didukung.');
  const hariIni = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  console.log('bacaStruk: model ' + model + ', ukuran gambar ' + Math.round(String(base64).length * 0.75 / 1024) + ' KB');

  const hasil = [];   // { sumber, jumlah, tanggal, kategori, catatan }
  const gagal = [];   // pesan error per lapis, untuk pesan akhir
  const skema = skemaStruk_(kategori);
  const dariAi = function (sumber, h) {
    try {
      if (h instanceof Error) throw h;
      console.log('bacaStruk: ' + sumber + ' → ' + JSON.stringify(h));
      const jumlah = Math.round(Number(h.jumlah) || 0);
      if (jumlah > 0) {
        hasil.push({
          sumber: sumber,
          jumlah: jumlah,
          tanggal: tanggalWajar_(h.tanggal, hariIni),
          kategori: kategori.indexOf(h.kategori) >= 0 ? h.kategori : '',
          catatan: teks_(h.catatan).slice(0, 120),
          toko: teks_(h.toko).replace(/\s+/g, ' ').slice(0, 60),
          barang: rapikanBarang_(h.barang, jumlah),
        });
      }
    } catch (e) {
      console.error('bacaStruk: ' + sumber + ' gagal: ' + e.message);
      gagal.push(e.message);
    }
  };

  // Lapis 1 + unggahan OCR (+ permintaan `ekstra` dari pemanggil, mis. baca sheet Transaksi), bersamaan.
  const unggah = { minta: [mintaUnggahOcr_(base64, mime)].concat(ekstra ? ekstra.minta : []), jawaban: null };
  if (daftarKunci.length) {
    dariAi('AI foto', jalankanGemini_(daftarKunci, model, [{
      sumber: 'AI foto', pikir: PIKIR_STRUK_FOTO, parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: petunjukStruk_('gambar', hariIni) }],
    }], skema, unggah)[0]);
  }
  if (!unggah.terkirim) {
    try { unggah.jawaban = UrlFetchApp.fetchAll(unggah.minta); } catch (e) { console.error('bacaStruk: unggah OCR gagal: ' + e); }
  }
  if (ekstra && unggah.jawaban) ekstra.jawaban = unggah.jawaban.slice(1);
  waktu_('AI foto & unggah OCR selesai');

  // Lapis 2: file OCR sudah jadi, tinggal diambil teksnya (cepat) lalu dibaca dengan aturan biasa.
  let teksOcr = '';
  try {
    if (!unggah.jawaban) throw new Error('unggahan OCR tidak selesai');
    teksOcr = teksOcrDrive_(unggah.jawaban[0]);
    console.log('bacaStruk: teks OCR\n' + teksOcr.slice(0, 3000));
    const aturan = tebakDariTeks_(teksOcr, hariIni);
    if (aturan.jumlah) hasil.push(Object.assign({ sumber: 'OCR' }, aturan));
  } catch (e) {
    console.error('bacaStruk: OCR gagal: ' + e);
    gagal.push('OCR gagal');
  }
  waktu_('OCR selesai');

  // Lapis 3: cadangan kalau AI foto gagal / tidak menemukan nominal.
  if (daftarKunci.length && teksOcr.trim() && !hasil.some(function (h) { return h.sumber === 'AI foto'; })) {
    dariAi('OCR + AI', jalankanGemini_(daftarKunci, model, [{
      sumber: 'OCR + AI', pikir: PIKIR_STRUK, parts: [{ text: petunjukStruk_('teks', hariIni) + '\n\nTeks OCR:\n"""\n' + teksOcr.slice(0, 8000) + '\n"""' }],
    }], skema)[0]);
    waktu_('OCR + AI selesai');
  }

  if (!hasil.length) {
    const alasan = gagal.filter(function (g) { return /Kunci API|Kuota/.test(g); })[0];
    throw new Error(alasan || ('Nominal pembayaran tidak ditemukan di gambar. Coba foto ulang dengan lebih terang dan lurus'
      + (daftarKunci.length ? '.' : ', atau aktifkan AI di aplikasi (⚙️ → Fitur AI (Gemini)).')));
  }
  return gabungHasilStruk_(hasil);
}

/**
 * Mencocokkan hasil semua lapis: total dengan suara (berbobot) terbanyak menang.
 * "OCR + AI" dan "OCR" membaca teks OCR yang sama (salah baca OCR membuat keduanya salah),
 * jadi "AI foto" diberi bobot 2 supaya tidak kalah suara oleh mereka.
 */
function gabungHasilStruk_(hasil) {
  const URUTAN = ['AI foto', 'OCR + AI', 'OCR'];
  const BOBOT = { 'AI foto': 2, 'OCR + AI': 1, 'OCR': 1 };
  hasil.sort(function (a, b) { return URUTAN.indexOf(a.sumber) - URUTAN.indexOf(b.sumber); });

  const grup = [];
  hasil.forEach(function (h) {
    const g = grup.filter(function (x) { return x.jumlah === h.jumlah; })[0];
    if (g) g.sumber.push(h.sumber);
    else grup.push({ jumlah: h.jumlah, sumber: [h.sumber] });
  });
  // Suara terbanyak dulu; kalau seri, urutan prioritas lapis (sudah terurut) dipertahankan.
  const skor = function (g) { return g.sumber.reduce(function (n, s) { return n + (BOBOT[s] || 1); }, 0); };
  grup.sort(function (a, b) { return skor(b) - skor(a); });

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
    toko: ambil('toko'),
    barang: (urut.filter(function (x) { return x.barang && x.barang.length; })[0] || {}).barang || [],
    yakin: grup[0].sumber.length >= 2,
    pilihanJumlah: grup,
    lapis: hasil.map(function (h) { return h.sumber; }),
  };
}

function petunjukStruk_(bentuk, hariIni) {
  return [
    bentuk === 'gambar'
      ? 'Ini gambar bukti belanja atau bukti pembayaran dari Indonesia: bisa struk cetak yang difoto (mungkin miring, buram, atau ada bayangan), nota tulisan tangan, screenshot pembelian online, atau bukti transfer / QRIS / e-wallet / m-banking / pembayaran tagihan.'
      : 'Ini teks hasil OCR dari bukti belanja atau bukti pembayaran di Indonesia (struk, nota, transfer, QRIS, e-wallet, tagihan). Teksnya bisa berantakan dan ada salah baca, misalnya O/0, l/1, S/5, B/8.',
    'Isi:',
    '- jumlah: uang yang dibayar / keluar dalam rupiah, bilangan bulat tanpa titik/koma.',
    '  Struk belanja: total akhir setelah diskon dan pajak (bukan uang tunai yang diberikan, bukan kembalian).',
    '  Tidak semua bukti punya tulisan "Total". Bukti transfer, QRIS, e-wallet, dan m-banking sering hanya menampilkan satu nominal besar (mis. "Rp25.000", "IDR 25,000.00", "- Rp 25.000"): itulah jumlahnya. Kalau ada biaya admin dan tertera total yang sudah termasuk biaya, pakai total itu.',
    '  Jangan pakai saldo, sisa saldo, limit, poin, cashback, nomor rekening, nomor referensi, atau nomor telepon.',
    '  Nota tanpa total: jumlahkan harga semua barang. Isi 0 hanya jika sama sekali tidak ada nominal uang yang dibayar.',
    '  Di Indonesia titik adalah pemisah ribuan, jadi "25.000" = 25000; "25.000,00" juga 25000. Tulisan tangan "25" atau "25rb" pada nota biasanya berarti 25000.',
    '- tanggal: tanggal transaksi format yyyy-mm-dd. Kosongkan jika tidak ada. Hari ini ' + hariIni + '.',
    '- kategori: pilih satu yang paling cocok dari daftar.',
    '- catatan: nama toko / penerima lalu ringkasan barang atau keperluan, maksimal 80 karakter. Contoh: "Indomaret - susu, roti, sabun" atau "Transfer ke Budi".',
    PETUNJUK_BARANG,
  ].join('\n');
}

/** Sama dengan aplikasi (web/assets/struk.js), supaya riwayat harga dari aplikasi & Telegram seragam. */
const PETUNJUK_BARANG = [
  '- toko: nama toko / merchant saja (mis. "Indomaret", "Alfamart", "Superindo", "Toko Sumber Rejeki"). Kosongkan untuk transfer ke orang atau kalau tidak tertera.',
  '- barang: SEMUA barang di struk belanja, satu per baris barang. Kosongkan (array kosong) untuk bukti transfer, tagihan, atau QRIS tanpa daftar barang.',
  '  nama = nama barang yang mudah dibaca beserta merek & ukurannya, huruf besar-kecil wajar, singkatan struk dirapikan',
  '  (mis. "MINYAK BIMOLI 2L PCH" → "Minyak Bimoli 2L", "INDOMIE GRG SPL" → "Indomie Goreng Spesial").',
  '  harga = harga per satu satuan yang benar-benar dibayar (setelah diskon barang itu), bilangan bulat rupiah. Barang timbangan: harga per kg.',
  '  jumlah = banyaknya (qty, atau berat dalam kg untuk barang timbangan, mis. 0.5). Jangan masukkan baris total, diskon, pajak, kantong, atau donasi.',
].join('\n');

/** Daftar barang { nama, harga (per satuan), jumlah }; dibuang semua kalau jauh melebihi total struk (AI salah baca). */
function rapikanBarang_(b, total) {
  if (!Array.isArray(b)) return [];
  const daftar = b.map(x => ({
    nama: teks_(x && x.nama).replace(/\s+/g, ' ').slice(0, 60),
    harga: Math.round(Number(x && x.harga) || 0),
    jumlah: Math.round((Number(x && x.jumlah) || 1) * 1000) / 1000,
  })).filter(x => x.nama && x.harga > 0 && x.jumlah > 0).slice(0, 60);
  const jml = daftar.reduce((a, x) => a + x.harga * x.jumlah, 0);
  return jml > total * 3 ? [] : daftar;
}

function skemaStruk_(kategori) {
  return {
    type: 'OBJECT',
    properties: {
      jumlah: { type: 'INTEGER' },
      tanggal: { type: 'STRING' },
      kategori: kategori.length ? { type: 'STRING', enum: kategori } : { type: 'STRING' },
      catatan: { type: 'STRING' },
      toko: { type: 'STRING' },
      barang: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { nama: { type: 'STRING' }, harga: { type: 'INTEGER' }, jumlah: { type: 'NUMBER' } },
          required: ['nama', 'harga', 'jumlah'],
        },
      },
    },
    required: ['jumlah', 'tanggal', 'kategori', 'catatan', 'toko', 'barang'],
  };
}

/** `pikir`: anggaran thinking (token); kosong = bawaan model. */
function mintaGemini_(kunci, model, parts, skema, pikir) {
  const config = skema ? { responseMimeType: 'application/json', responseSchema: skema } : {};
  // Model seri Pro tidak bisa mematikan thinking (ditolak 400), jadi dibiarkan bawaan.
  if (pikir != null && !/pro/i.test(model)) config.thinkingConfig = { thinkingBudget: pikir };
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': kunci },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: config,
    }),
  };
}

/** polos: jawaban teks biasa (tanpa skema JSON) → { jawaban: teks }. */
function bacaJawabanGemini_(res, polos) {
  const kode = res.getResponseCode();
  if (kode !== 200) {
    console.error('Gemini HTTP ' + kode + ' ' + res.getContentText().slice(0, 1000));
    let pesan = '';
    try { pesan = JSON.parse(res.getContentText()).error.message; } catch (e) { pesan = res.getContentText().slice(0, 200); }
    let err;
    if (kode === 400 && /API key/i.test(pesan)) err = new Error('Kunci API Gemini tidak valid. Periksa lagi di ⚙️ Pengaturan.');
    else if (kode === 429) err = new Error('Kuota semua kunci Gemini sedang habis. Coba lagi nanti, atau tambah kunci lain di ⚙️ Pengaturan.');
    else if (kode === 403) err = new Error('Kunci API Gemini ditolak (403). Periksa lagi di ⚙️ Pengaturan.');
    else if (kode >= 500) err = new Error('Gemini sedang sibuk (' + kode + '), coba lagi sebentar lagi');
    else if (kode === 404) err = new Error('Model Gemini tidak ditemukan (404)');
    else err = new Error('Gemini error ' + kode + ': ' + pesan);
    err.gantiKunci = kode === 429 || kode === 403 || (kode === 400 && /API key/i.test(pesan));
    err.gantiModel = kode >= 500 || kode === 404;
    // 400 selain kunci: biasanya pengaturan permintaan yang tidak didukung versi model terbaru (mis. thinkingBudget
    // setelah alias "-latest" pindah ke model baru). Diulang tanpa pengaturan thinking, lalu dengan model cadangan.
    err.argumen = kode === 400 && !err.gantiKunci;
    throw err;
  }
  try {
    const parts = JSON.parse(res.getContentText()).candidates[0].content.parts;
    const teks = parts.filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ''; }).join('');
    if (polos) { if (!teks.trim()) throw new Error('kosong'); return { jawaban: teks }; }
    return JSON.parse(teks);
  } catch (e) {
    console.error('Jawaban Gemini tidak bisa dibaca: ' + res.getContentText().slice(0, 2000));
    throw new Error('Jawaban Gemini tidak bisa dibaca.');
  }
}

/**
 * OCR bawaan Google Drive, langkah 1: permintaan unggah gambar sebagai Google Docs (dikonversi OCR).
 * Berupa permintaan UrlFetchApp supaya bisa dikirim bersamaan dengan Gemini (lihat bacaStruk_).
 */
function mintaUnggahOcr_(base64, mime) {
  const batas = 'dk' + Utilities.getUuid().replace(/-/g, '');
  const meta = JSON.stringify({ name: 'Dompet Keluarga - OCR sementara', mimeType: 'application/vnd.google-apps.document' });
  const awal = '--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
    + '\r\n--' + batas + '\r\nContent-Type: ' + mime + '\r\n\r\n';
  const akhir = '\r\n--' + batas + '--';
  return {
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=id&fields=id',
    method: 'post',
    contentType: 'multipart/related; boundary=' + batas,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: Utilities.newBlob(awal).getBytes().concat(Utilities.base64Decode(base64), Utilities.newBlob(akhir).getBytes()),
    muteHttpExceptions: true,
  };
}

/** OCR langkah 2: dari jawaban unggah, ambil teksnya lalu hapus file sementara. */
function teksOcrDrive_(resUnggah) {
  if (resUnggah.getResponseCode() !== 200) {
    throw new Error('unggah HTTP ' + resUnggah.getResponseCode() + ' ' + resUnggah.getContentText().slice(0, 200));
  }
  const id = JSON.parse(resUnggah.getContentText()).id;
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  try {
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text/plain', { headers: auth, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('export HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
    return res.getContentText().replace(/^﻿/, '');
  } finally {
    const hapus = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'delete', headers: auth, muteHttpExceptions: true });
    if (hapus.getResponseCode() >= 300) console.warn('Gagal menghapus file OCR sementara: HTTP ' + hapus.getResponseCode());
  }
}

/**
 * Membaca total & tanggal dari teks OCR dengan aturan biasa (tanpa AI), berjenjang (sama dengan aplikasi):
 *   1. baris berlabel total / bayar / nominal / transfer (nominal di baris itu atau baris berikutnya);
 *   2. tanpa label (bukti transfer, QRIS, e-wallet): nominal terbesar yang diawali "Rp"/"IDR";
 *   3. masih kosong: nominal terbesar yang berpemisah ribuan (mis. 25.000).
 * Baris saldo, kembalian, uang tunai, pajak, nomor rekening/referensi selalu dilewati.
 */
function tebakDariTeks_(teks, hariIni) {
  const baris = teks.split(/\r?\n/).map(function (b) { return b.trim(); }).filter(Boolean);
  const TOTAL = /(grand\s*total|total|jumlah|tagihan|harus\s*dibayar|dibayar|bayar|pembayaran|nominal|transfer|amount|nilai)/i;
  const BUKAN = /(sub\s*-?\s*total|total\s*(item|qty|diskon|hemat|potongan)|kembali|change|tunai|cash|ppn|pajak|tax|disc|saldo|sisa|limit|poin|point|cashback|rekening|no\.?\s*rek|referensi|\bref\b|telp|hp\b)/i;
  const boleh = baris.map(function (b) { return BUKAN.test(b) ? '' : b; });
  const maks = function (daftar) { return daftar.reduce(function (a, n) { return n > a ? n : a; }, 0); };

  let jumlah = 0;
  boleh.forEach(function (b, i) {
    if (!b || !TOTAL.test(b)) return;
    // Nominal bisa di baris yang sama, atau di baris berikutnya kalau OCR memisahkannya.
    const n = nominalTerbesar_(b) || nominalTerbesar_(boleh[i + 1] || '');
    if (n > jumlah) jumlah = n;
  });
  if (!jumlah) jumlah = maks(boleh.map(nominalRupiah_));
  if (!jumlah) jumlah = maks(boleh.map(nominalBerpemisah_));

  let tanggal = '';
  baris.some(function (b) {
    tanggal = tanggalWajar_(cariTanggal_(b), hariIni);
    return !!tanggal;
  });
  return { jumlah: jumlah, tanggal: tanggal, kategori: '', catatan: '' };
}

/** "25.000" / "25,000.00" / "25.000,00" / "25000" → 25000. */
function keAngka_(angka) {
  return Number(angka.replace(/[.,]\d{2}$/, '').replace(/\D/g, '')) || 0;
}
function terbesar_(cocok, syarat) {
  return (cocok || []).reduce(function (maks, angka) {
    const n = keAngka_(angka);
    return n >= 100 && n < 1e10 && n > maks && syarat(angka) ? n : maks;
  }, 0);
}
/** Angka polos (tanpa pemisah ribuan) hanya wajar sebagai nominal kalau < 100 juta dan tidak diawali 0. */
function nominalWajar_(a, adaTanggal) {
  return /\d[.,]\d{3}/.test(a) || (!adaTanggal && !/^0\d/.test(a) && keAngka_(a) < 1e8);
}

/** Nominal terbesar di satu baris; nomor rekening / telepon / referensi / tahun tidak ikut. */
function nominalTerbesar_(s) {
  const adaTanggal = !!cariTanggal_(String(s));
  return terbesar_(String(s).match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?/g),
    function (a) { return nominalWajar_(a, adaTanggal); });
}
/** Nominal yang diawali Rp / IDR, mis. "Rp25.000", "IDR 25,000.00", "-Rp 25.000". */
function nominalRupiah_(s) {
  const cocok = (String(s).match(/(?:rp|idr)\.?\s*\d[\d.,]*/gi) || [])
    .map(function (x) { return x.replace(/^\D+/, '').replace(/[.,]$/, ''); });
  return terbesar_(cocok, function (a) { return nominalWajar_(a, false); });
}
/** Nominal berpemisah ribuan saja, mis. "25.000" (bukan tanggal, jam, atau nomor panjang). */
function nominalBerpemisah_(s) {
  const token = (String(s).match(/[\d.,]+/g) || []).map(function (t) { return t.replace(/[.,]+$/, ''); });
  return terbesar_(token, function (a) { return /^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?$/.test(a); });
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

// ======================================================================
// Pengingat harian lewat Telegram (pemicu waktu, ± jam 06.00 WIB)
// Catatan berpengingat yang jatuh hari ini + tagihan rutin yang jatuh tempo (terlambat, hari ini, besok)
// + pengingat tantangan di awal setiap minggu tantangan (setoran 52 minggu, batas jajan, sisihkan pemasukan)
// dikirim ke setiap akun Telegram yang terhubung ke buku itu. Bisa dimatikan per buku dari aplikasi
// (Pengaturan PENGINGAT_TELEGRAM = 'Mati').
// ======================================================================

/** Jalankan SEKALI dari editor Apps Script untuk memasang pemicu harian. */
function pasangPengingatHarian() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kirimPengingatHarian')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('kirimPengingatHarian').timeBased().everyDays(1).atHour(6).inTimezone(TZ).create();
  console.log('Pengingat harian aktif: setiap hari sekitar jam 06.00 WIB.');
}

function kirimPengingatHarian() {
  const semua = PropertiesService.getScriptProperties().getProperties();
  const perBuku = {};
  Object.keys(semua).forEach(k => {
    if (/^tg_-?\d+$/.test(k)) (perBuku[semua[k]] = perBuku[semua[k]] || []).push(k.slice(3));
  });
  if (semua.SPREADSHEET_ID && !perBuku[semua.SPREADSHEET_ID]) perBuku[semua.SPREADSHEET_ID] = [];
  const hari = hariIni_();
  Object.keys(perBuku).forEach(idSheet => {
    try {
      pengingatBuku_(idSheet, perBuku[idSheet], hari);
    } catch (err) {
      console.error('Pengingat ' + idSheet + ': ' + (err.stack || err));
    }
  });
}

/** Baca beberapa tabel sekaligus. tabel: [[nama sheet, jumlah kolom]]. */
function bacaTabel_(tabel) {
  const ranges = tabel.map(t => 'ranges=' + range_("'" + t[0] + "'!A2:" + String.fromCharCode(64 + t[1]))).join('&');
  const j = jawabanSheets_(UrlFetchApp.fetchAll([sheetsApi_('/values:batchGet?' + ranges
    + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')])[0]);
  return j.valueRanges.map(vr => vr.values || []);
}

function pengingatBuku_(idSheet, idTerindeks, hari) {
  pakaiSpreadsheet_(idSheet);
  const kunciHari = 'pg_' + idSheet;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(kunciHari) === hari) return; // sudah dikirim hari ini
  let baris;
  try {
    baris = bacaTabel_([['Pengaturan', 2], ['Rutin', 11], ['Catatan', 7]]);
  } catch (err) {
    if (err.status !== 400) throw err; // 400 = sheet Rutin/Catatan belum ada (buku lama)
    baris = [bacaTabel_([['Pengaturan', 2]])[0], [], []];
  }
  const p = {};
  baris[0].forEach(r => { if (r[0] !== '') p[String(r[0])] = String(r[1] == null ? '' : r[1]); });
  try {
    perbaruiHargaEmas_(p, hari);
  } catch (err) {
    console.error('Harga emas ' + idSheet + ': ' + (err.stack || err));
  }
  const pengguna = penggunaTelegram_(p);
  const tujuan = Object.keys(pengguna).filter(id => modeLama_() || idTerindeks.indexOf(String(id)) >= 0);
  if (!tujuan.length) return;
  try {
    kirimRekapBulanan_(idSheet, p, tujuan, hari);
  } catch (err) {
    console.error('Rekap ' + idSheet + ': ' + (err.stack || err));
  }
  if (p.PENGINGAT_TELEGRAM === 'Mati') return props.setProperty(kunciHari, hari);

  const besok = tglGeser_(hari, 1);
  const tagihan = baris[1].filter(r => r[0] !== '' && r[10] !== '').map(r => ({
    nama: String(r[1]), tipe: String(r[2]), jumlah: Number(r[3]) || 0, berikutnya: tgl_(r[10]),
  })).filter(r => r.berikutnya <= besok).sort((a, b) => a.berikutnya.localeCompare(b.berikutnya));
  const catatan = baris[2].filter(r => r[0] !== '' && String(r[4]) === 'Ya').map(r => ({
    tanggal: tgl_(r[1]), judul: String(r[2]), isi: String(r[3] || ''), ulang: String(r[5] || ''),
  })).filter(c => catatanTerjadi_(c, hari));
  const tantangan = pengingatTantangan_(p, hari);
  if (!tagihan.length && !catatan.length && !tantangan.length) return;

  const baris2 = ['🔔 <b>Pengingat hari ini</b> · ' + html_(tglPanjang_(hari)), ''];
  catatan.forEach(c => {
    const tugas = String(c.isi).split('\n').map(s => s.trim()).filter(Boolean);
    const daftarTugas = tugas.length && tugas.every(s => /^\[( |x)\] ?/i.test(s));
    let ket = '';
    if (daftarTugas) ket = ' · ' + tugas.filter(s => /^\[x\]/i.test(s)).length + '/' + tugas.length + ' selesai';
    else if (tugas.length) { // buang tanda format catatan (**tebal**, *miring*, [tengah], - poin) dari aplikasi
      const polos = tugas[0].replace(/^\[(tengah|kanan)\] ?/, '').replace(/^[-•] |^\d+[.)] /, '')
        .replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(\S.*?)\*/g, '$1')
        .replace(/\+\+(\S.*?)\+\+/g, '$1').replace(/~~(\S.*?)~~/g, '$1').split('\u0001').join('*');
      ket = ' — ' + html_(polos.slice(0, 80));
    }
    baris2.push((daftarTugas ? '☑️ ' : '📌 ') + '<b>' + html_(c.judul) + '</b>' + ket);
  });
  tagihan.forEach(r => {
    const selisih = Math.round((keTanggal_(r.berikutnya) - keTanggal_(hari)) / 864e5);
    const kapan = selisih < 0 ? 'terlambat ' + (-selisih) + ' hari' : selisih === 0 ? 'jatuh tempo hari ini' : 'besok';
    baris2.push((r.tipe === TIPE.MASUK ? '💰 ' : '💡 ') + '<b>' + html_(r.nama) + '</b> · ' + rp_(r.jumlah) + ' · ' + kapan);
  });
  tantangan.forEach(s => baris2.push(s));
  if (tagihan.length) baris2.push('', 'Sudah dibayar? Catat dari aplikasi (Beranda → tagihan) supaya jatuh temponya maju.');
  const teks = baris2.join('\n');
  tujuan.forEach(id => kirim_(id, teks));
  props.setProperty(kunciHari, hari);
}

// Harga emas per gram (sama dengan aplikasi, lihat muatHargaEmas di app.js): diambil sekali per pagi untuk semua buku,
// lalu ditulis ke Pengaturan HARGA_EMAS buku yang punya emas, supaya aplikasi tidak perlu mengambilnya lagi.
const SUMBER_HARGA_EMAS = { pegadaian: 'pegadaian', bsi: 'bankbsi', antam: 'anekalogam', galeri24: 'galeri24',
  sampoerna: 'sampoernagold', treasury: 'treasury', pluang: 'pluang' };
const hargaEmasPagi_ = {}; // platform → { beli, jual, tgl, diambil } | null (gagal), selama satu kali jalan

function ambilHargaEmas_(platform, hari) {
  const perlu = platform.filter(k => SUMBER_HARGA_EMAS[k] && !(k in hargaEmasPagi_));
  if (perlu.length) {
    const jawab = UrlFetchApp.fetchAll(perlu.map(k => ({
      url: 'https://logam-mulia-api.iamutaki.workers.dev/api/prices/' + SUMBER_HARGA_EMAS[k], muteHttpExceptions: true,
    })));
    jawab.forEach((res, i) => {
      let h = null;
      try {
        const j = JSON.parse(res.getContentText());
        const baris = (j && j.success && Array.isArray(j.data) ? j.data : [])
          .filter(x => x.material === 'gold' && Number(x.sellPrice) > 0 && Number(x.weight) > 0);
        const x = baris.find(b => Number(b.weight) === 1) || baris.sort((a, b) => a.weight - b.weight)[0];
        if (x) {
          const beli = Math.round(x.sellPrice / x.weight), jual = Math.round((Number(x.buybackPrice) || 0) / x.weight);
          if (beli >= 300000 && beli <= 50000000) h = { beli, jual, tgl: String(x.recordedDate || hari).slice(0, 10), diambil: hari };
        }
      } catch (e) { /* sumber sedang bermasalah: lewati */ }
      hargaEmasPagi_[perlu[i]] = h;
    });
  }
  const hasil = {};
  platform.forEach(k => { if (hargaEmasPagi_[k]) hasil[k] = hargaEmasPagi_[k]; });
  return hasil;
}

const NAMA_PLATFORM_EMAS = { pegadaian: 'Pegadaian', bsi: 'BSI', antam: 'Antam', galeri24: 'Galeri 24',
  sampoerna: 'Sampoerna Gold', treasury: 'Treasury', pluang: 'Pluang', lainnya: 'Lainnya' };

/**
 * Detail emas buku ini (Pengaturan EMAS + HARGA_EMAS), dihitung sekali per pesan:
 * { namaAset: { gram, platform, harga: { beli, jual, tgl, manual? } | null, nilai (rupiah | null), modal } }.
 * Harga yang belum diambil hari ini diambil sekarang lalu disimpan ke spreadsheet (dipakai bersama aplikasi).
 * Nilai = gram × harga jual (buyback), sama dengan aplikasi; tanpa harga → null (pakai saldo rupiah).
 */
function infoEmas_(d) {
  if (d.emas_) return d.emas_;
  let emas = {}, harga = {};
  try { emas = JSON.parse(d.pengaturan.EMAS || '{}') || {}; } catch (e) { /* kosong */ }
  try { harga = JSON.parse(d.pengaturan.HARGA_EMAS || '{}') || {}; } catch (e) { /* kosong */ }
  const aset = d.dompet.filter(w => w.jenis === JENIS.ASET && emas[w.nama]);
  const hari = hariIni_();
  const perlu = aset.map(w => emas[w.nama].platform)
    .filter((k, i, a) => SUMBER_HARGA_EMAS[k] && a.indexOf(k) === i && (!harga[k] || harga[k].diambil !== hari));
  if (perlu.length) {
    try {
      const baru = ambilHargaEmas_(perlu, hari);
      if (Object.keys(baru).length) {
        Object.assign(harga, baru);
        d.pengaturan.HARGA_EMAS = JSON.stringify(harga);
        simpanPengaturan_('HARGA_EMAS', d.pengaturan.HARGA_EMAS);
      }
    } catch (e) { console.warn('Harga emas tidak bisa diambil: ' + e); }
  }
  const hasil = {};
  aset.forEach(w => {
    const e = emas[w.nama];
    const gram = Number(e.gram) || 0;
    let h = SUMBER_HARGA_EMAS[e.platform] && harga[e.platform] && harga[e.platform].beli ? harga[e.platform] : null;
    if (!h && (e.hargaBeli || e.hargaJual)) h = { beli: Number(e.hargaBeli) || 0, jual: Number(e.hargaJual) || 0, manual: true };
    const perGram = h ? (h.jual || h.beli) : 0;
    hasil[w.nama] = { gram, platform: e.platform || 'lainnya', harga: h, nilai: perGram ? Math.round(gram * perGram) : null, modal: Number(e.modal) || 0 };
  });
  return (d.emas_ = hasil);
}

/** Saldo semua dompet, dengan nilai aset emas memakai harga hari ini (seperti aplikasi). */
function nilaiSekarang_(d) {
  const s = saldo_(d);
  const emas = infoEmas_(d);
  Object.keys(emas).forEach(n => { if (emas[n].nilai !== null) s[n] = emas[n].nilai; });
  return s;
}

const gram_ = g => (Math.round(g * 10000) / 10000).toLocaleString('id-ID') + ' gram';

/** Satu baris keterangan emas untuk AI: berat, platform, harga, nilai, modal & untung/rugi. */
function teksEmasUntukAi_(nama, e) {
  const h = e.harga;
  const bagian = [nama + ': ' + gram_(e.gram) + ' emas (' + (NAMA_PLATFORM_EMAS[e.platform] || e.platform) + ')'];
  if (h) {
    bagian.push('harga beli ' + rp_(h.beli) + '/gram, harga jual (buyback) ' + (h.jual ? rp_(h.jual) + '/gram' : 'tidak ada')
      + (h.manual ? ' (diisi sendiri)' : ' (per ' + h.tgl + ')'));
    bagian.push('nilai kalau dijual sekarang ' + rp_(e.nilai));
    if (h.beli) bagian.push('kalau dibeli sekarang ' + rp_(Math.round(e.gram * h.beli)));
  } else bagian.push('harga hari ini belum tersedia');
  if (e.modal) bagian.push('modal ' + rp_(e.modal) + (e.nilai !== null ? ', ' + (e.nilai >= e.modal ? 'untung ' : 'rugi ') + rp_(Math.abs(e.nilai - e.modal))
    + ' (' + (Math.round((e.nilai - e.modal) / e.modal * 1000) / 10).toLocaleString('id-ID') + '%)' : ''));
  return bagian.join(', ');
}

/** p: isi Pengaturan buku yang sedang dibuka (pakaiSpreadsheet_). */
function perbaruiHargaEmas_(p, hari) {
  let emas = {}, lama = {};
  try { emas = JSON.parse(p.EMAS || '{}'); } catch (e) { return; }
  try { lama = JSON.parse(p.HARGA_EMAS || '{}'); } catch (e) { /* ditimpa */ }
  const platform = Object.keys(emas).map(n => emas[n] && emas[n].platform)
    .filter((k, i, a) => k && a.indexOf(k) === i && (!lama[k] || lama[k].diambil !== hari));
  if (!platform.length) return;
  const baru = ambilHargaEmas_(platform, hari);
  if (!Object.keys(baru).length) return;
  simpanPengaturan_('HARGA_EMAS', JSON.stringify(Object.assign(lama, baru)));
}

/**
 * Baris pengingat tantangan aktif (Pengaturan TANTANGAN, JSON yang ditulis aplikasi), hanya di hari pertama
 * setiap minggu tantangan supaya tidak berisik: berapa yang perlu disetor minggu ini, atau batas jajan minggu baru.
 */
function pengingatTantangan_(p, hari) {
  let isi = {};
  try { isi = JSON.parse(p.TANTANGAN || '{}') || {}; } catch (e) { return []; }
  const hasil = [];
  (isi.aktif || []).forEach(t => {
    if (!t || !t.mulai) return;
    const lewat = Math.round((keTanggal_(hari) - keTanggal_(t.mulai)) / 864e5);
    if (lewat < 0 || lewat % 7 !== 0) return;
    const minggu = lewat / 7 + 1;
    if (t.jenis === '52' && minggu <= 52) {
      const unit = Number(t.unit) || 0;
      hasil.push('🐷 <b>52 minggu menabung</b> · minggu ke-' + minggu + ': setor ' + rp_(t.pola === 'tetap' ? unit : unit * minggu)
        + ' ke ' + html_(t.tabungan));
    } else if (t.jenis === 'batas' && lewat > 0 && minggu <= (Number(t.minggu) || 4)) {
      hasil.push('🧾 <b>Minggu baru</b> · ' + html_(t.kategori) + ' maks ' + rp_(Number(t.batas) || 0) + ' minggu ini (minggu ke-' + minggu + ')');
    } else if (t.jenis === 'persen' && lewat > 0 && lewat < (Number(t.hari) || 30)) {
      hasil.push('💸 <b>Sisihkan ' + (Number(t.persen) || 0) + '% pemasukan</b> · sudah disetor ke ' + html_(t.tabungan) + '? Cek kekurangannya di aplikasi.');
    }
  });
  return hasil;
}

/**
 * Di hari pertama periode baru (tanggal 1, atau tanggal gajian), kirim rekap periode sebelumnya:
 * pemasukan, pengeluaran, sisa, 3 kategori terbesar, dan perbandingan dengan periode sebelumnya.
 * Sekali per periode per buku; bisa dimatikan dari aplikasi (Pengaturan REKAP_TELEGRAM = 'Mati').
 */
function kirimRekapBulanan_(idSheet, p, tujuan, hari) {
  if (p.REKAP_TELEGRAM === 'Mati') return;
  const mulai = Math.min(28, Math.max(1, Math.round(Number(p.MULAI_PERIODE) || 1)));
  if (Number(hari.slice(8, 10)) !== mulai) return;
  mulaiPeriode_ = mulai;
  const ini = periode_(hari);
  const lalu = bulanSebelum_(ini);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('rk_' + idSheet) === lalu) return;
  const d = muatData_();
  const a = ringkasBulan_(d, lalu);
  if (!a.masuk && !a.keluar) return props.setProperty('rk_' + idSheet, lalu);
  const b = ringkasBulan_(d, bulanSebelum_(lalu));
  const top = Object.keys(a.per).sort((x, y) => a.per[y] - a.per[x]).slice(0, 3);
  const baris = [
    '📊 <b>Rekap ' + html_(namaBulan_(lalu)) + '</b>',
    '',
    '⬇️ Pemasukan: <b>' + rp_(a.masuk) + '</b>',
    '⬆️ Pengeluaran: <b>' + rp_(a.keluar) + '</b>',
    (a.masuk >= a.keluar ? '🟢 Sisa: <b>' : '🔴 Minus: <b>') + rp_(Math.abs(a.masuk - a.keluar)) + '</b>'
      + (a.masuk ? ' (' + Math.round((a.masuk - a.keluar) / a.masuk * 100) + '% dari pemasukan)' : ''),
  ];
  if (top.length) {
    baris.push('', '<b>Paling banyak untuk</b>');
    top.forEach((n, i) => baris.push((i + 1) + '. ' + ikonKategori_(d, { tipe: TIPE.KELUAR, kategori: n }) + ' ' + html_(n) + ' · ' + rp_(a.per[n])));
  }
  if (b.keluar && a.keluar) {
    const persen = Math.round((a.keluar - b.keluar) / b.keluar * 100);
    if (persen) baris.push('', (persen > 0 ? '📈 Pengeluaran naik ' : '📉 Pengeluaran turun ') + Math.abs(persen) + '% dibanding ' + html_(namaBulan_(bulanSebelum_(lalu))) + '.');
  }
  baris.push('', '✨ Buka aplikasi untuk kilas balik lengkapnya. Semangat untuk periode baru!');
  const teks = baris.join('\n');
  tujuan.forEach(id => kirim_(id, teks));
  props.setProperty('rk_' + idSheet, lalu);
}

/** Sama dengan terjadiPada() di aplikasi: catatan sekali, atau berulang mingguan/bulanan/tahunan. */
function catatanTerjadi_(c, iso) {
  if (!c.tanggal || iso < c.tanggal) return false;
  if (!c.ulang) return iso === c.tanggal;
  const a = iso.split('-').map(Number), b = c.tanggal.split('-').map(Number);
  if (c.ulang === 'Mingguan') return Math.round((keTanggal_(iso) - keTanggal_(c.tanggal)) / 864e5) % 7 === 0;
  const hariBulan = new Date(a[0], a[1], 0).getDate();
  const patokan = Math.min(b[2], hariBulan);
  if (c.ulang === 'Bulanan') return a[2] === patokan;
  if (c.ulang === 'Tahunan') return a[1] === b[1] && a[2] === patokan;
  return false;
}

function tglGeser_(iso, n) {
  const d = keTanggal_(iso);
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function tglPanjang_(iso) {
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const d = keTanggal_(iso);
  return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()];
}
