/**
 * Pengaturan aplikasi. Client ID bukan rahasia (memang terlihat di browser), jadi aman di-commit.
 * Cara membuatnya ada di README, bagian "Setup Google Cloud".
 */
const KONFIG = {
  clientId: '669221737081-jerp2njdv8dqibrvndei3sefolm4b1d5.apps.googleusercontent.com',
  // Kunci API untuk Google Picker (juga bukan rahasia; batasi ke Picker API + alamat situs ini di Google Cloud).
  pickerApiKey: 'AIzaSyB1MrwwVPctbKC6-6RaF0IZW1pj4s1PEVs',
  // Bot Telegram bersama (satu bot untuk semua pengguna, lihat docs/PEMILIK.md → Bot Telegram).
  // Nama bot tanpa @, dan email service account bot. Kosong = bot khusus pemilik (SPREADSHEET_ID).
  botTelegram: 'catkeukuBot',
  emailBot: 'dompet-bot@dompet-keluarga-513306.iam.gserviceaccount.com',
  // Versi penuh (lihat docs/PEMILIK.md → Versi penuh & pembayaran). Selama rekening atau botTelegram masih kosong,
  // batas tidak berlaku sama sekali. Kunci publik bukan rahasia: hanya bisa MEMERIKSA kode aktivasi,
  // membuatnya butuh kunci rahasia yang disimpan di bot (Script Property LISENSI_KUNCI).
  bayar: {
    batasGratis: 450,  // jumlah baris di sheet Transaksi sebelum pencatatan baru dikunci
    harga: 30000,      // sekali bayar, seumur hidup
    bank: 'DANA',      // nama bank / e-wallet, mis. 'BCA', 'DANA'
    rekening: '087873369841', // nomor rekening / nomor e-wallet
    atasNama: '',      // opsional; kosong = baris "a.n." tidak ditampilkan
    // Bukti transfer dikirim pembeli ke bot Telegram (KONFIG.botTelegram), lalu diteruskan ke ADMIN_TELEGRAM.
    // URL web app bot (berakhiran /exec, dari Apps Script → Deploy → Manage deployments). Diisi = /batal di bot
    // ikut berlaku di aplikasi: buku versi penuh menanyakan statusnya ke bot sekali sehari. Kosong = tidak dicek.
    urlBot: 'https://script.google.com/macros/s/AKfycbwLzTahKW5P2N6GsIwfm_zxRQKOJHMqR4oAizkZ5lupwgHogtI_66cF01NoahJ3wW3H/exec',
    // Cadangan manual: kode buku (ID spreadsheet) yang lisensinya dicabut. Buku ini dianggap belum lunas
    // walaupun kode aktivasinya asli. Contoh: dicabut: ['1AbC…', '1XyZ…'],
    dicabut: [],
    kunciPublik: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqTwaIZPUI4b0DwwOGoB1BT0GuwUioTlzEZWQrgntruoppFer08vMtBKROx+ByTzVyya88V3CPPS67ych6DLyexxp9raRNErWO4MduxajAX9uFSWFeduxFLsE8EPGn+Mj90Nzry+5ArpWbKSnsmwi16OKTXB+RZmWfUl8V3ceP518uY6TPDWedZ5LnyujBWyoPXe2HtDbGP4Cf0fKiNneleiMzhrtyCzSC7Pz+TCy21WBsZCzSWke8zLLe/AeBB/qLNaWglL3a4G3Uwh8Jy8WMO0SkHtiWGSbwmzPAzaDtndfa31Ju1Z9Y2PDcDGyrh8FVdyBw2ql4K9vh98m+ctWqQIDAQAB',
  },
};
