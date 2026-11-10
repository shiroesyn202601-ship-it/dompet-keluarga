# Paket merek Dompet Keluarga

Dipakai untuk media sosial, Play Store, presentasi, dan materi promosi. Ikon aplikasi ada di `web/ikon/`
(sumbernya `web/ikon/logo.svg`, sama dengan `logo.svg` di sini).

Logo: dompet teal yang tutupnya membentuk atap rumah, dua lembar uang hijau terselip di belakangnya, pengait amber.
Ikon di `web/ikon/`:
- `ikon-192.png` / `ikon-512.png`: logo saja, dipakai di dalam aplikasi (di sebelah tulisan nama).
- `ikon-nama-192.png` / `ikon-nama-512.png`: logo + tulisan "Dompet Keluarga", ikon `any` di manifest supaya nama ikut tampil di splash Android.
- `maskable-512.png`: logo saja, ikon layar utama Android (tanpa tulisan, karena di ukuran ikon tulisan tidak terbaca).
- `apple-touch-icon.png`, `favicon-32.png`: logo saja.

Gambar logo yang digambar ulang lewat kanvas (gambar bagikan) ada di `gambarLogo` di `web/assets/app-halaman.js`; samakan kalau logo berubah.

## File

| File | Untuk |
|---|---|
| `logo.svg` | Logo saja, bisa diperbesar tanpa pecah |
| `logo-nama-terang.png` | Logo + nama, di atas latar terang (putih, krem) |
| `logo-nama-gelap.png` | Logo + nama, di atas latar gelap (teal tua, hitam). Latarnya transparan, jadi di penampil gambar tampak kosong |
| `logo-nama-tagline-terang.png` / `-gelap.png` | Logo + nama + tagline, untuk banner dan slide pembuka |
| `foto-profil-1080.png` | Foto profil Instagram, TikTok, WhatsApp Business (dipotong bulat otomatis) |
| `web/gambar/pratinjau.jpg` | Gambar pratinjau link 1200×630 (WhatsApp, Telegram, Facebook) |

Aturan pakai logo:
- Jangan diberi bayangan, gradasi, garis tepi, atau efek lain. Jangan diputar atau dipipihkan.
- Beri ruang kosong di sekeliling logo minimal ¼ lebar logo.
- Ukuran terkecil: 20px untuk ikon, 120px lebar untuk logo + nama.

## Tagline

**Uang keluarga akur, sampai gajian berikutnya.**

Pakai kalimat yang sama persis di layar masuk, halaman pengenalan, pratinjau link, bio media sosial, dan
listing Play Store. Jangan dibuat variasinya. Merek terasa kuat kalau kalimatnya selalu sama.

Kalimat pendukung (pilih sesuai ruang):
- Dicatat berdua dari HP masing-masing, angkanya langsung sama.
- Tahu berapa yang aman dibelanjakan tiap hari.
- Data di Google Drive Anda sendiri, gratis tanpa iklan.

## Gaya bahasa

- **Hangat dan tenang, bukan menggurui.** "Pengeluaran naik 12% dari bulan lalu", bukan "Anda boros!".
- **Kalimat pendek, kata sehari-hari.** "Aman dibelanjakan", bukan "alokasi dana diskresioner".
- **Sapaan "Anda"** di mode bahasa biasa; mode santai ("kamu") hanya untuk yang memilihnya di aplikasi.
- **Angka di depan.** Orang membuka aplikasi keuangan untuk melihat angka, jadi angka ditaruh di awal kalimat.
- **Merayakan yang kecil.** Hari tanpa belanja dan target tabungan yang tercapai pantas diberi selamat.

## Warna

| Nama | Kode | Dipakai untuk |
|---|---|---|
| Teal | `#0e7c86` | Warna utama: tombol, tautan, logo |
| Teal tua | `#062a2e` → `#0b4f55` | Kartu saldo, latar gambar Story |
| Amber | `#f5a524` | Aksen: pengait dompet di logo, sorotan kecil |
| Krem | `#fff4e3` | Latar logo |
| Hijau | `#079455` | Khusus pemasukan |
| Merah koral | `#d63c2f` (gelap: `#ff8a7a`) | Khusus pengeluaran |

Hijau dan merah koral hanya untuk arti uang masuk/keluar. Jangan dipakai sebagai warna hiasan. (Pengecualian: lembar uang di logo memakai hijau muda `#5fb48e` / `#7cc8a4`.) Hindari pink dan ungu: tidak termasuk warna merek.

## Huruf

**Plus Jakarta Sans** (gratis, Google Fonts). Judul memakai ketebalan 800, teks biasa 500–600.
