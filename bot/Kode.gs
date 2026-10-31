/**
 * Dompet Keluarga — bot Telegram (Google Apps Script).
 *
 * Bot ini membaca & menulis spreadsheet keluarga yang sama dengan aplikasi web.
 * Pesan bebas ("makan bakso 25rb pakai gopay") diterjemahkan Gemini menjadi perintah,
 * foto struk dibaca berlapis (AI foto, OCR + AI, OCR).
 *
 * Script Properties yang wajib diisi:
 *   TELEGRAM_TOKEN  — token dari @BotFather
 *   SPREADSHEET_ID  — ID spreadsheet Dompet Keluarga (lihat aplikasi: ⚙️ → Bot Telegram)
 * Opsional: WEBAPP_URL (kalau URL web app tidak terdeteksi otomatis).
 *
 * Setelah deploy sebagai web app, jalankan pasangWebhook() sekali dari editor.
 */

const TZ = 'Asia/Jakarta';
const TIPE = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', TRANSFER: 'Transfer' };
const JENIS = { DOMPET: 'Dompet', TABUNGAN: 'Tabungan' };
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
  if (!p.getProperty('SPREADSHEET_ID')) throw new Error('Isi dulu Script Property SPREADSHEET_ID (lihat aplikasi: ⚙️ → Bot Telegram).');
  db_(); // memastikan spreadsheet bisa dibuka

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
  simpanPengaturan_(db_(), 'TELEGRAM_BOT', saya.username);
  Logger.log('✅ Bot @' + saya.username + ' terpasang ke ' + url);
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
}

function prosesPesan_(m) {
  const chatId = m.chat.id;
  const teks = (m.text || m.caption || '').trim();

  // Penautan akun: /start KODE (dari tombol di aplikasi) atau /hubungkan KODE
  const kode = teks.match(/^\/(?:start|hubungkan)(?:@\w+)?\s+([A-Z0-9]{6})$/i);
  if (kode) return hubungkan_(m, kode[1].toUpperCase());

  const ss = db_();
  const pengguna = penggunaTelegram_(ss)[m.from.id];
  if (!pengguna) {
    return kirim_(chatId, [
      '👋 Halo! Akun Telegram ini belum terhubung ke <b>Dompet Keluarga</b>.',
      '',
      'Buka aplikasi Dompet Keluarga → ⚙️ → <b>Bot Telegram</b> → <b>Hubungkan akun Telegram</b>.',
      'Atau kirim <code>/hubungkan KODE</code> dengan kode dari menu tersebut.',
    ].join('\n'));
  }

  if (m.photo || (m.document && /^image\//.test(m.document.mime_type || ''))) {
    return prosesFoto_(ss, m, pengguna);
  }
  if (!teks) return;

  const perintah = teks.match(/^\/(\w+)/);
  if (perintah) {
    const p = perintah[1].toLowerCase();
    if (p === 'start' || p === 'bantuan' || p === 'help') return kirim_(chatId, 'Halo ' + html_(pengguna.nama) + '! ' + BANTUAN);
    if (p === 'saldo') return kirim_(chatId, teksSaldo_(muatData_(ss)));
    if (p === 'ringkasan') return kirim_(chatId, teksRingkasan_(muatData_(ss), bulanIni_()));
    if (p === 'anggaran') return kirim_(chatId, teksAnggaran_(muatData_(ss), bulanIni_()));
    if (p === 'terakhir') return kirim_(chatId, teksRiwayat_(muatData_(ss), ''));
    return kirim_(chatId, BANTUAN);
  }

  prosesTeksBebas_(ss, chatId, teks, pengguna);
}

function hubungkan_(m, kode) {
  const ss = db_();
  const p = pengaturan_(ss);
  let daftarKode = {};
  try { daftarKode = JSON.parse(p.TELEGRAM_KODE || '{}'); } catch (e) { daftarKode = {}; }
  const k = daftarKode[kode];
  if (!k || k.sampai < Date.now()) {
    return kirim_(m.chat.id, '❌ Kode tidak valid atau sudah kedaluwarsa. Buat kode baru dari aplikasi: ⚙️ → Bot Telegram.');
  }
  delete daftarKode[kode];
  simpanPengaturan_(ss, 'TELEGRAM_KODE', JSON.stringify(daftarKode));

  const pengguna = penggunaTelegram_(ss);
  const nama = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || k.email.split('@')[0];
  pengguna[m.from.id] = { email: k.email, nama, username: m.from.username || '' };
  simpanPengaturan_(ss, 'TELEGRAM_PENGGUNA', JSON.stringify(pengguna));
  kirim_(m.chat.id, '✅ Terhubung sebagai <b>' + html_(k.email) + '</b>.\n\n' + BANTUAN);
}

// ======================================================================
// Teks bebas → perintah (Gemini)
// ======================================================================

function prosesTeksBebas_(ss, chatId, teks, pengguna) {
  tg_('sendChatAction', { chat_id: chatId, action: 'typing' });
  const d = muatData_(ss);
  const kunci = kunciGemini_(d.pengaturan);
  const terakhir = d.transaksi.slice().sort((a, b) => b.dibuat.localeCompare(a.dibuat)).slice(0, 8);

  let hasil;
  let tambahan = '';
  if (kunci.length) {
    const model = d.pengaturan.GEMINI_MODEL_CEPAT || MODEL_CEPAT;
    const jawaban = jalankanGemini_(kunci, model, [{ sumber: 'perintah', parts: [{ text: petunjukPerintah_(d, terakhir, pengguna, teks) }] }], skemaPerintah_())[0];
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
    jalankanPerintah_(ss, d, chatId, x, terakhir, pengguna, hasil.balasan, ekstra, teks);
  });
}

