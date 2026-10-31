# Panduan Pemilik & Developer

Untuk pemilik deployment (setup Google Cloud, GitHub Pages, bot Telegram) dan siapa pun yang mengubah kode.
Panduan untuk **pengguna** ada di [README](../README.md); rencana pengembangan di [RENCANA-PENGEMBANGAN.md](RENCANA-PENGEMBANGAN.md).

## Cara kerja

- Tidak ada server. Saat dibuka, aplikasi meminta login Google, lalu langsung memanggil Google Sheets API dan Drive API dari browser.
- Saat pertama kali login, aplikasi menawarkan **membuat spreadsheet "Dompet Keluarga"** di Drive akun itu, atau **menghubungkan spreadsheet yang sudah ada**.
- Alamat spreadsheet tiap akun disimpan di folder tersembunyi khusus aplikasi di Google Drive (`appDataFolder`), jadi tetap ketemu walaupun ganti HP.
- Setiap `git push` ke branch `main` otomatis men-deploy folder `web/` ke GitHub Pages (lihat [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)).

## Isi repo

| Path | Isinya |
|------|--------|
| `web/index.html` | Kerangka halaman |
| `web/privasi.html` | Kebijakan privasi (syarat Google untuk status Production) |
| `web/assets/config.js` | **Client ID Google** dan **API key Google Picker** (wajib diisi sekali) |
| `web/assets/google.js` | Login Google, pemanggil API, Google Picker |
| `web/assets/db.js` | Baca/tulis spreadsheet (transaksi, kategori, dompet, pengaturan) |
| `web/assets/struk.js` | Baca foto struk berlapis: AI foto, OCR + AI, OCR |
| `web/assets/app.js` | Tampilan & interaksi |
| `web/assets/styles.css` | Tampilan (CSS) |
| `bot/Kode.gs`, `bot/appsscript.json` | Bot Telegram (Google Apps Script), lihat bagian **Bot Telegram** |
| `web/manifest.webmanifest`, `web/sw.js`, `web/ikon/` | PWA: bisa dipasang di layar utama, update otomatis |
| `docs/` | Panduan ini dan rencana pengembangan |

## Setup (sekali saja, oleh pemilik)

### 1. Aktifkan GitHub Pages
1. Buka repo di GitHub, lalu **Settings → Pages**.
2. Di **Build and deployment → Source**, pilih **GitHub Actions**.
3. Buka tab **Actions** dan pastikan workflow **Deploy ke GitHub Pages** berhasil (centang hijau). Kalau gagal karena Pages belum aktif, klik **Re-run jobs**.

### 2. Setup Google Cloud (untuk login Google)
Aplikasi hanya memakai izin **non-sensitif** (`drive.file`, `drive.appdata`, `email`), jadi setelah dipublikasikan bisa dipakai siapa saja tanpa daftar Test users.

1. Buka https://console.cloud.google.com, lalu buat project baru, misalnya **Dompet Keluarga**.
2. Buka **APIs & Services → Library**, lalu aktifkan **Google Sheets API**, **Google Drive API**, dan **Google Picker API**.
3. Buka **Google Auth Platform** (atau **OAuth consent screen**):
   - **Branding:** nama aplikasi *Dompet Keluarga*, email Anda sebagai support email,
     **Application home page** `https://shiroesyn202601-ship-it.github.io/dompet-keluarga/`,
     **Privacy policy** `https://shiroesyn202601-ship-it.github.io/dompet-keluarga/privasi.html`,
     dan **Authorized domain** `shiroesyn202601-ship-it.github.io`.
   - **Audience:** pilih **External**.
   - **Data access:** tambahkan scope `.../auth/drive.file` dan `.../auth/drive.appdata` saja. **Hapus** `.../auth/spreadsheets` kalau masih ada (versi lama memakainya).
4. Buka **Clients** (atau **Credentials → Create credentials → OAuth client ID**):
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** `https://shiroesyn202601-ship-it.github.io`
   - Klik **Create**, lalu salin **Client ID** (berakhiran `.apps.googleusercontent.com`).
5. Buka **Credentials → Create credentials → API key** untuk Google Picker:
   - **Application restrictions:** *Websites*, isi `https://shiroesyn202601-ship-it.github.io/*`.
   - **API restrictions:** *Restrict key*, lalu centang **Google Picker API** saja.
6. Tempel Client ID dan API key itu di [web/assets/config.js](../web/assets/config.js) (`clientId` dan `pickerApiKey`), lalu commit dan push. Aplikasi otomatis ter-deploy ulang.
7. Kembali ke **Audience**, lalu klik **Publish app** supaya status berubah dari *Testing* menjadi **In production**.
   Coba masuk dengan akun Google yang belum pernah dipakai. Kalau masih muncul layar peringatan, buka **Verification Center** dan ajukan verifikasi branding.

