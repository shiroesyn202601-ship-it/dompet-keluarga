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
  botTelegram: '',
  emailBot: '',
};