function jalankanPerintah_(ss, d, chatId, x, terakhir, pengguna, balasan, tambahan, pesanAsli) {
  const ref = r => {
    const i = Number(String(r || '').replace(/\D/g, '')) - 1;
    return terakhir[i] || null;
  };
  switch (x.aksi) {
    case 'catat': {
      const t = siapkanTransaksi_(d, x, pengguna);
      const id = tambahTransaksi_(ss, t, pengguna.email);
      d.transaksi.push(Object.assign({ id, oleh: pengguna.email, dibuat: sekarangIso_() }, t, { tanggal: t.tanggal }));
      return kirim_(chatId, '✅ <b>Tercatat</b>\n' + ringkasTransaksi_(d, t) + peringatanAnggaran_(d, t) + (tambahan || ''),
        [[{ text: '↩️ Batalkan', callback_data: 'batal:' + id }]]);
    }
    case 'ubah': {
      const lama = ref(x.ref);
      if (!lama) return kirim_(chatId, '❓ Transaksi yang mau diubah tidak ditemukan.');
      const baru = siapkanTransaksi_(d, Object.assign({}, lama, bersihkan_(x)), pengguna);
      ubahTransaksi_(ss, lama.id, baru);
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
    case 'tanya': return kirim_(chatId, jawabTanya_(d, pengguna, x.pertanyaan || pesanAsli, chatId));
    case 'ngobrol': return kirim_(chatId, htmlTerbatas_(balasan || 'Siap! 😊'));
    default: return kirim_(chatId, htmlTerbatas_(balasan || 'Maaf, saya belum paham.') + '\n\nKetik /bantuan untuk contoh.');
  }
}

/**
 * Menjawab pertanyaan/analisis bebas dengan data keuangan terbaru (termasuk transaksi
 * yang baru dicatat dari pesan yang sama). Angka diambil dari ringkasan yang dihitung kode.
 */
function jawabTanya_(d, pengguna, pertanyaan, chatId) {
  tg_('sendChatAction', { chat_id: chatId, action: 'typing' });
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
  const h = jalankanGemini_(kunci, model, [{ sumber: 'tanya', parts: [{ text: prompt }] }],
    { type: 'OBJECT', properties: { jawaban: { type: 'STRING' } }, required: ['jawaban'] })[0];
  if (h instanceof Error) return '⚠️ ' + html_(h.message) + '. Sementara itu, coba /ringkasan atau /anggaran.';
  return htmlTerbatas_(h.jawaban || 'Maaf, saya belum bisa menjawab itu.');
}

/** Ringkasan data untuk AI: semua angka dihitung di sini supaya AI tidak salah menjumlah. */
function konteksKeuangan_(d) {
  const s = saldo_(d);
  const ini = bulanIni_();
  const lalu = bulanSebelum_(ini);
  const ringkas = b => {
    const trx = d.transaksi.filter(t => t.tanggal.slice(0, 7) === b);
    const per = {};
    trx.filter(t => t.tipe === TIPE.KELUAR).forEach(t => { per[t.kategori] = (per[t.kategori] || 0) + t.jumlah; });
    return {
      trx,
      per,
      masuk: trx.filter(t => t.tipe === TIPE.MASUK).reduce((a, t) => a + t.jumlah, 0),
      keluar: trx.filter(t => t.tipe === TIPE.KELUAR).reduce((a, t) => a + t.jumlah, 0),
    };
  };
  const a = ringkas(ini);
  const b = ringkas(lalu);
  const tigaBulan = [1, 2, 3].map(n => { let x = ini; for (let i = 0; i < n; i++) x = bulanSebelum_(x); return ringkas(x).keluar; });
  const nama = email => email.split('@')[0];
  const [, , hariKe] = hariIni_().split('-').map(Number);
  const [th, bl] = ini.split('-').map(Number);
  const jumlahHari = new Date(th, bl, 0).getDate();

  const kategoriBulanIni = d.kategori.filter(k => k.tipe === TIPE.KELUAR && (a.per[k.nama] || k.anggaran)).map(k => {
    const pakai = a.per[k.nama] || 0;
    return '- ' + k.nama + ': ' + rp_(pakai) + (k.anggaran ? ' (anggaran ' + rp_(k.anggaran) + ', terpakai ' + Math.round(pakai / k.anggaran * 100) + '%, sisa ' + rp_(k.anggaran - pakai) + ')' : '');
  });
  return [
    'Hari ini ' + hariIni_() + ' (hari ke-' + hariKe + ' dari ' + jumlahHari + ' hari bulan ini).',
    'Saldo dompet: ' + d.dompet.filter(w => w.jenis === JENIS.DOMPET).map(w => w.nama + ' ' + rp_(s[w.nama])).join(', ')
      + '. Total ' + rp_(d.dompet.filter(w => w.jenis === JENIS.DOMPET).reduce((x, w) => x + s[w.nama], 0)) + '.',
    'Tabungan: ' + (d.dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama + ' ' + rp_(s[w.nama])
      + (w.target ? ' dari target ' + rp_(w.target) + (w.tenggat ? ' (tenggat ' + w.tenggat + ')' : '') : ' (tanpa target)')).join('; ') || 'belum ada') + '.',
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
    'Dompet: ' + d.dompet.filter(w => w.jenis !== JENIS.TABUNGAN).map(w => w.nama).join(', '),
    'Tabungan: ' + (d.dompet.filter(w => w.jenis === JENIS.TABUNGAN).map(w => w.nama).join(', ') || '(belum ada)'),
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
    'DATA KEUANGAN (sebelum pesan ini diproses):',
    konteksKeuangan_(d),
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

// ======================================================================
// Foto struk
// ======================================================================

function prosesFoto_(ss, m, pengguna) {
  const chatId = m.chat.id;
  const tunggu = kirim_(chatId, '⏳ Membaca struk…').result;
  const fileId = m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id;
  const info = tg_('getFile', { file_id: fileId }).result;
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  const blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + token + '/' + info.file_path).getBlob();
  const mime = /\.png$/i.test(info.file_path) ? 'image/png' : 'image/jpeg';

  const d = muatData_(ss);
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
  const id = tambahTransaksi_(ss, t, pengguna.email);

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
  const ss = db_();
  if (!penggunaTelegram_(ss)[q.from.id]) {
    return tg_('answerCallbackQuery', { callback_query_id: q.id, text: 'Akun belum terhubung.' });
  }
  const [aksi, id, nilai] = String(q.data || '').split(':');
  tg_('answerCallbackQuery', { callback_query_id: q.id });

  if (aksi === 'x') return ubahPesan_(chatId, msgId, 'Oke, tidak jadi.');
  if (aksi === 'batal' || aksi === 'hapus') {
    const ok = hapusTransaksi_(ss, id);
    return ubahPesan_(chatId, msgId, ok ? (aksi === 'batal' ? '↩️ Dibatalkan, transaksi dihapus.' : '🗑️ Transaksi dihapus.') : 'Transaksi sudah tidak ada.');
  }
  if (aksi === 'jml') {
    const d = muatData_(ss);
    const lama = d.transaksi.find(t => t.id === id);
    if (!lama) return ubahPesan_(chatId, msgId, 'Transaksi sudah tidak ada.');
    const baru = Object.assign({}, lama, { jumlah: Number(nilai) });
    ubahTransaksi_(ss, id, baru);
    return ubahPesan_(chatId, msgId, '✏️ <b>Total diperbarui</b>\n' + ringkasTransaksi_(d, baru), [[{ text: '↩️ Batalkan', callback_data: 'batal:' + id }]]);
  }
}

// ======================================================================
// Data (spreadsheet keluarga)
// ======================================================================

function db_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diisi di Script Properties.');
  return SpreadsheetApp.openById(id);
}

