// Mengisi buku Dompet Keluarga SUNGGUHAN dengan data demo (sama seperti mode coba), untuk uji coba / presentasi.
// Cara pakai: buka aplikasi, masuk dengan akun Google yang diinginkan, buka buku yang mau diisi (Beranda tampil),
// tekan F12 → Console, tempel seluruh isi file ini, Enter. Setelah selesai, muat ulang aplikasi.
//
// Yang ditambahkan (data lama TIDAK dihapus):
//   • Kategori & dompet contoh yang belum ada (Tunai, BCA, Mandiri, GoPay, tabungan Dana Darurat & Liburan Bali,
//     piutang Joko, emas Antam) beserta saldo awalnya
//   • Transaksi sampai total isi sheet Transaksi = TARGET (data demo 3 bulan terakhir, ditambah transaksi lebih lama kalau kurang)
//   • Tagihan & transaksi rutin, catatan (berpengingat, checklist, disematkan, diarsipkan)
//   • Tantangan (52 minggu, batas belanja, kebiasaan) & emas di sheet Pengaturan (menimpa isi TANTANGAN / EMAS yang lama)
// Semua "Dibuat Oleh" memakai email akun yang sedang masuk.
(async () => {
  const TARGET = 450;
  if (DEMO.aktif() && !window.UJI_ISI_DEMO) return console.error('Sedang di mode coba. Ketuk "Pakai sungguhan", masuk dengan akun Google, lalu jalankan lagi.');
  if (!S.data || !S.data.spreadsheetId) return console.error('Buku belum terbuka. Selesaikan pembuatan buku dulu sampai Beranda tampil, lalu jalankan lagi.');
  if (typeof DEMO.contoh !== 'function') return console.error('Versi aplikasi masih lama. Muat ulang dengan Ctrl+Shift+R, lalu jalankan lagi.');

  const id = S.data.spreadsheetId, email = GOOGLE.email();
  const SH = 'https://sheets.googleapis.com/v4/spreadsheets/' + id;
  const c = DEMO.contoh();
  const ganti = v => (v === DEMO.EMAIL || v === DEMO.EMAIL_PASANGAN ? email : v);
  const gantiTeks = s => String(s).split(DEMO.EMAIL).join(email).split(DEMO.EMAIL_PASANGAN).join(email);
  const baca = async r => (await GOOGLE.api(SH + '/values/' + encodeURIComponent(r))).values || [];
  const tambah = async (nama, rows) => {
    if (!rows.length) return 0;
    await GOOGLE.api(SH + '/values/' + encodeURIComponent("'" + nama + "'!A1") + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', json: { values: rows } });
    return rows.length;
  };
  const hasil = {};

  // Kategori & dompet: hanya yang belum ada.
  const kat = new Set((await baca("'Kategori'!A2:B")).map(r => r[0] + '|' + r[1]));
  hasil.kategori = await tambah('Kategori', c.Kategori.filter(r => !kat.has(r[0] + '|' + r[1])));
  const dom = new Set((await baca("'Dompet'!A2:A")).map(r => r[0]));
  hasil.dompet = await tambah('Dompet', c.Dompet.filter(r => !dom.has(r[0])));

  // Transaksi: sampai total TARGET.
  const sudah = (await baca("'Transaksi'!A2:A")).filter(r => r[0]).length;
  const kurang = Math.max(0, TARGET - sudah);
  let trx = c.Transaksi.map(r => r.map(ganti));
  if (trx.length > kurang) trx = trx.slice(trx.length - kurang); // yang terbaru
  const keluar = trx.filter(r => r[2] === 'Pengeluaran');
  const awal = Math.min(...trx.map(r => r[1]).concat([Math.floor((Date.now() - Date.UTC(1899, 11, 30)) / 864e5)]));
  for (let i = 0; trx.length < kurang && keluar.length; i++) { // kurang: tambah transaksi harian yang lebih lama
    const r = keluar[i % keluar.length].slice();
    const tgl = awal - 1 - Math.floor(i / 3);
    r[0] = 'demo-' + crypto.randomUUID();
    r[1] = tgl;
    r[9] = r[10] = tgl + (8 + (i % 12)) / 24;
    trx.unshift(r);
  }
  hasil.transaksi = await tambah('Transaksi', trx);

  // Tagihan rutin & catatan (yang namanya / judulnya sudah ada dilewati, jadi aman dijalankan ulang).
  const rut = new Set((await baca("'Rutin'!B2:B")).map(r => r[0]));
  hasil.rutin = await tambah('Rutin', c.Rutin.filter(r => !rut.has(r[1])));
  const cat = new Set((await baca("'Catatan'!C2:C")).map(r => r[0]));
  hasil.catatan = await tambah('Catatan', c.Catatan.filter(r => !cat.has(r[2])).map(r => r.map(ganti)));

  // Tantangan & emas (sheet Pengaturan, kunci TANTANGAN / EMAS).
  const set = await baca("'Pengaturan'!A2:B");
  for (const [k, v] of c.Pengaturan.filter(r => r[0] === 'TANTANGAN' || r[0] === 'EMAS')) {
    const i = set.findIndex(r => r[0] === k);
    if (i >= 0) {
      await GOOGLE.api(SH + '/values/' + encodeURIComponent("'Pengaturan'!A" + (i + 2)) + '?valueInputOption=RAW', { method: 'PUT', json: { values: [[k, gantiTeks(v)]] } });
    } else await tambah('Pengaturan', [[k, gantiTeks(v)]]);
  }
  hasil.pengaturan = 'TANTANGAN & EMAS';

  console.log('✅ Data demo ditambahkan:', hasil, '| transaksi sekarang:', sudah + hasil.transaksi, '→ muat ulang aplikasi.');
  return hasil;
})();