### 3. Buka aplikasi
1. Buka https://shiroesyn202601-ship-it.github.io/dompet-keluarga/, lalu ketuk **Masuk dengan Google**.
2. Pastikan **semua akses dicentang**, lalu klik **Continue**.
3. Ikuti layar setup: pilih dompet yang dipakai, isi saldonya sekarang, (opsional) email anggota keluarga, lalu ketuk **Mulai pakai**. Kalau sudah punya spreadsheet, ketuk **Pilih dari Google Drive** di bawahnya.

Token login Google berlaku sekitar 1 jam. Setelah itu muncul kartu **Sesi login berakhir**. Cukup ketuk **Lanjutkan sebagai …**, isian form tidak hilang.

### 4. Undang anggota keluarga
1. Buka **⚙️ → Undang anggota keluarga**, isi email Google-nya, lalu ketuk **Undang**. Google akan mengirim email berisi link undangan.
2. Bisa juga salin **link undangan** di menu yang sama, lalu kirim lewat WhatsApp.
3. Yang diundang membuka link itu, masuk dengan akunnya, lalu ketuk **Pilih spreadsheet**, pilih file **Dompet Keluarga**, dan konfirmasi.
   Langkah memilih ini hanya sekali, karena aplikasi baru boleh membuka spreadsheet milik orang lain setelah dipilih sendiri oleh penggunanya.

### Pindahan dari versi lama
- **Sudah memakai aplikasi sebelum pembaruan izin:** saat pertama buka, aplikasi bisa meminta **Pilih spreadsheet**. Ketuk, lalu pilih file Dompet Keluarga yang sama. Ini terjadi sekali saja untuk spreadsheet yang tidak dibuat oleh akun itu lewat aplikasi web ini (mis. dari versi Apps Script, atau milik pasangan).
- **Dari versi Apps Script:** saat pertama login, pilih **Sudah punya spreadsheet? → Pilih dari Google Drive**, lalu pilih spreadsheet lama.
  Kunci API Gemini perlu ditambahkan ulang. Spreadsheet lama juga harus dibagikan manual ke anggota keluarga lewat tombol **Bagikan** di Google Sheets, karena aplikasi hanya boleh membagikan file yang dibuatnya sendiri.
## Baca foto struk (teknis)

Struk dibaca berlapis, lalu hasilnya dicocokkan:
1. **AI foto**: Gemini membaca gambar langsung.
2. **OCR + AI**: gambar diubah jadi teks dengan OCR Google Drive, lalu teksnya disimpulkan Gemini.
3. **OCR**: teks OCR yang sama dibaca dengan aturan biasa (baris TOTAL dan tanggal), tanpa AI.

Kalau minimal dua lapis sepakat soal total, hasilnya dianggap pasti. Kalau berbeda, form menampilkan pilihan nominal untuk diketuk.
Kunci Gemini disimpan di sheet **Pengaturan** pada spreadsheet keluarga. Model default-nya `gemini-3.8-flash`, dan bisa diganti dengan menambah baris `GEMINI_MODEL` di sheet itu.

## Bot Telegram (teknis)

Bot berjalan di **Google Apps Script** (gratis), karena GitHub Pages tidak bisa menerima pesan dari Telegram. Kodenya ada di folder [bot/](../bot/).