function sheet_(ss, nama) {
  const sh = ss.getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ada. Buka aplikasi web sekali untuk menyiapkan spreadsheet.');
  return sh;
}

function baris_(ss, nama, kolom) {
  const sh = sheet_(ss, nama);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, kolom).getValues() : [];
}

function muatData_(ss) {
  const transaksi = baris_(ss, 'Transaksi', KOLOM_TRANSAKSI).filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), tanggal: tgl_(r[1]), tipe: String(r[2]), jumlah: Number(r[3]) || 0, kategori: String(r[4]),
    dompet: String(r[5]), dompetTujuan: String(r[6]), catatan: String(r[7]), oleh: String(r[8]),
    dibuat: r[9] instanceof Date ? Utilities.formatDate(r[9], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(r[9]),
  }));
  const kategori = baris_(ss, 'Kategori', 4).filter(r => r[0] !== '').map(r => ({
    nama: String(r[0]), tipe: String(r[1]), ikon: String(r[2]), anggaran: Number(r[3]) || 0,
  }));
  const dompet = baris_(ss, 'Dompet', 6).filter(r => r[0] !== '').map(r => ({
    nama: String(r[0]), ikon: String(r[1]), saldoAwal: Number(r[2]) || 0,
    jenis: String(r[3]) === JENIS.TABUNGAN ? JENIS.TABUNGAN : JENIS.DOMPET, target: Number(r[4]) || 0,
    tenggat: r[5] === '' ? '' : tgl_(r[5]),
  }));
  return { transaksi, kategori, dompet, pengaturan: pengaturan_(ss) };
}

