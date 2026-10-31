# Dompet Keluarga

Aplikasi pencatat keuangan keluarga berbasis Google Apps Script. Datanya disimpan di Google Spreadsheet milik Anda di Google Drive, dan bisa dipakai berdua dengan akun Google masing-masing.

## Isi folder `src/`

| File | Nama di editor Apps Script | Isinya |
|------|----------------------------|--------|
| `Code.gs` | `Code.gs` | Backend: baca/tulis spreadsheet |
| `Index.html` | `Index` | Kerangka halaman |
| `Styles.html` | `Styles` | Tampilan (CSS) |
| `App.html` | `App` | Logika halaman (JavaScript) |
| `appsscript.json` | `appsscript.json` | Pengaturan zona waktu dan web app |

## Cara memasang (sekali saja, oleh pemilik)

Spreadsheet tidak perlu dibuat sendiri. Aplikasi akan membuatnya otomatis saat pertama kali dibuka.

### 1. Buat proyek Apps Script
1. Buka https://script.new (login dengan akun Google Anda).
2. Beri nama proyek di kiri atas, misalnya **Dompet Keluarga**.

### 2. Tempel kode
1. Klik ikon ⚙️ **Project Settings** di menu kiri, lalu centang **Show "appsscript.json" manifest file in editor**.
2. Kembali ke ikon **< > Editor**.
3. Buka `appsscript.json`, hapus semua isinya, lalu tempel isi file `src/appsscript.json`.
4. Buka `Code.gs`, hapus semua isinya, lalu tempel isi file `src/Code.gs`.
5. Klik **＋** di samping "Files", pilih **HTML**, beri nama `Index` (tanpa `.html`), lalu tempel isi `src/Index.html`.
6. Ulangi langkah 5 untuk `Styles` dan `App`.
7. Klik 💾 **Save** (atau Ctrl+S).

### 3. Publikasikan sebagai web app
1. Klik **Deploy → New deployment**.
2. Klik ⚙️ di samping "Select type", pilih **Web app**.
3. Isi:
   - **Execute as:** `User accessing the web app`
   - **Who has access:** `Anyone with Google account`
4. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`). Ini alamat aplikasinya.

### 4. Buka aplikasi pertama kali (oleh pemilik)
1. Buka Web app URL dari langkah 3. Google akan meminta Anda memilih akun dan memberi izin.
2. Muncul layar "Google hasn't verified this app". Ini wajar karena aplikasinya Anda buat sendiri. Klik **Advanced → Go to Dompet Keluarga (unsafe) → Allow**.
3. Aplikasi menampilkan layar **Selamat datang**. Isi email Google istri (opsional), lalu ketuk **Mulai**.
4. Spreadsheet **Dompet Keluarga** otomatis dibuat di Google Drive Anda, berisi sheet **Transaksi**, **Kategori**, dan **Dompet**.

> Penting: lakukan langkah 4 sendiri segera setelah deploy. Akun pertama yang membuka aplikasi akan menjadi pemilik spreadsheet.

### 5. Bagikan ke istri
1. Kalau email istri belum diisi di langkah 4.3, buka menu **Lainnya → Undang anggota keluarga**, isi emailnya, lalu ketuk **Undang**.
2. Kirim URL web app ke istri, misalnya lewat WhatsApp.
3. Saat pertama kali membuka URL itu, istri juga akan melihat layar izin seperti langkah 4.2. Klik **Advanced → Go to … → Allow**. Ini hanya sekali.

> Keamanan: yang bisa membuka data hanya akun yang diberi akses ke spreadsheet. Orang lain yang mendapat URL-nya hanya akan melihat pesan "belum punya akses".

### 6. Pasang di layar utama HP
- **Android (Chrome):** buka URL, ketuk menu ⋮, lalu pilih **Tambahkan ke layar utama**.
- **iPhone (Safari):** buka URL, ketuk tombol Bagikan, lalu pilih **Tambah ke Layar Utama**.

## Baca foto struk dengan AI (Gemini)
1. Buat kunci API gratis di https://aistudio.google.com/apikey (**Create API key**).
2. Di aplikasi, buka **Lainnya → Baca struk dengan AI**, tempel kuncinya, lalu ketuk **Tambah**. Cukup sekali untuk satu keluarga.
   Boleh menambah **beberapa kunci**, misalnya dari akun Google yang berbeda. Kunci dipakai bergiliran supaya kuota gratisnya terbagi, dan kalau satu kunci kena batas kuota atau tidak valid, aplikasi otomatis mencoba kunci berikutnya.
3. Saat mencatat pengeluaran, ketuk **📷 Isi otomatis dari foto struk**, lalu ambil foto atau pilih dari galeri. Jumlah, tanggal, kategori, dan catatan akan terisi otomatis. Periksa lagi, lalu ketuk **Simpan**.

Struk dibaca berlapis, lalu hasilnya dicocokkan:
1. **AI foto**: Gemini membaca gambar langsung.
2. **OCR + AI**: gambar diubah jadi teks dengan OCR Google Drive, lalu teksnya disimpulkan Gemini.
3. **OCR**: teks OCR yang sama dibaca dengan aturan biasa (mencari baris TOTAL dan tanggal), tanpa AI.

Kalau minimal dua lapis sepakat soal total, hasilnya dianggap pasti. Kalau berbeda, form menampilkan pilihan nominal untuk diketuk. Tanpa kunci Gemini, hanya lapis OCR yang jalan.
OCR membuat file Google Docs sementara di Drive, lalu langsung menghapusnya. Aplikasi hanya meminta akses ke file yang dibuatnya sendiri (`drive.file`), bukan seluruh Drive.

Model default-nya `gemini-3.8-flash`. Untuk menggantinya, tambahkan `GEMINI_MODEL` di **Project Settings → Script Properties**.

## Kalau kode diperbarui
1. Tempel ulang file yang berubah di editor Apps Script, lalu Save.
2. Klik **Deploy → Manage deployments**, klik ✏️ pada deployment yang ada, ubah **Version** menjadi **New version**, lalu klik **Deploy**.
   URL tetap sama, jadi tidak perlu dibagikan ulang.

## Struktur data (spreadsheet)

- **Transaksi:** ID, Tanggal, Tipe (Pemasukan/Pengeluaran/Transfer), Jumlah, Kategori, Dompet, Dompet Tujuan, Catatan, Dibuat Oleh, Dibuat Pada, Diubah Pada
- **Kategori:** Nama, Tipe, Ikon
- **Dompet:** Nama, Ikon, Saldo Awal

Saldo dompet dihitung otomatis: saldo awal + pemasukan − pengeluaran ± transfer.
Jangan mengubah nama sheet atau urutan kolom secara manual, karena aplikasi membacanya berdasarkan posisi kolom.

## Rencana tahap berikutnya
- [x] Tahap 1: catat transaksi, kategori, dompet, riwayat, ringkasan bulanan, dipakai berdua
- [x] Tahap 2: input dari foto struk (kamera/galeri) dibaca oleh Gemini
- [ ] Tahap 3: tabungan (dengan target dan tanpa batas) dan anggaran per kategori
- [ ] Tahap 4: laporan dan grafik
- [ ] Tahap 5: bot Telegram dengan AI (bahasa bebas, CRUD, kirim foto struk)