### Memasang bot (sekali saja, oleh pemilik)
1. **Buat bot:** di Telegram, buka [@BotFather](https://t.me/BotFather) → `/newbot`, beri nama (mis. *Dompet Keluarga Kita*) dan username (harus berakhiran `bot`). Salin **token** yang diberikan.
2. **Buat proyek Apps Script:** buka https://script.new, lalu beri nama **Dompet Keluarga Bot**.
   - ⚙️ **Project Settings** → centang **Show "appsscript.json" manifest file in editor**.
   - Tempel isi [bot/appsscript.json](../bot/appsscript.json) ke `appsscript.json`, dan isi [bot/Kode.gs](../bot/Kode.gs) ke `Kode.gs`. Simpan.
3. **Isi Script Properties:** ⚙️ **Project Settings → Script Properties → Add script property**:
   - `TELEGRAM_TOKEN` = token dari BotFather
   - `SPREADSHEET_ID` = ID spreadsheet keluarga (salin dari aplikasi: **⚙️ → Bot Telegram**)
4. **Deploy:** **Deploy → New deployment → ⚙️ Web app**:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`

   Klik **Deploy** dan beri izin (**Advanced → Go to … → Allow**).
5. **Pasang webhook:** di editor, pilih fungsi **pasangWebhook** lalu klik **▶ Run**. Di Execution log akan muncul `✅ Bot @namabot terpasang`.
6. **Tautkan akun:** di aplikasi, buka **⚙️ → Bot Telegram → Hubungkan akun Telegram saya**, lalu ketuk **Buka Telegram & hubungkan**. Anggota keluarga lain melakukan hal yang sama dari akunnya sendiri.

Hanya akun Telegram yang sudah ditautkan yang bisa memakai bot. Orang lain yang menemukan bot hanya mendapat pesan "belum terhubung".

### Kalau bot tidak membalas
- Jalankan fungsi **cekWebhook** dan lihat `last_error_message` di Execution log.
- Buka **⏱ Executions** di Apps Script untuk melihat error tiap pesan.
- Kalau webhook terus bermasalah, jalankan **modePolling**. Bot lalu mengecek pesan setiap 1 menit, jadi balasannya sedikit lebih lambat. Jalankan **pasangWebhook** untuk kembali ke mode webhook.
- Setiap kali `Kode.gs` diubah: **Deploy → Manage deployments → ✏️ → New version → Deploy**. URL tidak berubah, jadi webhook tidak perlu dipasang ulang.

## Mengembangkan
- Ubah file di `web/`, lalu commit dan push ke `main`. Deploy berjalan otomatis dalam 1–2 menit (pantau di tab **Actions**).
- Untuk mencoba di komputer sendiri, jalankan server statis, misalnya `npx serve web`, lalu tambahkan `http://localhost:3000` ke **Authorized JavaScript origins** di Google Cloud.

## Struktur data (spreadsheet)

- **Transaksi:** ID, Tanggal, Tipe (Pemasukan/Pengeluaran/Transfer), Jumlah, Kategori, Dompet, Dompet Tujuan, Catatan, Dibuat Oleh, Dibuat Pada, Diubah Pada
- **Kategori:** Nama, Tipe, Ikon, Anggaran (batas per bulan, khusus pengeluaran)
- **Dompet:** Nama, Ikon, Saldo Awal, Jenis (Dompet/Tabungan), Target, Tenggat
- **Pengaturan:** Kunci, Nilai (kunci API Gemini, model, username bot, akun Telegram yang tertaut)
- **Rutin:** ID, Nama, Tipe, Jumlah, Kategori, Dompet, Dompet Tujuan, Catatan, Ulang (Bulanan/Mingguan/Tahunan), Mulai (patokan tanggal), Berikutnya (jatuh tempo berikutnya). Ditambahkan otomatis ke spreadsheet lama. Tagihan tanggal 31 jatuh di akhir bulan pendek lalu kembali ke 31 (patokan dari kolom Mulai).

Saldo dompet dihitung otomatis: saldo awal + pemasukan − pengeluaran ± transfer.
Jangan mengubah nama sheet atau urutan kolom secara manual, karena aplikasi membacanya berdasarkan posisi kolom.
Karena itu setiap sheet diberi proteksi **hanya peringatan** (deskripsi `Dompet Keluarga: dikelola aplikasi`), dipasang otomatis saat aplikasi pertama membuka spreadsheet. Proteksi ini tidak menghalangi aplikasi, bot, maupun API; kalau ingin mencabutnya: Data → Protect sheets and ranges.

Transaksi diubah/dihapus berdasarkan kolom **ID** (dicari sesaat sebelum menulis), bukan nomor baris yang dibaca sebelumnya.

## Mode offline
- Data terakhir disimpan di `localStorage` (`dk_data_<email>`). Tanpa sinyal, aplikasi menampilkan data itu dengan baris status 📴.
- Transaksi baru tanpa sinyal disimpan di `dk_tertunda_<email>` beserta ID buatan HP (`idBaru`), lalu dikirim otomatis saat online (`SERVER.simpanTransaksi` melewati ID yang sudah ada, jadi kiriman ulang tidak dobel).
- Transaksi tertunda yang ditolak (mis. dompetnya sudah dihapus) ditandai gagal dan bisa **Catat ulang**. Ubah/hapus transaksi tetap butuh sinyal.
- **Keluar** menghapus kedua kunci di atas.

## Riwayat tahap
- [x] Tahap 1: catat transaksi, kategori, dompet, riwayat, ringkasan bulanan, dipakai berdua
- [x] Tahap 2: input dari foto struk (kamera/galeri), dibaca berlapis (AI + OCR)
- [x] Pindah ke GitHub Pages dengan deploy otomatis
- [x] Tahap 3: tabungan (dengan target dan tanpa batas) dan anggaran per kategori
- [x] Tahap 4: laporan dan grafik
- [x] Redesign tampilan (gaya fintech bersih)
- [x] Tahap 5: bot Telegram dengan AI (bahasa bebas, CRUD, kirim foto struk)
- [x] Langkah 1 (rencana pengembangan): izin Google non-sensitif, Google Picker, sesi habis tanpa kehilangan isian, kebijakan privasi
- [x] Langkah 2: wizard setup (dompet + saldo), sesuaikan saldo, menu fitur lanjutan, bahasa netral
- [x] Langkah 3: mode offline & transaksi tertunda, zoom tidak diblokir, tulis/hapus transaksi berdasarkan ID, proteksi peringatan di sheet