function pengaturan_(ss) {
  const p = {};
  if (!ss.getSheetByName('Pengaturan')) return p;
  baris_(ss, 'Pengaturan', 2).forEach(r => { if (r[0] !== '') p[String(r[0])] = String(r[1]); });
  return p;
}

function simpanPengaturan_(ss, kunci, nilai) {
  const sh = sheet_(ss, 'Pengaturan');
  const rows = baris_(ss, 'Pengaturan', 2);
  const i = rows.findIndex(r => String(r[0]) === kunci);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(nilai);
  else sh.appendRow([kunci, nilai]);
}

function penggunaTelegram_(ss) {
  try { return JSON.parse(pengaturan_(ss).TELEGRAM_PENGGUNA || '{}'); } catch (e) { return {}; }
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
  const biasa = d.dompet.filter(w => w.jenis !== JENIS.TABUNGAN);
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

function tambahTransaksi_(ss, t, email) {
  const id = Utilities.getUuid();
  const sekarang = new Date();
  sheet_(ss, 'Transaksi').appendRow([
    id, keTanggal_(t.tanggal), t.tipe, t.jumlah, aman_(t.kategori), aman_(t.dompet), aman_(t.dompetTujuan), aman_(t.catatan), email, sekarang, sekarang,
  ]);
  return id;
}

function ubahTransaksi_(ss, id, t) {
  denganKunci_(() => {
    const rows = baris_(ss, 'Transaksi', KOLOM_TRANSAKSI);
    const i = rows.findIndex(r => String(r[0]) === id);
    if (i < 0) throw new Error('Transaksi sudah tidak ada.');
    sheet_(ss, 'Transaksi').getRange(i + 2, 2, 1, 7).setValues([[
      keTanggal_(t.tanggal), t.tipe, t.jumlah, aman_(t.kategori), aman_(t.dompet), aman_(t.dompetTujuan), aman_(t.catatan),
    ]]);
    sheet_(ss, 'Transaksi').getRange(i + 2, 11).setValue(new Date());
  });
}

function hapusTransaksi_(ss, id) {
  return denganKunci_(() => {
    const rows = baris_(ss, 'Transaksi', 1);
    const i = rows.findIndex(r => String(r[0]) === id);
    if (i < 0) return false;
    sheet_(ss, 'Transaksi').deleteRow(i + 2);
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
  const bulan = t.tanggal.slice(0, 7);
  const pakai = d.transaksi.filter(x => x.tipe === TIPE.KELUAR && x.kategori === k.nama && x.tanggal.slice(0, 7) === bulan)
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
  const total = d.dompet.filter(w => w.jenis === JENIS.DOMPET).reduce((a, w) => a + s[w.nama], 0);
  return ['💰 <b>Saldo dompet: ' + rp_(total) + '</b>', dompet.join('\n')]
    .concat(tabungan.length ? ['', '🐷 <b>Tabungan</b>', tabungan.join('\n')] : []).join('\n');
}

function teksRingkasan_(d, bulan) {
  const trx = d.transaksi.filter(t => t.tanggal.slice(0, 7) === bulan);
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
  const pakai = n => d.transaksi.filter(t => t.tipe === TIPE.KELUAR && t.kategori === n && t.tanggal.slice(0, 7) === bulan).reduce((a, t) => a + t.jumlah, 0);
  return ['🎯 <b>Anggaran ' + namaBulan_(bulan) + '</b>'].concat(daftar.map(k => {
    const p = pakai(k.nama);
    const persen = Math.round(p / k.anggaran * 100);
    const tanda = p > k.anggaran ? '⛔' : persen >= 80 ? '⚠️' : '✅';
    return tanda + ' ' + k.ikon + ' ' + html_(k.nama) + ': ' + rp_(p) + ' / ' + rp_(k.anggaran) + ' (' + persen + '%)';
  })).join('\n');
}

function teksRiwayat_(d, bulan) {
  const trx = d.transaksi.filter(t => !bulan || t.tanggal.slice(0, 7) === bulan)
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

function tg_(metode, data) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metode, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(data || {}), muteHttpExceptions: true,
  });
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

function bulanIni_() {
  return hariIni_().slice(0, 7);
}

function sekarangIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function tgl_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v).slice(0, 10);
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
  return NAMA_BULAN_PANJANG[m - 1] + ' ' + y;
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
        jawaban = UrlFetchApp.fetchAll(sisa.map(function (i) { return mintaGemini_(kunci, model2[mi], permintaan[i].parts, skema); }));
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
