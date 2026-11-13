// Dimuat sebelum google.js di admin.html: sesi login halaman admin disimpan terpisah dari aplikasi,
// supaya masuk dengan akun pemilik bot di sini tidak mengganti akun Dompet Keluarga di browser yang sama.
window.KUNCI_SESI = 'dk_sesi_admin';

// Tema yang dipilih admin ('light' / 'dark'); kosong = mengikuti perangkat. Dipasang sebelum halaman tampil.
try {
  const tema = localStorage.getItem('dk_admin_tema');
  if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
} catch (e) { /* abaikan */ }
