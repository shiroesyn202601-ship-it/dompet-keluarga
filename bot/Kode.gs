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
const PIKIR_STRUK = 1024; // cukup untuk menjumlah barang di nota, tanpa berpikir panjang yang lambat
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
  '• kirim <b>foto struk</b> 📸',
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

function doGet() {
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
  const tautan = teks.match(/^\/(?:start|hubungkan)(?:@\w+)?\s+(?:([A-Za-z0-9_-]{20,})_)?([A-Z0-9]{6})$/i);
  if (tautan) return hubungkan_(m, tautan[1] || properti_('SPREADSHEET_ID'), tautan[2].toUpperCase());

  const foto = m.photo || (m.document && /^image\//.test(m.document.mime_type || ''));
  // Pesan bebas: status "mengetik" dikirim bersamaan dengan membaca data.
  const buka = bukaUntuk_(m.from.id, chatId, teks && !foto && !/^\//.test(teks) ? chatId : null);
  waktu_('data dimuat');
  if (!buka) return;
  const { d, pengguna } = buka;
  if (!kuotaHarianCukup_()) {
    return kirim_(chatId, '⏳ Batas ' + BATAS_PESAN_HARIAN + ' pesan per hari untuk buku ini sudah tercapai. Lanjut besok, atau catat lewat aplikasi.');
  }

  if (foto) return prosesFoto_(m, pengguna, d);
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
  if (kunci.length && pertanyaanMurni_(teks)) {
    console.log('Pertanyaan langsung');
    return kirim_(chatId, jawabTanya_(d, pengguna, teks));
  }

  let hasil;
  let tambahan = '';
  if (kunci.length) {
    const model = d.pengaturan.GEMINI_MODEL_CEPAT || MODEL_CEPAT;
    const jawaban = jalankanGemini_(kunci, model, [{ sumber: 'perintah', pikir: PIKIR_PERINTAH, parts: [{ text: petunjukPerintah_(d, terakhir, pengguna, teks) }] }], skemaPerintah_())[0];
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
      return kirim_(chatId, jawabTanya_(d, pengguna, x.pertanyaan || pesanAsli));
    case 'ngobrol': return kirim_(chatId, htmlTerbatas_(balasan || 'Siap! 😊'));
    default: return kirim_(chatId, htmlTerbatas_(balasan || 'Maaf, saya belum paham.') + '\n\nKetik /bantuan untuk contoh.');
  }
}

/**
 * Menjawab pertanyaan/analisis bebas dengan data keuangan terbaru (termasuk transaksi
 * yang baru dicatat dari pesan yang sama). Angka diambil dari ringkasan yang dihitung kode.
 */
function jawabTanya_(d, pengguna, pertanyaan) {
  const kunci = kunciGemini_(d.pengaturan);
  if (!kunci.length) return 'Untuk tanya-jawab, AI perlu diaktifkan dulu: tambahkan kunci Gemini di aplikasi (⚙️ → Baca struk dengan AI).';
  const prompt = [
    'Kamu asisten keuangan keluarga "Dompet Keluarga" yang ramah, jujur, dan praktis. Kamu sedang chat dengan ' + pengguna.nama + '.',
    'Jawab dalam bahasa Indonesia santai, singkat (maksimal 6 kalimat atau poin), langsung ke inti.',
    'Gunakan HANYA angka dari data di bawah; boleh menghitung (selisih, persen, perkiraan) tapi jangan mengarang data yang tidak ada.',
    'Kalau datanya tidak cukup, katakan terus terang dan sarankan cara mencatatnya.',
    'Format: teks biasa. Boleh <b>tebal</b> untuk angka penting. Jangan pakai markdown, tabel, atau tag HTML lain. Tulis rupiah seperti Rp25.000.',
    '',
    'DATA KEUANGAN:',
    konteksKeuangan_(d),
    '',
    'PERTANYAAN PENGGUNA: """' + pertanyaan + '"""',
  ].join('\n');
  const model = d.pengaturan.GEMINI_MODEL_TANYA || 'gemini-flash-latest';
  const h = jalankanGemini_(kunci, model, [{ sumber: 'tanya', pikir: PIKIR_TANYA, parts: [{ text: prompt }] }],
    { type: 'OBJECT', properties: { jawaban: { type: 'STRING' } }, required: ['jawaban'] })[0];
  waktu_('AI menjawab pertanyaan');
  if (h instanceof Error) return '⚠️ ' + html_(h.message) + '. Sementara itu, coba /ringkasan atau /anggaran.';
  return htmlTerbatas_(h.jawaban || 'Maaf, saya belum bisa menjawab itu.');
}

/** Ringkasan data untuk AI: semua angka dihitung di sini supaya AI tidak salah menjumlah. */
function konteksKeuangan_(d) {
  const s = saldo_(d);
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
    'Aset: ' + (d.dompet.filter(w => w.jenis === JENIS.ASET).map(w => w.nama + ' ' + rp_(s[w.nama])).join(', ') || 'belum ada')
      + '. Kekayaan bersih (semua dompet, tabungan, aset, piutang − utang): ' + rp_(d.dompet.reduce((x, w) => x + (s[w.nama] || 0), 0)) + '.',
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

function petunjukPerintah_(d, terakhir, pengguna, pesan) {
  const hariIni = hariIni_();
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
    '- "tanya": pertanyaan, analisis, perbandingan, saran, atau perhitungan tentang keuangan (mis. "boros di mana?", "bandingkan dengan bulan lalu",',
    '  "aman beli HP 3jt?", "kapan dana darurat penuh?", "sisa anggaran makan berapa?"). Isi pertanyaan dengan pertanyaan lengkapnya.',
    '  Kalau pesan berisi catat sekaligus pertanyaan, buat "catat" dulu lalu "tanya".',
    '- "ngobrol": sapaan, terima kasih, basa-basi, atau curhat ringan → isi balasan dengan jawaban ramah dan natural (1–2 kalimat), boleh sebut fitur yang relevan.',
    '- "bantuan": jika pengguna bertanya cara memakai bot.',
    '- "tidak_jelas": hanya jika benar-benar tidak bisa dipahami; isi balasan dengan pertanyaan klarifikasi yang ramah.',
    '- komentar: jika ada "catat", boleh isi 1 kalimat singkat yang relevan dan bermanfaat berdasarkan DATA (mis. anggaran kategori itu hampir habis,',
    '  sudah beberapa kali jajan serupa bulan ini, pengeluaran lebih hemat dari bulan lalu). Santai dan tidak menggurui. Kosongkan jika tidak ada yang menarik.',
    '  Jangan mengulang rincian transaksi; rincian sudah ditampilkan sistem.',
    '',
    'RINGKASAN BULAN INI (sebelum pesan ini diproses):',
    konteksRingkas_(d),
    '',
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
function pertanyaanMurni_(teks) {
  const kecil = teks.toLowerCase();
  if (/\b(catat|ubah|ganti|edit|hapus|batal|batalkan|tadi)\b/.test(kecil)) return false;
  // Andaian boleh menyebut nominal: "aman nggak beli HP 3 juta?", "kalau nabung 500rb sebulan, kapan…?"
  if (/\?\s*$/.test(kecil) && /\b(kalau|kalo|seandainya|misal|misalnya|aman|cukup)\b/.test(kecil)) return true;
  if (semuaNominal_(teks).length || /\b(beli|bayar)\b/.test(kecil)) return false;
  if (kecil.split(/\s+/).length < 3) return false;
  return /\?\s*$/.test(kecil)
    || /^(berapa|kapan|gimana|bagaimana|apa|apakah|kenapa|mengapa|kok|bandingkan|banding|analisis|analisa|saran|tips|cek)\b/.test(kecil)
    || /\b(boros|hemat|aman (nggak|ngga|ga|gak|tidak)|cukup (nggak|ngga|ga|gak|tidak)|sisa anggaran|rata-rata|dibanding)\b/.test(kecil);
}

// ======================================================================
// Foto struk
// ======================================================================

function prosesFoto_(m, pengguna, d) {
  const chatId = m.chat.id;
  const tunggu = kirim_(chatId, '⏳ Membaca struk…').result;
  const fileId = m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id;
  const info = tg_('getFile', { file_id: fileId }).result;
  const blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + properti_('TELEGRAM_TOKEN') + '/' + info.file_path).getBlob();
  const mime = /\.png$/i.test(info.file_path) ? 'image/png' : 'image/jpeg';

  const kategori = d.kategori.filter(k => k.tipe === TIPE.KELUAR).map(k => k.nama);
  let h;
  try {
    h = bacaStruk_(Utilities.base64Encode(blob.getBytes()), mime, kategori, kunciGemini_(d.pengaturan), d.pengaturan.GEMINI_MODEL || MODEL_GEMINI);
  } catch (err) {
    return ubahPesan_(chatId, tunggu.message_id, '❌ ' + html_(err.message));
  }

  // Keterangan foto bisa menyebut dompet ("pakai gopay") atau catatan tambahan.
  const ket = (m.caption || '').trim();
  const dompet = d.dompet.find(w => ket && ket.toLowerCase().indexOf(w.nama.toLowerCase()) >= 0);
  const t = siapkanTransaksi_(d, {
    tipe: TIPE.KELUAR, jumlah: h.jumlah, kategori: h.kategori, tanggal: h.tanggal,
    dompet: dompet ? dompet.nama : '', catatan: [h.catatan, dompet ? '' : ket].filter(Boolean).join(' · '),
  }, pengguna);
  const id = tambahTransaksi_(t, pengguna.email);

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
    + peringatanAnggaran_(d, t) + '\n\nSalah? Balas mis. <i>"yang terakhir ubah jadi 45rb"</i>.', tombol);
}

// ======================================================================
// Tombol (callback)
// ======================================================================

function prosesTombol_(q) {
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;
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
function bukaUntuk_(idTelegram, chatId, ketikKe) {
  const idSheet = spreadsheetUntuk_(idTelegram);
  if (!idSheet) {
    belumTerhubung_(chatId);
    return null;
  }
  pakaiSpreadsheet_(idSheet);
  let d;
  try {
    d = muatData_(ketikKe);
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
  return { d, pengguna };
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

/** Semua data dalam satu permintaan Sheets API. `ketikKe` (opsional): chat yang sekalian dikirimi status "mengetik". */
function muatData_(ketikKe) {
  const ranges = TABEL_BACA.map(t => 'ranges=' + range_("'" + t[0] + "'!A2:" + String.fromCharCode(64 + t[1]))).join('&');
  const minta = [sheetsApi_('/values:batchGet?' + ranges + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')];
  if (ketikKe) minta.push(permintaanTg_('sendChatAction', { chat_id: ketikKe, action: 'typing' }));
  const j = jawabanSheets_(UrlFetchApp.fetchAll(minta)[0]);
  return olahData_(j.valueRanges.map((vr, i) => (vr.values || []).map(r => {
    const isi = r.slice(0, TABEL_BACA[i][1]);
    while (isi.length < TABEL_BACA[i][1]) isi.push('');
    return isi;
  })));
}

function olahData_([trx, kat, dom, set]) {
  const transaksi = trx.filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), tanggal: tgl_(r[1]), tipe: String(r[2]), jumlah: Number(r[3]) || 0, kategori: String(r[4]),
    dompet: String(r[5]), dompetTujuan: String(r[6]), catatan: String(r[7]), oleh: String(r[8]),
    dibuat: tglWaktu_(r[9]),
  }));
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

  const cariDompet = n => d.dompet.find(w => w.nama.toLowerCase() === String(n || '').toLowerCase());
  const biasa = d.dompet.filter(w => w.jenis === JENIS.DOMPET);
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
  const s = saldo_(d);
  const baris = jenis => d.dompet.filter(w => w.jenis === jenis).map(w => w.ikon + ' ' + html_(w.nama) + ': <b>' + rp_(s[w.nama]) + '</b>'
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
  const res = UrlFetchApp.fetchAll([permintaanTg_(metode, data)])[0];
  const j = JSON.parse(res.getContentText());
  if (!j.ok) console.error('Telegram ' + metode + ': ' + j.description);
  return j;
}

function kirim_(chatId, teks, tombol) {
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
 */
function jalankanGemini_(daftar, model, permintaan, skema) {
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
        jawaban = UrlFetchApp.fetchAll(sisa.map(function (i) { return mintaGemini_(kunci, model2[mi], permintaan[i].parts, skema, permintaan[i].pikir); }));
      } catch (e) {
        console.error('Gemini tidak bisa dihubungi: ' + e);
        sisa.forEach(function (i) { hasil[i] = new Error('Gemini terlalu lama menjawab atau tidak bisa dihubungi'); });
        return hasil;
      }
      const ulang = [];
      jawaban.forEach(function (res, j) {
        const i = sisa[j];
        try {
          hasil[i] = bacaJawabanGemini_(res);
          console.log(permintaan[i].sumber + ' memakai ' + model2[mi] + ', kunci ' + samarkanKunci_(kunci));
        } catch (e) {
          hasil[i] = e;
          if (e.gantiKunci) {
            console.warn(permintaan[i].sumber + ': kunci ' + samarkanKunci_(kunci) + ' gagal (' + e.message + '), coba kunci lain');
            ulang.push(i);
          } else if (e.gantiModel) {
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
 *   2. "OCR + AI" : gambar → teks (OCR Google Drive) → teks disimpulkan Gemini.
 *   3. "OCR"      : teks OCR yang sama dibaca dengan aturan biasa (tanpa AI).
 * Mengembalikan { jumlah, tanggal, kategori, catatan, yakin, pilihanJumlah, lapis }.
 */
function bacaStruk_(base64, mime, kategori, daftarKunci, model) {
  if (!/^image\/(jpeg|png|webp)$/.test(String(mime))) throw new Error('Format gambar tidak didukung.');
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
    const permintaan = [{ sumber: 'AI foto', pikir: PIKIR_STRUK, parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: petunjukStruk_('gambar', hariIni) }] }];
    if (teksOcr.trim()) {
      permintaan.push({ sumber: 'OCR + AI', pikir: PIKIR_STRUK, parts: [{ text: petunjukStruk_('teks', hariIni) + '\n\nTeks OCR:\n"""\n' + teksOcr.slice(0, 8000) + '\n"""' }] });
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
    throw new Error(alasan || ('Nominal pembayaran tidak ditemukan di gambar. Coba foto ulang dengan lebih terang dan lurus'
      + (daftarKunci.length ? '.' : ', atau aktifkan "Baca struk lebih akurat" (AI Gemini) di aplikasi.')));
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

/** `pikir`: anggaran thinking (token); kosong = bawaan model. */
function mintaGemini_(kunci, model, parts, skema, pikir) {
  const config = { responseMimeType: 'application/json', responseSchema: skema };
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
    else if (kode >= 500) err = new Error('Gemini sedang sibuk (' + kode + '), coba lagi sebentar lagi');
    else if (kode === 404) err = new Error('Model Gemini tidak ditemukan (404)');
    else err = new Error('Gemini error ' + kode + ': ' + pesan);
    err.gantiKunci = kode === 429 || kode === 403 || (kode === 400 && /API key/i.test(pesan));
    err.gantiModel = kode >= 500 || kode === 404;
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
  if (p.PENGINGAT_TELEGRAM === 'Mati') return;
  const pengguna = penggunaTelegram_(p);
  const tujuan = Object.keys(pengguna).filter(id => modeLama_() || idTerindeks.indexOf(String(id)) >= 0);
  if (!tujuan.length) return;

  const besok = tglGeser_(hari, 1);
  const tagihan = baris[1].filter(r => r[0] !== '' && r[10] !== '').map(r => ({
    nama: String(r[1]), tipe: String(r[2]), jumlah: Number(r[3]) || 0, berikutnya: tgl_(r[10]),
  })).filter(r => r.berikutnya <= besok).sort((a, b) => a.berikutnya.localeCompare(b.berikutnya));
  const catatan = baris[2].filter(r => r[0] !== '' && String(r[4]) === 'Ya').map(r => ({
    tanggal: tgl_(r[1]), judul: String(r[2]), isi: String(r[3] || ''), ulang: String(r[5] || ''),
  })).filter(c => catatanTerjadi_(c, hari));
  if (!tagihan.length && !catatan.length) return;

  const baris2 = ['🔔 <b>Pengingat hari ini</b> · ' + html_(tglPanjang_(hari)), ''];
  catatan.forEach(c => {
    const tugas = String(c.isi).split('\n').map(s => s.trim()).filter(Boolean);
    const daftarTugas = tugas.length && tugas.every(s => /^\[( |x)\] ?/i.test(s));
    let ket = '';
    if (daftarTugas) ket = ' · ' + tugas.filter(s => /^\[x\]/i.test(s)).length + '/' + tugas.length + ' selesai';
    else if (tugas.length) ket = ' — ' + html_(tugas[0].slice(0, 80));
    baris2.push((daftarTugas ? '☑️ ' : '📌 ') + '<b>' + html_(c.judul) + '</b>' + ket);
  });
  tagihan.forEach(r => {
    const selisih = Math.round((keTanggal_(r.berikutnya) - keTanggal_(hari)) / 864e5);
    const kapan = selisih < 0 ? 'terlambat ' + (-selisih) + ' hari' : selisih === 0 ? 'jatuh tempo hari ini' : 'besok';
    baris2.push((r.tipe === TIPE.MASUK ? '💰 ' : '💡 ') + '<b>' + html_(r.nama) + '</b> · ' + rp_(r.jumlah) + ' · ' + kapan);
  });
  if (tagihan.length) baris2.push('', 'Sudah dibayar? Catat dari aplikasi (Beranda → tagihan) supaya jatuh temponya maju.');
  const teks = baris2.join('\n');
  tujuan.forEach(id => kirim_(id, teks));
  props.setProperty(kunciHari, hari);
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
