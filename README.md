# Dompet Keluarga

Aplikasi pencatat keuangan keluarga yang berjalan sepenuhnya di browser dan di-hosting di GitHub Pages.
Datanya disimpan di Google Spreadsheet milik Anda sendiri, dan bisa dipakai berdua dengan akun Google masing-masing.

**Alamat aplikasi:** https://shiroesyn202601-ship-it.github.io/dompet-keluarga/

## Cara kerja

- Tidak ada server. Saat dibuka, aplikasi meminta login Google, lalu langsung memanggil Google Sheets API dan Drive API dari browser.
- Saat pertama kali login, aplikasi menawarkan **membuat spreadsheet "Dompet Keluarga"** di Drive akun itu, atau **menghubungkan spreadsheet yang sudah ada**.
- Alamat spreadsheet tiap akun disimpan di folder tersembunyi khusus aplikasi di Google Drive (`appDataFolder`), jadi tetap ketemu walaupun ganti HP.
- Setiap `git push` ke branch `main` otomatis men-deploy folder `web/` ke GitHub Pages (lihat [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Isi repo

| Path | Isinya |
|------|--------|
| `web/index.html` | Kerangka halaman |
| `web/assets/config.js` | **Client ID Google** (wajib diisi sekali) |
| `web/assets/google.js` | Login Google & pemanggil API |
| `web/assets/db.js` | Baca/tulis spreadsheet (transaksi, kategori, dompet, pengaturan) |
| `web/assets/struk.js` | Baca foto struk berlapis: AI foto, OCR + AI, OCR |
| `web/assets/app.js` | Tampilan & interaksi |
| `web/assets/styles.css` | Tampilan (CSS) |

## Setup (sekali saja, oleh pemilik)

### 1. Aktifkan GitHub Pages
1. Buka repo di GitHub, lalu **Settings → Pages**.
2. Di **Build and deployment → Source**, pilih **GitHub Actions**.
3. Buka tab **Actions** dan pastikan workflow **Deploy ke GitHub Pages** berhasil (centang hijau). Kalau gagal karena Pages belum aktif, klik **Re-run jobs**.

### 2. Setup Google Cloud (untuk login Google)
1. Buka https://console.cloud.google.com, lalu buat project baru, misalnya **Dompet Keluarga**.
2. Buka **APIs & Services → Library**, lalu aktifkan **Google Sheets API** dan **Google Drive API**.
3. Buka **Google Auth Platform** (atau **OAuth consent screen**):
   - **Branding:** nama aplikasi *Dompet Keluarga*, dan email Anda sebagai support email.
   - **Audience:** pilih **External**. Biarkan status **Testing**, lalu di **Test users** tambahkan email Google Anda **dan email istri**. Hanya akun di daftar ini yang bisa login.
   - **Data access:** tambahkan scope `.../auth/spreadsheets`, `.../auth/drive.file`, dan `.../auth/drive.appdata`.
4. Buka **Clients** (atau **Credentials → Create credentials → OAuth client ID**):
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** `https://shiroesyn202601-ship-it.github.io`
   - Klik **Create**, lalu salin **Client ID** (berakhiran `.apps.googleusercontent.com`).
5. Tempel Client ID itu di [web/assets/config.js](web/assets/config.js), lalu commit dan push. Aplikasi otomatis ter-deploy ulang.

### 3. Buka aplikasi
1. Buka https://shiroesyn202601-ship-it.github.io/dompet-keluarga/, lalu ketuk **Masuk dengan Google**.
2. Kalau muncul *"Google hasn't verified this app"*, klik **Continue**. Ini wajar karena aplikasinya Anda buat sendiri.
3. Pastikan **semua akses dicentang**, lalu klik **Continue**.
4. Pilih **Buat spreadsheet baru** (boleh sekalian isi email istri), atau **Hubungkan** spreadsheet yang sudah ada.

### 4. Undang istri
1. Buka **Lainnya → Undang anggota keluarga**, isi email Google istri, lalu ketuk **Undang**. Google akan mengirim email berisi link undangan.
2. Bisa juga salin **link undangan** di menu yang sama, lalu kirim lewat WhatsApp.
3. Istri membuka link itu dan masuk dengan akunnya. Aplikasi otomatis terhubung ke spreadsheet yang sama.

Email istri harus sudah ada di daftar **Test users** (langkah 2.3), kalau tidak dia tidak bisa login.

### Pindahan dari versi Apps Script
Spreadsheet lama tetap bisa dipakai. Saat pertama login, pilih **Sudah punya spreadsheet?**, tempel link spreadsheet lama, lalu ketuk **Hubungkan**.
Kunci API Gemini perlu ditambahkan ulang. Spreadsheet lama juga harus dibagikan manual ke istri lewat tombol **Bagikan** di Google Sheets, karena aplikasi hanya boleh mengatur file yang dibuatnya sendiri.

## Baca foto struk
1. Buat kunci API Gemini gratis di https://aistudio.google.com/apikey.
2. Di aplikasi, buka **Lainnya → Baca struk dengan AI**, tempel kuncinya, lalu ketuk **Tambah**. Boleh lebih dari satu kunci. Kunci dipakai bergiliran, dan kalau satu kena batas kuota, aplikasi otomatis mencoba kunci berikutnya.
3. Saat mencatat pengeluaran, ketuk **📷 Isi otomatis dari foto struk**.

Struk dibaca berlapis, lalu hasilnya dicocokkan:
1. **AI foto**: Gemini membaca gambar langsung.
2. **OCR + AI**: gambar diubah jadi teks dengan OCR Google Drive, lalu teksnya disimpulkan Gemini.
3. **OCR**: teks OCR yang sama dibaca dengan aturan biasa (baris TOTAL dan tanggal), tanpa AI.

Kalau minimal dua lapis sepakat soal total, hasilnya dianggap pasti. Kalau berbeda, form menampilkan pilihan nominal untuk diketuk.
Kunci Gemini disimpan di sheet **Pengaturan** pada spreadsheet keluarga. Model default-nya `gemini-3.8-flash`, dan bisa diganti dengan menambah baris `GEMINI_MODEL` di sheet itu.

## Tabungan
- Buka tab **Dompet → ＋ Tambah tabungan**. Target boleh diisi (mis. Dana Darurat Rp10 juta, tercapai Desember), atau dikosongkan untuk tabungan **tanpa batas**.
- Ketuk sebuah tabungan, lalu pilih **Setor** atau **Tarik**. Keduanya dicatat sebagai transaksi Transfer dari atau ke dompet, jadi saldo dompet ikut berkurang atau bertambah.
- Untuk tabungan bertarget, aplikasi menampilkan progres (%), kekurangannya, dan kalau ada tenggat, berapa yang perlu disetor per bulan.
- Saldo tabungan tidak dihitung di "Total saldo dompet", tetapi ditampilkan terpisah.

## Anggaran
- Ketuk **Atur** di kartu Anggaran (Beranda), atau buka **⚙️ → Anggaran bulanan**. Isi batas belanja per kategori. Kosongkan kategori yang tidak perlu dibatasi.
- Di Beranda, setiap kategori ditampilkan dengan meter. **⚠️ Hampir habis** muncul saat pemakaian mencapai 80%, dan **⛔ Lewat** saat melebihi batas.

## Laporan
Tab **Laporan** (per tahun) berisi:
- Ringkasan: pemasukan, pengeluaran, selisih (dan persentasenya dari pemasukan), rata-rata pengeluaran per bulan, dan jumlah yang masuk tabungan.
- Grafik pemasukan & pengeluaran per bulan. Ketuk sebuah bulan untuk melihat rinciannya. Data grafik juga bisa dilihat sebagai tabel.
- Pengeluaran per kategori, untuk bulan terpilih atau setahun.
- Perbandingan dengan bulan sebelumnya: kategori yang naik ▲ atau turun ▼.
- Pengeluaran per anggota keluarga (siapa yang mencatat).

Menu pengaturan (**Lainnya**) sekarang dibuka dari ikon ⚙️ di pojok kanan atas Beranda.

## Mengembangkan
- Ubah file di `web/`, lalu commit dan push ke `main`. Deploy berjalan otomatis dalam 1–2 menit (pantau di tab **Actions**).
- Untuk mencoba di komputer sendiri, jalankan server statis, misalnya `npx serve web`, lalu tambahkan `http://localhost:3000` ke **Authorized JavaScript origins** di Google Cloud.

## Struktur data (spreadsheet)

- **Transaksi:** ID, Tanggal, Tipe (Pemasukan/Pengeluaran/Transfer), Jumlah, Kategori, Dompet, Dompet Tujuan, Catatan, Dibuat Oleh, Dibuat Pada, Diubah Pada
- **Kategori:** Nama, Tipe, Ikon, Anggaran (batas per bulan, khusus pengeluaran)
- **Dompet:** Nama, Ikon, Saldo Awal, Jenis (Dompet/Tabungan), Target, Tenggat
- **Pengaturan:** Kunci, Nilai (kunci API Gemini, model)

Saldo dompet dihitung otomatis: saldo awal + pemasukan − pengeluaran ± transfer.
Jangan mengubah nama sheet atau urutan kolom secara manual, karena aplikasi membacanya berdasarkan posisi kolom.

## Rencana tahap berikutnya
- [x] Tahap 1: catat transaksi, kategori, dompet, riwayat, ringkasan bulanan, dipakai berdua
- [x] Tahap 2: input dari foto struk (kamera/galeri), dibaca berlapis (AI + OCR)
- [x] Pindah ke GitHub Pages dengan deploy otomatis
- [x] Tahap 3: tabungan (dengan target dan tanpa batas) dan anggaran per kategori
- [x] Tahap 4: laporan dan grafik
- [ ] Tahap 5: bot Telegram dengan AI (bahasa bebas, CRUD, kirim foto struk)
